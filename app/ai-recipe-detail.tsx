// SAVR AI Generated Recipe Detail Screen
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useListsUnified } from '../lib/useListsUnified'
import { groceryStandardizer } from '../lib/GroceryStandardizer'
import { shareService } from '../lib/ShareService'
import IngredientSubstitutionModal from '../components/IngredientSubstitutionModal'
import { formatIngredientDisplay } from '../lib/IngredientFormatter'
import { categorizeForShopping } from '../lib/ItemCategorizer'
import { usePantry } from '../lib/PantryContext'
import { ingredientMatchingService } from '../lib/IngredientMatchingService'
import { nutritionCalculatorService } from '../lib/NutritionCalculatorService'
import { useMemo } from 'react'
import IngredientCarousel from '../components/IngredientCarousel'

export default function AIRecipeDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { lists, addItemToList } = useListsUnified()
  const { items: pantryItems } = usePantry()
  
  // Parse the recipe data from query params
  const recipe = params.recipe ? JSON.parse(params.recipe as string) : null
  
  // State for list selector modal
  const [showListSelector, setShowListSelector] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null)
  
  // State for ingredient substitution
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [ingredientToSubstitute, setIngredientToSubstitute] = useState<any>(null)
  const [substitutedIngredients, setSubstitutedIngredients] = useState<Record<string, string>>({})
  
  // State for servings adjustment - initialize from recipe
  const [servings, setServings] = useState(() => {
    if (recipe?.servings) return recipe.servings
    return 2
  })
  
  // Update servings when recipe changes
  React.useEffect(() => {
    if (recipe?.servings) {
      setServings(recipe.servings)
    }
  }, [recipe?.servings])

  // Calculate accurate nutrition based on ingredients
  const nutrition = useMemo(() => {
    if (!recipe?.ingredients || recipe.ingredients.length === 0) {
      return null
    }
    
    const ingredients = recipe.ingredients.map((ing: any) => ({
      name: typeof ing === 'string' ? ing : ing.name,
      quantity: typeof ing === 'string' ? 1 : (ing.quantity || 1),
      unit: typeof ing === 'string' ? '' : (ing.unit || '')
    }))
    
    return nutritionCalculatorService.calculateRecipeNutrition(ingredients, servings)
  }, [recipe?.ingredients, servings])
  
  // Deduplicate ingredients by name - merge similar ones like "sea salt" and "salt"
  const deduplicatedIngredients = React.useMemo(() => {
    if (!recipe?.ingredients) return []
    
    const getDedupeKey = (name: string): string => {
      if (!name || typeof name !== 'string') return ''
      let key = name.toLowerCase()
        .trim()
        .replace(/sea\s+/g, '')
        .replace(/table\s+/g, '')
        .replace(/ground\s+/g, '')
        .replace(/freshly\s+/g, '')
        .replace(/black\s+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Normalize salt variants: "sea salt", "table salt", "salt" all become "salt"
      if (key === 'salt' || key === 'sea salt' || key === 'table salt') {
        key = 'salt'
      }
      
      return key
    }
    
    const isToTaste = (qty: any, unit: any): boolean => {
      if (!qty) return true
      const qtyStr = String(qty)
      return qtyStr === 'to taste' || 
             qtyStr.toLowerCase().includes('to taste') ||
             !unit || unit === '' || String(unit).trim() === ''
    }
    
    const seen = new Map<string, any>()
    recipe.ingredients.forEach((ing: any) => {
      const key = getDedupeKey(ing.name)
      if (!seen.has(key)) {
        seen.set(key, { ...ing })
      } else {
        // ALWAYS merge duplicates - keep the more descriptive name
        const existing = seen.get(key)!
        
        // Prefer names with "sea" over plain names
        const ingNameLower = String(ing.name).toLowerCase()
        const existingNameLower = String(existing.name).toLowerCase()
        
        if (ingNameLower.includes('sea') && !existingNameLower.includes('sea')) {
          existing.name = ing.name
        }
        
        // Handle quantity merging
        if (isToTaste(existing.quantity, existing.unit) || isToTaste(ing.quantity, ing.unit)) {
          // If either is "to taste", result is "to taste"
          existing.quantity = 'to taste'
          existing.unit = ''
        } else if (existing.unit === ing.unit && existing.unit !== '' && ing.unit !== '') {
          // Same unit - merge quantities
          const existingQty = parseFloat(String(existing.quantity)) || 0
          const newQty = parseFloat(String(ing.quantity)) || 0
          existing.quantity = (existingQty + newQty).toString()
        }
        // If different units, keep existing (first one wins for quantity/unit, but name was updated above)
      }
    })
    
    return Array.from(seen.values())
  }, [recipe?.ingredients])
  
  // Adjust ingredient quantities based on servings and ensure inPantry status is accurate
  const adjustedIngredients = React.useMemo(() => {
    const baseServings = recipe?.servings || 2
    const ratio = servings / baseServings
    
    return deduplicatedIngredients.map((ing: any) => {
      const baseQty = parseFloat(ing.quantity) || 1
      const adjustedQty = baseQty * ratio
      
      // Format quantity based on unit type
      let formattedQty = adjustedQty.toString()
      if (ing.unit === 'pieces' || ing.unit === 'eggs' || ing.unit === 'potatoes' || 
          ing.unit === 'onions' || ing.unit === 'tomatoes' || ing.unit === 'cloves') {
        formattedQty = Math.ceil(adjustedQty).toString()
      } else if (adjustedQty < 1) {
        // Convert to fraction for small amounts
        if (adjustedQty >= 0.75) formattedQty = '3/4'
        else if (adjustedQty >= 0.67) formattedQty = '2/3'
        else if (adjustedQty >= 0.5) formattedQty = '1/2'
        else if (adjustedQty >= 0.33) formattedQty = '1/3'
        else if (adjustedQty >= 0.25) formattedQty = '1/4'
        else formattedQty = adjustedQty.toFixed(2)
      } else if (adjustedQty !== Math.floor(adjustedQty)) {
        formattedQty = adjustedQty.toFixed(1)
      }
      
      // Ensure inPantry status is accurate using proper ingredient matching
      // If inPantry is not set or pantry items changed, recalculate it
      let inPantry = ing.inPantry
      const normalizedName = ing.name.toLowerCase().trim()
      
      // CRITICAL: Core household staples - everyone has these, never show in "Ingredients to Buy"
      // Salt
      if (normalizedName.includes('salt') && !normalizedName.includes('sauce')) {
        inPantry = true
      }
      // Black pepper (not bell pepper)
      else if ((normalizedName === 'pepper' || normalizedName === 'black pepper' || normalizedName.includes('black pepper') || normalizedName.includes('peppercorn')) &&
               !normalizedName.includes('bell') && !normalizedName.includes('red pepper') && !normalizedName.includes('chili pepper')) {
        inPantry = true
      }
      // Cooking oils
      else if (normalizedName.includes('oil') && (normalizedName.includes('olive') || normalizedName.includes('vegetable') || normalizedName.includes('canola') || normalizedName.includes('avocado'))) {
        inPantry = true
      }
      // Butter
      else if (normalizedName.includes('butter')) {
        inPantry = true
      }
      // Water (CRITICAL: Everyone has water)
      else if (normalizedName === 'water' || normalizedName.includes(' water') || normalizedName.includes('water ')) {
        inPantry = true
      }
      // Sugar
      else if (normalizedName.includes('sugar') && (normalizedName.includes('white') || normalizedName.includes('brown') || normalizedName.includes('granulated') || normalizedName === 'sugar')) {
        inPantry = true
      }
      // Flour
      else if (normalizedName.includes('flour') && (normalizedName.includes('all-purpose') || normalizedName.includes('plain') || normalizedName === 'flour')) {
        inPantry = true
      }
      // Check pantry items if not a core staple
      else if (pantryItems && pantryItems.length > 0) {
        // Recalculate using the same matching service as match percentage
        for (const pantryItem of pantryItems) {
          const matchResult = ingredientMatchingService.matchIngredient(ing.name, pantryItem.name)
          if (matchResult.isMatch && matchResult.confidence >= 0.70) {
            inPantry = true
            break
          }
        }
        // If no match found and inPantry was true, set it to false
        if (inPantry === undefined || inPantry === null) {
          inPantry = false
        }
      } else {
        inPantry = false
      }
      
      return {
        ...ing,
        quantity: formattedQty,
        inPantry
      }
    })
  }, [deduplicatedIngredients, servings, recipe?.servings, pantryItems])

  const handleAddToList = async (ingredient: any, listId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      // INTELLIGENT: Standardize ingredient to shopping format
      // e.g., "0.5 cups sour cream" → "1 container Sour cream"
      const standardized = groceryStandardizer.standardizeForShopping(
        ingredient.name,
        ingredient.quantity,
        ingredient.unit,
        recipe.title
      )
      
      await addItemToList(listId, {
        name: standardized.displayName,
        quantity: standardized.quantity,
        category: standardized.category, // Use category from standardizer
        notes: standardized.notes
      })

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Added to List',
        `${standardized.displayName} (${standardized.quantity} ${standardized.unit}) added to your grocery list!`,
        [{ text: 'OK' }]
      )
      
      setShowListSelector(false)
      setSelectedIngredient(null)
    } catch (error) {
      console.error('Error adding to list:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCartPress = (ingredient: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedIngredient(ingredient)
    setShowListSelector(true)
  }

  const handleSubstitutePress = (ingredient: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIngredientToSubstitute(ingredient)
    setShowSubstitutionModal(true)
  }

  const handleSubstitute = (original: string, substitute: string, amount: string) => {
    setSubstitutedIngredients(prev => ({
      ...prev,
      [original]: substitute
    }))
    setShowSubstitutionModal(false)
    setIngredientToSubstitute(null)
  }


  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Recipe not found</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAF9', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </Pressable>
          <Text style={styles.headerTitle}>Recipe</Text>
          <Pressable
            style={styles.shareButton}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              await shareService.shareRecipe({
                id: recipe.id,
                title: recipe.title,
                image_url: recipe.image_url,
                matchPercentage: recipe.matchPercentage,
                cookTime: recipe.cook_time,
                servings: recipe.servings
              })
            }}
          >
            <Ionicons name="share-outline" size={24} color="#6A9571" />
          </Pressable>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Ingredient Carousel */}
          <View style={styles.carouselSection}>
            <IngredientCarousel
              ingredients={adjustedIngredients.map((ing: any) => ({
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                inPantry: ing.inPantry
              }))}
              title="Ingredient Spotlight"
            />

            {/* Match Badge */}
            <View style={styles.matchBadge}>
              <View style={[styles.matchDot, { 
                backgroundColor: (recipe.matchPercentage || 0) >= 80 ? '#51CF66' : 
                               (recipe.matchPercentage || 0) >= 50 ? '#FFA726' : '#FF6B6B' 
              }]} />
              <Text style={styles.matchText}>{recipe.matchPercentage || 0}% match</Text>
            </View>
          </View>

          {/* Recipe Info */}
          <View style={styles.infoSection}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <Text style={styles.recipeDescription}>{recipe.description}</Text>

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={20} color="#6A9571" />
                <Text style={styles.statText}>{(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="restaurant-outline" size={20} color="#6A9571" />
                <View style={styles.servingsAdjuster}>
                  <Pressable
                    style={styles.servingsButton}
                    onPress={() => {
                      if (servings > 1) {
                        setServings(servings - 1)
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      }
                    }}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color="#6A9571" />
                  </Pressable>
                  <Text style={styles.statText}>{servings} servings</Text>
                  <Pressable
                    style={styles.servingsButton}
                    onPress={() => {
                      setServings(servings + 1)
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#6A9571" />
                  </Pressable>
                </View>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="speedometer-outline" size={20} color="#6A9571" />
                <Text style={styles.statText}>{recipe.difficulty || 'Easy'}</Text>
              </View>
            </View>
          </View>

          {/* Nutritional Information */}
          {nutrition && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutritional Information</Text>
              <Text style={styles.nutritionSubtitle}>Per serving ({servings} {servings === 1 ? 'serving' : 'servings'})</Text>
              <View style={styles.nutritionGrid}>
                {nutrition.calories > 0 && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{nutrition.calories}</Text>
                    <Text style={styles.nutritionLabel}>Calories</Text>
                  </View>
                )}
                {nutrition.protein > 0 && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{nutrition.protein}g</Text>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                  </View>
                )}
                {nutrition.carbs > 0 && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{nutrition.carbs}g</Text>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                  </View>
                )}
                {nutrition.fat > 0 && (
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{nutrition.fat}g</Text>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                  </View>
                )}
              </View>
              {(nutrition.fiber || nutrition.sodium || nutrition.sugar) && (
                <View style={styles.nutritionDetails}>
                  {nutrition.fiber && nutrition.fiber > 0 && (
                    <Text style={styles.nutritionDetailText}>
                      Fiber: {nutrition.fiber}g
                    </Text>
                  )}
                  {nutrition.sodium && nutrition.sodium > 0 && (
                    <Text style={styles.nutritionDetailText}>
                      Sodium: {Math.round(nutrition.sodium)}mg
                    </Text>
                  )}
                  {nutrition.sugar && nutrition.sugar > 0 && (
                    <Text style={styles.nutritionDetailText}>
                      Sugar: {nutrition.sugar}g
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Ingredients - Available */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients You Have</Text>
              <View style={styles.availableBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#51CF66" />
                <Text style={styles.availableBadgeText}>
                  {adjustedIngredients.filter((ing: any) => ing.inPantry).length || 0} items
                </Text>
              </View>
            </View>
            {adjustedIngredients
              .filter((ing: any) => ing.inPantry)
              .map((ingredient: any, index: number) => (
                <View key={index} style={styles.ingredientItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#51CF66" />
                  <Text style={styles.ingredientTextAvailable}>
                    {formatIngredientDisplay(ingredient.quantity, ingredient.unit, ingredient.name)}
                  </Text>
                </View>
              ))}
          </View>

          {/* Ingredients - Missing */}
          {adjustedIngredients.filter((ing: any) => !ing.inPantry).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients to Buy</Text>
                <View style={styles.missingBadge}>
                  <Ionicons name="cart-outline" size={16} color="#FFA726" />
                  <Text style={styles.missingBadgeText}>
                    {adjustedIngredients.filter((ing: any) => !ing.inPantry).length || 0} items
                  </Text>
                </View>
              </View>
              {adjustedIngredients
                .filter((ing: any) => !ing.inPantry)
                .map((ingredient: any, index: number) => {
                  const isSubstituted = substitutedIngredients[ingredient.name]
                  const displayName = isSubstituted || ingredient.name
                  
                  // For "Ingredients to Buy", use store/purchasable quantities (not recipe quantities)
                  // e.g., "1 tbsp olive oil" → "1 bottle olive oil"
                  const standardized = groceryStandardizer.standardizeForShopping(
                    displayName,
                    ingredient.quantity,
                    ingredient.unit,
                    recipe.title
                  )
                  
                  // Format using store quantity and unit (forShopping=true to never show "to taste")
                  const formattedDisplay = formatIngredientDisplay(
                    standardized.quantity,
                    standardized.unit,
                    standardized.displayName,
                    true // forShopping - always show store quantities, never "to taste"
                  )
                  
                  return (
                    <View key={index} style={styles.ingredientItemWithCart}>
                      <View style={styles.ingredientItemLeft}>
                        <Ionicons name="cart-outline" size={18} color="#FFA726" />
                        <View style={styles.ingredientTextContainer}>
                          <Text style={styles.ingredientTextMissing}>
                            {formattedDisplay}
                          </Text>
                          {isSubstituted && (
                            <Text style={styles.originalIngredient}>
                              Originally: {ingredient.name}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.ingredientActions}>
                        <Pressable
                          style={styles.substituteButton}
                          onPress={() => handleSubstitutePress(ingredient)}
                        >
                          <Ionicons name="swap-horizontal" size={20} color="#6A9571" />
                        </Pressable>
                        <Pressable
                          style={styles.addToListButton}
                          onPress={() => handleCartPress(ingredient)}
                        >
                          <Ionicons name="add-circle" size={24} color="#6A9571" />
                        </Pressable>
                      </View>
                    </View>
                  )
                })}
            </View>
          )}

          {/* Cook Now Button - Instructions are only shown when cooking starts */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.cookNowButton}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  
                  // Navigate to cooking flashcard screen with recipe data
                  router.push({
                    pathname: '/cooking-flashcards-simple',
                    params: {
                      recipe: JSON.stringify({
                        ...recipe,
                        servings, // Use adjusted servings
                        ingredients: adjustedIngredients // Use adjusted ingredients
                      })
                    }
                  })
                }}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cookNowGradient}
                >
                  <Ionicons name="play-circle" size={28} color="#FFFFFF" />
                  <Text style={styles.cookNowText}>Cook Now</Text>
                  <Text style={styles.cookNowSubtext}>
                    View step-by-step instructions
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* Generated From Info */}
          <View style={styles.generatedInfo}>
            <Ionicons name="information-circle-outline" size={20} color="#6A9571" />
            <Text style={styles.generatedInfoText}>
              This recipe was generated based on items in your pantry: {recipe.generatedFrom?.join(', ') || 'your available ingredients'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* List Selector Modal */}
        <Modal
          visible={showListSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowListSelector(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to List</Text>
              <Pressable onPress={() => setShowListSelector(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </Pressable>
            </View>
            
            {selectedIngredient && (
              <View style={styles.selectedIngredientInfo}>
                <Text style={styles.selectedIngredientText}>
                  {formatIngredientDisplay(selectedIngredient.quantity, selectedIngredient.unit, selectedIngredient.name)}
                </Text>
              </View>
            )}

            <ScrollView style={styles.listSelector}>
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  style={styles.listItem}
                  onPress={() => handleAddToList(selectedIngredient, list.id)}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemIcon}>{list.icon || '📝'}</Text>
                    <View>
                      <Text style={styles.listItemName}>{list.name}</Text>
                      <Text style={styles.listItemCount}>
                        {list.items?.length || 0} items
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </Pressable>
              ))}
              
              {lists.length === 0 && (
                <View style={styles.noListsContainer}>
                  <Text style={styles.noListsText}>No grocery lists yet</Text>
                  <Text style={styles.noListsSubtext}>Create a list in the Lists tab first</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Ingredient Substitution Modal */}
        <IngredientSubstitutionModal
          visible={showSubstitutionModal}
          onClose={() => {
            setShowSubstitutionModal(false)
            setIngredientToSubstitute(null)
          }}
          ingredient={ingredientToSubstitute || { name: '', amount: '', unit: '' }}
          onSubstitute={handleSubstitute}
        />
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
  },
  carouselSection: {
    position: 'relative',
    paddingBottom: 8,
  },
  aiBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  aiBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  matchBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  matchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  recipeDescription: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  section: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  nutritionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  nutritionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  nutritionDetailText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(81, 207, 102, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  availableBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#51CF66',
  },
  missingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  missingBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFA726',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  ingredientTextAvailable: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  ingredientTextMissing: {
    fontSize: 16,
    color: '#666666',
  },
  ingredientItemWithCart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ingredientItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  addToListButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientTextContainer: {
    flex: 1,
  },
  originalIngredient: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  ingredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  substituteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  selectedIngredientInfo: {
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
  },
  selectedIngredientText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
    textAlign: 'center',
  },
  listSelector: {
    flex: 1,
    padding: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listItemIcon: {
    fontSize: 28,
  },
  listItemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  listItemCount: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  noListsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noListsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  noListsSubtext: {
    fontSize: 14,
    color: '#999999',
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
  },
  generatedInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  generatedInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#6A9571',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 100,
  },
  servingsAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  servingsButton: {
    padding: 4,
  },
  cookNowButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cookNowGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cookNowText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cookNowSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
})

