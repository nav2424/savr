// Sage Button Component - Floating AI Assistant Button
import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native'
import SageLeafIcon from './SageLeafIcon'
import { useSimpleTheme } from '../lib/SimpleThemeContext'

interface SageButtonProps {
  onPress: () => void
  style?: any
  size?: 'small' | 'medium' | 'large'
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
}

const { width, height } = Dimensions.get('window')

export default function SageButton({ 
  onPress, 
  style, 
  size = 'medium',
  position = 'bottom-right'
}: SageButtonProps) {
  const { colors, isDark } = useSimpleTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          width: 40,
          height: 40,
          borderRadius: 20,
          fontSize: 16,
        }
      case 'large':
        return {
          width: 70,
          height: 70,
          borderRadius: 35,
          fontSize: 28,
        }
      default: // medium
        return {
          width: 50,
          height: 50,
          borderRadius: 25,
          fontSize: 20,
        }
    }
  }

  const getPositionStyles = () => {
    const sizeStyles = getSizeStyles()
    const margin = 20
    const tabBarHeight = 100 // Account for bottom tab navigation height (80px + margin)
    
    switch (position) {
      case 'bottom-left':
        return {
          position: 'absolute' as const,
          bottom: margin + tabBarHeight,
          left: margin,
          zIndex: 1000,
        }
      case 'top-right':
        return {
          position: 'absolute' as const,
          top: margin + 50, // Account for status bar
          right: margin,
          zIndex: 1000,
        }
      case 'top-left':
        return {
          position: 'absolute' as const,
          top: margin + 50,
          left: margin,
          zIndex: 1000,
        }
      case 'center':
        return {
          position: 'absolute' as const,
          top: height / 2 - sizeStyles.height / 2,
          left: width / 2 - sizeStyles.width / 2,
          zIndex: 1000,
        }
      default: // bottom-right
        return {
          position: 'absolute' as const,
          bottom: margin + tabBarHeight,
          right: margin,
          zIndex: 1000,
        }
    }
  }

  const sizeStyles = getSizeStyles()
  const positionStyles = getPositionStyles()
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  return (
    <Animated.View
      style={[
        positionStyles,
        {
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim }
          ],
          elevation: 20, // Android elevation
          zIndex: 1000, // iOS z-index
        }
      ]}
    >
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glowEffect,
          {
            width: sizeStyles.width + 20,
            height: sizeStyles.height + 20,
            borderRadius: (sizeStyles.width + 20) / 2,
            opacity: glowOpacity,
            backgroundColor: colors.accent,
          }
        ]}
      />
      
      {/* Main button */}
      <Pressable
        style={[
          styles.sageButton,
          {
            width: sizeStyles.width,
            height: sizeStyles.height,
            borderRadius: sizeStyles.borderRadius,
            backgroundColor: colors.primary,
          },
          style
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.sageIconContainer}>
          <View style={[styles.sageIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
            {/* Sage Leaf Symbol */}
            <SageLeafIcon 
              size={sizeStyles.fontSize * 0.8} 
              color="white" 
            />
          </View>
        </View>
      </Pressable>
      
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
  },
  sageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sageIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sageIconCircle: {
    width: '70%',
    height: '70%',
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  sageIconText: {
    fontWeight: '700',
    textAlign: 'center',
  },
})
