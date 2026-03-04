/**
 * Subscription Context - Manages RevenueCat subscriptions
 *
 * To enable paywall: set EXPO_PUBLIC_ENABLE_PAYWALL=true (EAS secrets or .env).
 * Entitlement: "pro". Uses RevenueCat hosted paywall only.
 *
 * When the paywall feature flag is off, or on unsupported platforms (web),
 * all users are treated as subscribed so the app works without restrictions.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  isNativePlatform,
  isConfigured,
  getProStatusWithInfo,
  showHostedPaywall as showHostedPaywallLib,
  restoreAndSync as restoreAndSyncLib,
  PRO_ENTITLEMENT,
} from './revenuecat';
import { config } from '../config';

function hasProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[PRO_ENTITLEMENT] !== 'undefined';
}

function computeTrialDaysRemaining(info: CustomerInfo): number | null {
  const pro = info.entitlements.active[PRO_ENTITLEMENT];
  if (!pro?.expirationDate) return null;
  const now = new Date();
  const exp = new Date(pro.expirationDate);
  const days = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return days <= 3 && days > 0 ? days : null;
}

export interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  paywallEnabled: boolean;
  sdkAvailable: boolean;
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  purchasePackage: (
    pkg: PurchasesPackage
  ) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  getSubscriptionStatus: () => Promise<void>;
  trialDaysRemaining: number | null;
  presentPaywall: () => Promise<string>;
  presentPaywallIfNeeded: () => Promise<string>;
  presentCustomerCenter: () => Promise<void>;
}

const SubscriptionContext =
  createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const paywallEnabled = config.enablePaywall;
  const platformSupported = isNativePlatform();

  const [sdkAvailable, setSdkAvailable] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(!paywallEnabled);
  const [isLoading, setIsLoading] = useState(paywallEnabled && platformSupported);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(
    null
  );

  const getSubscriptionStatus = useCallback(async () => {
    if (!isConfigured()) return;
    const { hasPro, customerInfo: info } = await getProStatusWithInfo();
    if (info) {
      setCustomerInfo(info);
      setIsSubscribed(hasPro);
      setTrialDaysRemaining(computeTrialDaysRemaining(info));
    } else {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!paywallEnabled || !platformSupported) {
      setIsSubscribed(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const configured = await initializeRevenueCat();
        if (cancelled) return;
        setSdkAvailable(configured);

        if (configured) {
          const offerings = await Purchases.getOfferings();
          if (offerings.current) {
            setCurrentOffering(offerings.current);
          }
          await getSubscriptionStatus();
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        if (!cancelled && __DEV__) {
          console.warn('[Subscription] Init error:', error);
        }
        setIsSubscribed(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [paywallEnabled, platformSupported, getSubscriptionStatus]);

  useEffect(() => {
    if (!paywallEnabled || !platformSupported) return;

    let remove: (() => void) | undefined;
    const setup = async () => {
      if (!isConfigured()) return;
      try {
        const listener = (info: CustomerInfo) => {
          setCustomerInfo(info);
          setIsSubscribed(hasProEntitlement(info));
          setTrialDaysRemaining(computeTrialDaysRemaining(info));
        };
        remove = Purchases.addCustomerInfoUpdateListener(listener) as unknown as (() => void);
      } catch {
        // SDK not available
      }
    };
    setup();
    return () => { if (typeof remove === 'function') remove(); };
  }, [paywallEnabled, platformSupported]);

  const purchasePackage = useCallback(
    async (
      pkg: PurchasesPackage
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isConfigured()) {
        return { success: false, error: 'Purchases SDK not available on this platform' };
      }
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        setIsSubscribed(hasProEntitlement(info));
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
    if (!isConfigured()) {
      return { success: false, error: 'Purchases SDK not available on this platform' };
    }
    const hasPro = await restoreAndSyncLib();
    await getSubscriptionStatus();
    return hasPro ? { success: true } : { success: false, error: 'No active subscription found' };
  }, [getSubscriptionStatus]);

  const presentPaywall = useCallback(async (): Promise<string> => {
    try {
      const result = await showHostedPaywallLib();
      if (result === 'PURCHASED' || result === 'RESTORED') {
        await getSubscriptionStatus();
      }
      return result;
    } catch {
      return 'NOT_PRESENTED';
    }
  }, [getSubscriptionStatus]);

  const presentPaywallIfNeeded = useCallback(async (): Promise<string> => {
    if (!isConfigured()) return 'NOT_PRESENTED';
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: PRO_ENTITLEMENT,
        offering: currentOffering ?? undefined,
        displayCloseButton: true,
      });
      return result as string;
    } catch {
      return 'NOT_PRESENTED';
    }
  }, [currentOffering, getSubscriptionStatus]);

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    if (!isConfigured()) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      await getSubscriptionStatus();
    } catch {
      // Ignore (e.g. web / Expo Go)
    }
  }, [getSubscriptionStatus]);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isLoading,
        paywallEnabled,
        sdkAvailable,
        currentOffering,
        customerInfo,
        purchasePackage,
        restorePurchases,
        getSubscriptionStatus,
        trialDaysRemaining,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
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
