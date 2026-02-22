// Barcode-scoped OCR fallback - requires scan_session_id from prior barcode scan
// Only reachable when OFF has no ingredient data (UNKNOWN)

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useToast } from '../lib/ToastContext'
import { getScanSession } from '../lib/ScanSessionService'
import { runOcr } from '../lib/ocrStub'
import { parseSections } from '../lib/allergenEngine/textParser'
import { useAuth } from '../lib/AuthContext'
import { buildAllergenCheckResultFromEngine } from '../lib/BarcodeService'
import { setBestResult } from '../lib/AllergenResultStore'

export default function ScanLabelOcrScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ sessionId?: string; barcode?: string }>()
  const { showToast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const sessionId = params.sessionId as string | undefined
  const barcode = params.barcode as string | undefined

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

  const handlePickImage = async () => {
    if (!sessionId || !barcode || !user?.id) return
    setLoading(true)
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to scan labels.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      })
      if (result.canceled || !result.assets?.[0]?.uri) {
        setLoading(false)
        return
      }
      const text = await runOcr(result.assets[0].uri)
      if (!text?.trim()) {
        showToast('Could not read text from image. Try a clearer photo.', { kind: 'error' })
        setLoading(false)
        return
      }
      const parsed = parseSections(text)
      const allergenCheck = await buildAllergenCheckResultFromEngine(
        {
          ingredients_text: parsed.ingredients_text,
          contains_text: parsed.contains_text,
          may_contain_text: parsed.may_contain_text,
        },
        user.id,
        'OCR'
      )
      setBestResult(sessionId, allergenCheck, 'OCR')
      showToast(`Found: ${allergenCheck.riskLevel}. ${allergenCheck.matches?.length ?? 0} allergen(s) matched.`)
      router.back()
    } catch (e) {
      showToast('OCR failed. Try again.', { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId || !barcode) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan label photo</Text>
      <Text style={styles.subtitle}>Take or pick a photo of the ingredient list</Text>
      <Pressable style={styles.button} onPress={handlePickImage} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Choose photo</Text>}
      </Pressable>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Cancel</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  button: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: { padding: 12, alignItems: 'center' },
  backText: { color: '#666', fontSize: 15 },
})
