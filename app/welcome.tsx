// SAVR Welcome Screen - Beautiful Onboarding
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  StatusBar
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'

const { width, height } = Dimensions.get('window')

export default function WelcomeScreen() {
  const router = useRouter()

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.replace('/onboarding')
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Glassmorphic Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />

      <View style={styles.content}>
        {/* App Name */}
        <View style={styles.logoSection}>
          <Text style={styles.appName}>SAVR</Text>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to SAVR</Text>
          <Text style={styles.welcomeSubtitle}>
            Your intelligent{'\n'}grocery companion
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonSection}>
          <Pressable 
            style={styles.getStartedButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </Pressable>
          <Pressable 
            style={styles.signInButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.replace('/auth')
            }}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
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
  glassmorphicOverlay: {
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
    paddingHorizontal: 40,
  },
  
  // Logo Section
  logoSection: {
    marginBottom: 60,
  },
  appName: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2C2C2E',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Welcome Section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 80,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2C2C2E',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 42,
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#2C2C2E',
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },

  // Button Section
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  signInButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  getStartedButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    minWidth: 200,
  },
  getStartedButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#2C2C2E',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
})
