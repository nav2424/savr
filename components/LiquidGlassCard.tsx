// iOS 26 Liquid Glass Card Component
import React from 'react'
import { View, ViewStyle, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { iOS26LiquidGlass, iOS26Shadows, iOS26BorderRadius, iOS26Spacing } from '../lib/DesignSystem'

interface LiquidGlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'regular' | 'thick' | 'thin' | 'ultraThin' | 'dark' | 'darkThick'
  intensity?: number
  tint?: 'light' | 'dark' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial'
  borderRadius?: keyof typeof iOS26BorderRadius
  padding?: keyof typeof iOS26Spacing
  shadow?: keyof typeof iOS26Shadows
  onPress?: () => void
  disabled?: boolean
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  variant = 'regular',
  intensity = 60,
  tint = 'systemUltraThinMaterial',
  borderRadius = 'lg',
  padding = 'lg',
  shadow = 'liquidGlass',
  onPress,
  disabled = false,
}) => {
  const glassMaterial = iOS26LiquidGlass[variant]
  const shadowStyle = iOS26Shadows[shadow]
  const borderRadiusValue = iOS26BorderRadius[borderRadius]
  const paddingValue = iOS26Spacing[padding]

  const cardStyle: ViewStyle = {
    borderRadius: borderRadiusValue,
    overflow: 'hidden',
    ...shadowStyle,
    borderWidth: glassMaterial.borderWidth,
    borderColor: glassMaterial.borderColor,
    opacity: disabled ? 0.6 : 1,
  }

  const gradientStyle: ViewStyle = {
    padding: paddingValue,
    borderRadius: borderRadiusValue,
    backgroundColor: glassMaterial.backgroundColor,
  }

  if (Platform.OS === 'ios') {
    const outerContainerStyle: ViewStyle = {
      ...shadowStyle,
      ...style,
    }
    
    const blurStyle: ViewStyle = {
      borderRadius: borderRadiusValue,
      overflow: 'hidden',
      borderWidth: 0,
    }
    
    const innerBorderStyle: ViewStyle = {
      borderRadius: borderRadiusValue,
      borderWidth: glassMaterial.borderWidth,
      borderColor: glassMaterial.borderColor,
    }
    
    return (
      <View style={outerContainerStyle}>
        <BlurView
          intensity={intensity}
          tint={tint}
          style={blurStyle}
        >
          <View style={innerBorderStyle}>
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.75)',
                'rgba(255, 255, 255, 0.65)',
                'rgba(255, 255, 255, 0.70)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={gradientStyle}
            >
              {children}
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    )
  }

  // Fallback for Android
  return (
    <View style={[cardStyle, style]}>
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.75)',
          'rgba(255, 255, 255, 0.65)',
          'rgba(255, 255, 255, 0.70)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={gradientStyle}
      >
        {children}
      </LinearGradient>
    </View>
  )
}

// iOS 26 Liquid Glass Button Component
interface LiquidGlassButtonProps {
  children: React.ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'tertiary'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  style?: ViewStyle
}

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return ['rgba(0, 122, 255, 0.9)', 'rgba(0, 122, 255, 0.7)']
      case 'secondary':
        return ['rgba(88, 86, 214, 0.9)', 'rgba(88, 86, 214, 0.7)']
      case 'tertiary':
        return ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']
      default:
        return ['rgba(0, 122, 255, 0.9)', 'rgba(0, 122, 255, 0.7)']
    }
  }

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }
      case 'medium':
        return { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16 }
      default:
        return { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }
    }
  }

  return (
    <LiquidGlassCard
      variant="ultraThin"
      borderRadius="md"
      padding="md"
      style={[
        getSizeStyle(),
        { opacity: disabled ? 0.5 : 1 },
        style,
      ] as ViewStyle}
      onPress={disabled ? undefined : onPress}
    >
      <LinearGradient
        colors={getVariantColors() as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </LiquidGlassCard>
  )
}

// iOS 26 Liquid Glass Icon Component
interface LiquidGlassIconProps {
  children: React.ReactNode
  size?: number
  variant?: 'regular' | 'thick' | 'thin'
  style?: ViewStyle
}

export const LiquidGlassIcon: React.FC<LiquidGlassIconProps> = ({
  children,
  size = 40,
  variant = 'regular',
  style,
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'thick':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.4)',
        }
      case 'thin':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
        }
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.4)',
        }
    }
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: 'center',
          alignItems: 'center',
          ...iOS26Shadows.sm,
          ...getVariantStyle(),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
