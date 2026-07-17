#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure expo-dev-client is in package.json
if ! grep -q '"expo-dev-client"' package.json; then
  echo "Installing expo-dev-client..."
  npx expo install expo-dev-client
fi

# Generate native iOS project if it doesn't exist yet
if [[ ! -d ios ]]; then
  echo "No ios/ directory found — running expo prebuild..."
  npx expo prebuild --platform ios
fi

# Detect stale entitlements: app.json declares entitlements but the generated
# .entitlements plist is empty. This happens when ios/ was created before
# entitlements were added to app.json and hasn't been regenerated since.
_ent_plist=$(find ios -name "*.entitlements" -maxdepth 3 2>/dev/null | head -1)
if [[ -n "$_ent_plist" ]]; then
  _app_ent_count=$(node -e "const e=require('./app.json').expo?.ios?.entitlements||{}; console.log(Object.keys(e).length)" 2>/dev/null || echo 0)
  _plist_key_count=$(grep -c '<key>' "$_ent_plist" 2>/dev/null || echo 0)
  if (( _app_ent_count > 0 && _plist_key_count == 0 )); then
    echo ""
    echo "⚠  app.json has $_app_ent_count entitlement(s) but $_ent_plist is empty."
    echo "   ios/ was generated before these entitlements were added."
    read "answer?Delete ios/ and regenerate with expo prebuild? [y/N] "
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      rm -rf ios
      npx expo prebuild --platform ios
    fi
  fi
fi

# Ensure pods are installed/synced.
# Run pod install if Podfile.lock is missing/stale OR if generated pod headers
# are gone (e.g. after cleanup-disk-space.sh removed Pods/Headers without
# removing Podfile.lock, which makes the content check below pass incorrectly).
if ! grep -q "expo-dev-client" ios/Podfile.lock 2>/dev/null || \
   [[ ! -d ios/Pods/Headers/Public/yoga ]]; then
  echo "Syncing CocoaPods..."
  (cd ios && pod install)
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

# ---- Physical device path — local Xcode build over USB ----
if [[ "$type" == "device" ]]; then
  echo ""
  echo "Building and installing on: $label ($udid)"
  echo "No build credits used — builds locally with Xcode."
  echo ""
  npx expo run:ios --device "$udid"
  exit 0
fi

# ---- Simulator path ----
echo ""
echo "Build configuration:"
echo ""
echo "  1) Debug   — dev build, live reload (default)"
echo "  2) Release — standalone build for screenshots (no dev overlay)"
echo ""
read "config_choice?Choice [1-2, default 1]: "

echo ""
echo "Deploying to: $label ($udid)"
echo ""

bundle_id=$(node -e "console.log(require('./app.json').expo.ios.bundleIdentifier)")
workspace=$(find ios -name "*.xcworkspace" -maxdepth 1 | head -1)
scheme=$(basename "$workspace" .xcworkspace)
config="Debug"
[[ "$config_choice" == "2" ]] && config="Release"

# Keep the xcassets icon in sync with the source asset.
# expo prebuild writes a placeholder when it first generates ios/ — syncing
# here ensures the real icon is always built in, even after a fresh prebuild.
icon_src="assets/icon/icon-1024.png"
icon_dst="ios/Todo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
if [[ -f "$icon_src" && -f "$icon_dst" ]]; then
  cp "$icon_src" "$icon_dst"
fi

# Keep CFBundleDisplayName in sync with app.json "name".
# expo prebuild sets it once; subsequent runs don't update it.
app_name=$(node -e "console.log(require('./app.json').expo.name)")
info_plist="ios/Todo/Info.plist"
if [[ -f "$info_plist" && -n "$app_name" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $app_name" "$info_plist" 2>/dev/null || true
fi

xcrun simctl uninstall "$udid" "$bundle_id" 2>/dev/null || true

# Clean build if no existing build or Podfile.lock changed.
# Release is ALWAYS a full clean build, never incrementally reused: expo-dev-client's
# podspec links expo-dev-launcher only for the Debug pod configuration
# (`:configurations => :debug`), so a truly fresh Release build never includes the
# dev-client launcher and boots straight into the app — no "Development servers /
# npx expo start" screen, no Metro dependency at all. An incrementally-reused Release
# build in DerivedData can be a stale artifact from before some pod/config change and
# silently still carry the old (possibly dev-launcher-linked) binary; Podfile.lock's
# mtime alone isn't a reliable signal that the cached build still reflects the
# current pod graph. Release builds are infrequent (screenshots only), so the extra
# build time is a worthwhile trade for guaranteeing this can't happen.
derived_app=""
[[ -d ~/Library/Developer/Xcode/DerivedData ]] && \
  derived_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/${config}-iphonesimulator/*" 2>/dev/null | head -1) || true
build_args=(-workspace "$workspace" -scheme "$scheme" -configuration "$config" -destination "id=$udid")
if [[ "$config" == "Release" || -z "$derived_app" || ios/Podfile.lock -nt "$derived_app" ]]; then
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

if [[ "$config" == "Release" ]]; then
  xcrun simctl launch "$udid" "$bundle_id"
  echo "Launched in Release mode — ready for screenshots."
else
  # Start Metro, then open the app once it's ready
  lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true
  (
    until curl -sf http://localhost:8081/status > /dev/null 2>&1; do sleep 1; done
    xcrun simctl openurl "$udid" "${bundle_id}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
  ) &
  npx expo start --dev-client
fi
