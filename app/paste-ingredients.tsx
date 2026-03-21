// Barcode-scoped manual ingredients fallback - requires scan_session_id from prior barcode scan
// Only reachable when OFF has no ingredient data (UNKNOWN)

import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../lib/ToastContext'
import { getScanSession } from '../lib/ScanSessionService'
import { parseSections } from '../lib/allergenEngine/textParser'
import { useAuth } from '../lib/AuthContext'
import { buildAllergenCheckResultFromEngine } from '../lib/BarcodeService'
import { setBestResult } from '../lib/AllergenResultStore'

export default function PasteIngredientsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ sessionId?: string; barcode?: string; productName?: string }>()
  const { showToast } = useToast()
  const { user } = useAuth()

  const sessionId = params.sessionId as string | undefined
  const barcode = params.barcode as string | undefined
  const productName = (params.productName as string | undefined) ?? undefined

  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => text.trim().length >= 10 && !submitting, [text, submitting])

  React.useEffect(() => {
    if (!sessionId || !barcode) {
      showToast('Invalid session. Please scan a barcode first.', { kind: 'error' })
      router.back()
      return
    }
    const session = getScanSession(sessionId)
    if (!session) {
      showToast('Session expired. Please scan again.', { kind: 'error' })
      router.back()
    }
  }, [sessionId, barcode, router, showToast])

  const handleSubmit = async () => {
    if (!sessionId || !barcode || !user?.id) return
    const raw = text.trim()
    if (raw.length < 10) {
      showToast('Paste a bit more of the ingredients list.', { kind: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const parsed = parseSections(raw)
      const allergenCheck = await buildAllergenCheckResultFromEngine(
        {
          ingredients_text: parsed.ingredients_text,
          contains_text: parsed.contains_text,
          may_contain_text: parsed.may_contain_text,
          product_name: productName,
        },
        user.id,
        'MANUAL'
      )

      setBestResult(sessionId, allergenCheck, 'MANUAL')
      showToast(`Updated: ${allergenCheck.riskLevel}.`, { kind: 'success' })
      router.back()
    } catch (_e) {
      showToast('Could not check ingredients. Try again.', { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!sessionId || !barcode) return null

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Paste ingredients</Text>
          <Text style={styles.subtitle}>Copy the ingredient list from a label or website.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Ingredients / May contain / Contains</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={'Example:\nIngredients: …\nMay contain: …'}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          <LinearGradient colors={['#6A9571', '#5A8561']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonGradient}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Check allergens</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.hint}>
          Tip: include “May contain” lines if present.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    minHeight: 220,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 12,
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  primaryButton: { borderRadius: 16, overflow: 'hidden', marginTop: 12 },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  hint: { marginTop: 10, fontSize: 12, color: '#6B7280' },
})

