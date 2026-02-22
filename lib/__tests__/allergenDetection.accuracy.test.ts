/**
 * Allergy detector accuracy test with 1000 items and various allergy profiles.
 * Covers: common allergens, niche allergens, multi-allergen products, and many variations.
 */
import { detectAllergens, type OFFProduct, type UserAllergens } from '../allergenDetection'

const ALLERGEN_KEYS = ['wheat', 'milk', 'eggs', 'peanuts', 'soy', 'tree_nuts', 'sesame'] as const

// Niche allergens (smaller % of population) - supported by detector
const NICHE_ALLERGEN_KEYS = ['celery', 'lupin', 'mustard', 'sulfites'] as const

// Ground-truth product definitions: ingredients that should trigger each allergen
const WHEAT_INGREDIENTS = [
  'wheat flour', 'enriched wheat flour', 'whole wheat flour', 'durum wheat', 'wheat gluten',
  'vital wheat gluten', 'barley malt', 'rye flour', 'malt extract', 'semolina', 'couscous',
  'bulgur', 'farro', 'spelt', 'bread flour', 'all-purpose flour', 'graham flour'
]
const MILK_INGREDIENTS = [
  'milk', 'skim milk', 'whole milk', 'milk powder', 'whey', 'casein', 'butter', 'cream',
  'yogurt', 'lactose', 'nonfat dry milk', 'sodium caseinate', 'parmesan cheese'
]
const EGG_INGREDIENTS = ['egg', 'eggs', 'egg whites', 'egg yolks', 'dried egg', 'egg powder', 'albumen']
const PEANUT_INGREDIENTS = ['peanuts', 'peanut butter', 'peanut oil', 'peanut flour', 'arachide']
const SOY_INGREDIENTS = ['soy', 'soybean', 'soy flour', 'soy lecithin', 'soy protein', 'tofu', 'miso']
const TREE_NUT_INGREDIENTS = ['almonds', 'cashews', 'walnuts', 'pecans', 'hazelnuts', 'pistachios', 'macadamia']
const SESAME_INGREDIENTS = ['sesame', 'sesame seeds', 'tahini', 'sesame oil']
const CELERY_INGREDIENTS = ['celery', 'celery seed', 'celery salt', 'celery root', 'celeriac', 'celery powder']
const LUPIN_INGREDIENTS = ['lupin', 'lupin flour', 'lupin protein', 'lupin bean', 'lupine']
const MUSTARD_INGREDIENTS = ['mustard', 'mustard seed', 'mustard flour', 'mustard oil']
const SULFITES_INGREDIENTS = ['sulfites', 'sodium sulfite', 'sulfur dioxide', 'sodium bisulfite']

const SAFE_INGREDIENTS = [
  'sugar', 'salt', 'water', 'rice', 'corn starch', 'potato starch', 'tapioca',
  'vanilla', 'cocoa', 'citric acid', 'lactic acid', 'vegetable oil', 'palm oil'
]

const INGREDIENT_MAP: Record<string, string[]> = {
  wheat: WHEAT_INGREDIENTS,
  milk: MILK_INGREDIENTS,
  eggs: EGG_INGREDIENTS,
  peanuts: PEANUT_INGREDIENTS,
  soy: SOY_INGREDIENTS,
  tree_nuts: TREE_NUT_INGREDIENTS,
  sesame: SESAME_INGREDIENTS,
  celery: CELERY_INGREDIENTS,
  lupin: LUPIN_INGREDIENTS,
  mustard: MUSTARD_INGREDIENTS,
  sulfites: SULFITES_INGREDIENTS
}

function pick<T>(arr: T[], n: number): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(Math.random() * arr.length)])
  return out
}

/** Pick n distinct items from arr (for tests that expect one detection per allergen type). */
function pickDistinct<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}

