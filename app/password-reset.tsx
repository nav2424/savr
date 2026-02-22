// SAVR Password Reset Screen - handles password reset link from email
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import * as Haptics from 'expo-haptics'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl } from '../lib/authDeepLink'
import { useToast } from '../lib/ToastContext'

export default function PasswordResetScreen() {
  const router = useRouter()
  const { showToast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingLink, setProcessingLink] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})

  // Handle deep link for password reset
  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        // Get initial URL (if app was opened from a link)
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          console.log('🔐 App opened from password reset link:', initialUrl)
          await processResetLink(initialUrl)
        }

        // Listen for deep links while app is running
        const subscription = Linking.addEventListener('url', async (event) => {
          console.log('🔐 Password reset deep link received:', event.url)
          await processResetLink(event.url)
        })

        return () => {
          subscription.remove()
        }
      } catch (error) {
        console.error('Error setting up password reset deep link listener:', error)
      }
    }

    const processResetLink = async (url: string) => {
      try {
        setProcessingLink(true)
        console.log('🔐 Processing password reset link:', url)

        // Establish session from URL tokens so user is authenticated for password update
        const sessionCreated = await createSessionFromUrl(url)
        if (sessionCreated) {
          console.log('✅ Session created from password reset link')
          // Verify we have a valid session
          const { data: { session }, error } = await supabase.auth.getSession()
          if (error || !session) {
            Alert.alert(
              'Invalid Link',
              'This password reset link is invalid or has expired. Please request a new one.',
              [{ text: 'OK', onPress: () => router.replace('/auth') }]
            )
            return
          }
        } else {
          Alert.alert(
            'Invalid Link',
            'Could not process the password reset link. Please request a new one.',
            [{ text: 'OK', onPress: () => router.replace('/auth') }]
          )
          return
        }
      } catch (error) {
        console.error('Error processing password reset link:', error)
        Alert.alert(
          'Error',
          'Something went wrong processing the reset link. Please try again.',
          [{ text: 'OK', onPress: () => router.replace('/auth') }]
        )
      } finally {
        setProcessingLink(false)
      }
    }

    handleDeepLink()
  }, [router])

  const validatePasswords = (): boolean => {
    const errors: { newPassword?: string; confirmPassword?: string } = {}

    if (!newPassword.trim()) {
      errors.newPassword = 'Password is required'
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters'
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleResetPassword = async () => {
    if (!validatePasswords()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Verify we still have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        Alert.alert(
          'Session Expired',
          'Your password reset session has expired. Please request a new reset link.',
          [{ text: 'OK', onPress: () => router.replace('/auth') }]
        )
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', updateError.message || 'Failed to reset password. Please try again.')
        return
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast('Password reset successfully!', { kind: 'success' })
      
      Alert.alert(
        'Password Reset',
        'Your password has been successfully updated. You can now sign in with your new password.',
        [
          {
            text: 'Sign In',
            onPress: () => router.replace('/auth'),
          },
        ]
      )
    } catch (error: any) {
      console.error('Error resetting password:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error?.message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Background */}
      <LinearGradient
        colors={['#FAF8F3', '#F0F7F2', '#E8F4ED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.formContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          <Text style={styles.title}>Reset Your Password</Text>
          <Text style={styles.subtitle}>
            Enter your new password below
          </Text>

          {processingLink && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#6A9571" />
              <Text style={styles.processingText}>Processing reset link...</Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={[
                styles.input,
                passwordErrors.newPassword && styles.inputError,
              ]}
              placeholder="Enter new password"
              placeholderTextColor="#8E8E93"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text)
                if (passwordErrors.newPassword) {
                  setPasswordErrors({ ...passwordErrors, newPassword: undefined })
                }
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !processingLink}
              autoComplete="password-new"
              textContentType="newPassword"
            />
            {passwordErrors.newPassword && (
              <Text style={styles.errorText}>{passwordErrors.newPassword}</Text>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                passwordErrors.confirmPassword && styles.inputError,
              ]}
              placeholder="Confirm new password"
              placeholderTextColor="#8E8E93"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text)
                if (passwordErrors.confirmPassword) {
                  setPasswordErrors({ ...passwordErrors, confirmPassword: undefined })
                }
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !processingLink}
              autoComplete="password-new"
              textContentType="newPassword"
            />
            {passwordErrors.confirmPassword && (
              <Text style={styles.errorText}>{passwordErrors.confirmPassword}</Text>
            )}
          </View>

          <Pressable
            style={[styles.resetButton, (loading || processingLink) && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={loading || processingLink}
          >
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resetButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.replace('/auth')
            }}
            disabled={loading || processingLink}
          >
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </Pressable>
        </View>
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
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  formContainer: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 80,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '400',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  processingText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 20,
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
    marginLeft: 4,
    marginTop: 4,
  },
  resetButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
    textAlign: 'center',
  },
})
