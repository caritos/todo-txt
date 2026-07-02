# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Shared layer tests
bun test

# Run a single test file
bun test shared/tests/parser.test.ts

# Run the CLI directly
bun run ./console/index.ts help

# Mobile unit tests (Jest)
cd mobile && npm test

# Mobile: build and run on simulator / USB device (dev-client, Debug config)
mobile/scripts/sim.sh

# Mobile: build and submit to App Store / TestFlight
mobile/scripts/ship.sh
```

### sim.sh build behavior

`sim.sh` automatically detects stale or missing build artifacts and does the right thing:
- **Incremental build** — uses the existing DerivedData build if `Podfile.lock` hasn't changed
- **Clean build** — if DerivedData is missing (e.g. after running `cleanup-disk-space.sh`) or `Podfile.lock` is newer than the last build, it runs `xcodebuild clean build` automatically; no manual intervention needed

`sim.sh` only targets simulators and USB-connected physical devices — it does **not** offer a TestFlight/EAS-cloud-build option. A dev-client build (`developmentClient: true` in `eas.json`) requires the Xcode Debug configuration, which compiles React Native's `RCTKeyCommands.m` (`#if RCT_DEV`) into the binary. That file calls the private `UIEvent` selectors `_isKeyDown`, `_modifierFlags`, `_modifiedInput` to support hardware-keyboard dev-menu shortcuts — Apple's App Store Connect binary validator rejects any upload referencing them, so dev-client builds can never pass TestFlight/App Store submission, independent of SDK image version. Use `ship.sh` (the `production` profile — Release config, no dev client) for anything that needs to reach App Store Connect or TestFlight.

## App Store Submission Prerequisites

Run these once before the first `ship.sh` invocation (or after credentials expire):

```bash
# 1. Log in to EAS
eas login

# 2. Set up iOS distribution certificate + provisioning profile (interactive)
cd mobile && eas credentials
# → Choose: Build Credentials → iOS → production → follow prompts

# 3. Set up App Store Connect API key (interactive, first submit only)
cd mobile && eas submit --platform ios --profile production --latest
# → Choose an existing ASC API key or add a new one
# Key is cached on EAS servers after first setup — subsequent ship.sh runs are non-interactive
```

**iCloud provisioning profile — must be created manually:**

EAS auto-generated provisioning profiles do not include iCloud entitlements. The provisioning profile must be created manually in the Apple Developer Portal and uploaded to EAS via `credentials.json`.

