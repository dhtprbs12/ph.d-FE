import api from './api';

export interface TimelineEntry {
  id: string;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  isCurrent: boolean;
  startedAt: string;
  endedAt: string | null;
  daysOnFood: number;
  stats: {
    checkinCount: number;
    avgStoolScore: number | null;
    vomitCount: number;
    itchCount: number;
  };
  hasIngredients: boolean;
}

export interface InsightData {
  ingredient: string;
  label: string;
  type: 'itch_correlation' | 'stool_negative' | 'stool_positive' | 'mixed';
  summary: string;
  data: {
    withIngredient: { foods: string[]; avgItchRate: number; avgStoolScore: number };
    withoutIngredient: { foods: string[]; avgItchRate: number; avgStoolScore: number };
  };
  disclaimer: string;
}

const passportService = {
  async getPassport(petId: string): Promise<{ timeline: TimelineEntry[] }> {
    const { data } = await api.get<{ timeline: TimelineEntry[] }>(`/pets/${petId}/passport`);
    return data;
  },

  async getInsights(petId: string): Promise<{ insights: InsightData[]; message?: string }> {
    const { data } = await api.get<{ insights: InsightData[]; message?: string }>(`/pets/${petId}/insights`);
    return data;
  },
};

export default passportService;
