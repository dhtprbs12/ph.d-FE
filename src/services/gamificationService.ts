import api from './api';

export interface TokenInfo {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface TokenTransaction {
  id: string;
  amount: number;
  type: 'checkin' | 'product_register' | 'scan_level' | 'streak' | 'purchase';
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface ScanLevelInfo {
  currentLevel: number;
  totalScans: number;
  nextLevel: {
    level: number;
    scansRequired: number;
    reward: number;
    progress: { current: number; target: number };
  } | null;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
  milestones: Array<{ days: number; reward: number; reached: boolean }>;
}

export interface GamificationSummary {
  tokens: TokenInfo;
  scanLevel: ScanLevelInfo;
  streak: StreakInfo;
}

export interface ProductRegisterResult {
  success: boolean;
  product: {
    id: string;
    name: string;
    brand: string | null;
    barcode: string | null;
    status: string;
  };
  tokensAwarded: number;
  tokenBalance: number;
}

const gamificationService = {
  async getTokens(): Promise<TokenInfo> {
    const { data } = await api.get<TokenInfo>('/gamification/tokens');
    return data;
  },

  async getTokenHistory(limit = 20, offset = 0): Promise<{ transactions: TokenTransaction[] }> {
    const { data } = await api.get<{ transactions: TokenTransaction[] }>('/gamification/tokens/history', {
      params: { limit: String(limit), offset: String(offset) },
    });
    return data;
  },

  async getScanLevel(): Promise<ScanLevelInfo> {
    const { data } = await api.get<ScanLevelInfo>('/gamification/scan-level');
    return data;
  },

  async getStreak(): Promise<StreakInfo> {
    const { data } = await api.get<StreakInfo>('/gamification/streak');
    return data;
  },

  async getSummary(): Promise<GamificationSummary> {
    const { data } = await api.get<GamificationSummary>('/gamification/summary');
    return data;
  },
};

export default gamificationService;
