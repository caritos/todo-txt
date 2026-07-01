import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Task } from '@shared/parser';
import { readTasks, writeTasks, resolveFile, resolveWeekStart, setWeekStart as storeSetWeekStart } from '../store';
import { today } from '../utils';

type TaskContextValue = {
  tasks: Task[];
  filePath: string;
  weekStart: 0 | 1;
  setWeekStart: (ws: 0 | 1) => Promise<void>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  save: (updated: Task[]) => Promise<void>;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filePath, setFilePath] = useState('');
  const [weekStart, setWeekStartState] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(today());

  // Keep a ref so save() always sees the latest filePath even if the
  // callback closure hasn't been recreated yet (avoids stale-closure
  // race on fast interactions shortly after launch).
  const filePathRef = useRef('');

  const reload = useCallback(async () => {
    const [path, ws] = await Promise.all([resolveFile(), resolveWeekStart()]);
    filePathRef.current = path;
    setFilePath(path);
    setWeekStartState(ws);
    try {
      const loaded = await readTasks(path);
      setTasks(loaded);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setWeekStart = useCallback(async (ws: 0 | 1) => {
    await storeSetWeekStart(ws);
    setWeekStartState(ws);
  }, []);

  const save = useCallback(
    async (updated: Task[]) => {
      const path = filePathRef.current || filePath;
      if (!path) throw new Error('File path not configured. Open Settings to set a location.');
      await writeTasks(path, updated);
      setTasks(updated);
    },
    [filePath]
  );

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <TaskContext.Provider value={{ tasks, filePath, weekStart, setWeekStart, loading, error, reload, save, selectedDate, setSelectedDate }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be called inside <TaskProvider>');
  return ctx;
}
