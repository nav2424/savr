// SAVR Allergies - Elegant Allergy Detection & Management Tab
import React, { useState, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useAuth } from '../../lib/AuthContext'
import { userPreferencesService, UserPreferences } from '../../lib/UserPreferencesService'
import { supabase } from '../../lib/supabase'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import AllergenDetailModal from '../../components/AllergenDetailModal'
import { AllergenCheckResult } from '../../lib/BarcodeService'
import { LiquidGlassCard } from '../../components/LiquidGlassCard'
import { logger } from '../../lib/Logger'
import { 
  scaleSize, 
  scaleFont, 
  scaleWidth, 
  scaleHeight, 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

const COMMON_ALLERGENS = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Soy',
  'Wheat',
  'Sesame',
  'Gluten',
]

interface ScanHistoryItem {
  id: string
  barcode: string
  product_name: string
  scanned_at: string
  added_to_pantry: boolean
  allergenCheck?: AllergenCheckResult
}

export default function AllergiesScreen() {
  const { progressiveTheme } = useSimpleTheme()
  const router = useRouter()
  const { user } = useAuth()
  
  const [allergies, setAllergies] = useState<string[]>([])
  const [customAllergy, setCustomAllergy] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scansToday, setScansToday] = useState(0)
  const [selectedAllergenModal, setSelectedAllergenModal] = useState<{
    productName: string
    allergenCheck: AllergenCheckResult
  } | null>(null)
  const [householdAllergiesCollapsed, setHouseholdAllergiesCollapsed] = useState(true)
  const [recentScansCollapsed, setRecentScansCollapsed] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  // Real-time subscription for scan history updates
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('scan-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_scanned_history',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Scan history updated:', payload.eventType)
          // Reload scan history when changes occur
          loadScanHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Real-time subscription for user preferences (allergies)
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('user-preferences-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('User preferences updated')
          loadAllergies()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Refresh scan history when screen comes into focus (e.g., after scanning)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadScanHistory()
        loadAllergies()
      }
    }, [user])
  )

  const loadData = async () => {
    if (user?.id) {
      await Promise.all([loadAllergies(), loadScanHistory()])
    }
    setLoading(false)
  }

  const loadAllergies = async () => {
    try {
      if (user?.id) {
        const preferences = await userPreferencesService.loadPreferences(user.id)
        setAllergies(preferences?.dietary?.allergies || [])
      }
    } catch (error) {
      logger.error('Error loading allergies', { error })
    }
  }

  const loadScanHistory = async () => {
    try {
      if (!user?.id) return

      setLoadingHistory(true)
      
      // Get start of today in LOCAL timezone (not UTC)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStart = today.toISOString()
      
      // Also get end of today for proper range
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)
      const todayEndISO = todayEnd.toISOString()
      
      // Load scans from today for the count
      const { data: todayScans, error: todayError } = await supabase
        .from('user_scanned_history')
        .select('id')
        .eq('user_id', user.id)
        .gte('scanned_at', todayStart)
        .lte('scanned_at', todayEndISO)
      
      if (todayError) throw todayError
      setScansToday(todayScans?.length || 0)
      
      // Load only the 4 most recent scans for the preview
      const { data, error } = await supabase
        .from('user_scanned_history')
        .select('*')
        .eq('user_id', user.id)
        .order('scanned_at', { ascending: false })
        .limit(4)

      if (error) throw error
      setScanHistory(data || [])
    } catch (error) {
      logger.error('Error loading scan history', { error })
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const toggleAllergy = (allergen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (allergies.includes(allergen)) {
      setAllergies(allergies.filter(a => a !== allergen))
    } else {
      setAllergies([...allergies, allergen])
    }
  }

  const addCustomAllergy = () => {
    if (!customAllergy.trim()) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const newAllergies = customAllergy
      .split(',')
      .map(a => a.trim())
      .filter(a => a && !allergies.includes(a))

    if (newAllergies.length > 0) {
      setAllergies([...allergies, ...newAllergies])
      setCustomAllergy('')
    }
  }

  const removeAllergy = (allergen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setAllergies(allergies.filter(a => a !== allergen))
  }

  const handleSaveAllergies = async () => {
    if (!user?.id) return

    setSaving(true)
    try {
      const preferences = await userPreferencesService.loadPreferences(user.id)
      const updatedPreferences: UserPreferences = {
        location: preferences?.location || { country: '', province: '' },
        household: preferences?.household || { size: '1', hasChildren: null, hasPets: null },
        dietary: {
          preferences: preferences?.dietary?.preferences || [],
          allergies: allergies,
          cuisines: preferences?.dietary?.cuisines || [],
        },
        shopping: preferences?.shopping || { frequency: '', stores: [], method: '' },
        budget: preferences?.budget || { monthly: '', savingsGoal: '' },
        profile: preferences?.profile,
      }

      await userPreferencesService.savePreferences(updatedPreferences, user.id)
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Allergies Saved',
        'Your allergy preferences have been updated. Future scans will check for these allergens.',
        [{ text: 'OK' }]
      )
    } catch (error) {
      logger.error('Error saving allergies', { error })
      Alert.alert('Error', 'Failed to save allergies. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const stats = {
    scansToday: scansToday,
    allergiesConfigured: allergies.length,
  }

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
        <LinearGradient
          colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassmorphicOverlay}
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
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />
      
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
        {/* Premium Diagnostic Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.savrTitle}>SAVR</Text>
            <Text style={styles.headerSubtitle}>Allergy Protection</Text>
          </View>
          {stats.allergiesConfigured > 0 && (
            <View style={styles.protectionStatus}>
              <Ionicons name="checkmark-circle" size={16} color="#6A9571" />
              <Text style={styles.protectionText}>Active protection monitoring {stats.allergiesConfigured} allergen{stats.allergiesConfigured > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Elegant Stats */}
        <View style={styles.statsRow}>
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" shadow="liquidGlass" style={styles.statCard}>
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{stats.allergiesConfigured}</Text>
              <Text style={styles.statLabel}>Allergies Configured</Text>
            </View>
          </LiquidGlassCard>
          <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="md" shadow="liquidGlass" style={styles.statCard}>
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{stats.scansToday}</Text>
              <Text style={styles.statLabel}>Scans Today</Text>
            </View>
          </LiquidGlassCard>
        </View>

        {/* Allergies Section */}
        <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="lg" shadow="liquidGlass" style={styles.sectionCard}>
          <Pressable 
            style={styles.sectionHeader}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setHouseholdAllergiesCollapsed(!householdAllergiesCollapsed)
            }}
          >
            <View style={styles.sectionIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color="#6A9571" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Household Allergies</Text>
              <Text style={styles.sectionSubtitle}>Select allergens to monitor</Text>
            </View>
            <Ionicons 
              name={householdAllergiesCollapsed ? "chevron-down" : "chevron-up"} 
              size={20} 
              color="#6A9571" 
            />
          </Pressable>

          {!householdAllergiesCollapsed && (
            <>

          {/* Compact Allergen Chips */}
          <View style={styles.allergenGrid}>
            {COMMON_ALLERGENS.map((allergen) => {
              const isSelected = allergies.includes(allergen)
              return (
                <Pressable
                  key={allergen}
                  style={[
                    styles.allergenChip,
                    isSelected && styles.allergenChipSelected
                  ]}
                  onPress={() => toggleAllergy(allergen)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={styles.chipIcon} />
                  )}
                  <Text style={[
                    styles.allergenChipText,
                    isSelected && styles.allergenChipTextSelected
                  ]}>
                    {allergen}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* Custom Allergens */}
          {allergies.filter(a => !COMMON_ALLERGENS.includes(a)).length > 0 && (
            <View style={styles.customSection}>
              <Text style={styles.customLabel}>Custom</Text>
              <View style={styles.customGrid}>
                {allergies
                  .filter(a => !COMMON_ALLERGENS.includes(a))
                  .map((allergen) => (
                    <View key={allergen} style={styles.customChip}>
                      <Text style={styles.customChipText}>{allergen}</Text>
                      <Pressable
                        onPress={() => removeAllergy(allergen)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color="#6A9571" />
                      </Pressable>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Add Custom Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add custom allergen..."
              placeholderTextColor="#8E8E93"
              value={customAllergy}
              onChangeText={setCustomAllergy}
              onSubmitEditing={addCustomAllergy}
            />
            {customAllergy.trim() && (
              <Pressable style={styles.addBtn} onPress={addCustomAllergy}>
                <Ionicons name="add-circle" size={24} color="#6A9571" />
              </Pressable>
            )}
          </View>

          {/* Save Button */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveAllergies}
            disabled={saving}
          >
            <LinearGradient
              colors={allergies.length > 0 ? ['#6A9571', '#8AB896'] : ['#E5E5E5', '#E5E5E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  Save {allergies.length > 0 && `(${allergies.length})`}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
            </>
          )}
        </LiquidGlassCard>

        {/* Scan History Section */}
        <LiquidGlassCard variant="ultraThin" borderRadius="lg" padding="lg" shadow="liquidGlass" style={styles.sectionCard}>
          <Pressable 
            style={styles.sectionHeader}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setRecentScansCollapsed(!recentScansCollapsed)
            }}
          >
            <View style={styles.sectionIconContainer}>
              <Ionicons name="scan" size={20} color="#6A9571" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Recent Scans</Text>
              <Text style={styles.sectionSubtitle}>Your product scan history</Text>
            </View>
            <Ionicons 
              name={recentScansCollapsed ? "chevron-down" : "chevron-up"} 
              size={20} 
              color="#6A9571" 
            />
          </Pressable>

          {!recentScansCollapsed && (
            <>
              {loadingHistory ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="small" color="#6A9571" />
            </View>
          ) : scanHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyText}>No scans yet</Text>
              <Text style={styles.emptySubtext}>Start scanning to see history</Text>
              <Pressable style={styles.scanBtn} onPress={() => router.push('/scan')}>
                <Text style={styles.scanBtnText}>Scan Products</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.historyList}>
                {scanHistory.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.historyItem}
                    onPress={() => router.push('/scan')}
                  >
                    <View style={styles.historyContent}>
                      <Text style={styles.historyName} numberOfLines={1}>
                        {item.product_name}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.scanned_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.viewAllButton}
                onPress={() => router.push('/scan-history')}
              >
                <Text style={styles.viewAllButtonText}>View All Scans</Text>
                <Ionicons name="chevron-forward" size={16} color="#6A9571" />
              </Pressable>
            </>
          )}
            </>
          )}
        </LiquidGlassCard>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {selectedAllergenModal && (
        <AllergenDetailModal
          visible={!!selectedAllergenModal}
          allergenCheck={selectedAllergenModal.allergenCheck}
          productName={selectedAllergenModal.productName}
          onClose={() => setSelectedAllergenModal(null)}
        />
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
  glassmorphicOverlay: {
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  savrTitle: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shieldIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  protectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginTop: 20,
  },
  protectionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6A9571',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  allergenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
  },
  allergenChipSelected: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  chipIcon: {
    marginRight: 4,
  },
  allergenChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  allergenChipTextSelected: {
    color: '#FFFFFF',
  },
  customSection: {
    marginBottom: 16,
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    gap: 6,
  },
  customChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6A9571',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  addBtn: {
    padding: 4,
  },
  saveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  centerContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
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
  historyList: {
    gap: 6,
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
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 11,
    color: '#8E8E93',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
})
