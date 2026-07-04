# Add Button as "+" Icon Design

**Date:** 2026-07-04
**Status:** Approved

## Goal

Replace the "Add" text button in the top-right of the Add Task/Event modal's header with a "+" icon, matching the visual style already used by `BottomActionBar`'s `+` icon (which opens this same modal). GitHub issue #69.

## Decision

Confirmed with the user: use "+" (not a ✓ checkmark) to match the bottom bar exactly, even though this button's actual job (submit/confirm the form) differs semantically from the bottom bar's `+` (open the modal). Visual consistency was the explicit ask.

## Change

`mobile/src/components/AddTaskModal.tsx`:

- Line 201: `<Text style={[styles.addBtn, !title.trim() && styles.addBtnDim]}>Add</Text>` → glyph changes from `Add` to `+`.
- `styles.addBtn` (line 437, currently `{ fontSize: 15, fontWeight: '600', color: Colors.accent }`) → matches `BottomActionBar`'s existing `addIcon` style exactly: `{ fontSize: 28, fontWeight: '300', color: Colors.accent }`.
- `styles.addBtnDim` (line 438) is unchanged — still just overrides `color: Colors.textDim`, applied to the new glyph the same way it was applied to the text.
- No layout changes: the header row already uses `justifyContent: 'space-between'`, so a differently-sized glyph in the same slot needs no repositioning.
- No functional change: `onPress={handleAdd}` and `disabled={!title.trim()}` are untouched.

## Testing

No new automated tests — this is a pure visual/style change to a screen this codebase doesn't unit-test (no existing test file for `AddTaskModal.tsx`). Verification is `tsc --noEmit` clean and a manual simulator check (open the Add modal, confirm the `+` renders at the same size/weight as the bottom bar's `+`, confirm it dims when the title is empty and is tappable/submits once text is entered).

## Files Changed

| Action | File |
|---|---|
| Modify | `mobile/src/components/AddTaskModal.tsx` |
