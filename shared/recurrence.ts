const VALID_FREQUENCY = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const VALID_FREQ_DAY = new Set(['M', 'T', 'W', 'Th', 'F', 'Sat', 'Sun']);
const VALID_FREQ_MONTH = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const VALID_POSITIONS = new Set(['first', 'second', 'third', 'fourth', 'fifth', 'last']);
const VALID_DAY_TYPES = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'day', 'weekday', 'weekend-day']);

function extractFreqExts(text: string): Record<string, string> {
  const exts: Record<string, string> = {};
  for (const m of text.matchAll(/(?:^|\s)(\w[\w-]*):([^/\s]\S*)/g)) {
    exts[m[1]!] = m[2]!;
  }
  return exts;
}

export function validateFrequency(text: string): void {
  const exts = extractFreqExts(text);
  if (!('frequency' in exts)) return;

  const freq = exts['frequency']!;
  if (!VALID_FREQUENCY.has(freq)) {
    console.error(`todo: invalid frequency '${freq}'. Must be: daily, weekly, monthly, yearly`);
    process.exit(1);
  }

  if ('every' in exts) {
    const n = Number(exts['every']);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`todo: invalid every '${exts['every']}'. Must be a positive integer`);
      process.exit(1);
    }
  }

  if ('frequency-day' in exts) {
    for (const day of exts['frequency-day']!.split(',')) {
      if (!VALID_FREQ_DAY.has(day)) {
        console.error(`todo: invalid frequency-day value '${day}'. Must be: M, T, W, Th, F, Sat, Sun`);
        process.exit(1);
      }
    }
  }

  if ('frequency-month-day' in exts) {
    const val = exts['frequency-month-day']!;
    const asNum = Number(val);
    if (!isNaN(asNum)) {
      if (!Number.isInteger(asNum) || asNum < 1 || asNum > 31) {
        console.error(`todo: invalid frequency-month-day '${val}'. Day must be 1–31`);
        process.exit(1);
      }
    } else {
      const dashIdx = val.indexOf('-');
      const position = val.slice(0, dashIdx);
      const dayType = val.slice(dashIdx + 1);
      if (!VALID_POSITIONS.has(position) || !VALID_DAY_TYPES.has(dayType)) {
        console.error(`todo: invalid frequency-month-day '${val}'. Must be 1–31 or {first|second|third|fourth|fifth|last}-{monday|...|day|weekday|weekend-day}`);
        process.exit(1);
      }
    }
  }

  if ('frequency-month' in exts) {
    for (const month of exts['frequency-month']!.split(',')) {
      if (!VALID_FREQ_MONTH.has(month)) {
        console.error(`todo: invalid frequency-month '${month}'. Must be: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec`);
        process.exit(1);
      }
    }
  }
}
