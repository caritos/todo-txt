# iCloud Drive Storage Location

**Date:** 2026-08-21

## Background

Mobile storage is currently local-only (`LOCAL_PATH`, the app's own sandboxed Documents directory) — see the "Storage: local-only" section of `mobile/CLAUDE.md`. That design followed an earlier attempt (2026-07) at automatic background sync via the app's *private* iCloud ubiquity container, which was built, debugged extensively, and removed after confirming that a Mac with no locally-installed counterpart app never actively syncs down content for a third-party app's private container — regardless of correct `NSUbiquitousContainers`/entitlement configuration. Since then, moving data between devices has been a manual Import/Export flow (`mobile/app/settings.tsx`): Export serializes tasks to a temp file and hands it to the OS share sheet; Import uses `expo-document-picker` to replace the local file wholesale.

The goal now: edit `todo.txt` directly from a Mac (in any text editor) with changes reflected in the app automatically, and vice versa — without the manual export/import dance every time.

## Why Not The Previous Approach

The private-ubiquity-container mechanism (`URLForUbiquityContainerIdentifier:`, `NSUbiquitousContainerIsDocumentScopePublic`) ties the container's visibility on a Mac to whether that Mac has an app matching the same bundle ID installed. Stark is iOS-only with no Mac/Catalyst build, so this path is a dead end for this app specifically (proven, not theoretical — see the control-testing notes in `mobile/CLAUDE.md`).

## Approach

Store `todo.txt` in a **plain folder inside the user's general iCloud Drive space** (e.g., a "Stark" folder under `Documents`), picked or created by the user via the system document picker — not an app-private container. A folder created this way is not tied to any app's identity; it syncs via the same mechanism as any user-created iCloud Drive folder, visible in Finder/Files on every device regardless of what apps are installed there. This is confirmed by the existing control-test data: `Documents`/`Desktop`-style plain iCloud Drive folders are unaffected by the "app not installed" sync deprioritization that broke the private-container approach.

Getting *persistent, writable* access to a user-picked location outside the app's sandbox requires an iOS security-scoped bookmark: the document picker grants file access only for the current picking operation, so the app must save a bookmark (opaque blob) and re-resolve it into a fresh, access-granted URL on every future launch. This is native-only API surface — a new native module is required, following the same `NSFileCoordinator` read/write/download-polling patterns already built (and proven) for the previous iCloud work, just aimed at a bookmark-resolved external folder instead of a ubiquity container.

## Native Module

New Swift native module (`RCT_EXPORT_MODULE()`, accessed via `NativeModules`, matching the existing project convention that `requireOptionalNativeModule` silently no-ops for local modules — see `mobile/CLAUDE.md`'s iCloud native-module notes):

- **`pickFolder() -> Promise<{ bookmark: string, name: string }>`**
  Presents `UIDocumentPickerViewController` in export mode: the JS side first writes current tasks to a temp local file (reusing the existing `handleExport` temp-file pattern in `settings.tsx`), the picker opens with `directoryURL` hinted at iCloud Drive's `Documents` folder (skipping the top-level "which provider" screen — this hint is honored by the system picker UI even though the app itself has no standing access to that location) so the user lands directly where they'd create a folder, chooses or creates a destination folder there, the temp file is copied in as `todo.txt`, and a security-scoped bookmark for the destination folder is created (`URL.bookmarkData(options: .minimalBookmark)`) and returned base64-encoded along with a display name.

  This one-time picker interaction is unavoidable — iOS requires explicit user consent (via the system picker) before an app can write outside its own sandbox; there's no API to silently create/access a folder in the user's general iCloud Drive space. Every subsequent read/write after setup uses the saved bookmark with no picker involved.

- **`readFile(bookmark: string) -> Promise<string>`**
  Resolves the bookmark (`URL(resolvingBookmarkData:)` with `.withSecurityScope`), wraps `startAccessingSecurityScopedResource`/`stopAccessingSecurityScopedResource` around an `NSFileCoordinator`-coordinated read of `todo.txt` inside that folder. Before reading, triggers `startDownloadingUbiquitousItemAtURL:` and polls the download status (same 0.5s-interval, 60-attempt pattern already documented in the global iCloud notes) in case the file was just edited on the Mac and is still a cloud-only stub on this device. Rejects with `BOOKMARK_STALE` if resolution fails (isStale) or `FILE_NOT_FOUND` if the folder/file no longer exists.

- **`writeFile(bookmark: string, content: string) -> Promise<void>`**
  Same resolve/access pattern, coordinated write with `atomically: NO` (required inside iCloud-synced locations — atomic writes create a forbidden `.tmp` file first).

## `mobile/src/store.ts` Changes

`Config` gains:
```typescript
type Config = {
  weekStart?: 0 | 1;
  icloudBookmark?: string;   // base64 security-scoped bookmark, present only in iCloud mode
  icloudFolderName?: string; // display name shown in Settings, e.g. "Stark"
};
```

`resolveFile()` changes from unconditionally returning `LOCAL_PATH` to:
```typescript
export async function resolveFile(): Promise<string> {
  const config = await readConfig();
  if (config.icloudBookmark) return `icloud:${config.icloudBookmark}`;
  return LOCAL_PATH!;
}
```

`readTasks(filePath)` / `writeTasks(filePath, tasks)` branch on an `icloud:` prefix and delegate to the native module's `readFile`/`writeFile` instead of `expo-file-system`, keeping the existing call sites in `TaskContext` (`resolveFile()` → `readTasks(path)` / `writeTasks(path, tasks)`) unchanged. Local-mode behavior (including all existing error messages) is untouched.

New exported functions for the Settings setup/teardown flow:
- `enableICloudStorage(tasks: Task[]): Promise<{ name: string }>` — calls native `pickFolder()`, persists `icloudBookmark`/`icloudFolderName` in config, returns the folder name for confirmation UI. Throws (and leaves config unchanged) if the user cancels the picker or the native call fails.
- `disableICloudStorage(tasks: Task[]): Promise<void>` — writes current tasks to `LOCAL_PATH` via the existing local write path, then clears `icloudBookmark`/`icloudFolderName` from config. This is the "Switch to Local" escape hatch.

## Settings UI (`mobile/app/settings.tsx`)

New "Storage Location" section, inserted between "Transfer" and "Week starts on":

- Shows current mode: `LOCAL (this device only)` or `ICLOUD DRIVE — <folderName>`.
- **Local mode:** a single `USE ICLOUD DRIVE` button with description text suggesting the folder name (e.g. "Choose or create a folder in iCloud Drive — we suggest naming it 'Stark'."). Tapping it calls `enableICloudStorage(tasks)`, which opens the picker pre-navigated to iCloud Drive's `Documents` folder, then `reload()`. On picker cancellation, no-op (no error alert — cancellation isn't a failure). On other failures, `Alert.alert('Could not enable iCloud Drive', message)`.
- **iCloud mode:** a `SWITCH TO LOCAL` button (destructive-styled, with an `Alert.alert` confirm — "This copies your current tasks to local storage on this device only. Continue?"), calling `disableICloudStorage(tasks)` then `reload()`.
- The existing "Current path" section's `filePath` display already reflects whichever mode is active (`resolveFile()`'s return value) — no change needed there beyond confirming the `icloud:<bookmark>` string isn't shown raw; render `config.icloudFolderName` there instead when in iCloud mode. (Small existing-code touch: `TaskContext`'s `filePath` state should expose the display name, not the raw bookmark string.)

