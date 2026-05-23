# iOS Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `mobile/` — an Expo Router iOS app that reads/writes `todo.txt` using the same business logic as the console CLI, implementing all screens from the approved design spec (`docs/superpowers/specs/2026-05-21-mobile-interface-design.md`).

**Architecture:** Expo Router (file-based screens) + React Native for iOS UI. A `TaskContext` loads tasks asynchronously from `expo-file-system` and provides them synchronously to screens. Shared pure-function commands (`applyFocus`, `applyDone`, etc. from `shared/commands/`) mutate in-memory task arrays; mutations are saved back to disk. Metro bundler is configured to resolve imports from the root `shared/` directory via a `@shared/*` path alias, so zero business logic is duplicated.

**Tech Stack:** Expo SDK 52, Expo Router v3, React Native (iOS only), TypeScript, expo-file-system, react-native-reanimated, react-native-gesture-handler, @expo-google-fonts/jetbrains-mono, chrono-node, bun test (shared layer), Jest (mobile unit tests)

---

## File Map

**Scaffold**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/metro.config.js` — watchFolders + nodeModulesPaths for `shared/`
- Create: `mobile/babel.config.js` — babel-preset-expo + module-resolver for `@shared` alias + reanimated plugin

**Core**
- Create: `mobile/src/store.ts` — async `readTasks`, `writeTasks`, `resolveFile`, `setFilePath`
- Create: `mobile/src/__tests__/store.test.ts` — Jest tests (mocked expo-file-system)
- Create: `mobile/src/theme.ts` — Colors, Fonts, Spacing design tokens
- Create: `mobile/src/utils.ts` — `today()` local date string
- Create: `mobile/src/nlParser.ts` — natural language input → todo.txt raw string via chrono-node
- Create: `mobile/src/__tests__/nlParser.test.ts` — Jest unit tests
- Create: `mobile/src/context/TaskContext.tsx` — React context providing `tasks`, `filePath`, `reload`, `save`

**Screens**
- Create: `mobile/app/_layout.tsx` — root Stack layout, fonts, GestureHandlerRootView, TaskProvider, BottomActionBar
- Create: `mobile/app/index.tsx` — redirects to `/focus`
- Create: `mobile/app/focus.tsx` — Focus screen (primary; CalendarHeader + day-grouped SectionList)
- Create: `mobile/app/list.tsx` — List screen (stats cards + flat task list)
- Create: `mobile/app/search.tsx` — Search screen (text input + flat results)
- Create: `mobile/app/report.tsx` — Report screen (summary stats from `applyReport`)
- Create: `mobile/app/settings.tsx` — Settings: active file path + iCloud path button
- Create: `mobile/app/task/[line].tsx` — Task detail sheet: Done, Edit, Priority, Skip, Delete

**Components**
- Create: `mobile/src/components/BottomActionBar.tsx` — ≡ | view label | ⌕ | + bar
- Create: `mobile/src/components/ViewSwitcher.tsx` — popover sheet opened by ≡
- Create: `mobile/src/components/TaskRow.tsx` — □ checkbox + date label + ↻ + title; swipe-left reveals Done/Delete
- Create: `mobile/src/components/EventPill.tsx` — full-width pill for `type:event` tasks
- Create: `mobile/src/components/WeekStrip.tsx` — 7-day scrollable strip with dot indicators
- Create: `mobile/src/components/MonthGrid.tsx` — full month calendar grid
- Create: `mobile/src/components/CalendarHeader.tsx` — collapsible WeekStrip ↔ MonthGrid + drag handle
- Create: `mobile/src/components/StatsCard.tsx` — count card (open tasks, per-project)
- Create: `mobile/src/components/PriorityPicker.tsx` — A–Z single-letter horizontal picker
- Create: `mobile/src/components/RecurrencePicker.tsx` — Never/Daily/Weekly/… option picker
- Create: `mobile/src/components/AddTaskModal.tsx` — NL input primary; structured form secondary

---

## Task 1: Expo Router scaffold

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/metro.config.js`
- Create: `mobile/babel.config.js`

- [ ] **Create the mobile directory and initialize Expo project**

```bash
cd /Users/eladio/src/todo-txt
npx create-expo-app@latest mobile --template blank-typescript
```

If `create-expo-app` prompts, accept defaults. This creates `mobile/` with a working blank Expo app.

- [ ] **Install Expo Router and navigation dependencies**

```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
```

- [ ] **Install gesture + animation dependencies**

```bash
npx expo install react-native-gesture-handler react-native-reanimated
```

- [ ] **Install remaining app dependencies**

```bash
npx expo install expo-file-system expo-font expo-haptics
npx expo install @expo-google-fonts/jetbrains-mono
npm install chrono-node
npm install --save-dev babel-plugin-module-resolver
```

- [ ] **Replace `mobile/package.json` with this exact content**

```json
{
  "name": "todo-mobile",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@expo-google-fonts/jetbrains-mono": "latest",
    "chrono-node": "^2.7.7",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-file-system": "~18.0.0",
    "expo-font": "~13.0.0",
    "expo-haptics": "~14.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "babel-plugin-module-resolver": "^5.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "typescript": "~5.3.0"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|chrono-node)"
    ]
  }
}
```

- [ ] **Replace `mobile/app.json` with this content**

```json
{
  "expo": {
    "name": "Todo",
    "slug": "todo-txt",
    "version": "0.1.0",
    "scheme": "todo",
    "platforms": ["ios"],
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#1A1A1A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.caritos.todo",
      "infoPlist": {
        "NSUbiquitousKeyValueStoreIdentifier": "iCloud.com.caritos.todo"
      },
      "entitlements": {
        "com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)com.caritos.todo",
        "com.apple.developer.icloud-services": ["CloudDocuments"],
        "com.apple.developer.icloud-container-identifiers": ["iCloud.com.caritos.todo"]
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-font",
        {
          "fonts": ["./node_modules/@expo-google-fonts/jetbrains-mono/JetBrainsMono_400Regular.ttf"]
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Replace `mobile/tsconfig.json` with this content**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Replace `mobile/metro.config.js` with this content**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve files from the root shared/ directory
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

- [ ] **Replace `mobile/babel.config.js` with this content**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@shared': '../shared',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
```

- [ ] **Delete the auto-generated `mobile/app` directory contents and create placeholder**

The `create-expo-app` template creates `app/index.tsx` with sample content. Remove it so we can build our own screens cleanly:

```bash
rm -rf mobile/app
mkdir -p mobile/app/task
```

- [ ] **Verify Expo can resolve the project**

