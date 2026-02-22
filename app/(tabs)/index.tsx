// SAVR Dashboard - Enhanced Premium iOS Aesthetic with AI Intelligence
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
// RECIPES TEMPORARILY DISABLED FOR LAUNCH
// import SimpleRecipeImage from '../../components/SimpleRecipeImage'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useAuth } from '../../lib/AuthContext'
import { dataManager } from '../../lib/dataManager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useListsUnified } from '../../lib/useListsUnified'
import { usePantry } from '../../lib/PantryContext'
import { useHousehold } from '../../lib/HouseholdContext'
import { useReceipts } from '../../lib/ReceiptsContext'
import { expiryPredictionService } from '../../lib/ExpiryPredictionService'
import { capitalizeCategoryName } from '../../lib/ScanningService'
import { normalizeCategory, detectCategoryFromName } from '../../lib/PantryItemFormatter'
import { supabase } from '../../lib/supabase'
import { userPreferencesService } from '../../lib/UserPreferencesService'
// RECIPES TEMPORARILY DISABLED FOR LAUNCH
// import { intelligentRecipeService } from '../../lib/IntelligentRecipeService'
import { aiLearningService } from '../../lib/AILearningService'
import { trustBuildingService } from '../../lib/TrustBuildingService'
// import { useRecipes as useRecipesContext } from '../../lib/RecipesContext'
// import { aiRecipeGenerator } from '../../lib/AIRecipeGenerator'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import SageAssistantV2 from '../../components/SageAssistantV2'
import { PremiumCard, PremiumButton, PremiumSectionHeader, PremiumBadge, PremiumAvatar, PremiumProgressBar } from '../../components/PremiumComponents'
import { LiquidGlassCard, LiquidGlassButton, LiquidGlassIcon } from '../../components/LiquidGlassCard'
import { iOS26Tokens } from '../../lib/DesignSystem'
import { logger } from '../../lib/Logger'
import {
  scaleSize,
  scaleFont,
  scaleWidth,
  scaleHeight,
  responsivePadding,
  responsiveFonts,
  responsiveSpacing,
  getResponsiveDimensions,
  getDebugInfo,
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

// RECIPES TEMPORARILY DISABLED FOR LAUNCH
// Enhanced sample data
// const sampleRecipes = [...]

export default function DashboardScreen() {
  const { colors } = useSimpleTheme()
  const { user } = useAuth()
  const router = useRouter()

  const { lists } = useListsUnified()
  const { items: pantryItems, getExpiringItems } = usePantry()
  const { currentHousehold } = useHousehold()
  const hasNoPantryItems = !pantryItems || pantryItems.length === 0
  const showJoinPantryAction = hasNoPantryItems && !currentHousehold
  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // const { recipes, calculateIngredientMatch, getSuggestedRecipes, regenerateAIRecipes } = useRecipesContext()
  const { getMonthlyTotal, receipts, loading: receiptsLoading } = useReceipts()

  // Calculate items expiring within 7 days
  const getItemsExpiringSoon = () => {
    if (!pantryItems || pantryItems.length === 0) return 0
    
    const today = new Date()
    const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000))
    
    return pantryItems.filter((item: any) => {
      if (!item.expiry_date) return false
      const expiryDate = new Date(item.expiry_date)
      return expiryDate >= today && expiryDate <= sevenDaysFromNow
    }).length
  }
  const [refreshing, setRefreshing] = useState(false)
  const [userPreferences, setUserPreferences] = useState<any>(null)
  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // const [intelligentRecipes, setIntelligentRecipes] = useState<any[]>([])
  const [aiInsights, setAiInsights] = useState<any[]>([])
  const [trustIndicators, setTrustIndicators] = useState<any[]>([])
  // const [aiGeneratedRecipes, setAiGeneratedRecipes] = useState<Map<string, any>>(new Map())
  const [dashboardMetrics, setDashboardMetrics] = useState({
    itemsLowStock: 12,
    // recipesCooked: 0, // RECIPES DISABLED
    itemsScanned: 156
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [userAllergies, setUserAllergies] = useState<string[]>([])

  // Get most recently modified list
  const getMostRecentList = () => {
    if (!lists || lists.length === 0) {
      return {
        name: 'Grocery List',
        icon: '🛒',
        itemCount: 0,
        completedCount: 0,
        id: null
      }
    }
    
    // Sort by updated_at or use first list
    const sortedLists = [...lists].sort((a: any, b: any) => {
      const dateA = new Date(a.updated_at || a.createdAt || 0).getTime()
      const dateB = new Date(b.updated_at || b.createdAt || 0).getTime()
      return dateB - dateA
    })
    
    const list = sortedLists[0]
    return {
      name: list.name || 'Grocery List',
      icon: '🛒',
      itemCount: list.items?.length || 0,
      completedCount: list.items?.filter((item: any) => item.completed).length || 0,
      id: list.id
    }
  }

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const parallaxAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  // Simple personalized greeting (preferences first, then profile name, then email fallback).
  // Use safe string coercion to avoid throws from malformed user data (e.g. name as object).
  const getPersonalizedGreeting = () => {
    const hour = new Date().getHours()
    const safeStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
    let firstName = 'there'
    const prefsFirst = safeStr(userPreferences?.profile?.firstName)
    if (prefsFirst) {
      firstName = prefsFirst.split(' ')[0] || 'there'
    } else {
      const nameStr = safeStr(user?.name)
      if (nameStr) {
        firstName = nameStr.split(' ')[0] || 'there'
      } else if (user && typeof (user as any).user_metadata?.full_name === 'string') {
        firstName = (user as any).user_metadata.full_name.trim().split(' ')[0] || 'there'
      } else if (user?.email && typeof user.email === 'string') {
        firstName = user.email.split('@')[0] || 'there'
      }
    }
    if (hour < 12) return `Good morning, ${firstName}!`
    if (hour < 17) return `Good afternoon, ${firstName}!`
    return `Good evening, ${firstName}!`
  }

  const personalizedGreeting = getPersonalizedGreeting()

  // Smart notifications
  const smartNotifications = [
    { message: '3 items expiring soon', type: 'warning' }
    // RECIPES TEMPORARILY DISABLED FOR LAUNCH
    // { message: 'New recipe suggestions available', type: 'success' }
  ]

  // Get actual pantry categories from user's pantry items
  const getRealPantryCategories = () => {
    // Category metadata mapping (matching pantry.tsx)
    const categoryMetadata: Record<string, {
      icon: string
      color: string
      bgColor: string
      glassColor: [string, string]
      borderColor: string
      shadowColor: string
    }> = {
      'Produce': {
        icon: '🥦',
        color: '#51CF66',
        bgColor: 'rgba(81, 207, 102, 0.2)',
        glassColor: ['rgba(81, 207, 102, 0.12)', 'rgba(81, 207, 102, 0.06)'],
        borderColor: 'rgba(81, 207, 102, 0.3)',
        shadowColor: '#51CF66'
      },
      'Meat, Poultry & Seafood': {
        icon: '🍗',
        color: '#FF6B6B',
        bgColor: 'rgba(255, 107, 107, 0.2)',
        glassColor: ['rgba(255, 107, 107, 0.12)', 'rgba(255, 107, 107, 0.06)'],
        borderColor: 'rgba(255, 107, 107, 0.3)',
        shadowColor: '#FF6B6B'
      },
      'Dairy & Eggs': {
        icon: '🥛',
        color: '#4ECDC4',
        bgColor: 'rgba(78, 205, 196, 0.2)',
        glassColor: ['rgba(78, 205, 196, 0.12)', 'rgba(78, 205, 196, 0.06)'],
        borderColor: 'rgba(78, 205, 196, 0.3)',
        shadowColor: '#4ECDC4'
      },
      'Grains, Bread & Pasta': {
        icon: '🌾',
        color: '#FFA726',
        bgColor: 'rgba(255, 167, 38, 0.2)',
        glassColor: ['rgba(255, 167, 38, 0.12)', 'rgba(255, 167, 38, 0.06)'],
        borderColor: 'rgba(255, 167, 38, 0.3)',
        shadowColor: '#FFA726'
      },
      'Condiments, Sauces & Spreads': {
        icon: '🥫',
        color: '#795548',
        bgColor: 'rgba(121, 85, 72, 0.2)',
        glassColor: ['rgba(121, 85, 72, 0.12)', 'rgba(121, 85, 72, 0.06)'],
        borderColor: 'rgba(121, 85, 72, 0.3)',
        shadowColor: '#795548'
      },
      'Pantry Staples & Essentials': {
        icon: '🧂',
        color: '#8D6E63',
        bgColor: 'rgba(141, 110, 99, 0.2)',
        glassColor: ['rgba(141, 110, 99, 0.12)', 'rgba(141, 110, 99, 0.06)'],
        borderColor: 'rgba(141, 110, 99, 0.3)',
        shadowColor: '#8D6E63'
      },
      'Plant-Based Proteins & Legumes': {
        icon: '🍱',
        color: '#4ECDC4',
        bgColor: 'rgba(78, 205, 196, 0.2)',
        glassColor: ['rgba(78, 205, 196, 0.12)', 'rgba(78, 205, 196, 0.06)'],
        borderColor: 'rgba(78, 205, 196, 0.3)',
        shadowColor: '#4ECDC4'
      },
      'Snacks, Sweets & Desserts': {
        icon: '🍫',
        color: '#FF8A65',
        bgColor: 'rgba(255, 138, 101, 0.2)',
        glassColor: ['rgba(255, 138, 101, 0.12)', 'rgba(255, 138, 101, 0.06)'],
        borderColor: 'rgba(255, 138, 101, 0.3)',
        shadowColor: '#FF8A65'
      },
      'Beverages': {
        icon: '🥤',
        color: '#9C27B0',
        bgColor: 'rgba(156, 39, 176, 0.2)',
        glassColor: ['rgba(156, 39, 176, 0.12)', 'rgba(156, 39, 176, 0.06)'],
        borderColor: 'rgba(156, 39, 176, 0.3)',
        shadowColor: '#9C27B0'
      },
      'Non-Food / Misc': {
        icon: '📦',
        color: '#777777',
        bgColor: 'rgba(120, 120, 128, 0.2)',
        glassColor: ['rgba(120, 120, 128, 0.12)', 'rgba(120, 120, 128, 0.06)'],
        borderColor: 'rgba(120, 120, 128, 0.3)',
        shadowColor: '#777777'
      }
    }

    const categoryDisplayNames: Record<string, string> = {
      'Condiments, Sauces & Spreads': 'Condiments and Sauces',
      'Plant-Based Proteins & Legumes': 'Proteins and Legumes',
    }

    // Get unique normalized categories from actual pantry items
    const categoryCounts: Record<string, number> = {}
    
    pantryItems.forEach(item => {
      // Normalize the category (same logic as pantry screen)
      const detectedCategory = detectCategoryFromName(item.name)
      let normalizedCategory = normalizeCategory(item.category || detectedCategory || 'Non-Food / Misc')
      
      if (
        detectedCategory &&
        detectedCategory !== 'Pantry Staples & Essentials' &&
        detectedCategory !== 'Non-Food / Misc' &&
        detectedCategory !== normalizedCategory
      ) {
        normalizedCategory = detectedCategory
      } else if (
        normalizedCategory === 'Pantry Staples & Essentials' ||
        normalizedCategory === 'Non-Food / Misc'
      ) {
        normalizedCategory = detectedCategory || normalizedCategory
      }

      // Count items per category
      categoryCounts[normalizedCategory] = (categoryCounts[normalizedCategory] || 0) + 1
    })

    // Convert to array with metadata, only including categories that have items
    return Object.entries(categoryCounts)
      .map(([categoryName, count]) => {
        const metadata = categoryMetadata[categoryName] || {
          icon: '📦',
          color: '#777777',
          bgColor: 'rgba(120, 120, 128, 0.2)',
          glassColor: ['rgba(120, 120, 128, 0.12)', 'rgba(120, 120, 128, 0.06)'] as [string, string],
          borderColor: 'rgba(120, 120, 128, 0.3)',
          shadowColor: '#777777'
        }

        return {
          name: categoryName,
          displayName: categoryDisplayNames[categoryName] ?? categoryName,
          icon: metadata.icon,
          count,
          color: metadata.color,
          bgColor: metadata.bgColor,
          glassColor: metadata.glassColor,
          borderColor: metadata.borderColor,
          shadowColor: metadata.shadowColor
        }
      })
      .filter(category => category.count > 0) // Only show categories with items
      .sort((a, b) => b.count - a.count) // Sort by count (most items first)
  }

  const topPantryCategories = getRealPantryCategories()

  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // Time-based recommendations
  // const timeBasedRecommendations = getSuggestedRecipes().slice(0, 3)

  // Collaborative lists
  const collaborativeLists = [
    { name: 'Mia', avatar: 'M', isOnline: true },
    { name: 'John', avatar: 'J', isOnline: false }
  ]

  // Refresh user preferences (budget is derived from monthlySpent + userPreferences)
  const refreshUserPreferences = async () => {
    if (user?.id) {
      try {
        const preferences = await userPreferencesService.loadPreferences(user.id)
        setUserPreferences(preferences)
        logger.debug('User preferences refreshed for real-time updates')
      } catch (error) {
        logger.error('Error refreshing user preferences', { error })
      }
    }
  }

  // Calculate monthly total from receipts (memoized for performance)
  const monthlySpent = useMemo(() => {
    const total = getMonthlyTotal()
    logger.debug('Monthly spent calculated', { total, receiptCount: receipts.length })
    return total
  }, [receipts])

  // Derive budget from monthlySpent + preferences so home never shows stale 0
  // Coerce monthly to number (preferences store it as string e.g. "500")
  const budgetData = useMemo(() => {
    const raw = userPreferences?.budget?.monthly
    const monthlyGoal = typeof raw === 'number' ? raw : Number(raw) || 0
    const spent = Number(monthlySpent) || 0
    const remaining = monthlyGoal > 0 ? Math.max(0, monthlyGoal - spent) : 0
    const progress = monthlyGoal > 0 ? Math.min(100, (spent / monthlyGoal) * 100) : 0
    return { monthlyGoal, spent, remaining, progress }
  }, [monthlySpent, userPreferences?.budget?.monthly])

  // Show budget loading while receipts load so we never flash $0
  const showBudgetLoading = receiptsLoading

  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // Regenerate AI recipes when pantry changes
  // useEffect(() => {
  //   if (user && pantryItems.length > 0) {
  //     console.log('🔄 Pantry changed - regenerating personalized recipes...')
  //     console.log('📦 Current pantry items:', pantryItems.map(item => item.name))
  //     
  //     // Add a small delay to prevent too frequent regeneration
  //     const timeoutId = setTimeout(() => {
  //       regenerateAIRecipes().then(() => {
  //         // Debug: Check recipes after pantry change
  //         const suggestedRecipes = getSuggestedRecipes()
  //         console.log('📋 Recipes after pantry change:', suggestedRecipes.length)
  //         console.log('🎯 Top recipes:', suggestedRecipes.slice(0, 4).map(r => `${r.title}: ${r.matchPercentage}%`))
  //       }).catch(error => {
  //         console.error('❌ Error regenerating recipes after pantry change:', error)
  //         console.log('🔄 Recipe regeneration failed, but app will continue with existing recipes')
  //       })
  //     }, 1000) // 1 second delay
  //     
  //     return () => clearTimeout(timeoutId)
  //   }
  // }, [pantryItems.length, user])

  // Load user allergies for Allergy Shield
  useEffect(() => {
    const loadAllergies = async () => {
      if (user?.id) {
        try {
          const preferences = await userPreferencesService.loadPreferences(user.id)
          setUserAllergies(preferences?.dietary?.allergies || [])
        } catch (error) {
          logger.error('Error loading allergies', { error })
        }
      }
    }
    loadAllergies()
  }, [user])

  // Real-time subscription for user preferences (allergies) updates
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('dashboard-user-preferences-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('User preferences updated - refreshing dashboard')
          // Reload allergies when preferences change
          userPreferencesService.loadPreferences(user.id).then(preferences => {
            setUserAllergies(preferences?.dietary?.allergies || [])
            setUserPreferences(preferences)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Real-time subscription for pantry items updates
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('dashboard-pantry-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pantry_items',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Pantry items updated - dashboard will refresh via PantryContext')
          // PantryContext will handle the update, but we can force a refresh
          setRefreshKey(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Refresh preferences when user returns to dashboard (for instant updates)
  // RECIPES TEMPORARILY DISABLED FOR LAUNCH
  // Refresh preferences when dashboard gains focus (e.g. after returning from another screen or after sign-in)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        logger.debug('Dashboard focused - refreshing data for instant updates')
        refreshUserPreferences()
        setRefreshKey(prev => prev + 1)
      }
    }, [user])
  )

  // Delayed refresh so sign-up/onboarding info appears after applyPendingOnboardingData completes
  useEffect(() => {
    if (!user?.id) return
    refreshUserPreferences()
    const t = setTimeout(() => {
      refreshUserPreferences()
    }, 800)
    return () => clearTimeout(t)
  }, [user?.id])

  useEffect(() => {
    // Load user preferences and AI data
    const loadUserData = async () => {
      if (user?.id) {
        const preferences = await userPreferencesService.loadPreferences(user.id)
        setUserPreferences(preferences)
        
        // Load allergies for Allergy Shield
        setUserAllergies(preferences?.dietary?.allergies || [])
        
        // RECIPES TEMPORARILY DISABLED FOR LAUNCH
        // Load intelligent recipes
        // const recipes = await intelligentRecipeService.getPersonalizedRecipes(user.id, {
        //   timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
        //   pantryItems: pantryItems.map(item => item.name)
        // })
        // setIntelligentRecipes(recipes)
        
        // Load AI insights
        const insights = await aiLearningService.getLearningInsights(user.id)
        setAiInsights([insights])
        
        // Load trust indicators
        const trustIndicators = await trustBuildingService.generateTrustIndicators(user.id)
        setTrustIndicators(trustIndicators)
        
        // Budget is derived from receipts + preferences; no separate load needed
        
        // RECIPES TEMPORARILY DISABLED FOR LAUNCH
        // NOTE: Recipe generation is handled automatically by RecipesContext
        // It will generate recipes when pantry items are detected
        // No need to manually trigger here - this prevents duplicate generation
        // if (pantryItems.length > 0) {
        //   console.log('📦 Pantry items detected - recipes will be generated automatically by RecipesContext')
        //   const suggestedRecipes = getSuggestedRecipes()
        //   console.log('📋 Current recipes available:', suggestedRecipes.length)
        // } else {
        //   console.log('📦 No pantry items found, skipping recipe generation')
        // }
      }
    }
    loadUserData()

    // Advanced entrance animations with staggered timing
    const entranceAnimations = Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
      ]),
      Animated.timing(parallaxAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ])

    // Subtle glow animation for premium feel
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    )

    entranceAnimations.start()
    glowAnimation.start()

    return () => {
      entranceAnimations.stop()
      glowAnimation.stop()
    }
  }, [user, pantryItems])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshUserPreferences()
      setRefreshKey(prev => prev + 1)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const handleQuickAction = (action: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    switch (action) {
      case 'scan':
        router.push('/scan')
        break
      case 'pantry':
        router.push('/(tabs)/pantry')
          break
      case 'lists':
        router.push('/(tabs)/lists')
          break
      // RECIPES ACTION TEMPORARILY DISABLED FOR LAUNCH
      // case 'recipes':
      //   router.push('/(tabs)/recipes')
      //   break
    }
  }

  const handleVoiceListCommand = (command: string) => {
    logger.debug('Voice list command received', { command })
    // Handle voice commands for list management
  }

  // Optimal Dashboard Layout
    return (
      <View style={styles.cleanContainer}>
        <ExpoStatusBar style="dark" />
        
        {/* Clean Gradient Background */}
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
          style={styles.content}
        contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Optimal Dashboard Layout */}
        
        {/* 1. HEADER */}
        <View style={styles.cleanHeader}>
          <View>
            <Text style={styles.cleanAppTitle}>SAVR</Text>
            <Text style={styles.headerSubtitle}>{personalizedGreeting}</Text>
          </View>
        </View>

        {/* ALLERGY SHIELD STATUS BAR – light gray card, generous padding */}
        {userAllergies.length > 0 && (
          <View style={styles.allergyShieldContainer}>
            <View style={styles.allergyShieldCard}>
              <Pressable 
                style={styles.allergyShieldContent}
                onPress={() => router.push('/(tabs)/allergies')}
              >
                <View style={styles.allergyShieldIcon}>
                  <Ionicons name="shield-checkmark" size={18} color="#6A9571" />
                </View>
                <View style={styles.allergyShieldText}>
                  <Text style={styles.allergyShieldTitle}>Allergy Shield Active</Text>
                  <Text style={styles.allergyShieldSubtitle}>
                    Monitoring {userAllergies.slice(0, 3).join(', ')}{userAllergies.length > 3 ? ` +${userAllergies.length - 3} more` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
              </Pressable>
            </View>
          </View>
        )}
            
        {/* 2. URGENT ALERTS (Budget Only) */}
        {budgetData.progress > 90 && (
          <View style={styles.urgentAlertsSection}>
            <View style={styles.glassAlertCard}>
              <LinearGradient
                colors={['rgba(255, 107, 107, 0.15)', 'rgba(255, 107, 107, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.glassAlertGradient}
              >
                <View style={styles.urgentAlertIcon}>
                  <Text style={styles.urgentAlertEmoji}>💰</Text>
                </View>
                <View style={styles.urgentAlertContent}>
                  <Text style={styles.urgentAlertTitle}>Budget Alert</Text>
                  <Text style={styles.urgentAlertMessage}>
                    {budgetData.progress > 100 ? 'Over budget!' : 'Almost at budget limit'}
                  </Text>
                </View>
                <Pressable
                  style={styles.urgentAlertAction}
                  onPress={() => router.push('/budget-tracking')}
                >
                  <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
                </Pressable>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* RECIPES SECTION TEMPORARILY HIDDEN FOR LAUNCH - Code preserved */}
        {/* Recipe functionality can be restored by uncommenting the recipes tab in _layout.tsx */}

        {/* 4. PANTRY OVERVIEW (Condensed) */}
        <View style={styles.condensedPantrySection}>
          <View style={styles.optimalSectionHeader}>
            <Text style={styles.optimalSectionTitle}>Your Pantry</Text>
              <Pressable onPress={() => router.push('/(tabs)/pantry')}>
              <Text style={styles.optimalViewAllText}>Manage →</Text>
              </Pressable>
            </View>
            
          {/* Scrollable Pantry Categories with Glassmorphism */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.pantryCategoriesScroll}
            contentContainerStyle={styles.pantryCategoriesContainer}
          >
            {topPantryCategories.map((category, index) => (
                  <Pressable 
                    key={category.name}
                    style={styles.pantryCategoryCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      router.push(`/(tabs)/pantry?category=${encodeURIComponent(category.name.toLowerCase())}`)
                    }}
                  >
                    <View style={[styles.pantryCategoryContent, { 
                      borderColor: category.borderColor,
                    }]}>
                      {/* Subtle background gradient */}
                      <LinearGradient
                        colors={[category.bgColor, category.bgColor.replace('0.2', '0.08'), '#FFFFFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.pantryCategoryGradient}
                      />
                      
                      <View style={styles.pantryCategoryHeader}>
                        <View style={[styles.pantryCategoryIconWrapper, {
                          backgroundColor: category.bgColor,
                        }]}>
                          <Text style={styles.pantryCategoryIcon}>{category.icon}</Text>
                        </View>
                        <View style={[styles.pantryCategoryBadge, { 
                          backgroundColor: category.color,
                          shadowColor: category.color,
                        }]}>
                          <Text style={styles.pantryCategoryBadgeText}>{category.count}</Text>
                        </View>
                      </View>
                      <Text style={styles.pantryCategoryName} numberOfLines={1}>{category.displayName}</Text>
                    </View>
                  </Pressable>
            ))}
          </ScrollView>
            </View>

        {/* Items Expiring Soon – liquid glass + glassmorphism, light red tint */}
        {getItemsExpiringSoon() > 0 && (
          <View style={styles.urgentAlertsSection}>
            <View style={styles.expiringSoonGlassOuter}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={48} tint="light" style={styles.expiringSoonGlassBlur}>
                  <View style={styles.expiringSoonGlassBorder}>
                    <LinearGradient
                      colors={[
                        'rgba(255, 240, 240, 0.72)',
                        'rgba(255, 218, 218, 0.52)',
                        'rgba(255, 228, 228, 0.58)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.expiringSoonGlassGradient}
                    >
                      <Pressable
                        style={[styles.expiringSoonContent, { padding: 0 }]}
                        onPress={() => router.push('/(tabs)/pantry?filter=expiring')}
                      >
                        <View style={styles.urgentAlertIcon}>
                          <Ionicons name="warning" size={22} color="#FF9500" />
                        </View>
                        <View style={styles.urgentAlertContent}>
                          <Text style={styles.urgentAlertTitle}>Items Expiring Soon</Text>
                          <Text style={styles.urgentAlertMessage}>
                            {getItemsExpiringSoon()} item{getItemsExpiringSoon() !== 1 ? 's' : ''} expiring within 7 days
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                      </Pressable>
                    </LinearGradient>
                  </View>
                </BlurView>
              ) : (
                <View style={styles.expiringSoonGlassBorder}>
                  <LinearGradient
                    colors={[
                      'rgba(255, 240, 240, 0.85)',
                      'rgba(255, 218, 218, 0.7)',
                      'rgba(255, 228, 228, 0.75)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.expiringSoonGlassGradient}
                  >
                    <Pressable
                      style={[styles.expiringSoonContent, { padding: 0 }]}
                      onPress={() => router.push('/(tabs)/pantry?filter=expiring')}
                    >
                      <View style={styles.urgentAlertIcon}>
                        <Ionicons name="warning" size={22} color="#FF9500" />
                      </View>
                      <View style={styles.urgentAlertContent}>
                        <Text style={styles.urgentAlertTitle}>Items Expiring Soon</Text>
                        <Text style={styles.urgentAlertMessage}>
                          {getItemsExpiringSoon()} item{getItemsExpiringSoon() !== 1 ? 's' : ''} expiring within 7 days
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                    </Pressable>
                  </LinearGradient>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 5. BUDGET SUMMARY (Compact) */}
        <View style={styles.compactBudgetSection}>
          <View style={styles.optimalSectionHeader}>
            <Text style={styles.optimalSectionTitle}>Budget</Text>
            <Pressable onPress={() => router.push('/budget-tracking')}>
              <Text style={styles.optimalViewAllText}>Details →</Text>
            </Pressable>
          </View>

          <LiquidGlassCard
            variant="ultraThin"
            borderRadius="lg"
            padding="md"
            shadow="liquidGlass"
          >
            <View style={styles.budgetProgressContainer}>
              {showBudgetLoading ? (
                <>
                  <View style={styles.budgetProgressHeader}>
                    <View style={styles.budgetSkeletonBar} />
                    <View style={[styles.budgetSkeletonBar, { width: 80 }]} />
                  </View>
                  <View style={styles.glassProgressBar}>
                    <View style={[styles.glassProgressFill, { width: '40%', backgroundColor: 'rgba(106, 149, 113, 0.4)' }]} />
                  </View>
                  <Text style={styles.budgetRemainingText}>Loading your budget…</Text>
                </>
              ) : (
                <>
                  <View style={styles.budgetProgressHeader}>
                    <Text style={styles.budgetSpent}>${budgetData.spent.toFixed(0)}</Text>
                    <Text style={styles.budgetGoal}>
                      {budgetData.monthlyGoal > 0 ? `of $${budgetData.monthlyGoal.toFixed(0)}` : 'spent this month'}
                    </Text>
                  </View>
                  <View style={styles.glassProgressBar}>
                    <View
                      style={[
                        styles.glassProgressFill,
                        {
                          width:
                            budgetData.monthlyGoal > 0
                              ? budgetData.progress <= 0
                                ? '2%'
                                : `${Math.min(budgetData.progress, 100)}%`
                              : '100%',
                          backgroundColor:
                            budgetData.monthlyGoal > 0 && budgetData.progress <= 0
                              ? '#9E9E9E'
                              : undefined,
                        },
                      ]}
                    >
                      {budgetData.monthlyGoal > 0 && budgetData.progress > 0 && (
                        <LinearGradient
                          colors={
                            budgetData.progress > 90
                              ? ['#FF6B6B', '#FF8787']
                              : ['#51CF66', '#6A9571']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                    </View>
                  </View>
                  <Text style={styles.budgetRemainingText}>
                    {budgetData.monthlyGoal > 0 ? (
                      budgetData.remaining > 0 
                        ? (() => {
                            // Calculate days remaining in month
                            const now = new Date()
                            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                            const dayOfMonth = now.getDate()
                            const daysRemaining = daysInMonth - dayOfMonth
                            const dailyAverage = budgetData.spent / dayOfMonth
                            const projectedSpend = dailyAverage * daysInMonth
                            
                            if (projectedSpend > budgetData.monthlyGoal) {
                              const overspendDate = Math.ceil(budgetData.monthlyGoal / dailyAverage)
                              return `You'll overspend by the ${overspendDate}${overspendDate === 1 ? 'st' : overspendDate === 2 ? 'nd' : overspendDate === 3 ? 'rd' : 'th'} at this pace`
                            } else if (budgetData.progress < 50) {
                              return `You're on track — great job!`
                            } else {
                              return `$${budgetData.remaining.toFixed(0)} left this month`
                            }
                          })()
                        : budgetData.remaining < 0 
                          ? `$${Math.abs(budgetData.remaining).toFixed(0)} over budget`
                          : 'At budget limit'
                    ) : (
                      'Set a budget goal to track your spending'
                    )}
                  </Text>
                  {budgetData.monthlyGoal === 0 && (
                    <Pressable 
                      style={styles.budgetSetupButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        router.push('/budget-tracking')
                      }}
                    >
                      <LinearGradient
                        colors={['#6A9571', '#5A8561']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.budgetSetupButtonGradient}
                      >
                        <Text style={styles.budgetSetupButtonText}>Set Budget Goal</Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </LiquidGlassCard>
        </View>

        {/* 6. SMART GROCERY LIST */}
        <View style={styles.smartListSection}>
          <View style={styles.optimalSectionHeader}>
            <Text style={styles.optimalSectionTitle}>Shopping List</Text>
            <Pressable onPress={() => {
              const mostRecentList = getMostRecentList()
              if (mostRecentList.id) {
                router.push(`/list-detail?id=${mostRecentList.id}`)
              } else {
                router.push('/(tabs)/lists')
              }
            }}>
              <Text style={styles.optimalViewAllText}>Manage →</Text>
            </Pressable>
          </View>
          
          <LiquidGlassCard
            variant="ultraThin"
            borderRadius="lg"
            padding="lg"
            shadow="liquidGlass"
          >
            <Pressable 
              style={styles.smartListContent}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                const mostRecentList = getMostRecentList()
                if (mostRecentList.id) {
                  router.push(`/list-detail?id=${mostRecentList.id}`)
                } else {
                  router.push('/(tabs)/lists')
                }
              }}
            >
              <View style={styles.smartListIcon}>
                <Text style={styles.smartListEmoji}>🛒</Text>
              </View>
              <View style={styles.smartListInfo}>
                <Text style={styles.smartListTitle}>{getMostRecentList().name}</Text>
                <Text style={styles.smartListSubtitle}>
                  {getMostRecentList().itemCount} items • {getMostRecentList().completedCount} completed
                </Text>
              </View>
              <Pressable 
                style={styles.smartListAction}
                onPress={() => {
                  const mostRecentList = getMostRecentList()
                  if (mostRecentList.id) {
                    router.push(`/list-detail?id=${mostRecentList.id}`)
                  } else {
                    router.push('/(tabs)/lists')
                  }
                }}
              >
                <Ionicons name="chevron-forward" size={20} color="#6A9571" />
              </Pressable>
            </Pressable>
          </LiquidGlassCard>
        </View>

        {/* 7. QUICK ACTIONS */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.optimalSectionTitle}>Quick Actions</Text>
          
          {/* 2x2 Grid Layout */}
          <View style={styles.quickActionsGridContainer}>
            {/* First Row */}
            <View style={styles.quickActionsRow}>
              <LiquidGlassCard
                variant="ultraThin"
                borderRadius="lg"
                padding="xl"
                shadow="liquidGlass"
                style={styles.quickActionCardWrapper}
              >
                <Pressable 
                  style={styles.quickActionContent}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push('/scan?mode=receipt')
                  }}
                >
                  <View style={styles.quickActionIcon}>
                    <Text style={styles.quickActionEmoji}>📸</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>Scan Receipt</Text>
                  <Text style={styles.quickActionSubtitle}>Add items to pantry</Text>
                </Pressable>
              </LiquidGlassCard>

              <LiquidGlassCard
                variant="ultraThin"
                borderRadius="lg"
                padding="xl"
                shadow="liquidGlass"
                style={styles.quickActionCardWrapper}
              >
                <Pressable 
                  style={styles.quickActionContent}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    if (showJoinPantryAction) {
                      router.push('/pantry-household')
                    } else {
                      router.push('/(tabs)/pantry?openManualAdd=true')
                    }
                  }}
                >
                  <View style={styles.quickActionIcon}>
                    <Text style={styles.quickActionEmoji}>{showJoinPantryAction ? '👋' : '📦'}</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>{showJoinPantryAction ? 'Join Pantry' : 'Add Items'}</Text>
                  <Text style={styles.quickActionSubtitle}>{showJoinPantryAction ? 'Use a share code' : 'Manual entry'}</Text>
                </Pressable>
              </LiquidGlassCard>
            </View>

            {/* Second Row */}
            <View style={styles.quickActionsRow}>
              <LiquidGlassCard
                variant="ultraThin"
                borderRadius="lg"
                padding="xl"
                shadow="liquidGlass"
                style={styles.quickActionCardWrapper}
              >
                <Pressable 
                  style={styles.quickActionContent}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push('/scan')
                  }}
                >
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="shield-checkmark" size={28} color="#FF6B6B" />
                  </View>
                  <Text style={styles.quickActionTitle}>Check for Allergy</Text>
                  <Text style={styles.quickActionSubtitle}>Scan product</Text>
                </Pressable>
              </LiquidGlassCard>

              <LiquidGlassCard
                variant="ultraThin"
                borderRadius="lg"
                padding="xl"
                shadow="liquidGlass"
                style={styles.quickActionCardWrapper}
              >
                <Pressable 
                  style={styles.quickActionContent}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push('/(tabs)/lists?openNewList=true')
                  }}
                >
                  <View style={styles.quickActionIcon}>
                    <Text style={styles.quickActionEmoji}>📝</Text>
                  </View>
                  <Text style={styles.quickActionTitle}>New List</Text>
                  <Text style={styles.quickActionSubtitle}>Start shopping</Text>
                </Pressable>
              </LiquidGlassCard>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.cleanBottomSpacing} />
      </ScrollView>

      {/* SAGE Assistant */}
      <SageAssistantV2 
        onListCommand={handleVoiceListCommand}
      />
      </View>
  )
}

const styles = StyleSheet.create({
  cleanContainer: {
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  cleanBottomSpacing: {
    height: 100,
  },

  // Header – match Allergies tab exactly (position and size of SAVR logo)
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cleanAppTitle: {
    fontSize: responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.sm,
  },
  headerSubtitle: {
    fontSize: responsiveFonts.lg,
    color: '#8E8E93',
    marginTop: responsiveSpacing.sm,
  },
  smartSummaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  smartSummaryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  smartSummaryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    lineHeight: 20,
  },
  smartSummaryUrgent: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  smartSummaryWarning: {
    color: '#FF9500',
    fontWeight: '600',
  },
  smartSummaryArrow: {
    marginLeft: 8,
  },
  allergyShieldContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  allergyShieldCard: {
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 0,
  },
  allergyShieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergyShieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  allergyShieldText: {
    flex: 1,
  },
  allergyShieldTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  allergyShieldSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  debugText: {
    fontSize: responsiveFonts.xs,
    color: '#FF6B6B',
    marginTop: responsiveSpacing.sm,
    fontFamily: 'monospace',
  },
  quickStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    marginHorizontal: 16,
  },

  // Urgent Alerts
  urgentAlertsSection: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  expiringSoonCard: {
    backgroundColor: 'rgba(255, 210, 210, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 120, 120, 0.5)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  expiringSoonGlassOuter: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#E88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  expiringSoonGlassBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  expiringSoonGlassBorder: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 140, 0.5)',
    overflow: 'hidden',
  },
  expiringSoonGlassGradient: {
    padding: 16,
    borderRadius: 15,
  },
  expiringSoonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  glassAlertCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  glassAlertGradient: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgentAlertIcon: {
    marginRight: 12,
  },
  urgentAlertEmoji: {
    fontSize: 20,
  },
  urgentAlertContent: {
    flex: 1,
  },
  urgentAlertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  urgentAlertMessage: {
    fontSize: 14,
    color: '#8E8E93',
  },
  urgentAlertAction: {
    padding: 8,
  },

  // Streamlined Recipes
  streamlinedRecipesSection: {
    paddingHorizontal: 24,
    marginBottom: 12,
    backgroundColor: 'transparent', // Smooth blended background
    overflow: 'visible', // Allow shadows to extend beyond
  },
  streamlinedRecipesScroll: {
    marginTop: 12,
    backgroundColor: 'transparent', // Smooth blended background
    overflow: 'visible', // Allow shadows to extend
  },
  streamlinedRecipesContainer: {
    paddingRight: 24,
    paddingLeft: 0, // Remove left padding to eliminate gap
    paddingVertical: 8, // Add vertical padding for floating effect
  },
  streamlinedRecipeCard: {
    width: '100%',
    borderRadius: 20,
  },
  streamlinedRecipeImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  streamlinedRecipeImage: {
    width: '100%',
    height: 100,
    borderRadius: 12,
  },
  streamlinedRecipeFallback: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamlinedRecipeFallbackEmoji: {
    fontSize: 32,
  },
  streamlinedMatchBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streamlinedMatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  streamlinedRecipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 20,
  },
  streamlinedRecipeSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Glassmorphic Recipe Cards - Floating Effect
  glassRecipeCardWrapper: {
    width: responsiveDims.isSmallScreen ? scaleWidth(140) : scaleWidth(160),
    marginRight: responsiveSpacing.md,
    backgroundColor: 'transparent',
    marginVertical: responsiveSpacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  glassRecipeCard: {
    width: responsiveDims.isSmallScreen ? scaleWidth(140) : scaleWidth(160),
    marginRight: responsiveSpacing.md,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  glassRecipeGradient: {
    padding: responsiveSpacing.lg,
    borderRadius: 20,
  },

  // Condensed Pantry
  condensedPantrySection: {
    paddingHorizontal: 20,
    marginBottom: responsiveSpacing.xxxl,
  },
  topCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
  },
  horizontalCategoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.xs,
  },
  pantryCategoriesScroll: {
    marginTop: responsiveSpacing.lg,
  },
  pantryCategoriesContainer: {
    paddingLeft: 0,
    paddingRight: 20,
  },
  topCategoryCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: (width - 72) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: responsiveSpacing.md,
    padding: responsiveSpacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topCategoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  topCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    textAlign: 'center',
  },
  topCategoryCount: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Enhanced Modern Category Cards
  pantryCategoryCard: {
    width: 120,
    height: 120,
    marginRight: responsiveSpacing.md,
    borderRadius: 18,
  },
  pantryCategoryContent: {
    width: '100%',
    height: '100%',
    padding: responsiveSpacing.lg,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  pantryCategoryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    opacity: 0.6,
  },
  pantryCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    zIndex: 1,
  },
  pantryCategoryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pantryCategoryIcon: {
    fontSize: 28,
    lineHeight: 28,
  },
  pantryCategoryBadge: {
    minWidth: 26,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pantryCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  pantryCategoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.15,
    lineHeight: 17,
    zIndex: 1,
  },

  // Compact Budget with Glassmorphism
  compactBudgetSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  budgetCardLightGray: {
    backgroundColor: 'rgba(248, 248, 248, 0.98)',
  },
  glassBudgetCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glassBudgetGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  budgetProgressContainer: {
    flex: 1,
  },
  budgetProgressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  budgetSkeletonBar: {
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(142, 142, 147, 0.25)',
    flex: 1,
    marginRight: 8,
  },
  budgetSpent: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  budgetGoal: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  compactProgressBar: {
    height: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  glassProgressBar: {
    height: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  glassProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetRemainingText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Budget Setup Styles
  budgetSetupContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  budgetSetupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  budgetSetupDescription: {
    fontSize: 14,
    color: '#6A9571',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  budgetSetupButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 12,
  },
  budgetSetupButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  budgetSetupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Smart List
  smartListSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  smartListCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  glassSmartListCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassSmartListGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  smartListContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smartListIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  smartListEmoji: {
    fontSize: 20,
  },
  smartListInfo: {
    flex: 1,
  },
  smartListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  smartListSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  smartListAction: {
    padding: 8,
  },

  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  quickActionsGridContainer: {
    marginTop: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 0,
    gap: 12,
  },
  quickActionCardWrapper: {
    flex: 1,
    maxWidth: '48%',
  },
  quickActionCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: responsiveSpacing.lg,
    alignItems: 'center',
    marginHorizontal: responsiveSpacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  glassQuickActionCard: {
    flex: 1,
    minHeight: 180,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: responsiveSpacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassQuickActionGradient: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  quickActionEmoji: {
    fontSize: responsiveFonts.xxl,
  },
  quickActionTitle: {
    fontSize: responsiveFonts.md,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: responsiveFonts.sm,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Common Section Styles
  optimalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  optimalSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  optimalViewAllText: {
    fontSize: responsiveFonts.md,
    fontWeight: '500',
    color: '#6A9571',
  },

  // iOS 26 Liquid Glass Styles
  ios26QuickActionCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: responsiveSpacing.xs,
  },
  ios26QuickActionTitle: {
    fontSize: responsiveFonts.md,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  ios26QuickActionSubtitle: {
    fontSize: responsiveFonts.sm,
    color: '#8E8E93',
    textAlign: 'center',
    letterSpacing: 0,
  },
  // Expiring Items Widget
  expiringWidget: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 20,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  expiringWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  expiringWidgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  expiringWidgetButton: {
    alignSelf: 'flex-start',
  },
  expiringWidgetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6A9571',
    textDecorationLine: 'underline',
  },
})
