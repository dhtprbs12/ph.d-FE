import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ANALYSIS_SCAN_KEY = 'pendingAnalysisScan';
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

export interface PendingAnalysisScan {
  scanId: string;
  startedAt: number;
  frontMeta?: {
    productName?: string;
    brand?: string;
    productType?: string;
  };
}

export async function savePendingAnalysisScan(pending: PendingAnalysisScan): Promise<void> {
  await AsyncStorage.setItem(PENDING_ANALYSIS_SCAN_KEY, JSON.stringify(pending));
}

export async function loadPendingAnalysisScan(): Promise<PendingAnalysisScan | null> {
  const raw = await AsyncStorage.getItem(PENDING_ANALYSIS_SCAN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingAnalysisScan;
    if (!parsed?.scanId || typeof parsed.startedAt !== 'number') return null;
    if (Date.now() - parsed.startedAt > PENDING_MAX_AGE_MS) {
      await clearPendingAnalysisScan();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingAnalysisScan(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ANALYSIS_SCAN_KEY);
}
