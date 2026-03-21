// SAVR Email Verification Screen
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  InputAccessoryView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Linking from 'expo-linking'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { processAuthDeepLink, getEmailVerificationRedirectUrl } from '../lib/authDeepLink'
import { openMailAppInbox } from '../lib/openMailApp'
import { getSmtpErrorMessage, getSmtpSetupInstructions } from '../lib/smtpDiagnostics'
import { useToast } from '../lib/ToastContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { replaceAfterEmailVerified } from '../lib/postVerifyNavigation'

const PENDING_EMAIL_STORAGE_KEY = 'email_verification_pending_email_v1'
const OTP_ACCESSORY_ID = 'savr-email-otp-accessory'

export default function EmailVerificationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ email?: string; token?: string; type?: string }>()
  const { session, user } = useAuth()
  const { showToast } = useToast()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [processingLink, setProcessingLink] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0) // Cooldown in seconds
  const [otpCode, setOtpCode] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  // Get user email from multiple sources and persist for resend (session may be missing for unverified users)
  useEffect(() => {
    const getUserEmail = async () => {
      // First priority: email from route params (passed from signup/onboarding)
      let email = params.email || ''

      // Second priority: try from context
      if (!email) {
        email = session?.user?.email || user?.email || ''
      }

      // Third priority: try persisted email (from previous visit to this screen)
      if (!email) {
        try {
          const stored = await AsyncStorage.getItem(PENDING_EMAIL_STORAGE_KEY)
          if (stored) email = stored
        } catch {
          // ignore
        }
      }

      // Fourth priority: try getting from Supabase directly (if session exists)
      if (!email) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          if (currentSession?.user?.email) {
            email = currentSession.user.email
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error)
          if (!msg.includes('Auth session missing')) {
            console.error('Error getting session email:', error)
          }
        }
      }

      // Fifth priority: try getting user (might work even without session)
      if (!email) {
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          email = currentUser?.email || ''
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error)
          if (!msg.includes('Auth session missing')) {
            console.error('Error getting user email:', error)
          }
        }
      }

      const finalEmail = email || ''
      setUserEmail(finalEmail)
      // Persist so resend works even if session is missing (e.g. app was closed and reopened)
      if (finalEmail) {
        try {
          await AsyncStorage.setItem(PENDING_EMAIL_STORAGE_KEY, finalEmail)
        } catch {
          // non-blocking
        }
      }
    }

    getUserEmail()
  }, [session, user, params.email])

  // Handle deep link for email verification
  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        // Get initial URL (if app was opened from a link)
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) {
          console.log('📧 App opened from deep link:', initialUrl)
          await processVerificationLink(initialUrl)
        }

        // Listen for deep links while app is running
        const subscription = Linking.addEventListener('url', async (event) => {
          console.log('📧 Deep link received:', event.url)
          await processVerificationLink(event.url)
        })

        return () => {
          subscription.remove()
        }
      } catch (error) {
        console.error('Error setting up deep link listener:', error)
      }
    }

    const processVerificationLink = async (url: string) => {
      try {
        setProcessingLink(true)
        console.log('📧 Processing verification link:', url)

        const sessionCreated = await processAuthDeepLink(url)
        if (sessionCreated) {
          console.log('✅ Session created from verification link')
        }

        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session from link:', error)
          return
        }
        if (!session) return

        let user = (await supabase.auth.getUser()).data.user
        if (user && !user.email_confirmed_at) {
          await supabase.auth.refreshSession().catch(() => {})
          await new Promise((r) => setTimeout(r, 350))
          user = (await supabase.auth.getUser()).data.user
        }

        if (user?.email_confirmed_at) {
          console.log('✅ Email verified via deep link!')
          try {
            await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY)
          } catch {
            /* non-blocking */
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          void replaceAfterEmailVerified((h) => router.replace(h as any))
        }
      } catch (error) {
        console.error('Error processing verification link:', error)
      } finally {
        setProcessingLink(false)
      }
    }

    handleDeepLink()
  }, [router])

  // Check verification status immediately and periodically
  useEffect(() => {
    let isMounted = true
    
    const checkVerification = async () => {
      if (!isMounted) return
      
      setChecking(true)
      try {
        // First check if we have a session
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        // If we have a session, try to get user
        if (currentSession) {
          const { data: { user: currentUser }, error } = await supabase.auth.getUser()
          
          if (error) {
            // Suppress AuthSessionMissingError - it's expected in some cases
            if (!error.message?.includes('Auth session missing')) {
              console.error('Error getting user:', error.message)
            }
            setChecking(false)
            return
          }
          
          // Update email if we got it from the user object
          if (currentUser?.email && !userEmail) {
            setUserEmail(currentUser.email)
          }
          
          if (currentUser?.email_confirmed_at) {
            // Email is verified, navigate to tabs immediately
            console.log('✅ Email already verified - redirecting to app')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            void replaceAfterEmailVerified((h) => router.replace(h as any))
            return
          }
        } else {
          // No session - this is normal for unverified users
          // Try to get user anyway (might work in some cases)
          try {
            const { data: { user: currentUser }, error } = await supabase.auth.getUser()
            
            // AuthSessionMissingError is expected when email isn't verified yet
            if (error && error.message?.includes('Auth session missing')) {
              // This is normal - user hasn't verified email yet, just return silently
              setChecking(false)
              return
            }
            
            if (error) {
              // Other errors - log but don't spam
              if (!error.message?.includes('Auth session missing')) {
                console.error('Error getting user:', error.message)
              }
              setChecking(false)
              return
            }
            
            // Update email if we got it from the user object
            if (currentUser?.email && !userEmail) {
              setUserEmail(currentUser.email)
            }
            
            // Check if email is verified
            if (currentUser?.email_confirmed_at) {
              console.log('✅ Email already verified - redirecting to app')
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              void replaceAfterEmailVerified((h) => router.replace(h as any))
              return
            }
          } catch (error: any) {
            // Suppress AuthSessionMissingError - it's expected
            if (!error?.message?.includes('Auth session missing')) {
              console.error('Error checking verification:', error)
            }
          }
        }
      } catch (error: any) {
        // Suppress AuthSessionMissingError
        if (!error?.message?.includes('Auth session missing')) {
          console.error('Error checking verification:', error)
        }
      } finally {
        if (isMounted) {
          setChecking(false)
        }
      }
    }

    // Check immediately when screen loads (no delay)
    checkVerification()

    // Also check periodically (every 3 seconds) in case verification happens while on this screen
    const interval = setInterval(() => {
      if (isMounted) {
        checkVerification()
      }
    }, 3000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [router, userEmail, session, user])

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [resendCooldown])

  const handleResendEmail = async () => {
    if (resendCooldown > 0) {
      showToast(`Please wait ${resendCooldown}s before resending.`, { kind: 'warning' })
      return
    }

    // Resolve email: state first, then persisted, then Supabase (session may be missing for unverified users)
    let emailToUse = userEmail?.trim() || ''
    if (!emailToUse) {
      try {
        const stored = await AsyncStorage.getItem(PENDING_EMAIL_STORAGE_KEY)
        if (stored?.trim()) emailToUse = stored.trim()
      } catch {
        // ignore
      }
    }
    if (!emailToUse) {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        emailToUse = currentUser?.email?.trim() || ''
      } catch {
        // ignore
      }
    }
    if (!emailToUse) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        emailToUse = currentSession?.user?.email?.trim() || ''
      } catch {
        // ignore
      }
    }

    if (!emailToUse) {
      Alert.alert(
        'Email needed',
        'We couldn’t find your email. Please go back and sign up again, or enter your email on the next screen.',
        [{ text: 'OK' }]
      )
      return
    }

    setResending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser?.email_confirmed_at) {
        setResending(false)
        try { await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY) } catch { /* non-blocking */ }
        showToast('Email already verified. Taking you in…', { kind: 'success' })
        void replaceAfterEmailVerified((h) => router.replace(h as any))
        return
      }

      const emailRedirectTo = getEmailVerificationRedirectUrl()
      let error = (await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: { emailRedirectTo },
      })).error

      // One retry on transient failure (no retry for rate limit, already verified, not found, SMTP config)
      if (error) {
        const errorMessage = error.message?.toLowerCase() || ''
        const errorCode = String(error.status ?? error.code ?? '')
        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests') ||
          errorMessage.includes('too many') ||
          errorMessage.includes('please wait') ||
          errorCode === '429'
        const isRetryable =
          !isRateLimit &&
          !errorMessage.includes('already verified') &&
          !errorMessage.includes('email already confirmed') &&
          !errorMessage.includes('email not found') &&
          !errorMessage.includes('user not found') &&
          !errorMessage.includes('invalid email') &&
          !getSmtpErrorMessage(error).startsWith('SMTP_') &&
          !getSmtpErrorMessage(error).startsWith('RESEND_')

        if (isRetryable) {
          await new Promise(r => setTimeout(r, 1000))
          error = (await supabase.auth.resend({
            type: 'signup',
            email: emailToUse,
            options: { emailRedirectTo },
          })).error
        }
      }

      if (error) {
        const errorMessage = error.message?.toLowerCase() || ''
        const errorCode = String(error.status ?? error.code ?? '')
        const isRateLimit =
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests') ||
          errorMessage.includes('too many') ||
          errorMessage.includes('please wait') ||
          errorCode === '429'

        if (isRateLimit) {
          setResendCooldown(60)
          showToast('Too many attempts. Please wait 1 minute.', { kind: 'warning', durationMs: 4000 })
          return
        }
        if (errorMessage.includes('already verified') || errorMessage.includes('email already confirmed')) {
          try { await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY) } catch { /* non-blocking */ }
          showToast('Email already verified.', { kind: 'success' })
          void replaceAfterEmailVerified((h) => router.replace(h as any))
          return
        }
        if (errorMessage.includes('email not found') || errorMessage.includes('user not found') || errorMessage.includes('invalid email')) {
          Alert.alert(
            'Email not found',
            'This email isn’t linked to an account. Please sign up again.',
            [{ text: 'OK', onPress: () => router.replace('/auth') }]
          )
          return
        }

        const smtpErrorType = getSmtpErrorMessage(error)
        const isSmtpIssue = smtpErrorType.startsWith('SMTP_') || smtpErrorType.startsWith('RESEND_')
        if (isSmtpIssue) {
          const instructions = getSmtpSetupInstructions(smtpErrorType)
          Alert.alert(
            'Email not configured',
            `Verification email couldn’t be sent.\n\n${instructions.join('\n')}\n\nSee SMTP_SETUP_COMPLETE.md for setup.`,
            [{ text: 'OK' }]
          )
        } else {
          showToast(error.message || 'Couldn’t send email. Try again.', { kind: 'error', durationMs: 4000 })
        }
        return
      }

      setResendCooldown(30)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast('Verification email sent. Check inbox and spam.', { kind: 'success', durationMs: 3500 })
    } catch (err: any) {
      console.error('Resend email exception:', err)
      showToast(err?.message || 'Something went wrong. Try again.', { kind: 'error', durationMs: 3500 })
    } finally {
      setResending(false)
    }
  }

  const handleVerifyOtp = async () => {
    Keyboard.dismiss()
    const digits = otpCode.replace(/\D/g, '').slice(0, 8)
    if (digits.length < 6) {
      showToast('Enter the 6-digit code from your email.', { kind: 'warning' })
      return
    }
    let emailToUse = userEmail?.trim() || ''
    if (!emailToUse) {
      try {
        const stored = await AsyncStorage.getItem(PENDING_EMAIL_STORAGE_KEY)
        if (stored?.trim()) emailToUse = stored.trim()
      } catch {
        /* ignore */
      }
    }
    if (!emailToUse) {
      Alert.alert('Email needed', 'We couldn’t find your email. Go back and sign up again, or resend the verification email.')
      return
    }

    setVerifyingOtp(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const types = ['signup', 'email'] as const
      let lastError: string | null = null
      for (const type of types) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: emailToUse,
          token: digits.slice(0, 6),
          type,
        })
        if (!error && data?.session) {
          try {
            await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY)
          } catch {
            /* non-blocking */
          }
          await supabase.auth.refreshSession().catch(() => {})
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          showToast('Email verified!', { kind: 'success' })
          void replaceAfterEmailVerified((h) => router.replace(h as any))
          return
        }
        lastError = error?.message ?? null
      }
      showToast(lastError || 'Invalid or expired code. Request a new email.', {
        kind: 'error',
        durationMs: 4000,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      showToast(msg, { kind: 'error', durationMs: 4000 })
    } finally {
      setVerifyingOtp(false)
    }
  }

  const displayEmail = userEmail || 'your email'
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 8 : 0

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#FAF8F3', '#F0F7F2', '#E8F4ED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>📧</Text>
              </View>

              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                {userEmail ? 'We\'ve sent a verification link to' : 'Please verify your email address'}
              </Text>
              {userEmail && <Text style={styles.email}>{displayEmail}</Text>}

              <Text style={styles.instructions}>
                Open the link in the email, or enter the 6-digit code below.
                {'\n\n'}Don’t see it? Check your Junk/Spam (and Promotions) folder.
              </Text>

              <Text style={styles.otpLabel}>Verification code</Text>
              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="#B0B0B0"
                editable={!verifyingOtp}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                inputAccessoryViewID={Platform.OS === 'ios' ? OTP_ACCESSORY_ID : undefined}
              />
              <Pressable
                style={styles.dismissKeyboardLink}
                onPress={() => Keyboard.dismiss()}
                hitSlop={12}
              >
                <Text style={styles.dismissKeyboardText}>Hide keyboard</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.otpSubmit,
                  (verifyingOtp || otpCode.length < 6) && styles.otpSubmitDisabled,
                  pressed && !verifyingOtp && otpCode.length >= 6 && styles.otpSubmitPressed,
                ]}
                onPress={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.length < 6}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.otpSubmitText}>Verify code</Text>
                )}
              </Pressable>

              {checking && (
                <View style={styles.checkingContainer}>
                  <ActivityIndicator size="small" color="#6A9571" />
                  <Text style={styles.checkingText}>Checking verification status...</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.verifyButton,
                  pressed && styles.verifyButtonPressed,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  void openMailAppInbox()
                }}
              >
                <LinearGradient
                  colors={['#5A8A6A', '#6A9571', '#7BA67D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifyButtonGradient}
                >
                  <Text style={styles.verifyButtonText}>Open mail app</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.resendButton,
                  pressed && styles.resendButtonPressed,
                  (resending || resendCooldown > 0) && styles.resendButtonDisabled,
                ]}
                onPress={handleResendEmail}
                disabled={resending || resendCooldown > 0}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#6A9571" />
                ) : resendCooldown > 0 ? (
                  <Text style={styles.resendLinkText}>Resend in {resendCooldown}s</Text>
                ) : (
                  <Text style={styles.resendLinkText}>Didn't receive it? Resend verification email</Text>
                )}
              </Pressable>

              <Text style={styles.hint}>
                After you verify, you’ll see your trial and subscription options (if enabled), then the app.
              </Text>

              {!userEmail && (
                <Pressable
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.backButtonPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.replace('/auth')
                  }}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              )}
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={OTP_ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={styles.accessoryDone}
              hitSlop={16}
            >
              <Text style={styles.accessoryDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 80,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '400',
  },
  email: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6A9571',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructions: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 280,
    marginBottom: 8,
  },
  otpInput: {
    width: '100%',
    maxWidth: 280,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6A9571',
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  dismissKeyboardLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  dismissKeyboardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8E8EA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
  },
  accessoryDone: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  accessoryDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  otpSubmit: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#4A7558',
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  otpSubmitDisabled: {
    opacity: 0.45,
  },
  otpSubmitPressed: {
    opacity: 0.9,
  },
  otpSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  checkingText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  verifyButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  verifyButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  verifyButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  resendButtonPressed: {
    opacity: 0.7,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
  },
  hint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
    textAlign: 'center',
  },
})
