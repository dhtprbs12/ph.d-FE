import { Platform } from 'react-native';
import api from './api';

// RevenueCat is optional — if the native module isn't available (Expo Go),
// all purchase functions are no-ops and the subscription sheet hides itself.
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {}

const APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';
const GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';
const BILLING_TIER = process.env.EXPO_PUBLIC_BILLING_TIER || 'test';

export interface BillingStatus {
  plus: boolean;
  expiresAt: string | null;
  willRenew: boolean;
}

export interface PackageInfo {
  identifier: string;
  priceString: string;
  product: {
    title: string;
    description: string;
    priceString: string;
  };
  packageType: string;
  rcPackage: any; // raw RevenueCat package for purchase call
}

let _configured = false;

export function isRevenueCatAvailable(): boolean {
  return !!Purchases && !!(APPLE_KEY || GOOGLE_KEY);
}

export async function configureRevenueCat(userId: string): Promise<void> {
  if (!Purchases || _configured) return;
  const key = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
  if (!key) return;
  Purchases.configure({ apiKey: key, appUserID: userId });
  _configured = true;
}

export async function logoutRevenueCat(): Promise<void> {
  if (!Purchases || !_configured) return;
  try {
    await Purchases.logOut();
  } catch {}
  _configured = false;
}

export async function getStatus(): Promise<BillingStatus> {
  const { data } = await api.get<BillingStatus>('/billing/status');
  return data;
}

export async function getOfferings(): Promise<PackageInfo[]> {
  if (!Purchases || !_configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all?.[BILLING_TIER] || offerings.current;
    if (!offering) return [];
    return offering.availablePackages.map((pkg: any) => ({
      identifier: pkg.identifier,
      priceString: pkg.product.priceString,
      product: {
        title: pkg.product.title,
        description: pkg.product.description,
        priceString: pkg.product.priceString,
      },
      packageType: pkg.packageType,
      rcPackage: pkg,
    }));
  } catch (e) {
    console.warn('[Billing] getOfferings failed:', e);
    return [];
  }
}

export function getSubscriptionPackages(packages: PackageInfo[]): PackageInfo[] {
  return packages.filter(p =>
    p.identifier === '$rc_monthly' || p.identifier === '$rc_annual'
  );
}

export function getBonePackages(packages: PackageInfo[]): PackageInfo[] {
  return packages.filter(p => p.identifier.startsWith('bones_'));
}

export async function purchase(pkg: PackageInfo): Promise<{ success: boolean; cancelled?: boolean }> {
  if (!Purchases) return { success: false };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.rcPackage);
    return { success: true };
  } catch (e: any) {
    if (e.userCancelled) return { success: false, cancelled: true };
    console.error('[Billing] purchase error:', e);
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    await Purchases.restorePurchases();
    return true;
  } catch (e) {
    console.warn('[Billing] restore failed:', e);
    return false;
  }
}

export function getManageSubscriptionUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}

/**
 * Poll billing status until it changes to plus or maxAttempts is reached.
 * Used after a bone pack purchase to wait for the webhook.
 */
export async function pollForBoneUpdate(
  previousBalance: number,
  getBalance: () => Promise<number>,
  maxAttempts = 6,
  intervalMs = 2000,
): Promise<{ updated: boolean; newBalance: number }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const balance = await getBalance();
    if (balance > previousBalance) {
      return { updated: true, newBalance: balance };
    }
  }
  const finalBalance = await getBalance();
  return { updated: finalBalance > previousBalance, newBalance: finalBalance };
}
