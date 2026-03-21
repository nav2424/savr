/**
 * Owner: manage family seats (invite, list, remove).
 * Requires direct RevenueCat family-plan subscription (owner).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../lib/AuthContext';
import { useSubscription } from '../lib/SubscriptionContext';
import { supabase } from '../lib/supabase';
import {
  ensureFamilyPlanId,
  listFamilyMembers,
  removeFamilyMember,
  sendFamilyInviteEmail,
  type FamilyMemberRow,
} from '../lib/family-invites';

export default function ManageFamilyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasFamilyPlanSubscription } = useSubscription();
  const [members, setMembers] = useState<FamilyMemberRow[]>([]);
  const [maxSeats, setMaxSeats] = useState(5);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !hasFamilyPlanSubscription) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const id = await ensureFamilyPlanId(user.id);
      const { data: plan } = await supabase
        .from('family_plans')
        .select('max_seats')
        .eq('id', id)
        .single();
      setMaxSeats(typeof plan?.max_seats === 'number' ? plan.max_seats : 5);
      const list = await listFamilyMembers(id);
      setMembers(list.filter((m) => m.status !== 'removed'));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load family plan');
    } finally {
      setLoading(false);
    }
  }, [user?.id, hasFamilyPlanSubscription]);

  useEffect(() => {
    load();
  }, [load]);

  const onInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email', 'Enter a valid email address.');
      return;
    }
    setInviting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await sendFamilyInviteEmail(email);
      setInviteEmail('');
      await load();
      Alert.alert(
        'Invite sent',
        res.emailSent
          ? 'We emailed them a link to join.'
          : `Invite created. Share this link or code manually:\n${res.joinUrl ?? res.inviteCode ?? ''}`
      );
    } catch (e) {
      Alert.alert('Invite failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setInviting(false);
    }
  };

  const onRemove = (row: FamilyMemberRow) => {
    Alert.alert(
      'Remove member',
      row.invite_email ?? 'This member',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFamilyMember(row.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Remove failed');
            }
          },
        },
      ]
    );
  };

  if (!hasFamilyPlanSubscription) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Family plan', headerShown: true }} />
        <View style={styles.center}>
          <Text style={styles.blockTitle}>Family plan required</Text>
          <Text style={styles.blockText}>
            Only the account with an active Savr family plan can invite and manage members.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const used = members.filter((m) => m.status === 'pending' || m.status === 'accepted').length;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage family', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.seats}>
          Seats used: {used}/{maxSeats}
        </Text>

        <Text style={styles.label}>Invite by email</Text>
        <TextInput
          style={styles.input}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="family@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.primaryBtn, inviting && styles.btnDisabled]}
          onPress={onInvite}
          disabled={inviting}
        >
          {inviting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Send invite</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.section}>Members</Text>
        {loading ? (
          <ActivityIndicator color="#6A9571" style={{ marginTop: 24 }} />
        ) : (
          members.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowEmail}>{m.invite_email ?? m.member_id ?? '—'}</Text>
                <Text style={styles.rowMeta}>
                  {m.status === 'pending' ? 'Pending' : 'Accepted'}
                  {m.status === 'pending' ? ` · code ${m.invite_code.slice(0, 8)}…` : ''}
                </Text>
              </View>
              {(m.status === 'pending' || m.status === 'accepted') && (
                <TouchableOpacity onPress={() => onRemove(m)}>
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  blockTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  blockText: { fontSize: 15, color: '#666', marginBottom: 20 },
  seats: { fontSize: 16, fontWeight: '700', marginBottom: 20, color: '#1A1A1A' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#6A9571',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 28,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#1A1A1A' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  rowEmail: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  rowMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  remove: { color: '#C62828', fontWeight: '600', fontSize: 14 },
  back: { marginTop: 24 },
  backText: { color: '#6A9571', fontSize: 16 },
});
