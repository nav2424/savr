/**
 * Subscription Gate — paywall after free trial unless user has `pro`.
 *
 * Enable with EXPO_PUBLIC_ENABLE_PAYWALL=true. See app/_layout.tsx.
 *
 * Access (after loading): RevenueCat `pro` OR family premium OR grandfathered OR within FREE_TRIAL_DAYS of auth signup.
 * Missing created_at or auth errors → fail closed (no free trial).
 *
 * Gating waits for: initial subscription bootstrap (not foreground store refresh) and trial check.
 */

import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  useRouter,
  useSegments,
  usePathname,
} from 'expo-router';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { APP_FREE_TRIAL_DAYS } from '../lib/freeTrial';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FREE_TRIAL_MS = APP_FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Route segment names that never require subscription (expo-router file routes). */
const PUBLIC_SEGMENTS = new Set([
  'welcome',
  'auth',
  'onboarding',
  'paywall',
  'email-verification',
  'password-reset',
  'email-verified',
  'join-family',
  'manage-family',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SubscriptionGateProps {
  children: React.ReactNode;
}

function isPublicSegmentPath(segments: string[]): boolean {
  return segments.some((seg) => PUBLIC_SEGMENTS.has(seg));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const {
    hasPremiumAccess,
    isLoading: subscriptionBootstrapping,
  } = useSubscription();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  const [isWithinFreeTrial, setIsWithinFreeTrial] = useState<boolean | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [checkingTrial, setCheckingTrial] = useState(true);

  // Before paint: avoid one frame where user exists but trial is still "resolved" from the logged-out pass.
  useLayoutEffect(() => {
    if (!user) {
      setCheckingTrial(false);
      setIsWithinFreeTrial(false);
      setTrialEndsAt(null);
      return;
    }
    setCheckingTrial(true);
  }, [user]);

  // Trial window from Supabase auth created_at
  useEffect(() => {
    const checkTrialStatus = async () => {
      setCheckingTrial(true);

      if (!user) {
        setIsWithinFreeTrial(false);
        setTrialEndsAt(null);
        setCheckingTrial(false);
        return;
      }

      try {
        const { data: authData, error } = await supabase.auth.getUser();

        if (error) {
          if (
            error.message?.includes('Refresh Token') ||
            error.message?.includes('refresh_token')
          ) {
            setIsWithinFreeTrial(false);
            setTrialEndsAt(null);
            setCheckingTrial(false);
            return;
          }
        }

        if (error || !authData?.user?.created_at) {
          if (__DEV__) {
            console.warn(
              '[SubscriptionGate] Could not retrieve created_at — treating trial as expired.'
            );
          }
          setIsWithinFreeTrial(false);
          setTrialEndsAt(null);
          setCheckingTrial(false);
          return;
        }

        const createdAt = new Date(authData.user.created_at);
        const trialEnd = new Date(createdAt.getTime() + FREE_TRIAL_MS);
        const now = new Date();
        const withinTrial = now < trialEnd;

        setTrialEndsAt(trialEnd);
        setIsWithinFreeTrial(withinTrial);
      } catch (err) {
        console.error('[SubscriptionGate] Trial check failed:', err);
        setIsWithinFreeTrial(false);
        setTrialEndsAt(null);
      } finally {
        setCheckingTrial(false);
      }
    };

    checkTrialStatus();
  }, [user]);

  // Do not block on isPremiumAccessSyncing — foreground store refresh would freeze the UI on every resume.
  const isLoading = subscriptionBootstrapping || checkingTrial;

  const hasAccess = hasPremiumAccess || isWithinFreeTrial === true;
  const shouldShowPaywall = Boolean(user) && !isLoading && !hasAccess;

  useEffect(() => {
    if (isLoading) return;

    const segmentPublic = isPublicSegmentPath(segments as string[]);
    const pathPublic =
      pathname === '/paywall' ||
      (typeof pathname === 'string' && pathname.startsWith('/paywall'));
    const isPublicRoute = segmentPublic || pathPublic;

    if (!user) {
      if (!isPublicRoute) {
        router.replace('/welcome');
      }
      return;
    }

    if (shouldShowPaywall && !isPublicRoute) {
      router.replace({
        pathname: '/paywall',
        params: {
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : '',
        },
      });
    }
  }, [user, shouldShowPaywall, isLoading, segments, pathname, router, trialEndsAt]);

  return (
    <View style={styles.gateRoot}>
      {children}
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#6A9571" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  gateRoot: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...(Platform.OS === 'web' ? { zIndex: 9999 } : {}),
  },
});
