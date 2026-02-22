// SAVR Email Verified (web) – shown when user clicks the verification link in email.
// The link opens in a browser and lands here. We show success and an "Open in app" option.
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'

const APP_SCHEME = Constants.expoConfig?.scheme ?? 'savr'

export default function EmailVerifiedScreen() {
  const router = useRouter()
  const [hashFragment, setHashFragment] = useState('')

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hash) {
      setHashFragment(window.location.hash)
    }
  }, [])

  const openInAppUrl = `${APP_SCHEME}:///email-verification${hashFragment}`

  const handleOpenInApp = () => {
    if (Platform.OS === 'web') {
      // On web, open the deep link so the OS prompts to open the app
      window.location.href = openInAppUrl
    } else {
      // In app (e.g. already on email-verification), just go to tabs
      router.replace('/(tabs)')
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#FAF8F3', '#F0F7F2', '#E8F4ED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✅</Text>
        </View>
        <Text style={styles.title}>Your email has been verified.</Text>
        <Text style={styles.subtitle}>Please return to the app.</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleOpenInApp}
        >
          <LinearGradient
            colors={['#5A8A6A', '#6A9571', '#7BA67D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Open in app</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '500',
  },
  button: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
})
