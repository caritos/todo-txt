import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import type { Task } from '@shared/parser';
import { applyDone, applyUndone } from '@shared/commands/done';
import { commitPendingLines } from './pendingDoneCommit';

export function usePendingDone(
  tasks: Task[],
  todayStr: string,
  save: (updated: Task[]) => Promise<void>,
  delayMs = 2500,
): {
  isPending: (raw: string) => boolean;
  tapCheckbox: (task: Task) => void;
} {
  // Pending state is keyed by the task's raw todo.txt line (a stable identity
  // within a pending window) rather than task.line. applyRm renumbers every
  // task after the deleted index, so a line-keyed pending timer can fire
  // against a completely different task if a row above it is deleted while
  // the timer is still running.
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Keep a ref so the timer callback always reads the latest tasks list,
  // avoiding stale-closure bugs when tasks change before the timer fires.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const todayStrRef = useRef(todayStr);
  useEffect(() => { todayStrRef.current = todayStr; }, [todayStr]);

  // Flush (commit) any still-pending completions instead of silently
  // dropping them. Shared by the unmount cleanup (a pushed screen like
  // Search can unmount mid-window on back-navigation) and the AppState
  // listener below (the app backgrounding or being killed mid-window loses
  // the pending setTimeout forever, since JS timers don't survive that).
  const flushPending = useCallback(() => {
    const linesToCommit: number[] = [];
    for (const [key, timer] of timers.current) {
      clearTimeout(timer);
      const current = tasksRef.current.find(t => t.raw === key);
      if (current) linesToCommit.push(current.line);
    }
    timers.current.clear();
    if (linesToCommit.length > 0) {
      void commitPendingLines(tasksRef.current, linesToCommit, todayStrRef.current, save).catch(() => {});
      setPendingKeys(new Set());
    }
  }, [save]);

  useEffect(() => {
    // A pending completion is only safe from loss while the app stays in
    // the foreground — a JS setTimeout does not survive the app being
    // backgrounded and then killed (by the user or the OS). Commit
    // immediately on the way out instead of trusting the timer to fire.
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') flushPending();
    });
    return () => subscription.remove();
  }, [flushPending]);

  // Kept as a ref so this effect's deps stay `[]` — it must only run its
  // cleanup on a genuine unmount, not whenever `save`'s identity changes
  // (which would flush prematurely, not just when the screen actually goes
  // away).
  const flushPendingRef = useRef(flushPending);
  useEffect(() => { flushPendingRef.current = flushPending; }, [flushPending]);

  useEffect(() => {
    return () => flushPendingRef.current();
  }, []);

  const isPending = useCallback(
    (raw: string) => pendingKeys.has(raw),
    [pendingKeys],
  );

  const tapCheckbox = useCallback(
    (task: Task) => {
      const key = task.raw;

      if (task.done) {
        // Undo is immediate, with no pending-delay grace window. The delay on
        // the complete side exists so a batch of taps isn't over-committed
        // while scrolling; a correction tap on an already-completed row is a
        // single deliberate action.
        void (async () => {
          try {
            const current = tasksRef.current.find(t => t.raw === key);
            const line = current?.line ?? task.line;
            const { tasks: updated } = applyUndone([...tasksRef.current], [line]);
            await save(updated);
          } catch {}
        })();
        return;
      }

      if (timers.current.has(key)) {
        // Undo: cancel the pending completion
        clearTimeout(timers.current.get(key));
        timers.current.delete(key);
        setPendingKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        // Start pending
        setPendingKeys(prev => new Set([...prev, key]));
        const timer = setTimeout(async () => {
          timers.current.delete(key);
          try {
            const current = tasksRef.current.find(t => t.raw === key);
            if (current) {
              const { tasks: updated } = applyDone([...tasksRef.current], [current.line], todayStrRef.current);
              await save(updated);
            }
          } catch {}
          setPendingKeys(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, delayMs);
        timers.current.set(key, timer);
      }
    },
    [save, delayMs],
  );

  return { isPending, tapCheckbox };
}
