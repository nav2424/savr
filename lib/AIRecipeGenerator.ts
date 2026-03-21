// SAVR AI Recipe Generator - Creates recipes based on pantry ingredients
import { supabase } from './supabase'
import { userPreferencesService } from './UserPreferencesService'
import { ingredientUnitService } from './IngredientUnitService'
import config from '../config'

export interface GeneratedRecipe {
  id: string
  title: string
  description: string
  image_url: string
  prep_time: number
  cook_time: number
  servings: number
  difficulty: string
  cuisine_type: string
  meal_type: string
  ingredients: Array<{ 
    name: string
    quantity: string
    unit: string
    inPantry?: boolean
    importance?: 'critical' | 'important' | 'optional'
  }>
  instructions: Array<{ step: number; description: string }>
  tags: string[]
  isAIGenerated: boolean
  generatedFrom: string[]
  matchPercentage: number
  ingredientsAvailable?: number
  ingredientsMissing?: number
}

class AIRecipeGenerator {
  private static instance: AIRecipeGenerator

  static getInstance(): AIRecipeGenerator {
    if (!AIRecipeGenerator.instance) {
      AIRecipeGenerator.instance = new AIRecipeGenerator()
    }
    return AIRecipeGenerator.instance
  }

  // Generate recipes based on pantry items
  async generateRecipesFromPantry(
    pantryItems: Array<{ name: string; category: string }>,
    userId: string,
    count: number = 5
  ): Promise<GeneratedRecipe[]> {
    try {
      const preferences = await userPreferencesService.loadPreferences(userId)
      const householdSize = preferences?.household?.size ? parseInt(preferences.household.size) : 1

      // First attempt true AI generation via LLM
      const llmRecipes = await this.generateRecipesWithLLM(
        pantryItems,
        householdSize,
        count,
        preferences
      )
      if (llmRecipes.length > 0) {
        return llmRecipes
      }
      
      const generatedRecipes: GeneratedRecipe[] = []

      // Get main ingredients from pantry (proteins, carbs, veggies)
      const proteins = pantryItems.filter(item => 
        item.name.toLowerCase().includes('chicken') ||
        item.name.toLowerCase().includes('beef') ||
        item.name.toLowerCase().includes('pork') ||
        item.name.toLowerCase().includes('fish') ||
        item.name.toLowerCase().includes('salmon') ||
        item.name.toLowerCase().includes('shrimp')
      )

      const carbs = pantryItems.filter(item =>
        item.name.toLowerCase().includes('rice') ||
        item.name.toLowerCase().includes('pasta') ||
        item.name.toLowerCase().includes('tortilla') ||
        item.name.toLowerCase().includes('bread') ||
        item.name.toLowerCase().includes('noodle')
      )

      const sauces = pantryItems.filter(item =>
        item.name.toLowerCase().includes('salsa') ||
        item.name.toLowerCase().includes('sauce') ||
        item.name.toLowerCase().includes('dressing')
      )

      // SMART GENERATION: Prioritize complete recipes over partial ones
      // Create the BEST recipe first (uses most ingredients)
      
      // Priority 1: Protein + Carb + Sauce = Complete meal (BEST)
      if (proteins.length > 0 && carbs.length > 0 && sauces.length > 0) {
        const recipe = this.generateProteinCarbRecipe(proteins[0], carbs[0], sauces, householdSize)
        generatedRecipes.push(recipe)
      }
      
      // Priority 2: Protein + Carb (if no sauce recipe was created above)
      else if (proteins.length > 0 && carbs.length > 0) {
        const recipe = this.generateProteinCarbRecipe(proteins[0], carbs[0], [], householdSize)
        generatedRecipes.push(recipe)
      }

      // Priority 3: Add ONE complementary recipe only if we have multiple ingredient types
      // Avoid creating "Chicken with Salsa" if we already made "Chicken Tacos with Salsa"
      if (generatedRecipes.length > 0) {
        // Only add a secondary recipe if it uses DIFFERENT primary ingredients
        if (proteins.length > 1) {
          // Use different protein
          const recipe = this.generateBasicProteinRecipe(proteins[1], pantryItems, householdSize)
          generatedRecipes.push(recipe)
        } else if (carbs.length > 1 && sauces.length > 0) {
          // Use different carb
          const recipe = this.generateCarbSauceRecipe(carbs[1], sauces[0], householdSize)
          generatedRecipes.push(recipe)
        }
      }

      // Deduplicate similar recipes based on ingredient overlap
      const uniqueRecipes = this.deduplicateSimilarRecipes(generatedRecipes)

      return uniqueRecipes.slice(0, count)
    } catch (error) {
      console.error('Error generating recipes:', error)
      return []
    }
  }

  // Deduplicate recipes that are too similar
  private deduplicateSimilarRecipes(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
    const unique: GeneratedRecipe[] = []
    
    for (const recipe of recipes) {
      let isSimilar = false
      
      for (const existingRecipe of unique) {
        // Check if recipes use the same core ingredients
        const recipeIngredients = recipe.generatedFrom.map(i => i.toLowerCase())
        const existingIngredients = existingRecipe.generatedFrom.map(i => i.toLowerCase())
        
        // Calculate ingredient overlap
        const overlap = recipeIngredients.filter(ing => 
          existingIngredients.includes(ing)
        ).length
        
        // If more than 66% overlap, consider them too similar
        const overlapPercentage = overlap / Math.max(recipeIngredients.length, existingIngredients.length)
        if (overlapPercentage > 0.66) {
          // Keep the one with higher match percentage
          if (recipe.matchPercentage > existingRecipe.matchPercentage) {
            // Replace existing with this better recipe
            const index = unique.indexOf(existingRecipe)
            unique[index] = recipe
          }
          isSimilar = true
          break
        }
      }
      
      if (!isSimilar) {
        unique.push(recipe)
      }
    }
    
    return unique
  }

