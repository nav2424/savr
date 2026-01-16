// SAVR Authentication Context - User management with Supabase
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, User } from './supabase'
import { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationsService } from './NotificationsService'
import { userPreferencesService } from './UserPreferencesService'
import { logger } from './Logger'
import { DatabaseError, getErrorMessage } from './errors'
import { getSmtpErrorMessage } from './smtpDiagnostics'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any; emailWarning?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session with error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Handle refresh token errors gracefully
        if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
          logger.debug('Invalid refresh token - clearing session', { error: error.message })
          // Clear invalid session
          setSession(null)
          setUser(null)
          setLoading(false)
          // Clear storage to remove stale tokens
          supabase.auth.signOut().catch(() => {
            // Ignore errors during cleanup
          })
          return
        }
        logger.dbError('getSession', error, {})
      }
      
      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user.id).catch((error: any) => {
          // Handle errors in loadUserProfile
          logger.dbError('loadUserProfile error in getSession', error, { userId: session.user.id })
          // Still set loading to false so app doesn't hang
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      // Handle any unexpected errors
      logger.dbError('getSession exception', error, {})
      setSession(null)
      setUser(null)
      setLoading(false)
    })

    // Listen for auth changes with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Token refresh failed - session is invalid
        logger.debug('Token refresh failed - session expired')
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      
      // Handle signed out events
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      
      setSession(session)
      if (session?.user) {
        try {
          await loadUserProfile(session.user.id)
        } catch (error: any) {
          // If loading profile fails due to auth error, clear session
          if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
            logger.debug('Auth error during profile load - clearing session', { error: error.message })
            setSession(null)
            setUser(null)
            setLoading(false)
            await supabase.auth.signOut().catch(() => {
              // Ignore errors during cleanup
            })
          } else {
            // Other errors - still set loading to false so app doesn't hang
            logger.debug('Error loading profile - setting loading to false', { error: error.message })
            setLoading(false)
          }
        }
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error} = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

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
              setLoading(false)
              await supabase.auth.signOut().catch(() => {
                // Ignore errors during cleanup
              })
              return
            }
            throw authError
          }
          
          if (authUser?.user) {
            const { data: newProfile, error: insertError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: authUser.user.email,
                name: authUser.user.email?.split('@')[0] || 'User',
                created_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
              })
              .select()
              .single()
            
            if (!insertError && newProfile) {
              setUser(newProfile)
            } else if (insertError) {
              // If insert fails, log but don't block - loading will be set to false in finally
              logger.dbError('createUserProfile', insertError, { userId })
            }
          } else {
            // No auth user - log but continue
            logger.debug('No auth user found when creating profile', { userId })
          }
        } else {
          throw error
        }
      } else {
        setUser(data)
      }
      
      // Register for push notifications (only works on physical devices)
      try {
        const token = await notificationsService.registerForPushNotifications()
        if (token) {
          logger.info('Push notifications registered')
        } else {
          logger.debug('Push notifications not available (Expo Go or permission denied)')
        }
      } catch (notifError) {
        logger.debug('Push notifications not available in Expo Go - use development build for full functionality')
      }
    } catch (error) {
      logger.dbError('loadUserProfile', error, { userId })
      const errorMessage = getErrorMessage(error)
      throw new DatabaseError(errorMessage, 'SELECT', 'users', { userId })
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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
      // Sign up with Supabase Auth - include name in metadata for trigger
      // Use deep link for email verification redirect
      // For mobile apps, we need to use a URL that Supabase can redirect to
      // The app will handle the deep link to process verification
      const emailRedirectTo = 'savr://email-verification'
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name, // This will be used by the database trigger
          },
          // Redirect to app deep link after email verification
          emailRedirectTo: emailRedirectTo,
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
        
        // Profile is auto-created by database trigger
        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Check if email was confirmed (indicates email was sent successfully)
        const emailConfirmed = authData.user.email_confirmed_at !== null
        console.log('📧 Email confirmation status:', {
          emailConfirmed,
          email_confirmed_at: authData.user.email_confirmed_at,
          email: authData.user.email
        })
        
        // If there's an error but user was created, it's likely just an email sending issue
        if (authError) {
          console.warn('⚠️ User created but email sending failed:', authError.message)
          
          // Detect specific SMTP issues for better error messages
          const smtpErrorType = getSmtpErrorMessage(authError)
          
          // Return success with a flag indicating email warning
          return { 
            error: null,
            emailWarning: smtpErrorType 
          }
        }
        
        // Check if email is not confirmed - this might indicate SMTP is not configured
        // Supabase might silently fail to send emails without returning an error
        if (!emailConfirmed) {
          console.warn('⚠️ User created but email is not confirmed. This might indicate SMTP is not configured.')
          console.warn('📧 Check Supabase Dashboard → Settings → Auth → SMTP Settings')
          console.warn('📧 Or check Authentication → Providers → Email → "Enable email confirmations" setting')
          
          // Return a warning about potential SMTP issue
          return {
            error: null,
            emailWarning: 'SMTP_NOT_CONFIGURED'
          }
        }
        
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
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    
    // Clear user preferences
    await userPreferencesService.clearPreferences()
    
    // Clear local storage
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
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


