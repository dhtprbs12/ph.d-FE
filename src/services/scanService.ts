import api from './api';
import { uploadImage } from './api';
import type {
  CommunityStats,
  FoodCheckResult,
  PollScanResultResponse,
  QuickAnalyzeData,
  ScanFrontResponse,
  ScanHistoryItem,
  UserStats,
} from '../types';

export interface ScanBackPetFields {
  petName: string;
  petType: string;
  petBreed?: string;
  petAgeMonths?: string;
  petWeightKg?: string;
  petAllergies: string;
  petHealthConditions: string;
  deviceId: string;
}

export async function scanFrontLabel(imageUri: string): Promise<ScanFrontResponse> {
  return uploadImage<ScanFrontResponse>('/scan/front', imageUri);
}

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
    deviceId: petFields.deviceId,
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

export interface FoodCheckOptions {
  petName?: string;
  petHealthConditions?: string;
  deviceId?: string;
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
  if (options?.deviceId !== undefined) fields.deviceId = options.deviceId;

  return uploadImage<FoodCheckResult>('/scan/food-check', imageUri, fields);
}

export interface ScanHistoryParams {
  deviceId: string;
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

export async function getCommunityStats(): Promise<CommunityStats> {
  const { data } = await api.get<CommunityStats>('/scan/stats');
  return data;
}

export async function getUserStats(deviceId: string): Promise<UserStats> {
  const { data } = await api.get<UserStats>('/scan/user-stats', {
    headers: { 'x-device-id': deviceId },
  });
  return data;
}