  /**
   * Attempt to generate recipes using an external LLM (OpenAI) with a structured prompt.
   * Falls back to deterministic generation if the API key or response is unavailable.
   */
  private async generateRecipesWithLLM(
    pantryItems: Array<{ name: string; category: string }>,
    householdSize: number,
    count: number,
    preferences?: any
  ): Promise<GeneratedRecipe[]> {
    const apiKey = config.openaiApiKey

    if (!apiKey) {
      console.warn('🔒 OpenAI API key not found. Skipping LLM recipe generation.')
      return []
    }

    try {
      const model = process.env.OPENAI_RECIPE_MODEL || 'gpt-4o-mini'
      const normalizedItems = pantryItems.map(item => ({
        originalName: item.name,
        normalizedName: this.normalizeIngredientName(item.name),
        category: item.category || 'unknown',
      }))

      console.log(
        `🧠 OpenAI request: model=${model}, pantryItems=${normalizedItems.length}, householdSize=${householdSize}, desiredCount=${count}`
      )

      const pantrySummary = normalizedItems
        .map(item => `- ${item.normalizedName} (original: ${item.originalName})`)
        .join('\n')

      const allergies: string[] = Array.isArray(preferences?.dietary?.allergies)
        ? preferences.dietary.allergies
            .map((allergy: string) => allergy?.toLowerCase?.()?.trim())
            .filter(Boolean)
        : []

      const hasEggAllergy = allergies.some(allergy =>
        allergy.includes('egg')
      )
      const hasGlutenAllergy = allergies.some(allergy =>
        allergy.includes('gluten') || allergy.includes('wheat') || allergy.includes('celiac')
      )

      const allergyGuidelines: string[] = []

      if (hasEggAllergy) {
        allergyGuidelines.push(
          '- The user is allergic to eggs. Completely avoid eggs and egg-derived ingredients (including mayonnaise, custards, meringues, aioli, egg wash, etc.). Use tofu, flax, chia, or other egg-free binders instead.'
        )
      }

      if (hasGlutenAllergy) {
        allergyGuidelines.push(
          '- The user is allergic to gluten/wheat. Only include naturally gluten-free grains or items explicitly labelled gluten-free (corn tortillas, rice, quinoa, oats marked GF, etc.). No wheat flour, regular pasta, bread, or gluten-containing breadcrumbs.'
        )
      }

      if (hasEggAllergy || hasGlutenAllergy) {
        allergyGuidelines.push(
          '- Reject recipe ideas centred on dips, brownies, wraps, or tortillas unless you explicitly produce a gluten-free AND egg-free version using compliant ingredients available in the pantry. If compliance is uncertain, choose a different concept.'
        )
      }

      const allergyBlock = allergyGuidelines.length
        ? `\nAllergy constraints (must be obeyed):\n${allergyGuidelines.join('\n')}\n`
        : ''

      const systemMessage = `You are an expert recipe developer trained to create complete, delicious, and realistic recipes for home cooks.

Your role is to use the user's current pantry as a foundation — not a restriction.

If the pantry is missing key ingredients needed for a well-balanced, authentic dish, you must still create the full real recipe and simply list those missing ingredients separately under "missingIngredients".

You are NOT allowed to create unrealistic combinations (e.g., tofu smoothies, chocolate marinara, sweet potato smoothie bowls, potato smoothies, etc.).

CRITICAL: Smoothie bowls must ONLY contain fruits, yogurt, milk, nuts, seeds, and sweeteners. NEVER include vegetables like sweet potatoes, regular potatoes, or any savory ingredients in smoothies or smoothie bowls.

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

      // Normalize pantry items
      const normalizedPantry = normalizedItems.map(item => item.normalizedName)
      // REMOVED 'water' - it does nothing helpful and ruins flavor/texture unless marinara is extremely thick
      const assumedStaples = ['salt', 'black pepper', 'oil', 'vinegar', 'soy sauce', 'sugar']
      const forbiddenIngredients = allergies
      const dietGoals: string[] = [] // Could extract from preferences if available
      const timeRange = [20, 40] // Beginner-friendly time range
      
      const variables = {
        HOUSEHOLD_SIZE: householdSize,
        COOKING_SKILL: 'Beginner',
        DIET_GOALS: dietGoals,
        FORBIDDEN_INGREDIENTS: forbiddenIngredients,
        PANTRY_ALLOWED: normalizedPantry,
        ASSUMED_STAPLES: assumedStaples,
        REQUESTED_RECIPE_COUNT: count,
        TIME_RANGE: timeRange
      }

      const userMessage = `
Generate ${count} complete, realistic, chef-quality recipes using the following variables:

\`\`\`json
${JSON.stringify(variables, null, 2)}
\`\`\`

**Core Philosophy:**
- Use PANTRY_ALLOWED as a foundation, not a restriction
- **CRITICAL: Each recipe MUST use 3-4 main pantry items together** - prioritize recipes that combine multiple pantry items in logical culinary ways
- Create complete, authentic dishes that make culinary sense
- If missing key ingredients for a real dish, list them under "missingIngredients"
- Never create unrealistic combinations (e.g., tofu smoothies, chocolate marinara, sweet potato smoothie bowls, potato smoothies)
- Smoothie bowls must ONLY contain fruits, yogurt, milk, nuts, seeds, and sweeteners - NEVER vegetables like sweet potatoes or savory ingredients
- Every recipe should feel like it came from Serious Eats, Bon Appétit, or BBC Good Food

**Multi-Ingredient Combination Priority:**
- **PRIORITY 1:** Recipes using 3-4 pantry items together in logical culinary combinations
- **PRIORITY 2:** Recipes using 2-3 pantry items (acceptable but less preferred)
- **AVOID:** Recipes using only 1 pantry item (too simple, not engaging)
- **Examples of excellent multi-item combination patterns (illustrative, not prescriptive):**
  - Protein + Starch + Sauce + Vegetable (e.g., Chicken + Rice + Tomato Sauce + Shallots)
  - Protein + Salad Greens + Fruit + Aromatics (e.g., Salmon + Spring Mix + Pomegranate + Shallots)
  - Starch + Sauce + Vegetable + Aromatics (e.g., Pasta + Marinara + Tomato Sauce + Shallots)
  - Multiple complementary items (e.g., Eggs + Rice + Tomato Juice + Shallots for breakfast bowls)
- **Key principle:** Combine pantry items in ways that make culinary sense and create complete, satisfying meals

**Normalization Rules (CRITICAL for recipe quality):**
- In "available", "missing", and "staples" lists, use ONLY generic ingredient names (e.g., "eggs", "tomato sauce", "chicken", "potatoes", "black pepper")
- NEVER use raw pantry product names in recipes (e.g., "Egg Best Organic", "Classico Tomato Garlic Sauce", "Sweet Potatoes (u.s.)-big")
- Recipe titles must use generic names: "Chicken and Mushroom Stir-Fry" NOT "Chicken and White Mushrooms Stir-Fry" with product names
- Remove brand names and descriptors (e.g., "Kirkland Signature", "Original", "Classico", "Hass")
- Normalize spelling variants (e.g., "Greek Yogourt" → "greek yogurt", "Salmon Fillet" → "salmon")
- Exclude non-edible items (e.g., parchment paper)
- If FORBIDDEN_INGREDIENTS includes "Gluten" or "Wheat", automatically exclude tortillas and flour-based items

**Recipe Diversity Plan:**
For up to ${count} recipes, include:
- 2 × Poultry/Meat (e.g., Roasted Chicken Legs, Beef Stir-Fry)
- 2 × Seafood (e.g., Maple-Butter Salmon, Salmon Wraps)
- 2 × Vegetarian/Vegan (e.g., Tofu Stir-Fry, Sweet Potato Curry)
- 2 × Breakfast/Snack (e.g., Greek Yogurt Parfait, Raspberry Oats)

Avoid repeating the same main protein twice unless prepared differently.

**Ingredient Handling Rules:**
- **MANDATORY: Each recipe's "available" list must contain 3-4 pantry items** - this is the primary success metric
- Use ingredients from PANTRY_ALLOWED first (list under "available")
- **Combine pantry items logically:** Look for natural pairings (chicken + rice + sauce, salmon + greens + fruit, pasta + sauce + vegetables)
- If a real, complete dish requires other common ingredients not in the pantry (e.g., onion, lemon, rice, olive oil, spices), add them to "missingIngredients"
- Never omit crucial components just to stay within the pantry
- All "missing" items must be common groceries easily found at any supermarket (no exotic ingredients)
- Always include staples (salt, pepper, oil, etc.) under "staples"
- NEVER include water in recipes - it ruins flavor and texture unless absolutely necessary (e.g., extremely thick marinara)
- Keep required ingredients ≤ 10 + staples per recipe
- Include specific quantities with proper units (e.g., "2 tbsp", "500 g", "3 cloves", "1 cup")

**Style and Realism Rules:**
- Use flavor logic: balance sweet/salt/acid/fat
- Mention the real-world inspiration in the description ("Inspired by Thai street stir-fries")
- Prefer well-known techniques (roast, sauté, bake, sear, simmer)
- Each recipe should feel complete and appetizing, as if written by a professional food editor
- Never fabricate brand names or novelty fusions

**Cooking Constraints:**
- Total time within TIME_RANGE [${timeRange[0]}, ${timeRange[1]}] minutes
- Servings default to HOUSEHOLD_SIZE (${householdSize})
- Beginner-friendly steps with doneness cues (color, texture, temperature, time)
- Specify pan sizes when relevant (e.g., "10-inch skillet", "large skillet")
- Each instruction should be a complete sentence with cooking method and timing
- 6–8 steps max per recipe

${allergyBlock}

Return ONLY valid JSON following this EXACT schema:
{
  "recipes": [
    {
      "title": "string (unique, appealing, realistic)",
      "inspiration": "string (e.g., Italian, Japanese, Comfort Bake, Asian Fusion)",
      "description": "1–2 sentences describing the real-world flavor and technique inspiration",
      "timeMinutes": 30,
      "servings": ${householdSize},
      "ingredients": {
        "available": ["ingredients found in the user's pantry after normalization"],
        "missing": ["realistic ingredients to complete the dish (common groceries only)"],
        "staples": ["salt", "black pepper", "oil", ...]
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
      "tags": ["mealType: dinner|lunch|breakfast|snack", "ease: beginner", "inspiredBy: cuisine"],
      "generated_from": ["key pantry ingredients used"]
    }
  ]
}

**Quality Checklist (self-verify before output):**
- **MANDATORY: Each recipe's "available" list contains 3-4 pantry items** - this is the #1 priority
- Every recipe is realistic, coherent, and appetizing
- All required base ingredients exist (even if some are listed as "missing")
- "missingIngredients" are practical and minimal (common groceries only)
- Titles and steps feel like real recipes, not AI composites
- Recipes show variety across proteins and cuisines
- Recipes combine pantry items in logical culinary ways (not random pairings)
- JSON is valid, no stray text outside the schema
- No FORBIDDEN_INGREDIENTS anywhere
- timeMinutes within TIME_RANGE [${timeRange[0]}, ${timeRange[1]}]

EXAMPLES of proper format (note: each uses 3-4 pantry items - these are illustrative examples, not templates to copy exactly):

Example 1 - Multi-item combination (illustrates the principle):
{
  "title": "Marinated Chicken with Tomato Basmati Rice",
  "inspiration": "Mediterranean",
  "description": "Roasted marinated chicken served over fragrant basmati rice cooked with tomato sauce and sautéed shallots.",
  "timeMinutes": 35,
  "servings": ${householdSize},
  "ingredients": {
    "available": ["marinated chicken", "basmati rice", "tomato sauce", "shallots"],
    "missing": ["olive oil", "garlic"],
    "staples": ["salt", "black pepper"]
  },
  "steps": [
    "1. Preheat oven to 400°F (200°C). Roast marinated chicken for 25-30 minutes until internal temperature reaches 165°F.",
    "2. Cook basmati rice according to package directions.",
    "3. Sauté sliced shallots in olive oil until golden, about 5 minutes.",
    "4. Stir tomato sauce into the rice along with the sautéed shallots.",
    "5. Serve roasted chicken over the tomato rice."
  ],
  "notes": ["Add garlic to the shallots for extra flavor."],
  "tags": ["mealType: dinner", "inspiredBy: Mediterranean", "ease: beginner"],
  "generated_from": ["marinated chicken", "basmati rice", "tomato sauce", "shallots"]
}

Example 2 - Multi-item combination (illustrates the principle):
{
  "title": "Salmon Fillet with Pomegranate & Spring Mix Salad",
  "inspiration": "Mediterranean",
  "description": "Pan-seared salmon served over a bright salad of spring mix, pomegranate seeds, and thinly sliced shallots with a simple vinaigrette.",
  "timeMinutes": 25,
  "servings": ${householdSize},
  "ingredients": {
    "available": ["salmon fillet", "pomegranates", "spring mix", "shallots"],
    "missing": ["olive oil", "lemon", "vinegar"],
    "staples": ["salt", "black pepper"]
  },
  "steps": [
    "1. Pan-sear salmon fillets 4-5 minutes per side in a large skillet until golden and cooked through.",
    "2. Remove seeds from pomegranates.",
    "3. Thinly slice shallots.",
    "4. Toss spring mix with pomegranate seeds, shallots, olive oil, lemon juice, and salt.",
    "5. Serve salmon over the dressed salad."
  ],
  "notes": ["Add a drizzle of balsamic vinegar for extra acidity."],
  "tags": ["mealType: dinner", "inspiredBy: Mediterranean", "ease: beginner"],
  "generated_from": ["salmon fillet", "pomegranates", "spring mix", "shallots"]
}

Generate ${count} recipes following this EXACT format and level of detail.
`

      const payload = {
        model,
        temperature: 0.7, // Slightly lower for more consistent, detailed recipes
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      console.log(
        `🧠 OpenAI response received: status=${response.status}, ok=${response.ok}`
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(
          `❌ OpenAI API error: status=${response.status} payloadLength=${errorText?.length ?? 0}`,
          errorText.slice(0, 500)
        )
        return []
      }

      let data: any
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('❌ Failed to parse OpenAI response JSON:', jsonError)
        return []
      }

      console.log(
        `🧠 OpenAI raw response (truncated): ${JSON.stringify(data).slice(0, 400)}`
      )

      const content = data?.choices?.[0]?.message?.content

      if (!data) {
        console.error('❌ OpenAI response was empty JSON object.')
        return []
      }

      if (!content) {
        console.error('❌ OpenAI response missing content field:', JSON.stringify(data).slice(0, 500))
        return []
      }

      let parsed: any
      try {
        parsed = JSON.parse(content)
      } catch (error) {
        console.error('❌ Failed to parse OpenAI JSON content:', error)
        console.error('📝 Raw content (truncated to 500 chars):', content.slice(0, 500))
        return []
      }

      if (!parsed?.recipes || !Array.isArray(parsed.recipes)) {
        console.error(
          '❌ OpenAI response missing recipes array:',
          JSON.stringify(parsed).slice(0, 500)
        )
        return []
      }

      if (parsed.recipes.length === 0) {
        console.warn('⚠️ OpenAI returned an empty recipes array.')
        return []
      }

      console.log(`🧠 OpenAI returned ${parsed.recipes.length} recipes`)

      return this.transformLLMRecipes(parsed.recipes, normalizedItems, householdSize).slice(0, count)
    } catch (error) {
      console.error('❌ LLM recipe generation failed:', error)
      return []
    }
  }

