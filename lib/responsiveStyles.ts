// Responsive Styles Utility
// Provides consistent styling across different device sizes and densities

import { StyleSheet, Platform } from 'react-native'
import { 
  scaleSize, 
  scaleFont, 
  scaleWidth, 
  scaleHeight, 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  deviceAdjustments,
  getResponsiveDimensions 
} from './responsive'

// Base responsive styles that work across all devices
export const createResponsiveStyles = (styles: Record<string, any>) => {
  return StyleSheet.create(
    Object.keys(styles).reduce((acc: Record<string, any>, key) => {
      const style = styles[key]
      acc[key] = Object.keys(style).reduce((styleAcc: Record<string, any>, prop) => {
        const value = style[prop]
        
        // Scale numeric values based on property type
        if (typeof value === 'number') {
          switch (prop) {
            case 'fontSize':
              styleAcc[prop] = scaleFont(value)
              break
            case 'width':
            case 'minWidth':
            case 'maxWidth':
              styleAcc[prop] = scaleWidth(value)
              break
            case 'height':
            case 'minHeight':
            case 'maxHeight':
              styleAcc[prop] = scaleHeight(value)
              break
            case 'padding':
            case 'paddingTop':
            case 'paddingBottom':
            case 'paddingLeft':
            case 'paddingRight':
            case 'paddingHorizontal':
            case 'paddingVertical':
            case 'margin':
            case 'marginTop':
            case 'marginBottom':
            case 'marginLeft':
            case 'marginRight':
            case 'marginHorizontal':
            case 'marginVertical':
            case 'borderRadius':
            case 'borderWidth':
              styleAcc[prop] = scaleSize(value)
              break
            default:
              styleAcc[prop] = value
          }
        } else {
          styleAcc[prop] = value
        }
        
        return styleAcc
      }, {})
      
      return acc
    }, {})
  )
}

// Common responsive style patterns
export const responsiveStyles = {
  // Container styles
  container: {
    flex: 1,
    paddingHorizontal: responsivePadding.md,
    paddingTop: responsivePadding.lg,
  },
  
  safeContainer: {
    flex: 1,
    paddingHorizontal: responsivePadding.md,
    paddingTop: Platform.OS === 'ios' ? deviceAdjustments.getSafeAreaPadding().top + responsivePadding.md : responsivePadding.lg,
  },
  
  // Card styles
  card: {
    borderRadius: scaleSize(12),
    padding: responsivePadding.md,
    marginVertical: responsiveSpacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  
  // Text styles
  title: {
    fontSize: responsiveFonts.title,
    fontWeight: '700',
    lineHeight: scaleFont(32),
  },
  
  subtitle: {
    fontSize: responsiveFonts.xl,
    fontWeight: '600',
    lineHeight: scaleFont(22),
  },
  
  body: {
    fontSize: responsiveFonts.md,
    lineHeight: scaleFont(20),
  },
  
  caption: {
    fontSize: responsiveFonts.sm,
    lineHeight: scaleFont(16),
  },
  
  // Button styles
  button: {
    paddingVertical: responsivePadding.md,
    paddingHorizontal: responsivePadding.lg,
    borderRadius: scaleSize(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonText: {
    fontSize: responsiveFonts.lg,
    fontWeight: '600',
  },
  
  // Input styles
  input: {
    borderWidth: scaleSize(1),
    borderRadius: scaleSize(8),
    paddingHorizontal: responsivePadding.md,
    paddingVertical: responsivePadding.sm,
    fontSize: responsiveFonts.md,
    minHeight: scaleSize(44), // iOS minimum touch target
  },
  
  // List styles
  listItem: {
    paddingVertical: responsivePadding.md,
    paddingHorizontal: responsivePadding.lg,
    borderBottomWidth: scaleSize(0.5),
  },
  
  // Grid styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  gridItem: {
    width: '48%',
    marginBottom: responsiveSpacing.md,
  },
  
  // Recipe card specific
  recipeCard: {
    borderRadius: scaleSize(16),
    padding: responsivePadding.md,
    marginVertical: responsiveSpacing.sm,
    minHeight: scaleSize(120),
  },
  
  recipeImage: {
    width: '100%',
    height: scaleSize(120),
    borderRadius: scaleSize(12),
  },
  
  recipeTitle: {
    fontSize: responsiveFonts.lg,
    fontWeight: '600',
    marginTop: responsiveSpacing.sm,
    lineHeight: scaleFont(22),
  },
  
  recipeDescription: {
    fontSize: responsiveFonts.sm,
    marginTop: responsiveSpacing.xs,
    lineHeight: scaleFont(18),
    opacity: 0.7,
  },
  
  // Match percentage badge
  matchBadge: {
    position: 'absolute',
    top: responsivePadding.sm,
    right: responsivePadding.sm,
    paddingHorizontal: responsivePadding.sm,
    paddingVertical: responsivePadding.xs,
    borderRadius: scaleSize(12),
    minWidth: scaleSize(40),
    alignItems: 'center',
  },
  
  matchBadgeText: {
    fontSize: responsiveFonts.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  }
}

// Device-specific style adjustments
export const getDeviceSpecificStyles = () => {
  const dims = getResponsiveDimensions()
  
  return {
    // Adjust for small screens
    smallScreen: dims.isSmallScreen ? {
      container: { paddingHorizontal: responsivePadding.sm },
      title: { fontSize: responsiveFonts.xl },
      card: { padding: responsivePadding.sm },
    } : {},
    
    // Adjust for large screens
    largeScreen: dims.isLargeScreen ? {
      container: { paddingHorizontal: responsivePadding.xl },
      card: { padding: responsivePadding.lg },
    } : {},
    
    // Adjust for tablets
    tablet: dims.isTablet ? {
      container: { paddingHorizontal: responsivePadding.xxl },
      gridItem: { width: '31%' }, // 3 columns instead of 2
      recipeCard: { minHeight: scaleSize(150) },
    } : {}
  }
}

// Helper function to combine responsive styles
export const combineResponsiveStyles = (...styleObjects: any[]) => {
  return styleObjects.reduce((acc, styles) => ({ ...acc, ...styles }), {})
}
