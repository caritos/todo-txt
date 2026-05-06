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

function mapRrule(rrule: ICAL.Recur): string[] {
  const FREQ_MAP: Record<string, string> = {
    DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly',
  };
  const freq = FREQ_MAP[rrule.freq];
  if (!freq) return [];

  const parts: string[] = [`frequency:${freq}`];

  if (rrule.interval && rrule.interval > 1) parts.push(`every:${rrule.interval}`);

  if (rrule.until) parts.push(`recur-until:${rrule.until.toString().slice(0, 10)}`);

  const byday = rrule.parts['BYDAY'] as string[] | undefined;
  if (byday && byday.length > 0) {
    const match = String(byday[0]).match(/^(-?\d+)([A-Z]+)$/);
    if (match) {
      const pos = parseInt(match[1]!);
      const dayCode = match[2]!;
      const position = positionName(pos);
      const dayName = BYDAY_FULL[dayCode];
      if (position && dayName) parts.push(`frequency-month-day:${position}-${dayName}`);
    } else {
      const days = byday.map(d => BYDAY_SHORT[String(d)]).filter((d): d is string => d !== undefined);
      if (days.length > 0) parts.push(`frequency-day:${days.join(',')}`);
    }
  } else {
    const bymonthday = rrule.parts['BYMONTHDAY'] as number[] | undefined;
    if (bymonthday && bymonthday.length > 0) parts.push(`frequency-month-day:${bymonthday[0]}`);
  }

  const bymonth = rrule.parts['BYMONTH'] as number[] | undefined;
  if (bymonth && bymonth.length > 0) {
    const months = bymonth.map(m => MONTH_NAMES[m - 1]).filter((m): m is string => m !== undefined);
    if (months.length > 0) parts.push(`frequency-month:${months.join(',')}`);
  }

  return parts;
}

function mapVevent(vevent: ICAL.Component, todayStr: string): string | null {
  try {
    const event = new ICAL.Event(vevent);
    const summary = event.summary;
    if (!summary) return null;

    const parts: string[] = [todayStr, summary];

    const dtstart = event.startDate;
    if (dtstart) parts.push(`start:${formatIcalTime(dtstart)}`);

    const dtend = event.endDate;
    if (dtend && dtstart) {
      const isSingleAllDay =
        dtstart.isDate && dtend.isDate &&
        dtend.toJSDate().getTime() - dtstart.toJSDate().getTime() === 86400000;
      if (!isSingleAllDay) parts.push(`end:${formatIcalTime(dtend)}`);
    }

    const rruleProp = vevent.getFirstPropertyValue('rrule') as ICAL.Recur | null;
    if (rruleProp) parts.push(...mapRrule(rruleProp));

    parts.push(`type:${detectType(summary)}`);

    return parts.join(' ');
  } catch {
    return null;
  }
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
