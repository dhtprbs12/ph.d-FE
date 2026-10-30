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

export interface InsightGroupData {
  foods: { name: string; isCurrent: boolean; imageUrl?: string | null }[];
  avgItchRate: number;
  avgVomitRate: number;
  avgStoolScore: number;
}

export interface InsightFoodRecord {
  name: string;
  isCurrent: boolean;
  imageUrl?: string | null;
  dietTags?: string | null;
  lifeStage?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  primaryProteins?: string | null;
  ingredients?: string | null;
  avgStool: number | null;
  itchDays: number;
  vomitDays: number;
}

export interface SingleFoodData {
  food: InsightFoodRecord & { checkinCount: number };
  topSources: { source: string; category: string }[];
  hasSymptom: boolean;
  suspectSources: string[];
}

export interface InsightData {
  ingredient: string;
  label: string;
  type: 'itch_correlation' | 'vomit_correlation' | 'stool_negative' | 'stool_positive' | 'mixed' | 'single_food';
  summary: string;
  singleFood?: boolean;
  data?: {
    withIngredient?: InsightGroupData;
    withoutIngredient?: InsightGroupData;
    records?: InsightFoodRecord[];
    food?: SingleFoodData['food'];
    topSources?: SingleFoodData['topSources'];
    hasSymptom?: boolean;
    suspectSources?: string[];
  };
  disclaimer: string;
}

export interface InsightAlternative {
  id: string;
  name: string;
  brand?: string | null;
  manufacturer?: string | null;
  life_stage?: string | null;
  image_url?: string | null;
  avoids?: string[] | 'all';
}

const passportService = {
  async getPassport(petId: string): Promise<{ timeline: TimelineEntry[] }> {
    const { data } = await api.get<{ timeline: TimelineEntry[] }>(`/pets/${petId}/passport`);
    return data;
  },

  async getInsights(petId: string): Promise<{
    insights: InsightData[];
    singleFoodInsight?: InsightData;
    plus?: boolean;
    message?: string;
    petName?: string;
    petType?: string;
    foodCount?: number;
  }> {
    const { data } = await api.get(`/pets/${petId}/insights`);
    return data as any;
  },

  async getInsightAlternatives(petId: string, sources: string[]): Promise<{ alternatives: InsightAlternative[] }> {
    const { data } = await api.get(`/pets/${petId}/insights/alternatives`, { params: { sources: sources.join(',') } });
    return data as any;
  },
};

export default passportService;
