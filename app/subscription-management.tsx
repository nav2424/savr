/**
 * Subscription Management Screen
 * Shows subscription status, plan details, and manage options
 * 
 * ⚠️ TEMPORARILY DISABLED FOR TESTING
 * This screen is currently disabled in the app flow.
 * To re-enable, uncomment SubscriptionProvider and SubscriptionGate in app/_layout.tsx
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
  Linking,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../lib/SubscriptionContext';

export default function SubscriptionManagementScreen() {
  const router = useRouter();
  const { 
    isSubscribed, 
    customerInfo, 
    trialDaysRemaining,
    restorePurchases,
    currentOffering 
  } = useSubscription();
  
  const [restoring, setRestoring] = useState(false);

  // Get active subscription info
  const activeEntitlement = customerInfo?.entitlements.active['premium'];
  const subscriptionType = activeEntitlement?.productIdentifier.includes('yearly') 
    ? 'Annual' 
    : 'Monthly';
  const expirationDate = activeEntitlement?.expirationDate 
    ? new Date(activeEntitlement.expirationDate)
    : null;
  const willRenew = activeEntitlement?.willRenew || false;

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    
    if (result.success) {
      Alert.alert('Success', 'Your subscription has been restored!');
    } else {
      Alert.alert('No Subscription Found', 'No active subscription to restore.');
    }
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleUpgrade = () => {
    router.push('/paywall');
  };

  if (!isSubscribed) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Subscription',
            headerStyle: { backgroundColor: '#6A9571' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <View style={styles.notSubscribedContainer}>
          <Text style={styles.notSubscribedIcon}>🔒</Text>
          <Text style={styles.notSubscribedTitle}>No Active Subscription</Text>
          <Text style={styles.notSubscribedText}>
            Subscribe to unlock all SAVR features
          </Text>
          
          <TouchableOpacity style={styles.subscribeButton} onPress={handleUpgrade}>
            <Text style={styles.subscribeButtonText}>View Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.restoreButtonAlt} 
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#6A9571" size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerStyle: { backgroundColor: '#6A9571' },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Active Subscription Card */}
        <LinearGradient
          colors={['#6A9571', '#4A7558']}
          style={styles.activeCard}
        >
          <Text style={styles.activeIcon}>✨</Text>
          <Text style={styles.activeTitle}>SAVR Premium</Text>
          <Text style={styles.activeSubtitle}>Active Subscription</Text>
          
          {trialDaysRemaining !== null && trialDaysRemaining > 0 && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>
                🎁 {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left in trial
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Subscription Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plan</Text>
            <Text style={styles.detailValue}>{subscriptionType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {willRenew ? '✅ Active' : '⚠️ Expires Soon'}
              </Text>
            </View>
          </View>

          {expirationDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {willRenew ? 'Renews' : 'Expires'}
              </Text>
              <Text style={styles.detailValue}>
                {expirationDate.toLocaleDateString()}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Auto-Renew</Text>
            <Text style={styles.detailValue}>
              {willRenew ? 'On' : 'Off'}
            </Text>
          </View>
        </View>

        {/* Features Included */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Included</Text>
          
          {[
            '✅ Unlimited receipt scanning',
            '✅ Unlimited pantry items',
            '✅ Unlimited AI recipes',
            '✅ Advanced budget tracking',
            '✅ Collaborative lists',
            '✅ Smart notifications',
            '✅ Price tracking (coming soon)',
            '✅ Priority support',
          ].map((feature, index) => (
            <Text key={index} style={styles.featureText}>
              {feature}
            </Text>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleManageSubscription}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>⚙️</Text>
              <Text style={styles.actionText}>Manage Subscription</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          {subscriptionType === 'Monthly' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleUpgrade}
            >
              <View style={styles.actionLeft}>
                <Text style={styles.actionIcon}>💎</Text>
                <Text style={styles.actionText}>Upgrade to Annual (Save 33%)</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRestore}
            disabled={restoring}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>🔄</Text>
              {restoring ? (
                <ActivityIndicator color="#6A9571" size="small" />
              ) : (
                <Text style={styles.actionText}>Restore Purchases</Text>
              )}
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            To cancel your subscription, go to your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account settings. 
            Cancellation takes effect at the end of your current billing period.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  activeCard: {
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  activeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  activeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  activeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  trialBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  trialText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  detailLabel: {
    fontSize: 15,
    color: '#666',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  statusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  featureText: {
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 12,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 24,
    color: '#6A9571',
  },
  infoCard: {
    backgroundColor: '#F5F5F5',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  notSubscribedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notSubscribedIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  notSubscribedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  notSubscribedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  subscribeButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButtonAlt: {
    paddingVertical: 12,
  },
  restoreButtonText: {
    color: '#6A9571',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

