import api from './api';

export type MealSlot = 'morning' | 'lunch' | 'evening' | 'snack';
export type AppetiteValue = 'low' | 'normal' | 'high';
export type ItchValue = 'scratching' | 'licking' | 'none';
export type VomitValue = 'food' | 'yellow' | 'none';

export interface DailyLogInput {
  logType: 'meal' | 'health';
  localDate: string;
  mealSlot?: MealSlot | null;
  appetite?: AppetiteValue | null;
  stoolScore?: number | null;
  itching?: ItchValue | null;
  vomiting?: VomitValue | null;
  notes?: string | null;
}

export interface DailyLog {
  id: string;
  date: string;
  loggedAt: string | null;
  logType: 'meal' | 'health';
  mealSlot: MealSlot | null;
  stoolScore: number | null;
  appetite: AppetiteValue | null;
  vomiting: VomitValue | null;
  itching: ItchValue | null;
  notes: string | null;
  foodName: string | null;
  foodImageUrl: string | null;
}

export interface CheckinResult {
  checkin: DailyLog;
  tokensAwarded: number;
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    streakBonus: number;
  };
}

export type CheckinEntry = DailyLog;

const checkinService = {
  async saveLog(petId: string, data: DailyLogInput): Promise<CheckinResult> {
    const { data: result } = await api.post<CheckinResult>(`/pets/${petId}/checkins`, data);
    return result;
  },

  async getCheckins(petId: string, from?: string, to?: string): Promise<{ checkins: DailyLog[] }> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await api.get<{ checkins: DailyLog[] }>(`/pets/${petId}/checkins`, { params });
    return data;
  },

  async getRecent(petId: string, limit = 2): Promise<{ checkins: DailyLog[] }> {
    const { data } = await api.get<{ checkins: DailyLog[] }>(`/pets/${petId}/checkins`, { params: { recent: String(limit) } });
    return data;
  },
};

export default checkinService;
