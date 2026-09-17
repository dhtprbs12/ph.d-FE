import api from './api';

export interface NoteEntry {
  date: string; // YYYY-MM-DD
  note: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
}

const notesService = {
  async getNotes(petId: string, from?: string, to?: string): Promise<NoteEntry[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await api.get<{ notes: NoteEntry[] }>(`/pets/${petId}/notes`, { params });
    return data.notes;
  },

  async upsertNote(petId: string, date: string, note: string): Promise<void> {
    await api.put(`/pets/${petId}/notes/${date}`, { note });
  },

  async getStreak(petId: string): Promise<StreakInfo> {
    const { data } = await api.get<StreakInfo>(`/pets/${petId}/streak`);
    return data;
  },
};

export default notesService;