```bash
cd mobile
npx expo export --platform ios --dump-sourcemap 2>&1 | head -30
```

Expected: No fatal errors (warnings about missing icon assets are fine). If you see module resolution errors for `@shared`, the metro.config.js or babel.config.js needs debugging.

- [ ] **Commit scaffold**

```bash
cd ..
git add mobile/
git commit -m "feat: scaffold mobile/ Expo Router project with shared/ module resolution"
```

---

## Task 2: store.ts — async file I/O

The mobile store mirrors `console/store.ts`'s interface but uses `expo-file-system` instead of Node.js `fs`. All functions are async.

**Files:**
- Create: `mobile/src/store.ts`
- Create: `mobile/src/__tests__/store.test.ts`

- [ ] **Write the failing tests first**

Create `mobile/src/__tests__/store.test.ts`:

```ts
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock expo-file-system before importing store
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

// Mock @shared/parser
jest.mock('@shared/parser', () => ({
  parseLine: jest.fn((line: string, i: number) => ({
    line: i,
    raw: line,
    done: false,
    text: line,
    projects: [],
    contexts: [],
    extensions: {},
  })),
}));

import * as FileSystem from 'expo-file-system';
import { readTasks, writeTasks, resolveFile, setFilePath } from '../store';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => jest.clearAllMocks());

describe('resolveFile', () => {
  test('returns default path when config does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const path = await resolveFile();
    expect(path).toBe('file:///mock-doc-dir/todo.txt');
  });

  test('returns stored path from config', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({ filePath: 'file:///mock-doc-dir/icloud/todo.txt' })
    );
    const path = await resolveFile();
    expect(path).toBe('file:///mock-doc-dir/icloud/todo.txt');
  });
});

describe('readTasks', () => {
  test('returns empty array when file does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toEqual([]);
  });

  test('parses non-empty lines and skips blank lines', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce('task one\n\ntask two\n');
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toHaveLength(2);
  });
});

describe('writeTasks', () => {
  test('writes tasks as newline-joined raw strings via tmp+rename', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    mockFs.moveAsync.mockResolvedValueOnce(undefined as any);

    const tasks = [
      { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
      { line: 2, raw: 'task two', done: false, text: 'task two', projects: [], contexts: [], extensions: {} },
    ] as any;

    await writeTasks('file:///mock-doc-dir/todo.txt', tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo.txt.tmp',
      'task one\ntask two\n',
      { encoding: 'utf8' }
    );
    expect(mockFs.moveAsync).toHaveBeenCalledWith({
      from: 'file:///mock-doc-dir/todo.txt.tmp',
      to: 'file:///mock-doc-dir/todo.txt',
    });
  });
});

describe('setFilePath', () => {
  test('writes config file with new path', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    await setFilePath('file:///icloud/todo.txt');
    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo-config.json',
      JSON.stringify({ filePath: 'file:///icloud/todo.txt' }),
      { encoding: 'utf8' }
    );
  });
});
```

- [ ] **Run tests to confirm failure**

```bash
cd mobile
npm test -- src/__tests__/store.test.ts
```

Expected: FAIL — `Cannot find module '../store'`

- [ ] **Create `mobile/src/store.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import { parseLine } from '@shared/parser';
import type { Task } from '@shared/parser';

const CONFIG_FILE = FileSystem.documentDirectory + 'todo-config.json';
const DEFAULT_TODO = FileSystem.documentDirectory + 'todo.txt';

type Config = { filePath: string };

async function readConfig(): Promise<Config> {
  try {
    const json = await FileSystem.readAsStringAsync(CONFIG_FILE!, { encoding: 'utf8' });
    return JSON.parse(json) as Config;
  } catch {
    return { filePath: DEFAULT_TODO! };
  }
}

export async function resolveFile(): Promise<string> {
  const config = await readConfig();
  return config.filePath;
}

export async function setFilePath(filePath: string): Promise<void> {
  await FileSystem.writeAsStringAsync(
    CONFIG_FILE!,
    JSON.stringify({ filePath }),
    { encoding: 'utf8' }
  );
}

export async function readTasks(filePath: string): Promise<Task[]> {
  try {
    const content = await FileSystem.readAsStringAsync(filePath, { encoding: 'utf8' });
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map((line, i) => parseLine(line, i + 1));
  } catch {
    return [];
  }
}

export async function writeTasks(filePath: string, tasks: Task[]): Promise<void> {
  const content = tasks.map(t => t.raw).join('\n') + '\n';
  const tmpPath = filePath + '.tmp';
  await FileSystem.writeAsStringAsync(tmpPath, content, { encoding: 'utf8' });
  await FileSystem.moveAsync({ from: tmpPath, to: filePath });
}
```

- [ ] **Run tests to confirm they pass**

```bash
npm test -- src/__tests__/store.test.ts
```

Expected: 4 test suites pass.

- [ ] **Commit**

```bash
cd ..
git add mobile/src/store.ts mobile/src/__tests__/store.test.ts
git commit -m "feat(mobile): add store.ts with async expo-file-system I/O"
```

---

## Task 3: theme.ts, utils.ts, nlParser.ts

**Files:**
- Create: `mobile/src/theme.ts`
- Create: `mobile/src/utils.ts`
- Create: `mobile/src/nlParser.ts`
- Create: `mobile/src/__tests__/nlParser.test.ts`

- [ ] **Create `mobile/src/theme.ts`**

```ts
export const Colors = {
  background: '#1A1A1A',
  surface: '#242424',
  text: '#F0F0F0',
  textSecondary: '#888888',
  accent: '#E8461A',
  separator: '#333333',
  checkboxBorder: '#555555',
  actionDone: '#E8461A',
  actionDelete: '#6B0000',
} as const;

export const Fonts = {
  mono: 'JetBrainsMono_400Regular',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
```

- [ ] **Create `mobile/src/utils.ts`**

```ts
export function today(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

export function formatDateLabel(dateStr: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const time = dateStr.length > 10 ? ' ' + dateStr.slice(11, 16) : '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${time}`;
}
```

- [ ] **Write failing tests for nlParser**

Create `mobile/src/__tests__/nlParser.test.ts`:

```ts
import { describe, test, expect } from '@jest/globals';
import { parseNaturalLanguage } from '../nlParser';

const TODAY = '2026-05-23';

