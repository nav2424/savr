/**
 * Subscription Context - Manages RevenueCat subscriptions
 *
 * To enable paywall: set EXPO_PUBLIC_ENABLE_PAYWALL=true (EAS secrets or .env).
 * Entitlement: "pro". Uses RevenueCat hosted paywall only.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI, {
  PAYWALL_RESULT,
  type PresentPaywallParams,
  type PresentCustomerCenterParams,
} from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  getProStatusWithInfo,
  showHostedPaywall as showHostedPaywallLib,
  restoreAndSync as restoreAndSyncLib,
  fetchOfferingsOrNull,
  syncPurchasesIfMultipleActive,
  refreshCustomerInfoFromStores,
  PRO_ENTITLEMENT,
} from './revenuecat';
import { fetchFamilyPremiumOnly, fetchGrandfatheredPremium } from './family';
import { resolveGrandfatheredPremiumForUser } from './grandfatherPremium';
import { getActiveAppFreeTrialEndIso } from './freeTrial';
import { supabase } from './supabase';

export { PAYWALL_RESULT };

function hasProEntitlement(info: CustomerInfo): boolean {
  const hasMappedEntitlement =
    typeof info.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
  if (hasMappedEntitlement) return true;
  const activeSubs = ((info as unknown as { activeSubscriptions?: string[] })
    .activeSubscriptions ?? []) as string[];
  // One subscription group → at most one active store subscription; >1 is a sync anomaly.
  return activeSubs.length === 1;
}

function isFamilyProductIdentifier(productId: string | undefined): boolean {
  if (!productId) return false;
  const normalized = productId.toLowerCase();
  return normalized.includes('family') || normalized.includes('fam');
}

function getHasFamilyPlanSubscriptionFromInfo(
  info: CustomerInfo | null
): boolean {
  if (!info) return false;
  const pro = info.entitlements.active[PRO_ENTITLEMENT];
  return isFamilyProductIdentifier(pro?.productIdentifier);
}

function getTrialDaysRemaining(info: CustomerInfo): number | null {
  const pro = info.entitlements.active[PRO_ENTITLEMENT];
  if (!pro?.expirationDate) return null;
  const now = new Date();
  const exp = new Date(pro.expirationDate);
  const days = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return days <= 3 && days > 0 ? days : null;
}

interface SubscriptionContextType {
  /** Direct RevenueCat `pro` entitlement (purchaser / restore). */
  isSubscribed: boolean;
  /** Premium via accepted family seat + active owner sub (see edge function). */
  hasFamilyPremium: boolean;
  /** Direct purchaser is on a family SKU (e.g. savr_annual_family / savr_monthly_family). */
  hasFamilyPlanSubscription: boolean;
  /** Early-user flag from public.users (lifetime complimentary access). */
  hasGrandfatheredPremium: boolean;
  /** Use for feature gates: own sub OR family OR grandfathered. */
  hasPremiumAccess: boolean;
  /** First boot: RevenueCat + offerings + initial access sync. */
  isLoading: boolean;
  /**
   * True while getSubscriptionStatus is in flight (grandfather + RC + family).
   * SubscriptionGate must wait on this so it never routes to /paywall with stale hasPremiumAccess.
   */
  isPremiumAccessSyncing: boolean;
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  purchasePackage: (
    pkg: PurchasesPackage
  ) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  getSubscriptionStatus: (options?: {
    /** Invalidate RC cache and sync with App Store / Play first (e.g. after cancel in Settings). */
    refreshFromStore?: boolean;
    /** When true, do not toggle isPremiumAccessSyncing (background / resume refresh). */
    skipSyncFlag?: boolean;
  }) => Promise<void>;
  trialDaysRemaining: number | null;
  presentPaywall: (params?: PresentPaywallParams) => Promise<PAYWALL_RESULT>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  /** Returns true if the Customer Center sheet was presented; false if unavailable (caller may open store URLs). */
  presentCustomerCenter: (
    params?: PresentCustomerCenterParams
  ) => Promise<boolean>;
  /**
   * ISO end time for the signup-based welcome access window (auth `created_at` + APP_FREE_TRIAL_DAYS).
   * Null if outside that window, after expiry, or if the user has Store `pro`, family premium, or
   * grandfathered access — so UI never mixes this with paid/complimentary entitlements.
   * Not RevenueCat / App Store intro pricing.
   */
  appFreeTrialEndsAtIso: string | null;
}

