// SAVR Scan Detail - Summary of a past scan (ingredients + allergen status)
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/AuthContext'
import { fetchScanDetail, ScanDetail, AllergenLogStatus } from '../lib/ScanDetailService'
import { LiquidGlassCard } from '../components/LiquidGlassCard'

function truncateIngredients(text: string | undefined, maxLen = 500): string {
  if (!text || !text.trim()) return ''
  const t = text.trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen) + '…'
}

export default function ScanDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    barcode: string
    product_name: string
    scanned_at: string
    id?: string
  }>()
  const { user } = useAuth()
  const [detail, setDetail] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDetail()
  }, [params.barcode, params.product_name, params.scanned_at, user?.id])

  const loadDetail = async () => {
    if (!user?.id || !params.barcode || !params.product_name || !params.scanned_at) {
      setLoading(false)
      return
    }
    setLoading(true)
    const d = await fetchScanDetail(
      user.id,
      params.barcode,
      params.product_name,
      params.scanned_at
    )
    setDetail(d)
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9571" />
        </View>
      </View>
    )
  }

  if (!detail) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </Pressable>
          <Text style={styles.headerTitle}>Scan Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Could not load scan details</Text>
        </View>
      </View>
    )
  }

  const isSafe = detail.overallStatus === 'SAFE'
  const hasAllergens = detail.overallStatus === 'CONTAINS' || detail.overallStatus === 'MAY_CONTAIN'
  const isUnknown = detail.overallStatus === 'UNKNOWN'
  const hasAnyIngredients =
    !!detail.ingredientsText?.trim() ||
    !!detail.containsText?.trim() ||
    !!detail.mayContainText?.trim()

  const statusConfig: Record<AllergenLogStatus, { color: string; icon: string; label: string }> = {
    SAFE: { color: '#059669', icon: 'checkmark-circle', label: 'No Allergens Found' },
    CONTAINS: { color: '#DC2626', icon: 'warning', label: 'Allergens Detected' },
    MAY_CONTAIN: { color: '#D97706', icon: 'alert-circle', label: 'Possible Allergens' },
    UNKNOWN: { color: '#92400E', icon: 'help-circle', label: 'Ingredients Unavailable' },
  }
  const status = statusConfig[detail.overallStatus] ?? statusConfig.UNKNOWN

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product header */}
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={2}>
            {detail.productName}
          </Text>
          <Text style={styles.scanDate}>{formatDate(detail.scannedAt)}</Text>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}18` }]}>
          <Ionicons name={status.icon as any} size={22} color={status.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            {detail.fromLiveCheck && (
              <Text style={styles.liveCheckHint}>Checked now from product database</Text>
            )}
          </View>
        </View>

        {/* Safe: ingredients summary + none flagged */}
        {isSafe && hasAnyIngredients && (
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" style={styles.card}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {detail.ingredientsText?.trim() && (
              <Text style={styles.ingredientsText}>{detail.ingredientsText.trim()}</Text>
            )}
            {detail.containsText?.trim() && (
              <Text style={[styles.ingredientsText, detail.ingredientsText?.trim() && { marginTop: 8 }]}>
                Declared: {detail.containsText.trim()}
              </Text>
            )}
            {detail.mayContainText?.trim() && (
              <Text style={[styles.ingredientsText, { marginTop: 8 }]}>
                May contain: {detail.mayContainText.trim()}
              </Text>
            )}
            <View style={styles.safeMessage}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.safeMessageText}>
                None of these ingredients were flagged for your household allergens.
              </Text>
            </View>
          </LiquidGlassCard>
        )}

        {/* Safe but no ingredients */}
        {isSafe && !hasAnyIngredients && (
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" style={styles.card}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.safeMessageText}>
              No allergens were detected. No ingredient details were saved for this scan.
            </Text>
          </LiquidGlassCard>
        )}

        {/* Allergens detected: list what was flagged */}
        {hasAllergens && (
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" style={styles.card}>
            <Text style={styles.sectionTitle}>Detected Allergens</Text>
            <Text style={styles.detectedIntro}>
              The following allergens were found in this product for your household:
            </Text>
            <View style={styles.allergenList}>
              {(detail.matchedAllergens || []).map((m, i) => (
                <View key={i} style={styles.allergenItem}>
                  <Ionicons name="close-circle" size={18} color={status.color} />
                  <Text style={[styles.allergenName, { color: status.color }]}>
                    {m.allergen_name}
                  </Text>
                  {m.match_text && (
                    <Text style={styles.matchHint}> (matched: "{m.match_text}")</Text>
                  )}
                </View>
              ))}
            </View>
            {hasAnyIngredients && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Ingredients Context</Text>
                <Text style={styles.ingredientsText}>
                  {truncateIngredients(
                    [detail.ingredientsText, detail.containsText, detail.mayContainText]
                      .filter(Boolean)
                      .join(' ')
                  )}
                </Text>
              </>
            )}
          </LiquidGlassCard>
        )}

        {/* Unknown */}
        {isUnknown && (
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" style={styles.card}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.unknownText}>
              {detail.hasIngredientData
                ? 'Allergen status could not be determined from this scan.'
                : !hasAnyIngredients
                  ? 'No allergen data was saved for this scan. Ingredients may not have been available, or allergy checking was not performed.'
                  : 'Ingredients were not available for this barcode at the time of scanning. No allergen check could be performed.'}
            </Text>
            {hasAnyIngredients && (
              <Text style={[styles.ingredientsText, { marginTop: 12 }]}>
                {truncateIngredients(
                  [detail.ingredientsText, detail.containsText, detail.mayContainText]
                    .filter(Boolean)
                    .join(' ')
                )}
              </Text>
            )}
          </LiquidGlassCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  productHeader: {
    marginBottom: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  scanDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  liveCheckHint: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  ingredientsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  safeMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  safeMessageText: {
    flex: 1,
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    lineHeight: 20,
  },
  detectedIntro: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  allergenList: {
    gap: 8,
  },
  allergenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergenName: {
    fontSize: 15,
    fontWeight: '600',
  },
  matchHint: {
    fontSize: 13,
    color: '#6B7280',
  },
  unknownText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
})
