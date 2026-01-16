// SAVR Intelligent Ingredient Substitution Engine

export interface SubstitutionOption {
  substitute: string
  ratio: string // e.g., "1:1" or "2:1"
  confidence: number
  reason: string
  impact: {
    taste: 'identical' | 'similar' | 'different'
    texture: 'identical' | 'similar' | 'different'
    nutrition: 'better' | 'similar' | 'worse'
    cost: 'cheaper' | 'similar' | 'expensive'
  }
  notes?: string
  category: 'exact' | 'close' | 'creative'
}

export interface IngredientAnalysis {
  ingredient: string
  role: 'protein' | 'carb' | 'fat' | 'flavor' | 'binding' | 'leavening' | 'liquid' | 'sweetener' | 'other'
  importance: 'critical' | 'important' | 'optional'
  canOmit: boolean
  commonIn: string[] // cuisines or dish types
}

class IngredientSubstitutionEngine {
  private static instance: IngredientSubstitutionEngine
  private substitutionDatabase: Map<string, SubstitutionOption[]> = new Map()

  static getInstance(): IngredientSubstitutionEngine {
    if (!IngredientSubstitutionEngine.instance) {
      IngredientSubstitutionEngine.instance = new IngredientSubstitutionEngine()
      IngredientSubstitutionEngine.instance.initializeDatabase()
    }
    return IngredientSubstitutionEngine.instance
  }

