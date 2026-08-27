#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure expo-dev-client is in package.json
if ! grep -q '"expo-dev-client"' package.json; then
  echo "Installing expo-dev-client..."
  npx expo install expo-dev-client
fi

# Verify every local (file:) dependency — e.g. expo-icloud-file — actually
# resolves in node_modules. npm install can silently leave a local package's
# node_modules symlink missing (seen in practice: node_modules existed and
# looked otherwise complete, but the file: symlink for a native module was
# gone) even though package.json/package-lock.json both look correct. A
# missing link means the native module never autolinks, which produces no
# build-time error at all — just a silent "Cannot read property 'X' of
# null" at the JS call site the first time the module is used. Hard-fail
# if the dependency's target directory itself is missing (a stale
# package.json entry, not a missing link — npm install can't fix that).
missing_link=false
for entry in $(node -e "
  const pkg = require('./package.json');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, spec] of Object.entries(deps)) {
    if (spec.startsWith('file:')) console.log(name + '|' + spec.slice(5));
  }
"); do
  name="${entry%%|*}"
  target="${entry#*|}"
  if [[ ! -d "$target" ]]; then
    echo "Local dependency '$name' points to missing directory '$target' — fix package.json before building."
    exit 1
  fi
  if [[ ! -e "node_modules/$name" ]]; then
    echo "Local dependency '$name' is missing from node_modules..."
    missing_link=true
  fi
done
if [[ "$missing_link" == true ]]; then
  echo "Running npm install to relink local dependencies..."
  npm install
fi

# Generate native iOS project if it doesn't exist yet
if [[ ! -d ios ]]; then
  echo "No ios/ directory found — running expo prebuild..."
  npx expo prebuild --platform ios
fi

# Ensure pods are installed/synced.
# Run pod install if Podfile.lock is missing/stale, if generated pod headers
# are gone (e.g. after cleanup-disk-space.sh removed Pods/Headers without
# removing Podfile.lock, which makes the content check below pass incorrectly),
# if package.json has changed more recently than Podfile.lock — the general
# case: any newly added/merged native dependency leaves ios/Pods stale until
# pod install re-syncs it — or if a local dependency link was just restored
# above (Podfile.lock's mtime doesn't change just because node_modules did,
# so that case would otherwise be missed here).
if ! grep -q "expo-dev-client" ios/Podfile.lock 2>/dev/null || \
   [[ ! -d ios/Pods/Headers/Public/yoga ]] || \
   [[ package.json -nt ios/Podfile.lock ]] || \
   [[ "$missing_link" == true ]]; then
  echo "Syncing CocoaPods..."
  (cd ios && pod install)
fi

# Keep the xcassets icon in sync with the source asset.
# expo prebuild writes a placeholder when it first generates ios/ — syncing
# here ensures the real icon is always built in, even after a fresh prebuild.
# Applies to both the device and simulator paths below.
icon_src="assets/icon/icon-1024.png"
icon_dst=$(find ios -maxdepth 3 -path "*AppIcon.appiconset/App-Icon-1024x1024@1x.png" -not -path "*/Pods/*" | head -1)
if [[ -f "$icon_src" && -n "$icon_dst" ]]; then
  cp "$icon_src" "$icon_dst"
fi

