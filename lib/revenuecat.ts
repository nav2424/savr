/**
 * RevenueCat Hosted Paywall (Paywalls V2)
 * Entitlement: "pro". Uses offerings.current from RevenueCat dashboard.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import type { PurchasesOffering, PurchasesOfferings } from 'react-native-purchases';

/** Must match RevenueCat dashboard entitlement identifier exactly (lowercase). */
const PRO_ENTITLEMENT = 'pro';

function getActiveSubscriptionIds(
  customerInfo: import('react-native-purchases').CustomerInfo
): string[] {
  const raw = (customerInfo as unknown as { activeSubscriptions?: string[] })
    .activeSubscriptions;
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

/**
 * After the user changes subscription status in Settings / Play (cancel, renew, etc.),
 * RevenueCat may still serve cached CustomerInfo until we invalidate and sync with the store.
 */
const REFRESH_FROM_STORE_TIMEOUT_MS = 12_000;

export async function refreshCustomerInfoFromStores(): Promise<void> {
  try {
    await initializeRevenueCat();
    await Promise.race([
      (async () => {
        await Purchases.invalidateCustomerInfoCache();
        try {
          await Purchases.syncPurchasesForResult();
        } catch {
          await Purchases.syncPurchases();
        }
      })(),
      new Promise<void>((_, reject) => {
        setTimeout(
          () => reject(new Error('refreshCustomerInfoFromStores timeout')),
          REFRESH_FROM_STORE_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    /* timeout, offline, or transient — caller still runs getCustomerInfo */
  }
}

/**
 * Stores allow only one active sub per subscription group; multiple IDs here is a sync anomaly.
 * Reconcile with the store so the user ends up with a single active subscription record.
 */
export async function syncPurchasesIfMultipleActive(): Promise<void> {
  try {
    await initializeRevenueCat();
    let info = await Purchases.getCustomerInfo();
    if (getActiveSubscriptionIds(info).length <= 1) return;
    await Purchases.syncPurchases();
    info = await Purchases.getCustomerInfo();
    if (__DEV__ && getActiveSubscriptionIds(info).length > 1) {
      console.warn(
        '[RevenueCat] Multiple activeSubscriptions after sync:',
        getActiveSubscriptionIds(info)
      );
    }
  } catch {
    /* non-fatal */
  }
}

function hasActiveSubscriptionFallback(
  customerInfo: import('react-native-purchases').CustomerInfo
): boolean {
  const ids = getActiveSubscriptionIds(customerInfo);
  if (ids.length === 0) return false;
  // Prefer entitlement mapping; multiple store rows should not grant access without sync.
  if (ids.length > 1) return false;
  return true;
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

let initPromise: Promise<void> | null = null;

export const OFFERINGS_TIMEOUT_MS = 25000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    tid = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out. Check your internet connection and try again.`
          )
        ),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (tid !== undefined) clearTimeout(tid);
  }
}

function assertPurchasesConfigured(): void {
  if (Platform.OS === 'ios' && !getIosApiKey()) {
    throw new Error(
      'Subscriptions are temporarily unavailable. Please try again in a moment.'
    );
  }
  if (Platform.OS === 'android' && !getAndroidApiKey()) {
    throw new Error(
      'Subscriptions are temporarily unavailable. Please try again in a moment.'
    );
  }
}

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

/** Offerings for dashboard/current offering; null on timeout/error (do not block app access). */
export async function fetchOfferingsOrNull(): Promise<PurchasesOfferings | null> {
  try {
    await initializeRevenueCat();
    return await withTimeout(
      Purchases.getOfferings(),
      OFFERINGS_TIMEOUT_MS,
      'Loading subscription options'
    );
  } catch {
    return null;
  }
}

/** Help article: empty offerings / products not loading from the store. */
export const REVENUECAT_OFFERINGS_HELP_URL = 'https://rev.cat/why-are-offerings-empty';

/** Short copy for alerts — full SDK errors are huge and duplicate this. Details go to the console. */
export const REVENUECAT_USER_FACING_STORE_ERROR =
  'The App Store didn’t return any subscription products for this build. Use TestFlight or a store build (not Expo Go). In RevenueCat and App Store Connect, product IDs must match exactly for bundle com.arnavsaluja.savr, subscriptions must be attached to the app, and the Paid Applications Agreement must be active. New products can take up to 24 hours to appear.';

export async function getCurrentOfferingOrThrow(): Promise<PurchasesOffering> {
  await initializeRevenueCat();
  assertPurchasesConfigured();

  let offerings: PurchasesOfferings;
  try {
    offerings = await withTimeout(
      Purchases.getOfferings(),
      OFFERINGS_TIMEOUT_MS,
      'Loading subscription options'
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[RevenueCat] getOfferings failed:', msg);
    if (
      /app store|storekit|products?|could not be fetched|configuration|revenuecat/i.test(
        msg
      )
    ) {
      throw new Error(REVENUECAT_USER_FACING_STORE_ERROR);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const offeringId = fromEnv('EXPO_PUBLIC_REVENUECAT_OFFERING_ID');
  const offering = offeringId
    ? offerings.all[offeringId] ?? offerings.current
    : offerings.current;
  if (!offering) {
    const keys = Object.keys(offerings.all).join(', ') || 'none';
    console.warn('[RevenueCat] No usable offering. Available offering keys:', keys);
    throw new Error(
      `No subscription plan is available in this build. In RevenueCat, set a current offering with packages linked to live App Store products (${keys}).`
    );
  }
  return offering;
}

export async function showHostedPaywall(): Promise<PAYWALL_RESULT> {
  await getCurrentOfferingOrThrow();
  // Some RN Purchases UI / TurboModule combinations throw when an offering object
  // is bridged through presentPaywall options. Using dashboard current offering
  // avoids that native argument-conversion crash.
  return RevenueCatUI.presentPaywall();
}

export async function isPro(): Promise<boolean> {
  try {
    const { hasPro } = await getProStatusWithInfo();
    return hasPro;
  } catch {
    return false;
  }
}

export async function getProStatusWithInfo(): Promise<{
  hasPro: boolean;
  customerInfo: import('react-native-purchases').CustomerInfo | null;
}> {
  try {
    await syncPurchasesIfMultipleActive();
    const customerInfo = await Purchases.getCustomerInfo();
    const hasPro =
      typeof customerInfo.entitlements.active[PRO_ENTITLEMENT] !== 'undefined' ||
      hasActiveSubscriptionFallback(customerInfo);
    return { hasPro, customerInfo };
  } catch {
    return { hasPro: false, customerInfo: null };
  }
}

export async function restoreAndSync(): Promise<boolean> {
  try {
    await Purchases.restorePurchases();
    return await isPro();
  } catch {
    return false;
  }
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
