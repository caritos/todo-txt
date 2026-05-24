# Mobile Dev Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mobile/scripts/sim.sh` and `mobile/scripts/ship.sh` (ported from fressh), `mobile/eas.json`, and update `mobile/app.json` so the todo-txt iOS app has a full local-build + EAS shipping workflow.

**Architecture:** Direct port of fressh's proven scripts — `sim.sh` handles the full device/simulator picker and native build pipeline; `ship.sh` is a thin EAS wrapper. The only change from fressh is the build log filename. `app.json` gets the correct bundle identifier; `eas.json` mirrors fressh's profiles with an `ascAppId` placeholder.

**Tech Stack:** zsh (sim.sh), bash (ship.sh), EAS CLI, Xcode command-line tools, CocoaPods, expo-dev-client.

---

## File Map

| Action | Path |
|--------|------|
| Create | `mobile/scripts/sim.sh` |
| Create | `mobile/scripts/ship.sh` |
| Create | `mobile/eas.json` |
| Modify | `mobile/app.json` — `bundleIdentifier` only |

---

### Task 1: Create sim.sh

**Files:**
- Create: `mobile/scripts/sim.sh`

- [ ] **Step 1: Create the scripts directory and sim.sh**

```bash
mkdir -p mobile/scripts
```

Write `mobile/scripts/sim.sh` with this exact content:

```bash
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

# Ensure pods are installed/synced
if ! grep -q "EXDevLauncher" ios/Podfile.lock 2>/dev/null; then
  echo "Syncing CocoaPods..."
  (cd ios && pod install)
fi

# ---- Build target list ----
# Entry format: "type|udid|label"
#   type: Booted | Shutdown  → simulator
#         device             → physical device (USB, free)
#         testflight         → EAS cloud build → TestFlight (uses build credits)

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

# TestFlight via EAS (uses build credits)
entries+=("testflight||TestFlight via EAS cloud build  ⚠ uses build credits")

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

# ---- TestFlight path — EAS cloud build ----
if [[ "$type" == "testflight" ]]; then
  echo ""
  echo "Starting EAS cloud build and submitting to TestFlight..."
  echo "This uses your EAS build credits."
  echo ""
  eas build -p ios --profile development --submit
  echo ""
  echo "Done. You'll get an email when the build is available in TestFlight."
  echo "After installing, open the app and connect to Metro:"
  echo "  npx expo start --dev-client"
  exit 0
fi

# ---- Physical device path — local Xcode build over USB ----
if [[ "$type" == "device" ]]; then
  echo ""
  echo "Building and installing on: $label ($udid)"
  echo "No build credits used — builds locally with Xcode."
  echo ""
  npx expo run:ios --udid "$udid"
  exit 0
fi

# ---- Simulator path — local Xcode build ----
bundle_id=$(node -e "console.log(require('./app.json').expo.ios.bundleIdentifier)")

echo ""
echo "Build configuration:"
echo ""
echo "  1) Debug   — dev build with Metro (default)"
echo "  2) Release — production build for screenshots (no dev overlay)"
echo ""
read "config_choice?Choice [1-2, default 1]: "

if [[ "$config_choice" == "2" ]]; then
  config="Release"
else
  config="Debug"
fi

echo ""
echo "Deploying to: $label ($udid) [$config]"
echo ""

# Remove stale install
xcrun simctl uninstall "$udid" "$bundle_id" 2>/dev/null || true

# Workspace and scheme
workspace=$(find ios -name "*.xcworkspace" -maxdepth 1 | head -1)
scheme=$(basename "$workspace" .xcworkspace)

# Clean build if DerivedData is missing or Podfile.lock changed
derived_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/${config}-iphonesimulator/*" 2>/dev/null | head -1)
build_args=(-workspace "$workspace" -configuration "$config" -scheme "$scheme" -destination "id=$udid")
if [[ -z "$derived_app" || ios/Podfile.lock -nt "$derived_app" ]]; then
  echo "Native dependencies changed — clearing DerivedData..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/${scheme}-*(N)
  build_args+=(clean)
fi
build_args+=(build)

echo "Building..."
if command -v xcpretty > /dev/null 2>&1; then
  RCT_NO_LAUNCH_PACKAGER=true xcodebuild "${build_args[@]}" 2>&1 | xcpretty
else
  RCT_NO_LAUNCH_PACKAGER=true xcodebuild "${build_args[@]}" > /tmp/todo-build.log 2>&1 || {
    echo "Build failed. Log: /tmp/todo-build.log"
    exit 1
  }
  echo "Build succeeded"
fi

# Install built app onto the chosen simulator
built_app=$(find ~/Library/Developer/Xcode/DerivedData -name "${scheme}.app" -path "*/${config}-iphonesimulator/*" 2>/dev/null | head -1)
if [[ -z "$built_app" ]]; then
  echo "No .app found after build."
  exit 1
fi
echo "Installing on $label..."
xcrun simctl install "$udid" "$built_app"

if [[ "$config" == "Release" ]]; then
  xcrun simctl launch "$udid" "$bundle_id"
  echo ""
  echo "App launched in Release mode. No dev overlay — ready for screenshots."
else
  # Kill any stale Metro on port 8081
  lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true

  (
    until curl -sf http://localhost:8081/status > /dev/null 2>&1; do sleep 1; done
    echo "Opening on $label..."
    xcrun simctl openurl "$udid" "${bundle_id}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
  ) &

  # Start Metro in the foreground (Ctrl+C to stop)
  npx expo start --dev-client
fi
```

