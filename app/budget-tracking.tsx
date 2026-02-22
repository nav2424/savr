// SAVR Budget Tracking - Real Financial Overview
import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../lib/AuthContext'
import { useReceipts } from '../lib/ReceiptsContext'
import { userPreferencesService } from '../lib/UserPreferencesService'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'

const { width } = Dimensions.get('window')

export default function BudgetTrackingScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { 
    receipts, 
    loading: receiptsLoading, 
  } = useReceipts()

  // Month selection state (allows browsing previous months)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [newBudgetValue, setNewBudgetValue] = useState('0')

  // Receipts for the selected month (uses the same month window definition everywhere)
  const monthlyReceiptsForSelectedMonth = useMemo(() => {
    if (!receipts || receipts.length === 0) return []
    const startOfMonth = new Date(selectedMonth)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(startOfMonth.getMonth() + 1)

    return receipts.filter(receipt => {
      const dateString = receipt.purchase_date || receipt.created_at
      if (!dateString) return false
      const receiptDate = new Date(dateString)
      return receiptDate >= startOfMonth && receiptDate < endOfMonth
    })
  }, [receipts, selectedMonth])

  // Calculate derived values for the selected month (auto-updates!)
  const spent = useMemo(() => {
    const total = monthlyReceiptsForSelectedMonth.reduce((sum, receipt) => {
      const amount = receipt.total_amount || 0
      const validAmount = typeof amount === 'number' && isFinite(amount) && amount >= 0 ? amount : 0
      return sum + validAmount
    }, 0)
    // Ensure total is valid
    return typeof total === 'number' && isFinite(total) && total >= 0 ? total : 0
  }, [monthlyReceiptsForSelectedMonth])

  const spendingByCategory = useMemo(() => {
    const categorySums: { [key: string]: number } = {}

    monthlyReceiptsForSelectedMonth.forEach(receipt => {
      if (receipt.scan_result?.items) {
        receipt.scan_result.items.forEach((item: any) => {
          const category = item.category || 'Other'
          const price = typeof item.price === 'number' && isFinite(item.price) && item.price >= 0 ? item.price : 0
          const quantity = typeof item.quantity === 'number' && isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1
          const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
          
          // Match the same calculation logic as ReceiptsService.saveReceipt:
          // - Weight-based items: price is already line total (don't multiply)
          // - Count-based items: price is unit price (multiply by quantity)
          const itemTotal = isWeightBased ? price : (price * quantity)
          const validItemTotal = typeof itemTotal === 'number' && isFinite(itemTotal) && itemTotal >= 0 ? itemTotal : 0
          categorySums[category] = (categorySums[category] || 0) + validItemTotal
        })
      }
    })

    const categoryColors: { [key: string]: string } = {
      'Produce': '#51CF66',
      'Dairy': '#339AF0',
      'Meat & Seafood': '#FF6B6B',
      'Pantry Staples': '#8B7355',
      'Snacks': '#FFA726',
      'Beverages': '#4DABF7',
      'Other': '#868E96',
    }

    const categoryIcons: { [key: string]: string } = {
      'Produce': '🥬',
      'Dairy': '🥛',
      'Meat & Seafood': '🥩',
      'Pantry Staples': '🥫',
      'Pantry': '🥫',
      'Snacks': '🍿',
      'Beverages': '☕',
      'Condiments': '🧂',
      'Bakery': '🥖',
      'Frozen': '❄️',
      'Household': '🧻',
      'Personal Care': '🧴',
      'Deli': '🥪',
      'Other': '🛒',
    }

    const rawCategories = Object.entries(categorySums)
      .map(([category, amount]) => ({
        category,
        amount,
        color: categoryColors[category] || '#868E96',
        icon: categoryIcons[category] || '🛒',
      }))

    const totalCategoryAmount = rawCategories.reduce((sum, c) => sum + c.amount, 0)

    // Normalize categories to never exceed the authoritative monthly total,
    // while preserving proportions. This avoids “budget doesn’t add up” UI.
    if (spent > 0 && totalCategoryAmount > spent * 1.05) {
      const scale = spent / totalCategoryAmount
      return rawCategories
        .map(c => ({ ...c, amount: c.amount * scale }))
        .sort((a, b) => b.amount - a.amount)
    }

    return rawCategories.sort((a, b) => b.amount - a.amount)
  }, [monthlyReceiptsForSelectedMonth, spent])

  const weeklySpending = useMemo(() => {
    const weeks = [
      { week: 'Week 1', amount: 0, startDay: 1, endDay: 7 },
      { week: 'Week 2', amount: 0, startDay: 8, endDay: 14 },
      { week: 'Week 3', amount: 0, startDay: 15, endDay: 21 },
      { week: 'Week 4', amount: 0, startDay: 22, endDay: 31 },
    ]

    monthlyReceiptsForSelectedMonth.forEach(receipt => {
      const date = new Date(receipt.purchase_date || receipt.created_at)
      const day = date.getDate()
      const weekIndex = weeks.findIndex(w => day >= w.startDay && day <= w.endDay)
      if (weekIndex !== -1) {
        const amount = receipt.total_amount || 0
        const validAmount = typeof amount === 'number' && isFinite(amount) && amount >= 0 ? amount : 0
        weeks[weekIndex].amount += validAmount
      }
    })

    return weeks
  }, [monthlyReceiptsForSelectedMonth])

  const percentSpent = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0
  const remaining = Math.max(0, monthlyBudget - spent)
  const onTrack = percentSpent <= 75

  const selectedMonthLabel = useMemo(
    () => selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [selectedMonth]
  )

  const goToPreviousMonth = () => {
    setSelectedMonth(prev => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() - 1)
      return next
    })
  }

  const goToNextMonth = () => {
    setSelectedMonth(prev => {
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + 1)
      // Prevent navigating into future months
      if (next > currentMonthStart) {
        return prev
      }
      return next
    })
  }

  // Load budget preference
  useEffect(() => {
    if (user?.id) {
      loadBudgetPreference()
    }
  }, [user])
  
  // Auto-update when receipts/spending change (real-time for selected month)
  useEffect(() => {
    console.log(`📊 Budget auto-updated: $${spent.toFixed(2)} spent this month`)
  }, [spent])

  // Refresh budget data when user returns to this screen
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadBudgetPreference()
        console.log('🔄 Budget tracking screen refreshed')
      }
    }, [user])
  )

  const loadBudgetPreference = async () => {
    if (!user?.id) return
    
    try {
      setLoading(true)
      
      // Get monthly budget from user preferences
      const preferences = await userPreferencesService.loadPreferences(user.id)
      const budgetGoal = preferences?.budget?.monthly || 0
      const value = typeof budgetGoal === 'number' ? budgetGoal : parseFloat(String(budgetGoal)) || 0
      setMonthlyBudget(Math.round(value))
      setNewBudgetValue(String(Math.round(value)))
      
    } catch (error) {
      console.error('Error loading budget preference:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBudget = async () => {
    const parsed = parseFloat(newBudgetValue)
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Budget', 'Please enter a valid budget amount')
      return
    }
    const newBudget = Math.round(parsed)

    if (!user?.id) return
    
    try {
      // Load existing preferences
      const preferences: any = await userPreferencesService.loadPreferences(user.id) || {}
      
      // Update budget (always store whole dollars)
      const updatedPreferences = {
        location: preferences.location || { country: '', province: '' },
        household: preferences.household || { size: '1', hasChildren: false, hasPets: false },
        dietary: preferences.dietary || { preferences: [], restrictions: [] },
        shopping: preferences.shopping || { frequency: 'weekly', preferredStores: [] },
        budget: {
          ...preferences.budget,
          monthly: newBudget
        }
      }
      
      // Save to database
      await userPreferencesService.savePreferences(updatedPreferences, user.id)
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setMonthlyBudget(newBudget)
      setEditModalVisible(false)
      
      // Trigger a global refresh event for other components
      console.log('🔄 Budget updated - triggering global refresh')
      
      Alert.alert('Success', 'Budget updated successfully!')
    } catch (error) {
      console.error('Error saving budget:', error)
      Alert.alert('Error', 'Failed to save budget. Please try again.')
    }
  }

  const maxCategoryAmount = spendingByCategory.length > 0 
    ? Math.max(...spendingByCategory.map(c => c.amount))
    : 1

  if (loading || receiptsLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        <ActivityIndicator size="large" color="#6A9571" />
        <Text style={styles.loadingText}>Loading your budget data...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Budget Tracking</Text>
          <View style={styles.monthSelector}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                goToPreviousMonth()
              }}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-back" size={18} color="#6A9571" />
            </Pressable>
            <Text style={styles.headerSubtitle}>
              {selectedMonthLabel}
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                goToNextMonth()
              }}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={18} color="#6A9571" />
            </Pressable>
          </View>
        </View>

        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setEditModalVisible(true)
          }}
          style={styles.editButton}
        >
          <Ionicons name="create-outline" size={20} color="#6A9571" />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Budget Overview Card */}
        <View style={styles.section}>
          <BlurView intensity={20} tint="light" style={styles.mainBudgetCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.budgetCardGradient}
            >
              {/* Budget Stats */}
              <View style={styles.budgetStats}>
                <View style={styles.budgetStatItem}>
                  <View style={[styles.budgetStatIcon, { backgroundColor: 'rgba(255, 167, 38, 0.12)' }]}>
                    <Ionicons name="wallet-outline" size={24} color="#FFA726" />
                  </View>
                  <Text style={styles.budgetStatValue}>${Math.round(spent)}</Text>
                  <Text style={styles.budgetStatLabel}>Spent</Text>
                </View>
                
                <View style={styles.budgetStatDivider} />
                
                <View style={styles.budgetStatItem}>
                  <View style={[styles.budgetStatIcon, { backgroundColor: 'rgba(106, 149, 113, 0.12)' }]}>
                    <Ionicons name="flag" size={24} color="#6A9571" />
                  </View>
                  <Text style={styles.budgetStatValue}>${Math.round(monthlyBudget)}</Text>
                  <Text style={styles.budgetStatLabel}>Budget</Text>
                </View>
              </View>

              {/* Progress Section */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Budget Progress</Text>
                  <Text style={styles.progressPercentage}>{Math.round(percentSpent)}%</Text>
                </View>
                
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={onTrack ? ['#6A9571', '#51CF66'] : ['#FFA726', '#FF6B6B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.min(percentSpent, 100)}%` }]}
                  />
                </View>
                
                <View style={styles.statusContainer}>
                  <View style={styles.status}>
                    <View style={[styles.statusDot, { backgroundColor: onTrack ? '#51CF66' : '#FFA726' }]} />
                    <Text style={[styles.statusText, { color: onTrack ? '#51CF66' : '#FFA726' }]}>
                      {onTrack ? 'On track for your goal!' : 'Getting close to budget'}
                    </Text>
                  </View>
                  <Text style={styles.remainingText}>${Math.round(remaining)} left</Text>
                </View>
              </View>
            </LinearGradient>
          </BlurView>
        </View>

        {/* Savings Summary from Real Calculator */}

        {/* Spending by Category - Only show if we have data */}
        {spendingByCategory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            <View style={styles.categoryCard}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                style={styles.categoryGradient}
              >
                {spendingByCategory.map((item, index) => {
                  const percentage = spent > 0 ? (item.amount / spent) * 100 : 0
                  const barWidth = (item.amount / maxCategoryAmount) * 100
                  
                  return (
                    <View key={index} style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryIcon}>{item.icon}</Text>
                        <View style={styles.categoryText}>
                          <Text style={styles.categoryName}>{item.category}</Text>
                          <View style={styles.categoryBar}>
                            <View 
                              style={[
                                styles.categoryBarFill, 
                                { width: `${barWidth}%`, backgroundColor: item.color }
                              ]} 
                            />
                          </View>
                        </View>
                      </View>
                      <View style={styles.categoryAmount}>
                        <Text style={styles.categoryAmountText}>${Math.round(item.amount)}</Text>
                        <Text style={styles.categoryPercentage}>{Math.round(percentage)}%</Text>
                      </View>
                    </View>
                  )
                })}
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Weekly Trend - Only show if we have data */}
        {weeklySpending.length > 0 && weeklySpending.some(w => w.amount > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Spending</Text>
            <View style={styles.weeklyCard}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                style={styles.weeklyGradient}
              >
                <View style={styles.weeklyChart}>
                  {weeklySpending.map((week, index) => {
                    const maxWeekly = Math.max(...weeklySpending.map(w => w.amount), 1)
                    const barHeight = maxWeekly > 0 ? (week.amount / maxWeekly) * 100 : 0
                    
                    return (
                      <View key={index} style={styles.weeklyBar}>
                        <View style={styles.weeklyBarContainer}>
                          {week.amount > 0 && (
                            <LinearGradient
                              colors={['#6A9571', '#51CF66']}
                              style={[styles.weeklyBarFill, { height: `${barHeight}%` }]}
                            />
                          )}
                        </View>
                        <Text style={styles.weeklyAmount}>${Math.round(week.amount)}</Text>
                        <Text style={styles.weeklyLabel}>{week.week}</Text>
                      </View>
                    )
                  })}
                </View>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Receipt Summary with Link to History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Receipt Summary</Text>
            {monthlyReceiptsForSelectedMonth.length > 0 && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.push('/receipts-history')
                }}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color="#6A9571" />
              </Pressable>
            )}
          </View>
          
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/receipts-history')
            }}
            style={styles.receiptSummaryCard}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
              style={styles.receiptSummaryGradient}
            >
              <View style={styles.receiptStat}>
                <Ionicons name="receipt" size={32} color="#6A9571" />
                <Text style={styles.receiptCount}>{monthlyReceiptsForSelectedMonth.length}</Text>
                <Text style={styles.receiptLabel}>
                  {monthlyReceiptsForSelectedMonth.length === 1 ? 'Receipt' : 'Receipts'} This Month
                </Text>
              </View>
              
              {monthlyReceiptsForSelectedMonth.length === 0 && (
                <Text style={styles.emptyStateText}>
                  Scan receipts to start tracking your spending
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Edit Budget Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={styles.modalBlur}>
            <Pressable 
              style={styles.modalBackdrop} 
              onPress={() => setEditModalVisible(false)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Monthly Budget</Text>
              <Text style={styles.modalSubtitle}>Set your grocery budget goal</Text>
              
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputPrefix}>$</Text>
                <TextInput
                  value={newBudgetValue}
                  onChangeText={setNewBudgetValue}
                  keyboardType="numeric"
                  style={styles.modalInput}
                  placeholder="700"
                  placeholderTextColor="#999"
                  autoFocus
                />
              </View>

              <View style={styles.modalButtons}>
                <Pressable 
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setEditModalVisible(false)
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveBudget}
                >
                  <Text style={styles.modalButtonTextSave}>Save</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthArrow: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  
  // Main Budget Card
  mainBudgetCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  budgetCardGradient: {
    padding: 24,
  },
  budgetStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 28,
  },
  budgetStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  budgetStatIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  budgetStatValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  budgetStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budgetStatDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  progressSection: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6A9571',
    letterSpacing: -0.5,
  },
  progressBar: {
    height: 10,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },

  // AI Insights
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightCard: {
    width: (width - 52) / 2,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  insightGradient: {
    padding: 16,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  insightMessage: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
    lineHeight: 18,
  },

  // Category Spending
  categoryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryGradient: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  categoryBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  categoryAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },

  // Weekly Spending
  weeklyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  weeklyGradient: {
    padding: 20,
  },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
  },
  weeklyBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  weeklyBarContainer: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  weeklyBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  weeklyAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  weeklyLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666666',
  },

  // Savings Goals
  goalCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  goalGradient: {
    padding: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  goalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  goalProgressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalPercentage: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },

  // Tips
  tipsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tipsGradient: {
    padding: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#6A9571',
  },
  modalInputPrefix: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F1F3F5',
  },
  modalButtonSave: {
    backgroundColor: '#6A9571',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  bottomSpacing: {
    height: 40,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },

  // Savings Summary Card
  savingsSummaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  savingsSummaryGradient: {
    padding: 24,
  },
  savingsStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  savingsAmount: {
    fontSize: 48,
    fontWeight: '600',
    color: '#6A9571',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  savingsDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    borderRadius: 12,
  },
  savingsDetailText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 12,
  },

  // Receipt Summary Card
  receiptSummaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  receiptSummaryGradient: {
    padding: 24,
  },
  receiptStat: {
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptCount: {
    fontSize: 40,
    fontWeight: '600',
    color: '#000000',
    marginVertical: 12,
  },
  receiptSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  receiptSummaryHint: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6A9571',
  },
  receiptLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
})

