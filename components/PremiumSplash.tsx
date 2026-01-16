import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'

const { width, height } = Dimensions.get('window')

interface PremiumSplashProps {
  onAnimationComplete: () => void
}

export default function PremiumSplash({ onAnimationComplete }: PremiumSplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Start animations
    Animated.sequence([
      // Initial fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Glow effect
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      // Hold for a moment
      Animated.delay(1000),
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete()
    })
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
            }
          ]}
        >
          <Text style={styles.logo}>SAVR</Text>
          <Text style={styles.tagline}>Your AI Grocery Companion</Text>
        </Animated.View>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🛒</Text>
            <Text style={styles.featureText}>Smart Lists</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📄</Text>
            <Text style={styles.featureText}>Receipt Scan</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🍳</Text>
            <Text style={styles.featureText}>AI Recipes</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
    textShadowColor: '#4ade80',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4ade80',
    textAlign: 'center',
    letterSpacing: 1,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 300,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
})
