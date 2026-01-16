import React from 'react'
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getIngredientImage, getCategoryColors, getIngredientIcon } from '../lib/IngredientImageLibrary'

type IngredientHeroImageProps = {
  ingredientName?: string | null
  height?: number
  style?: StyleProp<ViewStyle>
}

export default function IngredientHeroImage({
  ingredientName,
  height = 200,
  style
}: IngredientHeroImageProps) {
  const resolvedName = ingredientName?.trim() || 'Key Ingredient'
  const imageMeta = getIngredientImage(resolvedName)
  const categoryColors = getCategoryColors(imageMeta.category)
  const icon = getIngredientIcon(resolvedName)

  return (
    <LinearGradient
      colors={[categoryColors.primary, categoryColors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { height }, style]}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon} accessibilityRole="image">
          {icon}
        </Text>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  icon: {
    fontSize: 84,
    textAlign: 'center',
  },
})

