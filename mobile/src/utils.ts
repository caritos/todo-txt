const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function isoDate(d: Date): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

export function sectionHeader(dateStr: string, todayStr: string): string {
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
