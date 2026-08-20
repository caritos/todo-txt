import type { Task } from '@shared/parser';
import { parseLine } from '@shared/parser';
import { parseNaturalLanguage } from './nlParser';

// nlParser's `raw` already prepends todayStr and appends `start:` itself, so
// it's fed straight to parseLine — routing it through applyAdd/buildAddRaw
// again would double-prefix the creation date.
export function transcriptToTask(transcript: string, tasks: Task[], todayStr: string): Task | null {
  if (!transcript.trim()) return null;
  const parsed = parseNaturalLanguage(transcript, todayStr);
  if (!parsed.text.trim()) return null;
  return parseLine(parsed.raw, tasks.length + 1);
}
