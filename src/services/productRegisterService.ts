import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const BASE_URL = 'https://phd-be-production.up.railway.app/api';
const AUTH_TOKEN_KEY = 'authToken';

function getUploadUri(uri: string): string {
  if (Platform.OS === 'ios') return uri.replace('file://', '');
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `file://${uri}`;
}

async function optimizeImage(uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulateAsync(uri, [], {});
  const longest = Math.max(probe.width, probe.height);
  const resizeAction: ImageManipulator.Action[] = [];
  if (longest > 2000) {
    resizeAction.push(
      probe.width >= probe.height
        ? { resize: { width: 2000 } }
        : { resize: { height: 2000 } },
    );
  }
  const result = await ImageManipulator.manipulateAsync(uri, resizeAction, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export interface RegisterProductParams {
  frontImageUri: string;
  ingredientImageUri: string;
  barcodeImageUri?: string;
  barcode?: string;
  productName?: string;
  brand?: string;
  petType?: string;
}

export interface RegisterProductResult {
  success: boolean;
  product: {
    id: string;
    name: string;
    brand: string | null;
    barcode: string | null;
    status: string;
    frontImageUrl: string | null;
    ingredientImageUrl: string | null;
    barcodeImageUrl: string | null;
  };
  tokensAwarded: number;
  tokenBalance: number;
}

export async function registerProduct(params: RegisterProductParams): Promise<RegisterProductResult> {
  const [frontUri, ingredientUri] = await Promise.all([
    optimizeImage(params.frontImageUri),
    optimizeImage(params.ingredientImageUri),
  ]);
  const barcodeUri = params.barcodeImageUri ? await optimizeImage(params.barcodeImageUri) : null;

  const formData = new FormData();
  formData.append('frontImage', {
    uri: getUploadUri(frontUri),
    type: 'image/jpeg',
    name: 'front.jpg',
  } as unknown as Blob);
  formData.append('ingredientImage', {
    uri: getUploadUri(ingredientUri),
    type: 'image/jpeg',
    name: 'ingredients.jpg',
  } as unknown as Blob);
  if (barcodeUri) {
    formData.append('barcodeImage', {
      uri: getUploadUri(barcodeUri),
      type: 'image/jpeg',
      name: 'barcode.jpg',
    } as unknown as Blob);
  }
  if (params.barcode) formData.append('barcode', params.barcode);
  if (params.productName) formData.append('productName', params.productName);
  if (params.brand) formData.append('brand', params.brand);
  if (params.petType) formData.append('petType', params.petType);

  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const response = await fetch(`${BASE_URL}/products/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to register product');
  }
  return data;
}
