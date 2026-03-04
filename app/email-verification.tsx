// SAVR Email Verification Screen — OTP code input with link fallback
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Linking from 'expo-linking'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { createSessionFromUrl, getEmailVerificationRedirectUrl } from '../lib/authDeepLink'
import { getSmtpErrorMessage, getSmtpSetupInstructions } from '../lib/smtpDiagnostics'
import { useToast } from '../lib/ToastContext'

const PENDING_EMAIL_STORAGE_KEY = 'email_verification_pending_email_v1'
const CODE_LENGTH = 6

export default function EmailVerificationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string; token?: string; type?: string }>()
  const { session, user } = useAuth()
  const { showToast } = useToast()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [processingLink, setProcessingLink] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [codeError, setCodeError] = useState<string | null>(null)
  const inputRefs = useRef<(TextInput | null)[]>([])

  // Get user email from multiple sources
  useEffect(() => {
    const getUserEmail = async () => {
      let email = params.email || ''
      if (!email) email = session?.user?.email || user?.email || ''
      if (!email) {
        try {
          const stored = await AsyncStorage.getItem(PENDING_EMAIL_STORAGE_KEY)
          if (stored) email = stored
        } catch { /* ignore */ }
      }
      if (!email) {
        try {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (s?.user?.email) email = s.user.email
        } catch { /* ignore */ }
      }
      const finalEmail = email || ''
      setUserEmail(finalEmail)
      if (finalEmail) {
        try { await AsyncStorage.setItem(PENDING_EMAIL_STORAGE_KEY, finalEmail) } catch { /* non-blocking */ }
      }
    }
    getUserEmail()
  }, [session, user, params.email])

  // Deep link fallback (if user still clicks the email link)
  useEffect(() => {
    const processVerificationLink = async (url: string) => {
      try {
        setProcessingLink(true)
        const sessionCreated = await createSessionFromUrl(url)
        if (sessionCreated) {
          const { data: { session: s } } = await supabase.auth.getSession()
          if (s) {
            const { data: { user: u } } = await supabase.auth.getUser()
            if (u?.email_confirmed_at) {
              try { await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY) } catch { /* non-blocking */ }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              router.replace('/(tabs)')
            }
          }
        }
      } catch { /* ignore */ } finally { setProcessingLink(false) }
    }

    const setup = async () => {
      const initialUrl = await Linking.getInitialURL()
      if (initialUrl) await processVerificationLink(initialUrl)
      const sub = Linking.addEventListener('url', (e) => processVerificationLink(e.url))
      return () => sub.remove()
    }
    setup()
  }, [router])

  // Auto-redirect if already verified
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        if (s) {
          const { data: { user: u } } = await supabase.auth.getUser()
          if (u?.email_confirmed_at && mounted) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.replace('/(tabs)')
          }
        }
      } catch { /* ignore */ }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => { mounted = false; clearInterval(interval) }
  }, [router])

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setInterval(() => setResendCooldown((p) => (p <= 1 ? 0 : p - 1)), 1000)
      return () => clearInterval(t)
    }
  }, [resendCooldown])

  const handleCodeChange = (text: string, index: number) => {
    setCodeError(null)
    const digit = text.replace(/[^0-9]/g, '').slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (next.every((d) => d !== '') && next.join('').length === CODE_LENGTH) {
      Keyboard.dismiss()
      verifyCode(next.join(''))
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const next = [...code]
      next[index - 1] = ''
      setCode(next)
    }
  }

  const verifyCode = async (otp: string) => {
    if (!userEmail) {
      setCodeError('Email not found. Please go back and sign up again.')
      return
    }

    setVerifying(true)
    setCodeError(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: userEmail.trim().toLowerCase(),
        token: otp,
        type: 'signup',
      })

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('expired') || msg.includes('invalid')) {
          setCodeError('Invalid or expired code. Please try again or resend.')
        } else if (msg.includes('rate') || msg.includes('too many')) {
          setCodeError('Too many attempts. Please wait a moment.')
          setResendCooldown(30)
        } else {
          setCodeError(error.message || 'Verification failed. Please try again.')
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setCode(Array(CODE_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
        return
      }

      if (data?.session) {
        try { await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY) } catch { /* non-blocking */ }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        showToast('Email verified!', { kind: 'success' })
        router.replace('/(tabs)')
      } else {
        setCodeError('Verification succeeded but session was not created. Please sign in.')
      }
    } catch (err: any) {
      setCodeError(err?.message || 'Something went wrong. Please try again.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setVerifying(false)
    }
  }

  const handleResendEmail = async () => {
    if (resendCooldown > 0) {
      showToast(`Please wait ${resendCooldown}s before resending.`, { kind: 'warning' })
      return
    }

    let emailToUse = userEmail?.trim() || ''
    if (!emailToUse) {
      try {
        const stored = await AsyncStorage.getItem(PENDING_EMAIL_STORAGE_KEY)
        if (stored?.trim()) emailToUse = stored.trim()
      } catch { /* ignore */ }
    }

    if (!emailToUse) {
      Alert.alert('Email needed', 'We couldn\'t find your email. Please go back and sign up again.')
      return
    }

    setResending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const emailRedirectTo = getEmailVerificationRedirectUrl()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: { emailRedirectTo },
      })

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('rate limit') || msg.includes('too many') || String(error.status) === '429') {
          setResendCooldown(60)
          showToast('Too many attempts. Please wait 1 minute.', { kind: 'warning' })
        } else if (msg.includes('already verified') || msg.includes('already confirmed')) {
          try { await AsyncStorage.removeItem(PENDING_EMAIL_STORAGE_KEY) } catch { /* non-blocking */ }
          showToast('Email already verified.', { kind: 'success' })
          router.replace('/(tabs)')
        } else {
          showToast(error.message || 'Couldn\'t send email. Try again.', { kind: 'error' })
        }
        return
      }

      setResendCooldown(30)
      setCode(Array(CODE_LENGTH).fill(''))
      setCodeError(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast('New verification code sent! Check your inbox.', { kind: 'success' })
    } catch (err: any) {
      showToast(err?.message || 'Something went wrong. Try again.', { kind: 'error' })
    } finally {
      setResending(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#FAF8F3', '#F0F7F2', '#E8F4ED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📧</Text>
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to
        </Text>
        {userEmail ? (
          <Text style={styles.email}>{userEmail}</Text>
        ) : (
          <Text style={styles.subtitleFaded}>your email address</Text>
        )}

        {/* OTP Code Input */}
        <View style={styles.codeContainer}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
                codeError ? styles.codeInputError : null,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!verifying}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {codeError && (
          <Text style={styles.errorText}>{codeError}</Text>
        )}

        {verifying && (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator size="small" color="#6A9571" />
            <Text style={styles.verifyingText}>Verifying...</Text>
          </View>
        )}

        {/* Resend */}
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
            <Text style={styles.resendLinkText}>Resend code in {resendCooldown}s</Text>
          ) : (
            <Text style={styles.resendLinkText}>Didn't receive it? Resend code</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Check your inbox and spam folder.{'\n'}
          You can also tap the link in the email if you prefer.
        </Text>

        {!userEmail && (
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.replace('/auth')
            }}
          >
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: { marginBottom: 24 },
  icon: { fontSize: 64, textAlign: 'center' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitleFaded: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
  },
  email: {
    fontSize: 17,
    fontWeight: '700',
    color: '#6A9571',
    textAlign: 'center',
    marginBottom: 28,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginHorizontal: 4,
  },
  codeInputFilled: {
    borderColor: '#6A9571',
    backgroundColor: '#F0F7F2',
  },
  codeInputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyingText: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '600',
    marginLeft: 8,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  resendButtonPressed: { opacity: 0.7 },
  resendButtonDisabled: { opacity: 0.5 },
  resendLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
  },
  hint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonPressed: { opacity: 0.7 },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
    textAlign: 'center',
  },
})
