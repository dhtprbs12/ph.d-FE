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

// Cap on the longest image side before upload. Server downsizes the
// final image again (sharp ➜ JPEG) so going bigger here than the
// server's bound is pure waste; going smaller here is the OCR
// bottleneck because small printed text on ingredient panels needs
// pixel headroom. 2000 was chosen to keep ~7-pt label text legible
// after the JPEG round-trip while staying under typical cellular
// upload budgets (~600KB/frame).
const UPLOAD_MAX_DIMENSION = 2000;

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

/**
 * Multi-image multipart upload (used by burst capture for cylindrical
 * cans / pouches). Each image is resized to UPLOAD_MAX_DIMENSION on the
 * longest side and converted to JPEG, then appended under `fieldName`
 * (default `images`) so the server-side `multer.array(...)` picks them up.
 *
 * Resizes are sequential rather than parallel on purpose — RN devices
 * (especially older Androids) OOM when expo-image-manipulator processes
 * many large frames simultaneously.
 */
export async function uploadImages<T>(
  endpoint: string,
  imageUris: string[],
  additionalFields?: Record<string, string>,
  fieldName = 'images',
): Promise<T> {
  if (!imageUris.length) {
    throw new Error('uploadImages: imageUris is empty');
  }

  const formData = new FormData();

  for (let i = 0; i < imageUris.length; i += 1) {
    const uri = imageUris[i];

    let probedWidth: number | undefined;
    let probedHeight: number | undefined;
    try {
      const probe = await ImageManipulator.manipulateAsync(uri, [], {});
      probedWidth = probe.width;
      probedHeight = probe.height;
    } catch {
      // No probe → just compress without resize on this frame.
    }

    const actions: ImageManipulator.Action[] = [];
    if (probedWidth && probedHeight) {
      const longest = Math.max(probedWidth, probedHeight);
      if (longest > UPLOAD_MAX_DIMENSION) {
        actions.push(
          probedWidth >= probedHeight
            ? { resize: { width: UPLOAD_MAX_DIMENSION } }
            : { resize: { height: UPLOAD_MAX_DIMENSION } }
        );
      }
    }

    const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    formData.append(fieldName, {
      uri: manipulated.uri,
      type: 'image/jpeg',
      name: `image_${i + 1}.jpg`,
    } as unknown as Blob);
  }

  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
  }

  try {
    const { data } = await api.post<T>(endpoint, formData);
    return data;
  } catch (e) {
    logApiError(e, `uploadImages ${endpoint} (${imageUris.length} files)`);
    throw e;
  }
}

function guessVideoMime(uri: string): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

function guessVideoFileName(uri: string): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'label-spin.mov';
  if (lower.endsWith('.webm')) return 'label-spin.webm';
  if (lower.endsWith('.m4v')) return 'label-spin.m4v';
  return 'label-spin.mp4';
}

/**
 * Single-file multipart upload with field name `video` (used by spin-video
 * back-label capture). Uses a longer timeout than the default client because
 * the server runs ffmpeg + many Vision calls before responding.
 */
export async function uploadVideo<T>(endpoint: string, videoUri: string): Promise<T> {
  const formData = new FormData();
  formData.append('video', {
    uri: videoUri,
    type: guessVideoMime(videoUri),
    name: guessVideoFileName(videoUri),
  } as unknown as Blob);

  try {
    const { data } = await api.post<T>(endpoint, formData, { timeout: 180_000 });
    return data;
  } catch (e) {
    logApiError(e, `uploadVideo ${endpoint}`);
    throw e;
  }
}

/** Response shape for `POST /vision/document-text` (Railway PHD backend). */
export type VisionDocumentTextResponse = {
  text: string;
};

/**
 * Cloud Vision `DOCUMENT_TEXT_DETECTION` via your **Railway backend** only.
 * The app never sees `GOOGLE_CLOUD_VISION_API_KEY`; set that on the server.
 *
 * **Backend contract** (mount under the same `/api` prefix as other routes):
 * - `POST /vision/document-text`
 * - JSON body: `{ "imageBase64": "<jpeg base64, no data: prefix>" }`
 * - JSON response: `{ "text": "<fullTextAnnotation.text>" }`
 * - On error: appropriate `4xx`/`5xx` + JSON `{ "error": "message" }` if you like.
 *
 * **Express example** (copy into your PHD server; `express.json({ limit: '15mb' })` globally or on this route):
 *
 * ```js
 * const VISION = 'https://vision.googleapis.com/v1/images:annotate';
 * router.post('/vision/document-text', async (req, res) => {
 *   const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
 *   if (!key) return res.status(503).json({ error: 'Vision not configured' });
 *   const b64 = req.body?.imageBase64;
 *   if (typeof b64 !== 'string' || !b64.length)
 *     return res.status(400).json({ error: 'imageBase64 required' });
 *   const r = await fetch(`${VISION}?key=${encodeURIComponent(key)}`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       requests: [{
 *         image: { content: b64 },
 *         features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
 *         imageContext: { languageHints: ['en'] },
 *       }],
 *     }),
 *   });
 *   const json = await r.json();
 *   if (!r.ok) return res.status(502).json({ error: json?.error?.message || r.statusText });
 *   const text = json?.responses?.[0]?.fullTextAnnotation?.text ?? '';
 *   res.json({ text });
 * });
 * ```
 */
export async function postVisionDocumentText(imageBase64: string): Promise<string> {
  try {
    const { data } = await api.post<VisionDocumentTextResponse>(
      '/vision/document-text',
      { imageBase64 },
      { timeout: 90_000 },
    );
    return typeof data?.text === 'string' ? data.text : '';
  } catch (e) {
    logApiError(e, 'postVisionDocumentText');
    throw e;
  }
}

export default api;
