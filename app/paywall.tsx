/**
 * Paywall Screen - RevenueCat Hosted Paywall (Paywalls V2)
 * Direct call to showHostedPaywall. EAS dev build / TestFlight only.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSubscription } from '../lib/SubscriptionContext';
import {
  showHostedPaywall,
  isPro,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
} from '../lib/revenuecat';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';

export default function PaywallScreen() {
  const router = useRouter();
  const { restorePurchases, getSubscriptionStatus } = useSubscription();
  const [showingPaywall, setShowingPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleSubscribe = async () => {
    setShowingPaywall(true);
    try {
      const offering = await getCurrentOfferingOrThrow();
      const isProBefore = await isPro();
      logPaywallDiagnostics(offering, isProBefore);

      const result = await showHostedPaywall();

      const isProAfter = await isPro();
      if (__DEV__) logPaywallDiagnostics(offering, isProAfter);

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        if (isProAfter) {
          await getSubscriptionStatus();
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('[RevenueCat] handleSubscribe failed:', err);
    } finally {
      setShowingPaywall(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        await getSubscriptionStatus();
        router.replace('/(tabs)');
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#6A9571', '#4A7558']} style={styles.gradient}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.content}>
          <Text style={styles.title}>SAVR Premium</Text>
          <Text style={styles.subtitle}>Subscribe to unlock all features</Text>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
            disabled={showingPaywall}
          >
            {showingPaywall ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>View Plans</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    marginLeft: 8,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 40,
    textAlign: 'center',
  },
  subscribeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 24,
  },
  subscribeButtonText: { fontSize: 18, fontWeight: '700', color: '#6A9571' },
  restoreButton: { paddingVertical: 12, alignItems: 'center' },
  restoreButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textDecorationLine: 'underline',
  },
});
