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
  /** Active shared pantry household id (for multi-user sync) */
  activeHouseholdId?: string | null
}

/** Default preferences used when merging partial onboarding data */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  location: { country: '', province: '' },
  household: { size: '', hasChildren: null, hasPets: null },
  dietary: { preferences: [], allergies: [], cuisines: [] },
  shopping: { frequency: '', stores: [], method: '' },
  budget: { monthly: '', savingsGoal: '' },
  notifications: {
    pushNotifications: true,
    expiryAlerts: true,
    listUpdates: true,
    recipeSuggestions: true,
    weeklyReminders: false,
  },
  activeHouseholdId: null as string | null | undefined,
}

/** Partial preferences from onboarding (only fields we collect) */
export type OnboardingPreferencesPayload = {
  location?: { country?: string; province?: string }
  household?: { size?: string; hasChildren?: boolean | null; hasPets?: boolean | null }
  dietary?: { preferences?: string[]; allergies?: string[]; cuisines?: string[] }
  shopping?: { frequency?: string; stores?: string[]; method?: string }
  budget?: { monthly?: string; savingsGoal?: string }
  profile?: { firstName?: string; lastName?: string; householdSize?: string; dietaryPreferences?: string; allergies?: string; cookingSkill?: string; budgetGoal?: string }
  notifications?: { pushNotifications?: boolean; expiryAlerts?: boolean; listUpdates?: boolean; recipeSuggestions?: boolean; weeklyReminders?: boolean }
  activeHouseholdId?: string | null
}

/** AsyncStorage key for stashing onboarding data when user completes onboarding before session is ready */
export const PENDING_ONBOARDING_STORAGE_KEY = 'pending_onboarding_data_v1'

/** Merge partial onboarding payload with defaults (and optionally existing prefs) into full UserPreferences */
export function mergeOnboardingWithDefaults(
  partial: OnboardingPreferencesPayload | null | undefined,
  existing?: UserPreferences | null
): UserPreferences {
  const base = existing ? { ...DEFAULT_USER_PREFERENCES, ...existing } : { ...DEFAULT_USER_PREFERENCES }
  if (!partial) return base
  return {
    ...base,
    location: { ...base.location, ...partial.location },
    household: { ...base.household, ...partial.household },
    dietary: {
      ...base.dietary,
      ...partial.dietary,
      allergies: partial.dietary?.allergies ?? base.dietary.allergies,
      preferences: partial.dietary?.preferences ?? base.dietary.preferences,
      cuisines: partial.dietary?.cuisines ?? base.dietary.cuisines,
    },
    shopping: { ...base.shopping, ...partial.shopping },
    budget: { ...base.budget, ...partial.budget },
    profile: partial.profile ?? base.profile,
    notifications: partial.notifications ?? base.notifications,
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

  private storageKey(userId: string): string {
    return `user_preferences_${userId}`
  }

  // Save preferences to both local storage (per-user) and Supabase
  async savePreferences(preferences: UserPreferences, userId: string): Promise<{ error: any }> {
    try {
      const key = this.storageKey(userId)
      await AsyncStorage.setItem(key, JSON.stringify(preferences))
      this.preferences = preferences

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

      await aiLearningService.initializeUser(userId, preferences)

      return { error: null }
    } catch (error) {
      console.error('Error saving preferences:', error)
      return { error }
    }
  }

  // Load preferences: per-user local key first, then Supabase
  async loadPreferences(userId?: string): Promise<UserPreferences | null> {
    try {
      if (userId) {
        const key = this.storageKey(userId)
        const local = await AsyncStorage.getItem(key)
        if (local) {
          this.preferences = JSON.parse(local) as UserPreferences
          return this.preferences
        }

        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single()

        if (!error && data?.preferences) {
          this.preferences = data.preferences as UserPreferences
          await AsyncStorage.setItem(key, JSON.stringify(data.preferences))
          return this.preferences
        }
      }

      // Fallback: legacy global key for backwards compat
      const legacy = await AsyncStorage.getItem('user_preferences')
      if (legacy) {
        this.preferences = JSON.parse(legacy) as UserPreferences
        return this.preferences
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

  // Clear preferences (for sign out). Pass userId to clear that user's key.
  async clearPreferences(userId?: string): Promise<void> {
    if (userId) {
      await AsyncStorage.removeItem(this.storageKey(userId))
    }
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
      'gluten': 'wheat', // Single option is Wheat; gluten maps to wheat for detection
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

  // Active shared pantry household (for multi-user sync)
  getActiveHouseholdId(): string | null | undefined {
    return this.preferences?.activeHouseholdId ?? null
  }

  async setActiveHouseholdId(userId: string, householdId: string | null): Promise<{ error: any }> {
    const preferences = await this.loadPreferences(userId)
    if (!preferences) return { error: new Error('Preferences not found') }
    preferences.activeHouseholdId = householdId ?? undefined
    return this.savePreferences(preferences, userId)
  }
}

export const userPreferencesService = UserPreferencesService.getInstance()
