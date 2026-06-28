import api, { uploadImage } from './api';
import type {
  CommunityStats,
  FoodCheckResult,
  HealthCondition,
  PollScanResultResponse,
  QuickAnalyzeData,
  ScanFrontResponse,
  ScanHistoryItem,
  ScanResult,
  UserStats,
} from '../types';
import type { ScanHistoryDetailRow } from '../utils/scanHistorySnapshot';

export interface ScanBackPetFields {
  petName: string;
  petType: string;
  petBreed?: string;
  petAgeMonths?: string;
  petWeightKg?: string;
  petAllergies: string;
  petHealthConditions: string;
}

export async function scanFrontLabel(imageUri: string): Promise<ScanFrontResponse> {
  return uploadImage<ScanFrontResponse>('/scan/front', imageUri);
}

export { ApiUploadError } from './api';

export async function scanBackLabel(
  imageUri: string,
  pendingScanId: string,
  petFields: ScanBackPetFields
): Promise<unknown> {
  const fields: Record<string, string> = {
    petName: petFields.petName,
    petType: petFields.petType,
    petAllergies: petFields.petAllergies,
    petHealthConditions: petFields.petHealthConditions,
  };
  if (petFields.petBreed !== undefined) fields.petBreed = petFields.petBreed;
  if (petFields.petAgeMonths !== undefined) fields.petAgeMonths = petFields.petAgeMonths;
  if (petFields.petWeightKg !== undefined) fields.petWeightKg = petFields.petWeightKg;

  return uploadImage<unknown>(`/scan/back/${pendingScanId}`, imageUri, fields);
}

export async function quickAnalyze(data: QuickAnalyzeData): Promise<unknown> {
  const { data: res } = await api.post<unknown>('/scan/quick-analyze', data);
  return res;
}

export async function pollResult(scanId: string): Promise<PollScanResultResponse> {
  const { data } = await api.get<PollScanResultResponse>(`/scan/${scanId}/result`);
  return data;
}

export async function suggestIngredients(q: string, limit = 15): Promise<string[]> {
  const { data } = await api.get<{ suggestions: string[] }>('/scan/ingredient-suggest', {
    params: { q, limit },
  });
  return data.suggestions ?? [];
}

export interface ScanManualRequest {
  ingredientsText: string;
  /** Required from app for correct cache keys (healthy_food vs healthy_treats). */
  productType: 'food' | 'treats';
  productName?: string;
  petName: string;
  petType: string;
  petAllergies?: string[];
  petHealthConditions?: Pick<HealthCondition, 'condition_type' | 'severity' | 'notes'>[];
}

export async function scanManual(body: ScanManualRequest): Promise<ScanResult> {
  const { data } = await api.post<ScanResult>('/scan/manual', body);
  return data;
}

export interface ConfirmIngredientsRequest {
  pendingScanId?: string;
  ingredients: string[];
  petName: string;
  petType: string;
  petBreed?: string;
  petAgeMonths?: number;
  petWeightKg?: number;
  petHealthConditions?: string;
  productName?: string;
  brand?: string;
  productType?: string;
}

export async function confirmIngredients(body: ConfirmIngredientsRequest): Promise<unknown> {
  const { data } = await api.post<unknown>('/scan/confirm-ingredients', body);
  return data;
}

export interface FoodCheckOptions {
  petName?: string;
  petHealthConditions?: string;
}

export async function foodCheck(
  imageUri: string,
  petType: string,
  options?: FoodCheckOptions
): Promise<FoodCheckResult> {
  const fields: Record<string, string> = { petType };
  if (options?.petName !== undefined) fields.petName = options.petName;
  if (options?.petHealthConditions !== undefined) {
    fields.petHealthConditions = options.petHealthConditions;
  }

  return uploadImage<FoodCheckResult>('/scan/food-check', imageUri, fields);
}

export interface ScanHistoryParams {
  petName?: string;
  petType?: string;
  limit: number;
  offset: number;
}

export async function getHistory(params: ScanHistoryParams): Promise<ScanHistoryItem[]> {
  const { data } = await api.get<{ history: ScanHistoryItem[] } | ScanHistoryItem[]>('/scan/history', {
    params,
  });
  if (Array.isArray(data)) return data;
  return (data as { history: ScanHistoryItem[] }).history ?? [];
}

export async function getScanById(scanId: string): Promise<ScanHistoryDetailRow> {
  const { data } = await api.get<{ scan: ScanHistoryDetailRow }>(`/scan/${scanId}`);
  return data.scan;
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const { data } = await api.get<CommunityStats>('/scan/stats');
  return data;
}

export async function getUserStats(): Promise<UserStats> {
  const { data } = await api.get<UserStats>('/scan/user-stats');
  return data;
}
