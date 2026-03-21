// SAVR Onboarding Flow - Premium Multi-Step Experience
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
  Animated,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { userPreferencesService, mergeOnboardingWithDefaults, PENDING_ONBOARDING_STORAGE_KEY } from '../lib/UserPreferencesService'

const PENDING_SIGNUP_PROFILE_KEY = 'pending_signup_profile_v1'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/ToastContext'

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed_v1'
const { width, height } = Dimensions.get('window')

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to SAVR',
    subtitle: "Let's personalize your experience",
  },
  {
    id: 'location',
    title: '📍 Your Location',
    subtitle: 'Help us personalize your experience',
  },
  {
    id: 'household',
    title: '🏠 Your Household',
    subtitle: 'Tell us about who you shop for',
  },
  {
    id: 'budget',
    title: '💰 Budget',
    subtitle: 'Set your monthly grocery budget',
  },
  {
    id: 'createAccount',
    title: 'Create Your Account',
    subtitle: 'Almost there! Enter your details to get started',
  },
]


const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const trimmed = (email || '').trim().toLowerCase()
  if (!trimmed) return { valid: false, error: 'Email is required' }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) return { valid: false, error: 'Please enter a valid email address' }
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.startsWith('@')) {
    return { valid: false, error: 'Please enter a valid email address' }
  }
  return { valid: true }
}

