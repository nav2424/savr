/**
 * Subscription Management Screen
 * Shows subscription status, plan details, and manage options.
 * Paywall/subscription flow is enabled when EXPO_PUBLIC_ENABLE_PAYWALL=true.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Linking,
  AppState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../lib/SubscriptionContext';
import {
  showHostedPaywall,
  isPro,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
  PRO_ENTITLEMENT,
  REVENUECAT_OFFERINGS_HELP_URL,
} from '../lib/revenuecat';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import {
  formatAppFreeTrialRemaining,
  formatAppFreeTrialEndDate,
  clipExpiredAppFreeTrialEndForUi,
} from '../lib/freeTrial';

export default function SubscriptionManagementScreen() {
  const router = useRouter();
  const {
    isSubscribed,
    hasFamilyPremium,
    hasFamilyPlanSubscription,
    hasGrandfatheredPremium,
    hasPremiumAccess,
    customerInfo,
    trialDaysRemaining,
    appFreeTrialEndsAtIso,
    restorePurchases,
    purchasePackage,
    presentCustomerCenter,
    getSubscriptionStatus,
  } = useSubscription();

  const [restoring, setRestoring] = useState(false);
  const [welcomeAccessTick, setWelcomeAccessTick] = useState(0);
  const [isSyncingPurchase, setIsSyncingPurchase] = useState(false);

  const welcomeAccessEndIso = useMemo(
    () => clipExpiredAppFreeTrialEndForUi(appFreeTrialEndsAtIso),
    [appFreeTrialEndsAtIso, welcomeAccessTick]
  );

  useEffect(() => {
    if (!appFreeTrialEndsAtIso) return undefined;
    const intervalId = setInterval(() => setWelcomeAccessTick((n) => n + 1), 60_000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setWelcomeAccessTick((n) => n + 1);
      }
    });
    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [appFreeTrialEndsAtIso]);
  useFocusEffect(
    React.useCallback(() => {
      void getSubscriptionStatus({
        refreshFromStore: true,
        skipSyncFlag: true,
      });
    }, [getSubscriptionStatus])
  );
  const [openingPlans, setOpeningPlans] = useState(false);

  const activeEntitlement =
    customerInfo?.entitlements.active[PRO_ENTITLEMENT];
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const syncUntilPro = async (): Promise<boolean> => {
    setIsSyncingPurchase(true);
    for (let i = 0; i < 4; i += 1) {
      await getSubscriptionStatus();
      if (await isPro()) {
        setIsSyncingPurchase(false);
        return true;
      }
      await wait(900);
    }
    setIsSyncingPurchase(false);
    return false;
  };
  const productId = activeEntitlement?.productIdentifier ?? '';
  const isAnnualPlan =
    productId.includes('annual') || productId === 'annual_subscription_1';
  const subscriptionType = hasFamilyPlanSubscription
    ? isAnnualPlan
      ? 'Family · Annual'
      : 'Family · Monthly'
    : isAnnualPlan
      ? 'Annual'
      : 'Monthly';
  const expirationDate = activeEntitlement?.expirationDate
    ? new Date(activeEntitlement.expirationDate)
    : null;
  const willRenew = activeEntitlement?.willRenew || false;
  const expirationMs = expirationDate?.getTime();
  const cancelledButStillActive =
    !willRenew &&
    expirationMs !== undefined &&
    !Number.isNaN(expirationMs) &&
    expirationMs > Date.now();

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

  const openStoreSubscriptionsSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleManageSubscription = async () => {
    const opened = await presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: async () => {
          await restorePurchases();
        },
      },
    });
    if (!opened) {
      openStoreSubscriptionsSettings();
    }
  };

  /** Hosted paywall: subscribe, upgrade, or change plan (StoreKit / Play apply eligibility rules). */
  const handleOpenPlansPaywall = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* Haptics unavailable on some simulators / iPad configurations */
    }

    setOpeningPlans(true);
    try {
      const offering = await getCurrentOfferingOrThrow();
      const isProBefore = await isPro();
      logPaywallDiagnostics(offering, isProBefore);

      const result = await showHostedPaywall();
      const isProAfter =
        result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED
          ? await syncUntilPro()
          : await isPro();
      if (__DEV__) {
        logPaywallDiagnostics(offering, isProAfter);
      }

      if (result === PAYWALL_RESULT.NOT_PRESENTED) {
        Alert.alert(
          'Unable to Load Subscription',
          'We could not open the subscription screen. Check your connection, then try again. If this continues, update the app from the App Store.'
        );
      } else if (
        (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) &&
        !isProAfter
      ) {
        Alert.alert(
          'Purchase still syncing',
          'Your purchase went through, but confirmation is still syncing. Tap Restore Purchases in a few seconds if access does not unlock automatically.'
        );
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[RevenueCat] handleOpenPlansPaywall failed:', err);
      }
      const isBridgeArgError =
        err instanceof Error &&
        err.message.includes('RCTPromiseResolveBlock');
      if (isBridgeArgError) {
        const offering = await getCurrentOfferingOrThrow().catch(() => null);
        const monthly =
          offering?.monthly ??
          offering?.availablePackages.find((p) =>
            p.identifier.toLowerCase().includes('monthly')
          ) ??
          offering?.availablePackages[0];
        if (monthly) {
          const purchase = await purchasePackage(monthly);
          if (purchase.success) {
            const synced = await syncUntilPro();
            if (!synced) {
              Alert.alert(
                'Purchase still syncing',
                'Your purchase completed, but confirmation is still syncing. Tap Restore Purchases in a few seconds if access is still locked.'
              );
            }
            return;
          }
          if (purchase.error && purchase.error !== 'Purchase cancelled') {
            Alert.alert('Couldn’t complete purchase', purchase.error);
            return;
          }
        }
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong loading subscription options. Check your internet connection and try again.';
      Alert.alert('Couldn’t Open Plans', message, [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Why is this happening?',
          onPress: () => Linking.openURL(REVENUECAT_OFFERINGS_HELP_URL),
        },
      ]);
    } finally {
      setOpeningPlans(false);
    }
  };

  const BackHeader = () => (
    <View style={styles.header}>
      <Pressable
        style={styles.backButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Subscription</Text>
    </View>
  );

  if (!hasPremiumAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Subscription',
            headerStyle: { backgroundColor: '#6A9571' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <BackHeader />
        <View style={styles.notSubscribedContainer}>
          <Text style={styles.notSubscribedIcon}>
            {welcomeAccessEndIso ? '⏱️' : '🔒'}
          </Text>
          <Text style={styles.notSubscribedTitle}>
            {welcomeAccessEndIso
              ? 'Welcome access active'
              : 'No Active Subscription'}
          </Text>
          {welcomeAccessEndIso ? (
            <View style={styles.appTrialBanner}>
              <Text style={styles.appTrialBannerPrimary}>
                {formatAppFreeTrialRemaining(welcomeAccessEndIso)}
              </Text>
              <Text style={styles.appTrialBannerSecondary}>
                Full premium features until {formatAppFreeTrialEndDate(welcomeAccessEndIso)}. This
                new-member access is from SAVR and is separate from introductory pricing in the App
                Store or Google Play.
              </Text>
            </View>
          ) : (
            <Text style={styles.notSubscribedText}>
              Subscribe to unlock all SAVR features
            </Text>
          )}
          {isSyncingPurchase ? (
            <View style={styles.syncingBadge}>
              <ActivityIndicator color="#6A9571" size="small" />
              <Text style={styles.syncingBadgeText}>Syncing purchase…</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleOpenPlansPaywall}
            activeOpacity={0.8}
            disabled={openingPlans}
          >
            {openingPlans ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>View Plans</Text>
            )}
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
          <TouchableOpacity
            style={styles.restoreButtonAlt}
            onPress={handleManageSubscription}
          >
            <Text style={styles.restoreButtonText}>
              Manage billing & cancellations
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasGrandfatheredPremium && !isSubscribed && !hasFamilyPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Subscription',
            headerStyle: { backgroundColor: '#6A9571' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <BackHeader />
        <View style={styles.notSubscribedContainer}>
          <Text style={styles.notSubscribedIcon}>🎁</Text>
          <Text style={styles.notSubscribedTitle}>Complimentary lifetime access</Text>
          <Text style={styles.notSubscribedText}>
            Thank you for being an early SAVR member — you have full premium access at no charge. No subscription
            is required on your account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasFamilyPremium && !isSubscribed) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Subscription',
            headerStyle: { backgroundColor: '#6A9571' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <BackHeader />
        <View style={styles.notSubscribedContainer}>
          <Text style={styles.notSubscribedIcon}>👨‍👩‍👧</Text>
          <Text style={styles.notSubscribedTitle}>SAVR Premium (Family)</Text>
          <Text style={styles.notSubscribedText}>
            You have access through a family plan. Billing and plan changes are managed by the subscriber who
            invited you.
          </Text>
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
      <BackHeader />
      <ScrollView style={styles.scrollView}>
        <LinearGradient
          colors={['#6A9571', '#4A7558']}
          style={styles.activeCard}
        >
          <Text style={styles.activeIcon}>✨</Text>
          <Text style={styles.activeTitle}>
            {hasFamilyPlanSubscription ? 'SAVR Premium (Family)' : 'SAVR Premium'}
          </Text>
          <Text style={styles.activeSubtitle}>
            {cancelledButStillActive
              ? 'Cancelled — premium until period ends'
              : 'Active Subscription'}
          </Text>

          {trialDaysRemaining !== null && trialDaysRemaining > 0 && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>
                🎁 Store intro pricing: {trialDaysRemaining}{' '}
                {trialDaysRemaining === 1 ? 'day' : 'days'} left
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plan</Text>
            <Text style={styles.detailValue}>{subscriptionType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                cancelledButStillActive && styles.statusBadgeCancelled,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  cancelledButStillActive && styles.statusTextCancelled,
                ]}
              >
                {willRenew
                  ? '✅ Active'
                  : cancelledButStillActive
                    ? '🔕 Cancelled (access until end date)'
                    : '⚠️ Expires Soon'}
              </Text>
            </View>
          </View>

          {expirationDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {willRenew ? 'Renews' : 'Access until'}
              </Text>
              <Text style={styles.detailValue}>
                {expirationDate.toLocaleDateString()}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Auto-Renew</Text>
            <Text style={styles.detailValue}>
              {willRenew
                ? 'On'
                : cancelledButStillActive
                  ? 'Off (not renewing)'
                  : 'Off'}
            </Text>
          </View>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <Text style={styles.sectionHint}>
            Manage renewals and cancellations in your store account. Switch
            monthly ↔ annual from plans.
          </Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleManageSubscription}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>⚙️</Text>
              <View style={styles.actionTextBlock}>
                <Text style={styles.actionText}>Manage subscription</Text>
                <Text style={styles.actionSubtext}>
                  Billing, cancel, restore — RevenueCat or App Store / Play
                </Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          {hasFamilyPlanSubscription ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                try {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {
                  /* optional */
                }
                router.push('/manage-family');
              }}
            >
              <View style={styles.actionLeft}>
                <Text style={styles.actionIcon}>👨‍👩‍👧</Text>
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionText}>Manage family sharing</Text>
                  <Text style={styles.actionSubtext}>
                    Invites, seats, and who has access on your family plan
                  </Text>
                </View>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenPlansPaywall}
            disabled={openingPlans}
          >
            <View style={styles.actionLeft}>
              <Text style={styles.actionIcon}>💎</Text>
              <View style={styles.actionTextBlock}>
                <Text style={styles.actionText}>Change plan</Text>
                <Text style={styles.actionSubtext}>
                  {openingPlans
                    ? 'Opening plans…'
                    : 'View plans — upgrade or downgrade when the store allows'}
                </Text>
              </View>
            </View>
            {openingPlans ? (
              <ActivityIndicator color="#6A9571" size="small" />
            ) : (
              <Text style={styles.actionArrow}>›</Text>
            )}
          </TouchableOpacity>

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

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            To cancel your subscription, go to your{' '}
            {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account
            settings. Cancellation takes effect at the end of your current
            billing period.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6A9571',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
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
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
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
  statusBadgeCancelled: {
    backgroundColor: '#FFF3E0',
  },
  statusTextCancelled: {
    color: '#E65100',
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
  actionTextBlock: {
    flex: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  actionSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    lineHeight: 16,
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
  appTrialBanner: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.35)',
  },
  appTrialBannerPrimary: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3D5C45',
    textAlign: 'center',
    marginBottom: 6,
  },
  appTrialBannerSecondary: {
    fontSize: 14,
    color: '#5A5A5A',
    textAlign: 'center',
    lineHeight: 20,
  },
  syncingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.35)',
  },
  syncingBadgeText: {
    color: '#3D5C45',
    fontWeight: '600',
    fontSize: 13,
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
