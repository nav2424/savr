/**
 * Subscription Gate - Protects App Access
 *
 * To enable paywall: set EXPO_PUBLIC_ENABLE_PAYWALL=true (EAS secrets or .env).
 * app/_layout.tsx wraps content in SubscriptionGate when config.enablePaywall is true.
 *
 * Shows paywall if user is not subscribed.
 * Allows access during 3-day trial and after subscription.
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

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const { isSubscribed, isLoading, getSubscriptionStatus } = useSubscription();
  const segments = useSegments();
  const router = useRouter();
  const [showingPaywall, setShowingPaywall] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Allow these routes without subscription
    const publicRoutes = ['welcome', 'auth', 'onboarding', 'paywall', 'email-verification', 'password-reset'];
    const currentRoute = segments[segments.length - 1] as string;
    const isPublicRoute = publicRoutes.includes(currentRoute);

    // If user is signed in
    if (user) {
      const shouldShowPaywall = !isSubscribed;
      
      if (shouldShowPaywall && !isPublicRoute) {
        // Not subscribed - present hosted paywall (handled in render below)
      }
    } else {
      // Not signed in - send to welcome
      if (!isPublicRoute) {
        router.replace('/welcome');
      }
    }
  }, [user, isSubscribed, isLoading, segments, router]);

  // Show loading while checking subscription status
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    );
  }

  // Block access and show Upgrade button for all unsubscribed users
  const shouldShowPaywall = user && !isSubscribed;
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

