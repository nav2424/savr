// Unit tests for enterprise-grade allergen detection
import { detectAllergens, type OFFProduct, type UserAllergens } from '../allergenDetection'

describe('allergenDetection', () => {
  describe('Priority A: Structured fields (HIGH confidence)', () => {
    it('should detect MAY_CONTAIN from allergens_tags when no ingredient evidence (conflict resolver)', () => {
      // Tags-only = MAY_CONTAIN; never confirm CONTAINS without ingredient evidence
      const product: OFFProduct = {
        allergens_tags: ['en:milk', 'en:soybeans'],
        ingredients_text: 'Water, sugar, salt'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'soy'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(2)
      expect(result.detected_allergens[0].allergenKey).toBe('milk')
      expect(result.detected_allergens[0].matchType).toBe('MAY_CONTAIN')
      expect(result.detected_allergens[0].source).toBe('allergens_tags')
    })

    it('should detect MAY_CONTAIN from traces_tags', () => {
      const product: OFFProduct = {
        traces_tags: ['en:milk', 'en:tree-nuts'],
        ingredients_text: 'Wheat flour, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(1)
      expect(result.detected_allergens[0].allergenKey).toBe('milk')
      expect(result.detected_allergens[0].matchType).toBe('MAY_CONTAIN')
      expect(result.detected_allergens[0].source).toBe('traces_tags')
      expect(result.detected_allergens[0].confidence).toBe('HIGH')
    })

    it('should map cashews to tree_nuts from ingredients text', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:cashews'],
        ingredients_text: 'Chocolate, cashews'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['tree_nuts'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(1)
      expect(result.detected_allergens[0].allergenKey).toBe('tree_nuts')
      expect(result.detected_allergens[0].matchType).toBe('CONTAINS')
      expect(result.detected_allergens[0].evidence.toLowerCase()).toContain('cashew')
    })
  })

  describe('False positive prevention', () => {
    it('should NOT match "lactic acid" as milk', () => {
      const product: OFFProduct = {
        ingredients_text: 'Water, lactic acid, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(0)
      expect(result.safe_allergens).toContain('milk')
    })

    it('should NOT match "dark chocolate" as milk', () => {
      const product: OFFProduct = {
        ingredients_text: 'Dark chocolate, sugar, cocoa'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(0)
    })

    it('should NOT match "milk-free" as milk', () => {
      const product: OFFProduct = {
        ingredients_text: 'Milk-free chocolate, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(0)
      expect(result.safe_allergens).toContain('milk')
    })

    it('should NOT match "gluten-free" as wheat', () => {
      const product: OFFProduct = {
        ingredients_text: 'Gluten-free oats, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(0)
    })

    it('should NOT match "soy lecithin" as soy when it says "sunflower lecithin"', () => {
      const product: OFFProduct = {
        ingredients_text: 'Chocolate, sunflower lecithin, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['soy'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens).toHaveLength(0)
    })

    it('should match "soy lecithin" as soy', () => {
      const product: OFFProduct = {
        ingredients_text: 'Chocolate, soy lecithin, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['soy'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const soyMatch = result.detected_allergens.find(d => d.allergenKey === 'soy')
      expect(soyMatch).toBeDefined()
    })
  })

  describe('MAY_CONTAIN vs CONTAINS distinction', () => {
    it('should treat "may contain milk" as MAY_CONTAIN, not CONTAINS', () => {
      const product: OFFProduct = {
        ingredients_text: 'Wheat flour, sugar, salt. May contain milk.'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('MAY_CONTAIN')
    })

    it('should NOT downgrade to MAY_CONTAIN if allergen is in ingredients and also in a may-contain sentence', () => {
      const product: OFFProduct = {
        ingredients_text: 'Wheat flour, sugar, milk. May contain milk.'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('CONTAINS')
    })

    it('should never upgrade MAY_CONTAIN to CONTAINS', () => {
      const product: OFFProduct = {
        traces_tags: ['en:milk'],
        ingredients_text: 'Wheat flour, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch?.matchType).toBe('MAY_CONTAIN')
      expect(milkMatch?.matchType).not.toBe('CONTAINS')
    })
  })

  describe('Conflicting data handling', () => {
    it('should detect milk from allergens_tags when no ingredients (MAY_CONTAIN)', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients_analysis_tags: ['en:vegan', 'en:dairy-free']
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      expect(result.detected_allergens[0].allergenKey).toBe('milk')
      expect(result.detected_allergens[0].matchType).toBe('MAY_CONTAIN')
    })
  })

  describe('Custom allergens', () => {
    it('should detect custom allergens with word boundary matching', () => {
      const product: OFFProduct = {
        ingredients_text: 'Water, artificial flavoring, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: [],
        customAllergens: ['artificial flavoring']
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const customMatch = result.detected_allergens.find(d =>
        d.allergenKey === 'artificial flavoring' || d.allergenKey === 'artificial_flavoring'
      )
      expect(customMatch).toBeDefined()
    })

    it('should NOT match custom allergen as substring (e.g., "nut" should not match "coconut")', () => {
      const product: OFFProduct = {
        ingredients_text: 'Coconut oil, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: [],
        customAllergens: ['nut']
      }

      const result = detectAllergens(product, userAllergens)

      // "nut" should not match "coconut" (word boundary prevents this)
      const nutMatch = result.detected_allergens.find(d => d.allergenKey === 'nut')
      expect(nutMatch).toBeUndefined()
    })
  })

  describe('Multilingual support', () => {
    it('should detect French allergens', () => {
      const product: OFFProduct = {
        allergens_tags: ['fr:lait', 'fr:oeufs'],
        ingredients_text_fr: 'Farine de blé, lait, sucre'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'eggs'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThanOrEqual(2)
      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      const eggMatch = result.detected_allergens.find(d => d.allergenKey === 'eggs')
      expect(milkMatch).toBeDefined()
      expect(eggMatch).toBeDefined()
    })
  })

  describe('Confidence scoring', () => {
    it('should be HIGH when allergens_tags used', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:milk']
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.confidence).toBe('HIGH')
    })

    it('should be HIGH when ingredients used (structured or text)', () => {
      const product: OFFProduct = {
        ingredients: [
          { text: 'Wheat flour, whey powder, sugar' }
        ]
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.confidence).toBe('HIGH')
    })

    it('should be HIGH when ingredients_text has usable data', () => {
      const product: OFFProduct = {
        ingredients_text: 'Wheat flour, whey powder, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.confidence).toBe('HIGH')
    })
  })

  describe('Safe allergens tracking', () => {
    it('should mark allergens as safe when explicitly checked and not found', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:soy'],
        ingredients_text: 'Wheat flour, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'soy'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      expect(result.detected_allergens[0].allergenKey).toBe('soy')
      expect(result.safe_allergens).toContain('milk')
    })
  })

  describe('Wheat detection', () => {
    it('should detect wheat when ingredients say "wheat flour" or "enriched flour"', () => {
      const product: OFFProduct = {
        ingredients_text: 'Wheat flour, milk, salt, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
    })

    it('should detect wheat when ingredients say "enriched flour"', () => {
      const product: OFFProduct = {
        ingredients_text: 'Enriched flour, milk, salt, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
    })

    it('should NOT detect wheat when ingredients explicitly say "rice flour"', () => {
      const product: OFFProduct = {
        ingredients_text: 'Rice flour, water, salt'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeUndefined()
    })

    it('should detect wheat when ingredients say "wheat flour"', () => {
      const product: OFFProduct = {
        ingredients_text: 'Wheat flour, milk, salt'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBeGreaterThan(0)
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
    })
  })

  describe('Multi-allergen detection from different sources', () => {
    it('should detect both milk (from ingredients) and wheat (from ingredients)', () => {
      // Milk and wheat both in ingredients_text → CONTAINS from ingredient evidence
      const product: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients_tags: ['en:wheat'],
        ingredients_text: 'Wheat flour, milk, salt, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBe(2)
      
      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('CONTAINS')
      
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
      expect(wheatMatch?.matchType).toBe('CONTAINS')
    })

    it('should detect both milk and wheat from structured ingredients', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients: [
          { text: 'Wheat flour, milk, salt, sugar' }
        ]
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBe(2)
      
      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('CONTAINS')
      
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
      expect(['ingredients_text', 'ingredients_structured']).toContain(wheatMatch?.source)
    })

    it('should detect all allergens from ingredients text', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients_text: 'Wheat flour, eggs, milk, salt, sugar'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'wheat', 'eggs'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      expect(result.detected_allergens.length).toBe(3)
      
      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('CONTAINS')
      
      const wheatMatch = result.detected_allergens.find(d => d.allergenKey === 'wheat')
      expect(wheatMatch).toBeDefined()
      
      const eggsMatch = result.detected_allergens.find(d => d.allergenKey === 'eggs')
      expect(eggsMatch).toBeDefined()
    })
  })

  describe('Real-world examples', () => {
    it('should detect Nutella correctly (milk CONTAINS, not eggs/wheat)', () => {
      // Nutella typically contains milk but not eggs/wheat as primary allergens
      const product: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients_text: 'Sugar, palm oil, hazelnuts, cocoa, skim milk powder, lecithin (soy), vanillin'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'eggs', 'wheat'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      const milkMatch = result.detected_allergens.find(d => d.allergenKey === 'milk')
      expect(milkMatch).toBeDefined()
      expect(milkMatch?.matchType).toBe('CONTAINS')
      
      // Should not detect eggs or wheat
      expect(result.detected_allergens.find(d => d.allergenKey === 'eggs')).toBeUndefined()
      expect(result.detected_allergens.find(d => d.allergenKey === 'wheat')).toBeUndefined()
    })

    it('should handle Mid-Day Squares correctly (tree_nuts CONTAINS if cashews listed, not milk)', () => {
      const product: OFFProduct = {
        allergens_tags: ['en:cashews'],
        ingredients_text: 'Dark chocolate, cashews, dates, coconut'
      }

      const userAllergens: UserAllergens = {
        allergyKeys: ['milk', 'tree_nuts'],
        customAllergens: []
      }

      const result = detectAllergens(product, userAllergens)

      const treeNutsMatch = result.detected_allergens.find(d => d.allergenKey === 'tree_nuts')
      expect(treeNutsMatch).toBeDefined()
      expect(treeNutsMatch?.matchType).toBe('CONTAINS')
      
      // Should not detect milk (dark chocolate doesn't contain milk)
      expect(result.detected_allergens.find(d => d.allergenKey === 'milk')).toBeUndefined()
    })
  })
})
