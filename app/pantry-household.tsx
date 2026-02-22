// SAVR Shared Pantry (Household) - Manage household members, invite, join by code
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useHousehold } from '../lib/HouseholdContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { Ionicons } from '@expo/vector-icons'

export default function PantryHouseholdScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    currentHousehold,
    households,
    members,
    loading,
    membersLoading,
    error,
    setActiveHousehold,
    refreshHouseholds,
    joinByCode,
    leaveHousehold,
    removeMember,
    regenerateShareCode,
    updateHouseholdName,
  } = useHousehold()
  const { showToast } = useToast()

  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  useEffect(() => {
    refreshHouseholds()
  }, [])

  const handleJoinHousehold = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      showToast('Enter a share code.', { kind: 'warning' })
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setJoinLoading(true)
    try {
      const household = await joinByCode(code)
      if (household) {
        showToast(`Joined ${household.name}!`, { kind: 'success' })
        setJoinCode('')
        router.back()
      } else {
        showToast('Invalid or expired code. Try again.', { kind: 'error', durationMs: 3500 })
      }
    } catch (e) {
      showToast('Failed to join household.', { kind: 'error', durationMs: 3500 })
    } finally {
      setJoinLoading(false)
    }
  }

  const handleShareCode = async () => {
    if (!currentHousehold?.share_code) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await Share.share({
        message: `Join my shared pantry on SAVR! Use code: ${currentHousehold.share_code}`,
        title: 'Join my SAVR pantry',
      })
    } catch {}
  }

  const startEditingName = () => {
    if (!currentHousehold) return
    setEditNameValue(currentHousehold.name || '')
    setEditingName(true)
  }

  const saveHouseholdName = async () => {
    if (!currentHousehold || !editNameValue.trim()) {
      setEditingName(false)
      return
    }
    setNameSaving(true)
    const updated = await updateHouseholdName(currentHousehold.id, editNameValue.trim())
    setNameSaving(false)
    setEditingName(false)
    if (updated) showToast('Household name updated.', { kind: 'success' })
    else showToast('Could not update name.', { kind: 'error' })
  }

  const cancelEditingName = () => {
    setEditingName(false)
    setEditNameValue('')
  }

  const handleRegenerateCode = () => {
    if (!currentHousehold) return
    Alert.alert(
      'Regenerate share code?',
      'The old code will stop working. Anyone with the new code can join.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setRegenerating(true)
            const newCode = await regenerateShareCode(currentHousehold.id)
            setRegenerating(false)
            if (newCode) showToast('New share code generated.', { kind: 'success' })
            else showToast('Failed to regenerate code.', { kind: 'error' })
          },
        },
      ]
    )
  }

  const handleLeaveHousehold = () => {
    if (!currentHousehold) return
    Alert.alert(
      'Leave household?',
      'You will no longer see this shared pantry. Your personal data is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const { error: err } = await leaveHousehold(currentHousehold.id)
            if (err) showToast(err.message || 'Could not leave.', { kind: 'error' })
            else {
              showToast('Left household. You can join another or share your pantry.', { kind: 'success', durationMs: 4000 })
              // Stay on Shared Pantry; context already refreshed — user sees Join + their own household
            }
          },
        },
      ]
    )
  }

  const isOwner = currentHousehold && user?.id === currentHousehold.owner_id

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <LinearGradient colors={['#FEFCF6', '#E9F1EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Shared Pantry</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.content, styles.centered]}>
          <Text style={styles.sectionTitle}>Sign in to sync your pantry</Text>
          <Text style={[styles.sectionSubtitle, { textAlign: 'center', marginTop: 8 }]}>
            Create or join a household to share a pantry with others.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#FEFCF6', '#E9F1EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Shared Pantry</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Join another household */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join a household</Text>
            <Text style={styles.sectionSubtitle}>Enter a code shared by someone else to sync pantries.</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="SAVR-H-XXXXXX"
                placeholderTextColor="#8E8E93"
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                editable={!joinLoading}
              />
              <Pressable style={[styles.primaryButton, joinLoading && styles.buttonDisabled]} onPress={handleJoinHousehold} disabled={joinLoading}>
                {joinLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.primaryButtonText}>Join</Text>}
              </Pressable>
            </View>
          </View>

          {/* Current household */}
          {currentHousehold && (
            <>
              <View style={styles.section}>
                {editingName ? (
                  <View style={styles.nameEditRow}>
                    <TextInput
                      style={styles.nameEditInput}
                      placeholder="Household name"
                      placeholderTextColor="#8E8E93"
                      value={editNameValue}
                      onChangeText={setEditNameValue}
                      autoFocus
                      editable={!nameSaving}
                    />
                    <Pressable style={[styles.nameEditButton, nameSaving && styles.buttonDisabled]} onPress={saveHouseholdName} disabled={nameSaving}>
                      {nameSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.nameEditButtonText}>Save</Text>}
                    </Pressable>
                    <Pressable style={styles.nameCancelButton} onPress={cancelEditingName} disabled={nameSaving}>
                      <Text style={styles.nameCancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text style={styles.sectionTitle}>{currentHousehold.name}</Text>
                    {isOwner && (
                      <Pressable style={styles.editNameButton} onPress={startEditingName}>
                        <Ionicons name="pencil" size={20} color="#6A9571" />
                      </Pressable>
                    )}
                  </View>
                )}
                <Text style={styles.sectionSubtitle}>Share this code so others can see the same pantry.</Text>
                <Pressable style={styles.codeCard} onPress={handleShareCode}>
                  <Text style={styles.codeText}>{currentHousehold.share_code || '—'}</Text>
                  <Ionicons name="share-outline" size={20} color="#6A9571" />
                </Pressable>
                {isOwner && (
                  <Pressable style={styles.linkButton} onPress={handleRegenerateCode} disabled={regenerating}>
                    <Text style={styles.linkButtonText}>{regenerating ? 'Regenerating…' : 'Regenerate code'}</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members</Text>
                {membersLoading ? (
                  <ActivityIndicator color="#6A9571" style={{ marginVertical: 16 }} />
                ) : (
                  <View style={styles.memberList}>
                    {members.map((m) => (
                      <View key={m.id} style={styles.memberRow}>
                        <View>
                          <Text style={styles.memberName}>{m.user?.name || m.user?.email || 'Unknown'}</Text>
                          <Text style={styles.memberRole}>{m.role} {!m.accepted && m.role !== 'owner' ? '· Pending' : ''}</Text>
                        </View>
                        {isOwner && !m.id.startsWith('owner-') && (
                          <Pressable
                            onPress={() => {
                              Alert.alert('Remove member?', `Remove ${m.user?.name || m.user?.email} from this household?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => removeMember(currentHousehold.id, m.id).then(() => refreshHouseholds()) },
                              ])
                            }}
                          >
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {!isOwner && (
                <View style={styles.section}>
                  <Pressable style={styles.dangerButton} onPress={handleLeaveHousehold}>
                    <Text style={styles.dangerButtonText}>Leave household</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: 24, color: '#000', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#666', marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  editNameButton: { padding: 4 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameEditInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  nameEditButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
  },
  nameEditButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  nameCancelButton: { paddingHorizontal: 8, height: 44, justifyContent: 'center' },
  nameCancelButtonText: { fontSize: 14, color: '#666', fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  primaryButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  codeText: { fontSize: 18, fontWeight: '600', color: '#000', letterSpacing: 1 },
  linkButton: { marginTop: 8 },
  linkButtonText: { fontSize: 14, color: '#6A9571', fontWeight: '600' },
  memberList: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberName: { fontSize: 16, fontWeight: '600', color: '#000' },
  memberRole: { fontSize: 12, color: '#666', marginTop: 2 },
  removeText: { fontSize: 14, color: '#E74C3C', fontWeight: '600' },
  dangerButton: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  dangerButtonText: { color: '#E74C3C', fontWeight: '600' },
  errorBanner: { backgroundColor: 'rgba(231,76,60,0.1)', padding: 12, borderRadius: 12, marginTop: 8 },
  errorText: { color: '#E74C3C', fontSize: 14 },
})
