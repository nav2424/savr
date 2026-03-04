/**
 * Paywall Screen
 *
 * On native (iOS/Android) this screen reads live prices from RevenueCat
 * (which pulls them from App Store Connect / Google Play), then presents
 * the RevenueCat hosted paywall for the configured offering.
 *
 * On web the SDK cannot fetch real prices, so fallback display values are
 * shown and the "Start Free Trial" button explains that subscriptions
 * require the native app.
 */

import React, { useState, useMemo } from 'react';
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
import { FALLBACK_PRICING } from '../config/revenuecat';

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

function extractPricing(offering: import('react-native-purchases').PurchasesOffering | null) {
  if (!offering) return null;

  const packages = offering.availablePackages ?? [];
  let monthlyPkg = packages.find(
    (p) => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly'
  );
  let annualPkg = packages.find(
    (p) => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual'
  );

  if (!monthlyPkg && !annualPkg && packages.length > 0) {
    monthlyPkg = packages[0];
  }

  const monthlyPrice = monthlyPkg?.product?.price ?? null;
  const monthlyPriceString = monthlyPkg?.product?.priceString ?? null;
  const annualPrice = annualPkg?.product?.price ?? null;
  const annualPriceString = annualPkg?.product?.priceString ?? null;

  const introPrice = monthlyPkg?.product?.introPrice ?? annualPkg?.product?.introPrice ?? null;
  const trialDays = introPrice?.periodNumberOfUnits != null && introPrice?.periodUnit === 'DAY'
    ? introPrice.periodNumberOfUnits
    : introPrice?.periodNumberOfUnits != null && introPrice?.periodUnit === 'WEEK'
      ? introPrice.periodNumberOfUnits * 7
      : null;

  return {
    monthlyPrice,
    monthlyPriceString,
    annualPrice,
    annualPriceString,
    trialDays,
    monthlyPkg,
    annualPkg,
  };
}

export default function PaywallScreen() {
  const router = useRouter();
  const {
    restorePurchases,
    getSubscriptionStatus,
    currentOffering,
    paywallEnabled,
  } = useSubscription();
  const [showingPaywall, setShowingPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveP = useMemo(() => extractPricing(currentOffering), [currentOffering]);

  const monthlyPrice = liveP?.monthlyPrice ?? FALLBACK_PRICING.monthlyPrice;
  const monthlyLabel = liveP?.monthlyPriceString ?? `$${FALLBACK_PRICING.monthlyPrice.toFixed(2)}`;
  const annualPrice = liveP?.annualPrice ?? FALLBACK_PRICING.yearlyPrice;
  const annualPerMonth = annualPrice / 12;
  const annualLabel = liveP?.annualPriceString ?? `$${FALLBACK_PRICING.yearlyPrice.toFixed(2)}`;
  const trialDays = liveP?.trialDays ?? FALLBACK_PRICING.trialDays;
  const savingsPercent = monthlyPrice > 0
    ? Math.round((1 - annualPerMonth / monthlyPrice) * 100)
    : 33;

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

          {/* Feature comparison */}
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

          {/* Pricing — live from App Store Connect via RevenueCat, or fallback */}
          <View style={styles.pricingRow}>
            {liveP?.monthlyPkg && (
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>Monthly</Text>
                <Text style={styles.priceAmount}>{monthlyLabel}</Text>
                <Text style={styles.pricePeriod}>/month</Text>
              </View>
            )}
            {!liveP?.monthlyPkg && (
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>Monthly</Text>
                <Text style={styles.priceAmount}>${monthlyPrice.toFixed(2)}</Text>
                <Text style={styles.pricePeriod}>/month</Text>
              </View>
            )}

            <View style={[styles.priceCard, styles.priceCardHighlight]}>
              {savingsPercent > 0 && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save {savingsPercent}%</Text>
                </View>
              )}
              <Text style={styles.priceLabel}>Annual</Text>
              <Text style={styles.priceAmount}>${annualPerMonth.toFixed(2)}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
              <Text style={styles.billedAs}>Billed {annualLabel}/year</Text>
            </View>
          </View>

          {trialDays > 0 && (
            <Text style={styles.trialText}>
              Start with a {trialDays}-day free trial
            </Text>
          )}

          {liveP && (
            <Text style={styles.liveLabel}>
              Prices from App Store{currentOffering ? ` (${currentOffering.identifier})` : ''}
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
              <Text style={styles.subscribeButtonText}>
                {trialDays > 0 ? 'Start Free Trial' : 'Subscribe Now'}
              </Text>
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
  trialText: { fontSize: 15, fontWeight: '600', color: '#FFD700', marginBottom: 8, textAlign: 'center' },
  liveLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' },
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