const SubscriptionContext =
  createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasFamilyPremium, setHasFamilyPremium] = useState(false);
  const [hasFamilyPlanSubscription, setHasFamilyPlanSubscription] =
    useState(false);
  const [hasGrandfatheredPremium, setHasGrandfatheredPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(
    null
  );
  const [isPremiumAccessSyncing, setIsPremiumAccessSyncing] = useState(false);
  const [appFreeTrialEndsAtIso, setAppFreeTrialEndsAtIso] = useState<
    string | null
  >(null);
  const premiumSyncInFlightRef = useRef(0);
  /** For re-deriving welcome-access trial when RC/family flags change without a full sync. */
  const authCreatedAtRef = useRef<string | undefined>(undefined);
  const lastForegroundStoreRefreshAt = useRef(0);

  const getSubscriptionStatus = useCallback(
    async (options?: {
      refreshFromStore?: boolean;
      skipSyncFlag?: boolean;
    }) => {
    const skipSyncFlag = options?.skipSyncFlag === true;
    if (!skipSyncFlag) {
      premiumSyncInFlightRef.current += 1;
      setIsPremiumAccessSyncing(true);
    }
    try {
      if (options?.refreshFromStore) {
        await refreshCustomerInfoFromStores();
      }
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      let grandfathered = false;
      if (!authUser?.id) {
        authCreatedAtRef.current = undefined;
        setHasGrandfatheredPremium(false);
      } else {
        authCreatedAtRef.current = authUser.created_at;
        grandfathered = await resolveGrandfatheredPremiumForUser(authUser);
        setHasGrandfatheredPremium(grandfathered);
      }

      const { hasPro, customerInfo: info } = await getProStatusWithInfo();
      if (info) {
        setCustomerInfo(info);
        setIsSubscribed(hasPro);
        setHasFamilyPlanSubscription(getHasFamilyPlanSubscriptionFromInfo(info));
        setTrialDaysRemaining(getTrialDaysRemaining(info));
      } else {
        setIsSubscribed(false);
        setHasFamilyPlanSubscription(false);
      }
      let familyPremium = false;
      try {
        if (hasPro) {
          setHasFamilyPremium(false);
        } else {
          familyPremium = await fetchFamilyPremiumOnly();
          setHasFamilyPremium(familyPremium);
        }
      } catch {
        setHasFamilyPremium(false);
      }

      if (!authUser?.id) {
        setAppFreeTrialEndsAtIso(null);
      } else {
        const suppressWelcomeAccessUi =
          grandfathered || hasPro || familyPremium;
        const trialRaw = getActiveAppFreeTrialEndIso(authUser.created_at);
        setAppFreeTrialEndsAtIso(
          suppressWelcomeAccessUi ? null : trialRaw
        );
      }
    } finally {
      if (!skipSyncFlag) {
        premiumSyncInFlightRef.current -= 1;
        if (premiumSyncInFlightRef.current === 0) {
          setIsPremiumAccessSyncing(false);
        }
      }
    }
  },
  []
  );

  // Keep welcome-access ISO in sync when RC listener updates entitlement without a full sync,
  // and restore it after refund if the signup window is still open.
  useEffect(() => {
    if (isSubscribed || hasFamilyPremium || hasGrandfatheredPremium) {
      setAppFreeTrialEndsAtIso(null);
      return;
    }
    const createdAt = authCreatedAtRef.current;
    if (!createdAt) {
      setAppFreeTrialEndsAtIso(null);
      return;
    }
    setAppFreeTrialEndsAtIso(getActiveAppFreeTrialEndIso(createdAt));
  }, [isSubscribed, hasFamilyPremium, hasGrandfatheredPremium]);

  /** Returning from App Store / Play subscription settings must pull fresh CustomerInfo (cancel, renew). */
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundStoreRefreshAt.current < 2000) return;
      lastForegroundStoreRefreshAt.current = now;
      void getSubscriptionStatus({
        refreshFromStore: true,
        skipSyncFlag: true,
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [getSubscriptionStatus]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await initializeRevenueCat();
        if (cancelled) return;
        const offerings = await fetchOfferingsOrNull();
        if (offerings) {
          const extra = (Constants.expoConfig as any)?.extra;
          const offeringId = (
            extra?.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ??
            process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ??
            ''
          )
            .toString()
            .trim();
          const offering = offeringId
            ? offerings.all[offeringId] ?? offerings.current
            : offerings.current;
          if (offering) {
            setCurrentOffering(offering);
            if (__DEV__) {
              const pkgIds = offering.availablePackages.map((p) => p.identifier);
              console.log('[RevenueCat] Loaded offering:', {
                id: offering.identifier,
                packages: pkgIds,
                packageCount: offering.availablePackages.length,
              });
            }
          } else if (__DEV__) {
            console.warn(
              '[RevenueCat] No offering available. Available:',
              Object.keys(offerings.all).join(', ') || 'none'
            );
          }
        } else if (__DEV__) {
          console.warn('[RevenueCat] Offerings unavailable (timeout or error).');
        }
      } catch (error) {
        if (!cancelled && __DEV__) {
          console.warn('[Subscription] RevenueCat init error:', error);
        }
      }
      if (!cancelled) {
        try {
          const BOOTSTRAP_SUB_MS = 22_000;
          await Promise.race([
            getSubscriptionStatus({
              refreshFromStore: false,
              skipSyncFlag: true,
            }),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error('subscription bootstrap timeout')),
                BOOTSTRAP_SUB_MS
              );
            }),
          ]);
        } catch (e) {
          if (__DEV__) console.warn('[Subscription] getSubscriptionStatus failed:', e);
          setIsSubscribed(false);
          setHasFamilyPremium(false);
        }
      }
      if (!cancelled) setIsLoading(false);
      if (!cancelled) {
        void getSubscriptionStatus({
          refreshFromStore: true,
          skipSyncFlag: true,
        });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [getSubscriptionStatus]);

  // Keep premium flags in sync when auth session changes (sign-in/out) without relying on UI timing.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return;
      void getSubscriptionStatus({ refreshFromStore: true });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [getSubscriptionStatus]);

  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      const activeSubs = ((info as unknown as { activeSubscriptions?: string[] })
        .activeSubscriptions ?? []) as string[];
      if (activeSubs.length > 1) {
        void syncPurchasesIfMultipleActive().then(() => {
          void getSubscriptionStatus({ refreshFromStore: true });
        });
        return;
      }
      setCustomerInfo(info);
      const direct = hasProEntitlement(info);
      setIsSubscribed(direct);
      setHasFamilyPlanSubscription(getHasFamilyPlanSubscriptionFromInfo(info));
      setTrialDaysRemaining(getTrialDaysRemaining(info));
      if (direct) {
        setHasFamilyPremium(false);
      } else {
        void fetchFamilyPremiumOnly().then(setHasFamilyPremium);
      }
    };
    const remove = Purchases.addCustomerInfoUpdateListener(listener);
    return () => { if (typeof remove === 'function') remove(); };
  }, [getSubscriptionStatus]);

  const purchasePackage = useCallback(
    async (
      pkg: PurchasesPackage
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await syncPurchasesIfMultipleActive();
        const prior = await Purchases.getCustomerInfo();
        const existing = prior.entitlements.active[PRO_ENTITLEMENT];
        const targetId = pkg.product.identifier;
        if (existing?.productIdentifier === targetId) {
          setCustomerInfo(prior);
          setIsSubscribed(hasProEntitlement(prior));
          setHasFamilyPlanSubscription(getHasFamilyPlanSubscriptionFromInfo(prior));
          return { success: true };
        }
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        setIsSubscribed(hasProEntitlement(info));
        setHasFamilyPlanSubscription(getHasFamilyPlanSubscriptionFromInfo(info));
        return { success: true };
      } catch (error: unknown) {
        const err = error as { userCancelled?: boolean; message?: string };
        if (err.userCancelled) {
          return { success: false, error: 'Purchase cancelled' };
        }
        return {
          success: false,
          error: err.message || 'Failed to complete purchase',
        };
      }
    },
    []
  );

  const restorePurchases = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    await restoreAndSyncLib();
    await getSubscriptionStatus({ refreshFromStore: true });
    const { hasPro } = await getProStatusWithInfo();
    if (hasPro) return { success: true };
    if (await fetchGrandfatheredPremium()) return { success: true };
    return { success: false, error: 'No active subscription found' };
  }, [getSubscriptionStatus]);

  const presentPaywall = useCallback(
    async (params?: PresentPaywallParams): Promise<PAYWALL_RESULT> => {
      try {
        const result = await showHostedPaywallLib();
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          await getSubscriptionStatus({ refreshFromStore: true });
        }
        return result;
      } catch {
        return PAYWALL_RESULT.NOT_PRESENTED;
      }
    },
    [getSubscriptionStatus]
  );

  const presentPaywallIfNeeded = useCallback(async (): Promise<PAYWALL_RESULT> => {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: PRO_ENTITLEMENT,
        offering: currentOffering ?? undefined,
        displayCloseButton: true,
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await getSubscriptionStatus({ refreshFromStore: true });
      }
      return result;
    } catch {
      return PAYWALL_RESULT.NOT_PRESENTED;
    }
  }, [currentOffering, getSubscriptionStatus]);

  const presentCustomerCenter = useCallback(
    async (params?: PresentCustomerCenterParams): Promise<boolean> => {
      try {
        await RevenueCatUI.presentCustomerCenter(params);
        await getSubscriptionStatus({ refreshFromStore: true });
        return true;
      } catch {
        return false;
      }
    },
    [getSubscriptionStatus]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        hasFamilyPremium,
        hasFamilyPlanSubscription,
        hasGrandfatheredPremium,
        hasPremiumAccess:
          isSubscribed || hasFamilyPremium || hasGrandfatheredPremium,
        isLoading,
        isPremiumAccessSyncing,
        currentOffering,
        customerInfo,
        purchasePackage,
        restorePurchases,
        getSubscriptionStatus,
        trialDaysRemaining,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        appFreeTrialEndsAtIso,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export { PRO_ENTITLEMENT };
