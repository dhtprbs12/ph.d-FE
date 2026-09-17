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

let _characterCache: Record<string, CharacterState> = {};
const _itemsCache: Record<string, ShopItem[]> = {};

const shopService = {
  async getItems(category?: string): Promise<ShopItem[]> {
    const key = category || '_all';
    if (_itemsCache[key]) {
      const cached = _itemsCache[key];
      const params: Record<string, string> = {};
      if (category) params.category = category;
      api.get<{ items: ShopItem[] }>('/shop/items', { params })
        .then(({ data }) => { _itemsCache[key] = data.items; })
        .catch(() => {});
      return cached;
    }
    const params: Record<string, string> = {};
    if (category) params.category = category;
    const { data } = await api.get<{ items: ShopItem[] }>('/shop/items', { params });
    _itemsCache[key] = data.items;
    return data.items;
  },

  getCachedItems(category?: string): ShopItem[] | null {
    const key = category || '_all';
    return _itemsCache[key] || null;
  },

  async purchaseItem(itemId: string): Promise<PurchaseResult> {
    const { data } = await api.post<PurchaseResult>(`/shop/items/${itemId}/purchase`);
    _characterCache = {};
    Object.keys(_itemsCache).forEach(k => delete _itemsCache[k]);
    return data;
  },

  async getCharacter(petId: string): Promise<CharacterState> {
    if (_characterCache[petId]) {
      api.get<CharacterState>(`/shop/character/${petId}`)
        .then(({ data }) => { _characterCache[petId] = data; })
        .catch(() => {});
      return _characterCache[petId];
    }
    const { data } = await api.get<CharacterState>(`/shop/character/${petId}`);
    _characterCache[petId] = data;
    return data;
  },

  invalidateCharacterCache() {
    _characterCache = {};
  },

  getCachedCharacter(petId: string): CharacterState | null {
    return _characterCache[petId] || null;
  },

  async equipItem(petId: string, slot: SlotName, itemId: string | null): Promise<{ success: boolean }> {
    const { data } = await api.put<{ success: boolean }>(`/shop/character/${petId}/equip`, { slot, itemId });
    return data;
  },

  async switchCharacterType(petId: string, characterType: 'dog' | 'cat'): Promise<{ success: boolean }> {
    const { data } = await api.put<{ success: boolean }>(`/shop/character/${petId}/type`, { characterType });
    delete _characterCache[petId];
    return data;
  },
};

export default shopService;
