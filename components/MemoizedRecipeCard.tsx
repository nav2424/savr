// Memoized Recipe Card Component - Prevents unnecessary re-renders with robust image handling
import React, { memo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import SimpleRecipeImage from './SimpleRecipeImage'

interface MemoizedRecipeCardProps {
  recipe: any
  onPress: (recipe: any) => void
  showMatchPercentage?: boolean
}

// Memoized to prevent re-renders when props don't change
const MemoizedRecipeCard = memo(({ recipe, onPress, showMatchPercentage = true }: MemoizedRecipeCardProps) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress(recipe)
  }

  // Use image_url from database or fallback to intelligent category matching
  const imageUrl = recipe.image_url || recipe.image

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
    >
      <View style={styles.imageContainer}>
        <SimpleRecipeImage
          recipeTitle={recipe.title}
          uri={imageUrl}
          style={styles.image}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.description && (
          <Text style={styles.description} numberOfLines={2}>
            {recipe.description}
          </Text>
        )}
        {showMatchPercentage && recipe.matchPercentage !== undefined && (
          <View style={styles.matchContainer}>
            <View style={[styles.matchBadge, { 
              backgroundColor: recipe.matchPercentage >= 80 ? '#4CAF50' : 
                              recipe.matchPercentage >= 60 ? '#FF9800' : '#757575' 
            }]}>
              <Text style={styles.matchText}>{recipe.matchPercentage}% Match</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these change
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.recipe.title === nextProps.recipe.title &&
    prevProps.recipe.image_url === nextProps.recipe.image_url &&
    prevProps.recipe.matchPercentage === nextProps.recipe.matchPercentage &&
    prevProps.showMatchPercentage === nextProps.showMatchPercentage
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  matchBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
})

export default MemoizedRecipeCard