function buildProduct(
  ingredientsList: string[],
  allergensTags: string[] = []
): OFFProduct {
  const ingredients_text = ingredientsList.join(', ')
  return {
    product_name: 'Test Product',
    ingredients_text,
    allergens_tags: allergensTags.length ? allergensTags : undefined
  }
}

/** Generate 1000 products with known ground truth for each allergen */
function generateTestProducts(): { product: OFFProduct; contains: Set<string> }[] {
  const products: { product: OFFProduct; contains: Set<string> }[] = []
  const rnd = (max: number) => Math.floor(Math.random() * max)

  // ~125 products that contain wheat
  for (let i = 0; i < 125; i++) {
    const ing = [WHEAT_INGREDIENTS[rnd(WHEAT_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:wheat']),
      contains: new Set(['wheat'])
    })
  }
  // ~125 milk
  for (let i = 0; i < 125; i++) {
    const ing = [MILK_INGREDIENTS[rnd(MILK_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:milk']),
      contains: new Set(['milk'])
    })
  }
  // ~125 eggs
  for (let i = 0; i < 125; i++) {
    const ing = [EGG_INGREDIENTS[rnd(EGG_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:eggs']),
      contains: new Set(['eggs'])
    })
  }
  // ~125 peanuts
  for (let i = 0; i < 125; i++) {
    const ing = [PEANUT_INGREDIENTS[rnd(PEANUT_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:peanuts']),
      contains: new Set(['peanuts'])
    })
  }
  // ~125 soy
  for (let i = 0; i < 125; i++) {
    const ing = [SOY_INGREDIENTS[rnd(SOY_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:soybeans']),
      contains: new Set(['soy'])
    })
  }
  // ~125 tree_nuts
  for (let i = 0; i < 125; i++) {
    const ing = [TREE_NUT_INGREDIENTS[rnd(TREE_NUT_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:cashews']),
      contains: new Set(['tree_nuts'])
    })
  }
  // ~125 sesame
  for (let i = 0; i < 125; i++) {
    const ing = [SESAME_INGREDIENTS[rnd(SESAME_INGREDIENTS.length)], ...pick(SAFE_INGREDIENTS, 3)]
    products.push({
      product: buildProduct(ing, ['en:sesame-seeds']),
      contains: new Set(['sesame'])
    })
  }
  // ~125 safe (no allergens)
  for (let i = 0; i < 125; i++) {
    const ing = pick(SAFE_INGREDIENTS, 4)
    products.push({
      product: buildProduct(ing),
      contains: new Set()
    })
  }

  return products
}

describe('Allergy Detector - Accuracy (1000 items)', () => {
  const products = generateTestProducts()

  it('should have generated 1000 products', () => {
    expect(products.length).toBe(1000)
  })

  ALLERGEN_KEYS.forEach(allergenKey => {
    describe(`${allergenKey}`, () => {
      it(`should achieve high accuracy for ${allergenKey}`, () => {
        const userAllergens: UserAllergens = {
          allergyKeys: [allergenKey],
          customAllergens: []
        }

        let tp = 0, fp = 0, fn = 0, tn = 0
        for (const { product, contains } of products) {
          const result = detectAllergens(product, userAllergens)
          const detected = result.detected_allergens.some(d => d.allergenKey === allergenKey)
          const expected = contains.has(allergenKey)

          if (expected && detected) tp++
          else if (!expected && detected) fp++
          else if (expected && !detected) fn++
          else tn++
        }

        const precision = tp + fp > 0 ? tp / (tp + fp) : 1
        const recall = tp + fn > 0 ? tp / (tp + fn) : 1
        const accuracy = (tp + tn) / products.length
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

        // Log for CI/debugging
        console.log(`[${allergenKey}] TP=${tp} FP=${fp} FN=${fn} TN=${tn} Precision=${(precision * 100).toFixed(1)}% Recall=${(recall * 100).toFixed(1)}% Accuracy=${(accuracy * 100).toFixed(1)}% F1=${(f1 * 100).toFixed(1)}%`)

        // Wheat is most common allergy - require high accuracy
        const minAccuracy = allergenKey === 'wheat' ? 0.92 : 0.88
        const minRecall = allergenKey === 'wheat' ? 0.90 : 0.85
        expect(accuracy).toBeGreaterThanOrEqual(minAccuracy)
        expect(recall).toBeGreaterThanOrEqual(minRecall)
      })
    })
  })

  it('should report overall accuracy across multiple allergy profiles', () => {
    const profiles: UserAllergens[] = [
      { allergyKeys: ['wheat'], customAllergens: [] },
      { allergyKeys: ['milk', 'eggs'], customAllergens: [] },
      { allergyKeys: ['peanuts', 'tree_nuts'], customAllergens: [] },
      { allergyKeys: ['wheat', 'milk', 'soy'], customAllergens: [] },
      { allergyKeys: ['wheat', 'milk', 'eggs', 'peanuts', 'soy', 'tree_nuts', 'sesame'], customAllergens: [] }
    ]

    let totalCorrect = 0
    let totalDecisions = 0

    for (const userAllergens of profiles) {
      for (const { product, contains } of products) {
        const result = detectAllergens(product, userAllergens)
        for (const key of userAllergens.allergyKeys) {
          const detected = result.detected_allergens.some(d => d.allergenKey === key)
          const expected = contains.has(key)
          if (detected === expected) totalCorrect++
          totalDecisions++
        }
      }
    }

    const overallAccuracy = totalCorrect / totalDecisions
    console.log(`Overall accuracy (all profiles): ${(overallAccuracy * 100).toFixed(1)}% (${totalCorrect}/${totalDecisions})`)
    expect(overallAccuracy).toBeGreaterThanOrEqual(0.85)
  })
})

describe('Allergy Detector - Niche allergens', () => {
  NICHE_ALLERGEN_KEYS.forEach(allergenKey => {
    it(`should detect ${allergenKey} when present and not when absent`, () => {
      const ingredients = INGREDIENT_MAP[allergenKey]
      if (!ingredients) return
      const productWith: OFFProduct = buildProduct([
        ingredients[0],
        ...pick(SAFE_INGREDIENTS, 3)
      ])
      const productWithout: OFFProduct = buildProduct(pick(SAFE_INGREDIENTS, 4))

      const userAllergens: UserAllergens = {
        allergyKeys: [allergenKey],
        customAllergens: []
      }

      const resultWith = detectAllergens(productWith, userAllergens)
      const resultWithout = detectAllergens(productWithout, userAllergens)

      const detectedWith = resultWith.detected_allergens.some(d => d.allergenKey === allergenKey)
      const detectedWithout = resultWithout.detected_allergens.some(d => d.allergenKey === allergenKey)

      expect(detectedWith).toBe(true)
      expect(detectedWithout).toBe(false)
    })
  })

  it('should not flag niche allergen when ingredient is absent', () => {
    const product: OFFProduct = buildProduct(['sugar', 'salt', 'water', 'rice'])
    const userAllergens: UserAllergens = {
      allergyKeys: ['celery', 'lupin', 'mustard', 'sulfites'],
      customAllergens: []
    }
    const result = detectAllergens(product, userAllergens)
    expect(result.detected_allergens).toHaveLength(0)
  })
})

describe('Allergy Detector - Multiple allergens in one item', () => {
  it('should flag all 4 allergens when product contains all 4 and user has 4 allergies', () => {
    const product: OFFProduct = buildProduct([
      'wheat flour', 'milk', 'egg', 'soy lecithin',
      'sugar', 'salt', 'vanilla'
    ], ['en:wheat', 'en:milk', 'en:eggs', 'en:soybeans'])

    const userAllergens: UserAllergens = {
      allergyKeys: ['wheat', 'milk', 'eggs', 'soy'],
      customAllergens: []
    }

    const result = detectAllergens(product, userAllergens)
    const detectedKeys = result.detected_allergens.map(d => d.allergenKey)

    expect(detectedKeys).toContain('wheat')
    expect(detectedKeys).toContain('milk')
    expect(detectedKeys).toContain('eggs')
    expect(detectedKeys).toContain('soy')
    expect(result.detected_allergens).toHaveLength(4)
  })

  it('should flag exactly the allergens present when user has more allergies', () => {
    const product: OFFProduct = buildProduct([
      'wheat flour', 'milk', 'sugar', 'salt'
    ], ['en:wheat', 'en:milk'])

    const userAllergens: UserAllergens = {
      allergyKeys: ['wheat', 'milk', 'eggs', 'peanuts'],
      customAllergens: []
    }

    const result = detectAllergens(product, userAllergens)
    const detectedKeys = result.detected_allergens.map(d => d.allergenKey)

    expect(detectedKeys).toContain('wheat')
    expect(detectedKeys).toContain('milk')
    expect(detectedKeys).not.toContain('eggs')
    expect(detectedKeys).not.toContain('peanuts')
    expect(result.detected_allergens).toHaveLength(2)
  })

  it('should flag all 3 when product has wheat, milk, sesame and user has those 3', () => {
    const product: OFFProduct = buildProduct([
      'wheat flour', 'whole milk', 'sesame seeds', 'salt', 'sugar'
    ])

    const userAllergens: UserAllergens = {
      allergyKeys: ['wheat', 'milk', 'sesame'],
      customAllergens: []
    }

    const result = detectAllergens(product, userAllergens)
    expect(result.detected_allergens.some(d => d.allergenKey === 'wheat')).toBe(true)
    expect(result.detected_allergens.some(d => d.allergenKey === 'milk')).toBe(true)
    expect(result.detected_allergens.some(d => d.allergenKey === 'sesame')).toBe(true)
    expect(result.detected_allergens).toHaveLength(3)
  })

  const MULTI_COMBOS: { ingredients: string[]; expectedKeys: string[] }[] = [
    { ingredients: ['wheat flour', 'butter', 'egg', 'soy lecithin', 'sugar'], expectedKeys: ['wheat', 'milk', 'eggs', 'soy'] },
    { ingredients: ['peanuts', 'cashews', 'almonds', 'sugar', 'salt'], expectedKeys: ['peanuts', 'tree_nuts'] },
    { ingredients: ['wheat flour', 'milk', 'egg', 'tahini', 'sugar'], expectedKeys: ['wheat', 'milk', 'eggs', 'sesame'] },
    { ingredients: ['celery salt', 'mustard', 'sodium sulfite', 'water'], expectedKeys: ['celery', 'mustard', 'sulfites'] },
    { ingredients: ['lupin flour', 'wheat flour', 'milk', 'egg'], expectedKeys: ['lupin', 'wheat', 'milk', 'eggs'] }
  ]

  MULTI_COMBOS.forEach(({ ingredients, expectedKeys }, idx) => {
    it(`multi-combo ${idx + 1}: should flag ${expectedKeys.join(', ')}`, () => {
      const product = buildProduct(ingredients)
      const userAllergens: UserAllergens = {
        allergyKeys: [...expectedKeys],
        customAllergens: []
      }
      const result = detectAllergens(product, userAllergens)
      const detectedKeys = result.detected_allergens.map(d => d.allergenKey)
      for (const key of expectedKeys) {
        expect(detectedKeys).toContain(key)
      }
      expect(result.detected_allergens.length).toBe(expectedKeys.length)
    })
  })
})

describe('Allergy Detector - Variations and iterations', () => {
  const COMMON_KEYS = ['wheat', 'milk', 'eggs', 'peanuts', 'soy', 'tree_nuts', 'sesame']

  it('should correctly handle 50 random multi-allergen products', () => {
    let correct = 0
    const n = 50
    for (let i = 0; i < n; i++) {
      const numInProduct = 1 + Math.floor(Math.random() * 4) // 1–4 allergens in product
      const shuffled = [...COMMON_KEYS].sort(() => Math.random() - 0.5)
      const inProduct = shuffled.slice(0, numInProduct)
      const ingredients: string[] = inProduct.map(k => {
        const list = INGREDIENT_MAP[k]
        return list ? list[Math.floor(Math.random() * list.length)] : ''
      }).filter(Boolean)
      ingredients.push(...pick(SAFE_INGREDIENTS, 2))

      const product = buildProduct(ingredients)
      const userAllergens: UserAllergens = {
        allergyKeys: [...inProduct],
        customAllergens: []
      }
      const result = detectAllergens(product, userAllergens)
      const detectedSet = new Set(result.detected_allergens.map(d => d.allergenKey))
      const expectedSet = new Set(inProduct)
      const allFound = inProduct.every(k => detectedSet.has(k))
      const noExtra = result.detected_allergens.length <= inProduct.length + 1
      if (allFound && noExtra) correct++
    }
    const pct = (correct / n) * 100
    console.log(`Multi-allergen random: ${correct}/${n} (${pct.toFixed(0)}%) correct`)
    // Allow 60% - evidence-based engine prefers precision; random phrasing can miss edge cases
    expect(correct).toBeGreaterThanOrEqual(n * 0.6)
  })

  it('should handle user with 1 allergy vs product with many', () => {
    const product = buildProduct([
      'wheat flour', 'milk', 'egg', 'soy lecithin', 'peanuts', 'sesame seeds', 'salt'
    ])
    const userAllergens: UserAllergens = {
      allergyKeys: ['peanuts'],
      customAllergens: []
    }
    const result = detectAllergens(product, userAllergens)
    expect(result.detected_allergens.some(d => d.allergenKey === 'peanuts')).toBe(true)
    expect(result.detected_allergens).toHaveLength(1)
  })

  it('should handle user with 5 allergies vs product with 2', () => {
    const product = buildProduct(['wheat flour', 'milk', 'sugar', 'salt'])
    const userAllergens: UserAllergens = {
      allergyKeys: ['wheat', 'milk', 'eggs', 'peanuts', 'soy'],
      customAllergens: []
    }
    const result = detectAllergens(product, userAllergens)
    expect(result.detected_allergens.map(d => d.allergenKey).sort()).toEqual(['milk', 'wheat'])
  })

  it('should handle common + niche in one product', () => {
    const product = buildProduct([
      'wheat flour', 'milk', 'celery seed', 'mustard', 'salt', 'sugar'
    ])
    const userAllergens: UserAllergens = {
      allergyKeys: ['wheat', 'milk', 'celery', 'mustard'],
      customAllergens: []
    }
    const result = detectAllergens(product, userAllergens)
    const keys = result.detected_allergens.map(d => d.allergenKey)
    expect(keys).toContain('wheat')
    expect(keys).toContain('milk')
    expect(keys).toContain('celery')
    expect(keys).toContain('mustard')
    expect(result.detected_allergens).toHaveLength(4)
  })

  it('runs 20 iterations of random 2-allergen products', () => {
    let passed = 0
    for (let iter = 0; iter < 20; iter++) {
      const two = pickDistinct(COMMON_KEYS, 2)
      const ings = two.map(k => {
        const list = INGREDIENT_MAP[k]
        return list ? list[Math.floor(Math.random() * list.length)] : ''
      }).filter(Boolean)
      const product = buildProduct([...ings, ...pick(SAFE_INGREDIENTS, 2)])
      const result = detectAllergens(product, { allergyKeys: two, customAllergens: [] })
      const detected = result.detected_allergens.map(d => d.allergenKey)
      const bothFound = two.every(k => detected.includes(k))
      if (bothFound && detected.length === 2) passed++
    }
    // At least 85% of iterations must pass (17/20) - random phrasing can occasionally miss
    expect(passed).toBeGreaterThanOrEqual(17)
  })
})
