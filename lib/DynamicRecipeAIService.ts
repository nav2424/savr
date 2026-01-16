// Dynamic AI Recipe Generation Service
// Generates personalized recipes based on user preferences, pantry, allergies, and dietary needs

import { config } from '../config'
import { supabase, Recipe, PantryItem } from './supabase'
import { userPreferencesService } from './UserPreferencesService'
import { localRecipeGenerator } from './LocalRecipeGenerator'
import { ingredientUnitService } from './IngredientUnitService'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface RecipeGenerationContext {
  userId: string
  pantryItems: string[]
  allergies?: string[]
  dietaryPreferences?: string[]
  householdSize?: number
  cuisinePreferences?: string[]
  avoidIngredients?: string[]
  mealTypes?: string[] // breakfast, lunch, dinner, snack
  count?: number
}

interface GeneratedRecipeData {
  title: string
  description: string
  meal_type: string
  cuisine_type: string
  prep_time: number
  cook_time: number
  servings: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  ingredients: Array<{
    name: string
    quantity: string
    unit: string
  }>
  instructions: Array<{
    step: number
    description: string
  }>
  calories: number
  protein: number
  carbs: number
  fat: number
  tags: string[]
  why_this_recipe?: string
}

class DynamicRecipeAIService {
  private static instance: DynamicRecipeAIService
  private recipeCache: Map<string, { recipes: Recipe[], timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 86400000 // 24 hours in milliseconds (daily refresh)

  static getInstance(): DynamicRecipeAIService {
    if (!DynamicRecipeAIService.instance) {
      DynamicRecipeAIService.instance = new DynamicRecipeAIService()
    }
    return DynamicRecipeAIService.instance
  }

  /**
   * Generate personalized recipes using AI based on complete user context
   */
  async generatePersonalizedRecipes(context: RecipeGenerationContext): Promise<Recipe[]> {
    try {
      // 🚀 SMART CACHING - Check cache first, generate only if needed
      const cacheKey = this.generateCacheKey(context)
      const cached = this.recipeCache.get(cacheKey)
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('📦 Using cached recipes (24h cache)')
        return cached.recipes
      }
      
      console.log('🔄 Generating fresh recipes (cache expired or not found)')
      console.log('📝 Generation context:', {
        userId: context.userId,
        pantryItems: context.pantryItems.length,
        allergies: context.allergies?.length || 0,
        dietary: context.dietaryPreferences?.length || 0,
        cuisines: context.cuisinePreferences?.length || 0,
        count: context.count
      })

      // Load user preferences
      const preferences = await userPreferencesService.loadPreferences(context.userId)
      console.log('👤 Loaded preferences:', preferences ? 'Yes' : 'No')
      
      // Build comprehensive context
      const fullContext = {
        pantryItems: context.pantryItems,
        allergies: context.allergies || preferences?.dietary?.allergies || [],
        dietaryPreferences: context.dietaryPreferences || preferences?.dietary?.preferences || [],
        householdSize: context.householdSize || parseInt(preferences?.household?.size || '2'),
        cuisinePreferences: context.cuisinePreferences || preferences?.dietary?.cuisines || [],
        avoidIngredients: context.avoidIngredients || [],
        count: context.count || 12
      }

      console.log('🤖 Generating AI recipes with context:', {
        pantryCount: fullContext.pantryItems.length,
        allergies: fullContext.allergies.length,
        dietary: fullContext.dietaryPreferences.length,
        household: fullContext.householdSize
      })

      // Try OpenAI first, fall back to local generation
      let generatedRecipes: GeneratedRecipeData[] = []
      
      try {
        console.log('🤖 Attempting OpenAI generation...')
        generatedRecipes = await this.callOpenAI(fullContext)
        console.log(`🤖 OpenAI generated ${generatedRecipes.length} recipes`)
      } catch (error) {
        console.warn('⚠️ OpenAI generation failed, using local smart generator:', error)
        // Clear any partial results
        generatedRecipes = []
      }
      
      // If OpenAI failed or returned no recipes, use local generator
      if (!generatedRecipes || generatedRecipes.length === 0) {
        console.log('🏠 Using local recipe generator (works offline!)')
        try {
          console.log('🏠 Calling local recipe generator with context:', {
            pantryItems: fullContext.pantryItems,
            allergies: fullContext.allergies,
            dietaryPreferences: fullContext.dietaryPreferences,
            householdSize: fullContext.householdSize,
            count: fullContext.count
          })
          
          const localRecipes = await localRecipeGenerator.generatePersonalizedRecipes({
            pantryItems: fullContext.pantryItems,
            allergies: fullContext.allergies,
            dietaryPreferences: fullContext.dietaryPreferences,
            householdSize: fullContext.householdSize,
            count: fullContext.count
          })
          console.log(`🏠 Local generator created ${localRecipes.length} recipes`)
        
          // Convert local recipes to our format
          try {
            generatedRecipes = localRecipes.map((recipe: any) => {
              // Validate recipe structure
              if (!recipe || typeof recipe !== 'object') {
                console.warn('⚠️ Invalid recipe object:', recipe)
                return null
              }
              
              return {
                title: recipe.title || 'Untitled Recipe',
                description: recipe.description || '',
                meal_type: recipe.mealType || 'dinner',
                cuisine_type: recipe.cuisine || 'international',
                prep_time: recipe.prepTime || 15,
                cook_time: recipe.cookTime || 30,
                servings: fullContext.householdSize,
                difficulty: recipe.difficulty || 'medium',
                ingredients: (recipe.baseIngredients || []).concat(recipe.optionalIngredients || []).map((ing: string) => {
                  // Use ingredient unit service to get proper units - no more "serving"!
                  // Pass empty pantry array since we only have names, not full items
                  const unitResult = ingredientUnitService.getIngredientUnit(ing, [], fullContext.householdSize)
                  
                  return {
                    name: ing,
                    quantity: unitResult.quantity,
                    unit: unitResult.unit
                  }
                }),
                instructions: (recipe.instructions || []).map((inst: string, idx: number) => ({
                  step: idx + 1,
                  description: inst
                })),
                calories: recipe.calories || 0,
                protein: recipe.protein || 0,
                carbs: recipe.carbs || 0,
                fat: recipe.fat || 0,
                tags: recipe.tags || []
              }
            }).filter(recipe => recipe !== null) // Remove null recipes
          } catch (mappingError) {
            console.error('❌ Error mapping recipes:', mappingError)
            generatedRecipes = []
          }
        
        console.log(`✨ Generated ${generatedRecipes.length} recipes using local generator!`)
        } catch (localError: any) {
          console.error('❌ Local generator failed:', localError)
          console.error('❌ Local generator error details:', {
            message: localError?.message || 'Unknown error',
            stack: localError?.stack || 'No stack trace',
            name: localError?.name || 'Unknown error type'
          })
          generatedRecipes = []
        }
      }
      
      if (!generatedRecipes || generatedRecipes.length === 0) {
        console.warn('⚠️ No recipes generated even with local generator')
        console.log('🔄 Attempting fallback recipe generation...')
        
        // Fallback: Generate simple recipes based on pantry items
        try {
          const fallbackRecipes = this.generateFallbackRecipes(fullContext)
          if (fallbackRecipes.length > 0) {
            console.log(`🔄 Generated ${fallbackRecipes.length} fallback recipes`)
            generatedRecipes = fallbackRecipes
          }
        } catch (fallbackError) {
          console.error('❌ Fallback generation also failed:', fallbackError)
        }
        
        if (!generatedRecipes || generatedRecipes.length === 0) {
          console.warn('⚠️ All recipe generation methods failed')
          return []
        }
      }

      // Save recipes to database for persistence
      console.log(`💾 Saving ${generatedRecipes.length} recipes to database...`)
      try {
        const savedRecipes = await this.saveRecipesToDatabase(generatedRecipes, context.userId)
        console.log(`💾 Successfully saved ${savedRecipes.length} recipes to database`)
        console.log(`✨ Generated ${savedRecipes.length} REAL-TIME personalized AI recipes`)
        
        // Cache the generated recipes
        this.recipeCache.set(cacheKey, {
          recipes: savedRecipes,
          timestamp: Date.now()
        })
        
        return savedRecipes
      } catch (dbError) {
        console.error('❌ Database saving failed, returning recipes without saving:', dbError)
        // Return the generated recipes even if database saving fails
        const recipesWithoutDb = generatedRecipes.map((recipe, index) => ({
          ...recipe,
          id: `temp_${Date.now()}_${index}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: context.userId,
          is_public: false,
          source: 'ai_generated' as const
        }))
        console.log(`✨ Generated ${recipesWithoutDb.length} REAL-TIME personalized AI recipes (not saved to DB)`)
        
        // Cache the generated recipes even if not saved to DB
        this.recipeCache.set(cacheKey, {
          recipes: recipesWithoutDb as Recipe[],
          timestamp: Date.now()
        })
        
        return recipesWithoutDb as Recipe[]
      }

    } catch (error) {
      console.error('Error generating personalized recipes:', error)
      return []
    }
  }

  /**
   * Generate simple fallback recipes when other methods fail
   */
  private generateFallbackRecipes(context: any): GeneratedRecipeData[] {
    console.log('🔄 Generating fallback recipes...')
    
    const fallbackRecipes: GeneratedRecipeData[] = []
    
    // Create simple recipes based on pantry items
    const pantryItems = context.pantryItems || []
    
    if (pantryItems.length > 0) {
      // Simple stir-fry recipe
      fallbackRecipes.push({
        title: 'Simple Pantry Stir-Fry',
        description: 'A quick and easy stir-fry using your available ingredients',
        meal_type: 'dinner',
        cuisine_type: 'Asian',
        prep_time: 10,
        cook_time: 15,
        servings: context.householdSize || 2,
        difficulty: 'Easy',
        ingredients: pantryItems.slice(0, 5).map((ing: string) => {
          // Use ingredient unit service to get proper units - no more "serving"!
          const unitResult = ingredientUnitService.getIngredientUnit(ing, [], context.householdSize || 2)
          
          return {
            name: ing,
            quantity: unitResult.quantity,
            unit: unitResult.unit
          }
        }),
        instructions: [
          { step: 1, description: 'Heat oil in a large pan' },
          { step: 2, description: 'Add your pantry ingredients' },
          { step: 3, description: 'Stir-fry for 10-15 minutes' },
          { step: 4, description: 'Season to taste and serve' }
        ],
        calories: 300,
        protein: 15,
        carbs: 25,
        fat: 12,
        tags: ['quick', 'easy', 'pantry']
      })
      
      // Simple salad recipe
      if (pantryItems.length > 2) {
        fallbackRecipes.push({
          title: 'Fresh Pantry Salad',
          description: 'A refreshing salad using your available ingredients',
          meal_type: 'lunch',
          cuisine_type: 'International',
          prep_time: 15,
          cook_time: 0,
          servings: context.householdSize || 2,
          difficulty: 'Easy',
          ingredients: pantryItems.slice(0, 4).map((ing: string) => {
            // Use ingredient unit service to get proper units - no more "serving"!
            const unitResult = ingredientUnitService.getIngredientUnit(ing, [], context.householdSize || 2)
            
            return {
              name: ing,
              quantity: unitResult.quantity,
              unit: unitResult.unit
            }
          }),
          instructions: [
            { step: 1, description: 'Wash and prepare your ingredients' },
            { step: 2, description: 'Chop into bite-sized pieces' },
            { step: 3, description: 'Combine in a large bowl' },
            { step: 4, description: 'Add dressing and toss to combine' }
          ],
          calories: 150,
          protein: 8,
          carbs: 20,
          fat: 6,
          tags: ['healthy', 'fresh', 'pantry']
        })
      }
    }
    
    console.log(`🔄 Generated ${fallbackRecipes.length} fallback recipes`)
    return fallbackRecipes
  }

  /**
   * Call OpenAI to generate multiple recipes at once
   */
  private async callOpenAI(context: {
    pantryItems: string[]
    allergies: string[]
    dietaryPreferences: string[]
    householdSize: number
    cuisinePreferences: string[]
    avoidIngredients: string[]
    count: number
  }): Promise<GeneratedRecipeData[]> {
    try {
      const prompt = this.buildPrompt(context)

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`
        },
        body: JSON.stringify({
          model: config.openaiModel || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert recipe developer trained to create complete, delicious, and realistic recipes for home cooks.

Your role is to use the user's current pantry as a foundation — not a restriction.

If the pantry is missing key ingredients needed for a well-balanced, authentic dish, you must still create the full real recipe and simply list those missing ingredients separately under "missingIngredients".

You are NOT allowed to create unrealistic combinations (e.g., tofu smoothies, chocolate marinara, etc.).

Every recipe must resemble a dish that could appear on a trusted cooking site such as Serious Eats, Bon Appétit, BBC Good Food, or Gordon Ramsay's Home Cooking.

CRITICAL RULES:
- Prioritize culinary realism over pantry constraints.
- Always produce full, cohesive recipes that make sense flavor-wise, even if the user must buy ingredients.
- Distinguish between available (from pantry) and missing ingredients.
- Never include any item from FORBIDDEN_INGREDIENTS (allergens/restrictions), even if it appears in the pantry.
- If an item appears in both PANTRY_ALLOWED and FORBIDDEN_INGREDIENTS, FORBIDDEN_INGREDIENTS takes absolute precedence.
- Automatically exclude pantry items that contain forbidden ingredients (e.g., if "Gluten" is forbidden, exclude tortillas, flour-based items unless explicitly marked gluten-free).
- Label each recipe's inspiration cuisine or technique (e.g., "Italian", "Asian Fusion", "Comfort Bake").
- Keep steps simple and beginner-friendly.
- Use flavor logic: balance sweet/salt/acid/fat.
- Prefer well-known techniques (roast, sauté, bake, sear, simmer).
- Never fabricate brand names or novelty fusions.

Respond with ONLY valid JSON following the exact schema provided. No markdown, no code blocks, just pure JSON.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8, // Higher for more creative variety
          max_tokens: 4000 // Enough for multiple detailed recipes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('OpenAI API Error:', errorData)
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      let recipesText = data.choices[0]?.message?.content || '{}'
      
      // Clean markdown formatting
      recipesText = recipesText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      
      // Parse JSON
      const parsed = JSON.parse(recipesText)
      
      // Handle new format with recipes array
      if (parsed.recipes && Array.isArray(parsed.recipes)) {
        // Transform new format to old format for compatibility
        return parsed.recipes.map((recipe: any) => {
          // Convert new format to old format
          const totalTime = recipe.timeMinutes || (recipe.prepTime || 0) + (recipe.cookTime || 0)
          const prepTime = Math.floor(totalTime * 0.4) // Estimate prep as 40% of total
          const cookTime = Math.floor(totalTime * 0.6) // Estimate cook as 60% of total
          
          // Combine available, missing, and staples into ingredients array
          const availableIngredients = recipe.ingredients?.available || []
          const missingIngredients = recipe.ingredients?.missing || []
          const staples = recipe.ingredients?.staples || []
          
          // Create ingredients array with all ingredients (mark missing ones)
          const allIngredients = [
            ...availableIngredients.map((name: string) => ({
              name: name,
              quantity: '1',
              unit: 'unit',
              inPantry: true
            })),
            ...missingIngredients.map((name: string) => ({
              name: name,
              quantity: '1',
              unit: 'unit',
              inPantry: false
            })),
            ...staples.map((name: string) => ({
              name: name,
              quantity: '1',
              unit: 'unit',
              inPantry: true
            }))
          ]
          
          // Convert steps array to instructions array
          const instructions = (recipe.steps || []).map((step: string, idx: number) => {
            // Remove step number if present
            const cleanStep = step.replace(/^\d+\.\s*/, '').trim()
            return {
              step: idx + 1,
              description: cleanStep
            }
          })
          
          // Extract meal type and cuisine from tags or inspiration
          const mealTypeTag = recipe.tags?.find((tag: string) => tag.startsWith('mealType:'))
          const mealType = mealTypeTag ? mealTypeTag.split(':')[1]?.trim() : 'dinner'
          
          // Use inspiration field if available, otherwise extract from tags
          const cuisineType = recipe.inspiration || 
            recipe.tags?.find((tag: string) => tag.startsWith('inspiredBy:'))?.split(':')[1]?.trim() || 
            'International'
          
          // Build why_this_recipe from available/missing ingredients
          const whyText = `Uses ${availableIngredients.length} pantry items: ${availableIngredients.slice(0, 5).join(', ')}${availableIngredients.length > 5 ? '...' : ''}. ${missingIngredients.length > 0 ? `Missing: ${missingIngredients.join(', ')}.` : ''}`
          
          return {
            title: recipe.title,
            description: recipe.description || '',
            meal_type: mealType,
            cuisine_type: cuisineType,
            prep_time: prepTime,
            cook_time: cookTime,
            servings: recipe.servings || context.householdSize,
            difficulty: recipe.difficulty || 'Easy',
            ingredients: allIngredients,
            instructions: instructions,
            calories: recipe.calories || 0,
            protein: recipe.protein || 0,
            carbs: recipe.carbs || 0,
            fat: recipe.fat || 0,
            tags: recipe.tags || [],
            why_this_recipe: whyText
          }
        })
      }
      
      // Fallback: handle old format (array of recipes)
      return Array.isArray(parsed) ? parsed : [parsed]

    } catch (error) {
      console.error('Error calling OpenAI:', error)
      return []
    }
  }

  /**
   * Get comprehensive allergen mappings for recipe generation
   */
  private getComprehensiveAllergenMappings(allergies: string[]): string {
    const allergenMappings: { [key: string]: string[] } = {
      'peanuts': ['peanut', 'arachis', 'groundnut', 'peanut oil', 'peanut butter'],
      'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'beechnut'],
      'milk': ['dairy', 'lactose', 'whey', 'casein', 'butter', 'cream', 'cheese', 'milk powder', 'milk protein', 'lactoglobulin', 'lactalbumin'],
      'eggs': ['egg', 'albumin', 'globulin', 'lecithin', 'lysozyme', 'ovalbumin', 'egg white', 'egg yolk', 'egg powder'],
      'fish': ['anchovy', 'bass', 'catfish', 'cod', 'flounder', 'grouper', 'haddock', 'hake', 'halibut', 'herring', 'mahi', 'perch', 'pike', 'pollock', 'salmon', 'sardine', 'snapper', 'sole', 'swordfish', 'tilapia', 'trout', 'tuna', 'fish oil', 'fish sauce'],
      'shellfish': ['crab', 'lobster', 'shrimp', 'prawn', 'crawfish', 'crayfish', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'octopus', 'lobster', 'crab meat', 'shrimp paste'],
      'soy': ['soya', 'soybean', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy lecithin', 'soy protein', 'soy oil', 'soy flour'],
      'wheat': ['flour', 'semolina', 'spelt', 'kamut', 'bulgur', 'couscous', 'wheat flour', 'wheat starch', 'wheat protein', 'wheat germ', 'wheat bran', 'durum wheat', 'wheat berries'],
      'gluten': [
        // Primary gluten sources
        'wheat', 'barley', 'rye', 'triticale',
        // Wheat derivatives
        'flour', 'semolina', 'spelt', 'kamut', 'bulgur', 'couscous', 'wheat flour', 'wheat starch', 'wheat protein', 'wheat germ', 'wheat bran', 'durum wheat', 'wheat berries',
        // Barley derivatives
        'malt', 'malt extract', 'malt syrup', 'malt vinegar', 'malt flour', 'barley malt', 'brewer\'s yeast', 'maltose', 'maltodextrin',
        // Rye derivatives
        'rye flour', 'rye bread', 'rye malt',
        // Other gluten-containing grains
        'triticale', 'farro', 'einkorn', 'emmer',
        // Processed ingredients that often contain gluten
        'modified food starch', 'hydrolyzed vegetable protein', 'textured vegetable protein', 'natural flavoring', 'artificial flavoring',
        // Common gluten-containing additives
        'dextrin', 'caramel color', 'malt flavoring', 'malt extract', 'malt syrup'
      ],
      'sesame': ['tahini', 'sesamol', 'sesamolin', 'sesame oil', 'sesame seeds', 'sesame paste', 'halva', 'benne', 'simsim']
    }

    const mappings: string[] = []
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase()
      const variations = allergenMappings[allergyLower] || []
      if (variations.length > 0) {
        mappings.push(`${allergy}: ${variations.join(', ')}`)
      }
    }
    
    return mappings.join('\n')
  }

  /**
   * Normalize pantry item names (remove brand names, standardize)
   */
  private normalizePantryItem(item: string): string {
    const tokensToRemove = [
      'kirkland', 'signature', 'purfiltre', 'tostitos', 'two-bite', 'brand',
      'original', 'protein', 'cow\'s', 'cows', 'grass-fed', 'swiss', 'organic',
      'sunrise', 'medium'
    ]
    
    const cleaned = item
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token && !tokensToRemove.includes(token))
      .join(' ')
      .trim()
    
    // Special mappings
    const mappings: { [key: string]: string } = {
      'greek yogourt': 'greek yogurt',
      'salmon fillet': 'salmon',
      'spring mix': 'mixed greens',
      'sauce marinara': 'marinara sauce',
      'dark chocolate': 'dark chocolate'
    }
    
    return mappings[cleaned] || cleaned
  }

  /**
   * Filter out non-edible items and forbidden ingredients
   */
  private filterPantryItems(
    pantryItems: string[],
    forbiddenIngredients: string[]
  ): string[] {
    const forbiddenLower = forbiddenIngredients.map(f => f.toLowerCase())
    const hasGluten = forbiddenLower.some(f => f.includes('gluten') || f.includes('wheat'))
    
    return pantryItems
      .filter(item => {
        const normalized = this.normalizePantryItem(item)
        const itemLower = normalized.toLowerCase()
        
        // Exclude non-edible items
        if (itemLower.includes('parchment paper')) return false
        
        // Exclude forbidden ingredients
        if (forbiddenLower.some(f => itemLower.includes(f) || f.includes(itemLower))) {
          return false
        }
        
        // Exclude gluten items if gluten is forbidden
        if (hasGluten && (itemLower.includes('tortilla') || itemLower.includes('flour'))) {
          return false
        }
        
        return true
      })
      .map(item => this.normalizePantryItem(item))
  }

  /**
   * Build comprehensive prompt for AI recipe generation using new structured format
   */
  private buildPrompt(context: {
    pantryItems: string[]
    allergies: string[]
    dietaryPreferences: string[]
    householdSize: number
    cuisinePreferences: string[]
    avoidIngredients: string[]
    count: number
  }): string {
    // Normalize and filter pantry items
    const normalizedPantry = this.filterPantryItems(
      context.pantryItems,
      [...context.allergies, ...context.avoidIngredients]
    )
    
    // Determine cooking skill from dietary preferences or default to Beginner
    const cookingSkill = context.dietaryPreferences.some(d => 
      d.toLowerCase().includes('beginner') || d.toLowerCase().includes('easy')
    ) ? 'Beginner' : 'Beginner'
    
    // Extract diet goals from dietary preferences
    const dietGoals = context.dietaryPreferences.filter(d => 
      ['low-carb', 'high protein', 'keto', 'paleo', 'vegan', 'vegetarian'].some(
        goal => d.toLowerCase().includes(goal)
      )
    )
    
    // Assumed staples (common pantry items)
    const assumedStaples = ['Salt', 'Black Pepper', 'Oil', 'Water', 'Vinegar', 'Soy Sauce', 'Sugar']
    
    // Time range (20-40 minutes for beginner-friendly recipes)
    const timeRange = [20, 40]
    
    // Build the structured prompt
    const variables = {
      HOUSEHOLD_SIZE: context.householdSize,
      COOKING_SKILL: cookingSkill,
      DIET_GOALS: dietGoals.length > 0 ? dietGoals : [],
      FORBIDDEN_INGREDIENTS: [...context.allergies, ...context.avoidIngredients],
      PANTRY_ALLOWED: normalizedPantry,
      ASSUMED_STAPLES: assumedStaples,
      REQUESTED_RECIPE_COUNT: context.count,
      TIME_RANGE: timeRange
    }
    
    return `Generate ${context.count} complete, realistic, chef-quality recipes using the following variables:

\`\`\`json
${JSON.stringify(variables, null, 2)}
\`\`\`

**Core Philosophy:**
- Use PANTRY_ALLOWED as a foundation, not a restriction
- Create complete, authentic dishes that make culinary sense
- If missing key ingredients for a real dish, list them under "missingIngredients"
- Never create unrealistic combinations (e.g., tofu smoothies, chocolate marinara)
- Every recipe should feel like it came from Serious Eats, Bon Appétit, or BBC Good Food

**Normalization Rules:**
- Remove brand names and descriptors (e.g., "Kirkland Signature", "Original", "2% PūrFiltre")
- Normalize spelling variants (e.g., "Greek Yogourt" → "greek yogurt", "Salmon Fillet" → "salmon")
- Exclude non-edible items (e.g., parchment paper)
- If FORBIDDEN_INGREDIENTS includes "Gluten" or "Wheat", automatically exclude tortillas and flour-based items

**Recipe Diversity Plan:**
For up to ${context.count} recipes, include:
- 2 × Poultry/Meat (e.g., Roasted Chicken Legs, Beef Stir-Fry)
- 2 × Seafood (e.g., Maple-Butter Salmon, Salmon Wraps)
- 2 × Vegetarian/Vegan (e.g., Tofu Stir-Fry, Sweet Potato Curry)
- 2 × Breakfast/Snack (e.g., Greek Yogurt Parfait, Raspberry Oats)

Avoid repeating the same main protein twice unless prepared differently.

**Ingredient Handling Rules:**
- Use ingredients from PANTRY_ALLOWED first (list under "available")
- If a real, complete dish requires other common ingredients not in the pantry (e.g., onion, lemon, rice, olive oil, spices), add them to "missingIngredients"
- Never omit crucial components just to stay within the pantry
- All "missing" items must be common groceries easily found at any supermarket (no exotic ingredients)
- Always include staples (salt, pepper, oil, water, etc.) under "staples"
- Keep required ingredients ≤ 10 + staples per recipe

**Style and Realism Rules:**
- Use flavor logic: balance sweet/salt/acid/fat
- Mention the real-world inspiration in the description ("Inspired by Thai street stir-fries")
- Prefer well-known techniques (roast, sauté, bake, sear, simmer)
- Each recipe should feel complete and appetizing, as if written by a professional food editor
- Never fabricate brand names or novelty fusions

**Cooking Constraints:**
- Total time within TIME_RANGE [${timeRange[0]}, ${timeRange[1]}] minutes
- Servings default to HOUSEHOLD_SIZE (${context.householdSize})
- Beginner-friendly steps with doneness cues (color, texture, temperature, time)
- Specify pan sizes when relevant (e.g., "10-inch skillet", "large skillet")
- 6–8 steps max per recipe

**Output Format (must be valid JSON):**
\`\`\`json
{
  "recipes": [
    {
      "title": "string (unique, appealing, realistic)",
      "inspiration": "string (e.g., Italian, Japanese, Comfort Bake, Asian Fusion)",
      "description": "1–2 sentences describing the real-world flavor and technique inspiration",
      "timeMinutes": 30,
      "servings": ${context.householdSize},
      "ingredients": {
        "available": ["ingredients found in the user's pantry after normalization"],
        "missing": ["realistic ingredients to complete the dish (common groceries only)"],
        "staples": ["salt", "black pepper", "oil", "water", ...]
      },
      "steps": [
        "1. Numbered step with clear action and cues.",
        "2. Include doneness indicators (color, texture, temperature, time).",
        "3. Specify pan sizes when relevant.",
        "4. Continue with 6–8 steps max."
      ],
      "notes": [
        "Optional substitutions or serving suggestions."
      ],
      "tags": ["mealType: dinner|lunch|breakfast|snack", "ease: beginner", "inspiredBy: cuisine"]
    }
  ]
}
\`\`\`

**Quality Checklist (self-verify before output):**
- Every recipe is realistic, coherent, and appetizing
- All required base ingredients exist (even if some are listed as "missing")
- "missingIngredients" are practical and minimal (common groceries only)
- Titles and steps feel like real recipes, not AI composites
- Recipes show variety across proteins and cuisines
- JSON is valid, no stray text outside the schema
- No FORBIDDEN_INGREDIENTS anywhere
- timeMinutes within TIME_RANGE [${timeRange[0]}, ${timeRange[1]}]

Return ONLY the JSON object, no markdown, no code blocks, no explanation.`
  }

  /**
   * Save generated recipes to database
   */
  private async saveRecipesToDatabase(
    generatedRecipes: GeneratedRecipeData[],
    userId: string
  ): Promise<Recipe[]> {
    const savedRecipes: Recipe[] = []

    for (const recipeData of generatedRecipes) {
      try {
        // Check if similar recipe already exists (avoid duplicates)
        const { data: existing } = await supabase
          .from('recipes')
          .select('id')
          .eq('title', recipeData.title)
          .eq('created_by', userId)
          .single()

        if (existing) {
          console.log(`Recipe "${recipeData.title}" already exists, skipping`)
          continue
        }

        // DON'T save image_url to database - always generate fresh images
        // This ensures each recipe gets a unique, accurate image based on current content

        // Insert new recipe (only use fields that exist in database schema)
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            title: recipeData.title,
            description: recipeData.description,
            image_url: null, // Never save image URLs - always generate fresh
            meal_type: recipeData.meal_type,
            cuisine_type: recipeData.cuisine_type,
            prep_time: recipeData.prep_time,
            cook_time: recipeData.cook_time,
            servings: recipeData.servings,
            difficulty: recipeData.difficulty,
            ingredients: recipeData.ingredients,
            instructions: recipeData.instructions,
            calories: recipeData.calories,
            protein: recipeData.protein,
            carbs: recipeData.carbs,
            fat: recipeData.fat,
            tags: [...recipeData.tags, 'ai-generated', 'personalized'],
            source: 'ai_generated',
            is_public: false, // Keep AI recipes private
            created_by: userId
          })
          .select()
          .single()

        if (error) {
          console.error(`❌ Error saving recipe "${recipeData.title}":`, error)
          console.error(`❌ Error details:`, error.message)
          console.error(`❌ Error code:`, error.code)
          continue
        }

        if (data) {
          savedRecipes.push(data as Recipe)
        }
      } catch (error) {
        console.error('Error processing recipe:', error)
      }
    }

    return savedRecipes
  }

  /**
   * Generate intelligent image URL for recipe based on title and type
   * Matches the same logic as SimpleRecipeImage component
   */
  private generateImageUrlForRecipe(title: string, mealType?: string, cuisineType?: string): string {
    const lower = title.toLowerCase()
    
    // PRIORITY 1: Desserts & Sweets
    if (lower.match(/brownie|fudge|chocolate.*cake|chocolate.*chip|cookie|cupcake|muffin|donut|doughnut/)) {
      return 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80'
    }
    if (lower.match(/cake|dessert|sweet|pastry|pie|tart|cheesecake/)) {
      return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80'
    }
    
    // PRIORITY 2: Specific Dishes
    if (lower.match(/curry/)) return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80'
    if (lower.match(/pizza/)) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80'
    if (lower.match(/burger/)) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80'
    if (lower.match(/taco|burrito|quesadilla/)) return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80'
    if (lower.match(/sushi|roll/)) return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80'
    if (lower.match(/ramen|noodle.*soup/)) return 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80'
    
    // PRIORITY 3: Main Categories
    if (lower.match(/pasta|spaghetti|linguine|fettuccine|penne/)) return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80'
    if (lower.match(/stir.*fry|stir fry/)) return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'
    if (lower.match(/soup|stew|chowder|bisque/)) return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80'
    if (lower.match(/salad/) && !lower.match(/chicken|beef|tuna|egg/)) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
    if (lower.match(/sandwich|sub|hoagie|wrap/)) return 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80'
    if (lower.match(/bowl/) && lower.match(/rice|grain|buddha|poke/)) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
    
    // PRIORITY 4: Proteins
    if (lower.match(/chicken/)) return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80'
    if (lower.match(/salmon|fish/)) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80'
    if (lower.match(/beef|steak/)) return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80'
    if (lower.match(/pork|bacon/)) return 'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80'
    if (lower.match(/shrimp|prawn|seafood/)) return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'
    
    // PRIORITY 5: Meal Types
    if (lower.match(/breakfast/) || lower.match(/pancake|waffle|french toast|omelette|omelet/)) {
      return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80'
    }
    if (lower.match(/toast/) && lower.match(/avocado/)) {
      return 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80'
    }
    
    // PRIORITY 6: Cuisine-based fallbacks
    if (cuisineType) {
      const cuisine = cuisineType.toLowerCase()
      if (cuisine.includes('italian')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80'
      if (cuisine.includes('mexican')) return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80'
      if (cuisine.includes('asian') || cuisine.includes('chinese') || cuisine.includes('thai')) {
        return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'
      }
      if (cuisine.includes('japanese')) return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80'
      if (cuisine.includes('indian')) return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80'
    }
    
    // Default: Beautiful food platter
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
  }

  /**
   * Generate cache key based on user context
   */
  private getCacheKey(context: RecipeGenerationContext): string {
    const { userId, pantryItems, allergies = [], dietaryPreferences = [] } = context
    const pantryHash = pantryItems.sort().join(',')
    const allergyHash = allergies.sort().join(',')
    const dietHash = dietaryPreferences.sort().join(',')
    return `${userId}-${pantryHash.substring(0, 50)}-${allergyHash}-${dietHash}`
  }

  /**
   * Clear cache for a user (call when preferences change significantly)
   */
  clearCache(userId: string): void {
    // Remove all cache entries for this user
    const keysToDelete: string[] = []
    this.recipeCache.forEach((_, key) => {
      if (key.startsWith(userId)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.recipeCache.delete(key))
    console.log(`🗑️ Cleared ${keysToDelete.length} cached recipe entries for user`)
  }

  /**
   * Generate a cache key based on user context
   */
  private generateCacheKey(context: RecipeGenerationContext): string {
    const contextHash = JSON.stringify({
      userId: context.userId,
      pantryItems: context.pantryItems.sort(),
      allergies: (context.allergies || []).sort(),
      dietaryPreferences: (context.dietaryPreferences || []).sort(),
      cuisinePreferences: (context.cuisinePreferences || []).sort(),
      householdSize: context.householdSize,
      count: context.count
    })
    // Use a simple hash function instead of Buffer for React Native compatibility
    const simpleHash = (str: string): string => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(36)
    }
    return `recipes_${context.userId}_${simpleHash(contextHash).slice(0, 16)}`
  }

  /**
   * Regenerate recipes (force refresh)
   */
  async regenerateRecipes(context: RecipeGenerationContext): Promise<Recipe[]> {
    this.clearCache(context.userId)
    return this.generatePersonalizedRecipes(context)
  }
}

export const dynamicRecipeAIService = DynamicRecipeAIService.getInstance()

