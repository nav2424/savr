/**
 * RevenueCat Configuration
 *
 * Actual init uses lib/revenuecat.ts which reads:
 * - iOS:  EXPO_PUBLIC_RC_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
 * - Android: EXPO_PUBLIC_RC_ANDROID_API_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
 *
 * Entitlement: "pro" (must match RevenueCat dashboard)
 * Offering:    EXPO_PUBLIC_REVENUECAT_OFFERING_ID (e.g. "sale1")
 */

/** Entitlement identifier (must match RevenueCat dashboard) */
export const ENTITLEMENT_PRO = 'pro';

/** Product identifiers (must match App Store Connect / Play Console) */
export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'subscription_monthly_1',
  annual: 'annual_subscription_1',
  entitlement: ENTITLEMENT_PRO,
} as const;

/**
 * Fallback display values used when the SDK cannot fetch real prices
 * (e.g. on web). On iOS/Android the paywall reads live prices from
 * RevenueCat → App Store Connect / Google Play.
 */
export const FALLBACK_PRICING = {
  trialDays: 3,
  monthlyPrice: 4.99,
  yearlyPrice: 39.99,
} as const;