The existing Transfer (Export/Import) section stays as-is — it remains useful for one-off transfers to a device or location outside iCloud Drive (e.g., sending a copy via AirDrop/Mail) regardless of storage mode.

## Error Handling

- `readFile`/`writeFile` bookmark failures propagate as `Error` (message-only, matching the existing shared-layer/error convention in `mobile/CLAUDE.md`) up through `readTasks`/`writeTasks` → `TaskContext.reload`/`save` → the existing `error: string | null` state → `ErrorBanner`. Message text points back to Settings (e.g., "Could not access iCloud Drive folder. Open Settings to reconnect or switch to local storage.").
- `readTasks` currently swallows read failures and returns `[]` for local mode (a missing file is expected/normal there). For iCloud mode, a bookmark/file failure is **not** a normal "missing file" case — it must NOT be swallowed, since silently returning `[]` would look like "all tasks gone" exactly like the stale-persisted-path bug already documented and fixed in `mobile/CLAUDE.md`. `readTasks` needs to distinguish "file genuinely doesn't exist yet" (fine, return `[]`) from "couldn't access the storage location at all" (throw) — the native module's `FILE_NOT_FOUND` vs `BOOKMARK_STALE`/other error codes give this distinction.

## Testing

- No shared/console layer changes.
- Native module logic (pick/resolve/read/write, download-stub polling) is only verifiable on-device or simulator, per this project's existing convention (`mobile/scripts/sim.sh`, Release build): pick a folder, edit `todo.txt` from a Mac text editor, relaunch the app, confirm the change is reflected; edit in the app, confirm the Mac sees it; and verify the "Switch to Local" fallback copies tasks correctly and clears the bookmark.
- `resolveFile()` / `readTasks` / `writeTasks`'s `icloud:` branching logic gets a Jest unit test in `mobile/tests` with the native module mocked (covering: local mode unaffected, iCloud read success, iCloud read `FILE_NOT_FOUND` → `[]`, iCloud read `BOOKMARK_STALE` → throws).

## Out of Scope

- Real-time/live sync while the app is foregrounded (no `NSMetadataQuery` live-update watching) — the app reads on open/reload and writes on save, same cadence as today. If the Mac and phone are edited within the same session without a reload, last-write-wins with no merge, same as any single-file sync tool.
- Conflict resolution UI for iCloud's own "conflicted copy" files (rare for single-writer-at-a-time usage, but iCloud can still generate them on true concurrent edits) — not handled specially; a conflicted copy would just not be read by the app (only the exact bookmarked file is).
- A Mac/Catalyst companion app — considered and explicitly rejected per the clarifying discussion; out of scope for this spec.
