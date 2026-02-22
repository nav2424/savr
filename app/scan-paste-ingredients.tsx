// Barcode-scoped manual paste fallback - requires scan_session_id from prior barcode scan

import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useToast } from '../lib/ToastContext'
import { useAuth } from '../lib/AuthContext'
import { buildAllergenCheckResultFromEngine } from '../lib/BarcodeService'
import { setBestResult } from '../lib/AllergenResultStore'

export default function ScanPasteIngredientsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ sessionId?: string; barcode?: string }>()
  const { showToast } = useToast()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const sessionId = params.sessionId as string | undefined
  const barcode = params.barcode as string | undefined

  React.useEffect(() => {
    if (!sessionId || !barcode) {
      showToast('Invalid session. Please scan a barcode first.', { kind: 'error' })
      router.back()
    }
  }, [sessionId, barcode, router, showToast])

  const handlePaste = async () => {
    if (!sessionId || !barcode || !user?.id) return
    const trimmed = text.trim()
    if (!trimmed) {
      showToast('Paste ingredient text first.', { kind: 'error' })
      return
    }
    setLoading(true)
    try {
      const allergenCheck = await buildAllergenCheckResultFromEngine(
        { ingredients_text: trimmed },
        user.id,
        'MANUAL'
      )
      setBestResult(sessionId, allergenCheck, 'MANUAL')
      const msg = allergenCheck.riskLevel === 'INSUFFICIENT_DATA'
        ? 'Could not parse ingredients.'
        : `${allergenCheck.riskLevel}: ${allergenCheck.matches?.length ?? 0} allergen(s) found.`
      showToast(msg)
      router.back()
    } catch (e) {
      showToast('Check failed.', { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId || !barcode) return null

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Paste ingredients</Text>
        <Text style={styles.subtitle}>Paste the ingredient list from the product label</Text>
        <TextInput
          style={styles.input}
          placeholder="Ingredients: wheat flour, sugar, soybean oil..."
          placeholderTextColor="#999"
          multiline
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.button} onPress={handlePaste} disabled={loading || !text.trim()}>
          <Text style={styles.buttonText}>Check allergens</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  button: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: { padding: 12, alignItems: 'center' },
  backText: { color: '#666', fontSize: 15 },
})
