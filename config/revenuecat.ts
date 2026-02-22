/**
 * RevenueCat Configuration (reference)
 *
 * Actual init uses lib/revenuecat.ts which reads:
 * - iOS:  EXPO_PUBLIC_RC_IOS_API_KEY or EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
 * - Android: EXPO_PUBLIC_RC_ANDROID_API_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
 * - Web/Expo Go: EXPO_PUBLIC_REVENUECAT_WEB_API_KEY
 *
 * Entitlement: "pro" (must match RevenueCat dashboard)
 * Offering: "default"
 */

export const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_RC_IOS_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '',
  web: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY || '',
};

/** Entitlement identifier (must match RevenueCat dashboard) */
export const ENTITLEMENT_PRO = 'pro';

/** Product identifiers (must match App Store Connect / Play Console) */
export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'subscription_monthly_1',
  annual: 'annual_subscription_1',
  entitlement: ENTITLEMENT_PRO,
} as const;

/** Optional: display / trial config (not enforced by SDK) */
export const SUBSCRIPTION_CONFIG = {
  trialDays: 3,
  monthlyPrice: 4.99,
  yearlyPrice: 39.99,
} as const;