describe('parseNaturalLanguage', () => {
  test('plain text returns creation-date-prefixed raw', () => {
    const result = parseNaturalLanguage('call dentist', TODAY);
    expect(result.raw).toBe('2026-05-23 call dentist');
    expect(result.priority).toBeUndefined();
    expect(result.startDate).toBeUndefined();
  });

  test('extracts priority from (A) suffix', () => {
    const result = parseNaturalLanguage('call dentist (A)', TODAY);
    expect(result.raw).toBe('(A) 2026-05-23 call dentist');
    expect(result.priority).toBe('A');
  });

  test('parses "tomorrow" into a start: date', () => {
    const result = parseNaturalLanguage('call dentist tomorrow', TODAY);
    expect(result.startDate).toBe('2026-05-24');
    expect(result.raw).toContain('start:2026-05-24');
    expect(result.raw).not.toContain('tomorrow');
  });

  test('parses time into start: datetime', () => {
    const result = parseNaturalLanguage('dentist at 2pm', TODAY);
    expect(result.startDate).toMatch(/^2026-05-23T14:00$/);
  });

  test('empty string returns creation date only', () => {
    const result = parseNaturalLanguage('', TODAY);
    expect(result.raw).toBe('2026-05-23 ');
  });
});
```

- [ ] **Run to confirm failure**

```bash
cd mobile
npm test -- src/__tests__/nlParser.test.ts
```

Expected: FAIL — `Cannot find module '../nlParser'`

- [ ] **Create `mobile/src/nlParser.ts`**

```ts
import * as chrono from 'chrono-node';

export type ParsedTask = {
  raw: string;
  text: string;
  priority?: string;
  startDate?: string;
};

function isoDate(d: Date): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

function isoDateTime(d: Date): string {
  return (
    isoDate(d) +
    `T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  );
}

export function parseNaturalLanguage(input: string, todayStr: string): ParsedTask {
  const referenceDate = new Date(todayStr + 'T12:00:00');

  // Extract trailing or leading priority like (A)
  const priorityMatch = input.match(/\(([A-Z])\)/);
  const priority = priorityMatch?.[1];
  let text = input.replace(/\s*\([A-Z]\)\s*/g, ' ').trim();

  // Parse date/time from remaining text
  const results = chrono.parse(text, referenceDate, { forwardDate: true });
  let startDate: string | undefined;

  if (results.length > 0) {
    const result = results[0]!;
    const date = result.start.date();
    const hasTime = result.start.isCertain('hour');
    startDate = hasTime ? isoDateTime(date) : isoDate(date);
    text = (text.slice(0, result.index) + text.slice(result.index + result.text.length))
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Build raw todo.txt line
  const parts: string[] = [];
  if (priority) parts.push(`(${priority})`);
  parts.push(todayStr);
  parts.push(text);
  if (startDate) parts.push(`start:${startDate}`);

  return { raw: parts.join(' '), text, priority, startDate };
}
```

- [ ] **Run tests to confirm they pass**

```bash
npm test -- src/__tests__/nlParser.test.ts
```

Expected: 5 tests pass.

- [ ] **Commit**

```bash
cd ..
git add mobile/src/theme.ts mobile/src/utils.ts mobile/src/nlParser.ts mobile/src/__tests__/nlParser.test.ts
git commit -m "feat(mobile): add theme, utils, and nlParser"
```

---

## Task 4: TaskContext

**Files:**
- Create: `mobile/src/context/TaskContext.tsx`

- [ ] **Create `mobile/src/context/` directory and `TaskContext.tsx`**

```bash
mkdir -p mobile/src/context
```

Create `mobile/src/context/TaskContext.tsx`:

```tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Task } from '@shared/parser';
import { readTasks, writeTasks, resolveFile } from '../store';

type TaskContextValue = {
  tasks: Task[];
  filePath: string;
  loading: boolean;
  reload: () => Promise<void>;
  save: (updated: Task[]) => Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(true);

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
    <TaskContext.Provider value={{ tasks, filePath, loading, reload, save }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be called inside <TaskProvider>');
  return ctx;
}
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/context/TaskContext.tsx
git commit -m "feat(mobile): add TaskContext for global task state"
```

---

## Task 5: Root layout, index redirect, and bottom navigation

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`

- [ ] **Create `mobile/app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { TaskProvider } from '../src/context/TaskContext';
import { BottomActionBar } from '../src/components/BottomActionBar';
import { Colors } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ JetBrainsMono_400Regular });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <TaskProvider>
        <View style={styles.root}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="focus" />
            <Stack.Screen name="list" />
            <Stack.Screen name="search" />
            <Stack.Screen name="report" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="task/[line]"
              options={{ presentation: 'formSheet', headerShown: false }}
            />
          </Stack>
          <BottomActionBar />
        </View>
      </TaskProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
```

- [ ] **Create `mobile/app/index.tsx`**

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/focus" />;
}
```

- [ ] **Commit**

```bash
cd ..
git add mobile/app/_layout.tsx mobile/app/index.tsx
git commit -m "feat(mobile): add root layout with Stack navigator and index redirect"
```

---

## Task 6: BottomActionBar and ViewSwitcher

**Files:**
- Create: `mobile/src/components/BottomActionBar.tsx`
- Create: `mobile/src/components/ViewSwitcher.tsx`

- [ ] **Create `mobile/src/components/` directory**

```bash
mkdir -p mobile/src/components
```

- [ ] **Create `mobile/src/components/ViewSwitcher.tsx`**

```tsx
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../theme';

type View_ = { label: string; route: string };

const VIEWS: View_[] = [
  { label: 'Focus', route: '/focus' },
  { label: 'List', route: '/list' },
  { label: 'Search', route: '/search' },
  { label: 'Report', route: '/report' },
  { label: 'Settings', route: '/settings' },
];

type Props = { visible: boolean; onClose: () => void };

export function ViewSwitcher({ visible, onClose }: Props) {
  const router = useRouter();

  function navigate(route: string) {
    router.push(route as any);
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {VIEWS.map(v => (
            <TouchableOpacity key={v.route} style={styles.item} onPress={() => navigate(v.route)}>
              <Text style={styles.itemText}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 44,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  item: { paddingVertical: 16, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  itemText: { fontSize: 17, color: Colors.text },
});
```

- [ ] **Create `mobile/src/components/BottomActionBar.tsx`**

Note: `AddTaskModal` is imported here but created in Task 12. The file references it by path — create a stub if needed to avoid import errors.

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Colors, Spacing } from '../theme';
import { ViewSwitcher } from './ViewSwitcher';
import { AddTaskModal } from './AddTaskModal';

const ROUTE_LABELS: Record<string, string> = {
  '/focus': 'Focus',
  '/list': 'List',
  '/search': 'Search',
  '/report': 'Report',
  '/settings': 'Settings',
};

