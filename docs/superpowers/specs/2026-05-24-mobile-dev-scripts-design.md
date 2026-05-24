# Mobile Dev Scripts Design

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Add `mobile/scripts/sim.sh` and `mobile/scripts/ship.sh` to the todo-txt repo, mirroring the proven workflow from `~/src/fressh/mobile/scripts`. Also add `mobile/eas.json` and update `mobile/app.json` with the correct bundle identifier.

## Files

```
mobile/scripts/sim.sh     — dev launcher: simulator / USB device / TestFlight
mobile/scripts/ship.sh    — production EAS build + App Store submission
mobile/eas.json           — EAS build/submit profiles
```

`app.json` is also updated (bundle identifier only).

## sim.sh

Direct port of fressh's `sim.sh`. Changes from the original:

- Build log: `/tmp/fressh-build.log` → `/tmp/todo-build.log`
- Everything else unchanged — the scheme name, DerivedData path, and bundle ID are all read dynamically from the Xcode workspace and `app.json`

Behavior on first run (managed workflow → bare):
1. Installs `expo-dev-client` if missing from `package.json`
2. Runs `expo prebuild --platform ios` if no `ios/` directory exists
3. Runs `pod install` if CocoaPods aren't synced

Launcher menu (in order):
- USB-connected physical devices
- Available simulators (Booted first, marked with `*`)
- TestFlight via EAS cloud build (uses build credits — warned)

For simulators, a second prompt selects Debug (dev Metro) or Release (bundled JS, no overlay — for screenshots).

## ship.sh

Unchanged from fressh. Calls:
```
eas build --platform ios --profile production --non-interactive
eas submit --platform ios --profile production --latest --non-interactive
```

## eas.json

Mirrors fressh's `eas.json` with these adaptations:

| Field | Value |
|-------|-------|
| `appleId` | `eladio@caritos.com` |
| `appleTeamId` | `3U8L77G9QV` |
| `ascAppId` | `YOUR_ASC_APP_ID` — fill in when app is registered in App Store Connect |

Profiles:
- `development` — dev client, store distribution
- `preview` — internal distribution, device only (no simulator)
- `production` — auto-increment build number, `m-medium` resource class

## app.json change

```json
"bundleIdentifier": "com.caritos.todo-txt"
```

Note: hyphens are valid in iOS bundle identifiers per Apple's UTI spec.

## Out of Scope

- EAS project registration (`eas init`) — done separately
- Android configuration — app is iOS only
- CI/CD pipeline — separate concern
