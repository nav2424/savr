// SAVR User Preferences Service - Manages user onboarding data and preferences
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { aiLearningService } from './AILearningService'

export interface UserPreferences {
  location: {
    country: string
    province: string
  }
  household: {
    size: string
    hasChildren: boolean | null
    hasPets: boolean | null
  }
  dietary: {
    preferences: string[]
    allergies: string[]           // User-entered allergies (raw)
    allergies_canonical?: string[] // Normalized canonical forms for detection
    cuisines: string[]
  }
  shopping: {
    frequency: string
    stores: string[]
    method: string
  }
  budget: {
    monthly: string
    savingsGoal: string
  }
  profile?: {
    firstName?: string
    lastName?: string
    householdSize?: string
    dietaryPreferences?: string
    allergies?: string
    cookingSkill?: string
    budgetGoal?: string
  }
  notifications?: {
    pushNotifications: boolean
    expiryAlerts: boolean
    listUpdates: boolean
    recipeSuggestions: boolean
    weeklyReminders: boolean
  }
}

class UserPreferencesService {
  private static instance: UserPreferencesService
  private preferences: UserPreferences | null = null

  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService()
    }
    return UserPreferencesService.instance
  }

  // Save preferences to both local storage and Supabase
  async savePreferences(preferences: UserPreferences, userId: string): Promise<{ error: any }> {
    try {
      // Save to local storage for immediate access
      await AsyncStorage.setItem('user_preferences', JSON.stringify(preferences))
      this.preferences = preferences

      // Save to Supabase user profile
      const { error } = await supabase
        .from('users')
        .update({
          preferences: preferences
        })
        .eq('id', userId)

      if (error) {
        console.error('Error saving preferences to Supabase:', error)
        return { error }
      }

      // Initialize AI learning system with onboarding data
      await aiLearningService.initializeUser(userId, preferences)

      return { error: null }
    } catch (error) {
      console.error('Error saving preferences:', error)
      return { error }
    }
  }

  // Load preferences from local storage or Supabase
  async loadPreferences(userId?: string): Promise<UserPreferences | null> {
    try {
      // First try local storage
      const localPreferences = await AsyncStorage.getItem('user_preferences')
      if (localPreferences) {
        this.preferences = JSON.parse(localPreferences)
        return this.preferences
      }

      // If no local preferences and we have a userId, try Supabase
      if (userId) {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single()

        if (!error && data?.preferences) {
          this.preferences = data.preferences
          // Cache in local storage
          await AsyncStorage.setItem('user_preferences', JSON.stringify(data.preferences))
          return this.preferences
        }
      }

      return null
    } catch (error) {
      console.error('Error loading preferences:', error)
      return null
    }
  }

  // Get current preferences (cached)
  getPreferences(): UserPreferences | null {
    return this.preferences
  }

  // Clear preferences (for sign out)
  async clearPreferences(): Promise<void> {
    await AsyncStorage.removeItem('user_preferences')
    this.preferences = null
  }

  // Get dietary preferences for recipe filtering
  getDietaryPreferences(): string[] {
    return this.preferences?.dietary?.preferences || []
  }

  // Get allergies for recipe filtering and barcode scanning
  getAllergies(): string[] {
    return this.preferences?.dietary?.allergies || []
  }

  // Get canonical allergies (normalized forms) for detection engine
  getAllergiesCanonical(): string[] {
    // If canonical forms exist, use them; otherwise normalize on-the-fly
    if (this.preferences?.dietary?.allergies_canonical) {
      return this.preferences.dietary.allergies_canonical
    }
    // Fallback: normalize existing allergies
    return this.normalizeAllergies(this.preferences?.dietary?.allergies || [])
  }

  // Normalize allergies to canonical form
  private normalizeAllergies(allergies: string[]): string[] {
    const normalize = (s: string): string => {
      return s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    const canonicalMap: Record<string, string> = {
      'dairy': 'milk',
      'milk products': 'milk',
      'lactose': 'milk',
      'egg': 'egg',
      'eggs': 'egg',
      'peanut': 'peanut',
      'peanuts': 'peanut',
      'tree nut': 'tree_nuts',
      'tree nuts': 'tree_nuts',
      'nuts': 'tree_nuts',
      'fish': 'fish',
      'shellfish': 'shellfish',
      'crustacean': 'shellfish',
      'mollusk': 'shellfish',
      'soy': 'soy',
      'soya': 'soy',
      'soybean': 'soy',
      'wheat': 'wheat',
      'gluten': 'gluten',
      'sesame': 'sesame',
      'mustard': 'mustard',
      'sulfites': 'sulfites',
      'sulphites': 'sulfites'
    }

    return allergies.map(a => {
      const normalized = normalize(a)
      return canonicalMap[normalized] || normalized
    })
  }

  // Normalize and save allergies with canonical forms
  async normalizeAndSaveAllergies(allergies: string[], userId: string): Promise<{ error: any }> {
    const preferences = await this.loadPreferences(userId)
    if (!preferences) {
      return { error: new Error('Preferences not found') }
    }

    const canonical = this.normalizeAllergies(allergies)
    preferences.dietary.allergies = allergies
    preferences.dietary.allergies_canonical = canonical

    return await this.savePreferences(preferences, userId)
  }

  // Get cuisine preferences
  getCuisinePreferences(): string[] {
    return this.preferences?.dietary?.cuisines || []
  }

  // Check if user has completed onboarding
  hasCompletedOnboarding(): boolean {
    return this.preferences !== null
  }

  // Get budget information
  getBudget(): { monthly: string; savingsGoal: string } | null {
    return this.preferences?.budget || null
  }

  // Get household information
  getHousehold(): { size: string; hasChildren: boolean | null; hasPets: boolean | null } | null {
    return this.preferences?.household || null
  }

  // Get shopping preferences
  getShoppingPreferences(): { frequency: string; stores: string[]; method: string } | null {
    return this.preferences?.shopping || null
  }
}

export const userPreferencesService = UserPreferencesService.getInstance()
