import type { DailyLog } from '../services/checkinService';

export function appetiteLabel(value?: string | null): string | null {
  if (value === 'high') return 'Great';
  if (value === 'normal') return 'Normal';
  if (value === 'low') return 'Picky';
  return null;
}

export function itchLabel(value?: string | null): string | null {
  if (value === 'scratching') return 'Scratching';
  if (value === 'licking') return 'Licking';
  return null;
}

export function vomitLabel(value?: string | null): string | null {
  if (value === 'food') return 'Food Vomit';
  if (value === 'yellow') return 'Yellow vomit';
  return null;
}

export function stoolLabel(score?: number | null): string | null {
  const names = ['', 'Very Bad', 'Bad', 'Normal', 'Good', 'Great'];
  if (!score || score < 1 || score > 5) return null;
  return `${score} ${names[score]}`;
}

export function logSummary(entry: DailyLog): string {
  if (entry.logType === 'meal') {
    const slot = entry.mealSlot ? `${entry.mealSlot[0].toUpperCase()}${entry.mealSlot.slice(1)} meal` : 'Meal';
    const appetite = appetiteLabel(entry.appetite);
    return appetite ? `${slot} · ${appetite}` : slot;
  }
  const parts = [stoolLabel(entry.stoolScore), itchLabel(entry.itching), vomitLabel(entry.vomiting)].filter(Boolean);
  if (entry.notes && parts.length === 0) return 'Note';
  return parts.join(' · ') || 'Health';
}

export function isVomitLog(entry: DailyLog): boolean {
  return entry.vomiting === 'food' || entry.vomiting === 'yellow';
}
