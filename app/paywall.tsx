/**
 * Paywall Screen
 *
 * Standalone paywall screen accessible from navigation.
 * On native (iOS/Android) it presents the RevenueCat hosted paywall.
 * On web or when SDK is unavailable it shows a local feature comparison.
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
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSubscription } from '../lib/SubscriptionContext';
import {
  showHostedPaywall,
  isPro,
  isConfigured,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
} from '../lib/revenuecat';

const FEATURES = [
  { icon: '📸', title: 'Receipt Scanning', free: '3 / month', premium: 'Unlimited' },
  { icon: '🥬', title: 'Pantry Items', free: '25 items', premium: 'Unlimited' },
  { icon: '🧠', title: 'AI Recipes', free: '5 / month', premium: 'Unlimited' },
  { icon: '💰', title: 'Budget Tracking', free: 'Basic', premium: 'Advanced' },
  { icon: '👨‍👩‍👧‍👦', title: 'Collaborative Lists', free: '1 list', premium: 'Unlimited' },
  { icon: '🔔', title: 'Expiry Alerts', free: '-', premium: 'Yes' },
  { icon: '📊', title: 'Price Tracking', free: '-', premium: 'Yes' },
  { icon: '🎯', title: 'Priority Support', free: '-', premium: 'Yes' },
];

const MONTHLY_PRICE = 4.99;
const YEARLY_PRICE = 39.99;
const TRIAL_DAYS = 3;

export default function PaywallScreen() {
  const router = useRouter();
  const { restorePurchases, getSubscriptionStatus, sdkAvailable, paywallEnabled } = useSubscription();
  const [showingPaywall, setShowingPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isConfigured()) {
      setError(
        Platform.OS === 'web'
          ? 'Subscriptions are only available in the iOS and Android apps.'
          : 'Unable to load subscription options. Please check your internet connection and try again.'
      );
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
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (__DEV__) console.warn('[Paywall] handleSubscribe failed:', err);
      setError('Unable to load subscription options. Please try again.');
    } finally {
      setShowingPaywall(false);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        await getSubscriptionStatus();
        router.replace('/(tabs)');
      } else {
        setError('No active subscription found.');
      }
    } catch {
      setError('Failed to restore purchases. Please try again.');
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
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heroIcon}>✨</Text>
          <Text style={styles.title}>SAVR Premium</Text>
          <Text style={styles.subtitle}>
            Unlock the full power of smart grocery management
          </Text>

          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <Text style={[styles.comparisonHeaderText, { flex: 1 }]}>Feature</Text>
              <Text style={[styles.comparisonHeaderText, styles.columnHeader]}>Free</Text>
              <Text style={[styles.comparisonHeaderText, styles.columnHeader, styles.premiumColumn]}>Premium</Text>
            </View>
            {FEATURES.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.comparisonRow,
                  index === FEATURES.length - 1 && styles.comparisonRowLast,
                ]}
              >
                <View style={styles.featureNameCol}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={styles.featureName}>{feature.title}</Text>
                </View>
                <Text style={styles.freeValue}>{feature.free}</Text>
                <Text style={styles.premiumValue}>{feature.premium}</Text>
              </View>
            ))}
          </View>

          <View style={styles.pricingRow}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Monthly</Text>
              <Text style={styles.priceAmount}>${MONTHLY_PRICE.toFixed(2)}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <View style={[styles.priceCard, styles.priceCardHighlight]}>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>Save 33%</Text>
              </View>
              <Text style={styles.priceLabel}>Annual</Text>
              <Text style={styles.priceAmount}>${(YEARLY_PRICE / 12).toFixed(2)}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
              <Text style={styles.billedAs}>Billed ${YEARLY_PRICE.toFixed(2)}/year</Text>
            </View>
          </View>

          {TRIAL_DAYS > 0 && (
            <Text style={styles.trialText}>
              Start with a {TRIAL_DAYS}-day free trial
            </Text>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
            disabled={showingPaywall}
          >
            {showingPaywall ? (
              <ActivityIndicator color="#6A9571" />
            ) : (
              <Text style={styles.subscribeButtonText}>Start Free Trial</Text>
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

          <Text style={styles.legalText}>
            Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
            Subscription auto-renews unless canceled at least 24 hours before the end of the current period.
          </Text>
        </ScrollView>
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
  backButtonText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroIcon: { fontSize: 56, marginBottom: 12, marginTop: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 24, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  comparisonCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  comparisonHeaderText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  columnHeader: { width: 70, textAlign: 'center' },
  premiumColumn: { color: '#FFD700' },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  comparisonRowLast: { borderBottomWidth: 0 },
  featureNameCol: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  featureIcon: { fontSize: 16, marginRight: 8 },
  featureName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  freeValue: { width: 70, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  premiumValue: { width: 70, fontSize: 12, color: '#FFD700', fontWeight: '600', textAlign: 'center' },
  pricingRow: { flexDirection: 'row', marginBottom: 16, width: '100%', maxWidth: 380 },
  priceCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginHorizontal: 6,
  },
  priceCardHighlight: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.12)' },
  saveBadge: { position: 'absolute', top: -10, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  saveBadgeText: { fontSize: 11, fontWeight: '800', color: '#1A1A1A' },
  priceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 4, marginTop: 4 },
  priceAmount: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  pricePeriod: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  billedAs: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  trialText: { fontSize: 15, fontWeight: '600', color: '#FFD700', marginBottom: 20, textAlign: 'center' },
  errorContainer: { backgroundColor: 'rgba(255,107,107,0.2)', borderRadius: 10, padding: 12, marginBottom: 16, width: '100%', maxWidth: 380 },
  errorText: { fontSize: 14, color: '#FFD2D2', textAlign: 'center' },
  subscribeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 14,
    minWidth: 240,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeButtonText: { fontSize: 18, fontWeight: '700', color: '#6A9571' },
  restoreButton: { paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
  restoreButtonText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' },
  legalText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 16, maxWidth: 320 },
});