export function BottomActionBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);

  const label = ROUTE_LABELS[pathname] ?? 'Focus';

  return (
    <>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => setSwitcherVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.icon}>≡</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSwitcherVisible(true)} style={styles.labelBtn}>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/search')} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.icon}>⌕</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAddVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Text style={[styles.icon, styles.addIcon]}>+</Text>
        </TouchableOpacity>
      </View>
      <ViewSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
      <AddTaskModal visible={addVisible} onClose={() => setAddVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
  },
  iconBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  labelBtn: { flex: 1, alignItems: 'center' },
  icon: { fontSize: 24, color: Colors.text, lineHeight: 30 },
  addIcon: { color: Colors.accent, fontWeight: '300', fontSize: 28 },
  label: { fontSize: 16, color: Colors.text, letterSpacing: 0.3 },
});
```

- [ ] **Create a stub `mobile/src/components/AddTaskModal.tsx` so the import resolves**

We'll replace this in Task 12. For now:

```tsx
import { Modal, View } from 'react-native';
type Props = { visible: boolean; onClose: () => void };
export function AddTaskModal({ visible, onClose }: Props) {
  return <Modal visible={visible} onRequestClose={onClose}><View /></Modal>;
}
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/BottomActionBar.tsx mobile/src/components/ViewSwitcher.tsx mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): add BottomActionBar, ViewSwitcher, AddTaskModal stub"
```

---

## Task 7: TaskRow and EventPill

**Files:**
- Create: `mobile/src/components/TaskRow.tsx`
- Create: `mobile/src/components/EventPill.tsx`

- [ ] **Create `mobile/src/components/TaskRow.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { Task } from '@shared/parser';
import { Colors, Fonts, Spacing } from '../theme';

function cleanTitle(text: string): string {
  // Strip key:value extensions from display text
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function RightActions({ onDone, onDelete }: { onDone: () => void; onDelete: () => void }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.actionDone }]} onPress={onDone}>
        <Text style={styles.actionText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.actionDelete }]} onPress={onDelete}>
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  task: Task;
  dateLabel?: string;
  recurrenceLabel?: string;
  isOverdue?: boolean;
  onPress: () => void;
  onDone: () => void;
  onDelete: () => void;
};

