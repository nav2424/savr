// Custom not-found: when user lands here from a deep link (e.g. password reset),
// redirect to the correct screen so they never see "Unmatched Route".
import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { Unmatched } from 'expo-router'

export default function NotFoundScreen() {
  const router = useRouter()
  const [checkDone, setCheckDone] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const url = await Linking.getInitialURL()
        if (cancelled) return
        if (url?.includes('password-reset')) {
          setRedirecting(true)
          router.replace('/password-reset')
          return
        }
        if (url?.includes('email-verification')) {
          setRedirecting(true)
          router.replace('/email-verification')
          return
        }
      } catch (_) {
        // ignore
      } finally {
        if (!cancelled) setCheckDone(true)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [router])

  // While checking or redirecting, show loading so we don't flash "Unmatched Route"
  if (!checkDone || redirecting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    )
  }

  return <Unmatched />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
})
