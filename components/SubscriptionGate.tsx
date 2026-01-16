/**
 * Subscription Gate - Protects App Access
 * 
 * ⚠️ TEMPORARILY DISABLED FOR TESTING
 * This component is currently disabled in the app flow.
 * To re-enable, uncomment SubscriptionGate in app/_layout.tsx
 * 
 * Shows paywall if user is not subscribed
 * Allows access during 3-day trial and after subscription
 * 
 * NOTE: In development/Expo Go, paywall is DISABLED for existing users
 * Only new signups (created in last 5 minutes) see the paywall
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const { isSubscribed, isLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [checkingNewUser, setCheckingNewUser] = useState(true);

  // Detect if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  // Check if user is newly created (within last 5 minutes)
  useEffect(() => {
    const checkIfNewUser = async () => {
      if (!user) {
        setCheckingNewUser(false);
        return;
      }

      try {
        // Get user's auth metadata
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        // Handle refresh token errors gracefully
        if (authError) {
          if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
            // Invalid refresh token - assume existing user (don't block access)
            setIsNewUser(false);
            setCheckingNewUser(false);
            return;
          }
          // Other auth errors - assume existing user
          setIsNewUser(false);
          setCheckingNewUser(false);
          return;
        }
        
        if (authData.user?.created_at) {
          const createdAt = new Date(authData.user.created_at);
          const now = new Date();
          const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          
          // Consider "new" if created within last 5 minutes
          setIsNewUser(minutesSinceCreation < 5);
          
          if (__DEV__) {
            console.log(`User created ${minutesSinceCreation.toFixed(1)} minutes ago - ${minutesSinceCreation < 5 ? 'NEW' : 'EXISTING'} user`);
          }
        }
      } catch (error) {
        console.error('Error checking user creation time:', error);
        // On error, assume existing user (don't block access)
        setIsNewUser(false);
      } finally {
        setCheckingNewUser(false);
      }
    };

    checkIfNewUser();
  }, [user]);

  useEffect(() => {
    if (isLoading || checkingNewUser) return;

    // Allow these routes without subscription
    const publicRoutes = ['welcome', 'auth', 'onboarding', 'paywall', 'email-verification'];
    const currentRoute = segments[segments.length - 1] as string;
    const isPublicRoute = publicRoutes.includes(currentRoute);

    // If user is signed in
    if (user) {
      // DEVELOPMENT MODE: Skip paywall for existing users or in Expo Go
      if (isExpoGo && __DEV__) {
        if (!isNewUser && !isPublicRoute) {
          // Existing user in Expo Go dev mode - allow access
          console.log('🎉 Dev Mode: Existing user - bypassing paywall');
          return;
        }
      }

      // Check if subscribed OR if user is existing (not new)
      const shouldShowPaywall = !isSubscribed && isNewUser !== false;
      
      if (shouldShowPaywall && !isPublicRoute) {
        // Not subscribed AND is a new user - show paywall
        router.replace('/paywall');
      }
    } else {
      // Not signed in - send to welcome
      if (!isPublicRoute) {
        router.replace('/welcome');
      }
    }
  }, [user, isSubscribed, isLoading, segments, isNewUser, checkingNewUser, isExpoGo]);

  // Show loading while checking subscription and user status
  if (isLoading || checkingNewUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
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
});

