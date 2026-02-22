/**
 * End-to-end flow test: new user onboarding from start to finish.
 * Simulates: complete onboarding (stash) → enter app (apply pending) → dashboard loads preferences.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  userPreferencesService,
  mergeOnboardingWithDefaults,
  PENDING_ONBOARDING_STORAGE_KEY,
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

describe('Onboarding flow: new user start to finish', () => {
  const userId = 'new-user-e2e-id'
  const storage: Record<string, string> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(storage).forEach((k) => delete storage[k])
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage[key] ?? null)
    )
    ;(AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage[key] = value
      return Promise.resolve()
    })
    ;(AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      delete storage[key]
      return Promise.resolve()
    })
  })

  it('full flow: onboarding (no userId) → stash → enter app → apply pending → dashboard loads preferences', async () => {
    // --- Step 1: User completes onboarding (e.g. no session yet, so no userId) ---
    const onboardingInput = {
      country: 'US',
      householdSize: '4',
      allergies: ['Peanuts', 'Tree nuts', 'Dairy'],
      monthlyBudget: '750',
      userName: 'Alex Test',
      userEmail: 'alex.e2e@example.com',
    }

    const partialPayload = {
      location: { country: onboardingInput.country },
      household: { size: onboardingInput.householdSize },
      dietary: { allergies: onboardingInput.allergies },
      budget: { monthly: onboardingInput.monthlyBudget },
    }

    // Same as onboarding handleComplete: always stash
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        preferences: partialPayload,
        name: onboardingInput.userName,
        email: onboardingInput.userEmail,
      })
    )

    expect(storage[PENDING_ONBOARDING_STORAGE_KEY]).toBeTruthy()
    const stashed = JSON.parse(storage[PENDING_ONBOARDING_STORAGE_KEY])
    expect(stashed.preferences.dietary.allergies).toEqual(onboardingInput.allergies)
    expect(stashed.preferences.budget.monthly).toBe(onboardingInput.monthlyBudget)
    expect(stashed.preferences.household.size).toBe(onboardingInput.householdSize)

    // --- Step 2: User enters app (e.g. after email verification); loadUserProfile runs applyPendingOnboardingData ---
    const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const pending = JSON.parse(raw!)
    expect(pending.preferences).toBeDefined()

    const existing = await userPreferencesService.loadPreferences(userId)
    const fullPreferences = mergeOnboardingWithDefaults(pending.preferences ?? null, existing)

    expect(fullPreferences.dietary.allergies).toEqual(onboardingInput.allergies)
    expect(fullPreferences.budget.monthly).toBe(onboardingInput.monthlyBudget)
    expect(fullPreferences.household.size).toBe(onboardingInput.householdSize)
    expect(fullPreferences.location.country).toBe(onboardingInput.country)

    const { error: saveError } = await userPreferencesService.savePreferences(fullPreferences, userId)
    expect(saveError).toBeNull()

    await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)
    expect(storage[PENDING_ONBOARDING_STORAGE_KEY]).toBeUndefined()

    // --- Step 3: Dashboard loads preferences (refreshUserPreferences / loadUserData) ---
    const dashboardPreferences = await userPreferencesService.loadPreferences(userId)

    expect(dashboardPreferences).toBeTruthy()
    expect(dashboardPreferences!.dietary.allergies).toEqual(onboardingInput.allergies)
    expect(dashboardPreferences!.budget.monthly).toBe(onboardingInput.monthlyBudget)
    expect(dashboardPreferences!.household.size).toBe(onboardingInput.householdSize)
    expect(dashboardPreferences!.location.country).toBe(onboardingInput.country)
  })

  it('full flow: onboarding WITH userId → save + stash → enter app → apply pending merges → dashboard has data', async () => {
    const onboardingInput = {
      country: 'CA',
      householdSize: '2',
      allergies: ['Shellfish'],
      monthlyBudget: '500',
    }

    const partialPayload = {
      location: { country: onboardingInput.country },
      household: { size: onboardingInput.householdSize },
      dietary: { allergies: onboardingInput.allergies },
      budget: { monthly: onboardingInput.monthlyBudget },
    }
    const fullPreferences = mergeOnboardingWithDefaults(partialPayload, null)

    // Onboarding: we have userId, so we save AND stash
    const { error: saveError } = await userPreferencesService.savePreferences(fullPreferences, userId)
    expect(saveError).toBeNull()

    await AsyncStorage.setItem(
      PENDING_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ preferences: partialPayload })
    )

    // User enters app; apply pending runs (may merge with existing)
    const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY)
    const pending = JSON.parse(raw!)
    const existing = await userPreferencesService.loadPreferences(userId)
    const merged = mergeOnboardingWithDefaults(pending.preferences ?? null, existing)
    await userPreferencesService.savePreferences(merged, userId)
    await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)

    // Dashboard loads
    const loaded = await userPreferencesService.loadPreferences(userId)
    expect(loaded!.dietary.allergies).toEqual(onboardingInput.allergies)
    expect(loaded!.budget.monthly).toBe(onboardingInput.monthlyBudget)
    expect(loaded!.household.size).toBe(onboardingInput.householdSize)
    expect(loaded!.location.country).toBe(onboardingInput.country)
  })
})
