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
  productName: string;
  brand: string;
  grade: string;
  score: number;
  petType: string;
  timeAgo: string;
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const { data } = await api.get<{ activity: RecentActivity[] }>('/community/recent-activity');
  return data.activity ?? [];
}
