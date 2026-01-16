/**
 * RevenueCat Configuration
 * 
 * Add your RevenueCat API keys here or in .env file
 */

export const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'appl_YOUR_IOS_KEY_HERE',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'goog_YOUR_ANDROID_KEY_HERE',
  web: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY || 'rcb_YOUR_WEB_KEY_HERE', // For Expo Go / Browser Mode
};

export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'savr_premium_monthly',
  yearly: 'savr_premium_yearly',
  entitlement: 'premium', // The entitlement identifier in RevenueCat
};

export const SUBSCRIPTION_CONFIG = {
  trialDays: 3,
  monthlyPrice: 4.99,
  yearlyPrice: 39.99,
};

