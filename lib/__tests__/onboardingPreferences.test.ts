/**
 * Tests that onboarding data (allergies, budget, household, etc.) submitted during onboarding
 * is correctly merged, saved, and loaded so it appears on the dashboard.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  userPreferencesService,
  mergeOnboardingWithDefaults,
  PENDING_ONBOARDING_STORAGE_KEY,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from '../UserPreferencesService'

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { preferences: null }, error: null }),
      })),
    })),
  },
}))

jest.mock('../AILearningService', () => ({
  aiLearningService: {
    initializeUser: jest.fn().mockResolvedValue(undefined),
  },
}))

describe('Onboarding preferences persistence', () => {
  const userId = 'onboarding-test-user-id'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined)
  })

  it('mergeOnboardingWithDefaults produces full preferences from onboarding payload', () => {
    const partialPayload = {
      location: { country: 'US' },
      household: { size: '4' },
      dietary: { allergies: ['Peanuts', 'Shellfish'] },
      budget: { monthly: '600' },
    }
    const full = mergeOnboardingWithDefaults(partialPayload, null)

    expect(full.location.country).toBe('US')
    expect(full.household.size).toBe('4')
    expect(full.dietary.allergies).toEqual(['Peanuts', 'Shellfish'])
    expect(full.budget.monthly).toBe('600')
    expect(full.notifications).toBeDefined()
    expect(full.shopping).toBeDefined()
  })

  it('stashed onboarding data can be applied and then loaded (simulates applyPendingOnboardingData)', async () => {
    const stashedPayload = {
      preferences: {
        location: { country: 'CA' },
        household: { size: '3' },
        dietary: { allergies: ['Milk', 'Tree nuts'] },
        budget: { monthly: '800' },
      },
      name: 'Test User',
      email: 'test@example.com',
    }

    const storage: Record<string, string> = {
      [PENDING_ONBOARDING_STORAGE_KEY]: JSON.stringify(stashedPayload),
    }
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage[key] ?? null)
    )
    ;(AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage[key] = value
      return Promise.resolve()
    })

    const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const pending = JSON.parse(raw!)
    expect(pending.preferences).toEqual(stashedPayload.preferences)

    const existing = await userPreferencesService.loadPreferences(userId)
    const fullPreferences = mergeOnboardingWithDefaults(pending.preferences ?? null, existing)

    expect(fullPreferences.dietary.allergies).toEqual(['Milk', 'Tree nuts'])
    expect(fullPreferences.household.size).toBe('3')
    expect(fullPreferences.budget.monthly).toBe('800')
    expect(fullPreferences.location.country).toBe('CA')

    const { error } = await userPreferencesService.savePreferences(fullPreferences, userId)
    expect(error).toBeNull()

    const loaded = await userPreferencesService.loadPreferences(userId)
    expect(loaded).toBeTruthy()
    expect(loaded!.dietary.allergies).toEqual(['Milk', 'Tree nuts'])
    expect(loaded!.household.size).toBe('3')
    expect(loaded!.budget.monthly).toBe('800')
    expect(loaded!.location.country).toBe('CA')
  })

  it('save during onboarding uses per-user key so load returns same data', async () => {
    const storage: Record<string, string> = {}
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage[key] ?? null)
    )
    ;(AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage[key] = value
      return Promise.resolve()
    })

    const onboardingPreferences: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      location: { country: 'GB', province: '' },
      household: { size: '2', hasChildren: true, hasPets: null },
      dietary: {
        preferences: [],
        allergies: ['Eggs', 'Soy'],
        cuisines: [],
      },
      budget: { monthly: '400', savingsGoal: '50' },
      shopping: { frequency: '', stores: [], method: '' },
      notifications: {
        pushNotifications: true,
        expiryAlerts: true,
        listUpdates: true,
        recipeSuggestions: true,
        weeklyReminders: false,
      },
    }

    const { error } = await userPreferencesService.savePreferences(onboardingPreferences, userId)
    expect(error).toBeNull()

    const perUserKey = `user_preferences_${userId}`
    expect(storage[perUserKey]).toBeDefined()
    const saved = JSON.parse(storage[perUserKey]) as UserPreferences
    expect(saved.dietary.allergies).toEqual(['Eggs', 'Soy'])
    expect(saved.budget.monthly).toBe('400')
    expect(saved.household.size).toBe('2')

    const loaded = await userPreferencesService.loadPreferences(userId)
    expect(loaded).toBeTruthy()
    expect(loaded!.dietary.allergies).toEqual(['Eggs', 'Soy'])
    expect(loaded!.budget.monthly).toBe('400')
    expect(loaded!.household.size).toBe('2')
  })
})
