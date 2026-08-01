import type { Task } from '@shared/parser';
import { applyDone } from '@shared/commands/done';

// No react-native import here (unlike usePendingDone.ts) — this stays
// plain-Node-testable so the actual commit logic has test coverage without
// requiring a full RN rendering/mocking setup this project doesn't have.
export async function commitPendingLines(
  tasks: Task[],
  lines: number[],
  todayStr: string,
  save: (updated: Task[]) => Promise<void>,
): Promise<void> {
  if (lines.length === 0) return;
  const { tasks: updated } = applyDone([...tasks], lines, todayStr);
  await save(updated);
}