export function TaskRow({ task, dateLabel, recurrenceLabel, isOverdue, onPress, onDone, onDelete }: Props) {
  const title = cleanTitle(task.text);
  const meta = [dateLabel, recurrenceLabel].filter(Boolean).join('   ');

  return (
    <Swipeable
      renderRightActions={() => <RightActions onDone={onDone} onDelete={onDelete} />}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.row}>
        <View style={[styles.checkbox, isOverdue && styles.checkboxOverdue]} />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={3}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {task.priority ? (
          <Text style={styles.priority}>{task.priority}</Text>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderWidth: 1.5,
    borderColor: Colors.checkboxBorder,
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxOverdue: { borderColor: Colors.accent },
  content: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  meta: { fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.2 },
  priority: { fontSize: 11, color: Colors.accent, fontWeight: '700', marginTop: 2, flexShrink: 0 },
  actions: { flexDirection: 'row' },
  actionBtn: { justifyContent: 'center', paddingHorizontal: Spacing.md, minWidth: 72 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Create `mobile/src/components/EventPill.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Task } from '@shared/parser';
import { Colors, Fonts, Spacing } from '../theme';

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

type Props = {
  task: Task;
  dateLabel?: string;
  onPress: () => void;
};

export function EventPill({ task, dateLabel, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.pill}>
      <Text style={styles.title} numberOfLines={1}>{cleanTitle(task.text)}</Text>
      {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginHorizontal: Spacing.md,
    marginVertical: 3,
    backgroundColor: Colors.accent + '22',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flex: 1 },
  date: { fontSize: 11, color: Colors.textSecondary, marginLeft: Spacing.sm, flexShrink: 0 },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/TaskRow.tsx mobile/src/components/EventPill.tsx
git commit -m "feat(mobile): add TaskRow and EventPill components"
```

---

## Task 8: WeekStrip and MonthGrid

**Files:**
- Create: `mobile/src/components/WeekStrip.tsx`
- Create: `mobile/src/components/MonthGrid.tsx`

- [ ] **Create `mobile/src/components/WeekStrip.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function weekDates(anchDate: string): string[] {
  const d = new Date(anchDate + 'T12:00:00');
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  });
}

type Props = {
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function WeekStrip({ today, selectedDate, dotDates, onSelectDate }: Props) {
  const dates = weekDates(today);

  return (
    <View style={styles.strip}>
      {dates.map(date => {
        const isToday = date === today;
        const isSelected = date === selectedDate;
        const hasDot = dotDates.has(date);
        const dayNum = parseInt(date.slice(8));
        const dow = new Date(date + 'T12:00:00').getDay();

        return (
          <TouchableOpacity key={date} style={styles.col} onPress={() => onSelectDate(date)}>
            <Text style={styles.dayLabel}>{DAY_LABELS[dow]}</Text>
            <View style={[styles.circle, isToday && styles.todayCircle, isSelected && !isToday && styles.selectedCircle]}>
              <Text style={[styles.dayNum, isToday && styles.todayNum]}>{dayNum}</Text>
            </View>
            <View style={[styles.dot, hasDot && styles.dotVisible, isToday && hasDot && styles.dotToday]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  circle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: Colors.accent, borderRadius: 16 },
  selectedCircle: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: 16 },
  dayNum: { fontSize: 15, color: Colors.text, fontWeight: '400' },
  todayNum: { color: '#fff', fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotVisible: { backgroundColor: Colors.textSecondary },
  dotToday: { backgroundColor: '#fff' },
});
```

- [ ] **Create `mobile/src/components/MonthGrid.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildGridDates(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

type Props = {
  year: number;
  month: number; // 0-based
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function MonthGrid({ year, month, today, selectedDate, dotDates, onSelectDate }: Props) {
  const cells = buildGridDates(year, month);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map(d => (
          <Text key={d} style={styles.headerCell}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const hasDot = dotDates.has(date);
          const dayNum = parseInt(date.slice(8));
          return (
            <TouchableOpacity key={date} style={styles.cell} onPress={() => onSelectDate(date)}>
              <View style={[styles.circle, isToday && styles.todayCircle, isSelected && !isToday && styles.selectedCircle]}>
                <Text style={[styles.dayNum, isToday && styles.todayNum]}>{dayNum}</Text>
              </View>
              {hasDot && <View style={[styles.dot, isToday && styles.dotToday]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xs },
  headerRow: { flexDirection: 'row', marginBottom: 2 },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', alignItems: 'center', paddingVertical: 3 },
  circle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: Colors.accent, borderRadius: 14 },
  selectedCircle: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: 14 },
  dayNum: { fontSize: 13, color: Colors.text },
  todayNum: { color: '#fff', fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textSecondary, marginTop: 1 },
  dotToday: { backgroundColor: '#fff' },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/WeekStrip.tsx mobile/src/components/MonthGrid.tsx
git commit -m "feat(mobile): add WeekStrip and MonthGrid calendar components"
```

---

## Task 9: CalendarHeader

**Files:**
- Create: `mobile/src/components/CalendarHeader.tsx`

- [ ] **Create `mobile/src/components/CalendarHeader.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useState } from 'react';
import { WeekStrip } from './WeekStrip';
import { MonthGrid } from './MonthGrid';
import { Colors, Spacing } from '../theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_GRID_HEIGHT = 230;

type Props = {
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function CalendarHeader({ today, selectedDate, dotDates, onSelectDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const gridHeight = useSharedValue(0);

  const year = parseInt(today.slice(0, 4));
  const month = parseInt(today.slice(5, 7)) - 1;

  const animatedStyle = useAnimatedStyle(() => ({
    height: withSpring(gridHeight.value, { damping: 22, stiffness: 220 }),
    overflow: 'hidden',
  }));

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    gridHeight.value = next ? MONTH_GRID_HEIGHT : 0;
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Text style={styles.monthText}>
          <Text style={styles.monthName}>{MONTH_NAMES[month]} </Text>
          <Text style={styles.year}>{year}</Text>
        </Text>
      </View>
      <WeekStrip
        today={today}
        selectedDate={selectedDate}
        dotDates={dotDates}
        onSelectDate={onSelectDate}
      />
      <Animated.View style={animatedStyle}>
        <MonthGrid
          year={year}
          month={month}
          today={today}
          selectedDate={selectedDate}
          dotDates={dotDates}
          onSelectDate={onSelectDate}
        />
      </Animated.View>
      <TouchableOpacity onPress={toggle} style={styles.handleRow} hitSlop={10}>
        <View style={[styles.handle, expanded && styles.handleExpanded]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  monthRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 0 },
  monthText: {},
  monthName: { fontSize: 22, color: Colors.textSecondary, fontWeight: '300', letterSpacing: -0.3 },
  year: { fontSize: 22, color: Colors.accent, fontWeight: '300', letterSpacing: -0.3 },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator },
  handleExpanded: { backgroundColor: Colors.accent },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/CalendarHeader.tsx
git commit -m "feat(mobile): add collapsible CalendarHeader component"
```

---

## Task 10: Focus screen

**Files:**
- Create: `mobile/app/focus.tsx`

- [ ] **Create `mobile/app/focus.tsx`**

```tsx
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { CalendarHeader } from '../src/components/CalendarHeader';
import { TaskRow } from '../src/components/TaskRow';
import { EventPill } from '../src/components/EventPill';
import { applyFocus } from '@shared/commands/focus';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Spacing } from '../src/theme';
import { today, formatDateLabel } from '../src/utils';
import * as Haptics from 'expo-haptics';
import type { FocusItem } from '@shared/commands/focus';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sectionHeader(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const tomorrowDate = new Date(todayStr + 'T12:00:00');
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = isoDate(tomorrowDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yr = d.getFullYear().toString().slice(2);
  if (dateStr === todayStr) return `TODAY  ${m}/${day}/${yr}`;
  if (dateStr === tomorrowStr) return `TOMORROW  ${m}/${day}/${yr}`;
  return `${DAY_NAMES[d.getDay()]!.toUpperCase()}  ${m}/${day}/${yr}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Section = { title: string; date: string; data: FocusItem[] };

export default function FocusScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { sections, dotDates } = useMemo(() => {
    const items = applyFocus(tasks, todayStr);
    const dots = new Set(items.map(fi => fi.effectiveDate.slice(0, 10)));
    const byDate = new Map<string, FocusItem[]>();
    for (const item of items) {
      const date = item.effectiveDate.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(item);
    }
    const sects: Section[] = [...byDate.entries()].map(([date, data]) => ({
      title: sectionHeader(date, todayStr),
      date,
      data,
    }));
    return { sections: sects, dotDates: dots };
  }, [tasks, todayStr]);

  async function handleDone(lineNum: number) {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }

  async function handleDelete(lineNum: number) {
    const { tasks: updated } = applyRm([...tasks], [lineNum]);
    await save(updated);
  }

  return (
    <View style={styles.screen}>
      <CalendarHeader
        today={todayStr}
        selectedDate={selectedDate}
        dotDates={dotDates}
        onSelectDate={setSelectedDate}
      />
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.task.line)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isEvent = !!item.task.extensions['type'];
          const dateLabel = formatDateLabel(item.effectiveDate);
          if (isEvent) {
            return (
              <EventPill
                task={item.task}
                dateLabel={dateLabel}
                onPress={() => router.push(`/task/${item.task.line}` as any)}
              />
            );
          }
          return (
            <TaskRow
              task={item.task}
              dateLabel={dateLabel}
              recurrenceLabel={item.recurrenceLabel || undefined}
              isOverdue={item.effectiveDate.slice(0, 10) < todayStr}
              onPress={() => router.push(`/task/${item.task.line}` as any)}
              onDone={() => handleDone(item.task.line)}
              onDelete={() => handleDelete(item.task.line)}
            />
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing in focus for the next 2 weeks.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickySectionHeadersEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic' },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/app/focus.tsx
git commit -m "feat(mobile): add Focus screen with calendar header and day-grouped task list"
```

---

## Task 11: StatsCard and List screen

**Files:**
- Create: `mobile/src/components/StatsCard.tsx`
- Create: `mobile/app/list.tsx`

- [ ] **Create `mobile/src/components/StatsCard.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

type Props = {
  label: string;
  count: number;
};

export function StatsCard({ label, count }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  count: { fontSize: 28, color: Colors.text, fontWeight: '300', lineHeight: 32 },
  label: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
});
```

- [ ] **Create `mobile/app/list.tsx`**

```tsx
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { TaskRow } from '../src/components/TaskRow';
import { StatsCard } from '../src/components/StatsCard';
import { sortByPriority } from '@shared/commands/list';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Spacing } from '../src/theme';
import { today, formatDateLabel } from '../src/utils';
import * as Haptics from 'expo-haptics';

export default function ListScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();

  const [showAll, setShowAll] = useState(false);
  const openTasks = useMemo(
    () => sortByPriority(showAll ? tasks : tasks.filter(t => !t.done)),
    [tasks, showAll]
  );

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of openTasks) {
      for (const p of t.projects) map.set(p, (map.get(p) ?? 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [openTasks]);

  async function handleDone(lineNum: number) {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }

  async function handleDelete(lineNum: number) {
    const { tasks: updated } = applyRm([...tasks], [lineNum]);
    await save(updated);
  }

  const ListHeader = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <StatsCard label="Open" count={openTasks.length} />
        {projectCounts.map(([proj, count]) => (
          <StatsCard key={proj} label={proj} count={count} />
        ))}
      </ScrollView>
      <View style={styles.separator} />
      <TouchableOpacity onPress={() => setShowAll(s => !s)} style={styles.allToggle}>
        <Text style={styles.allToggleText}>{showAll ? 'Show open only' : 'Show all (including done)'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={openTasks}
        keyExtractor={t => String(t.line)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            dateLabel={item.extensions['start'] ? formatDateLabel(item.extensions['start']!) : undefined}
            isOverdue={
              item.extensions['due'] !== undefined && item.extensions['due']! < todayStr
            }
            onPress={() => router.push(`/task/${item.line}` as any)}
            onDone={() => handleDone(item.line)}
            onDelete={() => handleDelete(item.line)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No open tasks.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  cards: { flexDirection: 'row', gap: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  allToggle: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  allToggleText: { fontSize: 13, color: Colors.accent },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic' },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/StatsCard.tsx mobile/app/list.tsx
git commit -m "feat(mobile): add List screen with stats cards"
```

---

## Task 12: Search and Report screens

**Files:**
- Create: `mobile/app/search.tsx`
- Create: `mobile/app/report.tsx`

- [ ] **Create `mobile/app/search.tsx`**

```tsx
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { TaskRow } from '../src/components/TaskRow';
import { applySearch } from '@shared/commands/search';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';

export default function SearchScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (query.trim() ? applySearch(tasks, query.trim()) : []),
    [tasks, query]
  );

  async function handleDone(lineNum: number) {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
    } catch {}
  }

  async function handleDelete(lineNum: number) {
    const { tasks: updated } = applyRm([...tasks], [lineNum]);
    await save(updated);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Search tasks…"
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={t => String(t.line)}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() => router.push(`/task/${item.line}` as any)}
            onDone={() => handleDone(item.line)}
            onDelete={() => handleDelete(item.line)}
          />
        )}
        ListEmptyComponent={() =>
          query.trim() ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tasks matching "{query}"</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  inputRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  input: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary },
});
```

- [ ] **Create `mobile/app/report.tsx`**

```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTasks } from '../src/context/TaskContext';
import { applyReport } from '@shared/commands/report';
import { Colors, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { useMemo } from 'react';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const { tasks } = useTasks();
  const todayStr = today();

  const report = useMemo(() => applyReport(tasks, todayStr), [tasks, todayStr]);

  const projects = [...report.byProject.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.sectionTitle}>Tasks</Text>
      <View style={styles.card}>
        <Row label="Open" value={report.open} />
        <Row label="Done" value={report.done} />
        {report.overdue > 0 && <Row label="Overdue" value={report.overdue} />}
        <Row label="Completed today" value={report.completedToday} />
        <Row label="Completed this week" value={report.completedThisWeek} />
      </View>

      {projects.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By Project</Text>
          <View style={styles.card}>
            {projects.map(([proj, counts]) => (
              <Row key={proj} label={proj} value={`${counts.open} open, ${counts.done} done`} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  rowLabel: { fontSize: 15, color: Colors.text },
  rowValue: { fontSize: 15, color: Colors.textSecondary },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/app/search.tsx mobile/app/report.tsx
git commit -m "feat(mobile): add Search and Report screens"
```

---

## Task 13: PriorityPicker and Task detail sheet

**Files:**
- Create: `mobile/src/components/PriorityPicker.tsx`
- Create: `mobile/app/task/[line].tsx`

- [ ] **Create `mobile/src/components/PriorityPicker.tsx`**

```tsx
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

type Props = {
  value?: string;
  onChange: (priority: string | undefined) => void;
};

export function PriorityPicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <TouchableOpacity
        style={[styles.cell, !value && styles.cellSelected]}
        onPress={() => onChange(undefined)}
      >
        <Text style={[styles.letter, !value && styles.letterSelected]}>—</Text>
      </TouchableOpacity>
      {LETTERS.map(l => (
        <TouchableOpacity
          key={l}
          style={[styles.cell, value === l && styles.cellSelected]}
          onPress={() => onChange(l)}
        >
          <Text style={[styles.letter, value === l && styles.letterSelected]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs },
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  cellSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + '22' },
  letter: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  letterSelected: { color: Colors.accent },
});
```

- [ ] **Create `mobile/app/task/[line].tsx`**

This is the task detail sheet — presented as a native `formSheet` modal from Expo Router. It shows Done, Edit, Priority, Skip (recurring only), and Delete actions.

```tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../../src/context/TaskContext';
import { PriorityPicker } from '../../src/components/PriorityPicker';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { applyEdit } from '@shared/commands/edit';
import { applyPri, applyDepri } from '@shared/commands/pri';
import { applySkip } from '@shared/commands/skip';
import { Colors, Fonts, Spacing } from '../../src/theme';
import { today } from '../../src/utils';

export default function TaskDetail() {
  const { line } = useLocalSearchParams<{ line: string }>();
  const router = useRouter();
  const { tasks, save } = useTasks();
  const todayStr = today();

  const lineNum = parseInt(line ?? '0', 10);
  const task = useMemo(() => tasks.find(t => t.line === lineNum), [tasks, lineNum]);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task?.text ?? '');
  const [priority, setPriority] = useState<string | undefined>(task?.priority);

  if (!task) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.errorText}>Task not found.</Text>
      </View>
    );
  }

  const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);

  async function handleDone() {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
      router.back();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleSaveEdit() {
    try {
      const { tasks: updated } = applyEdit([...tasks], lineNum, editText, todayStr);
      await save(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handlePriorityChange(p: string | undefined) {
    setPriority(p);
    try {
      let updated: ReturnType<typeof applyPri> | ReturnType<typeof applyDepri>;
      if (p) {
        updated = applyPri([...tasks], lineNum, p);
      } else {
        updated = applyDepri([...tasks], lineNum);
      }
      await save(updated.tasks);
    } catch {}
  }

  async function handleSkip() {
    try {
      const { tasks: updated } = applySkip([...tasks], lineNum, todayStr);
      await save(updated);
      router.back();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete Task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { tasks: updated } = applyRm([...tasks], [lineNum]);
          await save(updated);
          router.back();
        },
      },
    ]);
  }

  function cleanTitle(text: string): string {
    return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
  }

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Drag handle */}
      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>

      {/* Title */}
      <View style={styles.titleRow}>
        {editing ? (
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
        ) : (
          <Text style={styles.title}>{cleanTitle(task.text)}</Text>
        )}
      </View>

      {/* Priority picker */}
      <Text style={styles.label}>Priority</Text>
      <PriorityPicker value={priority} onChange={handlePriorityChange} />

      {/* Actions */}
      <View style={styles.actions}>
        {!task.done && (
          <ActionButton label="Done" color={Colors.accent} onPress={handleDone} />
        )}
        {editing ? (
          <ActionButton label="Save Edit" color={Colors.accent} onPress={handleSaveEdit} />
        ) : (
          <ActionButton label="Edit" color={Colors.textSecondary} onPress={() => setEditing(true)} />
        )}
        {isRecurring && !task.done && (
          <ActionButton label="Skip" color={Colors.textSecondary} onPress={handleSkip} />
        )}
        <ActionButton label="Delete" color={Colors.actionDelete} onPress={handleDelete} />
      </View>

      {/* Raw text (dim) */}
      <Text style={styles.rawText}>{task.raw}</Text>
    </ScrollView>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Colors.surface },
  handleRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator },
  titleRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  title: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, lineHeight: 22 },
  editInput: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  actionBtn: { borderWidth: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  actionLabel: { fontSize: 15, fontWeight: '500' },
  errorText: { color: Colors.textSecondary, padding: Spacing.lg },
  rawText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.separator, paddingHorizontal: Spacing.md, paddingTop: Spacing.xl },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/PriorityPicker.tsx mobile/app/task/
