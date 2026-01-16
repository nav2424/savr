// Responsive Design Utilities
// Handles different screen sizes and densities consistently across devices

import { Dimensions, PixelRatio, Platform } from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Base dimensions (iPhone 14 Pro as reference)
const BASE_WIDTH = 393
const BASE_HEIGHT = 852

// Calculate scale factors
const widthScale = SCREEN_WIDTH / BASE_WIDTH
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT

// Get the smaller scale to maintain aspect ratio
let scale = Math.min(widthScale, heightScale)

// Adjust scale for Expo Go vs Simulator differences
// Expo Go on real devices often renders larger, so we scale down
const isExpoGo = __DEV__ && (global as any).expo
const FONT_SCALE = PixelRatio.getFontScale()

// Quick scaling override for testing (set to null to use automatic scaling)
const MANUAL_SCALE_OVERRIDE = null // Try values like 0.7, 0.75, 0.8, 0.85, 0.9

// Apply manual override if set
if (MANUAL_SCALE_OVERRIDE !== null) {
  scale = MANUAL_SCALE_OVERRIDE
} else if (isExpoGo && Platform.OS === 'ios') {
  // More aggressive scaling for Expo Go on iOS
  if (PixelRatio.get() > 2.5) {
    // High density screens (like iPhone Pro models) in Expo Go
    scale = scale * 0.75
  } else if (PixelRatio.get() > 2) {
    // Standard density screens in Expo Go
    scale = scale * 0.8
  } else {
    // Lower density screens in Expo Go
    scale = scale * 0.85
  }
}

// Adjust for system font scaling / Display Zoom so layout doesn't look oversized
if (FONT_SCALE > 1) {
  // Reduce scale proportionally to font scale but keep some breathing room
  const fontScaleAdjustment = 1 / Math.min(FONT_SCALE, 1.3)
  scale = scale * fontScaleAdjustment
}

if (Platform.OS === 'ios' && PixelRatio.get() > 2.5) {
  // High density screens (like iPhone Pro models) in production
  scale = scale * 0.9
} else if (Platform.OS === 'ios' && PixelRatio.get() > 2) {
  // Standard density screens in production
  scale = scale * 0.95
}

// Responsive font scaling
export const scaleFont = (size: number): number => {
  const newSize = size * scale
  return Math.max(12, PixelRatio.roundToNearestPixel(newSize))
}

// Responsive width scaling
export const scaleWidth = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * widthScale)
}

// Responsive height scaling
export const scaleHeight = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * heightScale)
}

// Responsive size (uses the smaller scale for consistent sizing)
export const scaleSize = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * scale)
}

// Get responsive dimensions
export const getResponsiveDimensions = () => {
  return {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    scale,
    widthScale,
    heightScale,
    isSmallScreen: SCREEN_WIDTH < 375,
    isMediumScreen: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLargeScreen: SCREEN_WIDTH >= 414,
    isTablet: SCREEN_WIDTH >= 768,
    pixelRatio: PixelRatio.get(),
    fontScale: FONT_SCALE
  }
}

// Responsive padding/margin
export const responsivePadding = {
  xs: scaleSize(4),
  sm: scaleSize(8),
  md: scaleSize(16),
  lg: scaleSize(24),
  xl: scaleSize(32),
  xxl: scaleSize(48)
}

// Responsive font sizes
export const responsiveFonts = {
  xs: scaleFont(10),
  sm: scaleFont(12),
  md: scaleFont(14),
  lg: scaleFont(16),
  xl: scaleFont(18),
  xxl: scaleFont(20),
  xxxl: scaleFont(24),
  title: scaleFont(28),
  largeTitle: scaleFont(32)
}

// Responsive spacing
export const responsiveSpacing = {
  xs: scaleSize(4),
  sm: scaleSize(8),
  md: scaleSize(12),
  lg: scaleSize(16),
  xl: scaleSize(20),
  xxl: scaleSize(24),
  xxxl: scaleSize(32)
}

// Device-specific adjustments
export const deviceAdjustments = {
  // Adjust for different pixel densities
  getAdjustedSize: (size: number) => {
    const pixelRatio = PixelRatio.get()
    if (pixelRatio > 3) {
      // High density screens (like iPhone Pro models)
      return size * 0.9
    } else if (pixelRatio < 2) {
      // Lower density screens
      return size * 1.1
    }
    return size
  },
  
  // Get safe area adjustments
  getSafeAreaPadding: () => {
    const { height } = Dimensions.get('window')
    if (height > 800) {
      // iPhone X and newer
      return { top: 44, bottom: 34 }
    }
    return { top: 20, bottom: 0 }
  }
}

// Debug info for development
export const getDebugInfo = () => {
  const dims = getResponsiveDimensions()
  const isExpoGo = __DEV__ && (global as any).expo
  return {
    screen: `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`,
    scale: dims.scale.toFixed(2),
    pixelRatio: dims.pixelRatio,
    fontScale: dims.fontScale,
    platform: Platform.OS,
    isTablet: dims.isTablet,
    isExpoGo: isExpoGo,
    baseScale: Math.min(widthScale, heightScale).toFixed(2),
    adjustedScale: scale.toFixed(2),
    manualOverride: MANUAL_SCALE_OVERRIDE
  }
}
