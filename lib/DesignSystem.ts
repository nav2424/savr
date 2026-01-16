// iOS 26 Design System - Liquid Glass Implementation
import { Platform } from 'react-native'

// iOS 26 Color Palette - Dynamic Colors with Semantic Tokens
export const iOS26Colors = {
  // Primary Colors with Liquid Glass Tints
  primary: {
    base: '#007AFF',
    light: '#4DA6FF',
    dark: '#0056CC',
    glass: 'rgba(0, 122, 255, 0.15)',
  },
  
  // Secondary Colors
  secondary: {
    base: '#5856D6',
    light: '#8A88E8',
    dark: '#3A39A3',
    glass: 'rgba(88, 86, 214, 0.15)',
  },
  
  // Semantic Colors
  success: {
    base: '#34C759',
    light: '#6DD47A',
    dark: '#2AA84A',
    glass: 'rgba(52, 199, 89, 0.15)',
  },
  
  warning: {
    base: '#FF9500',
    light: '#FFB84D',
    dark: '#CC7700',
    glass: 'rgba(255, 149, 0, 0.15)',
  },
  
  error: {
    base: '#FF3B30',
    light: '#FF6B6B',
    dark: '#CC2E26',
    glass: 'rgba(255, 59, 48, 0.15)',
  },
  
  // Neutral Colors with Glass Tints
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    glass: {
      light: 'rgba(255, 255, 255, 0.8)',
      medium: 'rgba(255, 255, 255, 0.6)',
      dark: 'rgba(255, 255, 255, 0.4)',
      ultra: 'rgba(255, 255, 255, 0.95)',
    }
  }
}

// iOS 26 Typography System
export const iOS26Typography = {
  // Display Styles
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    letterSpacing: -0.5,
  },
  
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  
  title2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
    letterSpacing: -0.1,
  },
  
  // Body Styles
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0,
  },
  
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 13,
    letterSpacing: 0.1,
  },
}

// iOS 26 Spacing System
export const iOS26Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
}

// iOS 26 Border Radius System
export const iOS26BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  full: 9999,
}

// iOS 26 Shadow System with Liquid Glass Effects
export const iOS26Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 12,
  },
  
  // Liquid Glass Specific Shadows - Premium iOS 26 Style
  liquidGlass: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  
  liquidGlassInner: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
}

// iOS 26 Liquid Glass Materials
export const iOS26LiquidGlass = {
  // Standard Materials
  regular: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  
  thick: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1.5,
  },
  
  thin: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 0.5,
  },
  
  // Ultra Materials for iOS 26
  ultraThin: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
  },
  
  // Dark Mode Materials
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  
  darkThick: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
  },
}

// iOS 26 Animation Durations
export const iOS26Animations = {
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
  
  // Easing Functions
  easeInOut: 'ease-in-out',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  spring: 'spring',
}

// iOS 26 Component Sizes
export const iOS26Sizes = {
  // Button Heights
  button: {
    small: 32,
    medium: 44,
    large: 56,
    xlarge: 64,
  },
  
  // Icon Sizes
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  
  // Card Sizes
  card: {
    small: 80,
    medium: 120,
    large: 160,
    xlarge: 200,
  },
}

// iOS 26 Breakpoints
export const iOS26Breakpoints = {
  small: 375,
  medium: 414,
  large: 768,
  xlarge: 1024,
}

// Helper function to get responsive values
export const getResponsiveValue = (values: { [key: string]: any }, screenWidth: number) => {
  if (screenWidth >= iOS26Breakpoints.xlarge) return values.xlarge || values.large
  if (screenWidth >= iOS26Breakpoints.large) return values.large || values.medium
  if (screenWidth >= iOS26Breakpoints.medium) return values.medium || values.small
  return values.small
}

// iOS 26 Design Tokens
export const iOS26Tokens = {
  colors: iOS26Colors,
  typography: iOS26Typography,
  spacing: iOS26Spacing,
  borderRadius: iOS26BorderRadius,
  shadows: iOS26Shadows,
  liquidGlass: iOS26LiquidGlass,
  animations: iOS26Animations,
  sizes: iOS26Sizes,
  breakpoints: iOS26Breakpoints,
}
