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
  return names[score];
}

const MEAL_LINE: Record<string, string> = {
  morning: '☀️ Morning Meal Logged',
  lunch: '🍖 Lunch Meal Logged',
  evening: '🌙 Evening Meal Logged',
  snack: '🍪 Snack Meal Logged',
};

export function logSummary(entry: DailyLog): string {
  if (entry.logType === 'meal') {
    const title = (entry.mealSlot && MEAL_LINE[entry.mealSlot]) || 'Meal Logged';
    const appetite = appetiteLabel(entry.appetite);
    return appetite ? `${title} (Appetite: ${appetite})` : title;
  }

  const bits: string[] = [];
  const stool = stoolLabel(entry.stoolScore);
  if (stool) bits.push(`💩 Poop Status Logged (${stool})`);
  const itch = itchLabel(entry.itching);
  if (itch) bits.push(itch === 'Licking' ? `👅 ${itch}` : `🐾 ${itch}`);
  const vomit = vomitLabel(entry.vomiting);
  if (vomit) bits.push(`🤮 Vomit Alert! (${vomit})`);
  return bits.join(' · ') || 'Health';
}

function laterLog(current: DailyLog | null, row: DailyLog): DailyLog {
  if (!current) return row;
  return String(row.loggedAt || '') > String(current.loggedAt || '') ? row : current;
}

export function latestMealAndHealth(rows: DailyLog[]): DailyLog[] {
  let meal: DailyLog | null = null;
  let health: DailyLog | null = null;
  for (const row of rows) {
    if (row.logType === 'meal') meal = laterLog(meal, row);
    else health = laterLog(health, row);
  }
  return [meal, health]
    .filter((row): row is DailyLog => row != null)
    .sort((a, b) => String(b.loggedAt || '').localeCompare(String(a.loggedAt || '')));
}

export function isVomitLog(entry: DailyLog): boolean {
  return entry.vomiting === 'food' || entry.vomiting === 'yellow';
}
