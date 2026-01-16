// SAVR Email Verification Screen
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Linking from 'expo-linking'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { getSmtpErrorMessage, getSmtpSetupInstructions } from '../lib/smtpDiagnostics'

export default function EmailVerificationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string; token?: string; type?: string }>()
  const { session, user } = useAuth()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [processingLink, setProcessingLink] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0) // Cooldown in seconds
  const [lastResendTime, setLastResendTime] = useState<number | null>(null)

  // Get user email from multiple sources
  useEffect(() => {
    const getUserEmail = async () => {
      // First priority: email from route params (passed from signup/onboarding)
      let email = params.email || ''
      
      // Second priority: try from context
      if (!email) {
        email = session?.user?.email || user?.email || ''
      }
      
      // Third priority: try getting from Supabase directly (if session exists)
      if (!email) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          if (currentSession?.user?.email) {
            email = currentSession.user.email
          }
        } catch (error) {
          // Suppress AuthSessionMissingError
          if (!error?.message?.includes('Auth session missing')) {
            console.error('Error getting session email:', error)
          }
        }
      }
      
      // Fourth priority: try getting user (might work even without session)
      if (!email) {
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          email = currentUser?.email || ''
        } catch (error) {
          // Suppress AuthSessionMissingError - it's expected for unverified users
          if (!error?.message?.includes('Auth session missing')) {
            console.error('Error getting user email:', error)
          }
        }
      }
      
      setUserEmail(email || '')
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
        
        // Parse the URL to extract token/hash
        const parsed = Linking.parse(url)
        console.log('📧 Parsed URL:', parsed)
        
        // Supabase includes the token in the URL hash or query params
        // The format is usually: savr://email-verification#access_token=...&type=...
        // Or: savr://email-verification?token=...&type=...
        
        // Try to get session from Supabase (it should be set after clicking the link)
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session from link:', error)
          return
        }
        
        if (session) {
          console.log('✅ Session found after verification link')
          // Session exists, check if email is verified
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.email_confirmed_at) {
            console.log('✅ Email verified via deep link!')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.replace('/(tabs)')
          }
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
            router.replace('/(tabs)')
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
              router.replace('/(tabs)')
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
    // Check cooldown
    if (resendCooldown > 0) {
      Alert.alert(
        'Please Wait',
        `Please wait ${resendCooldown} second${resendCooldown > 1 ? 's' : ''} before requesting another verification email.`,
        [{ text: 'OK' }]
      )
      return
    }

    // Get email from state or try to fetch it
    let emailToUse = userEmail
    
    if (!emailToUse) {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        emailToUse = currentUser?.email || ''
      } catch (error) {
        console.error('Error getting user email:', error)
      }
    }
    
    if (!emailToUse) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        emailToUse = currentSession?.user?.email || ''
      } catch (error) {
        console.error('Error getting session email:', error)
      }
    }
    
    if (!emailToUse) {
      Alert.alert(
        'Error', 
        'Unable to find your email address. Please try signing up again.',
        [{ text: 'OK' }]
      )
      return
    }

    setResending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // First, check if email is already verified
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (currentUser?.email_confirmed_at) {
        // Email is already verified, navigate to app
        setResending(false)
        Alert.alert(
          'Already Verified',
          'Your email is already verified. Redirecting to app...',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)')
            }
          ]
        )
        return
      }

      // Try to resend verification email using the correct method
      // Use the same emailRedirectTo as signup for consistency
      const emailRedirectTo = 'savr://email-verification'
      
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: {
          emailRedirectTo: emailRedirectTo,
        }
      })

      if (error) {
        // Check for specific error types
        const errorMessage = error.message?.toLowerCase() || ''
        const errorCode = error.status || error.code || ''
        const fullErrorText = JSON.stringify(error).toLowerCase()
        
        console.log('Resend email error:', { 
          message: error.message, 
          code: errorCode, 
          status: error.status,
          fullError: error 
        })
        
        // Check for rate limiting (various formats)
        const isRateLimit = 
          errorMessage.includes('rate limit') || 
          errorMessage.includes('too many requests') || 
          errorMessage.includes('too many') ||
          errorMessage.includes('please wait') ||
          errorCode === 429 ||
          error.status === 429 ||
          fullErrorText.includes('rate limit') ||
          fullErrorText.includes('429')
        
        if (isRateLimit) {
          // Set cooldown to 60 seconds (1 minute) for rate limit
          setResendCooldown(60)
          setLastResendTime(Date.now())
          Alert.alert(
            'Too Many Requests',
            'Please wait 1 minute before requesting another verification email. This helps prevent spam.',
            [{ text: 'OK' }]
          )
        } else if (errorMessage.includes('already verified') || errorMessage.includes('email already confirmed')) {
          // Email is already verified, navigate to app
          Alert.alert(
            'Already Verified',
            'Your email is already verified. Redirecting to app...',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(tabs)')
              }
            ]
          )
        } else if (errorMessage.includes('email not found') || errorMessage.includes('user not found') || errorMessage.includes('invalid email')) {
          Alert.alert(
            'Email Not Found',
            'This email is not associated with an account. Please sign up again.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/auth')
              }
            ]
          )
        } else {
          // Check if it's an SMTP configuration issue
          const smtpErrorType = getSmtpErrorMessage(error)
          const isSmtpIssue = smtpErrorType.startsWith('SMTP_') || smtpErrorType.startsWith('RESEND_')
          
          if (isSmtpIssue) {
            const instructions = getSmtpSetupInstructions(smtpErrorType)
            const instructionsText = instructions.join('\n')
            
            Alert.alert(
              '⚠️ Email Verification Not Configured',
              `We couldn't send the verification email because SMTP is not properly configured.\n\n📧 To fix this:\n\n${instructionsText}\n\n📖 See SMTP_SETUP_COMPLETE.md for detailed instructions.\n\nYou can continue using the app, but email verification won't work until SMTP is configured.`,
              [{ text: 'OK' }]
            )
          } else {
            // Generic error - show user-friendly message
            Alert.alert(
              'Unable to Send Email',
              error.message || 'We couldn\'t send the verification email. Please check your email address and try again, or contact support if the problem persists.',
              [{ text: 'OK' }]
            )
          }
        }
      } else {
        // Success - set cooldown to 30 seconds to prevent rapid resends
        setResendCooldown(30)
        setLastResendTime(Date.now())
        Alert.alert(
          '✅ Email Sent!',
          'Please check your inbox and click the verification link. If you don\'t see it, check your spam folder.',
          [{ text: 'OK' }]
        )
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error: any) {
      console.error('Resend email exception:', error)
      Alert.alert(
        'Error',
        error?.message || 'An unexpected error occurred. Please try again later.',
        [{ text: 'OK' }]
      )
    } finally {
      setResending(false)
    }
  }

  const displayEmail = userEmail || 'your email'

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
          Please check your inbox and click the verification link to continue.
        </Text>

        {checking && (
          <View style={styles.checkingContainer}>
            <ActivityIndicator size="small" color="#6A9571" />
            <Text style={styles.checkingText}>Checking verification status...</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.resendButton,
            pressed && styles.resendButtonPressed,
            (resending || resendCooldown > 0) && styles.resendButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={resending || resendCooldown > 0}
        >
          <LinearGradient
            colors={resendCooldown > 0 ? ['#9E9E9E', '#B0B0B0', '#C0C0C0'] : ['#5A8A6A', '#6A9571', '#7BA67D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.resendButtonGradient}
          >
            {resending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : resendCooldown > 0 ? (
              <Text style={styles.resendButtonText}>
                Resend in {resendCooldown}s
              </Text>
            ) : (
              <Text style={styles.resendButtonText}>Resend Verification Email</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.hint}>
          Once you verify your email, you'll automatically be taken to the app.
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
            <Text style={styles.backButtonText}>Back to Sign Up</Text>
          </Pressable>
        )}
      </View>
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
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
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
    marginBottom: 8,
    fontWeight: '400',
  },
  email: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A9571',
    textAlign: 'center',
    marginBottom: 32,
  },
  instructions: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
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
  resendButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  resendButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  resendButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
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
