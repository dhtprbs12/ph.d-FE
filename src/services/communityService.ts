import api from './api';

export interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  product_type: string;
  image_url: string | null;
  target_pet_type: string;
  score: number | null;
  weekly_scans: number;
}

export interface FeedCard {
  save_id: string;
  saved_at: string;
  nickname: string;
  pet_photo: string | null;
  pet_type: string | null;
  breed: string | null;
  pet_name: string | null;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_image: string | null;
  product_type: string;
  score: number | null;
}

export interface SavedProduct {
  id: string;
  saved_at: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_image: string | null;
  product_type: string;
  score: number | null;
}

export async function getTrending(
  type: 'food' | 'treats',
  petType?: 'dog' | 'cat'
): Promise<TrendingProduct[]> {
  const { data } = await api.get<{ trending: TrendingProduct[] }>(
    '/community/trending',
    { params: { type, petType } }
  );
  return data.trending ?? [];
}

export async function getFeed(
  offset = 0,
  limit = 20
): Promise<{ feed: FeedCard[]; hasMore: boolean }> {
  const { data } = await api.get<{ feed: FeedCard[]; hasMore: boolean }>(
    '/community/feed',
    { params: { offset, limit } }
  );
  return data;
}

export async function saveProduct(productId: string): Promise<void> {
  await api.post(`/community/save/${productId}`);
}

export async function unsaveProduct(productId: string): Promise<void> {
  await api.delete(`/community/save/${productId}`);
}

export async function checkSaved(productId: string): Promise<boolean> {
  const { data } = await api.get<{ saved: boolean }>(
    `/community/save/check/${productId}`
  );
  return data.saved;
}

export async function getMySaved(): Promise<SavedProduct[]> {
  const { data } = await api.get<{ saved: SavedProduct[] }>('/community/my-saved');
  return data.saved ?? [];
}

export interface RecentActivity {
  nickname: string;
  petName: string | null;
  productName: string;
  brand: string;
  productImage: string | null;
  grade: string;
  score: number;
  petType: string;
  timeAgo: string;
}

export async function getRecentActivity(petType?: string): Promise<RecentActivity[]> {
  const { data } = await api.get<{ activity: RecentActivity[] }>('/community/recent-activity', {
    params: petType ? { petType } : undefined,
  });
  return data.activity ?? [];
}

export interface EquippedItemDetail {
  id: string;
  assetKey: string;
  layerType: string;
  positionX: number;
  positionY: number;
  name: string;
}

export interface PetOfTheWeekItem {
  rank: number;
  petId: string;
  petName: string;
  petType: string;
  breed: string | null;
  nickname: string;
  characterType: string;
  equipped: {
    hat: EquippedItemDetail | null;
    glasses: EquippedItemDetail | null;
    accessory: EquippedItemDetail | null;
    clothes: EquippedItemDetail | null;
    background: EquippedItemDetail | null;
    effect: EquippedItemDetail | null;
  };
  itemCount: number;
}

export async function getPetOfTheWeek(petType?: string): Promise<PetOfTheWeekItem[]> {
  const { data } = await api.get<{ pets: PetOfTheWeekItem[] }>('/community/pet-of-the-week', {
    params: petType ? { petType } : undefined,
  });
  return data.pets ?? [];
}

export interface BreedPopularResult {
  breed: string;
  petType: string;
  parentCount: number;
  foods: {
    productId: string;
    name: string;
    brand: string;
    imageUrl: string | null;
    score: number | null;
    userCount: number;
  }[];
}

export async function getBreedPopular(petType: string, breed?: string): Promise<BreedPopularResult> {
  const params: Record<string, string> = { petType };
  if (breed) params.breed = breed;
  const { data } = await api.get<BreedPopularResult>('/community/breed-popular', { params });
  return data;
}

export interface TopScanner {
  rank: number;
  nickname: string;
  weeklyScans: number;
  streak: number;
  level: number;
  totalScans: number;
  badge: string;
}

export async function getTopScanners(petType?: string): Promise<TopScanner[]> {
  const { data } = await api.get<{ scanners: TopScanner[] }>('/community/top-scanners', {
    params: petType ? { petType } : undefined,
  });
  return data.scanners ?? [];
}
