import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

describe('import command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  function writeIcs(name: string, lines: string[]): string {
    const path = join(dir, name);
    writeFileSync(path, lines.join('\r\n') + '\r\n', 'utf8');
    return path;
  }

  test('exits with error if no ics file argument given', () => {
    const { stderr, code } = run(['--file', todoFile, 'import']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if ics file does not exist', () => {
    const { stderr, code } = run(['--file', todoFile, 'import', '/nonexistent/path.ics']);
    expect(code).toBe(1);
    expect(stderr).toContain('No such file');
  });

  test('exits with error if file is not valid ICS', () => {
    const badPath = join(dir, 'bad.ics');
    writeFileSync(badPath, 'this is not ics content', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', badPath]);
    expect(code).toBe(1);
    expect(stderr).toContain('does not appear to be a valid ICS file');
  });

  test('exits with error if ICS file has no VEVENT components', () => {
    const emptyIcs = join(dir, 'empty.ics');
    writeFileSync(emptyIcs, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//Test//EN\r\nEND:VCALENDAR\r\n', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', emptyIcs]);
    expect(code).toBe(1);
    expect(stderr).toContain('no events found');
  });

  test('imports SUMMARY as task text', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team meeting',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('Team meeting');
  });

  test('imports all-day single-day event with start: and no end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Holiday',
      'DTSTART;VALUE=DATE:20260510',
      'DTEND;VALUE=DATE:20260511',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).not.toContain('end:');
  });

  test('imports all-day multi-day event with start: and end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Conference',
      'DTSTART;VALUE=DATE:20260510',
      'DTEND;VALUE=DATE:20260513',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).toContain('end:2026-05-13');
  });

  test('imports timed event with datetime start: and end:', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Standup',
      'DTSTART:20260506T140000Z',
      'DTEND:20260506T143000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/start:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(content).toMatch(/end:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  test('auto-detects type:birthday from SUMMARY containing "Birthday"', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      "SUMMARY:Claire's Birthday",
      'DTSTART;VALUE=DATE:20261023',
      'DTEND;VALUE=DATE:20261024',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:birthday');
    expect(content).not.toContain('type:event');
  });

  test('auto-detects type:anniversary from SUMMARY containing "Anniversary"', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Wedding Anniversary',
      'DTSTART;VALUE=DATE:20261023',
      'DTEND;VALUE=DATE:20261024',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:anniversary');
    expect(content).not.toContain('type:event');
  });

  test('defaults to type:event for regular events', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Basketball practice',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    run(['--file', todoFile, 'import', icsPath]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:event');
    expect(content).not.toContain('type:birthday');
    expect(content).not.toContain('type:anniversary');
  });

  test('prints import count on success', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Team meeting',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    const { stdout, code } = run(['--file', todoFile, 'import', icsPath]);
    expect(code).toBe(0);
    expect(stdout).toContain('Imported 1 event');
  });

  test('skips malformed event and imports the rest', () => {
    const icsPath = writeIcs('t.ics', [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Valid event',
      'DTSTART;VALUE=DATE:20260506',
      'DTEND;VALUE=DATE:20260507',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    const { code } = run(['--file', todoFile, 'import', icsPath]);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('Valid event');
  });
});
