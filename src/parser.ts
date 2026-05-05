const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_RE = /^\([A-Z]\)$/;

export type Task = {
  line: number;
  raw: string;
  done: boolean;
  completionDate?: string;
  priority?: string;
  creationDate?: string;
  text: string;
  projects: string[];
  contexts: string[];
  extensions: Record<string, string>;
};

export function parseLine(raw: string, lineNum: number): Task {
  const tokens = raw.split(' ');
  let i = 0;
  let done = false;
  let completionDate: string | undefined;
  let priority: string | undefined;
  let creationDate: string | undefined;

  if (tokens[i] === 'x') {
    done = true;
    i++;
    if (tokens[i] && DATE_RE.test(tokens[i]!)) {
      completionDate = tokens[i++];
    }
  } else if (PRIORITY_RE.test(tokens[i] ?? '')) {
    priority = tokens[i++]![1]!;
  }

  if (DATE_RE.test(tokens[i] ?? '')) {
    creationDate = tokens[i++];
  }

  const text = tokens.slice(i).join(' ');
  const projects = [...text.matchAll(/(?:^|\s)(\+\S+)/g)].map(m => m[1]!);
  const contexts = [...text.matchAll(/(?:^|\s)(@\S+)/g)].map(m => m[1]!);
  const extensions: Record<string, string> = {};
  for (const m of text.matchAll(/(?:^|\s)(\w+):(\S+)/g)) {
    extensions[m[1]!] = m[2]!;
  }

  return { line: lineNum, raw, done, completionDate, priority, creationDate, text, projects, contexts, extensions };
}
