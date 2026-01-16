// SAVR App Entry Point - Check Auth State
import React, { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../lib/SimpleThemeContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function IndexScreen() {
  const router = useRouter()
  const { colors } = useSimpleTheme()
  const { user, session, loading } = useAuth()

  useEffect(() => {
    // Wait for auth check to complete
    if (loading) return

    // Navigate based on auth state
    const timer = setTimeout(async () => {
      if (user && session) {
        // Check if email is verified
        try {
          const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
          
          // Handle refresh token errors gracefully
          if (authError) {
            if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
              // Invalid refresh token - session is expired, redirect to welcome
              console.log('Invalid refresh token - redirecting to welcome')
              router.replace('/welcome')
              return
            }
            throw authError
          }
          
          if (currentUser?.email_confirmed_at) {
            // Email is verified, go to app
            router.replace('/(tabs)')
          } else {
            // Email not verified, show verification screen
            router.replace('/email-verification')
          }
        } catch (error: any) {
          // Handle refresh token errors
          if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token')) {
            console.log('Invalid refresh token in catch - redirecting to welcome')
            router.replace('/welcome')
            return
          }
          
          console.error('Error checking email verification:', error)
          // On error, still check if we have a session
          if (session?.user?.email_confirmed_at) {
            router.replace('/(tabs)')
          } else {
            router.replace('/email-verification')
          }
        }
      } else {
        // User is not signed in, show welcome screen
        router.replace('/welcome')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [user, session, loading, router])

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <ActivityIndicator size="large" color="#6A9571" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
})
