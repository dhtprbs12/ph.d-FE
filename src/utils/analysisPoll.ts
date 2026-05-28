import { AppState, type AppStateStatus } from 'react-native';
import * as scanService from '../services/scanService';
import { getDeviceId } from '../services/authService';
import type { PollScanResultResponse, ScanResult } from '../types';
import { scanRowToScanResult } from './scanHistorySnapshot';

/** Foreground-only budget per poll slice (background time does not consume). */
const SLICE_BUDGET_MS = 60_000;
/** After each slice, try DB recovery then start another slice. */
const MAX_SLICES = 8;

function isAppActive(state: AppStateStatus = AppState.currentState): boolean {
  return state === 'active';
}

/** Wait until the app is in the foreground (iOS & Android). */
function waitUntilActive(): Promise<void> {
  if (isAppActive()) return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (next) => {
      if (isAppActive(next)) {
        sub.remove();
        resolve();
      }
    });
  });
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Counts elapsed time only while the app is foreground-active. */
class ForegroundTimer {
  private budgetMs: number;
  private lastTick = Date.now();
  private active = isAppActive();
  private sub = AppState.addEventListener('change', (next) => this.onAppState(next));

  constructor(budgetMs: number) {
    this.budgetMs = budgetMs;
  }

  private onAppState(next: AppStateStatus): void {
    if (this.active && !isAppActive(next)) {
      this.consume();
    }
    this.active = isAppActive(next);
    this.lastTick = Date.now();
  }

  private consume(): void {
    if (!this.active) return;
    this.budgetMs -= Date.now() - this.lastTick;
    this.lastTick = Date.now();
  }

  hasBudget(): boolean {
    this.consume();
    return this.budgetMs > 0;
  }

  dispose(): void {
    this.sub.remove();
  }
}

function pollWaitMs(tick: number): number {
  if (tick <= 3) return 700;
  if (tick <= 8) return 1500;
  return 2500;
}

function extractCompleteResult(res: PollScanResultResponse): ScanResult | null {
  const status = String(res.status).toLowerCase();
  if (status !== 'complete') return null;
  if (res.result) return res.result;
  if (res.analysis) return res as unknown as ScanResult;
  return null;
}

async function tryRecoverFromHistory(scanId: string): Promise<ScanResult | null> {
  try {
    const deviceId = await getDeviceId();
    const scan = await scanService.getScanById(scanId, deviceId);
    const raw = scan.analysis ?? {};
    if (typeof raw !== 'object') return null;
    const hasAnalysisBody =
      Object.keys(raw).length > 0 ||
      (scan.final_score != null && scan.grade != null);
    if (!hasAnalysisBody) return null;
    return scanRowToScanResult(scan);
  } catch {
    return null;
  }
}

async function pollSlice(
  scanId: string,
  onTick: (stepIndex: number, message?: string) => void
): Promise<ScanResult | null> {
  const timer = new ForegroundTimer(SLICE_BUDGET_MS);
  let tick = 0;

  try {
    while (timer.hasBudget()) {
      await waitUntilActive();

      let res: PollScanResultResponse;
      try {
        res = await scanService.pollResult(scanId);
      } catch {
        await sleepMs(pollWaitMs(tick));
        tick += 1;
        continue;
      }

      const complete = extractCompleteResult(res);
      if (complete) return complete;

      const status = String(res.status).toLowerCase();
      if (status === 'error') {
        throw new Error('Analysis failed');
      }

      const prog = res.progress;
      if (typeof prog === 'string') {
        onTick(tick % 4, prog);
      } else if (prog && typeof prog === 'object') {
        const cur = (prog as { current?: number; message?: string }).current;
        const msg = (prog as { message?: string }).message;
        if (typeof cur === 'number') tick = cur;
        onTick(tick % 4, msg);
      } else {
        onTick(tick % 4);
      }

      tick += 1;
      await waitUntilActive();
      await sleepMs(pollWaitMs(tick));
    }
  } finally {
    timer.dispose();
  }

  return null;
}

/**
 * Poll until analysis completes. Foreground time only counts toward each 60s slice;
 * returning from background resumes polling. Falls back to scan_history via API.
 */
export async function pollUntilComplete(
  scanId: string,
  onTick: (stepIndex: number, message?: string) => void
): Promise<ScanResult> {
  for (let slice = 0; slice < MAX_SLICES; slice += 1) {
    const fromPoll = await pollSlice(scanId, onTick);
    if (fromPoll) return fromPoll;

    const fromHistory = await tryRecoverFromHistory(scanId);
    if (fromHistory) return fromHistory;
  }

  const lastChance = await tryRecoverFromHistory(scanId);
  if (lastChance) return lastChance;

  throw new Error(
    'Analysis is taking longer than expected. Check History in a moment — your result may already be there.'
  );
}
