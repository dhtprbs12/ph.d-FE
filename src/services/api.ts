import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';

const BASE_URL = 'https://phd-be-production.up.railway.app/api';
const AUTH_TOKEN_KEY = 'authToken';
const DEVICE_ID_KEY = 'deviceId';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
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
      const [token, deviceId] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(DEVICE_ID_KEY),
      ]);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (deviceId) {
        config.headers['x-device-id'] = deviceId;
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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    logApiError(error, 'response');
    return Promise.reject(error);
  }
);

// Server already resizes to 1500x1500 for OCR; uploading bigger is pure waste
// (and a major bottleneck on weak in-store cellular). Cap the longest side here.
const UPLOAD_MAX_DIMENSION = 1500;

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
  additionalFields?: Record<string, string>
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
  formData.append('image', {
    uri: jpegUri,
    type: 'image/jpeg',
    name: 'image.jpg',
  } as unknown as Blob);

  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
  }

  try {
    // Let the client set multipart boundary (required on React Native).
    const { data } = await api.post<T>(endpoint, formData);
    return data;
  } catch (e) {
    logApiError(e, `uploadImage ${endpoint}`);
    throw e;
  }
}

export default api;
