/**
 * RevenueCat Hosted Paywall (Paywalls V2)
 * Entitlement defaults to "pro" (configurable via env).
 * Offering defaults to RevenueCat "current" (configurable via env).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOffering,
  PurchasesOfferings,
} from 'react-native-purchases';

const DEFAULT_PRO_ENTITLEMENT = 'pro';
const PRO_ENTITLEMENT =
  fromEnv('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID') ||
  fromEnv('EXPO_PUBLIC_RC_ENTITLEMENT_ID') ||
  DEFAULT_PRO_ENTITLEMENT;

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

function getExpoGoApiKey(): string {
  return (
    fromEnv('EXPO_PUBLIC_RC_TEST_STORE_API_KEY') ||
    fromEnv('EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY') ||
    fromEnv('EXPO_PUBLIC_REVENUECAT_WEB_API_KEY') ||
    ''
  );
}

function isExpoGoRuntime(): boolean {
  const appOwnership = ((Constants as any)?.appOwnership || '').toLowerCase();
  const executionEnvironment = String(
    (Constants as any)?.executionEnvironment || ''
  ).toLowerCase();
  return appOwnership === 'expo' || executionEnvironment.includes('storeclient');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

let initPromise: Promise<boolean> | null = null;

function getConfiguredOfferingId(): string {
  return fromEnv('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const runningInExpoGo = isExpoGoRuntime();
    if (Platform.OS === 'ios') {
      const apiKey = runningInExpoGo ? getExpoGoApiKey() : getIosApiKey();
      if (!apiKey) {
        if (__DEV__) {
          console.warn(
            runningInExpoGo
              ? '[RevenueCat] Expo Go detected. Set EXPO_PUBLIC_RC_TEST_STORE_API_KEY (or EXPO_PUBLIC_REVENUECAT_WEB_API_KEY), or use a development build/TestFlight.'
              : '[RevenueCat] No iOS API key'
          );
        }
        return false;
      }
      try {
        Purchases.configure({ apiKey });
      } catch (error) {
        const message = getErrorMessage(error);
        // Expo Go cannot use native App Store keys.
        if (
          runningInExpoGo &&
          /native store is not available|expo go|test store/i.test(message)
        ) {
          if (__DEV__) {
            console.warn(
              '[RevenueCat] Expo Go does not support native store keys. Use EXPO_PUBLIC_RC_TEST_STORE_API_KEY, or switch to a development build/TestFlight.'
            );
          }
          return false;
        }
        throw error;
      }
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      return true;
    } else if (Platform.OS === 'android') {
      const apiKey = runningInExpoGo ? getExpoGoApiKey() : getAndroidApiKey();
      if (!apiKey) {
        if (__DEV__) {
          console.warn(
            runningInExpoGo
              ? '[RevenueCat] Expo Go detected. Set EXPO_PUBLIC_RC_TEST_STORE_API_KEY (or EXPO_PUBLIC_REVENUECAT_WEB_API_KEY), or use a development build/TestFlight.'
              : '[RevenueCat] No Android API key'
          );
        }
        return false;
      }
      try {
        Purchases.configure({ apiKey });
      } catch (error) {
        const message = getErrorMessage(error);
        // Expo Go cannot use native Play Store keys.
        if (
          runningInExpoGo &&
          /native store is not available|expo go|test store/i.test(message)
        ) {
          if (__DEV__) {
            console.warn(
              '[RevenueCat] Expo Go does not support native store keys. Use EXPO_PUBLIC_RC_TEST_STORE_API_KEY, or switch to a development build/TestFlight.'
            );
          }
          return false;
        }
        throw error;
      }
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      return true;
    }
    return false;
  })();

  return initPromise;
}

export async function getCurrentOfferingOrThrow(): Promise<PurchasesOffering> {
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const offering = selectConfiguredOffering(offerings);
  if (!offering) {
    const offeringId = getConfiguredOfferingId();
    throw new Error(
      `No offering found${offeringId ? ` for "${offeringId}"` : ''}. Dashboard: set an offering as Current. Available: ${Object.keys(offerings.all).join(', ') || 'none'}`
    );
  }
  return offering;
}

export function selectConfiguredOffering(
  offerings: PurchasesOfferings
): PurchasesOffering | null {
  const offeringId = getConfiguredOfferingId();
  if (offeringId) {
    return offerings.all[offeringId] ?? offerings.current ?? null;
  }
  return offerings.current ?? null;
}

export function getActiveProEntitlement(
  customerInfo: CustomerInfo
): PurchasesEntitlementInfo | null {
  const activeEntitlements = customerInfo.entitlements.active;
  const directMatch = activeEntitlements[PRO_ENTITLEMENT];
  if (directMatch) return directMatch;

  const caseInsensitiveMatch = Object.keys(activeEntitlements).find(
    (identifier) => identifier.toLowerCase() === PRO_ENTITLEMENT.toLowerCase()
  );
  if (!caseInsensitiveMatch) return null;
  return activeEntitlements[caseInsensitiveMatch];
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
    return !!getActiveProEntitlement(customerInfo);
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
    const hasPro = !!getActiveProEntitlement(customerInfo);
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
    entitlementIdentifier: PRO_ENTITLEMENT,
    offeringIdentifier: offering.identifier,
    availablePackages: pkgIds,
    isPro: isProResult,
  });
}

export { PAYWALL_RESULT, PRO_ENTITLEMENT };
