const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildCells(year: number, month: number, weekStart: 0 | 1 = 0): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').replace(/(?:^|\s)%birthday\b/gi, '').trim();
}

export function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return 'noon';
  return `${h - 12} PM`;
}

export function formatTime(hours: number, minutes: number): string {
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export function parseDateParts(dateStr: string): { month: string; day: number; year: number; dayName: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    month: MONTH_NAMES[d.getMonth()],
    day: d.getDate(),
    year: d.getFullYear(),
    dayName: DAY_NAMES[d.getDay()].toUpperCase(),
  };
}

export function formatMonthDayNumeric(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function timeMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function defaultEndTime(start: Date): Date {
  const mins = Math.min(timeMinutes(start) + 60, 23 * 60 + 59);
  const d = new Date(start);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}
