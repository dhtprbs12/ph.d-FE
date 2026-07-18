import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const BASE_URL = 'https://phd-be-production.up.railway.app/api';
const AUTH_TOKEN_KEY = 'authToken';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

function logApiError(error: unknown, context?: string): void {
  const prefix = context ? `[API] ${context}` : '[API]';
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError;
    const status = ax.response?.status;
    const data = ax.response?.data;
    const msg = ax.message;
    console.error(prefix, { status, data, message: msg, url: ax.config?.url });
  } else {
    console.error(prefix, error);
  }
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      logApiError(e, 'request interceptor (AsyncStorage)');
    }
    return config;
  },
  (error) => {
    logApiError(error, 'request interceptor');
    return Promise.reject(error);
  }
);

let isLoggingOut = false;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    logApiError(error, 'response');

    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      try {
        const { clearAuthData } = await import('../utils/tokenUtils');
        const { resetToLogin } = await import('../navigation/navigationRef');
        await clearAuthData();
        Alert.alert(
          'Session Expired',
          'Please log in again to continue.',
          [{ text: 'OK', onPress: () => resetToLogin() }],
        );
      } catch (e) {
        console.warn('[API] Failed to handle 401 logout:', e);
      } finally {
        setTimeout(() => { isLoggingOut = false; }, 3000);
      }
    }

    return Promise.reject(error);
  }
);

// Cap on the longest image side before upload. Server downsizes the
// final image again (sharp ➜ JPEG) so going bigger here than the
// server's bound is pure waste; going smaller here is the OCR
// bottleneck because small printed text on ingredient panels needs
// pixel headroom. 2000 was chosen to keep ~7-pt label text legible
// after the JPEG round-trip while staying under typical cellular
// upload budgets (~600KB/frame).
const UPLOAD_MAX_DIMENSION = 2000;

export class ApiUploadError extends Error {
  code?: string;
  suggestion?: string;
  missingFields?: string[];
  status: number;

  constructor(
    status: number,
    body: {
      error?: string;
      message?: string;
      suggestion?: string;
      missingFields?: string[];
    }
  ) {
    super(body.message || body.error || `Upload failed (${status})`);
    this.name = 'ApiUploadError';
    this.code = body.error;
    this.suggestion = body.suggestion;
    this.missingFields = body.missingFields;
    this.status = status;
  }
}

/** React Native FormData expects different URI shapes per platform. */
function getUploadUri(uri: string): string {
  if (Platform.OS === 'ios') {
    return uri.replace('file://', '');
  }
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }
  return `file://${uri}`;
}

/**
 * Multipart upload with field name `image` (JPEG). Optional string fields are appended for mixed forms.
 *
 * Resizes the image so the longest side is at most UPLOAD_MAX_DIMENSION before
 * uploading. expo-image-manipulator preserves aspect ratio when only one of
 * `width` / `height` is supplied, so we pick whichever side is the longer one.
 * Falls back to a no-resize JPEG conversion if we can't read dimensions.
 */
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
  } catch {
    // Probe failed — proceed with no resize, just HEIC→JPEG conversion.
  }

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

  // Convert HEIC/HEIF to JPEG and (optionally) resize in one pass
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
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      try {
        const { clearAuthData } = await import('../utils/tokenUtils');
        const { resetToLogin } = await import('../navigation/navigationRef');
        await clearAuthData();
        Alert.alert(
          'Session Expired',
          'Please log in again to continue.',
          [{ text: 'OK', onPress: () => resetToLogin() }],
        );
      } catch (logoutErr) {
        console.warn('[API] Failed to handle 401 logout:', logoutErr);
      } finally {
        setTimeout(() => { isLoggingOut = false; }, 3000);
      }
    }
    if (!response.ok) {
      throw new ApiUploadError(response.status, data as {
        error?: string;
        message?: string;
        suggestion?: string;
        missingFields?: string[];
      });
    }
    return data as T;
  } catch (e) {
    logApiError(e, `uploadImage ${endpoint}`);
    throw e;
  }
}

export default api;