  private transformLLMRecipes(
    llmRecipes: any[],
    normalizedItems: Array<{ originalName: string; normalizedName: string; category: string }>,
    householdSize: number
  ): GeneratedRecipe[] {
    const pantrySet = new Set(normalizedItems.map(item => item.normalizedName))

    return llmRecipes
      .map((recipe, index) => {
        const title: string = recipe.title || `Creative Recipe ${index + 1}`
        const description: string =
          recipe.description || `A custom dish created from your pantry staples.`
        const servings = Math.max(1, Number(recipe.servings) || householdSize)
        
        // Handle time - new format uses timeMinutes, old format uses prep_time_minutes + cook_time_minutes
        const totalTime = recipe.timeMinutes || (Number(recipe.prep_time_minutes) || 10) + (Number(recipe.cook_time_minutes) || 15)
        const prepTime = Math.max(0, Number(recipe.prep_time_minutes) || Math.floor(totalTime * 0.4))
        const cookTime = Math.max(0, Number(recipe.cook_time_minutes) || Math.floor(totalTime * 0.6))
        
        const difficulty =
          typeof recipe.difficulty === 'string'
            ? this.capitalize(recipe.difficulty)
            : 'Easy'
        
        // Use inspiration field if available, otherwise fall back to cuisine
        const cuisineType = recipe.inspiration 
          ? this.capitalize(recipe.inspiration)
          : (recipe.cuisine ? this.capitalize(recipe.cuisine) : 'Fusion')
        
        // Extract meal type from tags or use meal_type field
        const mealTypeTag = recipe.tags?.find((tag: string) => tag.startsWith('mealType:'))
        const mealType = mealTypeTag 
          ? this.capitalize(mealTypeTag.split(':')[1]?.trim() || 'dinner')
          : (recipe.meal_type ? this.capitalize(recipe.meal_type) : 'Dinner')
        
        const tags: string[] = Array.isArray(recipe.tags) ? recipe.tags : []

        // Handle new format with available/missing/staples
        let ingredients: any[] = []
        
        if (recipe.ingredients?.available || recipe.ingredients?.missing || recipe.ingredients?.staples) {
          // New format: available, missing, staples
          // CRITICAL: Convert to proper RECIPE units (tbsp, g, ml, cups, pieces) - NEVER inventory units (bottle, bag, "unit")
          const available = Array.isArray(recipe.ingredients.available) ? recipe.ingredients.available : []
          const missing = Array.isArray(recipe.ingredients.missing) ? recipe.ingredients.missing : []
          const staples = Array.isArray(recipe.ingredients.staples) ? recipe.ingredients.staples : []
          
          // Use IngredientUnitService to get proper recipe units (tbsp, g, ml, cups, pieces)
          // NEVER use "unit" or inventory units (bottle, bag, container)
          // FILTER OUT WATER - it does nothing helpful and ruins flavor/texture
          const filterWater = (name: string) => {
            const nameLower = name.toLowerCase().trim()
            return nameLower !== 'water' && !nameLower.includes(' water')
          }
          
          ingredients = [
            ...available.filter(filterWater).map((name: string) => {
              // Get proper recipe unit and quantity (tbsp, g, ml, cups, pieces)
              const unitResult = ingredientUnitService.getIngredientUnit(name, [], servings)
              return {
                name: this.capitalize(name),
                quantity: unitResult.quantity,
                unit: unitResult.unit, // Recipe unit: tbsp, g, ml, cups, pieces - NOT "unit" or inventory units
                inPantry: true,
                importance: 'critical' as const,
              }
            }),
            ...missing.filter(filterWater).map((name: string) => {
              // Get proper recipe unit and quantity
              const unitResult = ingredientUnitService.getIngredientUnit(name, [], servings)
              return {
                name: this.capitalize(name),
                quantity: unitResult.quantity,
                unit: unitResult.unit, // Recipe unit: tbsp, g, ml, cups, pieces
                inPantry: false,
                importance: 'important' as const,
              }
            }),
            ...staples.filter(filterWater).map((name: string) => {
              // Get proper recipe unit and quantity
              const unitResult = ingredientUnitService.getIngredientUnit(name, [], servings)
              return {
                name: this.capitalize(name),
                quantity: unitResult.quantity,
                unit: unitResult.unit, // Recipe unit: tbsp, g, ml, cups, pieces
                inPantry: true,
                importance: 'optional' as const,
              }
            })
          ]
        } else {
          // Old format: array of ingredient objects
          const ingredientsRaw: any[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
          // FILTER OUT WATER - it does nothing helpful and ruins flavor/texture
          const filteredIngredientsRaw = ingredientsRaw.filter((ing: any) => {
            const name = (ing?.name || '').toLowerCase().trim()
            return name !== 'water' && !name.includes(' water')
          })
          ingredients = filteredIngredientsRaw.map((ing: any) => {
            const name = this.capitalize(ing?.name || '')
            const normalizedName = this.normalizeIngredientName(ing?.name || '')
            const fromPantry =
              typeof ing?.from_pantry === 'boolean'
                ? ing.from_pantry
                : pantrySet.has(normalizedName)

            // Handle quantity - can be string or number, prefer quantity field
            let quantity = ing?.quantity || ing?.amount || ''
            if (typeof quantity === 'number') {
              quantity = quantity.toString()
            }
            
            // Handle unit - ensure it's a proper unit string
            let unit = ing?.unit || ''
            if (!unit && quantity) {
              // Try to extract unit from quantity if it's a combined string like "2 tbsp"
              const match = quantity.toString().match(/^[\d.]+?\s+(.+)$/)
              if (match) {
                quantity = quantity.toString().replace(/\s+.+$/, '')
                unit = match[1]
              }
            }

            // CRITICAL: If unit is missing or invalid, get proper recipe unit from IngredientUnitService
            const invalidUnits = ['unit', 'units', 'peppers']
            let finalUnit = unit
            let finalQuantity = quantity || '1'
            const needsUnitFix = !finalUnit || invalidUnits.includes(finalUnit.toLowerCase?.() || '') ||
              (finalUnit === 'peppers' && name.toLowerCase().includes('black pepper'))
            if (needsUnitFix) {
              const unitResult = ingredientUnitService.getIngredientUnit(name, [], householdSize)
              finalUnit = unitResult.unit
              finalQuantity = unitResult.quantity
            }
            
            return {
              name,
              quantity: finalQuantity,
              unit: finalUnit, // Recipe unit: tbsp, g, ml, cups, pieces - NEVER "unit" or inventory units
              inPantry: fromPantry,
              importance: fromPantry ? 'critical' : 'important',
            }
          })
        }

        // Handle instructions - new format uses steps array, old format uses instructions array
        let instructions: Array<{ step: number; description: string }> = []
        
        if (Array.isArray(recipe.steps)) {
          // New format: steps array with numbered strings
          instructions = recipe.steps
            .map((step: string, idx: number) => {
              if (typeof step === 'string') {
                let desc = step.trim()
                // Remove step numbers if present (e.g., "1. " or "Step 1: ")
                desc = desc.replace(/^\d+\.\s*/, '').replace(/^Step\s+\d+:\s*/i, '')
                return { step: idx + 1, description: desc }
              }
              return null
            })
            .filter(Boolean) as Array<{ step: number; description: string }>
        } else {
          // Old format: instructions array
          const instructionsRaw: any[] = Array.isArray(recipe.instructions) ? recipe.instructions : []
          instructions = instructionsRaw
            .map((instruction, idx) => {
              if (typeof instruction === 'string') {
                let desc = instruction.trim()
                desc = desc.replace(/^\d+\.\s*/, '').replace(/^Step\s+\d+:\s*/i, '')
                return { step: idx + 1, description: desc }
              }
              if (instruction && typeof instruction.description === 'string') {
                let desc = instruction.description.trim()
                desc = desc.replace(/^\d+\.\s*/, '').replace(/^Step\s+\d+:\s*/i, '')
                return { step: idx + 1, description: desc }
              }
              return null
            })
            .filter(Boolean) as Array<{ step: number; description: string }>
        }
        
        // Ensure we have at least 4 instructions for a complete recipe
        if (instructions.length < 4) {
          console.warn(`⚠️ Recipe "${title}" has only ${instructions.length} instructions - may need more detail`)
        }

        const pantryIngredients = ingredients.filter(ing => ing.inPantry)
        const totalIngredients = Math.max(ingredients.length, 1)
        const matchPercentage = Math.round((pantryIngredients.length / totalIngredients) * 100)

        const generatedFromSet = new Set<string>()

        if (Array.isArray(recipe.generated_from)) {
          recipe.generated_from.forEach((item: string) => {
            if (item) generatedFromSet.add(this.capitalize(item))
          })
        }

        pantryIngredients.forEach(ing => generatedFromSet.add(ing.name))

        const generatedFrom = Array.from(generatedFromSet)

        const ingredientsAvailable = pantryIngredients.length
        const ingredientsMissing = totalIngredients - ingredientsAvailable

        return {
          id: this.createRecipeId(),
          title: this.capitalize(title),
          description,
          image_url: '',
          prep_time: prepTime,
          cook_time: cookTime,
          servings,
          difficulty,
          cuisine_type: cuisineType,
          meal_type: mealType,
          ingredients,
          instructions,
          tags,
          isAIGenerated: true,
          generatedFrom,
          matchPercentage,
          ingredientsAvailable,
          ingredientsMissing,
        } as GeneratedRecipe
      })
      .filter(recipe => recipe.instructions.length > 0 && recipe.ingredients.length > 0)
  }

  private normalizeIngredientName(name: string): string {
    if (!name) return ''
    const tokensToRemove = [
      'kirkland',
      'signature',
      'purfiltre',
      'tostitos',
      'two-bite',
      'brand',
      'original',
      'protein',
      'best',
      'organic',
      'classico',
      'hass',
      'big',
      'mini',
      'signature',
      'cow’s',
      "cow's",
    ]

    let cleaned = name
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token && !tokensToRemove.includes(token))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.includes('egg')) return 'eggs'
    if (cleaned.includes('tomato') && (cleaned.includes('sauce') || cleaned.includes('garlic') || cleaned.includes('basil'))) return 'tomato sauce'
    if (cleaned.includes('potato')) return cleaned.includes('sweet') ? 'sweet potato' : 'potato'
    if (cleaned.includes('avocado')) return 'avocado'
    if (cleaned.includes('mushroom')) return 'mushrooms'
    return cleaned || name.toLowerCase()
  }

  private createRecipeId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  // Generate protein + carb recipe
  private generateProteinCarbRecipe(
    protein: { name: string },
    carb: { name: string },
    sauces: Array<{ name: string }>,
    householdSize: number
  ): GeneratedRecipe {
    const proteinName = protein.name
    const carbName = carb.name
    const sauceName = sauces.length > 0 ? sauces[0].name : 'seasoning'

    // Create CURATED recipe using ALL available ingredients
    const hasSauce = sauces.length > 0
    let title = ''
    let cuisineType = 'Home Cooking'
    let instructions: Array<{ step: number; description: string }> = []
    
    // TORTILLA + SAUCE = Perfect Tacos (use ALL ingredients!)
    if (carbName.toLowerCase().includes('tortilla') && hasSauce) {
      title = `${this.capitalize(proteinName)} Tacos`
      cuisineType = 'Mexican'
      instructions = [
        { step: 1, description: `Season ${proteinName} with salt, pepper, and cumin (if available)` },
        { step: 2, description: `Heat oil in skillet over medium-high heat` },
        { step: 3, description: `Cook ${proteinName} until done and slightly crispy, 10-12 minutes` },
        { step: 4, description: `Shred or chop the ${proteinName} into taco-sized pieces` },
        { step: 5, description: `Warm tortillas in a dry skillet or microwave` },
        { step: 6, description: `Assemble tacos: Start with warm tortilla` },
        { step: 7, description: `Add ${proteinName}, then top with ${sauceName}` },
        { step: 8, description: `Add shredded lettuce, diced tomatoes, cheese, and sour cream` },
        { step: 9, description: `Squeeze fresh lime juice over top if available` },
        { step: 10, description: `Serve immediately with extra ${sauceName} on the side` }
      ]
    }
    // RICE recipes
    else if (carbName.toLowerCase().includes('rice')) {
      title = `${this.capitalize(proteinName)} Rice Bowl`
      cuisineType = 'Asian-Inspired'
      instructions = [
        { step: 1, description: `Cook rice according to package` },
        { step: 2, description: `Cook ${proteinName} until done` },
        { step: 3, description: `Assemble bowl: rice + ${proteinName}${hasSauce ? ` + ${sauceName}` : ''}` }
      ]
    }
    // Default
    else {
      title = this.createRecipeTitle(proteinName, carbName, hasSauce ? sauceName : '')
      instructions = [
        { step: 1, description: `Cook ${proteinName}` },
        { step: 2, description: `Prepare ${carbName}` },
        { step: 3, description: `Serve together${hasSauce ? ` with ${sauceName}` : ''}` }
      ]
    }
    
    // Build COMPLETE ingredient list with inPantry flags
    const pantryItemsLower = [proteinName.toLowerCase(), carbName.toLowerCase()]
    if (hasSauce) {
      pantryItemsLower.push(sauceName.toLowerCase())
    }

    const ingredients: Array<{ name: string; quantity: string; unit: string; inPantry?: boolean; importance?: 'critical' | 'important' | 'optional' }> = []

    // CRITICAL ingredients (can't make recipe without these) - Weight: 3x
    ingredients.push(
      { name: proteinName, quantity: String(1.5 * householdSize), unit: 'lb', inPantry: true, importance: 'critical' },
      { name: carbName, quantity: carbName.includes('tortilla') ? String(8 * householdSize) : String(2 * householdSize), unit: carbName.includes('tortilla') ? 'pieces' : 'cups', inPantry: true, importance: 'critical' }
    )

    // IMPORTANT ingredients (makes the dish what it is) - Weight: 2x
    if (hasSauce) {
      ingredients.push({ name: sauceName, quantity: String(0.5 * householdSize), unit: 'cup', inPantry: true, importance: 'important' })
    }

    // For TACOS - add ALL traditional taco ingredients with importance levels
    if (carbName.toLowerCase().includes('tortilla') && hasSauce) {
      ingredients.push(
        // Important toppings - Weight: 2x
        { name: 'Shredded cheese', quantity: String(1 * householdSize), unit: 'cup', inPantry: false, importance: 'important' },
        { name: 'Shredded lettuce', quantity: String(2 * householdSize), unit: 'cups', inPantry: false, importance: 'important' },
        
        // Optional toppings - Weight: 1x
        { name: 'Diced tomatoes', quantity: String(1 * householdSize), unit: 'cup', inPantry: false, importance: 'optional' },
        { name: 'Sour cream', quantity: String(0.5 * householdSize), unit: 'cup', inPantry: false, importance: 'optional' },
        { name: 'Lime', quantity: String(1 * householdSize), unit: 'piece', inPantry: false, importance: 'optional' }
      )
    }

    // Optional seasonings - Weight: 1x
    ingredients.push(
      { name: 'Salt', quantity: '1', unit: 'tsp', inPantry: false, importance: 'optional' },
      { name: 'Pepper', quantity: '1', unit: 'tsp', inPantry: false, importance: 'optional' },
      { name: 'Cumin', quantity: '1', unit: 'tsp', inPantry: false, importance: 'optional' }
    )

    // INTELLIGENT WEIGHTED MATCH CALCULATION
    // Critical ingredients: 3x weight (chicken, tortillas)
    // Important ingredients: 2x weight (salsa, cheese, lettuce)
    // Optional ingredients: 1x weight (seasonings, garnishes)
    
    let totalWeight = 0
    let matchedWeight = 0
    
    ingredients.forEach(ing => {
      const weight = ing.importance === 'critical' ? 3 : 
                    ing.importance === 'important' ? 2 : 1
      totalWeight += weight
      if (ing.inPantry) {
        matchedWeight += weight
      }
    })
    
    const matchPercentage = Math.round((matchedWeight / totalWeight) * 100)
    const ingredientsAvailable = ingredients.filter(ing => ing.inPantry).length
    const ingredientsMissing = ingredients.filter(ing => !ing.inPantry).length

    // Select image based on ACTUAL recipe type
    let imageUrl = ''
    if (title.toLowerCase().includes('taco')) {
      imageUrl = this.getImageForRecipe(proteinName, 'tacos')
    } else if (title.toLowerCase().includes('quesadilla')) {
      imageUrl = this.getImageForRecipe('quesadilla', '')
    } else if (title.toLowerCase().includes('rice bowl')) {
      imageUrl = this.getImageForRecipe(proteinName, 'rice bowl')
    } else {
      imageUrl = this.getImageForRecipe(proteinName, carbName)
    }

    return {
      id: `ai_gen_${Date.now()}_${Math.random()}`,
      title,
      description: `Delicious ${cuisineType.toLowerCase()} meal using your pantry ingredients`,
      image_url: imageUrl,
      prep_time: 10,
      cook_time: carbName.includes('tortilla') ? 15 : 20,
      servings: householdSize,
      difficulty: 'Easy',
      cuisine_type: cuisineType,
      meal_type: 'dinner',
      ingredients,
      instructions,
      tags: ['Quick', 'Easy', 'AI Generated'],
      isAIGenerated: true,
      generatedFrom: pantryItemsLower,
      matchPercentage,
      ingredientsAvailable,
      ingredientsMissing
    }
  }

  // Generate protein + sauce recipe
  private generateProteinSauceRecipe(
    protein: { name: string },
    sauce: { name: string },
    householdSize: number
  ): GeneratedRecipe {
    const proteinName = protein.name
    const sauceName = sauce.name

    const title = `${this.capitalize(proteinName)} with ${this.capitalize(sauceName)}`
    
    const ingredients = [
      { name: proteinName, quantity: String(1.5 * householdSize), unit: 'lb' },
      { name: sauceName, quantity: String(0.75 * householdSize), unit: 'cup' },
      { name: 'Oil', quantity: '2', unit: 'tbsp' },
      { name: 'Garlic', quantity: '3', unit: 'cloves' },
      { name: 'Salt', quantity: '1', unit: 'tsp' },
      { name: 'Pepper', quantity: '1', unit: 'tsp' }
    ]

    const instructions = [
      { step: 1, description: `Season ${proteinName} with salt and pepper` },
      { step: 2, description: `Heat oil in a pan over medium-high heat` },
      { step: 3, description: `Cook ${proteinName} until browned, about 6-8 minutes` },
      { step: 4, description: `Add minced garlic and cook for 1 minute` },
      { step: 5, description: `Add ${sauceName} and simmer for 5 minutes` },
      { step: 6, description: `Serve hot and enjoy!` }
    ]

    // Calculate accurate match percentage
    const pantryIngredients = [proteinName.toLowerCase(), sauceName.toLowerCase()]
    const matchCount = ingredients.filter(ing => 
      pantryIngredients.some(pantryIng => 
        ing.name.toLowerCase().includes(pantryIng) || pantryIng.includes(ing.name.toLowerCase())
      )
    ).length
    const matchPercentage = Math.round((matchCount / ingredients.length) * 100)

    return {
      id: `ai_gen_${Date.now()}_${Math.random()}`,
      title,
      description: `Flavorful ${proteinName} cooked with ${sauceName}`,
      image_url: this.getImageForRecipe(proteinName, sauceName),
      prep_time: 10,
      cook_time: 15,
      servings: householdSize,
      difficulty: 'Easy',
      cuisine_type: 'Home Cooking',
      meal_type: 'dinner',
      ingredients,
      instructions,
      tags: ['Quick', 'Easy', 'AI Generated'],
      isAIGenerated: true,
      generatedFrom: [proteinName, sauceName],
      matchPercentage
    }
  }

  // Generate carb + sauce recipe (like quesadillas)
  private generateCarbSauceRecipe(
    carb: { name: string },
    sauce: { name: string },
    householdSize: number
  ): GeneratedRecipe {
    const carbName = carb.name
    const sauceName = sauce.name

    let title = ''
    let instructions: Array<{ step: number; description: string }> = []

    // Special handling for tortillas
    if (carbName.includes('tortilla')) {
      title = `Simple Quesadillas with ${this.capitalize(sauceName)}`
      instructions = [
        { step: 1, description: 'Heat a large skillet over medium heat' },
        { step: 2, description: 'Place tortilla in skillet' },
        { step: 3, description: 'Add cheese (if available) and fold in half' },
        { step: 4, description: 'Cook until golden and crispy, 2-3 minutes per side' },
        { step: 5, description: `Serve with ${sauceName} for dipping` }
      ]
    } else {
      title = `${this.capitalize(carbName)} with ${this.capitalize(sauceName)}`
      instructions = [
        { step: 1, description: `Prepare ${carbName} according to package directions` },
        { step: 2, description: `Heat ${sauceName} in a separate pan` },
        { step: 3, description: `Combine and serve` }
      ]
    }
    
    const ingredients = [
      { name: carbName, quantity: String(4 * householdSize), unit: 'pieces' },
      { name: sauceName, quantity: String(0.5 * householdSize), unit: 'cup' },
      { name: 'Cheese (optional)', quantity: String(1 * householdSize), unit: 'cup' }
    ]

    // Calculate accurate match percentage
    const pantryIngredients = [carbName.toLowerCase(), sauceName.toLowerCase()]
    const matchCount = ingredients.filter(ing => 
      pantryIngredients.some(pantryIng => 
        ing.name.toLowerCase().includes(pantryIng) || pantryIng.includes(ing.name.toLowerCase())
      )
    ).length
    const matchPercentage = Math.round((matchCount / ingredients.length) * 100)

    return {
      id: `ai_gen_${Date.now()}_${Math.random()}`,
      title,
      description: `Quick and easy ${carbName} with ${sauceName}`,
      image_url: this.getImageForRecipe(carbName, sauceName),
      prep_time: 5,
      cook_time: 10,
      servings: householdSize,
      difficulty: 'Easy',
      cuisine_type: carbName.includes('tortilla') ? 'Mexican' : 'Home Cooking',
      meal_type: 'lunch',
      ingredients,
      instructions,
      tags: ['Quick', 'Easy', 'AI Generated'],
      isAIGenerated: true,
      generatedFrom: [carbName, sauceName],
      matchPercentage
    }
  }

  // Generate basic protein recipe
  private generateBasicProteinRecipe(
    protein: { name: string },
    pantryItems: Array<{ name: string }>,
    householdSize: number
  ): GeneratedRecipe {
    const proteinName = protein.name

    // Check what else is in pantry to enhance recipe
    const hasOil = pantryItems.some(item => item.name.toLowerCase().includes('oil'))
    const hasSalsa = pantryItems.some(item => item.name.toLowerCase().includes('salsa'))
    const hasTortilla = pantryItems.some(item => item.name.toLowerCase().includes('tortilla'))

    let title = ''
    let cuisineType = 'Home Cooking'
    let description = ''

    if (hasTortilla && hasSalsa) {
      title = `${this.capitalize(proteinName)} Tacos`
      cuisineType = 'Mexican'
      description = `Delicious tacos made with ${proteinName}, salsa, and tortillas from your pantry`
    } else if (hasSalsa) {
      title = `${this.capitalize(proteinName)} with Salsa`
      cuisineType = 'Mexican-Inspired'
      description = `Flavorful ${proteinName} topped with salsa`
    } else {
      title = `Simple Grilled ${this.capitalize(proteinName)}`
      description = `Classic preparation of ${proteinName}`
    }

    const ingredients = [
      { name: proteinName, quantity: String(1.5 * householdSize), unit: 'lb' },
      { name: 'Salt', quantity: '1', unit: 'tsp' },
      { name: 'Pepper', quantity: '1', unit: 'tsp' },
      { name: hasOil ? 'Oil' : 'Cooking spray', quantity: '2', unit: 'tbsp' }
    ]

    if (hasSalsa) {
      ingredients.push({ name: 'Salsa', quantity: String(0.5 * householdSize), unit: 'cup' })
    }

    if (hasTortilla) {
      ingredients.push({ name: 'Tortillas', quantity: String(8 * householdSize), unit: 'pieces' })
    }

    const instructions = hasTortilla && hasSalsa ? [
      { step: 1, description: `Season ${proteinName} with salt and pepper` },
      { step: 2, description: `Heat oil in a large skillet over medium-high heat` },
      { step: 3, description: `Cook ${proteinName} until fully cooked, about 10-12 minutes` },
      { step: 4, description: `Shred or chop the cooked ${proteinName}` },
      { step: 5, description: `Warm tortillas in a dry skillet` },
      { step: 6, description: `Assemble tacos with ${proteinName}, salsa, and your favorite toppings` }
    ] : [
      { step: 1, description: `Season ${proteinName} generously with salt and pepper` },
      { step: 2, description: `Heat oil in a large skillet over medium-high heat` },
      { step: 3, description: `Cook ${proteinName} until golden brown and cooked through` },
      { step: 4, description: hasSalsa ? `Top with salsa and serve` : `Serve hot` }
    ]

    const matchPercentage = Math.round((pantryItems.filter(item => 
      ingredients.some(ing => ing.name.toLowerCase().includes(item.name.toLowerCase()))
    ).length / ingredients.length) * 100)

    return {
      id: `ai_gen_${Date.now()}_${Math.random()}`,
      title,
      description,
      image_url: this.getImageForRecipe(proteinName, hasTortilla ? 'tacos' : 'grilled'),
      prep_time: 10,
      cook_time: hasTortilla ? 15 : 20,
      servings: householdSize,
      difficulty: 'Easy',
      cuisine_type: cuisineType,
      meal_type: 'dinner',
      ingredients,
      instructions,
      tags: ['Quick', 'Easy', 'AI Generated', 'Uses Your Pantry'],
      isAIGenerated: true,
      generatedFrom: [proteinName],
      matchPercentage
    }
  }

  // Create recipe title from ingredients
  private createRecipeTitle(protein: string, carb: string, sauce: string): string {
    const proteinClean = this.capitalize(protein)
    const carbClean = this.capitalize(carb)
    
    if (carb.includes('tortilla')) {
      return `${proteinClean} Tacos`
    } else if (carb.includes('rice')) {
      return `${proteinClean} Rice Bowl`
    } else if (carb.includes('pasta')) {
      return `${proteinClean} Pasta`
    } else if (carb.includes('noodle')) {
      return `${proteinClean} Noodle Bowl`
    }
    
    return `${proteinClean} with ${carbClean}`
  }

  // Get appropriate image URL for recipe - VERY SPECIFIC AND ACCURATE
  private getImageForRecipe(ingredient1: string, ingredient2: string = ''): string {
    const combined = `${ingredient1} ${ingredient2}`.toLowerCase()

    // CHICKEN TACOS - MUST show actual chicken tacos!!!
    if (combined.includes('taco') && combined.includes('chicken')) {
      return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80' // ACTUAL CHICKEN TACOS
    }
    if (combined.includes('chicken') && combined.includes('taco')) {
      return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80' // ACTUAL CHICKEN TACOS
    }
    if (combined.includes('chicken leg')) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Actual grilled chicken legs
    }
    if (combined.includes('chicken thigh')) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Chicken thighs
    }
    if (combined.includes('chicken breast') && combined.includes('grill')) {
      return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80' // Grilled chicken breast
    }
    if (combined.includes('chicken') && combined.includes('rice')) {
      return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Chicken with rice
    }
    if (combined.includes('chicken') && combined.includes('pasta')) {
      return 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&q=80' // Chicken pasta
    }
    if (combined.includes('chicken') && combined.includes('salsa')) {
      return 'https://images.unsplash.com/photo-1625944230945-1b7dd3b949ab?w=800&q=80' // Chicken with salsa
    }
    if (combined.includes('chicken')) {
      return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Generic chicken dish
    }

    // MEXICAN/TORTILLA RECIPES - Very specific
    if (combined.includes('quesadilla')) {
      return 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800&q=80' // Actual quesadillas
    }
    if (combined.includes('taco')) {
      return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80' // Actual tacos
    }
    if (combined.includes('burrito')) {
      return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80' // Actual burrito
    }
    if (combined.includes('tortilla')) {
      return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80' // Tortilla-based dish
    }

    // SEAFOOD RECIPES - Very specific
    if (combined.includes('shrimp') && combined.includes('pasta')) {
      return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Shrimp pasta
    }
    if (combined.includes('shrimp') && combined.includes('taco')) {
      return 'https://images.unsplash.com/photo-1612557882771-7b654bc6c7e2?w=800&q=80' // Shrimp tacos
    }
    if (combined.includes('salmon') && combined.includes('grill')) {
      return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80' // Grilled salmon
    }
    if (combined.includes('salmon')) {
      return 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800&q=80' // Salmon dish
    }
    if (combined.includes('fish')) {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Fish dish
    }
    if (combined.includes('shrimp')) {
      return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80' // Shrimp dish
    }

    // BEEF RECIPES - Very specific
    if (combined.includes('beef') && combined.includes('taco')) {
      return 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=80' // Beef tacos
    }
    if (combined.includes('steak')) {
      return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80' // Steak
    }
    if (combined.includes('beef')) {
      return 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80' // Beef dish
    }

    // PASTA RECIPES - Very specific
    if (combined.includes('pasta') && combined.includes('tomato')) {
      return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Tomato pasta
    }
    if (combined.includes('spaghetti')) {
      return 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80' // Spaghetti
    }
    if (combined.includes('pasta')) {
      return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Generic pasta
    }

    // RICE RECIPES - Very specific
    if (combined.includes('rice') && combined.includes('bowl')) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80' // Rice bowl
    }
    if (combined.includes('fried rice')) {
      return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Fried rice
    }
    if (combined.includes('rice')) {
      return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Rice dish
    }

    // VEGETARIAN RECIPES - Very specific
    if (combined.includes('salad')) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80' // Salad
    }
    if (combined.includes('vegetable') && combined.includes('stir')) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80' // Vegetable stir-fry
    }

    // BREAKFAST - Very specific
    if (combined.includes('pancake')) {
      return 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80' // Pancakes
    }
    if (combined.includes('egg') && combined.includes('toast')) {
      return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80' // Eggs on toast
    }
    if (combined.includes('toast')) {
      return 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80' // Toast
    }

    // Generic food as fallback
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'
  }

  /**
   * Generate recipes prioritizing expiring ingredients
   * This ensures users use items before they go bad
   */
  async generateRecipesForExpiringItems(
    expiringItems: Array<{ name: string; category: string; expiry_date?: string; daysLeft?: number }>,
    allPantryItems: Array<{ name: string; category: string }>,
    userId: string,
    count: number = 5
  ): Promise<GeneratedRecipe[]> {
    try {
      const preferences = await userPreferencesService.loadPreferences(userId)
      const householdSize = preferences?.household?.size ? parseInt(preferences.household.size) : 1
      
      const generatedRecipes: GeneratedRecipe[] = []

      // Sort expiring items by urgency (soonest first)
      const sortedExpiringItems = [...expiringItems].sort((a, b) => 
        (a.daysLeft || 999) - (b.daysLeft || 999)
      )

      // Get most urgent expiring item (expires soonest)
      const mostUrgent = sortedExpiringItems[0]
      
      // Find complementary items from all pantry to make complete recipes
      const proteins = [...expiringItems, ...allPantryItems].filter(item => 
        item.name.toLowerCase().includes('chicken') ||
        item.name.toLowerCase().includes('beef') ||
        item.name.toLowerCase().includes('pork') ||
        item.name.toLowerCase().includes('fish') ||
        item.name.toLowerCase().includes('salmon') ||
        item.name.toLowerCase().includes('shrimp')
      )

      const carbs = [...expiringItems, ...allPantryItems].filter(item =>
        item.name.toLowerCase().includes('rice') ||
        item.name.toLowerCase().includes('pasta') ||
        item.name.toLowerCase().includes('tortilla') ||
        item.name.toLowerCase().includes('bread') ||
        item.name.toLowerCase().includes('noodle')
      )

      const vegetables = [...expiringItems, ...allPantryItems].filter(item =>
        item.category.toLowerCase().includes('produce') ||
        item.name.toLowerCase().includes('lettuce') ||
        item.name.toLowerCase().includes('tomato') ||
        item.name.toLowerCase().includes('pepper') ||
        item.name.toLowerCase().includes('onion')
      )

      const sauces = [...expiringItems, ...allPantryItems].filter(item =>
        item.name.toLowerCase().includes('salsa') ||
        item.name.toLowerCase().includes('sauce') ||
        item.name.toLowerCase().includes('dressing')
      )

      // Prioritize recipes using the most urgent expiring item
      const urgentName = mostUrgent.name.toLowerCase()
      
      // Strategy 1: If urgent item is a protein, create protein-focused recipe
      if (urgentName.includes('chicken') || urgentName.includes('beef') || 
          urgentName.includes('pork') || urgentName.includes('fish')) {
        if (carbs.length > 0 && sauces.length > 0) {
          const recipe = this.generateProteinCarbRecipe(mostUrgent, carbs[0], sauces, householdSize)
          recipe.tags.push('Use Before Expiry', `Uses ${mostUrgent.name}`)
          recipe.description = `🚨 Use your ${mostUrgent.name} before it expires! ${recipe.description}`
          generatedRecipes.push(recipe)
        } else if (carbs.length > 0) {
          const recipe = this.generateProteinCarbRecipe(mostUrgent, carbs[0], [], householdSize)
          recipe.tags.push('Use Before Expiry', `Uses ${mostUrgent.name}`)
          recipe.description = `🚨 Use your ${mostUrgent.name} before it expires! ${recipe.description}`
          generatedRecipes.push(recipe)
        } else {
          const recipe = this.generateBasicProteinRecipe(mostUrgent, allPantryItems, householdSize)
          recipe.tags.push('Use Before Expiry', `Uses ${mostUrgent.name}`)
          recipe.description = `🚨 Use your ${mostUrgent.name} before it expires! ${recipe.description}`
          generatedRecipes.push(recipe)
        }
      }
      
      // Strategy 2: If urgent item is a vegetable, create salad or stir-fry
      else if (mostUrgent.category.toLowerCase().includes('produce')) {
        if (proteins.length > 0) {
          const recipe = this.generateVegetableProteinRecipe(mostUrgent, proteins[0], householdSize)
          recipe.tags.push('Use Before Expiry', `Uses ${mostUrgent.name}`)
          recipe.description = `🚨 Use your ${mostUrgent.name} before it expires! ${recipe.description}`
          generatedRecipes.push(recipe)
        }
      }
      
      // Strategy 3: Create additional recipes using other expiring items
      for (let i = 1; i < Math.min(sortedExpiringItems.length, 3); i++) {
        const expiringItem = sortedExpiringItems[i]
        const itemName = expiringItem.name.toLowerCase()
        
        if (itemName.includes('chicken') || itemName.includes('beef') || itemName.includes('pork')) {
          const recipe = this.generateBasicProteinRecipe(expiringItem, allPantryItems, householdSize)
          recipe.tags.push('Use Before Expiry', `Uses ${expiringItem.name}`)
          recipe.description = `⚠️ ${expiringItem.name} expires soon. ${recipe.description}`
          generatedRecipes.push(recipe)
        }
      }

      // Deduplicate and return
      const uniqueRecipes = this.deduplicateSimilarRecipes(generatedRecipes)
      return uniqueRecipes.slice(0, count)
    } catch (error) {
      console.error('Error generating expiry recipes:', error)
      return []
    }
  }

  /**
   * Generate recipe featuring expiring vegetable + protein
   */
  private generateVegetableProteinRecipe(
    vegetable: { name: string },
    protein: { name: string },
    householdSize: number
  ): GeneratedRecipe {
    const vegName = vegetable.name
    const proteinName = protein.name

    const title = `${this.capitalize(vegName)} & ${this.capitalize(proteinName)} Stir-Fry`
    
    const ingredients = [
      { name: vegName, quantity: String(2 * householdSize), unit: 'cups', inPantry: true, importance: 'critical' as const },
      { name: proteinName, quantity: String(1 * householdSize), unit: 'lb', inPantry: true, importance: 'critical' as const },
      { name: 'Oil', quantity: '2', unit: 'tbsp', inPantry: false, importance: 'important' as const },
      { name: 'Garlic', quantity: '2', unit: 'cloves', inPantry: false, importance: 'optional' as const },
      { name: 'Soy sauce', quantity: '2', unit: 'tbsp', inPantry: false, importance: 'optional' as const },
      { name: 'Salt', quantity: '1', unit: 'tsp', inPantry: false, importance: 'optional' as const },
      { name: 'Pepper', quantity: '1', unit: 'tsp', inPantry: false, importance: 'optional' as const }
    ]

    const instructions = [
      { step: 1, description: `Cut ${proteinName} into bite-sized pieces and season with salt and pepper` },
      { step: 2, description: `Heat oil in a large wok or skillet over high heat` },
      { step: 3, description: `Cook ${proteinName} until golden, 5-6 minutes. Remove and set aside` },
      { step: 4, description: `Add minced garlic to the pan and cook for 30 seconds` },
      { step: 5, description: `Add chopped ${vegName} and stir-fry for 3-4 minutes until tender-crisp` },
      { step: 6, description: `Return ${proteinName} to pan, add soy sauce, and toss to combine` },
      { step: 7, description: `Serve hot over rice or noodles if available` }
    ]

    // Calculate weighted match percentage
    let totalWeight = 0
    let matchedWeight = 0
    
    ingredients.forEach(ing => {
      const weight = ing.importance === 'critical' ? 3 : 
                    ing.importance === 'important' ? 2 : 1
      totalWeight += weight
      if (ing.inPantry) {
        matchedWeight += weight
      }
    })
    
    const matchPercentage = Math.round((matchedWeight / totalWeight) * 100)

    return {
      id: `ai_gen_expiry_${Date.now()}_${Math.random()}`,
      title,
      description: `Quick stir-fry to use up your ${vegName}`,
      image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      prep_time: 10,
      cook_time: 15,
      servings: householdSize,
      difficulty: 'Easy',
      cuisine_type: 'Asian-Inspired',
      meal_type: 'dinner',
      ingredients,
      instructions,
      tags: ['Quick', 'Healthy', 'Stir-Fry', 'AI Generated'],
      isAIGenerated: true,
      generatedFrom: [vegName, proteinName],
      matchPercentage,
      ingredientsAvailable: ingredients.filter(ing => ing.inPantry).length,
      ingredientsMissing: ingredients.filter(ing => !ing.inPantry).length
    }
  }

  // Helper: Capitalize first letter
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

export const aiRecipeGenerator = AIRecipeGenerator.getInstance()

