import { useState, useRef, useEffect, useCallback } from 'react';
import type { Task } from '@shared/parser';
import { applyDone } from '@shared/commands/done';

export function usePendingDone(
  tasks: Task[],
  todayStr: string,
  save: (updated: Task[]) => Promise<void>,
  delayMs = 2500,
): {
  isPending: (line: number) => boolean;
  tapCheckbox: (task: Task) => void;
} {
  const [pendingLines, setPendingLines] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Keep a ref so the timer callback always reads the latest tasks list,
  // avoiding stale-closure bugs when tasks change before the timer fires.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, []);

  const isPending = useCallback(
    (line: number) => pendingLines.has(line),
    [pendingLines],
  );

  const tapCheckbox = useCallback(
    (task: Task) => {
      const line = task.line;
      if (timers.current.has(line)) {
        // Undo: cancel the pending completion
        clearTimeout(timers.current.get(line));
        timers.current.delete(line);
        setPendingLines(prev => {
          const next = new Set(prev);
          next.delete(line);
          return next;
        });
      } else {
        // Start pending
        setPendingLines(prev => new Set([...prev, line]));
        const timer = setTimeout(async () => {
          timers.current.delete(line);
          try {
            const { tasks: updated } = applyDone([...tasksRef.current], [line], todayStr);
            await save(updated);
          } catch {}
          setPendingLines(prev => {
            const next = new Set(prev);
            next.delete(line);
            return next;
          });
        }, delayMs);
        timers.current.set(line, timer);
      }
    },
    [todayStr, save, delayMs],
  );

  return { isPending, tapCheckbox };
}
