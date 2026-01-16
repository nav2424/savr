// SAVR Premium Components - Apple-level minimalism with AI intelligence
import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { 
  PremiumColors, 
  PremiumTypography, 
  PremiumSpacing, 
  PremiumBorderRadius, 
  PremiumShadows, 
  PremiumAnimation 
} from '../design-system/PremiumDesignSystem'
import { useSimpleTheme } from '../lib/SimpleThemeContext'

const colors = PremiumColors
const typography = PremiumTypography
const spacing = PremiumSpacing
const borderRadius = PremiumBorderRadius
const shadows = PremiumShadows
const animation = PremiumAnimation
const { width } = Dimensions.get('window')

// Premium Card Component
interface PremiumCardProps {
  children: React.ReactNode
  style?: any
  glassmorphism?: boolean
  shadow?: 'light' | 'medium' | 'heavy' | 'colored'
  onPress?: () => void
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  style,
  glassmorphism = false,
  shadow = 'light',
  onPress,
}) => {
  const animatedScale = React.useRef(new Animated.Value(1)).current
  const animatedOpacity = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Animated.parallel([
        Animated.spring(animatedScale, {
          toValue: 0.96,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const handlePressOut = () => {
    if (onPress) {
      Animated.parallel([
        Animated.spring(animatedScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const cardStyle = [
    styles.card,
    glassmorphism && styles.glassCard,
    shadow && shadows[shadow],
    style,
  ]

  const animatedStyle = {
    transform: [{ scale: animatedScale }],
    opacity: animatedOpacity,
  }

  if (onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable 
          style={cardStyle} 
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {children}
        </Pressable>
      </Animated.View>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

// Premium Button Component
interface PremiumButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'large' | 'medium' | 'small'
  disabled?: boolean
  style?: any
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}) => {
  const animatedScale = React.useRef(new Animated.Value(1)).current
  const animatedOpacity = React.useRef(new Animated.Value(1)).current
  
  const handlePressIn = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      Animated.parallel([
        Animated.spring(animatedScale, {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 400,
          friction: 8,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const handlePressOut = () => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(animatedScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 400,
          friction: 8,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const buttonStyle = [
    styles.button,
    (styles as any)[`button${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    (styles as any)[`button${size.charAt(0).toUpperCase() + size.slice(1)}`],
    disabled && styles.buttonDisabled,
    style,
  ]

  const textStyle = [
    styles.buttonText,
    (styles as any)[`button${variant.charAt(0).toUpperCase() + variant.slice(1)}Text`],
    (styles as any)[`button${size.charAt(0).toUpperCase() + size.slice(1)}Text`],
  ]

  const animatedStyle = {
    transform: [{ scale: animatedScale }],
    opacity: animatedOpacity,
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable 
        style={buttonStyle} 
        onPress={onPress} 
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={textStyle}>{title}</Text>
      </Pressable>
    </Animated.View>
  )
}

// Premium Input Component
interface PremiumInputProps {
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  style?: any
  multiline?: boolean
  numberOfLines?: number
}

export const PremiumInput: React.FC<PremiumInputProps> = ({
  placeholder,
  value,
  onChangeText,
  style,
  multiline = false,
  numberOfLines = 1,
}) => {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholder={placeholder}
      placeholderTextColor={colors.text.tertiary}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      numberOfLines={numberOfLines}
    />
  )
}

// Premium Section Header Component
interface PremiumSectionHeaderProps {
  title: string
  subtitle?: string
  action?: {
    title: string
    onPress: () => void
  }
}

export const PremiumSectionHeader: React.FC<PremiumSectionHeaderProps> = ({
  title,
  subtitle,
  action,
}) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action && (
        <Pressable onPress={action.onPress} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action.title}</Text>
        </Pressable>
      )}
    </View>
  )
}

// Premium Badge Component
interface PremiumBadgeProps {
  title: string
  variant?: 'primary' | 'success' | 'warning' | 'neutral'
  size?: 'small' | 'medium'
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  title,
  variant = 'primary',
  size = 'small',
}) => {
  const badgeStyle = [
    styles.badge,
    (styles as any)[`badge${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    (styles as any)[`badge${size.charAt(0).toUpperCase() + size.slice(1)}`],
  ]

  const textStyle = [
    styles.badgeText,
    (styles as any)[`badge${variant.charAt(0).toUpperCase() + variant.slice(1)}Text`],
    (styles as any)[`badge${size.charAt(0).toUpperCase() + size.slice(1)}Text`],
  ]

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{title}</Text>
    </View>
  )
}

// Premium Progress Bar Component
interface PremiumProgressBarProps {
  progress: number // 0-1
  color?: string
  height?: number
  style?: any
}

export const PremiumProgressBar: React.FC<PremiumProgressBarProps> = ({
  progress,
  color = colors.primary,
  height = 4,
  style,
}) => {
  return (
    <View style={[styles.progressBar, { height }, style]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  )
}

// Premium Floating Action Button
interface PremiumFABProps {
  onPress: () => void
  icon?: string
  size?: number
  style?: any
}

export const PremiumFAB: React.FC<PremiumFABProps> = ({
  onPress,
  icon = '+',
  size = 56,
  style,
}) => {
  return (
    <Pressable
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.fabIcon, { fontSize: size * 0.4 }]}>{icon}</Text>
    </Pressable>
  )
}

// Premium Avatar Component
interface PremiumAvatarProps {
  size?: number
  backgroundColor?: string
  text?: string
  style?: any
}

export const PremiumAvatar: React.FC<PremiumAvatarProps> = ({
  size = 40,
  backgroundColor = colors.primary,
  text,
  style,
}) => {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      {text && (
        <Text
          style={[
            styles.avatarText,
            {
              fontSize: size * 0.4,
              color: colors.text.inverse,
            },
          ]}
        >
          {text.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  )
}

// Premium Divider Component
export const PremiumDivider: React.FC<{ style?: any }> = ({ style }) => {
  return <View style={[styles.divider, style]} />
}

const styles = StyleSheet.create({
  // Enhanced Card Styles
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: colors.shadow.colored,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },

  // Button Styles
  button: {
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.light,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonLarge: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  buttonMedium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  buttonSmall: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '600',
  },
  buttonPrimaryText: {
    color: colors.text.inverse,
  },
  buttonSecondaryText: {
    color: colors.text.primary,
  },
  buttonGhostText: {
    color: colors.primary,
  },
  buttonLargeText: {
    fontSize: typography.button.large.fontSize,
  },
  buttonMediumText: {
    fontSize: typography.button.medium.fontSize,
  },
  buttonSmallText: {
    fontSize: typography.button.small.fontSize,
  },
  rippleEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Input Styles
  input: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.medium.fontSize,
    color: colors.text.primary,
    ...shadows.light,
  },

  // Section Header Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.display.small.fontSize,
    fontWeight: typography.display.small.fontWeight,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.body.small.fontSize,
    color: colors.text.secondary,
  },
  sectionAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionActionText: {
    fontSize: typography.body.small.fontSize,
    color: colors.primary,
    fontWeight: '600',
  },

  // Badge Styles
  badge: {
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePrimary: {
    backgroundColor: colors.primary,
  },
  badgeSuccess: {
    backgroundColor: colors.status.success,
  },
  badgeWarning: {
    backgroundColor: colors.status.warning,
  },
  badgeNeutral: {
    backgroundColor: colors.border.light,
  },
  badgeSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeMedium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    fontWeight: '600',
  },
  badgePrimaryText: {
    color: colors.text.inverse,
  },
  badgeSuccessText: {
    color: colors.text.inverse,
  },
  badgeWarningText: {
    color: colors.text.inverse,
  },
  badgeNeutralText: {
    color: colors.text.secondary,
  },
  badgeSmallText: {
    fontSize: typography.caption.small.fontSize,
  },
  badgeMediumText: {
    fontSize: typography.body.small.fontSize,
  },

  // Progress Bar Styles
  progressBar: {
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.xs,
  },

  // FAB Styles
  fab: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.floating,
  },
  fabIcon: {
    color: colors.text.inverse,
    fontWeight: '600',
  },

  // Avatar Styles
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.light,
  },
  avatarText: {
    fontWeight: '600',
  },

  // Divider Styles
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.lg,
  },
})