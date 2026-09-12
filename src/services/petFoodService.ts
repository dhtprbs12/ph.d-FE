import api from './api';

export interface CurrentFood {
  id: string;
  productId: string | null;
  scanId: string | null;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  barcode: string | null;
  startedAt: string;
  daysOnFood: number;
}

export interface FoodHistoryItem {
  id: string;
  productId: string | null;
  scanId: string | null;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  isCurrent: boolean;
  startedAt: string;
  endedAt: string | null;
  days: number;
}

const petFoodService = {
  async getCurrentFood(petId: string): Promise<CurrentFood | null> {
    const { data } = await api.get<{ currentFood: CurrentFood | null }>(`/pets/${petId}/current-food`);
    return data.currentFood;
  },

  async setCurrentFood(petId: string, params: {
    productId?: string;
    scanId?: string;
    productName: string;
    brand?: string;
  }): Promise<CurrentFood> {
    const { data } = await api.post<{ currentFood: CurrentFood }>(`/pets/${petId}/current-food`, params);
    return data.currentFood;
  },

  async changeFood(petId: string, params: {
    productId?: string;
    scanId?: string;
    productName: string;
    brand?: string;
  }): Promise<CurrentFood> {
    const { data } = await api.put<{ currentFood: CurrentFood }>(`/pets/${petId}/current-food`, params);
    return data.currentFood;
  },

  async getFoodHistory(petId: string): Promise<FoodHistoryItem[]> {
    const { data } = await api.get<{ history: FoodHistoryItem[] }>(`/pets/${petId}/food-history`);
    return data.history;
  },
};

export default petFoodService;
