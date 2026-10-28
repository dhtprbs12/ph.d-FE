import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ScanResult } from '../types';

const BASE_URL = 'https://phd-be-production.up.railway.app/api';
const AUTH_TOKEN_KEY = 'authToken';

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export interface LookupSummary {
  id: string;
  status: 'queued' | 'searching' | 'needs_choice' | 'ready' | 'failed';
  brand?: string | null;
  queryName?: string | null;
  entry: 'name' | 'photo';
  petName?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface LookupDetail extends LookupSummary {
  productId?: string | null;
  scanResult?: ScanResult | null;
  tokensAwarded?: number;
  frontImageUrl?: string | null;
  ingredientImageUrl?: string | null;
  barcodeImageUrl?: string | null;
}

export type NameLookupInput = {
  brand: string;
  queryName: string;
  protein: string;
  lifeStage: string;
  foodForm: string;
  pastedUrl: string;
  email: string;
};

export async function createNameLookup(body: {
  petId?: string;
  petName?: string;
  petType?: string;
  brand: string;
  queryName: string;
  protein?: string;
  lifeStage?: string;
  foodForm?: string;
  pastedUrl?: string;
  email?: string;
  setAsCurrentFood?: boolean;
  replaceCurrentFood?: boolean;
}) {
  const response = await fetch(`${BASE_URL}/lookups`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse(response) as Promise<{ id: string; status: string; reused: boolean; tokensAwarded: number }>;
}

async function optimize(uri: string) {
  const probe = await ImageManipulator.manipulateAsync(uri, [], {});
  const longest = Math.max(probe.width, probe.height);
  const actions: ImageManipulator.Action[] = [];
  if (longest > 2000) {
    actions.push(probe.width >= probe.height ? { resize: { width: 2000 } } : { resize: { height: 2000 } });
  }
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

async function fileToBlob(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.slice(0, blob.size, 'image/jpeg');
}

export async function createPhotoLookup(params: {
  frontImageUri: string;
  ingredientImageUri: string;
  barcodeImageUri?: string;
  barcode?: string;
  petId?: string;
  petName?: string;
  petType?: string;
  email?: string;
  setAsCurrentFood?: boolean;
  replaceCurrentFood?: boolean;
  productName?: string;
}) {
  const [front, ingredient, barcodeImage] = await Promise.all([
    optimize(params.frontImageUri),
    optimize(params.ingredientImageUri),
    params.barcodeImageUri ? optimize(params.barcodeImageUri) : Promise.resolve(''),
  ]);
  const form = new FormData();
  form.append('frontImage', await fileToBlob(front), 'front.jpg');
  form.append('ingredientImage', await fileToBlob(ingredient), 'ingredients.jpg');
  if (barcodeImage) form.append('barcodeImage', await fileToBlob(barcodeImage), 'barcode.jpg');
  if (params.barcode) form.append('barcode', params.barcode);
  if (params.petId) form.append('petId', params.petId);
  if (params.petName) form.append('petName', params.petName);
  if (params.petType) form.append('petType', params.petType);
  if (params.email) form.append('email', params.email);
  if (params.setAsCurrentFood) form.append('setAsCurrentFood', '1');
  if (params.replaceCurrentFood) form.append('replaceCurrentFood', '1');
  if (params.productName) form.append('productName', params.productName);

  const response = await fetch(`${BASE_URL}/lookups/photo`, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  return parse(response) as Promise<{ id: string; status: string }>;
}

export async function listLookups() {
  const response = await fetch(`${BASE_URL}/lookups`, { headers: await authHeaders() });
  return parse(response) as Promise<{ pending: number; lookups: LookupSummary[] }>;
}

export async function getLookup(id: string) {
  const response = await fetch(`${BASE_URL}/lookups/${id}`, { headers: await authHeaders() });
  return parse(response) as Promise<LookupDetail>;
}

export async function ackLookup(id: string) {
  const response = await fetch(`${BASE_URL}/lookups/${id}/ack`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  return parse(response);
}

export async function lookupByBarcode(barcode: string) {
  const response = await fetch(`${BASE_URL}/lookups?barcode=${encodeURIComponent(barcode)}`, {
    headers: await authHeaders(),
  });
  const data = await parse(response) as { lookup: LookupDetail | null };
  return data.lookup;
}

export async function savePushToken(token: string) {
  const response = await fetch(`${BASE_URL}/lookups/push-token`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parse(response);
}

export function openAnalysisRequests(navigation: { getParent?: () => any; popToTop?: () => void }) {
  const tabs = navigation.getParent?.();
  navigation.popToTop?.();
  tabs?.navigate?.('HistoryTab', { screen: 'History', params: { tab: 'requests' } });
}
