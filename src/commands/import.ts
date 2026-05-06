import { readFileSync, appendFileSync } from 'fs';
import ICAL from 'ical.js';
import { today } from '../output';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const BYDAY_SHORT: Record<string, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'Th', FR: 'F', SA: 'Sat', SU: 'Sun',
};

const BYDAY_FULL: Record<string, string> = {
  MO: 'monday', TU: 'tuesday', WE: 'wednesday', TH: 'thursday',
  FR: 'friday', SA: 'saturday', SU: 'sunday',
};

function positionName(n: number): string | undefined {
  if (n === -1) return 'last';
  const names = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
  return n >= 1 && n <= 5 ? names[n - 1] : undefined;
}

function formatIcalTime(t: ICAL.Time): string {
  if (t.isDate) return t.toString();
  const js = t.toJSDate();
  const yyyy = js.getFullYear();
  const mm = String(js.getMonth() + 1).padStart(2, '0');
  const dd = String(js.getDate()).padStart(2, '0');
  const hh = String(js.getHours()).padStart(2, '0');
  const min = String(js.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function sanitizeExtValue(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\w@._:,/-]/g, '').slice(0, 200);
}

function detectType(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes('birthday')) return 'birthday';
  if (lower.includes('anniversary')) return 'anniversary';
  return 'event';
}

function mapRrule(_rrule: ICAL.Recur): string[] {
  return []; // implemented in Task 5
}

function mapVevent(_vevent: ICAL.Component, _todayStr: string): string | null {
  return null; // implemented in Task 4
}

export function importCommand(filePath: string, args: string[]): void {
  const icsPath = args[0];
  if (!icsPath) {
    console.error('Usage: todo import <ics-file>');
    process.exit(1);
  }

  let icsData: string;
  try {
    icsData = readFileSync(icsPath, 'utf8');
  } catch {
    console.error(`todo: cannot open '${icsPath}': No such file or directory`);
    process.exit(1);
  }

  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(icsData));
  } catch {
    console.error(`todo: '${icsPath}' does not appear to be a valid ICS file`);
    process.exit(1);
  }

  const vevents = comp.getAllSubcomponents('vevent');
  if (vevents.length === 0) {
    console.error(`todo: no events found in '${icsPath}'`);
    process.exit(1);
  }

  const todayStr = today();
  const lines: string[] = [];

  for (const vevent of vevents) {
    const line = mapVevent(vevent, todayStr);
    if (line === null) {
      console.error(`todo: skipping malformed event`);
    } else {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    console.error(`todo: no valid events found in '${icsPath}'`);
    process.exit(1);
  }

  appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');

  const basename = icsPath.split('/').pop() ?? icsPath;
  console.log(`Imported ${lines.length} event${lines.length === 1 ? '' : 's'} from ${basename} → ${filePath}`);
}
