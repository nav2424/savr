// SAVR Scan History - View all scans from past 3 months
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../lib/SimpleThemeContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { LiquidGlassCard } from '../components/LiquidGlassCard'
import { 
  scaleSize, 
  scaleFont, 
  scaleWidth, 
  scaleHeight, 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

interface ScanHistoryItem {
  id: string
  barcode: string
  product_name: string
  scanned_at: string
  added_to_pantry: boolean
}

export default function ScanHistoryScreen() {
  const { progressiveTheme } = useSimpleTheme()
  const router = useRouter()
  const { user } = useAuth()
  
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadScanHistory()
  }, [user])

  const loadScanHistory = async () => {
    try {
      if (!user?.id) return

      setLoading(true)
      
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      
      const { data, error } = await supabase
        .from('user_scanned_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('scanned_at', threeMonthsAgo.toISOString())
        .order('scanned_at', { ascending: false })

      if (error) throw error
      setScanHistory(data || [])
    } catch (error) {
      console.error('Error loading scan history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadScanHistory()
    setRefreshing(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Group scans by date
  const groupedScans = scanHistory.reduce((groups, scan) => {
    const date = new Date(scan.scanned_at)
    const dateKey = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(scan)
    return groups
  }, {} as Record<string, ScanHistoryItem[]>)

  if (loading) {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="dark" />
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

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
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
        <View style={styles.headerText}>
          <Text style={styles.title}>Scan History</Text>
          <Text style={styles.subtitle}>Past 3 months</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6A9571"
          />
        }
      >
        {scanHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>No scans in the past 3 months</Text>
            <Text style={styles.emptySubtext}>Start scanning products to see your history</Text>
            <Pressable style={styles.scanBtn} onPress={() => router.push('/scan')}>
              <Text style={styles.scanBtnText}>Scan Products</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.content}>
            {Object.entries(groupedScans).map(([dateKey, scans]) => (
              <View key={dateKey} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{dateKey}</Text>
                <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" shadow="liquidGlass" style={styles.scanGroupCard}>
                  {scans.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.historyItem}
                      onPress={() => router.push('/scan')}
                    >
                      <View style={styles.historyContent}>
                        <Text style={styles.historyName} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        <View style={styles.historyMeta}>
                          <Text style={styles.historyTime}>{formatTime(item.scanned_at)}</Text>
                          {item.added_to_pantry && (
                            <View style={styles.pantryBadge}>
                              <Ionicons name="basket" size={12} color="#6A9571" />
                              <Text style={styles.pantryBadgeText}>Added</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                    </Pressable>
                  ))}
                </LiquidGlassCard>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
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
  scrollView: {
    flex: 1,
  },
  bottomSpacing: {
    height: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scanGroupCard: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTime: {
    fontSize: 11,
    color: '#8E8E93',
  },
  pantryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  pantryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6A9571',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    marginTop: 100,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  scanBtn: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
})