git commit -m "feat(mobile): add PriorityPicker and Task detail sheet"
```

---

## Task 14: RecurrencePicker and AddTaskModal

Replace the stub `AddTaskModal.tsx` with the full implementation.

**Files:**
- Create: `mobile/src/components/RecurrencePicker.tsx`
- Modify: `mobile/src/components/AddTaskModal.tsx` (replace stub)

- [ ] **Create `mobile/src/components/RecurrencePicker.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export type RecurrenceValue =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

const OPTIONS: { label: string; value: RecurrenceValue; extensions: string }[] = [
  { label: 'Never', value: 'none', extensions: '' },
  { label: 'Every Day', value: 'daily', extensions: 'frequency:daily' },
  { label: 'Every Week', value: 'weekly', extensions: 'frequency:weekly' },
  { label: 'Every 2 Weeks', value: 'biweekly', extensions: 'frequency:weekly every:2' },
  { label: 'Every Month', value: 'monthly', extensions: 'frequency:monthly' },
  { label: 'Every Year', value: 'yearly', extensions: 'frequency:yearly' },
];

export function recurrenceExtensions(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.extensions ?? '';
}

type Props = {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
};

export function RecurrencePicker({ value, onChange }: Props) {
  return (
    <View>
      {OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, opt.value === value && styles.optionSelected]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, opt.value === value && styles.optionTextSelected]}>
            {opt.label}
          </Text>
          {opt.value === value && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  optionSelected: { backgroundColor: Colors.accent + '11' },
  optionText: { fontSize: 16, color: Colors.text },
  optionTextSelected: { color: Colors.accent },
  check: { color: Colors.accent, fontSize: 16 },
});
```

- [ ] **Replace `mobile/src/components/AddTaskModal.tsx` (the stub) with the full implementation**

```tsx
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { buildAddRaw } from '@shared/commands/add';
import { parseLine } from '@shared/parser';
import { parseNaturalLanguage } from '../nlParser';
import { RecurrencePicker, recurrenceExtensions } from './RecurrencePicker';
import type { RecurrenceValue } from './RecurrencePicker';
import { Colors, Fonts, Spacing } from '../theme';
import { today } from '../utils';

