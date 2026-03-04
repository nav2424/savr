/**
 * Subscription Gate - Protects App Access
 *
 * Active only when EXPO_PUBLIC_ENABLE_PAYWALL=true.
 * Blocks non-subscribed authenticated users from accessing protected routes.
 * Shows the RevenueCat hosted paywall on native, or a fallback screen on web.
 */

import React, { useState } from 'react';
import { useSegments } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  showHostedPaywall,
  isPro,
  isConfigured,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
} from '../lib/revenuecat';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = [
  'welcome',
  'auth',
  'onboarding',
  'paywall',
  'email-verification',
  'password-reset',
];

const PREMIUM_FEATURES = [
  { icon: '📸', label: 'Unlimited receipt scanning' },
  { icon: '🥬', label: 'Unlimited pantry items' },
  { icon: '🧠', label: 'AI-powered recipe suggestions' },
  { icon: '💰', label: 'Advanced budget tracking' },
  { icon: '👨‍👩‍👧‍👦', label: 'Collaborative grocery lists' },
  { icon: '🔔', label: 'Smart expiry notifications' },
  { icon: '📊', label: 'Price tracking & alerts' },
];

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const { isSubscribed, isLoading, getSubscriptionStatus, paywallEnabled } = useSubscription();
  const segments = useSegments();
  const [showingPaywall, setShowingPaywall] = useState(false);

  if (!paywallEnabled) return <>{children}</>;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    );
  }

  const currentRoute = segments[segments.length - 1] as string;
  const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute);

  if (user && !isSubscribed && !isPublicRoute) {
    const handleUpgrade = async () => {
      if (!isConfigured()) {
        // On web / unsupported platforms, there is no native paywall to show
        if (__DEV__) console.info('[SubscriptionGate] SDK not configured – cannot present paywall');
        return;
      }

      setShowingPaywall(true);
      try {
        const offering = await getCurrentOfferingOrThrow();
        const isProBefore = await isPro();
        logPaywallDiagnostics(offering, isProBefore);

        const result = await showHostedPaywall();

        const isProAfter = await isPro();
        if (__DEV__) logPaywallDiagnostics(offering, isProAfter);

        if (result === 'PURCHASED' || result === 'RESTORED') {
          await getSubscriptionStatus();
        }
      } catch (err) {
        if (__DEV__) console.warn('[SubscriptionGate] handleUpgrade failed:', err);
      } finally {
        setShowingPaywall(false);
      }
    };

    return (
      <LinearGradient colors={['#6A9571', '#4A7558']} style={styles.paywallBlock}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.paywallBlockContent}>
            <Text style={styles.paywallIcon}>✨</Text>
            <Text style={styles.paywallBlockTitle}>SAVR Premium</Text>
            <Text style={styles.paywallBlockSubtitle}>
              Unlock the full power of smart grocery management
            </Text>

            <View style={styles.featuresContainer}>
              {PREMIUM_FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.paywallBlockButton}
              onPress={handleUpgrade}
              disabled={showingPaywall}
            >
              {showingPaywall ? (
                <ActivityIndicator color="#6A9571" />
              ) : (
                <Text style={styles.paywallBlockButtonText}>View Plans</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={async () => {
                setShowingPaywall(true);
                try {
                  const { restoreAndSync } = await import('../lib/revenuecat');
                  const hasPro = await restoreAndSync();
                  if (hasPro) await getSubscriptionStatus();
                } catch {
                  // ignore
                } finally {
                  setShowingPaywall(false);
                }
              }}
              disabled={showingPaywall}
            >
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  paywallBlockContent: {
    alignItems: 'center',
    padding: 32,
  },
  paywallIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  paywallBlockTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  paywallBlockSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  featureLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  paywallBlockButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 16,
  },
  paywallBlockButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A9571',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textDecorationLine: 'underline',
  },
});
