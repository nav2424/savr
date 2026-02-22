// Catch-all route for unmatched deep links
// Handles cases like savr:///password-reset that Expo Router doesn't recognize
import { useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import * as Linking from 'expo-linking'

export default function UnmatchedRoute() {
  const router = useRouter()
  const params = useLocalSearchParams()
  
  useEffect(() => {
    const handleUnmatched = async () => {
      try {
        // Get the current URL that caused the unmatched route
        const initialUrl = await Linking.getInitialURL()
        
        // Check unmatched params (from the route)
        const unmatchedPath = Array.isArray(params.unmatched) 
          ? params.unmatched.join('/') 
          : params.unmatched || ''
        
        console.log('🔍 Unmatched route detected:', { params, unmatchedPath, initialUrl })
        
        // Check if it's a password reset link (handle both formats)
        if (initialUrl?.includes('password-reset') || unmatchedPath.includes('password-reset')) {
          console.log('🔐 Unmatched route is password-reset, redirecting')
          router.replace('/password-reset')
          return
        }
        
        // Check if it's an email verification link
        if (initialUrl?.includes('email-verification') || unmatchedPath.includes('email-verification')) {
          console.log('📧 Unmatched route is email-verification, redirecting')
          router.replace('/email-verification')
          return
        }
        
        // If we can't match it, go to welcome/auth
        console.log('⚠️ Unmatched route not recognized, redirecting to welcome')
        router.replace('/welcome')
      } catch (error) {
        console.error('Error handling unmatched route:', error)
        router.replace('/welcome')
      }
    }
    
    handleUnmatched()
  }, [router, params])
  
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6A9571" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
})