- [ ] **Step 2: Make sim.sh executable**

```bash
chmod +x mobile/scripts/sim.sh
```

- [ ] **Step 3: Verify shell syntax**

```bash
zsh -n mobile/scripts/sim.sh
```

Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add mobile/scripts/sim.sh
git commit -m "feat(mobile): add sim.sh dev launcher"
```

---

### Task 2: Create ship.sh

**Files:**
- Create: `mobile/scripts/ship.sh`

- [ ] **Step 1: Write mobile/scripts/ship.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building for App Store..."
eas build --platform ios --profile production --non-interactive

echo "Submitting to App Store Connect..."
eas submit --platform ios --profile production --latest --non-interactive

echo "Done."
```

- [ ] **Step 2: Make ship.sh executable**

```bash
chmod +x mobile/scripts/ship.sh
```

- [ ] **Step 3: Verify shell syntax**

```bash
bash -n mobile/scripts/ship.sh
```

Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add mobile/scripts/ship.sh
git commit -m "feat(mobile): add ship.sh App Store build + submit"
```

---

### Task 3: Create eas.json

**Files:**
- Create: `mobile/eas.json`

- [ ] **Step 1: Write mobile/eas.json**

```json
{
  "cli": {
    "version": ">= 18.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "store"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "eladio@caritos.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "3U8L77G9QV"
      }
    },
    "development": {
      "ios": {
        "appleId": "eladio@caritos.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "3U8L77G9QV"
      }
    }
  }
}
```

> **Note:** Replace `YOUR_ASC_APP_ID` with the numeric App Store Connect app ID when the app is registered (found in App Store Connect → App Information → Apple ID).

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -m json.tool mobile/eas.json > /dev/null && echo "JSON OK"
```

Expected: `JSON OK`

- [ ] **Step 3: Commit**

```bash
git add mobile/eas.json
git commit -m "feat(mobile): add eas.json build and submit profiles"
```

---

### Task 4: Update bundle identifier in app.json

**Files:**
- Modify: `mobile/app.json`

- [ ] **Step 1: Update bundleIdentifier**

In `mobile/app.json`, change:

```json
"bundleIdentifier": "com.caritos.todo"
```

to:

```json
"bundleIdentifier": "com.caritos.todo-txt"
```

The full file should look like:

```json
{
  "expo": {
    "name": "Todo",
    "slug": "todo-txt",
    "version": "0.1.0",
    "scheme": "todo",
    "platforms": ["ios"],
    "orientation": "portrait",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.caritos.todo-txt"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app.json
git commit -m "chore(mobile): update bundle identifier to com.caritos.todo-txt"
```
