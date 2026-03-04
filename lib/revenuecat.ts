/**
 * RevenueCat Hosted Paywall (Paywalls V2)
 * Entitlement: "pro". Uses offerings.current from RevenueCat dashboard.
 *
 * Platform support: iOS and Android have full SDK support. On web,
 * RevenueCat runs in "Preview API Mode" but cannot complete purchases.
 * All functions guard against missing configuration and return safe defaults.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import type { PurchasesOffering, PurchasesOfferings } from 'react-native-purchases';

const PRO_ENTITLEMENT = 'pro';

const NATIVE_PLATFORMS: string[] = ['ios', 'android'];

export function isNativePlatform(): boolean {
  return NATIVE_PLATFORMS.includes(Platform.OS);
}

function fromEnv(key: string): string {
  const v = process.env[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  const extra = (Constants.expoConfig as any)?.extra;
  const fromExtra = extra?.[key];
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

function getIosApiKey(): string {
  return (
    fromEnv('EXPO_PUBLIC_RC_IOS_API_KEY') ||
    fromEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY') ||
    ''
  );
}

function getAndroidApiKey(): string {
  return (
    fromEnv('EXPO_PUBLIC_RC_ANDROID_API_KEY') ||
    fromEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY') ||
    ''
  );
}

let _configured = false;
let initPromise: Promise<boolean> | null = null;

export function isConfigured(): boolean {
  return _configured;
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let apiKey = '';
      if (Platform.OS === 'ios') {
        apiKey = getIosApiKey();
      } else if (Platform.OS === 'android') {
        apiKey = getAndroidApiKey();
      } else {
        if (__DEV__) {
          console.info(`[RevenueCat] Platform "${Platform.OS}" — SDK may run in preview mode`);
        }
        return false;
      }

      if (!apiKey) {
        if (__DEV__) console.warn(`[RevenueCat] No ${Platform.OS} API key – paywall will not work`);
        return false;
      }

      Purchases.configure({ apiKey });
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      _configured = true;
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[RevenueCat] Init failed:', e);
      return false;
    }
  })();

  return initPromise;
}

export async function getCurrentOfferingOrThrow(): Promise<PurchasesOffering> {
  if (!_configured) {
    throw new Error(
      'RevenueCat is not configured. Ensure initializeRevenueCat() succeeded on a native platform with valid API keys.'
    );
  }
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const offeringId = fromEnv('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
  const offering = offeringId
    ? offerings.all[offeringId] ?? offerings.current
    : offerings.current;
  if (!offering) {
    throw new Error(
      `No current offering. Dashboard: set an offering as Current. Available: ${Object.keys(offerings.all).join(', ') || 'none'}`
    );
  }
  return offering;
}

export async function showHostedPaywall(): Promise<string> {
  if (!_configured) {
    if (__DEV__) console.warn('[RevenueCat] Cannot show paywall – SDK not configured');
    return 'NOT_PRESENTED';
  }
  const offering = await getCurrentOfferingOrThrow();
  return RevenueCatUI.presentPaywall({
    offering,
    displayCloseButton: true,
  });
}

export async function isPro(): Promise<boolean> {
  if (!_configured) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
  } catch {
    return false;
  }
}

export async function getProStatusWithInfo(): Promise<{
  hasPro: boolean;
  customerInfo: import('react-native-purchases').CustomerInfo | null;
}> {
  if (!_configured) return { hasPro: false, customerInfo: null };
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
    return { hasPro, customerInfo };
  } catch {
    return { hasPro: false, customerInfo: null };
  }
}

export async function restoreAndSync(): Promise<boolean> {
  if (!_configured) return false;
  await Purchases.restorePurchases();
  return isPro();
}

export function logPaywallDiagnostics(
  offering: PurchasesOffering,
  isProResult: boolean
): void {
  if (!__DEV__) return;
  const pkgIds = offering.availablePackages.map((p) => p.identifier);
  console.log('[RevenueCat] Paywall diagnostics:', {
    offeringIdentifier: offering.identifier,
    availablePackages: pkgIds,
    isPro: isProResult,
  });
}

export { PRO_ENTITLEMENT };
