// SAVR Profile Settings - Beautiful Modern Design
import React, { useState, useEffect } from 'react'
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
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/AuthContext'
import { useListsUnified } from '../lib/useListsUnified'
import { userPreferencesService } from '../lib/UserPreferencesService'
import { propagateUserName } from '../lib/UserProfileService'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/Logger'

const { width } = Dimensions.get('window')

const HOUSEHOLD_OPTIONS = ['1', '2', '3', '4', '5+']
const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Mediterranean',
  'Low-Carb',
  'High Protein',
  'Gluten-Free',
  'Keto',
]
const COOKING_SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Chef-Level']

export default function ProfileSettingsScreen() {
  const router = useRouter()
  const { user, deleteAccount } = useAuth()
  const { refreshLists } = useListsUnified()
  const [loading, setLoading] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [currentPreferences, setCurrentPreferences] = useState<any>(null)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    householdSize: '',
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{[key: string]: string}>({})
  const [resettingPassword, setResettingPassword] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      if (user?.id) {
        const preferences = await userPreferencesService.loadPreferences(user.id)
        setCurrentPreferences(preferences)
        
        setFormData({
          firstName: preferences?.profile?.firstName || '',
          lastName: preferences?.profile?.lastName || '',
          email: user?.email || '',
          householdSize: preferences?.profile?.householdSize || preferences?.household?.size || '',
        })
        setHasChanges(false)
        setErrors({})
      }
    } catch (error) {
      logger.error('Error loading user data', { error })
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.')
      return
    }

    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      if (user?.id) {
        const currentPrefs = await userPreferencesService.loadPreferences(user.id)
        
        const updatedPreferences = {
          ...currentPrefs,
          profile: {
            ...currentPrefs?.profile,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            householdSize: formData.householdSize.trim(),
          },
          household: {
            ...currentPrefs?.household,
            size: formData.householdSize.trim(),
          },
        }

        await userPreferencesService.savePreferences(updatedPreferences as any, user.id)
        setCurrentPreferences(updatedPreferences)
        setHasChanges(false)

        // Propagate name to users table and all denormalized copies (lists, activities, etc.)
        const fullName = [formData.firstName.trim(), formData.lastName.trim()].filter(Boolean).join(' ')
        if (fullName) {
          const { error: nameError } = await propagateUserName(user.id, fullName)
          if (nameError) {
            logger.warn('Name propagation failed (profile saved)', { error: nameError })
            // Profile preferences saved; name may not have propagated everywhere
          } else if (typeof refreshLists === 'function') {
            refreshLists().catch(() => {}) // Refresh lists so updated names show immediately
          }
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(
          'Profile Updated',
          'Your profile has been updated successfully.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      logger.error('Error saving profile', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {}
    
    if (formData.firstName.trim().length > 0 && formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePasswordForm = (): boolean => {
    const newErrors: {[key: string]: string} = {}
    
    if (!newPassword.trim()) {
      newErrors.newPassword = 'Password is required'
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters'
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setPasswordErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleResetPassword = async () => {
    if (!validatePasswordForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Validation Error', 'Please fix the errors before resetting your password.')
      return
    }

    setResettingPassword(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        logger.error('Error resetting password', { error })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', error.message || 'Failed to reset password. Please try again.')
        return
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Password Reset',
        'Your password has been successfully updated.',
        [{ text: 'OK' }]
      )
      
      // Clear password fields
      setNewPassword('')
      setConfirmPassword('')
      setPasswordErrors({})
    } catch (error: any) {
      console.error('Error resetting password:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to reset password. Please try again.')
    } finally {
      setResettingPassword(false)
    }
  }



  const getCurrentCuisines = (): string[] => {
    if (!currentPreferences) return []
    return currentPreferences.dietary?.cuisines || []
  }

  const getInitials = () => {
    const firstInitial = formData.firstName?.[0] || user?.email?.[0] || 'S'
    const lastInitial = formData.lastName?.[0] || ''
    return `${firstInitial}${lastInitial}`.toUpperCase()
  }


  const selectHouseholdOption = (option: string) => {
    updateField('householdSize', option)
  }


  const renderInput = ({
    id,
    label,
    value,
    placeholder,
    multiline = false,
    keyboardType = 'default',
    icon,
    showDropdown = false,
    dropdownOptions = [],
    onDropdownSelect,
  }: {
    id: keyof typeof formData
    label: string
    value: string
    placeholder: string
    multiline?: boolean
    keyboardType?: 'default' | 'email-address'
    icon?: string
    showDropdown?: boolean
    dropdownOptions?: string[]
    onDropdownSelect?: (option: string) => void
  }) => {
    const hasError = errors[id as string]
    const isDropdown = showDropdown && dropdownOptions.length > 0
    
    return (
      <View style={styles.inputContainer}>
        {label && (
          <View style={styles.labelRow}>
            {icon && <Text style={styles.inputIcon}>{icon}</Text>}
            <Text style={styles.inputLabel}>{label}</Text>
          </View>
        )}
        <Pressable
          onPress={() => {
            if (isDropdown) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setActiveDropdown(id as string)
            }
          }}
          disabled={!isDropdown}
        >
          <BlurView intensity={80} tint="light" style={styles.inputBlur}>
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
              style={styles.inputGradient}
            >
              {isDropdown ? (
                <View style={styles.dropdownInputContainer}>
                  <Text style={[styles.textInput, !value && styles.placeholderText]}>
                    {value || placeholder}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </View>
              ) : (
                <TextInput
                  style={[styles.textInput, multiline && styles.textArea, hasError && styles.textInputError]}
                  value={value}
                  onChangeText={(text) => updateField(id as string, text)}
                  placeholder={placeholder}
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
                  autoCorrect={false}
                  keyboardType={keyboardType}
                  multiline={multiline}
                />
              )}
            </LinearGradient>
          </BlurView>
        </Pressable>
        {hasError && <Text style={styles.errorText}>{hasError}</Text>}
      </View>
    )
  }

  const renderDropdown = (id: string, options: string[], onSelect: (option: string) => void, title: string) => {
    if (activeDropdown !== id) return null

    return (
      <Modal
        visible={activeDropdown === id}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}
        >
          <Pressable onPress={() => {}}>
            <BlurView intensity={100} tint="light" style={styles.dropdownContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
                style={styles.dropdownContent}
              >
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>{title}</Text>
                  <Pressable
                    onPress={() => setActiveDropdown(null)}
                    style={styles.dropdownCloseButton}
                  >
                    <Text style={styles.dropdownCloseText}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
                  {options.map((option, index) => {
                    const isSelected = formData[id as keyof typeof formData] === option
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.dropdownOption,
                          index === 0 && styles.dropdownOptionFirst,
                          index === options.length - 1 && styles.dropdownOptionLast,
                          isSelected && styles.dropdownOptionSelected,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                          onSelect(option)
                          setActiveDropdown(null)
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                          {option}
                        </Text>
                        {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </LinearGradient>
            </BlurView>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    )
  }


  const renderMultiSelectDropdown = (
    id: string,
    options: string[],
    onToggle: (option: string) => void,
    title: string
  ) => {
    if (activeDropdown !== id) return null

    const selected: string[] = []

    return (
      <Modal
        visible={activeDropdown === id}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}
        >
          <Pressable onPress={() => {}}>
            <BlurView intensity={100} tint="light" style={styles.dropdownContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
                style={styles.dropdownContent}
              >
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>{title}</Text>
                  <Pressable
                    onPress={() => setActiveDropdown(null)}
                    style={styles.dropdownCloseButton}
                  >
                    <Text style={styles.dropdownCloseText}>✕</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.dropdownOptions} showsVerticalScrollIndicator={false}>
                  {options.map((option, index) => {
                    const isSelected = selected.includes(option)
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.dropdownOption,
                          index === 0 && styles.dropdownOptionFirst,
                          index === options.length - 1 && styles.dropdownOptionLast,
                          isSelected && styles.dropdownOptionSelected,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          onToggle(option)
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                          {option}
                        </Text>
                        {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                      </Pressable>
                    )
                  })}
                </ScrollView>
                <View style={styles.dropdownFooter}>
                  <Pressable
                    style={styles.dropdownDoneButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      setActiveDropdown(null)
                    }}
                  >
                    <LinearGradient
                      colors={['#6A9571', '#5A8561']}
                      style={styles.dropdownDoneButtonGradient}
                    >
                      <Text style={styles.dropdownDoneButtonText}>Done</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </LinearGradient>
            </BlurView>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    )
  }


  const renderChips = (items: string[], emptyLabel: string) => {
    if (!items.length) {
      return (
        <View style={styles.emptyChipsContainer}>
          <Text style={styles.emptyChipText}>{emptyLabel}</Text>
        </View>
      )
    }
    return (
      <View style={styles.chipRow}>
        {items.map((item, index) => (
          <BlurView key={`${item}-${index}`} intensity={60} tint="light" style={styles.chipBlur}>
            <LinearGradient
              colors={['rgba(106,149,113,0.2)', 'rgba(106,149,113,0.12)']}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{item}</Text>
            </LinearGradient>
          </BlurView>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      <LinearGradient
        colors={['#F8FAF9', '#F0F5F2', '#E8F0EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 40}
      >
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              if (hasChanges) {
                Alert.alert(
                  'Unsaved Changes',
                  'You have unsaved changes. Do you want to save them before leaving?',
                  [
                    { text: 'Discard', style: 'destructive', onPress: () => router.back() },
                    { text: 'Save', onPress: handleSave },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                )
              } else {
                router.back()
              }
            }}
          >
            <BlurView intensity={80} tint="light" style={styles.backButtonBlur}>
              <Text style={styles.backButtonText}>←</Text>
            </BlurView>
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Profile</Text>
            {hasChanges && (
              <View style={styles.unsavedBadge}>
                <Text style={styles.unsavedText}>Unsaved</Text>
              </View>
            )}
          </View>
        </View>

        {/* Hero Profile Card */}
        <BlurView intensity={90} tint="light" style={styles.heroCardBlur}>
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['#6A9571', '#5A8561']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </LinearGradient>
            </View>
            <Text style={styles.heroName}>
              {formData.firstName || formData.lastName
                ? `${formData.firstName} ${formData.lastName}`.trim()
                : 'Your Name'}
            </Text>
            <Text style={styles.heroEmail}>{formData.email || user?.email}</Text>
            {formData.householdSize && (
              <View style={styles.heroBadges}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>👥 {formData.householdSize}</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </BlurView>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {renderInput({
            id: 'firstName',
            label: 'First Name',
            value: formData.firstName,
            placeholder: 'Enter your first name',
            icon: '👤',
          })}
          {renderInput({
            id: 'lastName',
            label: 'Last Name',
            value: formData.lastName,
            placeholder: 'Enter your last name',
          })}
          {renderInput({
            id: 'email',
            label: 'Email Address',
            value: formData.email,
            placeholder: 'Email address',
            keyboardType: 'email-address',
            icon: '✉️',
          })}
        </View>

        {/* Household Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Household</Text>
          {renderInput({
            id: 'householdSize',
            label: 'Household Size',
            value: formData.householdSize,
            placeholder: 'Select household size',
            icon: '👥',
            showDropdown: true,
            dropdownOptions: HOUSEHOLD_OPTIONS,
            onDropdownSelect: selectHouseholdOption,
          })}
          {renderDropdown('householdSize', HOUSEHOLD_OPTIONS, selectHouseholdOption, 'Select Household Size')}
        </View>

        {/* Password Reset Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Password</Text>
          
          {/* New Password */}
          <View style={styles.passwordInputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={[styles.passwordInputWrapper, passwordErrors.newPassword && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor="#8E8E93"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text)
                  if (passwordErrors.newPassword) {
                    setPasswordErrors(prev => ({ ...prev, newPassword: '' }))
                  }
                  // Check if passwords match when confirm password is filled
                  if (confirmPassword && text !== confirmPassword) {
                    setPasswordErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }))
                  } else if (confirmPassword && text === confirmPassword) {
                    setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }))
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.eyeIconButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowPassword(!showPassword)
                }}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#8E8E93" 
                />
              </Pressable>
            </View>
            {passwordErrors.newPassword && (
              <Text style={styles.errorText}>{passwordErrors.newPassword}</Text>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.passwordInputContainer}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={[styles.passwordInputWrapper, passwordErrors.confirmPassword && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor="#8E8E93"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text)
                  if (passwordErrors.confirmPassword) {
                    setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }))
                  }
                  // Validate password match
                  if (newPassword && text !== newPassword) {
                    setPasswordErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }))
                  } else if (newPassword && text === newPassword) {
                    setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }))
                  }
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.eyeIconButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowConfirmPassword(!showConfirmPassword)
                }}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#8E8E93" 
                />
              </Pressable>
            </View>
            {passwordErrors.confirmPassword && (
              <Text style={styles.errorText}>{passwordErrors.confirmPassword}</Text>
            )}
          </View>

          {/* Reset Password Button */}
          {(newPassword || confirmPassword) && (
            <Pressable
              style={[styles.resetPasswordButton, { opacity: resettingPassword ? 0.7 : 1 }]}
              onPress={handleResetPassword}
              disabled={resettingPassword}
            >
              <LinearGradient
                colors={['#6A9571', '#5A8561', '#4A7551']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resetPasswordButtonGradient}
              >
                {resettingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.resetPasswordButtonText}>Reset Password</Text>
                )}
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* Delete Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.dangerZoneDescription}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>
          <Pressable
            style={[styles.deleteAccountButton, deletingAccount && styles.deleteAccountButtonDisabled]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              Alert.alert(
                'Delete Account',
                'Are you sure you want to permanently delete your account? All your data including pantry items, lists, receipts, and preferences will be permanently removed. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                      setDeletingAccount(true)
                      try {
                        const { error } = await deleteAccount()
                        if (error) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                          Alert.alert(
                            'Deletion Failed',
                            error.message || 'Failed to delete account. Please try again or contact support.'
                          )
                          return
                        }
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        router.replace('/welcome')
                      } catch (err) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                        Alert.alert(
                          'Deletion Failed',
                          err instanceof Error ? err.message : 'An unexpected error occurred. Please try again or contact support.'
                        )
                      } finally {
                        setDeletingAccount(false)
                      }
                    },
                  },
                ]
              )
            }}
            disabled={deletingAccount}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.deleteAccountButtonContent}>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <Pressable
            style={[styles.saveButton, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6A9571', '#5A8561', '#4A7551']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButtonGradient}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.bottomSpacing} />
        <View style={styles.extraKeyboardSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6A9571',
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1B1B1B',
    letterSpacing: -0.5,
  },
  unsavedBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unsavedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroCardBlur: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  heroCard: {
    padding: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1B1B',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroEmail: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
    fontWeight: '500',
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(106,149,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(106,149,113,0.3)',
    marginHorizontal: 6,
    marginVertical: 4,
  },
  heroBadgeText: {
    fontSize: 13,
    color: '#1B1B1B',
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B1B1B',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1B1B',
    marginBottom: 8,
  },
  passwordInputContainer: {
    marginBottom: 20,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#1B1B1B',
    paddingRight: 8,
  },
  eyeIconButton: {
    padding: 4,
  },
  inputError: {
    borderColor: '#FF6B6B',
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 13,
    color: '#FF6B6B',
    marginTop: 6,
    marginLeft: 4,
  },
  resetPasswordButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resetPasswordButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetPasswordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerZoneDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.5)',
  },
  deleteAccountButtonDisabled: {
    opacity: 0.6,
  },
  deleteAccountButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGradient: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  dropdownInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderText: {
    color: 'rgba(0,0,0,0.35)',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6A9571',
    fontWeight: '600',
  },
  textInput: {
    fontSize: 16,
    color: '#1B1B1B',
    minHeight: 24,
    fontWeight: '500',
    flex: 1,
  },
  textInputError: {
    color: '#FF6B6B',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  chipSection: {
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  chipBlur: {
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(106,149,113,0.3)',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    color: '#1B1B1B',
    fontWeight: '600',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownContainer: {
    width: width - 80,
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  dropdownContent: {
    borderRadius: 28,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  dropdownTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B1B1B',
    letterSpacing: -0.3,
  },
  dropdownCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  dropdownOptions: {
    maxHeight: 400,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  dropdownOptionFirst: {
    borderTopWidth: 0,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(106,149,113,0.08)',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1B1B1B',
    fontWeight: '500',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#6A9571',
    fontWeight: '600',
  },
  dropdownCheckmark: {
    fontSize: 18,
    color: '#6A9571',
    fontWeight: '700',
    marginLeft: 12,
  },
  dropdownFooter: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  dropdownDoneButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownDoneButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownDoneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 12,
  },
  dropdownSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 24,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownEmptyCustomText: {
    fontSize: 14,
    color: '#9CA3AF',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  emptyChipsContainer: {
    marginTop: 12,
    paddingVertical: 12,
  },
  emptyChipText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  saveButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 32,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  saveButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bottomSpacing: {
    height: 40,
  },
  extraKeyboardSpacing: {
    height: 200,
  },
})
