// SAVR Receipt Detail - View Full Receipt Details
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import { receiptsService, Receipt } from '../lib/ReceiptsService'
import { capitalizeCategoryName } from '../lib/ScanningService'
import { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

export default function ReceiptDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReceipt()
  }, [params.id])

  const loadReceipt = async () => {
    if (!params.id || typeof params.id !== 'string') {
      setLoading(false)
      return
    }

    const { success, receipt: data } = await receiptsService.getReceiptById(params.id)
    if (success && data) {
      setReceipt(data)
    }
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  if (!receipt) {
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
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Receipt Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    )
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
        <Text style={styles.headerTitle}>Receipt Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Store & Date Card */}
        <View style={styles.storeCard}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storeCardGradient}
          >
            <View style={styles.storeIconContainer}>
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.storeIconGradient}
              >
                <Text style={styles.storeIcon}>🧾</Text>
              </LinearGradient>
            </View>
            <Text style={styles.storeName}>
              {receipt.store_name || 'Unknown Store'}
            </Text>
            <Text style={styles.receiptDate}>
              {formatDate(receipt.created_at)}
            </Text>
          </LinearGradient>
        </View>

        {/* Total Amount Card */}
        {receipt.total_amount && receipt.total_amount > 0 && (
          <View style={styles.totalCard}>
            <LinearGradient
              colors={['rgba(106, 149, 113, 0.12)', 'rgba(106, 149, 113, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalCardGradient}
            >
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>${receipt.total_amount.toFixed(2)}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Items ({receipt.scan_result.items.length})
          </Text>
          
          <View style={styles.itemsList}>
            {receipt.scan_result.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.9)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.itemCardGradient}
                >
                  <View style={styles.itemHeader}>
                    <View style={styles.itemEmojiContainer}>
                      <Text style={styles.itemEmoji}>{item.emoji}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemDetails}>
                        {item.quantity && (
                          <Text style={styles.itemDetailText}>
                            Qty: {item.quantity}
                          </Text>
                        )}
                        {item.category && (
                          <View style={styles.itemCategoryBadge}>
                            <Text style={styles.itemCategoryText}>
                              {capitalizeCategoryName(item.category)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {item.price && item.price > 0 && (
                      <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                    )}
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        </View>

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
  
  // Store Card
  storeCard: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  storeCardGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
  },
  storeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  storeIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeIcon: {
    fontSize: 36,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  receiptDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Total Card
  totalCard: {
    marginBottom: 28,
    borderRadius: 20,
    overflow: 'hidden',
  },
  totalCardGradient: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    borderRadius: 20,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A9571',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#6A9571',
    letterSpacing: -1,
  },
  
  // Items Section
  itemsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  itemCardGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemDetailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  itemCategoryBadge: {
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  itemCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6A9571',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6A9571',
    letterSpacing: -0.3,
  },
})

