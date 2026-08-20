import type { Task } from '@shared/parser';
import { applyRm } from '@shared/commands/rm';
import { transcriptToTask } from '../voiceAdd';

// No react-native import here (mirrors pendingDoneCommit.ts) — stays
// plain-Node-testable since this project has no RN component-render setup.
export async function commitVoiceTranscript(
  tasks: Task[],
  transcript: string,
  todayStr: string,
  save: (updated: Task[]) => Promise<void>,
): Promise<Task | null> {
  const task = transcriptToTask(transcript, tasks, todayStr);
  if (!task) return null;
  await save([...tasks, task]);
  return task;
}

export async function undoVoiceTask(
  tasks: Task[],
  raw: string,
  save: (updated: Task[]) => Promise<void>,
): Promise<void> {
  const current = tasks.find(t => t.raw === raw);
  if (!current) return;
  const { tasks: updated } = applyRm([...tasks], [current.line]);
  await save(updated);
}
