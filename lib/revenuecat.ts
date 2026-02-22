/**
 * RevenueCat Hosted Paywall (Paywalls V2)
 * Entitlement: "pro". Uses offerings.current from RevenueCat dashboard.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import type { PurchasesOffering, PurchasesOfferings } from 'react-native-purchases';

const PRO_ENTITLEMENT = 'pro';

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

let initPromise: Promise<void> | null = null;

export async function initializeRevenueCat(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (Platform.OS === 'ios') {
      const apiKey = getIosApiKey();
      if (!apiKey) {
        if (__DEV__) console.warn('[RevenueCat] No iOS API key');
        return;
      }
      Purchases.configure({ apiKey });
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    } else if (Platform.OS === 'android') {
      const apiKey = getAndroidApiKey();
      if (!apiKey) {
        if (__DEV__) console.warn('[RevenueCat] No Android API key');
        return;
      }
      Purchases.configure({ apiKey });
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
  })();

  return initPromise;
}

export async function getCurrentOfferingOrThrow(): Promise<PurchasesOffering> {
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

export async function showHostedPaywall(): Promise<PAYWALL_RESULT> {
  const offering = await getCurrentOfferingOrThrow();
  return RevenueCatUI.presentPaywall({
    offering,
    displayCloseButton: true,
  });
}

export async function isPro(): Promise<boolean> {
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
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
    return { hasPro, customerInfo };
  } catch {
    return { hasPro: false, customerInfo: null };
  }
}

export async function restoreAndSync(): Promise<boolean> {
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

export { PAYWALL_RESULT, PRO_ENTITLEMENT };
