import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Task } from '@shared/parser';
import { readTasks, writeTasks, resolveFile } from '../store';
import { today } from '../utils';

type TaskContextValue = {
  tasks: Task[];
  filePath: string;
  loading: boolean;
  reload: () => Promise<void>;
  save: (updated: Task[]) => Promise<void>;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today());

  const reload = useCallback(async () => {
    const path = await resolveFile();
    setFilePath(path);
    const loaded = await readTasks(path);
    setTasks(loaded);
  }, []);

  const save = useCallback(
    async (updated: Task[]) => {
      await writeTasks(filePath, updated);
      setTasks(updated);
    },
    [filePath]
  );

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <TaskContext.Provider value={{ tasks, filePath, loading, reload, save, selectedDate, setSelectedDate }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be called inside <TaskProvider>');
  return ctx;
}
