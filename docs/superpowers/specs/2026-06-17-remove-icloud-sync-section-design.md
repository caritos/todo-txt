# Remove iCloud Sync Section from Settings

**Issue:** #40  
**Date:** 2026-06-17

## Background

The app defaults to `ICLOUD_PATH` on first launch (via `readConfig()` fallback in `store.ts`). The Settings screen previously had three sections: "Todo File", "iCloud Sync", and "Current". The "iCloud Sync" section contained a "Use iCloud Drive path" button that set the file path to `ICLOUD_PATH` — useful only as a reset escape hatch if the user had manually changed the path. Since new users are already on iCloud by default, this section is redundant and its label ("iCloud Sync") misleadingly implies a toggle.

## Change

Remove the "iCloud Sync" section from `mobile/app/settings.tsx`:

- Delete the `handleUseICloud` function
- Delete the `"iCloud Sync"` section title and its card (the button + description)
- Remove `ICLOUD_PATH` from the import (no longer used in this file)

## What Stays

- `ICLOUD_PATH` export in `store.ts` — still required as the first-launch default in `readConfig()`
- "Todo File" section — path input + Save button remains the manual override
- "Current" section — shows the active file path

## Result

Settings has two sections instead of three. Users who need to switch back to iCloud can type the path manually; the default already puts new users there.
