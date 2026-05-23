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
