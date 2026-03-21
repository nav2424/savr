// Barcode-scoped OCR fallback - requires scan_session_id from prior barcode scan
// Only reachable when OFF has no ingredient data (UNKNOWN)

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
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

  const handleTakePhoto = async () => {
    if (!sessionId || !barcode || !user?.id) return
    setLoading(true)
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to scan labels.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      })
      if (result.canceled || !result.assets?.[0]?.uri) {
        setLoading(false)
        return
      }
      const text = await runOcr(result.assets[0].uri)
      if (!text?.trim()) {
        showToast('Could not read text from photo. Try again with better lighting.', { kind: 'error' })
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
      showToast(`Updated: ${allergenCheck.riskLevel}.`, { kind: 'success' })
      router.back()
    } catch (_e) {
      showToast('Camera OCR failed. Try again.', { kind: 'error' })
    } finally {
      setLoading(false)
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
          style={styles.backIconButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Scan label photo</Text>
          <Text style={styles.subtitle}>Take a photo of the ingredients panel (or pick from your library).</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable style={styles.primaryButton} onPress={handleTakePhoto} disabled={loading}>
          <LinearGradient colors={['#6A9571', '#5A8561']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonGradient}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Take photo</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable style={[styles.secondaryButton, loading && { opacity: 0.6 }]} onPress={handlePickImage} disabled={loading}>
          <Ionicons name="images" size={18} color="#6A9571" />
          <Text style={styles.secondaryButtonText}>Choose from library</Text>
        </Pressable>

        <Text style={styles.hint}>Tip: crop tightly to just the ingredients list for best results.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  backIconButton: {
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
  primaryButton: { borderRadius: 16, overflow: 'hidden' },
  primaryButtonGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.22)',
  },
  secondaryButtonText: { color: '#4A7558', fontSize: 15, fontWeight: '800' },
  hint: { marginTop: 12, fontSize: 12, color: '#6B7280' },
})