type Mode = 'nl' | 'structured';

type Props = { visible: boolean; onClose: () => void };

export function AddTaskModal({ visible, onClose }: Props) {
  const { tasks, save, filePath } = useTasks();
  const [mode, setMode] = useState<Mode>('nl');
  const [nlText, setNlText] = useState('');
  const [structText, setStructText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>('none');
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setNlText('');
    setStructText('');
    setStartDate('');
    setDueDate('');
    setRecurrence('none');
    setShowRecurrence(false);
    setError('');
    setMode('nl');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAdd() {
    setError('');
    const todayStr = today();
    let raw: string;

    try {
      if (mode === 'nl') {
        const parsed = parseNaturalLanguage(nlText.trim(), todayStr);
        raw = parsed.raw;
      } else {
        const parts: string[] = [structText.trim()];
        if (startDate) parts.push(`start:${startDate}`);
        if (dueDate) parts.push(`due:${dueDate}`);
        const ext = recurrenceExtensions(recurrence);
        if (ext) parts.push(ext);
        raw = buildAddRaw(parts.join(' '), todayStr);
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    const newTask = parseLine(raw, tasks.length + 1);
    await save([...tasks, newTask]);
    handleClose();
  }

  const QUICK_CHARS = ['/', ':', '-', '.', 'T'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Task</Text>
          <TouchableOpacity onPress={handleAdd}>
            <Text style={styles.add}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity onPress={() => setMode('nl')} style={[styles.modeBtn, mode === 'nl' && styles.modeBtnActive]}>
            <Text style={[styles.modeBtnText, mode === 'nl' && styles.modeBtnTextActive]}>Natural language</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('structured')} style={[styles.modeBtn, mode === 'structured' && styles.modeBtnActive]}>
            <Text style={[styles.modeBtnText, mode === 'structured' && styles.modeBtnTextActive]}>Structured</Text>
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {mode === 'nl' ? (
            <View style={styles.nlSection}>
              <TextInput
                style={styles.nlInput}
                placeholder="e.g. call dentist tomorrow at 2pm (A)"
                placeholderTextColor={Colors.textSecondary}
                value={nlText}
                onChangeText={setNlText}
                multiline
                autoFocus
              />
              {/* Quick char row */}
              <View style={styles.quickRow}>
                {QUICK_CHARS.map(ch => (
                  <TouchableOpacity key={ch} style={styles.quickBtn} onPress={() => setNlText(t => t + ch)}>
                    <Text style={styles.quickChar}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Task text</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.textSecondary}
                value={structText}
                onChangeText={setStructText}
                autoFocus
              />
              <Text style={styles.fieldLabel}>Start date (YYYY-MM-DD or YYYY-MM-DDTHH:MM)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 2026-05-24 or 2026-05-24T09:00"
                placeholderTextColor={Colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.fieldLabel}>Due date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 2026-05-31"
                placeholderTextColor={Colors.textSecondary}
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity onPress={() => setShowRecurrence(r => !r)} style={styles.recurrenceToggle}>
                <Text style={styles.fieldLabel}>Recurrence</Text>
                <Text style={styles.recurrenceValue}>
                  {recurrence === 'none' ? 'Never' : recurrence} ›
                </Text>
              </TouchableOpacity>
              {showRecurrence && (
                <RecurrencePicker value={recurrence} onChange={setRecurrence} />
              )}
            </View>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  cancel: { fontSize: 17, color: Colors.textSecondary },
  headerTitle: { fontSize: 17, color: Colors.text, fontWeight: '600' },
  add: { fontSize: 17, color: Colors.accent, fontWeight: '600' },
  modeRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.separator },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeBtnActive: { borderBottomColor: Colors.accent },
  modeBtnText: { fontSize: 14, color: Colors.textSecondary },
  modeBtnTextActive: { color: Colors.accent },
  nlSection: { padding: Spacing.md },
  nlInput: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quickRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  quickBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChar: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.text },
  formSection: { padding: Spacing.md },
  fieldLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.md, marginBottom: 4 },
  fieldInput: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    color: Colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  recurrenceToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  recurrenceValue: { fontSize: 15, color: Colors.accent },
  errorText: { color: Colors.accent, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, fontSize: 13 },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/src/components/RecurrencePicker.tsx mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): add RecurrencePicker and full AddTaskModal with NL + structured input"
```

---

## Task 15: Settings screen

**Files:**
- Create: `mobile/app/settings.tsx`

- [ ] **Create `mobile/app/settings.tsx`**

```tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { setFilePath } from '../src/store';
import { Colors, Fonts, Spacing } from '../src/theme';
import * as FileSystem from 'expo-file-system';

const ICLOUD_PATH = `${FileSystem.documentDirectory}../Library/Mobile Documents/iCloud~com~apple~CloudDocs/todo.txt`;

export default function SettingsScreen() {
  const { filePath, reload } = useTasks();
  const [pathInput, setPathInput] = useState(filePath);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await setFilePath(pathInput.trim());
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleUseICloud() {
    setPathInput(ICLOUD_PATH);
    Alert.alert(
      'iCloud Path Set',
      'The path has been populated. Tap Save to apply. Make sure iCloud Drive is enabled on this device.',
      [{ text: 'OK' }]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.sectionTitle}>Todo File</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>File path</Text>
        <TextInput
          style={styles.input}
          value={pathInput}
          onChangeText={setPathInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="file:///..."
          placeholderTextColor={Colors.textSecondary}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>iCloud Sync</Text>
      <View style={styles.card}>
        <Text style={styles.description}>
          Point the file path to your iCloud Drive to sync todo.txt across devices and with the Mac CLI.
        </Text>
        <TouchableOpacity style={styles.iCloudBtn} onPress={handleUseICloud}>
          <Text style={styles.iCloudBtnText}>Use iCloud Drive path</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current</Text>
      <View style={styles.card}>
        <Text style={styles.currentPath}>{filePath}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  saveBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.accent, marginTop: Spacing.sm },
  saveBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '500' },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  iCloudBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.textSecondary, alignSelf: 'flex-start' },
  iCloudBtnText: { color: Colors.text, fontSize: 14 },
  currentPath: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary, lineHeight: 18 },
});
```

- [ ] **Commit**

```bash
cd ..
git add mobile/app/settings.tsx
git commit -m "feat(mobile): add Settings screen with file path and iCloud toggle"
```

---

## Task 16: Final integration verification

- [ ] **Run mobile unit tests**

```bash
cd mobile
npm test
```

Expected: All tests in `src/__tests__/` pass (store.test.ts: 4 tests, nlParser.test.ts: 5 tests).

- [ ] **Run shared layer tests to confirm nothing broke**

```bash
cd ..
bun test
```

Expected: All existing shared + console tests still pass.

- [ ] **Start the Expo development server and verify iOS simulator launches**

```bash
cd mobile
npx expo start --ios
```

Expected: Metro bundler starts, iOS Simulator opens with the Focus screen visible (dark `#1A1A1A` background, bottom action bar). If tasks exist in the default todo.txt path, they appear in the focus list.

- [ ] **Smoke test each screen**

In the running simulator:
1. Tap `≡` → ViewSwitcher popover appears with all 5 views
2. Navigate to List → stats cards appear at top
3. Navigate to Search → text input auto-focuses, typing returns results
4. Navigate to Report → task counts shown
5. Navigate to Settings → file path displayed
6. Tap `+` → AddTaskModal opens; type a task; tap Add → task appears in list on next open
7. On Focus screen, swipe a task left → Done/Delete buttons revealed
8. Tap Done → task removed from focus list
9. Tap a task → task detail sheet slides up as formSheet; priority picker and action buttons present

- [ ] **Check that the CalendarHeader expands and collapses**

On Focus screen, tap the drag handle below the week strip → month grid animates open. Tap again → collapses back.

- [ ] **Fix any import errors surfaced by the simulator**

Common issues:
- `@shared/*` not resolving → verify `mobile/babel.config.js` has the `module-resolver` plugin and `mobile/metro.config.js` has `watchFolders` pointing to the workspace root
- Font not loading → verify `@expo-google-fonts/jetbrains-mono` is installed and the `expo-font` plugin in `app.json` points to the correct `.ttf` path
- Reanimated not working → verify `react-native-reanimated/plugin` is the **last** plugin in `babel.config.js`

- [ ] **Final commit**

```bash
cd ..
git add -A
git commit -m "feat(mobile): complete iOS app integration — all screens and components"
```

---

## Summary

After completing all tasks:

- `mobile/` is a fully functional Expo Router iOS app
- All screens implemented: Focus (with collapsible calendar), List, Search, Report, Settings, Task Detail sheet
- All task actions implemented: Done (swipe + sheet), Delete (swipe + sheet), Edit, Priority, Skip
- Add Task modal: natural language input (chrono-node) + structured form
- Business logic is 100% shared with the console CLI — zero duplication
- `mobile/src/store.ts` reads/writes `todo.txt` via `expo-file-system` with atomic tmp+rename
- iCloud sync: user points Settings file path to iCloud Drive; iOS handles sync
- Visual design: Braun/Bauhaus dark theme (`#1A1A1A` bg, `#E8461A` accent, JetBrains Mono task text)
