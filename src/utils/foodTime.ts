function parseFoodInstant(raw?: string | null): Date | null {
  if (!raw) return null;
  const text = String(raw);
  const hasTime = text.includes('T') || text.includes(' ');
  const date = new Date(hasTime ? text.replace(' ', 'T') : `${text.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function calendarDaysOnFood(startedAt?: string | null, endedAt?: string | null, isCurrent = false): number {
  const start = parseFoodInstant(startedAt);
  if (!start) return 1;
  const end = !endedAt || isCurrent ? new Date() : parseFoodInstant(endedAt);
  if (!end) return 1;
  const diff = Math.round((startOfLocalDay(end) - startOfLocalDay(start)) / 86400000);
  return Math.max(1, diff + 1);
}

export function formatFoodDay(raw?: string | null): string | null {
  const date = parseFoodInstant(raw);
  if (!date) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function phoneYmd(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatLogTime(raw?: string | null): string {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
