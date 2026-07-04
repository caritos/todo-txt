# Add Button Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Add" text button in the Add Task/Event modal's header with a "+" icon matching `BottomActionBar`'s existing `+` (GitHub issue #69).

**Architecture:** Pure visual change to one file — swap the button's glyph and restyle it to match an existing icon style elsewhere in the codebase. No new state, no behavior change.

**Tech Stack:** TypeScript, React Native, Expo.

**Spec:** `docs/superpowers/specs/2026-07-04-add-button-icon-design.md`

## Global Constraints

- No functional change: `onPress={handleAdd}` and `disabled={!title.trim()}` on the button must be untouched.
- `styles.addBtnDim` (the disabled-state override) must be untouched — it already applies correctly to any glyph via `color: Colors.textDim`.
- No new automated tests — `AddTaskModal.tsx` has no existing test file, consistent with this codebase's precedent of not unit-testing screen-level UI.

---

### Task 1: Swap "Add" text for a "+" icon

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx:201` (glyph)
- Modify: `mobile/src/components/AddTaskModal.tsx:437` (style)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a leaf visual change with no other consumers.

- [ ] **Step 1: Change the glyph**

Change line 201 from:
```tsx
            <Text style={[styles.addBtn, !title.trim() && styles.addBtnDim]}>Add</Text>
```
to:
```tsx
            <Text style={[styles.addBtn, !title.trim() && styles.addBtnDim]}>+</Text>
```

- [ ] **Step 2: Restyle to match `BottomActionBar`'s existing `+` icon**

Change line 437 from:
```tsx
  addBtn: { fontSize: 15, fontWeight: '600', color: Colors.accent },
```
to:
```tsx
  addBtn: { fontSize: 28, fontWeight: '300', color: Colors.accent },
```
(Leave `addBtnDim: { color: Colors.textDim },` on line 438 exactly as-is — it already overrides just the color, which still applies correctly to the new glyph/size.)

- [ ] **Step 3: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 79 passed, 79 total` (unchanged — no test touches this file).

- [ ] **Step 5 (manual simulator verification) — SKIP if you have no simulator-driving tool.** If you do, run `mobile/scripts/sim.sh`, tap `+` in the bottom bar to open the Add modal, and confirm: the top-right button now shows a `+` the same size/weight as the bottom bar's own `+`; it's dimmed while the title field is empty; typing a title un-dims it; tapping it still adds the task/event and closes the modal. If you don't have simulator access, note in your report that this step was skipped and why (same accepted gap as prior plans in this repo).

- [ ] **Step 6: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/src/components/AddTaskModal.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): replace Add text button with + icon (closes #69)

Matches BottomActionBar's existing + icon exactly (28pt, weight 300),
which already opens this same modal. Purely visual — onPress/disabled
behavior is unchanged.
EOF
)"
```