# Keep CFBundleDisplayName in sync with app.json "name".
# expo prebuild sets it once; subsequent runs don't update it. Runs before
# target selection so both the device and simulator paths pick up a name
# change, not just whichever path used to set it.
app_name=$(node -e "console.log(require('./app.json').expo.name)")
info_plist=$(find ios -maxdepth 2 -name "Info.plist" -not -path "*/Pods/*" | head -1)
if [[ -n "$info_plist" && -n "$app_name" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $app_name" "$info_plist" 2>/dev/null || true
fi

# ---- Build target list ----
# Entry format: "type|udid|label"
#   type: Booted | Shutdown  → simulator
#         device             → physical device (USB, free)
#
# TestFlight/App Store submission is NOT handled here — use ship.sh instead.
# Dev-client (Debug config) builds can never pass Apple's App Store Connect
# validation: RCTKeyCommands.m compiles in under #if RCT_DEV and references
# private UIEvent selectors (_isKeyDown, _modifierFlags, _modifiedInput) that
# altool now rejects on every upload, regardless of SDK image. ship.sh builds
# the production profile (Release config, no dev client), which is required
# to pass validation.

entries=()

# Physical devices connected via USB
# UDIDs for real devices are 8HEX-16HEX (e.g. 00008110-000A7C843629801E)
# Simulators use standard UUID format (8-4-4-4-12) — filtered out here
while IFS= read -r line; do
  name=$(echo "$line" | sed -E 's/ \([^)]+\) \([0-9A-F]{8}-[0-9A-F]{16}\)$//')
  udid=$(echo "$line" | grep -oE '[0-9A-F]{8}-[0-9A-F]{16}')
  [[ -z "$udid" ]] && continue
  entries+=("device|$udid|$name [USB]")
done < <(
  xcrun xctrace list devices 2>/dev/null \
    | grep -E "\([0-9A-F]{8}-[0-9A-F]{16}\)"
)

# Simulators: booted first
while IFS= read -r line; do
  entries+=("$line")
done < <(
  xcrun simctl list devices available \
    | grep -E "\([0-9A-F-]{36}\)" \
    | sed -E 's/^[[:space:]]*(.*) \(([0-9A-F-]{36})\) \((Booted|Shutdown)\).*/\3|\2|\1 [Sim]/' \
    | sort -r
)

if [ ${#entries[@]} -eq 0 ]; then
  echo "No devices or simulators found."
  exit 1
fi

echo ""
echo "Select a target:"
echo ""
for i in {1..${#entries[@]}}; do
  IFS='|' read -r type udid label <<< "${entries[$i]}"
  marker=""
  [[ "$type" == "Booted" ]] && marker=" *"
  printf "  %d) %s%s\n" $i "$label" "$marker"
done
echo ""
echo "  (* = simulator already running)"
echo ""
read "choice?Choice [1-${#entries[@]}]: "

if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#entries[@]} )); then
  echo "Invalid choice."
  exit 1
fi

IFS='|' read -r type udid label <<< "${entries[$choice]}"

# Bump the build number on every local build (device or simulator) so
# Settings' "vX.Y.Z (N)" always reflects the build actually installed. This
# is an EAS-independent counter — appVersionSource: "remote" in eas.json
# means EAS ignores app.json's ios.buildNumber and manages its own for
# TestFlight/App Store builds (ship.sh), so the two numbers are expected to
# differ; this one only tracks local sim/device installs.
new_build=$(node -e "
  const fs = require('fs');
  const config = require('./app.json');
  config.expo.ios = config.expo.ios || {};
  const next = String(parseInt(config.expo.ios.buildNumber || '0', 10) + 1);
  config.expo.ios.buildNumber = next;
  fs.writeFileSync('./app.json', JSON.stringify(config, null, 2) + '\n');
  console.log(next);
")
echo "Build number: $new_build"
if [[ -n "$info_plist" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $new_build" "$info_plist" 2>/dev/null || true
fi

bundle_id=$(node -e "console.log(require('./app.json').expo.ios.bundleIdentifier)")
workspace=$(find ios -name "*.xcworkspace" -maxdepth 1 | head -1)
scheme=$(basename "$workspace" .xcworkspace)
config="Release"

echo ""
echo "Deploying to: $label ($udid) [$config]"
echo ""

# ---- Physical device path — local Xcode build over USB ----
if [[ "$type" == "device" ]]; then
  # Build, install, and launch directly via devicectl — no Metro, no
  # dependency on expo run:ios's own (occasionally flaky) device-open step.
  # ENABLE_USER_SCRIPT_SANDBOXING=NO: Xcode's newer script-phase sandboxing
  # blocks React Native's "Bundle React Native code and images" build script
  # from writing main.jsbundle (EPERM), since expo prebuild's generated
  # project doesn't declare that output for the sandboxed model. Overridden
  # here (not edited into project.pbxproj) so it survives `expo prebuild
  # --clean` regenerating ios/ from scratch.
  build_args=(-workspace "$workspace" -scheme "$scheme" -configuration Release -destination "id=$udid" -allowProvisioningUpdates ENABLE_USER_SCRIPT_SANDBOXING=NO build)
  echo "Building Release for device (no Metro)..."
  RCT_NO_LAUNCH_PACKAGER=true xcodebuild "${build_args[@]}" > /tmp/todo-build.log 2>&1 || {
    echo "Build failed. Log: /tmp/todo-build.log"
    tail -20 /tmp/todo-build.log
    exit 1
  }

  built_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/Release-iphoneos/*" 2>/dev/null | head -1)
  [[ -z "$built_app" ]] && { echo "No .app found after build."; exit 1; }

  echo "Installing on $label..."
  xcrun devicectl device install app --device "$udid" "$built_app"

  echo "Launching..."
  xcrun devicectl device process launch --device "$udid" "$bundle_id"

  echo ""
  echo "App launched in Release mode on $label — no Metro needed."
  exit 0
fi

# ---- Simulator path — local Xcode build ----

xcrun simctl uninstall "$udid" "$bundle_id" 2>/dev/null || true

# Clean build if no existing build or Podfile.lock changed.
# Release is ALWAYS a full clean build, never incrementally reused:
# expo-dev-client's podspec links expo-dev-launcher only for the Debug pod
# configuration (`:configurations => :debug`), so a truly fresh Release
# build never includes the dev-client launcher and boots straight into the
# app — no "Development servers / npx expo start" screen, no Metro
# dependency at all. An incrementally-reused Release build in DerivedData
# can be a stale artifact from before some pod/config change and silently
# still carry the old (possibly dev-launcher-linked) binary; Podfile.lock's
# mtime alone isn't a reliable signal that the cached build still reflects
# the current pod graph.
derived_app=""
[[ -d ~/Library/Developer/Xcode/DerivedData ]] && \
  derived_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/${config}-iphonesimulator/*" 2>/dev/null | head -1) || true
# See the device-Release build_args above for why ENABLE_USER_SCRIPT_SANDBOXING=NO is needed.
build_args=(-workspace "$workspace" -scheme "$scheme" -configuration "$config" -destination "id=$udid" ENABLE_USER_SCRIPT_SANDBOXING=NO)
if [[ -z "$derived_app" || ios/Podfile.lock -nt "$derived_app" ]]; then
  echo "Clearing DerivedData for clean build..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/${scheme}-*(N) 2>/dev/null || true
  build_args+=(clean)
fi
build_args+=(build)

echo "Building $config..."
RCT_NO_LAUNCH_PACKAGER=true xcodebuild "${build_args[@]}" > /tmp/todo-build.log 2>&1 || {
  echo "Build failed. Log: /tmp/todo-build.log"
  tail -20 /tmp/todo-build.log
  exit 1
}

built_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/${config}-iphonesimulator/*" 2>/dev/null | head -1)
[[ -z "$built_app" ]] && { echo "No .app found after build."; exit 1; }

echo "Installing..."
xcrun simctl install "$udid" "$built_app"

xcrun simctl launch "$udid" "$bundle_id"
echo ""
echo "App launched in Release mode — ready for screenshots."