export default function OnboardingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const { user, session, signUp, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [progress] = useState(new Animated.Value(0))
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const scrollViewRef = useRef<ScrollView>(null)

  // Location data
  const [country, setCountry] = useState('')
  const [showCountryModal, setShowCountryModal] = useState(false)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')

  // Household data
  const [householdSize, setHouseholdSize] = useState('')
  const [showHouseholdSizeModal, setShowHouseholdSizeModal] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])
  const [showAllergiesModal, setShowAllergiesModal] = useState(false)
  const [customAllergy, setCustomAllergy] = useState('')

  // Budget
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [customBudgetInput, setCustomBudgetInput] = useState('')

  // Create Account (final step)
  const [accountName, setAccountName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('')
  const [accountEmailError, setAccountEmailError] = useState<string | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)

  useEffect(() => {
    // Animate content on step change
    fadeAnim.setValue(0)
    slideAnim.setValue(20)
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()
  }, [currentStep])

  const animateProgress = (toStep: number) => {
    Animated.spring(progress, {
      toValue: toStep / (ONBOARDING_STEPS.length - 1),
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start()
  }

  const handleNext = () => {
    // Validate mandatory fields before advancing
    if (currentStep === 1 && !country.trim()) {
      showToast('Please select your country.', { kind: 'warning' })
      return
    }
    if (currentStep === 2 && !householdSize) {
      showToast('Please select your household size.', { kind: 'warning' })
      return
    }
    if (currentStep === 3 && !monthlyBudget.trim()) {
      showToast('Please select your monthly budget.', { kind: 'warning' })
      return
    }

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      animateProgress(nextStep)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      animateProgress(prevStep)
    }
  }

  const handleComplete = async () => {
    // Create Account step: validate and sign up first (email collected at end of onboarding)
    const isCreateAccountStep = currentStep === ONBOARDING_STEPS.length - 1
    let userName = accountName.trim()
    let userEmail = accountEmail.trim().toLowerCase() || params.email || user?.email || session?.user?.email || ''

    if (isCreateAccountStep) {
      if (!userName) {
        showToast('Please enter your full name.', { kind: 'warning' })
        return
      }
      if (!accountEmail.trim()) {
        showToast('Please enter your email.', { kind: 'warning' })
        return
      }
      const emailValidation = validateEmail(accountEmail.trim())
      if (!emailValidation.valid) {
        setAccountEmailError(emailValidation.error || 'Invalid email')
        showToast(emailValidation.error || 'Invalid email format', { kind: 'error' })
        return
      }
      setAccountEmailError(null)
      userEmail = accountEmail.trim().toLowerCase()
      if (!accountPassword) {
        showToast('Please enter a password.', { kind: 'warning' })
        return
      }
      if (accountPassword.length < 6) {
        showToast('Password must be at least 6 characters.', { kind: 'warning' })
        return
      }
      if (accountPassword !== accountConfirmPassword) {
        showToast('Passwords do not match.', { kind: 'warning' })
        return
      }

      setAccountLoading(true)
      const { error: signUpError, emailWarning } = await signUp(userEmail, accountPassword, userName)
      setAccountLoading(false)

      if (signUpError) {
        showToast(signUpError.message || 'Sign up failed. Please try again.', { kind: 'error', durationMs: 4000 })
        return
      }
      if (emailWarning) {
        showToast('Account created. Check your email to verify.', { kind: 'success' })
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    
    // Get user info for saving preferences
    let userId = user?.id || session?.user?.id
    
    // If still no userId (e.g. right after signUp), try getting session directly from Supabase
    if (!userId) {
      const { data: { session: directSession } } = await supabase.auth.getSession()
      userId = directSession?.user?.id
      userEmail = userEmail || directSession?.user?.email || ''
      if (!userName) userName = directSession?.user?.user_metadata?.name || ''
    }
    
    // If still no userId, try getting the current user
    if (!userId) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      userId = authUser?.id
      userEmail = userEmail || authUser?.email
      userName = userName || authUser?.user_metadata?.name || ''
    }

    // Fallback: userId from pending signup (stored by AuthContext when signUp succeeds).
    // Session may not be available yet when user completes onboarding right after signup.
    if (!userId) {
      try {
        const raw = await AsyncStorage.getItem(PENDING_SIGNUP_PROFILE_KEY)
        if (raw) {
          const pending = JSON.parse(raw) as { userId?: string; email?: string; name?: string }
          if (pending?.userId) {
            userId = pending.userId
            userEmail = userEmail || pending.email || undefined
            userName = userName || pending.name || ''
          }
        }
      } catch {
        // non-blocking
      }
    }
    
    // Build partial payload from onboarding (what we collect)
    const partialPayload = {
      location: { country },
      household: { size: householdSize },
      dietary: { allergies },
      budget: { monthly: monthlyBudget },
    }
    const fullPreferences = mergeOnboardingWithDefaults(partialPayload, null)

    const stashPendingOnboarding = async () => {
      try {
        await AsyncStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify({
          preferences: partialPayload,
          name: userName || undefined,
          email: userEmail || undefined,
        }))
      } catch (e) {
        console.warn('Could not stash pending onboarding data', e)
      }
    }

    // Always stash onboarding data so it can be applied when user enters the app (e.g. after email
    // verification or on fresh open). Saves during onboarding can fail or session may not be ready.
    await stashPendingOnboarding()

    try {
      if (userId) {
        const { error: prefError } = await userPreferencesService.savePreferences(fullPreferences, userId)
        if (prefError) {
          console.error('Error saving preferences during onboarding:', prefError)
        } else {
          console.log('Preferences saved during onboarding')
        }

        if (userName || userEmail) {
          const updateData: Record<string, string> = {}
          if (userName) updateData.name = userName
          if (userEmail) updateData.email = userEmail

          const { error: profileError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)

          if (profileError) {
            console.error('Error updating user profile:', profileError)
          }
        }
      } else {
        console.warn('No user ID during onboarding - data stashed to apply after sign-in')
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error)
    }
    
    // Wait a moment to ensure auth state is ready before navigating
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Check if email is already verified before navigating to verification screen
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (currentUser?.email_confirmed_at) {
        // Email is already verified, go directly to app
        console.log('✅ Email already verified - navigating to app')
        router.replace('/(tabs)')
        return
      }
    } catch (error) {
      // If we can't check, continue to verification screen
      console.log('Could not check verification status, navigating to verification screen')
    }
    
    // Mark onboarding completed so index sends unverified users to email-verification (not back here)
    if (userId) {
      try {
        await AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_${userId}`, 'true')
      } catch (e) {
        // non-blocking
      }
    }

    // Navigate to email verification screen (will check and redirect to tabs if already verified)
    // Pass email as query parameter if available
    try {
      const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''
      router.replace(`/email-verification${emailParam}`)
    } catch (navError) {
      console.error('Navigation error:', navError)
      // Fallback: try navigating to index which will handle routing
      router.replace('/')
    }
  }


  const renderWelcome = () => (
    <Animated.View 
      style={[
        styles.stepContent,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.welcomeIconContainer}>
        <View style={styles.welcomeIconCircle}>
          <Text style={styles.welcomeIcon}>🛒</Text>
        </View>
      </View>
      <View style={styles.welcomeContent}>
        <Text style={styles.welcomeText}>
          Let's make grocery shopping smarter, easier, and more affordable
        </Text>
        <View style={styles.welcomeDivider} />
        <Text style={styles.welcomeSubtext}>
          We'll ask a few quick questions to personalize your experience and help you save money
        </Text>
      </View>
    </Animated.View>
  )

  const renderLocation = () => {
    const countries = [
      'United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand',
      'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
      'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway',
      'Denmark', 'Finland', 'Ireland', 'Portugal', 'Poland',
      'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia',
      'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand',
      'India', 'South Africa', 'United Arab Emirates', 'Saudi Arabia', 'Israel',
      'Other'
    ]

    const filteredCountries = countries.filter(countryName =>
      countryName.toLowerCase().includes(countrySearchQuery.toLowerCase())
    )

    return (
      <Animated.View 
        style={[
          styles.stepContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.questionLabelCompact}>Select your country *</Text>
        
        <Pressable
          style={({ pressed }) => [
            styles.countrySelectorButton,
            pressed && styles.countrySelectorButtonPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowCountryModal(true)
          }}
        >
          <Text style={[
            styles.countrySelectorButtonText,
            !country && styles.countrySelectorButtonPlaceholder
          ]}>
            {country || 'Tap to select your country'}
          </Text>
          <Text style={styles.countrySelectorButtonIcon}>▼</Text>
        </Pressable>

        {/* Country Selection Modal */}
        <Modal
          visible={showCountryModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowCountryModal(false)
            setCountrySearchQuery('')
          }}
        >
          <KeyboardAvoidingView
            style={styles.countryModalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.countryModalContainer}>
              <View style={styles.countryModalHeader}>
                <Text style={styles.countryModalTitle}>Select Country</Text>
                <Pressable
                  onPress={() => {
                    setShowCountryModal(false)
                    setCountrySearchQuery('')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.countryModalCloseButton}
                >
                  <Text style={styles.countryModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.countrySearchContainer}>
                <TextInput
                  style={styles.countrySearchInput}
                  placeholder="Search countries..."
                  placeholderTextColor="#999"
                  value={countrySearchQuery}
                  onChangeText={setCountrySearchQuery}
                  autoFocus={true}
                />
                {countrySearchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setCountrySearchQuery('')}
                    style={styles.countrySearchClear}
                  >
                    <Text style={styles.countrySearchClearText}>✕</Text>
                  </Pressable>
                )}
              </View>

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item}
                style={styles.countryList}
                contentContainerStyle={styles.countryListContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.countryListItem,
                      country === item && styles.countryListItemActive,
                      pressed && styles.countryListItemPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setCountry(item)
                      setShowCountryModal(false)
                      setCountrySearchQuery('')
                    }}
                  >
                    <Text style={[
                      styles.countryListItemText,
                      country === item && styles.countryListItemTextActive
                    ]}>
                      {item}
                    </Text>
                    {country === item && (
                      <Text style={styles.countryListItemCheck}>✓</Text>
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View style={styles.countryListEmpty}>
                    <Text style={styles.countryListEmptyText}>
                      No countries found
                    </Text>
                  </View>
                }
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    )
  }

  const toggleArrayItem = (array: string[], setArray: (arr: string[]) => void, item: string) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item))
    } else {
      setArray([...array, item])
    }
  }

  // Predefined allergens (in main selection list)
  const PREDEFINED_ALLERGENS = [
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Fish', 'Shellfish', 'Soy', 'Wheat',
    'Sesame', 'Mustard', 'Celery', 'Lupin', 'Sulfites',
  ]

  // Whitelist of real food allergens for custom input - validates user isn't entering "iphone" or "spoon"
  // Includes: FDA/EU major allergens + common additional allergens (fruits, vegetables, legumes, etc.)
  const REAL_ALLERGEN_WHITELIST: string[] = [
    ...PREDEFINED_ALLERGENS,
    'Gluten', 'Molluscs', 'Coconut', 'Corn', 'Rice', 'Oats', 'Barley', 'Rye', 'Buckwheat',
    'Kiwi', 'Banana', 'Apple', 'Peach', 'Mango', 'Avocado', 'Cherry', 'Strawberry', 'Raspberry',
    'Blackberry', 'Blueberry', 'Plum', 'Apricot', 'Melon', 'Watermelon', 'Papaya', 'Pineapple',
    'Pomegranate', 'Fig', 'Date', 'Lychee', 'Passion fruit', 'Dragon fruit',
    'Tomato', 'Potato', 'Carrot', 'Garlic', 'Onion', 'Bell pepper', 'Chili pepper', 'Peppers',
    'Broccoli', 'Cabbage', 'Spinach', 'Lettuce', 'Mushroom', 'Beet', 'Radish', 'Asparagus',
    'Lentils', 'Chickpeas', 'Peas', 'Beans', 'Green beans',
    'Honey', 'Yeast', 'Cocoa', 'Coffee', 'Sunflower seeds', 'Poppy seeds', 'Pumpkin seeds',
    'Quinoa', 'Amaranth', 'Spelt', 'Kamut', 'Triticale',
  ]
  const [customAllergyError, setCustomAllergyError] = useState<string | null>(null)

  const normalizeToCanonical = (input: string): string | null => {
    const lower = input.trim().toLowerCase()
    if (!lower) return null
    const match = REAL_ALLERGEN_WHITELIST.find(a => a.toLowerCase() === lower)
    return match || null
  }

  const addCustomAllergy = () => {
    const toAdd = customAllergy.trim()
    if (!toAdd) {
      setCustomAllergyError(null)
      return
    }
    const items = toAdd.split(',').map(a => a.trim()).filter(a => a)
    const invalid: string[] = []
    const validToAdd: string[] = []
    for (const item of items) {
      const canonical = normalizeToCanonical(item)
      if (canonical && !allergies.includes(canonical)) {
        validToAdd.push(canonical)
      } else if (!canonical) {
        invalid.push(item)
      }
    }
    if (invalid.length > 0) {
      setCustomAllergyError(`"${invalid.join(', ')}" isn't a recognized allergen. Enter real food allergens (e.g., Kiwi, Tomato, Corn).`)
      return
    }
    setCustomAllergyError(null)
    if (validToAdd.length > 0) {
      setAllergies([...allergies, ...validToAdd])
      setCustomAllergy('')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  const renderHousehold = () => (
    <Animated.View 
      style={[
        styles.stepContent,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Household Size Section */}
      <View style={styles.householdSection}>
        <Text style={styles.sectionTitle}>Household Size *</Text>
        <Text style={styles.sectionSubtitle}>How many people live in your home?</Text>
        
        <Pressable
          style={({ pressed }) => [
            styles.householdSizeSelectorButton,
            pressed && styles.householdSizeSelectorButtonPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowHouseholdSizeModal(true)
          }}
        >
          <Text style={[
            styles.householdSizeSelectorButtonText,
            !householdSize && styles.householdSizeSelectorButtonPlaceholder
          ]}>
            {householdSize ? `${householdSize} ${householdSize === '1' ? 'person' : 'people'}` : 'Tap to select household size'}
          </Text>
          <Text style={styles.householdSizeSelectorButtonIcon}>▼</Text>
        </Pressable>

        {/* Household Size Selection Modal */}
        <Modal
          visible={showHouseholdSizeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowHouseholdSizeModal(false)
          }}
        >
          <View style={styles.householdSizeModalBackdrop}>
            <View style={styles.householdSizeModalContainer}>
              <View style={styles.householdSizeModalHeader}>
                <Text style={styles.householdSizeModalTitle}>Select Household Size</Text>
                <Pressable
                  onPress={() => {
                    setShowHouseholdSizeModal(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.householdSizeModalCloseButton}
                >
                  <Text style={styles.householdSizeModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <FlatList
                data={Array.from({ length: 10 }, (_, i) => (i + 1).toString())}
                keyExtractor={(item) => item}
                style={styles.householdSizeList}
                contentContainerStyle={styles.householdSizeListContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.householdSizeListItem,
                      householdSize === item && styles.householdSizeListItemActive,
                      pressed && styles.householdSizeListItemPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setHouseholdSize(item)
                      setShowHouseholdSizeModal(false)
                    }}
                  >
                    <Text style={[
                      styles.householdSizeListItemText,
                      householdSize === item && styles.householdSizeListItemTextActive
                    ]}>
                      {item} {item === '1' ? 'person' : 'people'}
                    </Text>
                    {householdSize === item && (
                      <Text style={styles.householdSizeListItemCheck}>✓</Text>
                    )}
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>

      {/* Allergies Section */}
      <View style={styles.householdSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Allergies & Dietary Restrictions</Text>
          <Text style={styles.sectionSubtitle}>
            Select all that apply. We'll alert you when scanning products.
          </Text>
        </View>
        
        <Pressable
          style={({ pressed }) => [
            styles.allergiesSelectorButton,
            pressed && styles.allergiesSelectorButtonPressed,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowAllergiesModal(true)
          }}
        >
          <Text style={[
            styles.allergiesSelectorButtonText,
            allergies.length === 0 && styles.allergiesSelectorButtonPlaceholder
          ]}>
            {allergies.length === 0 
              ? 'Tap to select allergies' 
              : allergies.length === 1 
                ? allergies[0]
                : `${allergies.length} selected`}
          </Text>
          <Text style={styles.allergiesSelectorButtonIcon}>▼</Text>
        </Pressable>

        {/* Allergies Selection Modal */}
        <Modal
          visible={showAllergiesModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAllergiesModal(false)
          }}
        >
          <View style={styles.allergiesModalBackdrop}>
            <View style={styles.allergiesModalContainer}>
              <View style={styles.allergiesModalHeader}>
                <Text style={styles.allergiesModalTitle}>Select Allergies</Text>
                <Pressable
                  onPress={() => {
                    setShowAllergiesModal(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.allergiesModalCloseButton}
                >
                  <Text style={styles.allergiesModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.allergiesModalSubtitleContainer}>
                <Text style={styles.allergiesModalSubtitle}>
                  Select all that apply. You can choose multiple.
                </Text>
              </View>

              <FlatList
                data={PREDEFINED_ALLERGENS}
                keyExtractor={(item) => item}
                style={styles.allergiesList}
                contentContainerStyle={styles.allergiesListContent}
                renderItem={({ item }) => {
                  const isSelected = allergies.includes(item)
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.allergiesListItem,
                        isSelected && styles.allergiesListItemActive,
                        pressed && styles.allergiesListItemPressed,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        toggleArrayItem(allergies, setAllergies, item)
                      }}
                    >
                      <View style={styles.allergiesListItemContent}>
                        <View style={[
                          styles.allergiesCheckbox,
                          isSelected && styles.allergiesCheckboxActive
                        ]}>
                          {isSelected && (
                            <Text style={styles.allergiesCheckboxCheck}>✓</Text>
                          )}
                        </View>
                        <View style={styles.allergiesListItemTextContainer}>
                          <Text style={[
                            styles.allergiesListItemText,
                            isSelected && styles.allergiesListItemTextActive
                          ]}>
                            {item}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  )
                }}
              />
            </View>
          </View>
        </Modal>
      </View>

      {/* Additional Allergies (optional - type to add from valid list) */}
      <View style={styles.householdSection}>
        <Text style={styles.sectionTitle}>Additional Allergies</Text>
        <Text style={styles.sectionSubtitle}>Add more real allergens (e.g., Kiwi, Tomato, Corn). Invalid entries like "iphone" are rejected. (optional)</Text>
        <View style={styles.customAllergyContainer}>
          <TextInput
            value={customAllergy}
            onChangeText={(t) => { setCustomAllergy(t); setCustomAllergyError(null) }}
            placeholder="e.g., Mustard, Celery"
            placeholderTextColor="#999"
            style={[styles.textInput, customAllergyError && styles.textInputError]}
            onSubmitEditing={addCustomAllergy}
            onFocus={() => {
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)
            }}
          />
          {customAllergyError && (
            <Text style={styles.customAllergyErrorText}>{customAllergyError}</Text>
          )}
          {customAllergy.trim() !== '' && (
            <Pressable
              style={({ pressed }) => [
                styles.addAllergyButton,
                pressed && styles.addAllergyButtonPressed,
              ]}
              onPress={addCustomAllergy}
            >
              <Text style={styles.addAllergyButtonText}>Add</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  )


  const renderBudget = () => {
    const budgetPresets = ['200', '300', '400', '500', '600', '800', '1000', '1200', '1500', '2000']
    
    const formatBudget = (amount: string) => {
      if (!amount) return ''
      return `$${parseInt(amount).toLocaleString()}/month`
    }

    return (
      <Animated.View 
        style={[
          styles.stepContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.budgetSection}>
          <Text style={styles.sectionTitle}>Monthly Grocery Budget *</Text>
          <Text style={styles.sectionSubtitle}>
            Set your monthly spending limit. We'll help you track and save.
          </Text>
          
          <Pressable
            style={({ pressed }) => [
              styles.budgetSelectorButton,
              pressed && styles.budgetSelectorButtonPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowBudgetModal(true)
            }}
          >
            <Text style={[
              styles.budgetSelectorButtonText,
              !monthlyBudget && styles.budgetSelectorButtonPlaceholder
            ]}>
              {monthlyBudget ? formatBudget(monthlyBudget) : 'Tap to select your budget'}
            </Text>
            <Text style={styles.budgetSelectorButtonIcon}>▼</Text>
          </Pressable>

          {monthlyBudget && (
            <View style={styles.budgetInfoBox}>
              <Text style={styles.budgetInfoText}>
                💡 We'll help you track spending and suggest ways to save money
              </Text>
            </View>
          )}
        </View>

        {/* Budget Selection Modal */}
        <Modal
          visible={showBudgetModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowBudgetModal(false)
            setCustomBudgetInput('')
          }}
        >
          <KeyboardAvoidingView
            style={styles.budgetModalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.budgetModalContainer}>
              <View style={styles.budgetModalHeader}>
                <Text style={styles.budgetModalTitle}>Select Budget</Text>
                <Pressable
                  onPress={() => {
                    setShowBudgetModal(false)
                    setCustomBudgetInput('')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.budgetModalCloseButton}
                >
                  <Text style={styles.budgetModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.budgetModalSubtitleContainer}>
                <Text style={styles.budgetModalSubtitle}>
                  Choose a preset amount or enter a custom budget
                </Text>
              </View>

              <FlatList
                data={budgetPresets}
                keyExtractor={(item) => item}
                style={styles.budgetList}
                contentContainerStyle={styles.budgetListContent}
                ListHeaderComponent={
                  <View style={styles.customBudgetInputSection}>
                    <Text style={styles.customBudgetInputLabel}>Custom Amount</Text>
                    <View style={styles.customBudgetInputWrapper}>
                      <Text style={styles.customBudgetDollarSign}>$</Text>
                      <TextInput
                        value={customBudgetInput}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '')
                          setCustomBudgetInput(numericText)
                        }}
                        placeholder="Enter amount"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        style={styles.customBudgetInput}
                      />
                      <Text style={styles.customBudgetPerMonth}>/month</Text>
                    </View>
                    {customBudgetInput.trim() !== '' && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.customBudgetAddButton,
                          pressed && styles.customBudgetAddButtonPressed,
                        ]}
                        onPress={() => {
                          if (customBudgetInput.trim()) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            setMonthlyBudget(customBudgetInput)
                            setShowBudgetModal(false)
                            setCustomBudgetInput('')
                          }
                        }}
                      >
                        <Text style={styles.customBudgetAddButtonText}>Use This Amount</Text>
                      </Pressable>
                    )}
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = monthlyBudget === item
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.budgetListItem,
                        isSelected && styles.budgetListItemActive,
                        pressed && styles.budgetListItemPressed,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        setMonthlyBudget(item)
                        setShowBudgetModal(false)
                      }}
                    >
                      <Text style={[
                        styles.budgetListItemText,
                        isSelected && styles.budgetListItemTextActive
                      ]}>
                        ${parseInt(item).toLocaleString()}/month
                      </Text>
                      {isSelected && (
                        <Text style={styles.budgetListItemCheck}>✓</Text>
                      )}
                    </Pressable>
                  )
                }                }
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    )
  }

  const renderCreateAccount = () => {
    const formatBudget = (amount: string) => {
      if (!amount) return ''
      return `$${parseInt(amount).toLocaleString()}/month`
    }

    return (
      <Animated.View 
        style={[
          styles.stepContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Your Preferences</Text>
          <View style={styles.summaryDivider} />
          {country && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Location</Text>
              <Text style={styles.summaryItemValue}>{country}</Text>
            </View>
          )}
          {householdSize && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Household</Text>
              <Text style={styles.summaryItemValue}>{householdSize} {householdSize === '1' ? 'person' : 'people'}</Text>
            </View>
          )}
          {allergies.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Allergies</Text>
              <Text style={styles.summaryItemValue}>{allergies.length === 1 ? allergies[0] : `${allergies.length} selected`}</Text>
            </View>
          )}
          {monthlyBudget && (
            <View style={[styles.summaryItem, styles.summaryItemLast]}>
              <Text style={styles.summaryItemLabel}>Budget</Text>
              <Text style={styles.summaryItemValue}>{formatBudget(monthlyBudget)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.createAccountFormTitle}>Create your account</Text>
        
        <View style={styles.createAccountInputWrapper}>
          <Text style={styles.createAccountLabel}>Full Name *</Text>
          <TextInput
            style={styles.createAccountInput}
            placeholder="Enter your full name"
            placeholderTextColor="#8E8E93"
            value={accountName}
            onChangeText={setAccountName}
            autoCapitalize="words"
            editable={!accountLoading}
            onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
          />
        </View>
        <View style={styles.createAccountInputWrapper}>
          <Text style={styles.createAccountLabel}>Email *</Text>
          <TextInput
            style={[styles.createAccountInput, accountEmailError && styles.createAccountInputError]}
            placeholder="Enter your email"
            placeholderTextColor="#8E8E93"
            value={accountEmail}
            onChangeText={(t) => { setAccountEmail(t); setAccountEmailError(null) }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!accountLoading}
            onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
          />
          {accountEmailError && <Text style={styles.createAccountErrorText}>{accountEmailError}</Text>}
        </View>
        <View style={styles.createAccountInputWrapper}>
          <Text style={styles.createAccountLabel}>Password *</Text>
          <TextInput
            style={styles.createAccountInput}
            placeholder="At least 6 characters"
            placeholderTextColor="#8E8E93"
            value={accountPassword}
            onChangeText={setAccountPassword}
            secureTextEntry
            editable={!accountLoading}
            onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
          />
        </View>
        <View style={styles.createAccountInputWrapper}>
          <Text style={styles.createAccountLabel}>Confirm Password *</Text>
          <TextInput
            style={styles.createAccountInput}
            placeholder="Confirm your password"
            placeholderTextColor="#8E8E93"
            value={accountConfirmPassword}
            onChangeText={setAccountConfirmPassword}
            secureTextEntry
            editable={!accountLoading}
            onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
          />
        </View>
      </Animated.View>
    )
  }

  const renderStep = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case 'welcome': return renderWelcome()
      case 'location': return renderLocation()
      case 'household': return renderHousehold()
      case 'budget': return renderBudget()
      case 'createAccount': return renderCreateAccount()
      default: return null
    }
  }

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Background */}
      <LinearGradient
        colors={['#FAF8F3', '#F0F7F2', '#E8F4ED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressText}>
          {currentStep + 1} of {ONBOARDING_STEPS.length}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{ONBOARDING_STEPS[currentStep].title}</Text>
          <Text style={styles.subtitle}>{ONBOARDING_STEPS[currentStep].subtitle}</Text>
        </View>

        {renderStep()}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        {currentStep > 0 && (
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        )}
        <Pressable 
          style={({ pressed }) => [
            styles.nextButton, 
            currentStep === 0 && styles.nextButtonFull,
            pressed && styles.nextButtonPressed,
            accountLoading && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={accountLoading}
        >
          <LinearGradient
            colors={accountLoading ? ['#9E9E9E', '#B0B0B0'] : ['#5A8A6A', '#6A9571', '#7BA67D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButtonGradient}
          >
            {accountLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === ONBOARDING_STEPS.length - 1 ? 'Create Account' : 'Continue'}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  progressContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6A9571',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 320,
    paddingTop: 8,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
  },
  stepContent: {
    width: '100%',
    paddingTop: 4,
  },
  welcomeIconContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  welcomeIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  welcomeIcon: {
    fontSize: 48,
    textAlign: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
    letterSpacing: -0.2,
    paddingHorizontal: 12,
  },
  welcomeDivider: {
    width: 60,
    height: 3,
    backgroundColor: '#6A9571',
    borderRadius: 2,
    marginBottom: 24,
    opacity: 0.6,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
    paddingHorizontal: 16,
  },
  questionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 20,
    marginTop: 28,
    letterSpacing: -0.2,
  },
  householdSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  questionLabelCompact: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  countrySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  countrySelectorButtonPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: '#6A9571',
  },
  countrySelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  countrySelectorButtonPlaceholder: {
    color: '#999999',
    fontWeight: '400',
  },
  countrySelectorButtonIcon: {
    fontSize: 12,
    color: '#6A9571',
    marginLeft: 8,
  },
  countryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  countryModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  countryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  countryModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  countryModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryModalCloseText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '600',
  },
  countrySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  countrySearchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
  },
  countrySearchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  countrySearchClearText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  countryList: {
    flex: 1,
  },
  countryListContent: {
    paddingBottom: 20,
  },
  countryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  countryListItemActive: {
    backgroundColor: '#F0F7F2',
  },
  countryListItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  countryListItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  countryListItemTextActive: {
    color: '#6A9571',
    fontWeight: '600',
  },
  countryListItemCheck: {
    fontSize: 18,
    color: '#6A9571',
    fontWeight: '700',
    marginLeft: 12,
  },
  countryListEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  countryListEmptyText: {
    fontSize: 16,
    color: '#999999',
    fontWeight: '500',
  },
  householdSizeSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  householdSizeSelectorButtonPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: '#6A9571',
  },
  householdSizeSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  householdSizeSelectorButtonPlaceholder: {
    color: '#999999',
    fontWeight: '400',
  },
  householdSizeSelectorButtonIcon: {
    fontSize: 12,
    color: '#6A9571',
    marginLeft: 8,
  },
  householdSizeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  householdSizeModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  householdSizeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  householdSizeModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  householdSizeModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  householdSizeModalCloseText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '600',
  },
  householdSizeList: {
    flex: 1,
  },
  householdSizeListContent: {
    paddingBottom: 20,
  },
  householdSizeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  householdSizeListItemActive: {
    backgroundColor: '#F0F7F2',
  },
  householdSizeListItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  householdSizeListItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  householdSizeListItemTextActive: {
    color: '#6A9571',
    fontWeight: '600',
  },
  householdSizeListItemCheck: {
    fontSize: 18,
    color: '#6A9571',
    fontWeight: '700',
    marginLeft: 12,
  },
  allergiesSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  allergiesSelectorButtonPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: '#6A9571',
  },
  allergiesSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  allergiesSelectorButtonPlaceholder: {
    color: '#999999',
    fontWeight: '400',
  },
  allergiesSelectorButtonIcon: {
    fontSize: 12,
    color: '#6A9571',
    marginLeft: 8,
  },
  allergiesModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  allergiesModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  allergiesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  allergiesModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  allergiesModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allergiesModalCloseText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '600',
  },
  allergiesModalSubtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  allergiesModalSubtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  allergiesList: {
    flex: 1,
  },
  allergiesListContent: {
    paddingBottom: 20,
  },
  allergiesListItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  allergiesListItemActive: {
    backgroundColor: '#F0F7F2',
  },
  allergiesListItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  allergiesListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergiesCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  allergiesCheckboxActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  allergiesCheckboxCheck: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  allergiesListItemTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allergiesListItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  allergiesListItemTextActive: {
    color: '#6A9571',
    fontWeight: '600',
  },
  allergiesListItemCustomLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  numberButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  numberButton: {
    width: (width - 80) / 6,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  numberButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  numberButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  numberButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  numberButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  yesNoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  yesNoButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  yesNoButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  yesNoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  yesNoButtonTextActive: {
    color: '#FFFFFF',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  chipActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chipPressed: {
    transform: [{ scale: 0.95 }],
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  allergyChip: {
    borderColor: '#FFE5E5',
    backgroundColor: '#FFF9F9',
  },
  allergyChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  allergyChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customAllergyContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  addAllergyButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#6A9571',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addAllergyButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  addAllergyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textInputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  customAllergyErrorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: -4,
    marginBottom: 8,
  },
  optionButtons: {
    gap: 10,
    marginBottom: 8,
  },
  optionButton: {
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  optionButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  optionButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  optionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  helpText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  budgetSection: {
    marginBottom: 32,
  },
  budgetInfoBox: {
    backgroundColor: '#F0F7F2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E8F4ED',
  },
  budgetInfoText: {
    fontSize: 14,
    color: '#2C3E50',
    lineHeight: 20,
    textAlign: 'center',
  },
  budgetSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  budgetSelectorButtonPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: '#6A9571',
  },
  budgetSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  budgetSelectorButtonPlaceholder: {
    color: '#999999',
    fontWeight: '400',
  },
  budgetSelectorButtonIcon: {
    fontSize: 12,
    color: '#6A9571',
    marginLeft: 8,
  },
  budgetModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  budgetModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  budgetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  budgetModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  budgetModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetModalCloseText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '600',
  },
  budgetModalSubtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  budgetModalSubtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  customBudgetInputSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginBottom: 8,
  },
  customBudgetInputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  customBudgetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  customBudgetDollarSign: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6A9571',
    marginRight: 8,
  },
  customBudgetInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 0,
  },
  customBudgetPerMonth: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  customBudgetAddButton: {
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  customBudgetAddButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  customBudgetAddButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  budgetList: {
    flex: 1,
  },
  budgetListContent: {
    paddingBottom: 20,
  },
  budgetListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  budgetListItemActive: {
    backgroundColor: '#F0F7F2',
  },
  budgetListItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  budgetListItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  budgetListItemTextActive: {
    color: '#6A9571',
    fontWeight: '600',
  },
  budgetListItemCheck: {
    fontSize: 18,
    color: '#6A9571',
    fontWeight: '700',
    marginLeft: 12,
  },
  savingsPreview: {
    backgroundColor: '#E9F1EB',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  savingsPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6A9571',
    marginBottom: 4,
  },
  savingsPreviewSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  completeIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  completeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  completeIcon: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  completeContent: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
    paddingHorizontal: 16,
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  summaryItemLast: {
    borderBottomWidth: 0,
  },
  summaryItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
    flex: 1,
  },
  summaryItemValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
    flex: 1,
  },
  createAccountFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 16,
  },
  createAccountInputWrapper: {
    marginBottom: 16,
  },
  createAccountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  createAccountInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  createAccountInputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  createAccountErrorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 6,
  },
  navigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    backgroundColor: 'rgba(250, 248, 243, 0.95)',
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  backButton: {
    flex: 1,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6A9571',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6A9571',
    letterSpacing: 0.3,
  },
  nextButton: {
    flex: 2,
    height: 60,
    borderRadius: 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  nextButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
})

