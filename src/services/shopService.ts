import api from './api';

export interface ShopItem {
  id: string;
  category: 'hat' | 'glasses' | 'accessory' | 'clothes' | 'background' | 'effect';
  name: string;
  nameKo: string;
  price: number;
  assetKey: string;
  layerType: 'head' | 'eyes' | 'body' | 'background' | 'overlay';
  positionX: number;
  positionY: number;
  isSeasonal: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  isOwned: boolean;
}

export interface EquippedItem {
  id: string;
  assetKey: string;
  layerType: string;
  positionX: number;
  positionY: number;
  name: string;
  nameKo: string;
}

export type SlotName = 'hat' | 'glasses' | 'accessory' | 'clothes' | 'background' | 'effect';

export interface CharacterState {
  characterType: 'dog' | 'cat';
  equipped: Record<SlotName, EquippedItem | null>;
  ownedItems: string[];
}

export interface PurchaseResult {
  success: boolean;
  item: { id: string; category: string; name: string; nameKo: string; price: number; assetKey: string };
  newBalance: number;
}

const shopService = {
  async getItems(category?: string): Promise<ShopItem[]> {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    const { data } = await api.get<{ items: ShopItem[] }>('/shop/items', { params });
    return data.items;
  },

  async purchaseItem(itemId: string): Promise<PurchaseResult> {
    const { data } = await api.post<PurchaseResult>(`/shop/items/${itemId}/purchase`);
    return data;
  },

  async getCharacter(): Promise<CharacterState> {
    const { data } = await api.get<CharacterState>('/shop/character');
    return data;
  },

  async equipItem(slot: SlotName, itemId: string | null): Promise<{ success: boolean }> {
    const { data } = await api.put<{ success: boolean }>('/shop/character/equip', { slot, itemId });
    return data;
  },

  async switchCharacterType(characterType: 'dog' | 'cat'): Promise<{ success: boolean }> {
    const { data } = await api.put<{ success: boolean }>('/shop/character/type', { characterType });
    return data;
  },
};

export default shopService;
