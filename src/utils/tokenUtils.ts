import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'authToken';

/**
 * Decode JWT payload without verification (just base64).
 * Returns null if malformed.
 */
function decodePayload(token: string): { exp?: number; userId?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if the stored token is expired.
 * Returns 'valid' | 'expired' | 'missing'.
 */
export async function checkTokenStatus(): Promise<'valid' | 'expired' | 'missing'> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return 'missing';

  const payload = decodePayload(token);
  if (!payload?.exp) return 'expired';

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSec) return 'expired';

  return 'valid';
}

/**
 * Clear stored auth data (logout).
 */
export async function clearAuthData(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, 'userId']);
}
