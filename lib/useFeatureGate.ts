/**
 * Feature gating hook for premium features.
 *
 * When the paywall is enabled and the user is not subscribed, premium
 * features are locked. Call `requirePremium()` before executing a
 * premium action — it returns `true` if access is granted, or
 * presents the paywall and returns `false` if the user needs to subscribe.
 *
 * Usage:
 *   const { isPremiumFeature, requirePremium } = useFeatureGate();
 *   const handleScan = async () => {
 *     if (!(await requirePremium())) return;
 *     // ... proceed with scan
 *   };
 */

import { useCallback } from 'react';
import { useSubscription } from './SubscriptionContext';

export type PremiumFeature =
  | 'receipt_scanning'
  | 'ai_recipes'
  | 'budget_tracking'
  | 'collaborative_lists'
  | 'price_tracking'
  | 'unlimited_pantry';

export function useFeatureGate() {
  const { isSubscribed, paywallEnabled, presentPaywall } = useSubscription();

  const isPremiumFeature = useCallback(
    (_feature: PremiumFeature): boolean => {
      if (!paywallEnabled) return false;
      return !isSubscribed;
    },
    [paywallEnabled, isSubscribed]
  );

  const requirePremium = useCallback(
    async (_feature?: PremiumFeature): Promise<boolean> => {
      if (!paywallEnabled || isSubscribed) return true;

      const result = await presentPaywall();
      return result === 'PURCHASED' || result === 'RESTORED';
    },
    [paywallEnabled, isSubscribed, presentPaywall]
  );

  return {
    isPremiumFeature,
    requirePremium,
    isSubscribed: !paywallEnabled || isSubscribed,
    paywallEnabled,
  };
}
