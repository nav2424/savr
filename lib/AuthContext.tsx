// SAVR Authentication Context - User management with Supabase
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { supabase, User } from './supabase'
import { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationsService } from './NotificationsService'
import { userPreferencesService, mergeOnboardingWithDefaults, OnboardingPreferencesPayload, PENDING_ONBOARDING_STORAGE_KEY } from './UserPreferencesService'
import { logger } from './Logger'
import { DatabaseError, getErrorMessage } from './errors'
import { getSmtpErrorMessage } from './smtpDiagnostics'
import * as Linking from 'expo-linking'
import { getAuthTokensFromUrl, createSessionFromUrl, getEmailVerificationRedirectUrl } from './authDeepLink'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any; emailWarning?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ error: any }>
  deleteAccount: () => Promise<{ error: any }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const PENDING_SIGNUP_PROFILE_KEY = 'pending_signup_profile_v1'

  const splitFullName = useCallback((fullName: string): { firstName: string; lastName: string } => {
    const trimmed = (fullName || '').trim().replace(/\s+/g, ' ')
    if (!trimmed) return { firstName: '', lastName: '' }
    const parts = trimmed.split(' ')
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }, [])

  const applyPendingSignupProfile = useCallback(async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SIGNUP_PROFILE_KEY)
      if (!raw) return

      const pending = JSON.parse(raw) as { userId?: string; email?: string; name?: string; createdAt?: number }
      if (!pending?.userId || pending.userId !== userId) return

      const { firstName, lastName } = splitFullName(pending.name || '')
      if (!firstName && !lastName) {
        await AsyncStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
        return
      }

      // Merge into existing preferences.profile (used by Profile Settings screen).
      const existing = (await userPreferencesService.loadPreferences(userId)) || ({} as any)
      const currentProfile = existing.profile || {}

      const nextProfile = {
        ...currentProfile,
        firstName: currentProfile.firstName || firstName,
        lastName: currentProfile.lastName || lastName,
      }

      const nextPreferences = {
        ...existing,
        profile: nextProfile,
      }

      const { error } = await userPreferencesService.savePreferences(nextPreferences as any, userId)
      if (error) {
        logger.error('Failed to persist pending signup profile data', { error, userId })
        return
      }

      // Optional: ensure public.users.name matches the signup name (helps lists/collab display).
      if (pending.name) {
        supabase
          .from('users')
          .update({ name: pending.name })
          .eq('id', userId)
          .then(({ error: updateError }) => {
            if (updateError) logger.debug('Could not update users.name (non-blocking)', { error: updateError, userId })
          })
          .catch(() => {})
      }

      await AsyncStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
    } catch (error) {
      logger.debug('applyPendingSignupProfile failed (non-blocking)', { error })
    }
  }, [splitFullName])

  /** Apply onboarding data that was stashed when user completed onboarding before session was ready (e.g. after email verification). */
  const applyPendingOnboardingData = useCallback(async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY)
      if (!raw) return

      const pending = JSON.parse(raw) as {
        preferences?: OnboardingPreferencesPayload
        name?: string
        email?: string
      }
      if (!pending?.preferences && !pending?.name && !pending?.email) {
        await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)
        return
      }

      const existing = await userPreferencesService.loadPreferences(userId)
      const fullPreferences = mergeOnboardingWithDefaults(pending.preferences ?? null, existing)
      const { error: prefError } = await userPreferencesService.savePreferences(fullPreferences, userId)
      if (prefError) {
        logger.error('Failed to persist pending onboarding preferences', { error: prefError, userId })
        return
      }

      const updateData: { name?: string; email?: string } = {}
      if (pending.name) updateData.name = pending.name
      if (pending.email) updateData.email = pending.email
      if (Object.keys(updateData).length > 0) {
        const { error: profileError } = await supabase.from('users').update(updateData).eq('id', userId)
        if (profileError) logger.debug('Could not update users name/email from pending onboarding (non-blocking)', { error: profileError, userId })
      }

      await AsyncStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY)
      logger.info('Applied pending onboarding data to profile', { userId })
    } catch (error) {
      logger.debug('applyPendingOnboardingData failed (non-blocking)', { error })
    }
  }, [])

  const buildFallbackUser = useCallback((sessionUser: { id: string; email?: string | null; user_metadata?: any }): User => {
    const email = sessionUser.email || ''
    const metaName = typeof sessionUser.user_metadata?.name === 'string' ? sessionUser.user_metadata.name : undefined
    const fallbackName = metaName || (email ? email.split('@')[0] : 'User')
    const now = new Date().toISOString()
    return {
      id: sessionUser.id,
      email,
      name: fallbackName,
      created_at: now,
      last_seen: now,
    }
  }, [])

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      let profileToSet: (typeof data) = null
      if (error) {
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          const { data: authUser, error: authError } = await supabase.auth.getUser()

          // Handle refresh token errors
          if (authError) {
            if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
              logger.debug('Refresh token invalid during profile creation - clearing session')
              setSession(null)
              setUser(null)
              await supabase.auth.signOut().catch(() => {})
              return
            }
            throw authError
          }

          if (authUser?.user) {
            const now = new Date().toISOString()
            const { data: newProfile, error: insertError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: authUser.user.email,
                name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'User',
                created_at: now,
                last_seen: now,
              })
              .select()
              .single()

            if (!insertError && newProfile) {
              profileToSet = newProfile
            } else if (insertError) {
              logger.dbError('createUserProfile', insertError, { userId })
              // Keep fallback user; don't block UI
            }
          }
        } else {
          throw error
        }
      } else {
        profileToSet = data
      }

      // Apply pending onboarding/signup BEFORE setting user so dashboard loads preferences on first paint.
      await applyPendingSignupProfile(userId).catch(() => {})
      await applyPendingOnboardingData(userId).catch(() => {})

      if (profileToSet) {
        setUser(profileToSet)
      }

      // Register for push notifications asynchronously (non-blocking)
      notificationsService
        .registerForPushNotifications()
        .then(token => {
          if (token) logger.info('Push notifications registered')
        })
        .catch(() => {
          logger.debug('Push notifications not available in Expo Go - use development build for full functionality')
        })
    } catch (error) {
      logger.dbError('loadUserProfile', error, { userId })
      const errorMessage = getErrorMessage(error)
      logger.error('Profile load failed (non-blocking)', { error: errorMessage, userId })
    } finally {
      setProfileLoading(false)
    }
  }, [buildFallbackUser, applyPendingSignupProfile, applyPendingOnboardingData])

  useEffect(() => {
    let cancelled = false

    const initAuth = async () => {
      // If app was opened from email verification link, create session from URL first so user is signed in
      const initialUrl = await Linking.getInitialURL()
      if (initialUrl && getAuthTokensFromUrl(initialUrl).access_token) {
        const ok = await createSessionFromUrl(initialUrl)
        if (ok) logger.info('Session created from email verification link')
        if (cancelled) return
      }

      // Get current session (from storage or just set from URL)
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      if (cancelled) return

      if (error) {
        // Handle refresh token errors gracefully
        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          logger.debug('Invalid refresh token - clearing session', { error: error.message })
          setSession(null)
          setUser(null)
          setLoading(false)
          supabase.auth.signOut().catch(() => {})
          return
        }
        logger.dbError('getSession', error, {})
      }

      setSession(currentSession)
      setLoading(false)

      if (currentSession?.user) {
        setUser(prev => prev ?? buildFallbackUser(currentSession.user as any))
        setProfileLoading(true)
        loadUserProfile(currentSession.user.id)
      }
    }

    initAuth().catch((error) => {
      if (!cancelled) {
        logger.dbError('getSession exception', error, {})
        setSession(null)
        setUser(null)
        setLoading(false)
        setProfileLoading(false)
      }
    })

    // Handle deep link when app is opened from background (e.g. user taps email verification link)
    const linkingSubscription = Linking.addEventListener('url', async (event) => {
      if (getAuthTokensFromUrl(event.url).access_token) {
        await createSessionFromUrl(event.url)
        // setSession() triggers onAuthStateChange; session/user state will update there
      }
    })

    // Listen for auth changes with error handling
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && !session) {
        logger.debug('Token refresh failed - session expired')
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
        setProfileLoading(false)
        return
      }
      setSession(session)
      if (session?.user) {
        setLoading(false)
        setUser(prev => prev ?? buildFallbackUser(session.user as any))
        setProfileLoading(true)
        loadUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
        setProfileLoading(false)
      }
    })

    return () => {
      cancelled = true
      linkingSubscription.remove()
      authSubscription.unsubscribe()
    }
  }, [buildFallbackUser, loadUserProfile])

  const signIn = async (email: string, password: string) => {
    try {
      // Normalize email: trim whitespace and convert to lowercase
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      
      if (error) return { error }
      
      // Update last seen
      if (data.user) {
        await supabase
          .from('users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', data.user.id)
      }
      
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    try {
      // Normalize email: trim whitespace and convert to lowercase (Supabase expects this format)
      const normalizedEmail = email.trim().toLowerCase()
      
      // Redirect after verification: must match Supabase Redirect URLs exactly so link opens app, not website
      const emailRedirectTo = getEmailVerificationRedirectUrl()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name, // This will be used by the database trigger
          },
          emailRedirectTo,
        }
      })

      // Log for debugging
      console.log('SignUp result:', {
        hasUser: !!authData?.user,
        userId: authData?.user?.id,
        hasError: !!authError,
        errorMessage: authError?.message,
        errorCode: authError?.code,
        errorStatus: authError?.status,
        fullError: authError
      })
      
      // If there's an error, log more details for SMTP debugging
      if (authError && authError.message?.includes('email')) {
        console.error('📧 SMTP Error Details:', {
          message: authError.message,
          code: authError.code,
          status: authError.status,
          name: authError.name,
          hint: 'Check Supabase Dashboard → Logs → Auth Logs for detailed SMTP error'
        })
      }

      // IMPORTANT: Check if user was created FIRST, before checking errors
      // If user exists, account creation succeeded - email errors are non-blocking
      if (authData?.user) {
        // User was created successfully!
        console.log('✅ User created successfully:', authData.user.id)

        // Persist signup form data locally so we can apply it to the user's profile
        // after they verify (when we have an authenticated session and can write preferences).
        try {
          await AsyncStorage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({
            userId: authData.user.id,
            email,
            name,
            createdAt: Date.now(),
          }))
        } catch (e) {
          // Non-fatal
          logger.debug('Failed to persist pending signup profile data locally', { error: e })
        }
        
        // Profile is auto-created by database trigger (non-blocking)
        // Don't wait - let the trigger complete in the background
        // The auth state change listener will handle profile loading
        
        // Check email confirmation status (non-blocking check)
        const emailConfirmed = authData.user.email_confirmed_at !== null
        
        // If there's an error but user was created, it's likely just an email sending issue
        if (authError) {
          console.warn('⚠️ User created but email sending failed:', authError.message)
          
          // Detect specific SMTP issues for better error messages (non-blocking)
          const smtpErrorType = getSmtpErrorMessage(authError)
          
          // Return success immediately - don't block on email issues
          return { 
            error: null,
            emailWarning: smtpErrorType 
          }
        }
        
        // Check if email is not confirmed - this might indicate SMTP is not configured
        // Return immediately without blocking
        if (!emailConfirmed) {
          console.log('📧 Email not confirmed - SMTP may not be configured (non-blocking)')
          
          // Return success immediately with warning
          return {
            error: null,
            emailWarning: 'SMTP_NOT_CONFIGURED'
          }
        }
        
        // Email confirmed - return success immediately
        return { error: null }
      }
      
      // If we get here, user was NOT created - this is a real error
      if (authError) {
        console.error('❌ SignUp failed - user not created:', authError.message)
        
        // Check for duplicate email error
        const errorMessage = authError.message?.toLowerCase() || ''
        const isDuplicateEmail = 
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already exists') ||
          errorMessage.includes('email already registered') ||
          authError.status === 422 || // Unprocessable Entity often means duplicate
          authError.code === 'user_already_registered'
        
        if (isDuplicateEmail) {
          // Return a more user-friendly error
          return { 
            error: {
              ...authError,
              message: 'This email is already registered. Please sign in instead.',
              code: 'user_already_registered'
            }
          }
        }
        
        // Check if it's an SMTP/email error - even if user wasn't created, provide helpful guidance
        const isEmailError = 
          errorMessage.includes('email') && errorMessage.includes('send') ||
          errorMessage.includes('smtp') ||
          errorMessage.includes('confirmation') ||
          errorMessage.includes('verification')
        
        if (isEmailError) {
          // This is likely an SMTP configuration issue preventing account creation
          // Supabase requires email confirmation but can't send emails without SMTP
          const smtpErrorType = getSmtpErrorMessage(authError)
          return {
            error: {
              ...authError,
              message: 'Email verification is required but SMTP is not configured. Two options: 1) Configure SMTP in Supabase Dashboard → Settings → Auth → SMTP Settings (see SMTP_SETUP_COMPLETE.md), or 2) Temporarily disable email confirmation in Authentication → Providers → Email (testing only). See SUPABASE_EMAIL_CONFIRMATION_FIX.md for details.',
              code: 'smtp_not_configured',
              smtpErrorType
            }
          }
        }
        
        return { error: authError }
      }
      
      // No user and no error? Something went wrong
      console.error('❌ SignUp failed - no user and no error returned')
      return { error: new Error('Account creation failed. Please try again.') }
    } catch (error) {
      console.error('❌ SignUp exception:', error)
      return { error }
    }
  }

  const signOut = async () => {
    const userId = user?.id
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfileLoading(false)

    if (userId) {
      await userPreferencesService.clearPreferences(userId)
    } else {
      await userPreferencesService.clearPreferences()
    }
    await AsyncStorage.clear()
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return { error: new Error('No user logged in') }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) return { error }

      setUser({ ...user, ...updates })
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const deleteAccount = async (): Promise<{ error: any }> => {
    if (!user?.id) return { error: new Error('No user logged in') }

    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      })

      if (error) {
        logger.error('Account deletion failed', { error, userId: user.id })
        return { error: error instanceof Error ? error : new Error(String(error)) }
      }

      if (data?.error) {
        logger.error('Account deletion returned error', { error: data.error, userId: user.id })
        return { error: new Error(data.error.message || data.error || 'Failed to delete account') }
      }

      logger.info('Account deleted successfully', { userId: user.id })
      await signOut()
      return { error: null }
    } catch (error) {
      logger.error('Account deletion exception', { error, userId: user.id })
      return { error: error instanceof Error ? error : new Error('Failed to delete account') }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      profileLoading,
      isAuthenticated: !!session?.user,
      signIn,
      signUp,
      signOut,
      updateProfile,
      deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


