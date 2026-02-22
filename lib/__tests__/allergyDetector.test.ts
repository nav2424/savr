// Unit tests for production-grade allergy detection engine
import {
  detectAllergensFromOFF,
  type AllergyDetectionSettings,
  type OFFProduct,
  type UserAllergies
} from '../allergyDetector'

describe('allergyDetector', () => {
  const defaultSettings: AllergyDetectionSettings = {
    strictMode: true,
    glutenMode: 'wheat_and_gluten',
    languagePreference: 'auto'
  }

  describe('OFF tags detection (highest priority)', () => {
    it('should detect allergens from allergens_tags as MAY_CONTAIN (tags-only)', () => {
      const offProduct: OFFProduct = {
        allergens_tags: ['en:milk', 'en:soybeans'],
        ingredients_text: 'Water, sugar, salt'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk', 'soy'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      // Tags-only = MAY_CONTAIN (conflict resolver)
      expect(result.mayContainAllergens).toHaveLength(2)
      expect(result.mayContainAllergens[0].allergenKey).toBe('milk')
      expect(result.mayContainAllergens[1].allergenKey).toBe('soy')
      expect(result.safe).toBe(false)
    })

    it('should detect traces from traces_tags', () => {
      const offProduct: OFFProduct = {
        traces_tags: ['en:milk', 'en:tree-nuts'],
        ingredients_text: 'Wheat flour, sugar'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.mayContainAllergens).toHaveLength(1)
      expect(result.mayContainAllergens[0].allergenKey).toBe('milk')
      expect(result.mayContainAllergens[0].source).toBe('off_traces_tags')
      expect(result.safe).toBe(false) // strictMode = true
    })

    it('should allow traces in non-strict mode', () => {
      const offProduct: OFFProduct = {
        traces_tags: ['en:milk'],
        ingredients_text: 'Wheat flour, sugar'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const settings: AllergyDetectionSettings = {
        ...defaultSettings,
        strictMode: false
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, settings)

      expect(result.mayContainAllergens).toHaveLength(1)
      expect(result.safe).toBe(true) // strictMode = false
    })
  })

  describe('Ingredients text fallback', () => {
    it('should fall back to ingredients_text when tags are missing', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Wheat flour, milk, sugar, eggs'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk', 'egg'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
      expect(result.ambiguousFindings[0].source).toBe('off_ingredients_text')
      expect(result.ambiguousFindings[0].confidence).toBe('low')
    })

    it('should use ingredient evidence when present (CONTAINS from text)', () => {
      const offProduct: OFFProduct = {
        allergens_tags: ['en:milk'],
        ingredients_text: 'Milk, sugar'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.containsAllergens).toHaveLength(1)
      expect(result.containsAllergens[0].allergenKey).toBe('milk')
    })
  })

  describe('French language support', () => {
    it('should detect milk from ingredients and eggs from tags (egg tags-only = MAY_CONTAIN)', () => {
      const offProduct: OFFProduct = {
        allergens_tags: ['fr:lait', 'fr:oeufs'],
        ingredients_text_fr: 'Farine de blé, lait, sucre'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk', 'egg'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.containsAllergens.some(a => a.allergenKey === 'milk')).toBe(true)
      expect(result.mayContainAllergens.some(a => a.allergenKey === 'egg') || result.containsAllergens.some(a => a.allergenKey === 'egg')).toBe(true)
    })

    it('should prefer French ingredients text when language preference is fr', () => {
      const offProduct: OFFProduct = {
        ingredients_text_en: 'Wheat flour, milk',
        ingredients_text_fr: 'Farine de blé, lait'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const settings: AllergyDetectionSettings = {
        ...defaultSettings,
        languagePreference: 'fr'
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, settings)

      expect(result.chosenLanguage).toBe('fr')
      // Should find milk in French text
      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
    })
  })

  describe('Derived ingredients detection', () => {
    it('should detect casein as milk', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Wheat flour, casein, sugar'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
      const milkFinding = result.ambiguousFindings.find(f => f.allergenKey === 'milk')
      expect(milkFinding).toBeDefined()
      expect(milkFinding?.matchedTerm).toBe('casein')
    })

    it('should detect malt as gluten risk', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Barley malt, sugar, salt'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['gluten'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
      const glutenFinding = result.ambiguousFindings.find(f => f.allergenKey === 'gluten')
      expect(glutenFinding).toBeDefined()
    })
  })

  describe('Data incompleteness', () => {
    it('should mark as needsReview when data is incomplete', () => {
      const offProduct: OFFProduct = {
        // No allergens, traces, or ingredients
        product_name: 'Unknown Product'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.needsReview).toBe(true)
      expect(result.safe).toBe(true) // No allergens found, but needs review
    })

    it('should mark as needsReview when completeness is very low', () => {
      const offProduct: OFFProduct = {
        completeness: 0.2,
        ingredients_text: 'Water'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.needsReview).toBe(true)
    })
  })

  describe('Custom allergens', () => {
    it('should detect custom allergens in ingredients', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Wheat flour, artificial flavoring, sugar'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: [],
        customAllergens: ['artificial flavoring']
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
      const customFinding = result.ambiguousFindings.find(
        f => f.allergenKey === 'artificial flavoring'
      )
      expect(customFinding).toBeDefined()
    })
  })

  describe('Exclusion handling', () => {
    it('should not match soy milk as milk', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Soy milk, sugar, vanilla'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      // Should not find milk (soy milk is excluded)
      const milkFinding = result.ambiguousFindings.find(f => f.allergenKey === 'milk')
      expect(milkFinding).toBeUndefined()
    })
  })

  describe('Evidence snippets', () => {
    it('should provide evidence snippets from ingredients', () => {
      const offProduct: OFFProduct = {
        ingredients_text: 'Wheat flour, milk powder, sugar, salt, eggs'
      }

      const userAllergies: UserAllergies = {
        allergyKeys: ['milk'],
        customAllergens: []
      }

      const result = detectAllergensFromOFF(userAllergies, offProduct, defaultSettings)

      expect(result.ambiguousFindings.length).toBeGreaterThan(0)
      expect(result.ambiguousFindings[0].evidenceSnippet).toContain('milk')
      expect(result.ambiguousFindings[0].evidenceSnippet.length).toBeLessThanOrEqual(120)
    })
  })
})
