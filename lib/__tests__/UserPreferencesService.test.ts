import AsyncStorage from '@react-native-async-storage/async-storage'
import { userPreferencesService, UserPreferences } from '../UserPreferencesService'

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { preferences: mockRemotePreferences }, error: null }),
      })),
    })),
  },
}))

const mockInitializeUser = jest.fn().mockResolvedValue(undefined)

jest.mock('../AILearningService', () => ({
  aiLearningService: {
    initializeUser: (...args: any[]) => mockInitializeUser(...args),
  },
}))

// Re-import after mocks so it uses mocked dependencies
const { supabase } = require('../supabase')

const basePreferences: UserPreferences = {
  location: { country: 'CA', province: 'ON' },
  household: { size: '2', hasChildren: false, hasPets: false },
  dietary: {
    preferences: ['Vegetarian'],
    allergies: ['Milk'],
    allergies_canonical: ['milk'],
    cuisines: ['Italian'],
  },
  shopping: { frequency: 'weekly', stores: ['Costco'], method: 'in_store' },
  budget: { monthly: '500', savingsGoal: '100' },
  profile: {
    firstName: 'Test',
    lastName: 'User',
    householdSize: '2',
    dietaryPreferences: 'Vegetarian',
    allergies: 'Milk',
    cookingSkill: 'Intermediate',
    budgetGoal: '500',
  },
  notifications: {
    pushNotifications: true,
    expiryAlerts: true,
    listUpdates: true,
    recipeSuggestions: true,
    weeklyReminders: true,
  },
}

// Used in the Supabase mock above
const mockRemotePreferences: UserPreferences = {
  ...basePreferences,
  budget: { monthly: '750', savingsGoal: '200' },
}

describe('UserPreferencesService', () => {
  const userId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('saves preferences to AsyncStorage, Supabase and initializes AI learning', async () => {
    const { error } = await userPreferencesService.savePreferences(basePreferences, userId)

    expect(error).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `user_preferences_${userId}`,
      JSON.stringify(basePreferences)
    )

    expect(supabase.from).toHaveBeenCalledWith('users')

    expect(mockInitializeUser).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        budget: expect.objectContaining({ monthly: basePreferences.budget.monthly }),
      })
    )
  })

  it('loads preferences from local storage when available', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === `user_preferences_${userId}`) return Promise.resolve(JSON.stringify(basePreferences))
      return Promise.resolve(null)
    })

    const result = await userPreferencesService.loadPreferences(userId)

    expect(result).toEqual(basePreferences)
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`user_preferences_${userId}`)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('falls back to Supabase when local preferences are missing', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === `user_preferences_${userId}`) return Promise.resolve(null)
      return Promise.resolve(null)
    })

    const result = await userPreferencesService.loadPreferences(userId)

    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(result).toEqual(mockRemotePreferences)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `user_preferences_${userId}`,
      JSON.stringify(mockRemotePreferences)
    )
  })
})

