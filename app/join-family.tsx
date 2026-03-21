/**
 * Accept a family plan invite (deep link: savr://join-family?code=...)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../lib/AuthContext';
import {
  acceptFamilyInviteWithCode,
  getFamilyInvitePreview,
} from '../lib/family-invites';
import { useSubscription } from '../lib/SubscriptionContext';

export default function JoinFamilyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const raw = params.code;
  const paramCode = Array.isArray(raw) ? raw[0] : raw;
  const { user } = useAuth();
  const { getSubscriptionStatus } = useSubscription();
  const [code, setCode] = useState(paramCode ?? '');
  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ownerFirstName, setOwnerFirstName] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>('SAVR Family Plan');
  const authRoute = code.trim()
    ? (`/auth?next=${encodeURIComponent(`/join-family?code=${code.trim()}`)}` as const)
    : '/auth';

  useEffect(() => {
    const c = code.trim();
    if (!c) {
      setOwnerFirstName(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    void getFamilyInvitePreview(c)
      .then((preview) => {
        if (cancelled) return;
        setOwnerFirstName(preview.ownerFirstName);
        setPlanType(preview.planType || 'SAVR Family Plan');
      })
      .catch((e) => {
        if (cancelled) return;
        setOwnerFirstName(null);
        setPreviewError(
          e instanceof Error
            ? e.message
            : 'We could not verify this invite code yet.'
        );
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const onAccept = useCallback(async () => {
    const c = code.trim();
    if (!c) {
      Alert.alert('Invite code', 'Enter the invite code from your email.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Create an account or sign in with the email that received the invite.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to sign in', onPress: () => router.replace(authRoute) },
      ]);
      return;
    }

    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await acceptFamilyInviteWithCode(c);
      await getSubscriptionStatus({
        refreshFromStore: true,
        skipSyncFlag: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("You're in!", 'You now have access through your family plan.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      Alert.alert(
        'Could not accept invite',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setBusy(false);
    }
  }, [code, user, router, getSubscriptionStatus]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Family invite', headerShown: true }} />
      <View style={styles.inner}>
        <Text style={styles.title}>Join a family plan</Text>
        <Text style={styles.sub}>
          Enter the invite code from your email, then accept. You must be signed in with the same email the
          invitation was sent to.
        </Text>
        {previewLoading ? (
          <View style={styles.previewCard}>
            <ActivityIndicator color="#6A9571" />
            <Text style={styles.previewLoading}>Checking invite details…</Text>
          </View>
        ) : ownerFirstName ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>
              You've been invited by {ownerFirstName} to join their {planType}.
            </Text>
          </View>
        ) : previewError ? (
          <View style={styles.previewCardError}>
            <Text style={styles.previewErrorText}>
              {previewError}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Invite code"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!user && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace(authRoute)}
          >
            <Text style={styles.secondaryBtnText}>Sign in or create account</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          onPress={onAccept}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Accept invitation</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inner: { flex: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 8 : 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  sub: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 24 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: '#ECF4EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CEE1D1',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  previewCardError: {
    backgroundColor: '#FFF3F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2C9C9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  previewText: {
    fontSize: 14,
    color: '#2E5136',
    lineHeight: 20,
    fontWeight: '600',
  },
  previewLoading: {
    fontSize: 13,
    color: '#4B6D53',
  },
  previewErrorText: {
    fontSize: 13,
    color: '#9C3030',
    lineHeight: 18,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#6A9571',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  secondaryBtnText: { color: '#6A9571', fontSize: 16, fontWeight: '600' },
  back: { marginTop: 24 },
  backText: { color: '#6A9571', fontSize: 16 },
});
