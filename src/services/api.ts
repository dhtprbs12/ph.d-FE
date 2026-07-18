import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const BASE_URL = 'https://phd-be-production.up.railway.app/api';
const AUTH_TOKEN_KEY = 'authToken';

let isLoggingOut = false;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

async function handle401() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    const { clearAuthData } = await import('../utils/tokenUtils');
    const { resetToLogin } = await import('../navigation/navigationRef');
    await clearAuthData();
    Alert.alert('Session Expired', 'Please log in again to continue.', [
      { text: 'OK', onPress: () => resetToLogin() },
    ]);
  } catch (e) {
    console.warn('[API] Failed to handle 401 logout:', e);
  } finally {
    setTimeout(() => { isLoggingOut = false; }, 3000);
  }
}

type ApiResponse<T = any> = { data: T; status: number };

async function request<T = any>(
  method: string,
  url: string,
  body?: any,
  config?: { timeout?: number; params?: Record<string, string> }
): Promise<ApiResponse<T>> {
  const fullUrl = new URL(`${BASE_URL}${url}`);
  if (config?.params) {
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) fullUrl.searchParams.set(k, v);
    }
  }

  const headers = await getAuthHeaders();

  const fetchOptions: RequestInit = { method, headers };

  if (body && method !== 'GET') {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = config?.timeout ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeout);
  fetchOptions.signal = controller.signal;

  try {
    const response = await fetch(fullUrl.toString(), fetchOptions);
    clearTimeout(timer);

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    if (response.status === 401) {
      handle401();
    }

    if (!response.ok) {
      const error: any = new Error(data?.message || data?.error || `Request failed with status code ${response.status}`);
      error.response = { status: response.status, data };
      error.status = response.status;
      error.config = { url };
      console.error('[API] response', { status: response.status, data, message: error.message, url });
      throw error;
    }

    return { data, status: response.status };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const error: any = new Error('Network timeout');
      error.config = { url };
      console.error('[API] response', { status: undefined, data: undefined, message: 'Network timeout', url });
      throw error;
    }
    if (!e.response) {
      console.error('[API] response', { status: undefined, data: undefined, message: e.message, url });
    }
    throw e;
  }
}

const api = {
  get<T = any>(url: string, config?: { params?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return request<T>('GET', url, undefined, config);
  },
  post<T = any>(url: string, data?: any, config?: { timeout?: number }): Promise<ApiResponse<T>> {
    return request<T>('POST', url, data, config);
  },
  put<T = any>(url: string, data?: any, config?: { timeout?: number }): Promise<ApiResponse<T>> {
    return request<T>('PUT', url, data, config);
  },
  patch<T = any>(url: string, data?: any, config?: { timeout?: number }): Promise<ApiResponse<T>> {
    return request<T>('PATCH', url, data, config);
  },
  delete<T = any>(url: string, config?: { timeout?: number }): Promise<ApiResponse<T>> {
    return request<T>('DELETE', url, undefined, config);
  },
};

const UPLOAD_MAX_DIMENSION = 2000;

export class ApiUploadError extends Error {
  code?: string;
  suggestion?: string;
  missingFields?: string[];
  status: number;

  constructor(
    status: number,
    body: { error?: string; message?: string; suggestion?: string; missingFields?: string[] }
  ) {
    super(body.message || body.error || `Upload failed (${status})`);
    this.name = 'ApiUploadError';
    this.code = body.error;
    this.suggestion = body.suggestion;
    this.missingFields = body.missingFields;
    this.status = status;
  }
}

function getUploadUri(uri: string): string {
  if (Platform.OS === 'ios') return uri.replace('file://', '');
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `file://${uri}`;
}

export async function uploadImage<T>(
  endpoint: string,
  imageUri: string,
  additionalFields?: Record<string, string>,
  fieldName: string = 'image'
): Promise<T> {
  let probedWidth: number | undefined;
  let probedHeight: number | undefined;
  try {
    const probe = await ImageManipulator.manipulateAsync(imageUri, [], {});
    probedWidth = probe.width;
    probedHeight = probe.height;
  } catch {}

  const resizeAction: ImageManipulator.Action[] = [];
  if (probedWidth && probedHeight) {
    const longest = Math.max(probedWidth, probedHeight);
    if (longest > UPLOAD_MAX_DIMENSION) {
      resizeAction.push(
        probedWidth >= probedHeight
          ? { resize: { width: UPLOAD_MAX_DIMENSION } }
          : { resize: { height: UPLOAD_MAX_DIMENSION } }
      );
    }
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    resizeAction,
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const jpegUri = manipulated.uri;

  const formData = new FormData();
  formData.append(fieldName, {
    uri: getUploadUri(jpegUri),
    type: 'image/jpeg',
    name: `${fieldName}.jpg`,
  } as unknown as Blob);

  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...headers },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) handle401();
    if (!response.ok) {
      throw new ApiUploadError(response.status, data as {
        error?: string; message?: string; suggestion?: string; missingFields?: string[];
      });
    }
    return data as T;
  } catch (e) {
    console.error('[API] uploadImage', endpoint, e);
    throw e;
  }
}

export default api;
