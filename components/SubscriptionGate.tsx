/**
 * Subscription Gate - Protects App Access
 *
 * To enable paywall: set EXPO_PUBLIC_ENABLE_PAYWALL=true (EAS secrets or .env).
 * app/_layout.tsx wraps content in SubscriptionGate when config.enablePaywall is true.
 *
 * Shows paywall if user is not subscribed.
 * Allows access during 3-day trial and after subscription.
 *
 * NOTE: In development/Expo Go, paywall is DISABLED for existing users;
 * only new signups (created in last 5 minutes) see the paywall.
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  showHostedPaywall,
  isPro,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
} from '../lib/revenuecat';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from '../lib/supabase';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const { isSubscribed, isLoading, getSubscriptionStatus } = useSubscription();
  const segments = useSegments();
  const router = useRouter();
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [checkingNewUser, setCheckingNewUser] = useState(true);
  const [showingPaywall, setShowingPaywall] = useState(false);

  // Check if user is newly created (within last 5 minutes)
  useEffect(() => {
    const checkIfNewUser = async () => {
      if (!user) {
        setCheckingNewUser(false);
        return;
      }

      try {
        // Get user's auth metadata
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        // Handle refresh token errors gracefully
        if (authError) {
          if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
            // Invalid refresh token - assume existing user (don't block access)
            setIsNewUser(false);
            setCheckingNewUser(false);
            return;
          }
          // Other auth errors - assume existing user
          setIsNewUser(false);
          setCheckingNewUser(false);
          return;
        }
        
        if (authData.user?.created_at) {
          const createdAt = new Date(authData.user.created_at);
          const now = new Date();
          const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          
          // Consider "new" if created within last 5 minutes
          setIsNewUser(minutesSinceCreation < 5);
          
          if (__DEV__) {
            console.log(`User created ${minutesSinceCreation.toFixed(1)} minutes ago - ${minutesSinceCreation < 5 ? 'NEW' : 'EXISTING'} user`);
          }
        }
      } catch (error) {
        console.error('Error checking user creation time:', error);
        // On error, assume existing user (don't block access)
        setIsNewUser(false);
      } finally {
        setCheckingNewUser(false);
      }
    };

    checkIfNewUser();
  }, [user]);

  useEffect(() => {
    if (isLoading || checkingNewUser) return;

    // Allow these routes without subscription
    const publicRoutes = ['welcome', 'auth', 'onboarding', 'paywall', 'email-verification', 'password-reset'];
    const currentRoute = segments[segments.length - 1] as string;
    const isPublicRoute = publicRoutes.includes(currentRoute);

    // If user is signed in
    if (user) {
      // Check if subscribed OR if user is existing (not new)
      const shouldShowPaywall = !isSubscribed && isNewUser !== false;
      
      if (shouldShowPaywall && !isPublicRoute) {
        // Not subscribed AND is a new user - present hosted paywall (handled in render below)
      }
    } else {
      // Not signed in - send to welcome
      if (!isPublicRoute) {
        router.replace('/welcome');
      }
    }
  }, [user, isSubscribed, isLoading, segments, isNewUser, checkingNewUser]);

  // Show loading while checking subscription and user status
  if (isLoading || checkingNewUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    );
  }

  // Block access and show Upgrade button for unsubscribed new users
  const shouldShowPaywall = user && !isSubscribed && isNewUser !== false;
  const currentRoute = segments[segments.length - 1] as string;
  const isPublicRoute = ['welcome', 'auth', 'onboarding', 'paywall', 'email-verification', 'password-reset'].includes(currentRoute);

  if (shouldShowPaywall && !isPublicRoute) {
    const handleUpgrade = async () => {
      setShowingPaywall(true);
      try {
        const offering = await getCurrentOfferingOrThrow();
        const isProBefore = await isPro();
        logPaywallDiagnostics(offering, isProBefore);

        const result = await showHostedPaywall();

        const isProAfter = await isPro();
        if (__DEV__) logPaywallDiagnostics(offering, isProAfter);

        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          await getSubscriptionStatus();
        }
      } catch (err) {
        if (__DEV__) console.warn('[RevenueCat] handleUpgrade failed:', err);
      } finally {
        setShowingPaywall(false);
      }
    };

    return (
      <LinearGradient colors={['#6A9571', '#4A7558']} style={styles.paywallBlock}>
        <View style={styles.paywallBlockContent}>
          <Text style={styles.paywallBlockTitle}>SAVR Premium</Text>
          <Text style={styles.paywallBlockSubtitle}>Subscribe to unlock all features</Text>
          <TouchableOpacity
            style={styles.paywallBlockButton}
            onPress={handleUpgrade}
            disabled={showingPaywall}
          >
            {showingPaywall ? (
              <ActivityIndicator color="#6A9571" />
            ) : (
              <Text style={styles.paywallBlockButtonText}>Upgrade</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  paywallBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paywallBlockContent: {
    alignItems: 'center',
    padding: 40,
  },
  paywallBlockTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  paywallBlockSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 32,
  },
  paywallBlockButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  paywallBlockButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A9571',
  },
});