Steps (one-time, or when the profile expires):
1. In the [Apple Developer Portal](https://developer.apple.com) → Identifiers → `com.caritos.todo-txt` → edit iCloud capability → select **Include CloudKit support (requires Xcode 6)** (not "Compatible with Xcode 5") → confirm `iCloud.com.caritos.todo-txt` container is checked → Save
2. Profiles → + → **App Store Connect** → select `com.caritos.todo-txt` App ID → select the Sep 2026 distribution cert → Generate → Download
3. Verify the profile has the right entitlements: `security cms -D -i <profile.mobileprovision> | plutil -extract Entitlements xml1 - -o -` — you should see both `ubiquity-container-identifiers` (required for `URLForUbiquityContainerIdentifier:`) and `icloud-container-identifiers`
4. Download credentials from EAS: `cd mobile && eas credentials --platform ios` → credentials.json → Download
5. Replace `mobile/credentials/ios/profile.mobileprovision` with the downloaded profile
6. Upload back: same menu → Upload credentials from credentials.json to EAS

`mobile/credentials.json` and `mobile/credentials/` are gitignored (contain the private key).

**Required fields in `mobile/app.json`:**
- `expo.ios.infoPlist.ITSAppUsesNonExemptEncryption: false` — required for all App Store uploads (this app uses no encryption)
- `expo.icon` — points to `./assets/icon/icon-1024.png` (1024×1024 PNG, the Braun Terminal photo cropped to square)

**Required fields in `mobile/eas.json`:**
- `build.production.ios.image: "latest"` — ensures Xcode 26+ is used; Apple requires the iOS 26 SDK for all new submissions as of 2026

## Repo Structure

Three strictly decoupled layers — each layer only imports from layers below it:

```
shared/                       ← platform-agnostic business logic
├── parser.ts                 ← Task type, parseLine(), serializeTask()
├── recurrence.ts             ← recurrence helpers
├── utils.ts                  ← shared date utilities
├── commands/                 ← pure transforms: Task[] in, result out, no I/O
│   ├── list.ts               ← matchesFilters(), sortByPriority()
│   ├── focus.ts              ← applyFocus(), isInFocusWindow(), overdueOccurrenceDate()
│   ├── done.ts               ← applyDone()
│   ├── add.ts                ← applyAdd(), buildAddRaw()
│   ├── edit.ts               ← applyEdit()
│   ├── rm.ts                 ← applyRm()
│   ├── pri.ts                ← applyPri(), applyDepri()
│   ├── skip.ts               ← applySkip()
│   ├── search.ts             ← applySearch()
│   └── report.ts             ← applyReport()
└── tests/

web/                          ← stark.caritos.com marketing site (Bun + Hono + TypeScript)
├── src/index.ts              ← routes: /, /privacy, /support; serves screenshot strip
├── scripts/deploy.sh         ← one-command SSH deploy to DreamHost VPS (port 8030)
└── scripts/stark-web.service ← systemd user service

console/                      ← CLI (Node.js / Bun)
├── index.ts                  ← CLI entry point: arg parsing, --file flag, command routing
├── store.ts                  ← Node.js fs I/O: readTasks(), writeTasks(), resolveFile()
├── output.ts                 ← ANSI colors, formatTask(), formatSummary()
├── commands/                 ← thin wrappers: read → shared transform → write → print
└── tests/

mobile/                       ← Expo Router iOS app
├── app/                      ← file-based screens (Expo Router)
│   ├── _layout.tsx           ← root Stack layout, fonts, TaskProvider, BottomActionBar
│   ├── focus.tsx             ← Focus screen (default — next 14 days, day-grouped)
│   ├── list.tsx              ← List screen (stats cards + flat task list)
│   ├── search.tsx            ← Search screen
│   ├── report.tsx            ← Report screen (summary stats)
│   ├── settings.tsx          ← File path settings
│   ├── timeline.tsx          ← Week view (7-column timed grid); tap date → Day view
│   ├── month.tsx             ← Month view (full-screen flex grid); tap cell → Day view
│   ├── year.tsx              ← Year view (dot-density heatmap by month)
│   ├── day/[date].tsx        ← Day view (timed + all-day lanes for a single date)
│   ├── done.tsx              ← Tasks view: completed (above) + add-task anchor + incomplete (below)
│   └── task/[line].tsx       ← Task detail formSheet: Done, Edit, Priority, Skip, Delete; shows DUE date
├── src/
│   ├── store.ts              ← Expo FileSystem I/O (mirrors console/store.ts interface)
│   ├── theme.ts              ← Colors, Fonts, Spacing design tokens
│   ├── utils.ts              ← today(), formatDateLabel()
│   ├── nlParser.ts           ← natural language → todo.txt raw string (chrono-node)
│   ├── context/TaskContext.tsx  ← global task state (tasks, filePath, reload, save)
│   └── components/           ← TaskRow, EventPill, CalendarHeader, WeekStrip, MonthGrid,
│                               StatsCard, PriorityPicker, RecurrencePicker,
│                               AddTaskModal, BottomActionBar, ViewSwitcher
└── tests/
```

## Shared Layer

**Pure transform pattern** — every command is a pure function: `Task[]` in, result out. No I/O, no console output, no `process.exit`.

**Error handling** — transforms throw `Error` with a plain message. The CLI catches and calls `process.exit(1)`. Mobile catches and shows an inline error or alert. `process.exit` never appears in shared code.

**`@shared/*` alias** — mobile imports shared code via `@shared/parser`, `@shared/commands/focus`, etc., resolved by Metro (watchFolders) and babel-plugin-module-resolver.

## Console Layer

**File resolution order** (in `resolveFile`): `--file` flag → `TODO_FILE` env → `./todo.txt` in cwd.

**Mutation pattern**: shared transforms return `{ tasks: Task[] }`. Console commands write `tasks` back via `writeTasks`, which writes each `task.raw` verbatim. `serializeTask` is called inside shared transforms before returning.

**Focus clears the terminal**: `t` (no args) and `t focus` both write `\x1Bc` to stdout before rendering, giving a clean screen on every invocation.

## Mobile Layer

**Tech stack**: Expo SDK 52, Expo Router v3, React Native (iOS only), expo-file-system, react-native-reanimated, react-native-gesture-handler, @expo-google-fonts/jetbrains-mono, chrono-node.

**Design tokens**: background `#1A1A1A`, accent `#E8461A`, text `#F0F0F0`, secondary `#888888`, separator `#333333`, checkboxBorder `#555555`. Task text in JetBrains Mono. One accent color only — Braun/Bauhaus. Never use hardcoded hex colors — always reference `Colors.*` from `mobile/src/theme.ts`. Never use hardcoded font families — always use `Fonts.mono`.

**iCloud sync**: user points Settings file path to iCloud Drive container; iOS syncs automatically with other devices and with the CLI on Mac. On first launch (no saved config), the app defaults to `LOCAL_PATH` (the app's own Documents directory — always writable, no entitlement required). The Settings screen exposes LOCAL / iCLOUD preset buttons; the iCLOUD preset uses `ICLOUD_PATH` (`file:///private/var/mobile/Library/Mobile%20Documents/iCloud~com~caritos~todo-txt/Documents/todo.txt`) which requires the iCloud container `iCloud.com.caritos.todo-txt` to be created in the Apple Developer Portal and both `com.apple.developer.ubiquity-container-identifiers` (required for `URLForUbiquityContainerIdentifier:`) and `com.apple.developer.icloud-container-identifiers` entitlements in `app.json`. `readConfig()` includes a migration that detects the old broken `Documents/../Library/Mobile Documents/` path pattern (which iOS rejects as non-writable) and resets it to `LOCAL_PATH`.

**iCloud native module** (`mobile/modules/expo-icloud/`): all iCloud reads and writes go through the native ObjC module (`ExpoIcloud.m`), accessed via `NativeModules.ExpoIcloud` from React Native. Do NOT use Expo FileSystem (`writeAsStringAsync` / `readAsStringAsync`) for iCloud paths — it does not use `NSFileCoordinator`, causing "not writable" errors on writes and silent empty reads. Key behaviors:
- **Writes** (`writeFile`): calls `URLForUbiquityContainerIdentifier:` (initializes container + creates directory), then `NSFileCoordinator coordinateWritingItemAtURL:` with `atomically:NO`. Atomic writes are forbidden in iCloud containers (no `.tmp` files allowed).
- **Reads** (`readFile`): calls `startDownloadingUbiquitousItemAtURL:` (triggers download of cloud-only stub files), polls `NSURLUbiquitousItemDownloadingStatusKey` every 500ms (up to 30s) until the file is on-device, then reads with `NSFileCoordinator coordinateReadingItemAtURL:`. Without the polling, stub files return empty content immediately.
- **Native module pattern**: uses ObjC `RCT_EXPORT_MODULE()` (not Expo module system). `requireOptionalNativeModule` from `expo-modules-core` silently returns null for local modules even when compiled — use `NativeModules.ExpoIcloud` instead.
- **Local dev builds**: `expo run:ios` requires the entitlements to be present in `app.json` before `ios/` is first generated. If `ios/` was generated before iCloud entitlements were added, `sim.sh` will detect the mismatch and offer to regenerate. When `app.json` entitlements change, manually mirror the change to `ios/Stark/Stark.entitlements` to keep the dev build in sync.

**Surfacing iCloud errors**: `readFile` in `ExpoIcloud.m` checks the `URLForUbiquityContainerIdentifier:` return value — if nil, it rejects with `NOT_SIGNED_IN` (when `fm.ubiquityIdentityToken` is also nil) or `CONTAINER_UNAVAILABLE` (container exists but entitlement/config mismatch), instead of silently falling through to an empty read. `readICloudFile` (`mobile/modules/expo-icloud/index.ts`) rethrows those codes as user-readable `Error` messages. `readTasks` (`mobile/src/store.ts`) lets iCloud errors propagate — it only wraps the local-file path in its own try/catch. `TaskContext.reload` catches the error into `error: string | null` state; `RootLayout` renders an `ErrorBanner` (`mobile/app/_layout.tsx`) above the `BottomActionBar` whenever `error` is non-null.

**`save()` and filePath stale-closure**: `TaskContext` exposes `save(updated)` which writes via `writeTasks`. To avoid a stale-closure race (where `save` captured `filePath = ''` before `reload()` completed), `TaskProvider` maintains a `filePathRef` that is updated synchronously alongside `setFilePath`. `save` reads `filePathRef.current` as its primary path source and falls back to the `filePath` closure value. Never rely on the `filePath` state variable alone inside `save`.

**AddTaskModal empty-title guard**: `handleAdd` silently returns when `title.trim()` is empty — it does NOT show an error. This is intentional: on iPad with a hardware keyboard, `onSubmitEditing` fires on Return, and showing "Enter a title." for a keyboard no-op would be confusing. The Add button's `disabled={!title.trim()}` already prevents touch-driven submission on an empty title.

**Custom recurrence drum pickers — 216pt height** (`mobile/src/components/CustomRecurrencePicker.tsx`, `drumRow`/`pickerWrap` styles): every `@react-native-picker/picker` wheel in this file (the `every [N] [unit]` row, and month's positional "On Week" ordinal/weekday row) is boxed at `height: 216`, not a smaller value. iOS's native `UIPickerView`, which backs the wheel-style picker, ignores whatever frame it's given and pins itself to a 216pt minimum height — a shorter box doesn't shrink the wheel, it just lets the wheel's rendered content overflow past the box and bleed into whatever renders next in the tree, since neither the box nor its siblings clip overflow. This was invisible for years because the only content ever placed directly below a drum row was the month unit's collapsed-by-default "On Days"/"On Week" sub-rows; it became visible (issue #62) once the weekly "Repeat On" chip grid started rendering unconditionally right below the drum row.

**Custom weekly recurrence — weekday multi-select** (`mobile/src/components/CustomRecurrencePicker.tsx`): when `config.unit === 'week'`, a "Repeat On" chip grid (Sun–Sat) lets the user multi-select which weekdays a task recurs on, reusing the same `dayGrid`/`dayChip` styles as the month view's "On Days" grid — but unlike that single-select grid, it's a plain multi-select toggle with no collapse/chevron (auto-collapsing on each tap would be hostile to picking several days) and no `subValue`/active-state summary of its own; the current selection is only reflected in the "Repeat" row's `recurrenceLabel()` summary one level up. `toggleWeekDay` never appends the clicked day to the end of `config.weekDays` — it always rebuilds the array by filtering the canonical `Sun,M,T,W,Th,F,Sat`-ordered `WEEKDAYS` constant, so `weekDays` stays pre-sorted regardless of click order. Both `recurrenceLabel()` (`RecurrencePicker.tsx`) and `customRecurrenceExtensions()` (`CustomRecurrencePicker.tsx`) rely on that invariant and `.join(',')` the array directly without re-sorting — neither is responsible for ordering. The day codes (`Sun`, `M`, `T`, `W`, `Th`, `F`, `Sat`) match `FREQ_DAY_DOW` in `shared/commands/focus.ts` exactly, since `customRecurrenceExtensions` writes them straight into the `frequency-day:` extension that `nextWeeklyDate` already consumes. Selecting "week" with zero chips picked is a valid, non-erroring state — `frequency-day` is simply omitted and the task recurs on the same weekday as `start:`, matching the plain "Every Week" preset.

**Day/week view filtering**: Mobile day (`app/day/[date].tsx`) and week (`app/timeline.tsx`) views use `applyFocusForWindow(tasks, todayStr, windowEnd)` + `focusItemOccurrence(item)` from `@shared/commands/focus` — the same logic as the console's `focus` command. Never duplicate this filtering in the mobile layer. The window must be at least `addDays(todayStr, 14)` so overdue recurring tasks (whose `nextWeeklyDate` lands beyond today but whose `focusSortKey` resolves to today via `overdueOccurrenceDate`) pass `isInFocusWindow`.

**Month view** (`app/month.tsx`): full-screen flex grid — no ScrollView. Cells are grouped into rows of 7, each row has `flex: 1` so all rows distribute vertical space equally. Uses `useSafeAreaInsets` to push the `‹ MONTH YEAR ›` header below the Dynamic Island. Tasks mapped by `start:` date (not next occurrence — recurring tasks show on their `start:` date, not the next scheduled occurrence).

**Calendar navigation pattern**: tapping a day cell in Month view or a date in the Week strip navigates to `/day/[date]` via `router.push`. The ViewSwitcher (bottom-left ≡) and BottomActionBar label together support: Day, Week, Month, Year, Tasks, Search, Settings.

**Temporal navigation consistency**: all calendar views (Day, Week, Month, Year, Calendar) have both `‹`/`›` arrow buttons in the header and horizontal swipe gestures. Swipe uses `activeOffsetX([-20, 20]).failOffsetY([-10, 10])` so vertical scrolling still works in views that scroll (Week timeline, Year month list). Year view scopes the swipe gesture to the header bar only to avoid conflicting with the month-list ScrollView body.

**Week view pill layout** (`app/timeline.tsx`): timed pills and all-day chips have no `numberOfLines` cap — text wraps within the column width. Concurrent items at the same time slot are laid out side by side using the same slot-counting algorithm as the day view: `slotCount` maps each `time` string to a total count; `slotCursor` assigns each item a `col` index; pill `left` and `width` are computed as `2 + col * (pillWidth + 1)` and `Math.floor((innerWidth - (total-1)) / total)` respectively.

**Month view today cell** (`app/month.tsx`): the accent-color border (`cellToday`) uses `zIndex: 1` on both the cell and the row containing today so all four border sides render on top of neighbouring cells' backgrounds and borders.

**Safe area handling**: `_layout.tsx` sets `headerShown: false` globally, so every screen is responsible for its own safe-area padding. Use `useSafeAreaInsets()` from `react-native-safe-area-context` and apply `paddingTop: insets.top` to the top-most View or ScrollView in every screen. Screens that already do this: `done.tsx`, `search.tsx`, `settings.tsx`, `day/[date].tsx` (on the header), `month.tsx`, `events.tsx`.

**Search screen** (`app/search.tsx`): uses `useSafeAreaInsets` with `paddingTop: insets.top` on the input row so the status bar / Dynamic Island does not overlap the text field.

**Section headers** across all screens use `fontSize: 11`, `letterSpacing: 2`, `fontFamily: Fonts.mono`. Color differs by context: `Colors.textSecondary` for date-grouped completed tasks (`done.tsx`), `Colors.accent` for event category headers (`events.tsx`).

**Tasks view** (`app/done.tsx`): single `ScrollView` with three zones — (1) completed tasks from the last 30 days grouped by completion date, **oldest-first** so the most-recent completions sit closest to the add-task anchor, with strikethrough styling; (2) an inline `+ add task…` `TextInput` anchor that the view scrolls to on mount via `onLayout` + `scrollTo`; (3) incomplete tasks sorted by `start:` date ascending, no `start:` sorts to bottom. Both zones exclude events (`task.extensions['type']` set). Incomplete task start-date labels show `today`/`yesterday` for those days, the actual date (`Jun 6`, with year when different) for overdue tasks, and weekday (`Mon`) for future tasks. Recurring tasks are hidden from the incomplete list when: `frequency:` + `last-done === todayStr` (completed today, waiting for next occurrence), `frequency:` + `start > todayStr` (next occurrence is in the future after being advanced by `applyDone`), or `frequency:` + `exdate:` + `taskOccurrence(task, todayStr).date > todayStr` while `start:` ≤ today (skipped). Add task uses `applyAdd` + `save`.

**Task detail** (`app/task/[line].tsx`): shows a **DUE** row when `task.extensions['start']` is set, using `taskOccurrence(task, todayStr)` (from `@shared/commands/focus`) to compute the displayed date — the same canonical occurrence logic used by Calendar/Focus/Day/Week views — rather than formatting the raw `start:` field directly. This keeps Task Detail's DUE date consistent with every other screen, including self-healing already-corrupted `start:` values (e.g. an invalid day-of-month) without a data migration. One side effect: for an ongoing multi-day `type:event` (`start:` in the past, `end:` in the future), DUE now shows "today" instead of the event's original start date, matching how Calendar/Focus already display such events. The date is tinted accent-red when overdue (computed due date `< todayStr` and task not done). Shows an **AGE** row (`N years`) via `computeYearCount` (from `@shared/commands/list`) for `type:birthday`/`type:anniversary` tasks. Delete alert message differs for recurring tasks: non-recurring says "This cannot be undone"; recurring says "This deletes all future occurrences. Use Skip to skip just this one." — because `applyRm` removes the single todo.txt line that defines all occurrences. Dismiss via the `✕` in `closeBtn`, positioned top-left (`left: Spacing.md`) — matching `AddTaskModal`'s dismiss convention — not a "Cancel" action button in the actions row; the actions row only ever holds destructive/committing actions (Done, Edit/Save Edit, Skip, Delete). `handleRow` (the container for the drag handle + `closeBtn`) is a fixed `height: 44`, not `paddingVertical` sized to the 4px drag-handle bar alone — `closeBtn` is absolutely positioned with `top: 0, bottom: 0`, which stretches its box to match the parent's height, so a row sized only for the handle bar leaves the `✕` (`lineHeight: 26`) nowhere to render without overflowing off-screen.

**Default view**: The app opens to Calendar (`app/index.tsx` redirects to `/calendar`). BottomActionBar defaults to the `'Calendar'` label for unknown routes.

**Calendar view** (`app/calendar.tsx`): scrollable agenda using `FlatList` (not `SectionList`) with two row-height constants `HEADER_H = 34` and `ROW_H = 44`. Offsets are pre-computed alongside `flatData` in a single O(n) useMemo pass and used by `getItemLayout` — this is required for `scrollToIndex` to work reliably when the target row is outside the initial render window. `initialScrollIndex` is set to today's index so the list opens at today without a `useEffect` delay. Sections sort items `incomplete → event → completed` using `KIND_ORDER = { incomplete: 0, event: 1, completed: 2 }`.

**Overdue tasks in calendar**: any occurrence whose date is before today is pinned to today's section (`date = todayStr`) so it appears in today's agenda rather than a past date. The original past date is stored as `overdueDate` on the `AgendaItem` and shown as a label like `"due Apr 18"` in accent color beneath the task title.

**Event occurrence generation** — `generateTaskOccurrences(task, fromStr, cutoffStr)` in `shared/commands/focus.ts` is the single source of truth for expanding recurring tasks/events into individual dated occurrences. It respects `recur-until`, `exdate`, `frequency`, `every`, `frequency-day`, and `frequency-month-day`. **Never duplicate this logic in mobile screens** — import it from `@shared/commands/focus`. Recurring tasks/events without a `recur-until` and with a `start:` date in the past will recur indefinitely; the data fix is to add `recur-until` to the task line.

**Birthday badge & age display**: `%birthday` (`shared/parser.ts`) is a standalone tag that aliases to `type:birthday` only when a task has no other `type:` extension — an explicit `type:` (e.g. `type:event`, so the task still displays as an ordinary event everywhere `!!task.extensions['type']` is checked) always wins and is left untouched. Because of that, `isBirthday()` and `computeYearCount()` (`shared/commands/list.ts`) don't rely solely on `extensions['type'] === 'birthday'` — they also independently test the raw `%birthday` tag against `task.text`, so a `%birthday`-tagged task keeps the cake icon and age even when `type:` resolved to something else. `birthdayLabel(task, todayStr)` builds the combined badge (`"🎂 51 "`, or just `"🎂 "` when the age can't be computed) and every call site **prefixes** it to the title (`birthdayLabel(...) + cleanTitle(...)`) rather than appending — narrow single-line rows (Month grid cells, timed event pills in Day/Week views) truncate with `numberOfLines={1}`, and a prefix survives truncation while a trailing badge would get clipped by the ellipsis. `TaskRow` and `EventPill` take `todayStr` as an explicit prop since, unlike the screen files, they have no local `today()` call of their own.

## Key Invariants

- `verbatimModuleSyntax: true` — use `import type` for all type-only imports (all layers).
- Completed tasks have no priority (stripped by `serializeTask` when `task.done = true`).
- Typed tasks (`type:event`/`birthday`/`anniversary` — anything with `task.extensions['type']` set) never carry a priority — this is a deliberate product decision (issue #66), not an oversight. `AddTaskModal`'s Priority group only renders when `addType === 'task'`, and `handleAdd` defensively re-checks `addType === 'task'` before applying the picked priority (state persists across the TASK/EVENT toggle even though the UI hides it). `task/[line].tsx`'s Priority section only renders when `!task.extensions['type']`. Don't re-add priority to either screen for events without confirming first — it was added once already and reverted for exactly this reason.
- Extension regex `([^/\s]\S*)` intentionally excludes URL schemes — values starting with `/` are not captured as extensions (prevents `http://` from matching as `http: //`).
- `matchesFilters()` in `shared/commands/list.ts` is exported and reused by console `listall`, `search`, and mobile.
- `today()` returns the **local** calendar date (not UTC) — both `console/output.ts` and `mobile/src/utils.ts`.
- `nextWeeklyDate` in `shared/commands/focus.ts` accepts an optional `frequencyDay` param (e.g. `"W,F"`). When present, it finds the next calendar date that falls on one of those weekdays rather than advancing by 7-day intervals.
- `focusSortKey` skips the `last-done` cycle check for `frequency-day` tasks. For those tasks `applyDone` already advances `start:` to the next valid weekday, so `last-done` will always precede `currentOcc` — applying the 7-day cycle window would incorrectly jump to the occurrence after next (e.g. showing Monday when Friday is correct).
- `rm` accepts multiple task numbers. Re-indexes remaining tasks after each removal so subsequent numbers in the same batch stay correct.
- `done` accepts either a task number or a text string. When passed a string (`t done "buy milk"`), it creates the task and immediately marks it complete, writing `x <today> <today> <text>` to the file.
- `applyDone`'s recurring-task branch appends a new completed "copy" `Task` (the `x <date> ...` line recording this occurrence) with `line: tasks.length + 1` — never a placeholder like `line: 0`, matching `applyAdd`'s convention for appended tasks. Mobile's `TaskContext.save()` sets React state directly from whatever a shared transform returns, with no re-read/renumber in between saves (unlike the CLI, which is stateless per invocation and always re-reads fresh). A placeholder line number here would let two completed recurring tasks collide on the same `line` value within one app session, which several mobile screens key list rows by (`key={task.line}`, `done-${t.line}-${date}` in `calendar.tsx`) — a duplicate-React-key crash (issue #61).
- `done` advances `start` to the next scheduled occurrence for `frequency:weekly`, `frequency:monthly`, and `frequency:daily` tasks. `frequency:yearly` tasks are the exception — `start:`'s year is never advanced (only `last-done` changes), since yearly occurrence math (`nextYearlyDate`) only needs `start:`'s month-day, not its year, and freezing the year preserves the original birth/anniversary year for age calculation (`computeYearCount`) and for `every:N>1` multi-year cycling (which needs a fixed anchor year).
- Recurring occurrence dates (`nextYearlyDate`, `nextMonthlyDate`, `overdueOccurrenceDate`, `resolvePositionalDay` in `shared/commands/focus.ts`) always clamp the day-of-month to the last valid day of the target month via `daysInMonth()` (`shared/utils.ts`) — e.g. a `start:` day of 31 in a 30-day month becomes day 30, Feb 29 becomes Feb 28 in non-leap years. This prevents a raw invalid date string (e.g. `2026-06-31`) from being interpreted differently by different screens (native `Date` parsing silently overflows it into July 1, while raw string comparisons don't).
- `skip` on a non-recurring task (no `frequency:` extension) removes it from the list instead of erroring. `applySkip` returns a `SkipResult` union: `{ removed: true }` or `{ removed: false; skippedDate; nextDate }`. For overdue weekly/monthly tasks, `applySkip` uses `overdueOccurrenceDate()` to add the actual missed occurrence date to `exdate` — NOT `focusSortKey` (which returns today for overdue tasks and would fail to advance past the missed occurrence).
- `add` and `event` inject `start:today` when no `start:` is provided. This makes new tasks appear in focus immediately.
- `focus` handles `frequency:yearly` via `nextYearlyDate` in `isInFocusWindow` and `focusSortKey` — without this, completed yearly tasks stayed visible in focus until the next occurrence's date passed.
- `focus` shows **overdue** tasks: regular tasks whose `start:` date is in the past, and recurring tasks whose most-recent scheduled occurrence hasn't been marked done. `overdueOccurrenceDate()` detects missed occurrences; their sort key is set to today so they sort to the top.
- **Task line numbers** are 1-based positions in the non-empty task list (blank lines stripped by `readTasks`). They renumber on every read — `task.line` is display position, not a stable ID.
- `WeekStrip` (mobile) starts from today and shows the next 7 days — not a fixed Sunday-to-Saturday week.
- `cleanTitle()` strips todo.txt extensions from task text for display. It is defined **inline** in each screen file — it is not exported from a shared module.
