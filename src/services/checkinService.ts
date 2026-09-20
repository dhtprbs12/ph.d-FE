import api from './api';

export interface CheckinData {
  stoolScore: number;   // 1-5
  appetite: 'low' | 'normal' | 'high';
  vomiting: boolean;
  itching: boolean;
  notes?: string;
  localDate: string;    // YYYY-MM-DD from device
}

export interface CheckinResult {
  checkin: {
    id: string;
    petId: string;
    date: string;
    stoolScore: number;
    appetite: string;
    vomiting: boolean;
    itching: boolean;
    notes: string | null;
  };
  tokensAwarded: number;
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    streakBonus: number;
  };
  updated?: boolean;
}

export interface CheckinEntry {
  id: string;
  date: string;
  stoolScore: number;
  appetite: string;
  vomiting: boolean;
  itching: boolean;
  notes: string | null;
  foodName: string | null;
  foodImageUrl: string | null;
}

export interface CheckinSummary {
  avgStoolScore: number;
  vomitCount: number;
  itchCount: number;
  totalCheckins: number;
  period: string;
}

const checkinService = {
  async saveCheckin(petId: string, data: CheckinData): Promise<CheckinResult> {
    const { data: result } = await api.post<CheckinResult>(`/pets/${petId}/checkins`, data);
    return result;
  },

  async getCheckins(petId: string, from?: string, to?: string): Promise<{ checkins: CheckinEntry[] }> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await api.get<{ checkins: CheckinEntry[] }>(`/pets/${petId}/checkins`, { params });
    return data;
  },

  async getSummary(petId: string): Promise<{ summary: CheckinSummary | null; checkinCount: number }> {
    const { data } = await api.get<{ summary: CheckinSummary | null; checkinCount: number }>(`/pets/${petId}/checkins/summary`);
    return data;
  },
};

export default checkinService;
