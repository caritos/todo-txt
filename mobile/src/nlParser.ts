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

  const priorityMatch = input.match(/\(([A-Z])\)/);
  const priority = priorityMatch?.[1];
  let text = input.replace(/\s*\([A-Z]\)\s*/g, ' ').trim();

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

  const parts: string[] = [];
  if (priority) parts.push(`(${priority})`);
  parts.push(todayStr);
  parts.push(text);
  if (startDate) parts.push(`start:${startDate}`);

  return { raw: parts.join(' '), text, priority, startDate };
}
