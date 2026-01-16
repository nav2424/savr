// SAVR Receipts History - View Past Scanned Receipts
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { receiptsService, Receipt } from '../lib/ReceiptsService'

export default function ReceiptsHistoryScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalSpent: 0,
    mostFrequentStore: 'N/A'
  })

  useEffect(() => {
    loadReceipts()
    loadStats()
  }, [])

  const loadReceipts = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const { success, receipts: data } = await receiptsService.getUserReceipts(user.id)
    if (success && data) {
      setReceipts(data)
    }
    setLoading(false)
  }

  const loadStats = async () => {
    if (!user?.id) return
    const data = await receiptsService.getReceiptStats(user.id)
    setStats(data)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadReceipts()
    await loadStats()
    setRefreshing(false)
  }

  const handleDeleteReceipt = (receiptId: string) => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { success } = await receiptsService.deleteReceipt(receiptId)
            if (success) {
              setReceipts(receipts.filter(r => r.id !== receiptId))
              loadStats()
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            }
          },
        },
      ]
    )
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Unknown date'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      const now = new Date()
      const diffTime = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch (error) {
      return 'Invalid date'
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Gradient Background */}
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
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Receipt History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9571" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6A9571" />
          }
        >
          {/* Stats Card */}
          {stats.totalReceipts > 0 && (
            <View style={styles.statsCard}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statsGradient}
              >
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.totalReceipts}</Text>
                  <Text style={styles.statLabel}>
                    {stats.totalReceipts === 1 ? 'Receipt' : 'Receipts'}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                    ${stats.totalSpent.toFixed(0)}
                  </Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                    {stats.mostFrequentStore.length > 8 
                      ? stats.mostFrequentStore.substring(0, 8) + '.' 
                      : stats.mostFrequentStore}
                  </Text>
                  <Text style={styles.statLabel}>Top Store</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Receipts List */}
          {receipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyTitle}>No Receipts Yet</Text>
              <Text style={styles.emptyText}>
                Scan your first receipt to start tracking your grocery purchases
              </Text>
              <Pressable
                style={styles.scanButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  router.push('/scan')
                }}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scanButtonGradient}
                >
                  <Text style={styles.scanButtonText}>Scan Receipt</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.listHeader}>
                {receipts.length} {receipts.length === 1 ? 'Receipt' : 'Receipts'}
              </Text>
              <View style={styles.receiptsList}>
                {receipts.map((receipt) => (
                  <Pressable
                    key={receipt.id}
                    style={styles.receiptCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      router.push(`/receipt-detail?id=${receipt.id}`)
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                      handleDeleteReceipt(receipt.id)
                    }}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.receiptCardGradient}
                    >
                      {/* Receipt Header */}
                      <View style={styles.receiptHeader}>
                        <View style={styles.receiptIconContainer}>
                          <LinearGradient
                            colors={['#6A9571', '#8AB896']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.receiptIconGradient}
                          >
                            <Text style={styles.receiptIcon}>🧾</Text>
                          </LinearGradient>
                        </View>
                        <View style={styles.receiptHeaderInfo}>
                          <Text style={styles.receiptStore} numberOfLines={1}>
                            {receipt.store_name ? String(receipt.store_name) : 'Unknown Store'}
                          </Text>
                          <Text style={styles.receiptDate}>
                            {receipt.created_at ? formatDate(receipt.created_at) : 'Unknown date'}
                          </Text>
                        </View>
                      </View>

                      {/* Amount Badge */}
                      {receipt.total_amount && typeof receipt.total_amount === 'number' && receipt.total_amount > 0 ? (
                        <View style={styles.receiptAmountContainer}>
                          <View style={styles.receiptAmountBadge}>
                            <Text style={styles.receiptAmountLabel}>Total</Text>
                            <Text style={styles.receiptAmount}>
                              ${receipt.total_amount.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Items Preview */}
                      {receipt.scan_result?.items && Array.isArray(receipt.scan_result.items) && receipt.scan_result.items.length > 0 ? (
                        <View style={styles.receiptItemsPreview}>
                          <View style={styles.itemsHeaderRow}>
                            <Text style={styles.itemsPreviewLabel}>
                              {String(receipt.scan_result.items.length)} {receipt.scan_result.items.length === 1 ? 'Item' : 'Items'}
                            </Text>
                            {receipt.scan_result.items.length > 3 ? (
                              <Pressable
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  router.push(`/receipt-detail?id=${receipt.id}`)
                                }}
                              >
                                <Text style={styles.moreItemsIndicator}>
                                  +{String(receipt.scan_result.items.length - 3)} more
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <View style={styles.itemsPreviewList}>
                            {receipt.scan_result.items
                              .slice(0, 3)
                              .filter((item) => item && typeof item === 'object' && (item.name || item.emoji))
                              .map((item, index) => {
                                if (!item || typeof item !== 'object') return null
                                return (
                                  <View key={`item-${index}`} style={styles.previewItemBadge}>
                                    {item.emoji && String(item.emoji) ? (
                                      <Text style={styles.previewItemEmoji}>{String(item.emoji)}</Text>
                                    ) : null}
                                    {item.name && String(item.name) ? (
                                      <Text style={styles.previewItemName} numberOfLines={1} ellipsizeMode="tail">
                                        {String(item.name)}
                                      </Text>
                                    ) : null}
                                  </View>
                                )
                              })}
                          </View>
                        </View>
                      ) : null}

                      {/* Delete Hint */}
                      <Text style={styles.deleteHint}>Long press to delete</Text>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#000000',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  
  // Stats Card
  statsCard: {
    marginBottom: 28,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  statsGradient: {
    flexDirection: 'row',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 8,
  },
  
  // List Header
  listHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    maxWidth: 280,
  },
  scanButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  scanButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  
  // Receipts List
  receiptsList: {
    gap: 20,
  },
  receiptCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  receiptCardGradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  receiptIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptIcon: {
    fontSize: 28,
  },
  receiptHeaderInfo: {
    flex: 1,
    marginRight: 12,
  },
  receiptStore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  receiptDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  receiptAmountContainer: {
    marginBottom: 20,
  },
  receiptAmountBadge: {
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    alignSelf: 'flex-start',
  },
  receiptAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6A9571',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  receiptAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6A9571',
    letterSpacing: -0.5,
  },
  
  // Items Preview
  receiptItemsPreview: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 20,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  itemsPreviewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  moreItemsIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemsPreviewList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.15)',
    maxWidth: 160,
  },
  previewItemEmoji: {
    fontSize: 16,
    flexShrink: 0,
  },
  previewItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  deleteHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

