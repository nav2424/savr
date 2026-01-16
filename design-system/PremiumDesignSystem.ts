// SAVR Premium Design System - Apple-level minimalism with AI intelligence
export const PremiumColors = {
  // Core Brand Palette
  background: '#FEFCF6', // Off-white, warm tone
  primary: '#6A9571', // Sage green accent
  text: {
    primary: '#1B1B1B', // Deep charcoal
    secondary: '#7A7A7A', // Medium gray
    tertiary: '#A0A0A0', // Light gray
    inverse: '#FFFFFF', // White text
  },
  border: {
    light: '#EAEAEA', // Subtle borders
    medium: '#D0D0D0', // Medium borders
    accent: '#6A9571', // Sage green borders
  },
  status: {
    success: '#5E9F64', // Success green
    warning: '#FF6F61', // Warning coral
    error: '#FF4757', // Error red
    info: '#6A9571', // Info sage
  },
  surface: {
    primary: '#FFFFFF', // Pure white cards
    secondary: '#FEFCF6', // Off-white background
    elevated: 'rgba(255, 255, 255, 0.95)', // Glass effect
    overlay: 'rgba(0, 0, 0, 0.4)', // Modal overlay
  },
  shadow: {
    light: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.08)',
    heavy: 'rgba(0, 0, 0, 0.12)',
    colored: 'rgba(106, 149, 113, 0.15)', // Sage green shadow
  },
  gradient: {
    primary: ['#6A9571', '#5E9F64'],
    background: ['#FEFCF6', '#F8F6F0'],
    surface: ['#FFFFFF', '#FEFCF6'],
  }
}

export const PremiumTypography = {
  // SF Pro Display (Semibold for titles)
  display: {
    large: {
      fontSize: 32,
      fontWeight: '600' as const,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    medium: {
      fontSize: 28,
      fontWeight: '600' as const,
      lineHeight: 36,
      letterSpacing: -0.4,
    },
    small: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      letterSpacing: -0.3,
    },
  },
  // SF Pro Text (Regular for body)
  body: {
    large: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 26,
      letterSpacing: 0,
    },
    medium: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      letterSpacing: 0,
    },
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
  },
  // Caption and labels
  caption: {
    large: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
      letterSpacing: 0.5,
    },
    small: {
      fontSize: 10,
      fontWeight: '500' as const,
      lineHeight: 14,
      letterSpacing: 0.5,
    },
  },
  // Button text
  button: {
    large: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    medium: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0,
    },
    small: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
      letterSpacing: 0,
    },
  }
}

export const PremiumSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
}

export const PremiumBorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  round: 999,
}

export const PremiumShadows = {
  light: {
    shadowColor: PremiumColors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: PremiumColors.shadow.medium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  heavy: {
    shadowColor: PremiumColors.shadow.heavy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: {
    shadowColor: PremiumColors.shadow.colored,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  floating: {
    shadowColor: PremiumColors.shadow.medium,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  }
}

export const PremiumAnimation = {
  timing: {
    fast: 200,
    normal: 300,
    slow: 400,
    slower: 600,
  },
  easing: {
    easeInOut: 'ease-in-out',
    easeOut: 'ease-out',
    easeIn: 'ease-in',
    spring: 'spring',
  },
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  }
}

export const PremiumLayout = {
  container: {
    flex: 1,
    backgroundColor: PremiumColors.background,
  },
  safeArea: {
    flex: 1,
    paddingTop: 44, // iPhone notch area
    paddingBottom: 34, // Home indicator area
  },
  card: {
    backgroundColor: PremiumColors.surface.primary,
    borderRadius: PremiumBorderRadius.lg,
    padding: PremiumSpacing.lg,
    ...PremiumShadows.light,
  },
  glassCard: {
    backgroundColor: PremiumColors.surface.elevated,
    borderRadius: PremiumBorderRadius.lg,
    padding: PremiumSpacing.lg,
    ...PremiumShadows.medium,
  },
  floatingButton: {
    position: 'absolute' as const,
    bottom: PremiumSpacing.xxxl,
    right: PremiumSpacing.xl,
    width: 56,
    height: 56,
    borderRadius: PremiumBorderRadius.round,
    backgroundColor: PremiumColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...PremiumShadows.floating,
  }
}

export const PremiumEffects = {
  glassmorphism: {
    backgroundColor: PremiumColors.surface.elevated,
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderColor: PremiumColors.border.light,
  },
  subtleGlow: {
    shadowColor: PremiumColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumGradient: {
    background: `linear-gradient(135deg, ${PremiumColors.gradient.primary[0]}, ${PremiumColors.gradient.primary[1]})`,
  }
}

// Export the complete design system
export const PremiumDesignSystem = {
  colors: PremiumColors,
  typography: PremiumTypography,
  spacing: PremiumSpacing,
  borderRadius: PremiumBorderRadius,
  shadows: PremiumShadows,
  animation: PremiumAnimation,
  layout: PremiumLayout,
  effects: PremiumEffects,
}
