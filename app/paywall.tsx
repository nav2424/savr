/**
 * Paywall Screen - Premium Subscription
 * 
 * ⚠️ TEMPORARILY DISABLED FOR TESTING
 * This screen is currently disabled in the app flow.
 * To re-enable, uncomment SubscriptionProvider and SubscriptionGate in app/_layout.tsx
 * 
 * 3-day FREE trial
 * Then $4.99/month or $39.99/year
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSubscription } from '../lib/SubscriptionContext';
import { PurchasesPackage } from 'react-native-purchases';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: '🧾', title: 'Unlimited Receipts', description: 'Scan all your receipts' },
  { icon: '📦', title: 'Smart Pantry', description: 'Never forget what you have' },
  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // { icon: '🤖', title: 'AI Recipe Generator', description: 'Personalized recipes from your pantry' },
  { icon: '💰', title: 'Budget Tracking', description: 'Track spending & save money' },
  { icon: '📝', title: 'Shopping Lists', description: 'Collaborative lists with family' },
  { icon: '🏷️', title: 'Price Tracking', description: 'Find best deals (coming soon)' },
  { icon: '📊', title: 'Insights & Analytics', description: 'Smart shopping insights' },
  { icon: '🔔', title: 'Smart Notifications', description: 'Never waste food again' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { currentOffering, purchasePackage, restorePurchases, isLoading } = useSubscription();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Detect if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  // Set a timeout for loading state (5 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading || !currentOffering) {
        setLoadingTimeout(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isLoading, currentOffering]);

  // Get packages
  const monthlyPackage = currentOffering?.availablePackages.find(
    pkg => pkg.identifier === '$rc_monthly' || pkg.product.identifier.includes('monthly')
  );
  
  const yearlyPackage = currentOffering?.availablePackages.find(
    pkg => pkg.identifier === '$rc_annual' || pkg.product.identifier.includes('yearly')
  );

  // Calculate savings
  const yearlySavings = monthlyPackage && yearlyPackage
    ? (parseFloat(monthlyPackage.product.priceString.replace('$', '')) * 12) - 
      parseFloat(yearlyPackage.product.priceString.replace('$', ''))
    : 0;

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Select a plan', 'Please choose Monthly or Annual subscription');
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPackage);
      
      if (result.success) {
        Alert.alert(
          '🎉 Welcome to SAVR Premium!',
          'Your 3-day free trial has started. Enjoy unlimited access!',
          [
            {
              text: 'Get Started',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else if (result.error && !result.error.includes('cancelled')) {
        Alert.alert('Purchase Failed', result.error);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      
      if (result.success) {
        Alert.alert(
          '✅ Restored!',
          'Your subscription has been restored.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      } else {
        Alert.alert('No Subscription Found', 'No active subscription to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // Show loading state initially
  if ((isLoading || !currentOffering) && !loadingTimeout) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9571" />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  // If loading failed or timed out, show error/bypass screen
  if (!currentOffering && loadingTimeout) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#6A9571', '#4A7558']}
          style={styles.gradient}
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Subscription Setup Required</Text>
            <Text style={styles.errorMessage}>
              {isExpoGo 
                ? 'RevenueCat Web API key not configured.\n\nThis is expected in Expo Go during development.'
                : 'Unable to load subscription options.\n\nPlease check your connection and try again.'}
            </Text>
            
            {isExpoGo && __DEV__ && (
              <>
                <TouchableOpacity
                  style={styles.bypassButton}
                  onPress={() => {
                    // Direct navigation without confirmation in dev mode
                    console.log('🎉 Bypassing paywall - continuing to app');
                    router.replace('/(tabs)');
                  }}
                >
                  <Text style={styles.bypassButtonText}>Continue in Dev Mode →</Text>
                </TouchableOpacity>
                
                <Text style={styles.devNote}>
                  💡 Add REVENUECAT_WEB_API_KEY to enable subscriptions in Expo Go
                </Text>
              </>
            )}
            
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoadingTimeout(false);
                router.replace('/paywall');
              }}
            >
              <Text style={styles.retryButtonText}>↻ Retry</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#6A9571', '#4A7558']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>SAVR Premium</Text>
            <Text style={styles.subtitle}>Your Smart Grocery Assistant</Text>
          </View>

          {/* Trial Badge */}
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>🎁 3-DAY FREE TRIAL</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing Options */}
          <View style={styles.pricingContainer}>
            <Text style={styles.pricingTitle}>Choose Your Plan</Text>

            {/* Annual Plan */}
            {yearlyPackage && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPackage?.identifier === yearlyPackage.identifier && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPackage(yearlyPackage)}
              >
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>SAVE ${yearlySavings.toFixed(0)}</Text>
                </View>
                
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Annual</Text>
                  <View>
                    <Text style={styles.planPrice}>{yearlyPackage.product.priceString}</Text>
                    <Text style={styles.planPeriod}>per year</Text>
                  </View>
                </View>
                
                <Text style={styles.planDetail}>
                  ${(parseFloat(yearlyPackage.product.priceString.replace('$', '')) / 12).toFixed(2)}/month
                </Text>
                <Text style={styles.planBenefit}>✨ Best Value</Text>
              </TouchableOpacity>
            )}

            {/* Monthly Plan */}
            {monthlyPackage && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPackage?.identifier === monthlyPackage.identifier && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPackage(monthlyPackage)}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>Monthly</Text>
                  <View>
                    <Text style={styles.planPrice}>{monthlyPackage.product.priceString}</Text>
                    <Text style={styles.planPeriod}>per month</Text>
                  </View>
                </View>
                <Text style={styles.planBenefit}>Cancel anytime</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={[styles.subscribeButton, !selectedPackage && styles.subscribeButtonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing || !selectedPackage}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                Start Free Trial
              </Text>
            )}
          </TouchableOpacity>

          {/* Restore Purchases */}
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

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            Start your 3-day free trial. After trial ends, subscription automatically renews unless cancelled at least 24 hours before the end of the trial period. Manage or cancel in account settings.
          </Text>

          {/* Legal Links */}
          <View style={styles.legalLinks}>
            <TouchableOpacity>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>•</Text>
            <TouchableOpacity>
              <Text style={styles.legalText}>Terms of Service</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6A9571',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  trialBadge: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 30,
  },
  trialText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  featuresContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  pricingContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFFFFF',
  },
  savingsBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  planPeriod: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  planDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  planBenefit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  subscribeButton: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A9571',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
  },
  finePrint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 16,
    marginBottom: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  legalText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 12,
  },
  bottomSpacing: {
    height: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  bypassButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 250,
  },
  bypassButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  devNote: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
});

