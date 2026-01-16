// Recipe Detail Screen
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Image,
  Animated,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSimpleTheme } from '../lib/SimpleThemeContext'
import { usePantry } from '../lib/PantryContext'
import { useListsUnified } from '../lib/useListsUnified'
import { useRecipes } from '../lib/RecipesContext'
import { Recipe } from '../lib/supabase'
import IngredientSubstitutionModal from '../components/IngredientSubstitutionModal'
import { formatIngredientDisplay } from '../lib/IngredientFormatter'
import { categorizeForShopping } from '../lib/ItemCategorizer'
import { groceryStandardizer } from '../lib/GroceryStandardizer'
import { ingredientMatchingService } from '../lib/IngredientMatchingService'
import IngredientCarousel from '../components/IngredientCarousel'

const { width } = Dimensions.get('window')

// OLD HARDCODED DATA - KEEPING FOR FALLBACK ONLY
const RECIPE_DATA_OLD = {
  'chicken stir-fry': {
    id: 'chicken-stir-fry',
    title: 'Chicken Stir-Fry',
    description: 'A quick and healthy chicken stir-fry loaded with fresh vegetables and aromatic spices. Perfect for a weeknight dinner that comes together in just 15 minutes.',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    difficulty: 'Easy',
    macros: {
      calories: 320,
      protein: 28,
      carbs: 18,
      fat: 16,
      fiber: 4,
      sugar: 8
    },
    ingredients: [
      { name: 'Chicken breast', amount: '500g', unit: 'grams', has: true },
      { name: 'Bell peppers', amount: '2', unit: 'pieces', has: false },
      { name: 'Broccoli', amount: '200g', unit: 'grams', has: true },
      { name: 'Soy sauce', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Garlic', amount: '3 cloves', unit: 'cloves', has: false },
      { name: 'Ginger', amount: '1 inch', unit: 'inch', has: false },
      { name: 'Vegetable oil', amount: '2 tbsp', unit: 'tablespoons', has: true },
      { name: 'Rice', amount: '2 cups', unit: 'cups', has: true }
    ],
    instructions: [
      'Cut chicken breast into thin strips and season with salt and pepper',
      'Heat vegetable oil in a large wok or pan over high heat',
      'Add chicken and cook for 4-5 minutes until golden brown',
      'Add minced garlic and ginger, stir for 30 seconds',
      'Add bell peppers and broccoli, stir-fry for 3-4 minutes',
      'Pour in soy sauce and toss everything together',
      'Serve hot over cooked rice'
    ]
  },
  'chickpea salad': {
    id: 'chickpea-salad',
    title: 'Chickpea Salad',
    description: 'A refreshing and protein-packed chickpea salad with fresh vegetables and a tangy lemon dressing. Great for meal prep and perfect for lunch.',
    prepTime: '15 min',
    cookTime: '0 min',
    servings: 3,
    difficulty: 'Easy',
    macros: {
      calories: 280,
      protein: 15,
      carbs: 35,
      fat: 8,
      fiber: 12,
      sugar: 6
    },
    ingredients: [
      { name: 'Chickpeas', amount: '400g', unit: 'grams', has: true },
      { name: 'Cucumber', amount: '1', unit: 'piece', has: false },
      { name: 'Tomatoes', amount: '2', unit: 'pieces', has: true },
      { name: 'Red onion', amount: '1/2', unit: 'piece', has: false },
      { name: 'Parsley', amount: '1/4 cup', unit: 'cup', has: true },
      { name: 'Lemon', amount: '1', unit: 'piece', has: true },
      { name: 'Olive oil', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Salt & pepper', amount: 'to taste', unit: '', has: true }
    ],
    instructions: [
      'Drain and rinse chickpeas thoroughly',
      'Dice cucumber and tomatoes into small pieces',
      'Finely chop red onion and parsley',
      'Combine all vegetables in a large bowl',
      'Add chickpeas and mix gently',
      'Whisk together lemon juice, olive oil, salt and pepper',
      'Pour dressing over salad and toss to combine',
      'Chill in refrigerator for 30 minutes before serving'
    ]
  },
  'beef tacos': {
    id: 'beef-tacos',
    title: 'Beef Tacos',
    description: 'Juicy and flavorful beef tacos with fresh toppings and homemade seasoning. A crowd-pleasing dish that\'s perfect for taco night.',
    prepTime: '20 min',
    cookTime: '15 min',
    servings: 6,
    difficulty: 'Medium',
    macros: {
      calories: 380,
      protein: 22,
      carbs: 28,
      fat: 20,
      fiber: 5,
      sugar: 4
    },
    ingredients: [
      { name: 'Ground beef', amount: '500g', unit: 'grams', has: false },
      { name: 'Taco shells', amount: '12', unit: 'pieces', has: true },
      { name: 'Lettuce', amount: '1 head', unit: 'head', has: false },
      { name: 'Tomatoes', amount: '3', unit: 'pieces', has: true },
      { name: 'Cheese', amount: '200g', unit: 'grams', has: true },
      { name: 'Onion', amount: '1', unit: 'piece', has: true },
      { name: 'Taco seasoning', amount: '1 packet', unit: 'packet', has: false },
      { name: 'Sour cream', amount: '1/2 cup', unit: 'cup', has: true }
    ],
    instructions: [
      'Brown ground beef in a large skillet over medium-high heat',
      'Add taco seasoning and follow package instructions',
      'Warm taco shells in the oven or microwave',
      'Shred lettuce and dice tomatoes',
      'Grate cheese and dice onion',
      'Fill each taco shell with seasoned beef',
      'Top with lettuce, tomatoes, cheese, and onion',
      'Add sour cream and serve immediately'
    ]
  },
  'tomato basil pasta': {
    id: 'tomato-basil-pasta',
    title: 'Tomato Basil Pasta',
    description: 'A classic Italian pasta dish with fresh tomatoes, aromatic basil, and creamy mozzarella. Simple ingredients create an unforgettable flavor.',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    difficulty: 'Easy',
    macros: {
      calories: 420,
      protein: 16,
      carbs: 65,
      fat: 12,
      fiber: 4,
      sugar: 8
    },
    ingredients: [
      { name: 'Pasta', amount: '400g', unit: 'grams', has: true },
      { name: 'Cherry tomatoes', amount: '300g', unit: 'grams', has: false },
      { name: 'Fresh basil', amount: '1/2 cup', unit: 'cup', has: false },
      { name: 'Mozzarella', amount: '200g', unit: 'grams', has: true },
      { name: 'Garlic', amount: '4 cloves', unit: 'cloves', has: false },
      { name: 'Olive oil', amount: '1/4 cup', unit: 'cup', has: true },
      { name: 'Parmesan', amount: '100g', unit: 'grams', has: true },
      { name: 'Salt & pepper', amount: 'to taste', unit: '', has: true }
    ],
    instructions: [
      'Cook pasta according to package directions until al dente',
      'Halve cherry tomatoes and set aside',
      'Heat olive oil in a large pan over medium heat',
      'Add minced garlic and cook until fragrant',
      'Add cherry tomatoes and cook until they start to soften',
      'Tear fresh basil leaves and add to the pan',
      'Drain pasta and add to the pan with tomatoes',
      'Add mozzarella and parmesan, toss to combine',
      'Season with salt and pepper, serve immediately'
    ]
  },
  'pasta primavera': {
    id: 'pasta-primavera',
    title: 'Pasta Primavera',
    description: 'A colorful spring pasta loaded with fresh vegetables and light olive oil. Simple, healthy, and delicious.',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    difficulty: 'Easy',
    macros: {
      calories: 320,
      protein: 8,
      carbs: 28,
      fat: 18,
      fiber: 4,
      sugar: 6
    },
    ingredients: [
      { name: 'Pasta', amount: '400g', unit: 'grams', has: true },
      { name: 'Cherry tomatoes', amount: '250g', unit: 'grams', has: true },
      { name: 'Zucchini', amount: '1', unit: 'piece', has: false },
      { name: 'Bell pepper', amount: '1', unit: 'piece', has: false },
      { name: 'Garlic', amount: '3 cloves', unit: 'cloves', has: true },
      { name: 'Olive oil', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Parmesan cheese', amount: '50g', unit: 'grams', has: true },
      { name: 'Fresh basil', amount: '1 bunch', unit: 'bunch', has: false }
    ],
    instructions: [
      'Bring salted water to boil and cook pasta according to package directions',
      'Chop all vegetables into bite-sized pieces',
      'Heat olive oil in large pan over medium heat',
      'Sauté garlic for 30 seconds until fragrant',
      'Add harder vegetables first (zucchini, bell pepper), cook 3-4 minutes',
      'Add cherry tomatoes and cook until they start to burst',
      'Drain pasta and add to vegetable pan',
      'Toss everything together, top with fresh basil and parmesan'
    ]
  },
  'avocado toast': {
    id: 'avocado-toast',
    title: 'Avocado Toast',
    description: 'Creamy avocado on crispy toasted bread with a perfect poached egg. A nutritious and Instagram-worthy breakfast.',
    prepTime: '5 min',
    cookTime: '5 min',
    servings: 2,
    difficulty: 'Easy',
    macros: {
      calories: 320,
      protein: 12,
      carbs: 24,
      fat: 20,
      fiber: 8,
      sugar: 2
    },
    ingredients: [
      { name: 'Bread', amount: '2 slices', unit: 'slices', has: true },
      { name: 'Avocado', amount: '1', unit: 'piece', has: true },
      { name: 'Eggs', amount: '2', unit: 'pieces', has: true },
      { name: 'Lemon', amount: '1/2', unit: 'piece', has: true },
      { name: 'Red pepper flakes', amount: '1 pinch', unit: 'pinch', has: true },
      { name: 'Salt & pepper', amount: 'to taste', unit: '', has: true }
    ],
    instructions: [
      'Toast bread slices until golden and crispy',
      'Mash avocado with lemon juice, salt, and pepper',
      'Bring water to gentle simmer for poached eggs',
      'Crack eggs into water and poach for 3-4 minutes',
      'Spread mashed avocado generously on toast',
      'Top with poached egg',
      'Sprinkle with red pepper flakes and extra salt'
    ]
  },
  'vegetable stir-fry': {
    id: 'vegetable-stir-fry',
    title: 'Vegetable Stir-Fry',
    description: 'A vibrant mix of crisp vegetables in a savory sauce. Quick, healthy, and packed with nutrients.',
    prepTime: '10 min',
    cookTime: '10 min',
    servings: 3,
    difficulty: 'Easy',
    macros: {
      calories: 280,
      protein: 6,
      carbs: 32,
      fat: 14,
      fiber: 6,
      sugar: 8
    },
    ingredients: [
      { name: 'Broccoli', amount: '200g', unit: 'grams', has: true },
      { name: 'Carrots', amount: '2', unit: 'pieces', has: true },
      { name: 'Snap peas', amount: '150g', unit: 'grams', has: false },
      { name: 'Bell peppers', amount: '2', unit: 'pieces', has: false },
      { name: 'Garlic', amount: '3 cloves', unit: 'cloves', has: true },
      { name: 'Ginger', amount: '1 inch', unit: 'inch', has: true },
      { name: 'Soy sauce', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Sesame oil', amount: '1 tbsp', unit: 'tablespoon', has: true }
    ],
    instructions: [
      'Cut all vegetables into similar-sized pieces',
      'Heat sesame oil in wok over high heat',
      'Add garlic and ginger, stir for 30 seconds',
      'Add harder vegetables first (carrots, broccoli)',
      'Stir-fry for 3-4 minutes',
      'Add softer vegetables (peppers, snap peas)',
      'Cook for 2 more minutes',
      'Add soy sauce and toss to coat',
      'Serve immediately over rice or noodles'
    ]
  },
  'quinoa salad': {
    id: 'quinoa-salad',
    title: 'Quinoa Salad',
    description: 'A protein-rich quinoa salad with fresh vegetables and a zesty lemon dressing. Perfect for meal prep.',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 4,
    difficulty: 'Easy',
    macros: {
      calories: 290,
      protein: 10,
      carbs: 35,
      fat: 12,
      fiber: 6,
      sugar: 4
    },
    ingredients: [
      { name: 'Quinoa', amount: '1 cup', unit: 'cup', has: true },
      { name: 'Cucumber', amount: '1', unit: 'piece', has: true },
      { name: 'Cherry tomatoes', amount: '200g', unit: 'grams', has: true },
      { name: 'Red onion', amount: '1/2', unit: 'piece', has: false },
      { name: 'Feta cheese', amount: '100g', unit: 'grams', has: false },
      { name: 'Lemon', amount: '1', unit: 'piece', has: true },
      { name: 'Olive oil', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Fresh mint', amount: '1/4 cup', unit: 'cup', has: false }
    ],
    instructions: [
      'Rinse quinoa thoroughly under cold water',
      'Cook quinoa in 2 cups water for 15-20 minutes',
      'Let quinoa cool completely',
      'Dice cucumber and tomatoes',
      'Finely chop red onion and mint',
      'Combine cooled quinoa with vegetables',
      'Whisk together lemon juice and olive oil',
      'Pour dressing over salad and toss',
      'Top with crumbled feta cheese'
    ]
  },
  'salmon bowl': {
    id: 'salmon-bowl',
    title: 'Salmon Bowl',
    description: 'A nutritious and colorful salmon bowl with quinoa, roasted vegetables, and a creamy tahini dressing. Packed with omega-3s and protein.',
    prepTime: '20 min',
    cookTime: '25 min',
    servings: 2,
    difficulty: 'Medium',
    macros: {
      calories: 520,
      protein: 35,
      carbs: 45,
      fat: 22,
      fiber: 8,
      sugar: 6
    },
    ingredients: [
      { name: 'Salmon fillet', amount: '400g', unit: 'grams', has: false },
      { name: 'Quinoa', amount: '1 cup', unit: 'cup', has: true },
      { name: 'Sweet potato', amount: '1 large', unit: 'piece', has: true },
      { name: 'Broccoli', amount: '200g', unit: 'grams', has: true },
      { name: 'Avocado', amount: '1', unit: 'piece', has: false },
      { name: 'Tahini', amount: '3 tbsp', unit: 'tablespoons', has: true },
      { name: 'Lemon', amount: '1', unit: 'piece', has: true },
      { name: 'Olive oil', amount: '2 tbsp', unit: 'tablespoons', has: true }
    ],
    instructions: [
      'Preheat oven to 400°F (200°C)',
      'Cook quinoa according to package directions',
      'Cut sweet potato into cubes and roast for 20 minutes',
      'Season salmon with salt, pepper, and olive oil',
      'Roast salmon for 12-15 minutes until flaky',
      'Steam broccoli until tender-crisp',
      'Slice avocado and prepare tahini dressing',
      'Assemble bowls with quinoa, vegetables, and salmon',
      'Drizzle with tahini dressing and serve'
    ]
  },
  'veggie wrap': {
    id: 'veggie-wrap',
    title: 'Veggie Wrap',
    description: 'A fresh and healthy veggie wrap filled with crunchy vegetables, hummus, and fresh herbs. Perfect for a light lunch or snack.',
    prepTime: '10 min',
    cookTime: '0 min',
    servings: 2,
    difficulty: 'Easy',
    macros: {
      calories: 280,
      protein: '12',
      carbs: '35',
      fat: '10',
      fiber: '8',
      sugar: '6'
    },
    ingredients: [
      { name: 'Tortilla wraps', amount: '2 large', unit: 'pieces', has: true },
      { name: 'Hummus', amount: '1/2 cup', unit: 'cup', has: false },
      { name: 'Lettuce', amount: '1 cup', unit: 'cup', has: false },
      { name: 'Cucumber', amount: '1/2', unit: 'piece', has: true },
      { name: 'Carrots', amount: '1 large', unit: 'piece', has: true },
      { name: 'Bell pepper', amount: '1', unit: 'piece', has: false },
      { name: 'Avocado', amount: '1/2', unit: 'piece', has: false },
      { name: 'Fresh herbs', amount: '2 tbsp', unit: 'tablespoons', has: true }
    ],
    instructions: [
      'Warm tortilla wraps slightly to make them pliable',
      'Spread hummus evenly over each tortilla',
      'Add a layer of lettuce leaves',
      'Slice cucumber and carrots into thin strips',
      'Cut bell pepper into thin strips',
      'Slice avocado thinly',
      'Arrange all vegetables on top of lettuce',
      'Sprinkle with fresh herbs',
      'Roll tightly and slice in half to serve'
    ]
  }
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { colors, isDark } = useSimpleTheme()
  const { items: pantryItems } = usePantry()
  const { lists, addItemToList } = useListsUnified()
  const { getRecipeById } = useRecipes()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [fadeAnim] = useState(new Animated.Value(0))
  const [slideAnim] = useState(new Animated.Value(50))
  
  // List selector modal state
  const [showListSelector, setShowListSelector] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null)
  
  // Ingredient substitution state
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [ingredientToSubstitute, setIngredientToSubstitute] = useState<any>(null)
  const [substitutedIngredients, setSubstitutedIngredients] = useState<Record<string, string>>({})

  // Check which ingredients user has in pantry using proper ingredient matching service
  // This ensures consistency with match percentage calculation
  const checkIngredientInPantry = (ingredientName: string) => {
    const normalizedName = ingredientName.toLowerCase().trim()
    
    // CRITICAL: Core household staples - everyone has these, never show in "Ingredients to Buy"
    // Salt
    if (normalizedName.includes('salt') && !normalizedName.includes('sauce')) {
      return true
    }
    
    // Black pepper (not bell pepper)
    if ((normalizedName === 'pepper' || normalizedName === 'black pepper' || normalizedName.includes('black pepper') || normalizedName.includes('peppercorn')) &&
        !normalizedName.includes('bell') && !normalizedName.includes('red pepper') && !normalizedName.includes('chili pepper')) {
      return true
    }
    
    // Cooking oils
    if (normalizedName.includes('oil') && (normalizedName.includes('olive') || normalizedName.includes('vegetable') || normalizedName.includes('canola') || normalizedName.includes('avocado'))) {
      return true
    }
    
    // Butter
    if (normalizedName.includes('butter')) {
      return true
    }
    
    // Water (CRITICAL: Everyone has water)
    if (normalizedName === 'water' || normalizedName.includes(' water') || normalizedName.includes('water ')) {
      return true
    }
    
    // Sugar
    if (normalizedName.includes('sugar') && (normalizedName.includes('white') || normalizedName.includes('brown') || normalizedName.includes('granulated') || normalizedName === 'sugar')) {
      return true
    }
    
    // Flour
    if (normalizedName.includes('flour') && (normalizedName.includes('all-purpose') || normalizedName.includes('plain') || normalizedName === 'flour')) {
      return true
    }
    
    if (!pantryItems || pantryItems.length === 0) {
      return false
    }
    
    // Use the same matching service that calculates match percentage
    for (const pantryItem of pantryItems) {
      const matchResult = ingredientMatchingService.matchIngredient(ingredientName, pantryItem.name)
      if (matchResult.isMatch && matchResult.confidence >= 0.70) {
        return true
      }
    }
    
    return false
  }

  useEffect(() => {
    const loadRecipe = async () => {
      if (id) {
        setLoading(true)
        const recipeId = decodeURIComponent(id.toString())
        console.log('Loading recipe with ID:', recipeId)
        
        const foundRecipe = await getRecipeById(recipeId)
        
        if (foundRecipe) {
          console.log('✅ Found recipe:', foundRecipe.title)
          
          // Safety check: If this is an AI-generated recipe, redirect to AI detail screen
          const isAIRecipe = foundRecipe.isAIGenerated || 
                             recipeId.startsWith('ai_gen_') ||
                             recipeId.startsWith('local_') ||
                             recipeId.startsWith('fallback_') ||
                             recipeId.startsWith('regenerated_')
          
          if (isAIRecipe) {
            // Redirect to AI recipe detail screen with full recipe data
            router.replace({
              pathname: '/ai-recipe-detail',
              params: { recipe: JSON.stringify(foundRecipe) }
            })
            return
          }
          
          setRecipe(foundRecipe)
          // Animate in
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            })
          ]).start()
        } else {
          console.log('❌ Recipe not found for ID:', recipeId)
        }
        setLoading(false)
      }
    }
    
    loadRecipe()
  }, [id, getRecipeById, router])

  const handleAddToGroceryList = (ingredient: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedIngredient(ingredient)
    setShowListSelector(true)
  }
  
  const handleSelectList = (listId: string, listName: string) => {
    if (!selectedIngredient || !recipe) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    // Convert recipe quantity to store/purchasable quantity
    const standardized = groceryStandardizer.standardizeForShopping(
      selectedIngredient.name,
      selectedIngredient.quantity,
      selectedIngredient.unit,
      recipe.title
    )
    
    // Add to selected list with proper grocery store category and store quantities
    addItemToList(listId, {
      name: standardized.displayName,
      category: standardized.category,
      quantity: standardized.quantity,
      notes: standardized.notes || `From ${recipe.title}`
    })
    
    setShowListSelector(false)
    setSelectedIngredient(null)
    
    Alert.alert('Added!', `${selectedIngredient.name} added to ${listName}`)
  }

  const handleCookNow = () => {
    if (recipe) {
      router.push(`/cooking-flashcards-simple?recipeId=${recipe.id}`)
    }
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

  // Deduplicate ingredients - merge similar ones like "sea salt" and "salt"
  // This MUST run every time recipe changes to catch duplicates
  // IMPORTANT: This hook must be called BEFORE any early returns to maintain hooks order
  const deduplicatedIngredients = React.useMemo(() => {
    if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
      return []
    }
    
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
    
    const merged = new Map<string, any>()
    
    for (const ing of recipe.ingredients) {
      if (!ing || !ing.name) continue
      
      const key = getDedupeKey(ing.name)
      if (!key) continue
      
      const existing = merged.get(key)
      
      if (existing) {
        // ALWAYS merge duplicates - keep the more descriptive name
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
        
        // Skip adding this ingredient since we merged it
        continue
      } else {
        // First time seeing this ingredient
        merged.set(key, { ...ing })
      }
    }
    
    const result = Array.from(merged.values())
    
    // Debug logging - always log to help diagnose
    console.log('🔍 Recipe Detail Deduplication:', {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      original: recipe.ingredients.length,
      deduplicated: result.length,
      originalNames: recipe.ingredients.map((i: any) => `${i.name} (${i.quantity} ${i.unit})`),
      deduplicatedNames: result.map((i: any) => `${i.name} (${i.quantity} ${i.unit})`),
      saltKeys: recipe.ingredients
        .filter((i: any) => i.name && getDedupeKey(i.name) === 'salt')
        .map((i: any) => `${i.name} (${i.quantity} ${i.unit})`)
    })
    
    return result
  }, [recipe?.id, recipe?.ingredients?.length, recipe?.ingredients])

  // Check which ingredients are available in pantry (deduplicatedIngredients is already computed)
  const ingredientsWithStatus = deduplicatedIngredients.map((ing: any) => ({
    ...ing,
    inPantry: checkIngredientInPantry(ing.name)
  }))
  
  const availableIngredients = ingredientsWithStatus.filter((ing: any) => ing.inPantry)
  const missingIngredients = ingredientsWithStatus.filter((ing: any) => !ing.inPantry)

  // Early return AFTER all hooks have been called
  if (loading || !recipe) {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        
        <View style={styles.cleanHeader}>
          <Pressable
            style={styles.cleanBackButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Text style={styles.cleanBackButtonText}>←</Text>
          </Pressable>
          <Text style={styles.cleanHeaderTitle}>SAVR</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color="#6A9571" />
              <Text style={{ fontSize: 16, color: '#8E8E93', textAlign: 'center', marginTop: 16 }}>
                Loading recipe...
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, color: '#000', textAlign: 'center', marginBottom: 16 }}>
                Recipe not found
              </Text>
              <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>
                Looking for ID: "{id?.toString()}"
              </Text>
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      
      {/* Header */}
      <View style={styles.cleanHeader}>
        <Pressable
          style={styles.cleanBackButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
        >
          <Text style={styles.cleanBackButtonText}>←</Text>
        </Pressable>
        <Text style={styles.cleanHeaderTitle}>SAVR</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Ingredient Carousel */}
          <IngredientCarousel
            ingredients={ingredientsWithStatus}
            title="Ingredient Spotlight"
          />

          {/* Recipe Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            {recipe.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {recipe.description}
              </Text>
            )}
            
            <View style={styles.infoGrid}>
              {recipe.prep_time !== undefined && recipe.prep_time > 0 && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Prep Time</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{recipe.prep_time} min</Text>
                </View>
              )}
              {recipe.cook_time !== undefined && recipe.cook_time > 0 && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Cook Time</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{recipe.cook_time} min</Text>
                </View>
              )}
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Servings</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{recipe.servings}</Text>
              </View>
              {recipe.difficulty && (
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Difficulty</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{recipe.difficulty}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Nutritional Information */}
          {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
            <View style={[styles.macrosCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutritional Information</Text>
              <Text style={[styles.nutritionSubtitle, { color: colors.textSecondary }]}>
                Per serving ({recipe.servings || 2} {recipe.servings === 1 ? 'serving' : 'servings'})
              </Text>
              <View style={styles.macrosGrid}>
                {recipe.calories && (
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.primary }]}>{recipe.calories}</Text>
                    <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Calories</Text>
                  </View>
                )}
                {recipe.protein && (
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.accent }]}>{recipe.protein}g</Text>
                    <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Protein</Text>
                  </View>
                )}
                {recipe.carbs && (
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.primary }]}>{recipe.carbs}g</Text>
                    <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Carbs</Text>
                  </View>
                )}
                {recipe.fat && (
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: colors.accent }]}>{recipe.fat}g</Text>
                    <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Fat</Text>
                  </View>
                )}
              </View>
              {(recipe.fiber || (recipe as any).sodium || (recipe as any).sugar) && (
                <View style={styles.nutritionDetails}>
                  {recipe.fiber && recipe.fiber > 0 && (
                    <Text style={[styles.nutritionDetailText, { color: colors.textSecondary }]}>
                      Fiber: {recipe.fiber}g
                    </Text>
                  )}
                  {(recipe as any).sodium && (recipe as any).sodium > 0 && (
                    <Text style={[styles.nutritionDetailText, { color: colors.textSecondary }]}>
                      Sodium: {Math.round((recipe as any).sodium)}mg
                    </Text>
                  )}
                  {(recipe as any).sugar && (recipe as any).sugar > 0 && (
                    <Text style={[styles.nutritionDetailText, { color: colors.textSecondary }]}>
                      Sugar: {(recipe as any).sugar}g
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Available Ingredients */}
          <View style={[styles.ingredientsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Available Ingredients ({availableIngredients.length})
            </Text>
            {availableIngredients.map((ingredient: any, index: number) => {
              const formattedDisplay = formatIngredientDisplay(
                ingredient.quantity,
                ingredient.unit,
                ingredient.name
              )
              
              return (
                <View key={index} style={styles.ingredientItem}>
                  <View style={[styles.ingredientIcon, { backgroundColor: colors.accent }]}>
                    <Text style={styles.ingredientIconText}>✓</Text>
                  </View>
                  <Text style={[styles.ingredientName, { color: colors.text }]}>
                    {formattedDisplay}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* Missing Ingredients */}
          <View style={[styles.ingredientsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Missing Ingredients ({missingIngredients.length})
            </Text>
            {missingIngredients.map((ingredient: any, index: number) => {
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
                <View key={index} style={styles.ingredientItem}>
                  <View style={[styles.ingredientIcon, { backgroundColor: colors.primary }]}>
                    <Text style={styles.ingredientIconText}>!</Text>
                  </View>
                  <View style={styles.ingredientTextContainer}>
                    <Text style={[styles.ingredientName, { color: colors.text }]}>
                      {formattedDisplay}
                    </Text>
                    {isSubstituted && (
                      <Text style={[styles.originalIngredient, { color: colors.textSecondary }]}>
                        Originally: {formatIngredientDisplay(ingredient.quantity, ingredient.unit, ingredient.name)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.ingredientActions}>
                    <Pressable
                      style={[styles.substituteButton, { backgroundColor: colors.accent }]}
                      onPress={() => handleSubstitutePress(ingredient)}
                    >
                      <Text style={styles.substituteButtonText}>Sub</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.addToListButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleAddToGroceryList(ingredient)}
                    >
                      <Text style={styles.addToListButtonText}>Add to List</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>

          {/* Cook Now Button */}
          <Pressable
            style={[styles.cookNowButton, { backgroundColor: colors.accent }]}
            onPress={handleCookNow}
          >
            <Text style={styles.cookNowButtonText}>Cook Now</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* List Selector Modal */}
      <Modal
        visible={showListSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowListSelector(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowListSelector(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.95)']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Add to List</Text>
              <Text style={styles.modalSubtitle}>
                {selectedIngredient ? formatIngredientDisplay(
                  selectedIngredient.quantity,
                  selectedIngredient.unit,
                  selectedIngredient.name
                ) : ''}
              </Text>
              
              <ScrollView style={styles.listsScrollView} showsVerticalScrollIndicator={false}>
                {lists.map((list: any) => (
                  <Pressable
                    key={list.id}
                    style={styles.listOption}
                    onPress={() => handleSelectList(list.id, list.name)}
                  >
                    <Text style={styles.listOptionIcon}>{list.icon}</Text>
                    <View style={styles.listOptionContent}>
                      <Text style={styles.listOptionName}>{list.name}</Text>
                      <Text style={styles.listOptionCount}>
                        {list.itemCount} items
                      </Text>
                    </View>
                    <Text style={styles.listOptionArrow}>→</Text>
                  </Pressable>
                ))}
              </ScrollView>
              
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowListSelector(false)
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </LinearGradient>
          </View>
        </Pressable>
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

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  infoCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  macrosCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  nutritionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  nutritionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  nutritionDetailText: {
    fontSize: 13,
  },
  ingredientsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ingredientIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ingredientIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  ingredientName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  ingredientAmount: {
    fontSize: 14,
    marginRight: 12,
  },
  addToListButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addToListButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  originalIngredient: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  ingredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  substituteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  substituteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cookNowButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cookNowButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  
  // Clean Modern Minimal Styles
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  cleanBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cleanBackButtonText: {
    fontSize: 24,
    color: '#000000',
    fontWeight: '600',
  },
  cleanHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  
  // List Selector Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalGradient: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
    fontWeight: '500',
  },
  listsScrollView: {
    maxHeight: 300,
    marginBottom: 20,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  listOptionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  listOptionContent: {
    flex: 1,
  },
  listOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  listOptionCount: {
    fontSize: 13,
    color: '#8E8E93',
  },
  listOptionArrow: {
    fontSize: 20,
    color: '#6A9571',
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
})
