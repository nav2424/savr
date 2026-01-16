// SAVR Authentication Screen
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { getSmtpSetupInstructions } from '../lib/smtpDiagnostics'

export default function AuthScreen() {
  const router = useRouter()
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    if (isSignUp && !name.trim()) {
      Alert.alert('Error', 'Please enter your full name')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (isSignUp && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error, emailWarning } = await signUp(email, password, name)
        if (error) {
          // Check if it's an SMTP configuration error
          if (error.code === 'smtp_not_configured' || error.smtpErrorType) {
            const instructions = error.smtpErrorType 
              ? getSmtpSetupInstructions(error.smtpErrorType)
              : getSmtpSetupInstructions('SMTP_NOT_CONFIGURED')
            const instructionsText = instructions.join('\n')
            
            Alert.alert(
              '⚠️ SMTP Not Configured',
              `Email verification is required but not set up.\n\n${instructionsText}\n\n📖 See SMTP_SETUP_COMPLETE.md for detailed instructions.\n\nYou must configure SMTP before users can sign up.`,
              [
                {
                  text: 'OK',
                  style: 'default'
                }
              ]
            )
            setLoading(false)
            return
          }
          
          // Check if email already exists
          const errorMessage = error.message?.toLowerCase() || ''
          const isDuplicateEmail = 
            errorMessage.includes('already registered') || 
            errorMessage.includes('user already exists') ||
            errorMessage.includes('email already registered') ||
            error.code === 'user_already_registered' ||
            error.status === 422 // Unprocessable Entity often means duplicate
          
          if (isDuplicateEmail) {
            // Show error in the UI
            setEmailError('This email is already registered. Please sign in instead.')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            
            Alert.alert(
              'Email Already Exists',
              'This email is already registered. Please sign in instead.',
              [
                {
                  text: 'Sign In',
                  onPress: () => {
                    setIsSignUp(false)
                    setPassword('')
                    setConfirmPassword('')
                    setEmailError(null)
                  },
                  style: 'default',
                },
                {
                  text: 'OK',
                  style: 'cancel',
                },
              ]
            )
          } else {
            // Real error - account creation failed
            // Check if it's an email-related error
            const errorMessage = error.message?.toLowerCase() || ''
            const isEmailRelated = 
              errorMessage.includes('email') || 
              errorMessage.includes('smtp') ||
              errorMessage.includes('confirmation') ||
              errorMessage.includes('verification') ||
              errorMessage.includes('send')
            
            if (isEmailRelated) {
              // Provide helpful SMTP troubleshooting guidance
              const errorDetails = error.status === 500 
                ? '\n\n🔍 Error 500 suggests SMTP connection issue. Check:\n• Supabase Logs → Auth Logs for specific error\n• SMTP credentials are correct\n• Port (try 587 or 465)\n• Sender email is verified\n\nSee SMTP_DIAGNOSTIC_CHECKLIST.md for full troubleshooting.'
                : ''
              
              Alert.alert(
                '⚠️ Email Sending Failed',
                `Account creation failed: ${error.message || 'Error sending confirmation email'}${errorDetails}\n\n📧 If SMTP is configured, check:\n1. Supabase Dashboard → Logs → Auth Logs\n2. Verify SMTP credentials are correct\n3. Check email provider status\n4. See SMTP_DIAGNOSTIC_CHECKLIST.md\n\n⚡ Quick Fix (Testing):\nDisable email confirmation in Authentication → Providers → Email`,
                [
                  {
                    text: 'OK',
                    style: 'default'
                  }
                ]
              )
            } else {
              // Other errors
              Alert.alert('Sign Up Failed', error.message || 'Please try again')
            }
          }
        } else {
          // Success! Account was created
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          
          // If there's an email warning, show actionable guidance
          if (emailWarning) {
            const isSmtpIssue = emailWarning.startsWith('SMTP_')
            
            if (isSmtpIssue) {
              const instructions = getSmtpSetupInstructions(emailWarning)
              const instructionsText = instructions.join('\n')
              
              Alert.alert(
                '⚠️ Email Verification Not Configured',
                `Your account was created, but email verification isn't set up yet.\n\n📧 To enable email verification:\n\n${instructionsText}\n\n📖 See SMTP_SETUP_COMPLETE.md for detailed instructions.\n\nYou can continue setting up your profile, but users won't receive verification emails until SMTP is configured.`,
                [
                  {
                    text: 'Continue Anyway',
                    onPress: () => router.replace(`/onboarding?email=${encodeURIComponent(email)}`)
                  },
                  {
                    text: 'OK',
                    style: 'cancel'
                  }
                ]
              )
            } else {
              Alert.alert(
                '✅ Account Created!',
                'Your account was created successfully. We couldn\'t send the verification email right now, but you can:\n\n1. Continue setting up your profile\n2. Resend the verification email later from your profile\n\nYou can still use the app while we fix the email configuration.',
                [
                  {
                    text: 'Continue',
                    onPress: () => router.replace(`/onboarding?email=${encodeURIComponent(email)}`)
                  }
                ]
              )
            }
          } else {
            // Normal success flow
            Alert.alert(
              '✅ Sign Up Complete!',
              'Please check your email to verify your account. You can continue setting up your profile while we send the verification link.',
              [
                {
                  text: 'Got it!',
                  onPress: () => router.replace(`/onboarding?email=${encodeURIComponent(email)}`)
                }
              ]
            )
          }
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          Alert.alert('Sign In Failed', error.message || 'Invalid credentials')
        } else {
          // Existing users go to tabs
          // PAYWALL TEMPORARILY DISABLED FOR TESTING
          router.replace('/(tabs)')
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>SAVR</Text>
          <Text style={styles.tagline}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {isSignUp && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#8E8E93"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
                autoComplete="name"
                textContentType="name"
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.emailInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  emailError && styles.inputError,
                ]}
                placeholder="Enter your email"
                placeholderTextColor="#8E8E93"
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  // Clear error immediately when user types
                  setEmailError(null)
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>
            {emailError && (
              <Text style={styles.errorText}>{emailError}</Text>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#8E8E93"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              autoComplete="password"
              textContentType="password"
            />
          </View>

          {isSignUp && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#8E8E93"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                autoComplete="password"
                textContentType="password"
              />
            </View>
          )}

          {/* Auth Button */}
          <Pressable
            style={styles.authButton}
            onPress={handleAuth}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.authButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Toggle Sign In/Sign Up */}
          <Pressable
            style={styles.toggleButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setIsSignUp(!isSignUp)
            }}
            disabled={loading}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
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
  gradient: {
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -2,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  formContainer: {
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 4,
  },
  emailInputContainer: {
    position: 'relative',
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
  authButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  authButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  toggleButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  toggleTextBold: {
    fontWeight: '700',
    color: '#6A9571',
  },
})


