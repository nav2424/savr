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
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { getSmtpSetupInstructions } from '../lib/smtpDiagnostics'
import { useToast } from '../lib/ToastContext'
import { getPasswordResetRedirectUrl } from '../lib/authDeepLink'

export default function AuthScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ next?: string | string[] }>()
  const { signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const [isSignUp, setIsSignUp] = useState(false) // Sign-in by default; new users go to onboarding
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)
  const nextRaw = params.next
  const nextRoute = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw
  const safeNextRoute =
    typeof nextRoute === 'string' && nextRoute.startsWith('/') ? nextRoute : null

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      return { valid: false, error: 'Email is required' }
    }
    // Basic email format validation (RFC 5322 simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid email address' }
    }
    // Check for common issues
    if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.startsWith('@')) {
      return { valid: false, error: 'Please enter a valid email address' }
    }
    return { valid: true }
  }

  const handleAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    
    if (!trimmedEmail || !password.trim()) {
      showToast('Please fill in all fields.', { kind: 'warning' })
      return
    }

    if (isSignUp && !name.trim()) {
      showToast('Please enter your full name.', { kind: 'warning' })
      return
    }

    // Validate email format before calling Supabase
    if (isSignUp) {
      const emailValidation = validateEmail(trimmedEmail)
      if (!emailValidation.valid) {
        setEmailError(emailValidation.error || 'Invalid email format')
        showToast(emailValidation.error || 'Invalid email format', { kind: 'error' })
        return
      }
      setEmailError(null)
    }

    if (isSignUp && password !== confirmPassword) {
      showToast('Passwords do not match.', { kind: 'warning' })
      return
    }

    if (isSignUp && password.length < 6) {
      showToast('Password must be at least 6 characters.', { kind: 'warning' })
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    try {
      if (isSignUp) {
        // Sign up - normalize email (trim + lowercase) before sending to Supabase
        const { error, emailWarning } = await signUp(trimmedEmail, password, name.trim())
        
        // Stop loading, then show a blocking alert so reviewers and users see verification guidance (toasts are easy to miss).
        if (!error) {
          setLoading(false)
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          } catch {
            /* haptics optional */
          }

          const goOnboarding = () =>
            router.replace(`/onboarding?email=${encodeURIComponent(trimmedEmail)}`)

          let title = 'Check your email'
          let message = `We sent a verification link to ${trimmedEmail}.\n\nCheck your inbox and spam folder. If nothing arrives in a few minutes, use “Resend verification” on the email verification screen.`

          if (emailWarning) {
            title = 'Account created'
            const isSmtpIssue = emailWarning.startsWith('SMTP_')
            if (isSmtpIssue) {
              const instructions = getSmtpSetupInstructions(emailWarning)
              message = `Your account was created. A verification email may not arrive until email is configured on our servers.\n\n${instructions.slice(0, 4).join('\n')}\n\nAfter continuing, use “Resend verification” or contact support if you need help.`
            } else {
              message = `Your account was created. If you don’t see a verification email, check spam or use “Resend verification” after continuing.`
            }
          }

          Alert.alert(title, message, [{ text: 'Continue', onPress: goOnboarding }])
          return
        }
        
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
            const errorMessage = error.message?.toLowerCase() || ''
            const isInvalidFormat = errorMessage.includes('invalid format') || errorMessage.includes('unable to validate email')
            
            if (isInvalidFormat) {
              // Email format validation error from Supabase
              setEmailError('Please enter a valid email address (e.g., name@example.com)')
              Alert.alert(
                'Invalid Email Format',
                'The email address you entered is not in a valid format. Please check:\n\n• No spaces\n• Contains @ symbol\n• Has a domain (e.g., gmail.com)\n• Example: yourname@example.com',
                [
                  {
                    text: 'OK',
                    style: 'default'
                  }
                ]
              )
            } else {
              // Check if it's an email-related error (SMTP, etc.)
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
                showToast(error.message || 'Sign up failed. Please try again.', { kind: 'error', durationMs: 4000 })
              }
            }
          }
        }
        // Note: Success case is handled above (lines 62-99) with immediate navigation
      } else {
        const { error } = await signIn(trimmedEmail, password)
        if (error) {
          showToast(error.message || 'Invalid credentials.', { kind: 'error', durationMs: 3500 })
        } else {
          // Return to pending deep-link destination after auth (e.g. family invite accept).
          router.replace((safeNextRoute ?? '/(tabs)') as any)
        }
      }
    } catch (error: any) {
      showToast(error?.message || 'Something went wrong.', { kind: 'error', durationMs: 3500 })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase()

    // Require a valid email before attempting reset
    const { valid, error } = validateEmail(trimmedEmail)
    if (!valid) {
      setEmailError(error || 'Please enter a valid email address')
      showToast(error || 'Please enter a valid email address', { kind: 'warning' })
      return
    }

    try {
      setResettingPassword(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const redirectTo = getPasswordResetRedirectUrl()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      })

      if (resetError) {
        showToast(resetError.message || 'Could not send reset email. Please try again.', {
          kind: 'error',
          durationMs: 4000,
        })
        return
      }

      showToast('Password reset link sent. Check your email.', {
        kind: 'success',
        durationMs: 4500,
      })
      Alert.alert(
        'Check your email',
        'We sent a link to reset your password. Open the link in your email to choose a new password, then return here to sign in.'
      )
    } catch (error: any) {
      showToast(error?.message || 'Something went wrong while sending the reset email.', {
        kind: 'error',
        durationMs: 4000,
      })
    } finally {
      setResettingPassword(false)
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

          {/* Forgot Password (Sign In only) */}
          {!isSignUp && (
            <Pressable
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              disabled={loading || resettingPassword}
            >
              <Text style={styles.forgotPasswordText}>
                {resettingPassword ? 'Sending reset link…' : 'Forgot password?'}
              </Text>
            </Pressable>
          )}

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

          {/* Toggle Sign In / Get Started */}
          <Pressable
            style={styles.toggleButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              if (isSignUp) {
                setIsSignUp(false)
              } else {
                router.replace('/onboarding')
              }
            }}
            disabled={loading}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleTextBold}>
                {isSignUp ? 'Sign In' : 'Get Started'}
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6A9571',
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


