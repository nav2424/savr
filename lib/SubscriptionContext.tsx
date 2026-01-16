/**
 * Subscription Context - Manages RevenueCat subscriptions
 * 
 * ⚠️ TEMPORARILY DISABLED FOR TESTING
 * This context is currently disabled in the app flow.
 * To re-enable, uncomment SubscriptionProvider in app/_layout.tsx
 * 
 * Model: 3-day free trial, then $4.99/month or $39.99/year
 * No free tier - Premium only app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { REVENUECAT_API_KEYS, SUBSCRIPTION_PRODUCTS } from '../config/revenuecat';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  currentOffering: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  getSubscriptionStatus: () => Promise<void>;
  trialDaysRemaining: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      // Detect if running in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      
      if (isExpoGo) {
        // In Expo Go, use Browser Mode with Web API key
        console.log('Expo Go app detected. Using RevenueCat in Browser Mode.');
        await Purchases.configure({ apiKey: REVENUECAT_API_KEYS.web });
      } else {
        // In production/development builds, use native API keys
        if (Platform.OS === 'ios') {
          await Purchases.configure({ apiKey: REVENUECAT_API_KEYS.ios });
        } else {
          await Purchases.configure({ apiKey: REVENUECAT_API_KEYS.android });
        }
      }

      // Set debug mode in development
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Get current offerings
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setCurrentOffering(offerings.current);
      }

      // Check subscription status
      await getSubscriptionStatus();
    } catch (error) {
      console.error('Error initializing purchases:', error);
      // In Expo Go or if configuration fails, set loading to false but don't crash
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Invalid API key') || errorMessage.includes('credentials issue')) {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('⚠️  REVENUECAT WEB API KEY NEEDED');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 You\'re running in Expo Go (Browser Mode)');
          console.log('🔑 Get your Web API key from RevenueCat Dashboard:');
          console.log('   → Project Settings → API Keys → Web/Browser');
          console.log('\n📝 Then add it to your config:');
          console.log('   Option 1: Create .env file with:');
          console.log('   REVENUECAT_WEB_API_KEY=rcb_YOUR_KEY_HERE');
          console.log('\n   Option 2: Update config/revenuecat.ts:');
          console.log('   web: "rcb_YOUR_KEY_HERE"');
          console.log('\n💡 App will work without it, but subscriptions disabled');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getSubscriptionStatus = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);

      // Check if user has active premium entitlement
      const hasActiveSubscription = 
        typeof info.entitlements.active['premium'] !== 'undefined';
      
      setIsSubscribed(hasActiveSubscription);

      // Calculate trial days remaining
      if (hasActiveSubscription) {
        const premiumEntitlement = info.entitlements.active['premium'];
        const expirationDate = premiumEntitlement?.expirationDate;
        
        if (expirationDate) {
          const now = new Date();
          const expiration = new Date(expirationDate);
          const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // If still in trial (less than 7 days from purchase)
          if (daysRemaining <= 3 && daysRemaining > 0) {
            setTrialDaysRemaining(daysRemaining);
          } else {
            setTrialDaysRemaining(null);
          }
        }
      }
    } catch (error) {
      console.error('Error getting subscription status:', error);
      setIsSubscribed(false);
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<{ success: boolean; error?: string }> => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);

      const hasActiveSubscription = 
        typeof info.entitlements.active['premium'] !== 'undefined';
      
      setIsSubscribed(hasActiveSubscription);

      return { success: true };
    } catch (error: any) {
      console.error('Error purchasing package:', error);
      
      // Check if user cancelled
      if (error.userCancelled) {
        return { success: false, error: 'Purchase cancelled' };
      }

      return { 
        success: false, 
        error: error.message || 'Failed to complete purchase' 
      };
    }
  };

  const restorePurchases = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const hasActiveSubscription = 
        typeof info.entitlements.active['premium'] !== 'undefined';
      
      setIsSubscribed(hasActiveSubscription);

      if (hasActiveSubscription) {
        return { success: true };
      } else {
        return { success: false, error: 'No active subscription found' };
      }
    } catch (error: any) {
      console.error('Error restoring purchases:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to restore purchases' 
      };
    }
  };

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

