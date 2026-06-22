# Remove iCloud Sync Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant "iCloud Sync" section from the Settings screen since the app already defaults to iCloud on first launch.

**Architecture:** Pure UI deletion in a single file — remove the `handleUseICloud` function, the "iCloud Sync" section title, its card block, and the `ICLOUD_PATH` import. `ICLOUD_PATH` stays in `store.ts` (still used as the first-launch default fallback).

**Tech Stack:** React Native, Expo Router, TypeScript

---

### Task 1: Remove iCloud Sync section from Settings screen

**Files:**
- Modify: `mobile/app/settings.tsx`

- [ ] **Step 1: Remove `ICLOUD_PATH` from the import**

In `mobile/app/settings.tsx`, change line 5 from:

```ts
import { setFilePath, ICLOUD_PATH } from '../src/store';
```

to:

```ts
import { setFilePath } from '../src/store';
```

- [ ] **Step 2: Delete the `handleUseICloud` function**

Remove lines 25–35 (the entire `handleUseICloud` async function):

```ts
// DELETE this entire block:
async function handleUseICloud() {
  if (!ICLOUD_PATH) {
    Alert.alert('Error', 'iCloud path is not available on this device.');
    return;
  }
  setPathInput(ICLOUD_PATH);
  await setFilePath(ICLOUD_PATH);
  await reload();
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
}
```

- [ ] **Step 3: Delete the "iCloud Sync" section title and card**

Remove lines 56–70 from the JSX return:

```tsx
// DELETE this entire block:
<Text style={styles.sectionTitle}>iCloud Sync</Text>
<View style={styles.card}>
  <Text style={styles.description}>
    Point the file path to your iCloud Drive to sync todo.txt across devices and with the Mac CLI.
  </Text>
  <TouchableOpacity
    style={[styles.iCloudBtn, !ICLOUD_PATH && styles.iCloudBtnDisabled]}
    onPress={handleUseICloud}
    disabled={!ICLOUD_PATH}
  >
    <Text style={[styles.iCloudBtnText, !ICLOUD_PATH && styles.iCloudBtnTextDisabled]}>
      Use iCloud Drive path
    </Text>
  </TouchableOpacity>
</View>
```

- [ ] **Step 4: Delete the now-unused styles**

Remove these four entries from the `StyleSheet.create({...})` block at the bottom of the file:

```ts
// DELETE these style entries:
description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
iCloudBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.textSecondary, alignSelf: 'flex-start' },
iCloudBtnDisabled: { opacity: 0.5 },
iCloudBtnText: { color: Colors.text, fontSize: 14 },
iCloudBtnTextDisabled: { color: Colors.textSecondary },
```

- [ ] **Step 5: Verify the file compiles**

Run the TypeScript check from the mobile directory:

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/settings.tsx
git commit -m "fix(settings): remove redundant iCloud Sync section (#40)

App defaults to iCloud on first launch; the reset button is no longer needed."
```
