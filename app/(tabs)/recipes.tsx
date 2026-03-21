// SAVR Recipes - Real-time Recipe Hub with Supabase
import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useRecipes } from '../../lib/RecipesContext'
import { useListsUnified } from '../../lib/useListsUnified'
import { usePantry } from '../../lib/PantryContext'
import { useAuth } from '../../lib/AuthContext'
import { debounce, runAsync } from '../../lib/PerformanceOptimizer'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import SageAssistantV2 from '../../components/SageAssistantV2'
import SimpleRecipeImage from '../../components/SimpleRecipeImage'
import { categorizeForShopping } from '../../lib/ItemCategorizer'
import { 
  scaleSize, 
  scaleFont, 
  scaleWidth, 
  scaleHeight, 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

// Filter options
const MEAL_TYPE_FILTERS = [
  { id: 'all', name: 'All', icon: '🍽️' },
  { id: 'breakfast', name: 'Breakfast', icon: '🍳' },
  { id: 'lunch', name: 'Lunch', icon: '🥗' },
  { id: 'dinner', name: 'Dinner', icon: '🍝' },
  { id: 'snack', name: 'Snacks', icon: '🍿' },
  { id: 'dessert', name: 'Desserts', icon: '🍰' }
]

const COOK_NOW_LABEL = 'Cook Now'

export default function RecipesScreen() {
  const { progressiveTheme } = useSimpleTheme()
  const router = useRouter()
  const { lists, addItemToList } = useListsUnified()
  const { items: pantryItems } = usePantry()
  const { user } = useAuth()
  
  const {
    recipes,
    savedRecipes,
    loading,
    error,
    calculateIngredientMatch,
    getMissingIngredients,
    saveRecipe,
    unsaveRecipe,
    toggleFavorite,
    refreshRecipes,
    getSuggestedRecipes,
    getAlmostThereRecipes,
    getFavoriteRecipes,
    getCookedRecipes
  } = useRecipes()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMealType, setSelectedMealType] = useState('all')
  const [cookNowFilter, setCookNowFilter] = useState(false) // Only 100% pantry match
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'favorites' | 'cooked'>('all')

  // DISABLED: PantryBasedRecipeGenerator was creating nonsense recipes
  // Now using only RecipesContext with LocalRecipeGenerator (real recipes only)

  // 🔗 SYNC: Use shared getSuggestedRecipes() to match dashboard order
  // Filter recipes based on search and filters
  const filteredRecipes = useMemo(() => {
    // Get recipes based on current view mode
    let filtered: any[] = []
    
    if (viewMode === 'favorites') {
      // For favorites, extract the recipe objects from SavedRecipe
      const favoriteRecipes = getFavoriteRecipes()
      filtered = favoriteRecipes.map(savedRecipe => savedRecipe.recipe).filter(Boolean)
    } else if (viewMode === 'cooked') {
      // For cooked recipes, extract the recipe objects from SavedRecipe
      const cookedRecipes = getCookedRecipes()
      filtered = cookedRecipes.map(savedRecipe => savedRecipe.recipe).filter(Boolean)
    } else {
      // Default: show all suggested recipes
      filtered = getSuggestedRecipes()
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(recipe =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query) ||
        recipe.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      )
    }

    // Apply meal type filter
    if (selectedMealType !== 'all') {
      filtered = filtered.filter(recipe => recipe.meal_type === selectedMealType)
    }

    // Apply "Cook Now" filter - only recipes with 100% pantry match (no shopping needed)
    if (cookNowFilter) {
      filtered = filtered.filter(recipe => {
        const match = recipe.matchPercentage ?? calculateIngredientMatch(recipe)
        return match >= 100
      })
    }

    // Ensure all recipes are sorted by match percentage (descending)
    // Calculate match percentage if not already present
    const recipesWithMatch = filtered.map(recipe => ({
      ...recipe,
      matchPercentage: recipe.matchPercentage !== undefined 
        ? recipe.matchPercentage 
        : calculateIngredientMatch(recipe)
    }))
    
    // Sort by match percentage descending (highest to lowest)
    const sortedRecipes = [...recipesWithMatch].sort((a, b) => {
      const matchA = a.matchPercentage ?? 0
      const matchB = b.matchPercentage ?? 0
      return matchB - matchA // Descending order
    })

    return sortedRecipes
  }, [recipes, searchQuery, selectedMealType, cookNowFilter, viewMode, getSuggestedRecipes, getFavoriteRecipes, getCookedRecipes, calculateIngredientMatch])

  // "Almost there" recipes - 70-99% match, 1-2 missing ingredients (only in 'all' view, no search)
  const almostThereRecipes = useMemo(() => {
    if (viewMode !== 'all' || searchQuery.trim() || cookNowFilter) return []
    return getAlmostThereRecipes()
  }, [viewMode, searchQuery, cookNowFilter, getAlmostThereRecipes])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshRecipes()
    setRefreshing(false)
  }

  const handleRecipePress = async (recipe: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // Check if this is an AI-generated recipe
    // AI recipes have IDs like: local_*, fallback_*, regenerated_*, ai_gen_*
    const isAIRecipe = recipe.isAIGenerated || 
                       recipe.id?.startsWith('ai_gen_') ||
                       recipe.id?.startsWith('local_') ||
                       recipe.id?.startsWith('fallback_') ||
                       recipe.id?.startsWith('regenerated_')
    
    if (isAIRecipe) {
      // Add pantry status to ingredients before passing to detail screen
      // Use IngredientMatchingService for accurate matching
      const { ingredientMatchingService } = await import('../../lib/IngredientMatchingService')
      
      const recipeWithPantryStatus = {
        ...recipe,
        ingredients: recipe.ingredients?.map((ing: any) => {
          // Check if ingredient is in pantry using smart matching
          let inPantry = false
          if (pantryItems && pantryItems.length > 0) {
            for (const pantryItem of pantryItems) {
              const matchResult = ingredientMatchingService.matchIngredient(ing.name, pantryItem.name)
              if (matchResult.isMatch && matchResult.confidence >= 0.70) {
                inPantry = true
                break
              }
            }
          }
          
          return {
            ...ing,
            inPantry
          }
        }) || []
      }
      
      router.push({
        pathname: '/ai-recipe-detail',
        params: { recipe: JSON.stringify(recipeWithPantryStatus) }
      })
    } else {
      router.push(`/recipe-detail?id=${recipe.id}`)
    }
  }

  const handleSaveRecipe = async (recipeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    const savedRecipe = savedRecipes.find(sr => sr.recipe_id === recipeId)
    const isCurrentlyFavorite = savedRecipe?.is_favorite || false
    
    // First ensure the recipe is saved (if not already)
    if (!savedRecipe) {
      const saveSuccess = await saveRecipe(recipeId)
      if (!saveSuccess) {
        Alert.alert('Error', 'Failed to save recipe')
        return
      }
    }
    
    // Then toggle the favorite status
    const success = await toggleFavorite(recipeId)
    if (success) {
      if (isCurrentlyFavorite) {
        Alert.alert('Removed from Favorites', 'Recipe removed from your favorites')
      } else {
        Alert.alert('Added to Favorites!', 'Recipe added to your favorites')
      }
    } else {
      Alert.alert('Error', 'Failed to update favorite status')
    }
  }

  const handleAddMissingToList = (recipeId: string, recipeTitle: string) => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return

    const missingIngredients = getMissingIngredients(recipe)
    
    if (missingIngredients.length === 0) {
      Alert.alert('All Set!', 'You already have all ingredients for this recipe')
      return
    }

    if (lists.length === 0) {
      Alert.alert('No Lists', 'Create a shopping list first')
      return
    }

    // Add to first list (or show list selector if multiple)
    const targetList = lists[0]
    
    missingIngredients.forEach(ingredient => {
      addItemToList(targetList.id, {
        name: ingredient,
        category: categorizeForShopping(ingredient),
        quantity: '1',
        notes: `For ${recipeTitle}`
      })
    })

    Alert.alert(
      'Added to List!',
      `${missingIngredients.length} missing ingredients added to "${targetList.name}"`,
      [{ text: 'OK' }]
    )
  }

  const getTotalTime = (recipe: any) => {
    return (recipe.prep_time || 0) + (recipe.cook_time || 0)
  }

  const isSaved = (recipeId: string) => {
    const savedRecipe = savedRecipes.find(sr => sr.recipe_id === recipeId)
    return savedRecipe?.is_favorite || false
  }


  // Empty state - check pantry items first
  if (!loading && recipes.length === 0) {
    const pantryItemCount = pantryItems?.length || 0
    
    return (
      <View style={styles.cleanContainer}>
        <ExpoStatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👨‍🍳</Text>
          {pantryItemCount < 10 ? (
            <>
              <Text style={styles.emptyTitle}>Build Your Pantry First</Text>
              <Text style={styles.emptySubtitle}>
                Add at least 10 items to your pantry for personalized recipe recommendations
              </Text>
              <Text style={styles.emptyHint}>
                More pantry items = more diverse and creative recipes!
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No Recipes Found</Text>
              <Text style={styles.emptySubtitle}>
                Add items to your pantry to discover recipes
              </Text>
            </>
          )}
        </View>
        
        <SageAssistantV2 />
      </View>
    )
  }

  // Empty state for favorites or cooked
  if (!loading && (viewMode === 'favorites' || viewMode === 'cooked') && filteredRecipes.length === 0) {
    return (
      <View style={styles.cleanContainer}>
        <ExpoStatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        
        {/* Header with back button */}
        <View style={styles.cleanHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.favoritesHeader}>
              <Pressable 
                style={styles.backButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setViewMode('all')
                  setSearchQuery('') // Clear search when going back
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#6A9571" />
              </Pressable>
              <View style={styles.favoritesHeaderText}>
                <Text style={styles.favoritesTitle}>
                  {viewMode === 'favorites' ? 'Favorite Recipes' : 'Cooking History'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {viewMode === 'favorites' 
                    ? `${getFavoriteRecipes().length} favorite recipes`
                    : `${getCookedRecipes().length} recipes cooked`}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{viewMode === 'favorites' ? '❤️' : '👨‍🍳'}</Text>
          <Text style={styles.emptyTitle}>
            {viewMode === 'favorites' ? 'No Favorite Recipes Yet' : 'No Cooking History Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {viewMode === 'favorites' 
              ? 'Tap the heart icon on any recipe to add it to your favorites'
              : 'Cook a recipe to see it in your cooking history'}
          </Text>
          <Text style={styles.emptyHint}>
            {viewMode === 'favorites'
              ? 'Your favorite recipes will appear here for easy access!'
              : 'Your cooking history helps you rediscover recipes you loved!'}
          </Text>
        </View>
        
        <SageAssistantV2 />
      </View>
    )
  }

  return (
    <View style={styles.cleanContainer}>
      <ExpoStatusBar style="dark" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6A9571"
          />
        }
      >
        {/* Header */}
        <View style={styles.cleanHeader}>
          <View>
            {viewMode === 'favorites' || viewMode === 'cooked' ? (
              <View style={styles.favoritesHeader}>
                <Pressable 
                  style={styles.backButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setViewMode('all')
                    setSearchQuery('') // Clear search when going back
                  }}
                >
                  <Ionicons name="arrow-back" size={24} color="#6A9571" />
                </Pressable>
                <View style={styles.favoritesHeaderText}>
                  <Text style={styles.favoritesTitle}>
                    {viewMode === 'favorites' ? 'Favorite Recipes' : 'Cooking History'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {viewMode === 'favorites' 
                      ? `${getFavoriteRecipes().length} favorite recipes`
                      : `${getCookedRecipes().length} recipes cooked`}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.cleanAppTitle}>SAVR</Text>
                <Text style={styles.headerSubtitle}>
                  {filteredRecipes.length} fresh recipes for you today
                </Text>
              </>
            )}
          </View>
          {viewMode === 'all' && (
            <Pressable 
              style={styles.favoritesToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                // Start with favorites when clicking heart from 'all' mode
                setViewMode('favorites')
                setSearchQuery('') // Clear search when switching views
              }}
            >
              <Ionicons 
                name="heart-outline" 
                size={24} 
                color="#6A9571" 
              />
            </Pressable>
          )}
          {(viewMode === 'favorites' || viewMode === 'cooked') && (
            <Pressable 
              style={styles.favoritesToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                // Toggle between favorites and cooked
                setViewMode(viewMode === 'favorites' ? 'cooked' : 'favorites')
                setSearchQuery('') // Clear search when switching views
              }}
            >
              <Ionicons 
                name={viewMode === 'favorites' ? 'time-outline' : 'heart'} 
                size={24} 
                color="#6A9571" 
              />
            </Pressable>
          )}
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
        
        {/* Meal Type Filter + Cook Now */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
          >
            <View style={styles.filterContainer}>
              {MEAL_TYPE_FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterButton,
                    selectedMealType === filter.id && styles.filterButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedMealType(filter.id)
                  }}
                >
                  <Text style={styles.filterEmoji}>{filter.icon}</Text>
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedMealType === filter.id && styles.filterButtonTextActive
                    ]}
                  >
                    {filter.name}
                  </Text>
                </Pressable>
              ))}
              {viewMode === 'all' && (
                <Pressable
                  style={[
                    styles.filterButton,
                    styles.cookNowButton,
                    cookNowFilter && styles.filterButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setCookNowFilter(prev => !prev)
                  }}
                >
                  <Text style={styles.filterEmoji}>✅</Text>
                  <Text
                    style={[
                      styles.filterButtonText,
                      cookNowFilter && styles.filterButtonTextActive
                    ]}
                  >
                    {COOK_NOW_LABEL}
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
        
        {/* Almost There Section - 1-2 items to unlock */}
        {almostThereRecipes.length > 0 && !loading && !error && (
          <View style={styles.almostThereSection}>
            <Text style={styles.almostThereTitle}>Almost there</Text>
            <Text style={styles.almostThereSubtitle}>Add 1-2 items to unlock these recipes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.almostThereScroll}
              contentContainerStyle={styles.almostThereScrollContent}
            >
              {almostThereRecipes.map((recipe) => {
                const ingredientMatch = recipe.matchPercentage ?? calculateIngredientMatch(recipe)
                const missingCount = getMissingIngredients(recipe).length
                return (
                  <Pressable
                    key={`almost-${recipe.id}`}
                    style={styles.almostThereCard}
                    onPress={() => handleRecipePress(recipe)}
                  >
                    <SimpleRecipeImage
                      recipeTitle={recipe.title}
                      recipeDescription={recipe.description}
                      ingredients={recipe.ingredients?.map((ing: any) => ing.name)}
                      style={styles.almostThereImage}
                    />
                    <View style={styles.almostThereBadge}>
                      <Text style={styles.almostThereBadgeText}>
                        +{missingCount} item{missingCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.almostThereInfo}>
                      <Text style={styles.almostThereRecipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.almostThereMatchText}>{ingredientMatch}% match</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A9571" />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        )}
        
        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Pressable style={styles.retryButton} onPress={refreshRecipes}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}
        
        {/* Recipes Grid */}
        {!loading && !error && (
          <View style={styles.recipesSection}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsEmoji}>👨‍🍳</Text>
                <Text style={styles.noResultsText}>
                  {cookNowFilter ? 'No "Cook Now" recipes yet' : 'No recipes found'}
                </Text>
                <Text style={styles.noResultsSubtext}>
                  {cookNowFilter
                    ? 'Add more pantry items to get 100% match recipes—or try recipes that need 1–2 ingredients'
                    : 'Add items to your pantry to discover recipes'}
                </Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => {
                const ingredientMatch = calculateIngredientMatch(recipe)
                const totalTime = getTotalTime(recipe)
                const saved = isSaved(recipe.id)
                
                // Get cooking history for this recipe if in cooked mode
                const savedRecipe = savedRecipes.find(sr => sr.recipe_id === recipe.id)
                const timesCooked = savedRecipe?.times_cooked || 0
                const lastCooked = savedRecipe?.last_cooked

                return (
                  <Pressable
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => handleRecipePress(recipe)}
                  >
                    <SimpleRecipeImage
                      recipeTitle={recipe.title}
                      recipeDescription={recipe.description}
                      ingredients={recipe.ingredients?.map((ing: any) => ing.name)}
                      style={styles.recipeImage}
                    />
                    
                    {/* Ingredient Match Badge */}
                    <View style={[
                      styles.matchBadge,
                      { backgroundColor: ingredientMatch >= 70 ? '#6A9571' : '#FF9500' }
                    ]}>
                      <Text style={styles.matchBadgeText}>{ingredientMatch}% match</Text>
                    </View>
                    
                    {/* Save Button */}
                    <Pressable
                      style={[styles.saveButton, saved && styles.saveButtonActive]}
                      onPress={(e) => {
                        e.stopPropagation()
                        handleSaveRecipe(recipe.id)
                      }}
                    >
                      <Ionicons 
                        name={saved ? "heart" : "heart-outline"} 
                        size={20} 
                        color={saved ? "#FFFFFF" : "#6A9571"} 
                      />
                    </Pressable>
                    
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      
                      {recipe.description && (
                        <Text style={styles.recipeDescription} numberOfLines={2}>
                          {recipe.description}
                        </Text>
                      )}
                      
                      <View style={styles.recipeMetaRow}>
                        {totalTime > 0 && (
                          <View style={styles.metaBadge}>
                            <Text style={styles.metaText}>⏱️ {totalTime}min</Text>
                          </View>
                        )}
                        
                        {recipe.difficulty && (
                          <View style={styles.metaBadge}>
                            <Text style={styles.metaText}>{recipe.difficulty}</Text>
                          </View>
                        )}
                        
                        {recipe.calories && (
                          <View style={styles.metaBadge}>
                            <Text style={styles.metaText}>{recipe.calories} cal</Text>
                          </View>
                        )}
                      </View>
                      
                      {recipe.protein && (
                        <View style={styles.nutritionRow}>
                          <Text style={styles.nutritionText}>
                            💪 {recipe.protein}g protein  |  🍞 {recipe.carbs}g carbs
                          </Text>
                        </View>
                      )}
                      
                      {/* Cooking History (only show in cooked mode) */}
                      {viewMode === 'cooked' && timesCooked > 0 && (
                        <View style={styles.cookingHistoryRow}>
                          <Text style={styles.cookingHistoryText}>
                            👨‍🍳 Cooked {timesCooked} time{timesCooked !== 1 ? 's' : ''}
                            {lastCooked && (
                              <> • Last: {new Date(lastCooked).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                            )}
                          </Text>
                        </View>
                      )}
                      
                      {ingredientMatch < 100 && (
                        <Pressable
                          style={styles.addIngredientsButton}
                          onPress={(e) => {
                            e.stopPropagation()
                            handleAddMissingToList(recipe.id, recipe.title)
                          }}
                        >
                          <Text style={styles.addIngredientsText}>
                            + Add Missing Ingredients
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                )
              })
            )}
          </View>
        )}
        
        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {/* SAGE Assistant */}
      <SageAssistantV2 />
    </View>
  )
}

const styles = StyleSheet.create({
  cleanContainer: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassmorphicOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  bottomSpacing: {
    height: 130,
  },

  // Header
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 28,
  },
  cleanAppTitle: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  favoritesToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6A9571',
  },
  favoritesToggleActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  favoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  favoritesHeaderText: {
    flex: 1,
  },
  favoritesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },

  // Search
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
  },
  clearIcon: {
    fontSize: 18,
    color: '#8E8E93',
    marginLeft: 8,
  },

  // Filters
  filterSection: {
    marginBottom: 16,
  },
  difficultyFilterSection: {
    marginBottom: 28,
  },
  filterScrollView: {
    paddingHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  cookNowButton: {
    borderColor: 'rgba(106, 149, 113, 0.5)',
  },
  filterEmoji: {
    fontSize: 16,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  filterButtonTextActive: {
    fontWeight: '600',
    color: '#6A9571',
  },
  // Almost There Section
  almostThereSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  almostThereTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  almostThereSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  almostThereScroll: {
    marginHorizontal: -20,
  },
  almostThereScrollContent: {
    paddingHorizontal: 20,
  },
  almostThereCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  almostThereImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F0F0F0',
  },
  almostThereBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  almostThereBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  almostThereInfo: {
    padding: 12,
  },
  almostThereRecipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  almostThereMatchText: {
    fontSize: 12,
    color: '#6A9571',
    fontWeight: '600',
  },
  difficultyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  difficultyButtonActive: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  difficultyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  difficultyButtonTextActive: {
    fontWeight: '600',
    color: '#6A9571',
  },

  // Loading & Error
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6A9571',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyHint: {
    fontSize: 14,
    color: '#6A9571',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Recipes Grid
  recipesSection: {
    paddingHorizontal: responsivePadding.lg,
  },
  recipeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: scaleSize(20),
    marginBottom: responsivePadding.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(10) },
    shadowOpacity: 0.15,
    shadowRadius: scaleSize(20),
    elevation: 12,
    borderWidth: scaleSize(2),
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  recipeImage: {
    width: '100%',
    height: responsiveDims.isSmallScreen ? scaleHeight(160) : scaleHeight(200),
    backgroundColor: '#F0F0F0',
  },
  aiBadge: {
    position: 'absolute',
    top: 12,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  aiBadgeIcon: {
    fontSize: 12,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matchBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  matchBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6A9571',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  recipeInfo: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  recipeDescription: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#6A9571',
    fontWeight: '600',
  },
  nutritionRow: {
    marginTop: 4,
    marginBottom: 12,
  },
  nutritionText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  addIngredientsButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6A9571',
    borderRadius: 12,
    alignItems: 'center',
  },
  addIngredientsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cookingHistoryRow: {
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 8,
  },
  cookingHistoryText: {
    fontSize: 13,
    color: '#6A9571',
    fontWeight: '600',
  },
})