  /**
   * Initialize comprehensive substitution database
   */
  private initializeDatabase() {
    // Dairy Substitutions
    this.addSubstitutions('milk', [
      {
        substitute: 'Almond milk',
        ratio: '1:1',
        confidence: 0.95,
        reason: 'Perfect dairy-free alternative',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Oat milk',
        ratio: '1:1',
        confidence: 0.95,
        reason: 'Creamy dairy-free option',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Coconut milk',
        ratio: '1:1',
        confidence: 0.85,
        reason: 'Rich, creamy alternative',
        impact: { taste: 'different', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        notes: 'May add coconut flavor',
        category: 'close'
      }
    ])

    this.addSubstitutions('butter', [
      {
        substitute: 'Coconut oil',
        ratio: '1:1',
        confidence: 0.90,
        reason: 'Great for baking and cooking',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Olive oil',
        ratio: '3/4 cup oil per 1 cup butter',
        confidence: 0.85,
        reason: 'Healthier fat option',
        impact: { taste: 'different', texture: 'similar', nutrition: 'better', cost: 'similar' },
        notes: 'Best for savory dishes',
        category: 'close'
      },
      {
        substitute: 'Applesauce',
        ratio: '1:1',
        confidence: 0.75,
        reason: 'Low-fat baking substitute',
        impact: { taste: 'different', texture: 'different', nutrition: 'better', cost: 'cheaper' },
        notes: 'For baking only; reduces fat',
        category: 'creative'
      }
    ])

    this.addSubstitutions('eggs', [
      {
        substitute: 'Flax egg (1 tbsp ground flaxseed + 3 tbsp water)',
        ratio: '1 flax egg per egg',
        confidence: 0.85,
        reason: 'Popular vegan egg substitute',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'better', cost: 'similar' },
        notes: 'Let sit for 5 minutes before using',
        category: 'close'
      },
      {
        substitute: 'Chia egg (1 tbsp chia seeds + 3 tbsp water)',
        ratio: '1 chia egg per egg',
        confidence: 0.85,
        reason: 'Vegan binding agent',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'better', cost: 'similar' },
        category: 'close'
      },
      {
        substitute: 'Applesauce',
        ratio: '1/4 cup per egg',
        confidence: 0.80,
        reason: 'Moisture and binding',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'better', cost: 'cheaper' },
        notes: 'Works well in cakes and muffins',
        category: 'close'
      }
    ])

    // Baking Substitutions
    this.addSubstitutions('all-purpose flour', [
      {
        substitute: 'Whole wheat flour',
        ratio: '1:1 (or 7/8 cup per 1 cup)',
        confidence: 0.85,
        reason: 'More nutritious alternative',
        impact: { taste: 'similar', texture: 'different', nutrition: 'better', cost: 'similar' },
        notes: 'Use slightly less for lighter texture',
        category: 'close'
      },
      {
        substitute: 'Gluten-free flour blend',
        ratio: '1:1',
        confidence: 0.80,
        reason: 'For gluten sensitivities',
        impact: { taste: 'similar', texture: 'different', nutrition: 'similar', cost: 'expensive' },
        category: 'close'
      },
      {
        substitute: 'Almond flour',
        ratio: '1:1',
        confidence: 0.70,
        reason: 'Low-carb, high-protein option',
        impact: { taste: 'different', texture: 'different', nutrition: 'better', cost: 'expensive' },
        notes: 'Works best in cookies and quick breads',
        category: 'creative'
      }
    ])

    this.addSubstitutions('white sugar', [
      {
        substitute: 'Honey',
        ratio: '3/4 cup per 1 cup sugar',
        confidence: 0.85,
        reason: 'Natural sweetener',
        impact: { taste: 'different', texture: 'similar', nutrition: 'similar', cost: 'expensive' },
        notes: 'Reduce liquid in recipe by 1/4 cup',
        category: 'close'
      },
      {
        substitute: 'Maple syrup',
        ratio: '3/4 cup per 1 cup sugar',
        confidence: 0.85,
        reason: 'Natural, flavorful sweetener',
        impact: { taste: 'different', texture: 'similar', nutrition: 'similar', cost: 'expensive' },
        notes: 'Reduce liquid in recipe',
        category: 'close'
      },
      {
        substitute: 'Coconut sugar',
        ratio: '1:1',
        confidence: 0.90,
        reason: 'Lower glycemic index',
        impact: { taste: 'similar', texture: 'identical', nutrition: 'better', cost: 'expensive' },
        category: 'exact'
      }
    ])

    // Protein Substitutions
    this.addSubstitutions('chicken breast', [
      {
        substitute: 'Turkey breast',
        ratio: '1:1',
        confidence: 0.95,
        reason: 'Very similar lean protein',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Tofu',
        ratio: '1:1',
        confidence: 0.85,
        reason: 'Vegetarian protein alternative',
        impact: { taste: 'different', texture: 'different', nutrition: 'similar', cost: 'cheaper' },
        notes: 'Press and marinate for best results',
        category: 'close'
      },
      {
        substitute: 'Chickpeas',
        ratio: '1 cup chickpeas per 4 oz chicken',
        confidence: 0.75,
        reason: 'Plant-based protein',
        impact: { taste: 'different', texture: 'different', nutrition: 'similar', cost: 'cheaper' },
        category: 'creative'
      }
    ])

    this.addSubstitutions('ground beef', [
      {
        substitute: 'Ground turkey',
        ratio: '1:1',
        confidence: 0.95,
        reason: 'Leaner alternative',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'better', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Lentils',
        ratio: '1:1',
        confidence: 0.80,
        reason: 'Plant-based, high protein',
        impact: { taste: 'different', texture: 'different', nutrition: 'better', cost: 'cheaper' },
        notes: 'Great for tacos, pasta sauce',
        category: 'close'
      },
      {
        substitute: 'Mushrooms (finely chopped)',
        ratio: '1:1',
        confidence: 0.75,
        reason: 'Meaty texture and umami',
        impact: { taste: 'different', texture: 'similar', nutrition: 'better', cost: 'cheaper' },
        notes: 'Mix with beans for more protein',
        category: 'creative'
      }
    ])

    // Flavor Enhancers
    this.addSubstitutions('garlic', [
      {
        substitute: 'Garlic powder',
        ratio: '1/8 tsp per clove',
        confidence: 0.90,
        reason: 'Convenient alternative',
        impact: { taste: 'similar', texture: 'different', nutrition: 'similar', cost: 'similar' },
        category: 'exact'
      },
      {
        substitute: 'Shallots',
        ratio: '1:1',
        confidence: 0.80,
        reason: 'Milder, sweet flavor',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'expensive' },
        category: 'close'
      }
    ])

    this.addSubstitutions('fresh herbs', [
      {
        substitute: 'Dried herbs',
        ratio: '1 tsp dried per 1 tbsp fresh',
        confidence: 0.85,
        reason: 'More concentrated flavor',
        impact: { taste: 'similar', texture: 'different', nutrition: 'similar', cost: 'cheaper' },
        category: 'exact'
      }
    ])

    // Condiments & Sauces
    this.addSubstitutions('soy sauce', [
      {
        substitute: 'Tamari',
        ratio: '1:1',
        confidence: 0.95,
        reason: 'Gluten-free soy sauce',
        impact: { taste: 'identical', texture: 'identical', nutrition: 'similar', cost: 'expensive' },
        category: 'exact'
      },
      {
        substitute: 'Coconut aminos',
        ratio: '1:1',
        confidence: 0.85,
        reason: 'Soy-free alternative',
        impact: { taste: 'similar', texture: 'similar', nutrition: 'similar', cost: 'expensive' },
        notes: 'Slightly sweeter',
        category: 'close'
      },
      {
        substitute: 'Worcestershire sauce + water',
        ratio: '1 part Worcestershire + 1 part water',
        confidence: 0.70,
        reason: 'Umami-rich substitute',
        impact: { taste: 'different', texture: 'similar', nutrition: 'similar', cost: 'similar' },
        category: 'creative'
      }
    ])
  }

  /**
   * Add substitutions to database
   */
  private addSubstitutions(ingredient: string, substitutions: SubstitutionOption[]) {
    const key = ingredient.toLowerCase().trim()
    this.substitutionDatabase.set(key, substitutions)
  }

  /**
   * Find substitutions for an ingredient
   */
  async findSubstitutions(
    ingredient: string,
    userId?: string,
    constraints?: {
      dietary?: string[] // vegetarian, vegan, gluten-free, etc.
      budget?: 'low' | 'medium' | 'high'
      preferHealthy?: boolean
    }
  ): Promise<SubstitutionOption[]> {
    const key = ingredient.toLowerCase().trim()
    let substitutions = this.substitutionDatabase.get(key) || []

    // Try partial matches
    if (substitutions.length === 0) {
      substitutions = this.findPartialMatches(ingredient)
    }

    // If still no matches, use AI to suggest creative substitutions
    if (substitutions.length === 0) {
      substitutions = await this.generateCreativeSubstitutions(ingredient)
    }

    // Apply user constraints
    if (constraints) {
      substitutions = this.filterByConstraints(substitutions, constraints)
    }

    // Sort by confidence and user preferences
    substitutions.sort((a, b) => {
      if (constraints?.budget === 'low') {
        // Prioritize cheaper options
        if (a.impact.cost === 'cheaper' && b.impact.cost !== 'cheaper') return -1
        if (b.impact.cost === 'cheaper' && a.impact.cost !== 'cheaper') return 1
      }
      if (constraints?.preferHealthy) {
        // Prioritize healthier options
        if (a.impact.nutrition === 'better' && b.impact.nutrition !== 'better') return -1
        if (b.impact.nutrition === 'better' && a.impact.nutrition !== 'better') return 1
      }
      return b.confidence - a.confidence
    })

    return substitutions
  }

  /**
   * Find partial matches for ingredient
   */
  private findPartialMatches(ingredient: string): SubstitutionOption[] {
    const ingredientLower = ingredient.toLowerCase()
    const matches: SubstitutionOption[] = []

    // Check for keyword matches
    for (const [key, subs] of this.substitutionDatabase.entries()) {
      if (ingredientLower.includes(key) || key.includes(ingredientLower)) {
        matches.push(...subs)
      }
    }

    return matches
  }

  /**
   * Generate creative substitutions using AI logic
   */
  private async generateCreativeSubstitutions(ingredient: string): Promise<SubstitutionOption[]> {
    // Analyze ingredient role
    const analysis = this.analyzeIngredient(ingredient)
    const substitutions: SubstitutionOption[] = []

    // Suggest based on role
    if (analysis.role === 'protein') {
      substitutions.push({
        substitute: 'Beans or lentils',
        ratio: '1:1',
        confidence: 0.70,
        reason: 'Plant-based protein alternative',
        impact: { taste: 'different', texture: 'different', nutrition: 'similar', cost: 'cheaper' },
        category: 'creative'
      })
    } else if (analysis.role === 'flavor') {
      if (analysis.canOmit) {
        substitutions.push({
          substitute: 'Omit (optional ingredient)',
          ratio: 'N/A',
          confidence: 0.60,
          reason: 'This ingredient can be left out',
          impact: { taste: 'different', texture: 'identical', nutrition: 'similar', cost: 'cheaper' },
          category: 'creative'
        })
      }
    }

    return substitutions
  }

  /**
   * Analyze ingredient to understand its role
   */
  analyzeIngredient(ingredient: string): IngredientAnalysis {
    const ingredientLower = ingredient.toLowerCase()

    // Protein detection
    if (this.matchesAny(ingredientLower, ['chicken', 'beef', 'pork', 'fish', 'tofu', 'eggs', 'beans'])) {
      return {
        ingredient,
        role: 'protein',
        importance: 'critical',
        canOmit: false,
        commonIn: ['main dishes', 'entrees']
      }
    }

    // Carb detection
    if (this.matchesAny(ingredientLower, ['rice', 'pasta', 'bread', 'flour', 'potato', 'quinoa'])) {
      return {
        ingredient,
        role: 'carb',
        importance: 'important',
        canOmit: false,
        commonIn: ['main dishes', 'sides']
      }
    }

    // Fat detection
    if (this.matchesAny(ingredientLower, ['butter', 'oil', 'cream', 'cheese'])) {
      return {
        ingredient,
        role: 'fat',
        importance: 'important',
        canOmit: false,
        commonIn: ['all dishes']
      }
    }

    // Binding agents
    if (this.matchesAny(ingredientLower, ['egg', 'flour', 'cornstarch'])) {
      return {
        ingredient,
        role: 'binding',
        importance: 'critical',
        canOmit: false,
        commonIn: ['baking', 'sauces']
      }
    }

    // Flavor enhancers (often optional)
    if (this.matchesAny(ingredientLower, ['garlic', 'onion', 'herbs', 'spices', 'pepper'])) {
      return {
        ingredient,
        role: 'flavor',
        importance: 'optional',
        canOmit: true,
        commonIn: ['all dishes']
      }
    }

    // Default
    return {
      ingredient,
      role: 'other',
      importance: 'optional',
      canOmit: true,
      commonIn: []
    }
  }

  /**
   * Filter substitutions by constraints
   */
  private filterByConstraints(
    substitutions: SubstitutionOption[],
    constraints: any
  ): SubstitutionOption[] {
    return substitutions.filter(sub => {
      // Dietary constraints
      if (constraints.dietary?.includes('vegan')) {
        const nonVeganKeywords = ['milk', 'butter', 'eggs', 'cheese', 'honey', 'meat', 'fish', 'chicken', 'beef']
        if (this.matchesAny(sub.substitute.toLowerCase(), nonVeganKeywords)) {
          return false
        }
      }

      if (constraints.dietary?.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'meat']
        if (this.matchesAny(sub.substitute.toLowerCase(), meatKeywords)) {
          return false
        }
      }

      if (constraints.dietary?.includes('gluten-free')) {
        const glutenKeywords = ['flour', 'bread', 'pasta', 'wheat', 'soy sauce']
        if (this.matchesAny(sub.substitute.toLowerCase(), glutenKeywords)) {
          return false
        }
      }

      // Budget constraints
      if (constraints.budget === 'low' && sub.impact.cost === 'expensive') {
        return false
      }

      return true
    })
  }

  /**
   * Batch find substitutions for multiple ingredients
   */
  async findBatchSubstitutions(
    ingredients: string[],
    userId?: string,
    constraints?: any
  ): Promise<Map<string, SubstitutionOption[]>> {
    const results = new Map<string, SubstitutionOption[]>()

    for (const ingredient of ingredients) {
      const subs = await this.findSubstitutions(ingredient, userId, constraints)
      if (subs.length > 0) {
        results.set(ingredient, subs)
      }
    }

    return results
  }

  /**
   * Get smart swap suggestion (best single option)
   */
  async getSmartSwap(
    ingredient: string,
    userId?: string,
    constraints?: any
  ): Promise<SubstitutionOption | null> {
    const substitutions = await this.findSubstitutions(ingredient, userId, constraints)
    return substitutions.length > 0 ? substitutions[0] : null
  }

  /**
   * Helper: Check if string matches any in array
   */
  private matchesAny(str: string, keywords: string[]): boolean {
    return keywords.some(keyword => str.includes(keyword))
  }
}

export const ingredientSubstitutionEngine = IngredientSubstitutionEngine.getInstance()

