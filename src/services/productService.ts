import api from './api';
import type {
  AlternativeProduct,
  AlternativesRequest,
  CachedScore,
  HealthCondition,
  PetHealthConditionInput,
  Product,
  ProductFilterParams,
  ProductFilterResponse,
  ProductImageResponse,
  ScanResult,
} from '../types';

export async function searchProducts(
  query: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<Product[]> {
  const { data } = await api.get<Product[] | { products: Product[] }>('/products/search', {
    params: { q: query, ...params },
  });
  if (Array.isArray(data)) return data;
  return data.products ?? [];
}

function serializeFilterParams(params: ProductFilterParams): Record<string, unknown> {
  const { healthConditions, ...rest } = params;
  const out: Record<string, unknown> = { ...rest };
  if (healthConditions !== undefined) {
    out.healthConditions =
      typeof healthConditions === 'string' ? healthConditions : JSON.stringify(healthConditions);
  }
  return out;
}

export async function filterProducts(params: ProductFilterParams): Promise<ProductFilterResponse> {
  const { data } = await api.get<ProductFilterResponse>('/products/filter', {
    params: serializeFilterParams(params),
  });
  return data;
}

export async function batchScores(
  productIds: string[],
  petType: string,
  healthConditions?: PetHealthConditionInput[] | HealthCondition[]
): Promise<Record<string, CachedScore | number>> {
  const { data } = await api.post<{ scores: Record<string, CachedScore | number> }>(
    '/products/batch-scores',
    { productIds, petType, healthConditions }
  );
  return data.scores;
}

export interface AnalyzeProductParams {
  petName?: string;
  petType?: string;
  petBreed?: string;
  /** Optional age in years (backend `petAge` query). */
  petAge?: number;
  /** Optional age in months (backend `petAgeMonths` query, converted to years). */
  petAgeMonths?: number;
  petWeight?: number;
  healthConditions?: unknown;
}

function serializeAnalyzeParams(params?: AnalyzeProductParams): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const { healthConditions, ...rest } = params;
  const out: Record<string, unknown> = { ...rest };
  if (healthConditions !== undefined) {
    out.healthConditions =
      typeof healthConditions === 'string' ? healthConditions : JSON.stringify(healthConditions);
  }
  return out;
}

export async function analyzeProduct(
  productId: string,
  params?: AnalyzeProductParams
): Promise<ScanResult> {
  const { data } = await api.get<ScanResult>(`/products/${productId}/analyze`, {
    params: serializeAnalyzeParams(params),
  });
  return data;
}

export async function getCachedReview(
  productId: string,
  params?: AnalyzeProductParams
): Promise<ScanResult> {
  const { data } = await api.get<ScanResult>(`/products/${productId}/cached-review`, {
    params: serializeAnalyzeParams(params),
  });
  return data;
}

export async function getAlternatives(
  productId: string,
  data: AlternativesRequest
): Promise<AlternativeProduct[]> {
  const { data: res } = await api.post<
    AlternativeProduct[] | { alternatives: AlternativeProduct[] }
  >(`/products/${productId}/alternatives`, data);
  if (Array.isArray(res)) return res;
  return res.alternatives ?? [];
}

export async function getProductImage(productId: string): Promise<ProductImageResponse> {
  const { data } = await api.get<ProductImageResponse>(`/products/${productId}/image`);
  return data;
}

/**
 * TEST-ONLY: hard-delete a product from the backend DB.
 *
 * Used during the OCR-tuning phase so we can purge a row when ingredient
 * extraction was clearly wrong. Backend cascades to product_ingredients /
 * alternatives / reviews and also clears the matching product_review_cache
 * entries (so a future scan with the same ingredient_hash doesn't reuse a
 * stale holistic AI review).
 */
export interface DeleteProductResponse {
  success: boolean;
  deleted: {
    productId: string;
    name: string | null;
    brand: string | null;
    ingredientHash: string | null;
    reviewCacheRowsDeleted: number;
  };
}

export async function deleteProduct(productId: string): Promise<DeleteProductResponse> {
  const { data } = await api.delete<DeleteProductResponse>(`/products/${productId}`);
  return data;
}
