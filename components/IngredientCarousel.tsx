import React, { useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getIngredientImage, getCategoryColors, getIngredientIcon } from '../lib/IngredientImageLibrary'

type IngredientCarouselProps = {
  ingredients: Array<{
    name: string
    quantity?: string | number
    unit?: string
    inPantry?: boolean
  }>
  title?: string
  maxItems?: number
}

const CARD_WIDTH = Dimensions.get('window').width * 0.7

export default function IngredientCarousel({ ingredients, title = 'Key Ingredients', maxItems = 4 }: IngredientCarouselProps) {
  const displayIngredients = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return []
    
    const normalizeName = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
    
    const uniqueMap = new Map<string, typeof ingredients[0]>()
    ingredients.forEach(ing => {
      if (!ing?.name) return
      const key = normalizeName(ing.name)
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ing)
      }
    })
    
    const uniqueIngredients = Array.from(uniqueMap.values())
    
    // Prioritize ingredients the user has, then by original order
    uniqueIngredients.sort((a, b) => {
      if (a.inPantry === b.inPantry) return 0
      return a.inPantry ? -1 : 1
    })
    
    return uniqueIngredients.slice(0, maxItems)
  }, [ingredients, maxItems])
  
  if (displayIngredients.length === 0) {
    return null
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <FlatList
        data={displayIngredients}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.name}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const imageData = getIngredientImage(item.name)
          const categoryColors = getCategoryColors(imageData.category)
          const icon = getIngredientIcon(item.name)
          const quantityText = item.quantity
            ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`.trim()
            : ''
          
          return (
            <View style={styles.card}>
              {/* Clean placeholder image with gradient background */}
              <View style={styles.imageContainer}>
                <LinearGradient
                  colors={[categoryColors.primary, categoryColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imageGradient}
                >
                  <Text style={styles.ingredientIcon}>{icon}</Text>
                </LinearGradient>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, item.inPantry ? styles.badgeInPantry : styles.badgeMissing]}>
                    <Text style={styles.badgeText}>
                      {item.inPantry ? 'In pantry' : 'Need to buy'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ingredientName} numberOfLines={1}>
                  {item.name}
                </Text>
                {quantityText.length > 0 && (
                  <Text style={styles.ingredientQuantity}>{quantityText}</Text>
                )}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 4,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F2F2F7',
  },
  imageGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientIcon: {
    fontSize: 80,
    textAlign: 'center',
  },
  cardContent: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeInPantry: {
    backgroundColor: 'rgba(81, 207, 102, 0.12)',
  },
  badgeMissing: {
    backgroundColor: 'rgba(255, 167, 38, 0.12)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  ingredientQuantity: {
    marginTop: 4,
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
})


