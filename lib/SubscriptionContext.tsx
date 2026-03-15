/**
 * Subscription Context - Manages RevenueCat subscriptions
 *
 * To enable paywall: set EXPO_PUBLIC_ENABLE_PAYWALL=true (EAS secrets or .env).
 * Entitlement defaults to "pro" (configurable). Uses RevenueCat hosted paywall only.
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
import RevenueCatUI, {
  PAYWALL_RESULT,
  type PresentPaywallParams,
  type PresentCustomerCenterParams,
} from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  getActiveProEntitlement,
  getProStatusWithInfo,
  selectConfiguredOffering,
  showHostedPaywall as showHostedPaywallLib,
  restoreAndSync as restoreAndSyncLib,
  PRO_ENTITLEMENT,
} from './revenuecat';

export { PAYWALL_RESULT };

function hasProEntitlement(info: CustomerInfo): boolean {
  return !!getActiveProEntitlement(info);
}

function getTrialDaysRemaining(info: CustomerInfo): number | null {
  const pro = getActiveProEntitlement(info);
  if (!pro?.expirationDate) return null;
  const now = new Date();
  const exp = new Date(pro.expirationDate);
  const days = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return days <= 3 && days > 0 ? days : null;
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  purchasePackage: (
    pkg: PurchasesPackage
  ) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  getSubscriptionStatus: () => Promise<void>;
  trialDaysRemaining: number | null;
  presentPaywall: (params?: PresentPaywallParams) => Promise<PAYWALL_RESULT>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  presentCustomerCenter: (
    params?: PresentCustomerCenterParams
  ) => Promise<void>;
}

const SubscriptionContext =
  createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(
    null
  );

  const getSubscriptionStatus = useCallback(async () => {
    const { hasPro, customerInfo: info } = await getProStatusWithInfo();
    if (info) {
      setCustomerInfo(info);
      setIsSubscribed(hasPro);
      setTrialDaysRemaining(getTrialDaysRemaining(info));
    } else {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await initializeRevenueCat();
        if (cancelled) return;
        const offerings = await Purchases.getOfferings();
        const selectedOffering = selectConfiguredOffering(offerings);
        if (selectedOffering) {
          setCurrentOffering(selectedOffering);
        }
        await getSubscriptionStatus();
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
  }, [getSubscriptionStatus]);

  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      setIsSubscribed(hasProEntitlement(info));
      setTrialDaysRemaining(getTrialDaysRemaining(info));
    };
    const remove = Purchases.addCustomerInfoUpdateListener(listener);
    return () => { if (typeof remove === 'function') remove(); };
  }, []);

  const purchasePackage = useCallback(
    async (
      pkg: PurchasesPackage
    ): Promise<{ success: boolean; error?: string }> => {
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
    const hasPro = await restoreAndSyncLib();
    await getSubscriptionStatus();
    return hasPro ? { success: true } : { success: false, error: 'No active subscription found' };
  }, [getSubscriptionStatus]);

  const presentPaywall = useCallback(
    async (params?: PresentPaywallParams): Promise<PAYWALL_RESULT> => {
      try {
        const result = await showHostedPaywallLib();
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          await getSubscriptionStatus();
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
        await getSubscriptionStatus();
      }
      return result;
    } catch {
      return PAYWALL_RESULT.NOT_PRESENTED;
    }
  }, [currentOffering, getSubscriptionStatus]);

  const presentCustomerCenter = useCallback(
    async (params?: PresentCustomerCenterParams): Promise<void> => {
      try {
        await RevenueCatUI.presentCustomerCenter(params);
        await getSubscriptionStatus();
      } catch {
        // Ignore (e.g. Expo Go)
      }
    },
    [getSubscriptionStatus]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isLoading,
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
