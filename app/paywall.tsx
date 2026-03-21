/**
 * Paywall Screen - RevenueCat Hosted Paywall (Paywalls V2)
 * Reads trialEndsAt from SubscriptionGate navigation params to show
 * contextual copy: "trial ended" vs "upgrade to unlock".
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
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, router as expoRouter } from 'expo-router';
import { useSubscription } from '../lib/SubscriptionContext';
import { useAuth } from '../lib/AuthContext';
import {
  showHostedPaywall,
  isPro,
  getCurrentOfferingOrThrow,
  logPaywallDiagnostics,
  REVENUECAT_OFFERINGS_HELP_URL,
} from '../lib/revenuecat';
import * as Linking from 'expo-linking';
import { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { APP_FREE_TRIAL_DAYS } from '../lib/freeTrial';
import { markPostVerifyWelcomeDone } from '../lib/postVerifyNavigation';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TrialState = 'expired' | 'active' | 'unknown';

function getTrialState(trialEndsAtParam: string | undefined): TrialState {
  if (!trialEndsAtParam) return 'unknown';
  const trialEnd = new Date(trialEndsAtParam);
  if (isNaN(trialEnd.getTime())) return 'unknown';
  return new Date() < trialEnd ? 'active' : 'expired';
}

function formatTrialEndDate(isoString: string | undefined): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Copy map
// ---------------------------------------------------------------------------

const COPY: Record<TrialState, { title: string; subtitle: string }> = {
  expired: {
    title: 'Your welcome access has ended',
    subtitle: 'Subscribe to continue using Savr Premium.',
  },
  active: {
    title: 'Upgrade to Savr Premium',
    subtitle: 'Get unlimited access to all features.',
  },
  unknown: {
    title: 'Savr Premium',
    subtitle: 'Subscribe to unlock all features.',
  },
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PaywallScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const params = useLocalSearchParams<{
    trialEndsAt?: string | string[];
    welcome?: string | string[];
  }>();
  const rawParam = params.trialEndsAt;
  const trialEndsAtStr = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const welcomeRaw = params.welcome;
  const isWelcomeFlow =
    welcomeRaw === '1' ||
    welcomeRaw === 'true' ||
    (Array.isArray(welcomeRaw) && welcomeRaw[0] === '1');
  const { restorePurchases, getSubscriptionStatus, purchasePackage } =
    useSubscription();

  const [showingPaywall, setShowingPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const trialState = useMemo(() => getTrialState(trialEndsAtStr), [trialEndsAtStr]);
  const trialEndFormatted = useMemo(() => formatTrialEndDate(trialEndsAtStr), [trialEndsAtStr]);
  const copy = COPY[trialState];
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const syncUntilPro = async (): Promise<boolean> => {
    for (let i = 0; i < 4; i += 1) {
      await getSubscriptionStatus();
      if (await isPro()) return true;
      await wait(900);
    }
    return false;
  };

  const handleSubscribe = async () => {
    setShowingPaywall(true);
    try {
      const offering = await getCurrentOfferingOrThrow();
      const isProBefore = await isPro();
      logPaywallDiagnostics(offering, isProBefore);
      const result = await showHostedPaywall();
      const isProAfter =
        result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED
          ? await syncUntilPro()
          : await isPro();
      if (__DEV__) logPaywallDiagnostics(offering, isProAfter);
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        if (isProAfter) {
          router.replace('/(tabs)');
        } else {
          Alert.alert(
            'Purchase still syncing',
            'Your purchase went through, but App Store confirmation is still syncing. Tap Restore Purchases in a few seconds if access does not unlock automatically.'
          );
        }
      } else if (result === PAYWALL_RESULT.NOT_PRESENTED) {
        Alert.alert(
          'Couldn’t Open Plans',
          'We couldn’t show subscription options. Check your internet connection and try again.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Help',
              onPress: () => Linking.openURL(REVENUECAT_OFFERINGS_HELP_URL),
            },
          ]
        );
      }
    } catch (err) {
      if (__DEV__) console.warn('[RevenueCat] handleSubscribe failed:', err);
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
            if (synced) {
              router.replace('/(tabs)');
            } else {
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
          : 'Something went wrong. Check your connection and try again.';
      Alert.alert('Couldn’t Open Plans', message, [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Why is this happening?',
          onPress: () => Linking.openURL(REVENUECAT_OFFERINGS_HELP_URL),
        },
      ]);
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
      } else {
        Alert.alert(
          'No access restored',
          result.error ??
            'We couldn’t find an active App Store subscription for this account. If you have complimentary access, pull to refresh or restart the app.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Restore failed',
        err instanceof Error ? err.message : 'Something went wrong. Check your connection and try again.'
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleContinueToApp = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* optional */
    }
    let uid = user?.id;
    if (!uid) {
      const { data: { user: u } } = await supabase.auth.getUser();
      uid = u?.id;
    }
    if (uid) await markPostVerifyWelcomeDone(uid);
    router.replace('/(tabs)');
  };

  const handleBack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* optional haptics */
    }
    if (isWelcomeFlow) {
      void handleContinueToApp();
      return;
    }
    if (expoRouter.canGoBack()) {
      expoRouter.back();
      return;
    }
    Alert.alert(
      'Subscription required',
      'Savr Premium is required to continue. You can view plans below, restore a purchase, or sign out to use a different account.',
      [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await signOut();
              expoRouter.replace('/welcome');
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#6A9571', '#4A7558']} style={styles.gradient}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={12}
        >
          <Text style={styles.backButtonText}>
            {isWelcomeFlow ? '← Skip for now' : '← Back'}
          </Text>
        </Pressable>

        <View style={styles.content}>
          {isWelcomeFlow ? (
            <>
              <Text style={styles.title}>Welcome to SAVR</Text>
              <Text style={styles.welcomeSubtitle}>
                Your {APP_FREE_TRIAL_DAYS}-day new-member welcome access is active—you have full premium
                features now. This is separate from any introductory pricing in the App Store or Google
                Play. Use View Plans to subscribe anytime; after this period, a subscription keeps premium
                features.
              </Text>
              {trialEndFormatted ? (
                <Text style={styles.trialEndsHighlight}>
                  Welcome access until {trialEndFormatted}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.title}>{copy.title}</Text>
              {trialState === 'expired' && trialEndFormatted && (
                <Text style={styles.trialEndedLabel}>
                  Welcome access ended {trialEndFormatted}
                </Text>
              )}
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </>
          )}

          {isWelcomeFlow ? (
            <TouchableOpacity
              style={styles.continueTrialButton}
              onPress={() => void handleContinueToApp()}
              activeOpacity={0.85}
            >
              <Text style={styles.continueTrialButtonText}>Continue to app</Text>
            </TouchableOpacity>
          ) : null}

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    padding: 32,
    paddingBottom: 48,
  },
  welcomeSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  trialEndsHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 28,
  },
  continueTrialButton: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    marginBottom: 16,
  },
  continueTrialButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  trialEndedLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
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
