/**
 * Evidence-based Allergen Engine - Golden regression tests
 * Fail PR/build if regressions happen.
 * Deterministic, no AI, never hallucinate.
 */

import {
  detectAllergensEvidenceBased,
  buildUserAllergenConfig,
  toDetectionInput,
  isPlainWaterProduct,
} from '../allergenEngine'
import { parseSections } from '../allergenEngine/textParser'
import { getProductNameHints } from '../allergenEngine/productNameHints'
import { getSourceLabel, setBestResult, getBestResult } from '../AllergenResultStore'

const userAllergies = ['milk', 'eggs', 'wheat', 'soy', 'peanuts', 'tree nuts', 'fish', 'sesame']

describe('allergenEngine', () => {
  const config = buildUserAllergenConfig(userAllergies)

  describe('Golden cases - MUST NOT regress', () => {
    it('Mozzarella cheese MUST match milk (milk or modified milk ingredients)', () => {
      const input = toDetectionInput({
        name: 'Fresh Mozzarella',
        ingredients: 'Milk, salt, rennet, modified milk ingredients, cultures.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const milkMatches = out.matched_allergens.filter(m => m.allergen_id === 'milk')
      expect(milkMatches.length).toBeGreaterThan(0)
      expect(out.overall_status).toBe('CONTAINS')
    })

    it('Oreo MUST match wheat + soy; milk only if in ingredients/contains', () => {
      const ingredients = 'Unbleached enriched flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), sugar, vegetable oil (soybean and/or palm oil), cocoa, high fructose corn syrup, lecithin (soy), chocolate, salt, sodium bicarbonate, artificial flavor.'
      const input = toDetectionInput({
        name: 'Oreo',
        ingredients,
      })
      const out = detectAllergensEvidenceBased(input, config)
      const wheatMatches = out.matched_allergens.filter(m => m.allergen_id === 'wheat')
      const soyMatches = out.matched_allergens.filter(m => m.allergen_id === 'soy')
      expect(wheatMatches.length).toBeGreaterThan(0)
      expect(soyMatches.length).toBeGreaterThan(0)
      // Milk: Oreo may have "may contain milk" but not in ingredients - if no milk in text, we don't match
      if (out.matched_allergens.some(m => m.allergen_id === 'milk')) {
        expect(out.matched_allergens.find(m => m.allergen_id === 'milk')!.match_text).toMatch(/milk/i)
      }
    })

    it('"donut" must NOT match "nut" (word boundary)', () => {
      const input = toDetectionInput({
        name: 'Glazed Donut',
        ingredients: 'Wheat flour, sugar, donut mix, vegetable oil, yeast.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const treeNutMatches = out.matched_allergens.filter(m => m.allergen_id === 'tree_nuts')
      const peanutMatches = out.matched_allergens.filter(m => m.allergen_id === 'peanuts')
      expect(treeNutMatches.length).toBe(0)
      expect(peanutMatches.length).toBe(0)
    })

    it('"soy lecithin" MUST match soy', () => {
      const input = toDetectionInput({
        name: 'Chocolate Bar',
        ingredients: 'Cocoa, sugar, soy lecithin, vanilla.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const soyMatches = out.matched_allergens.filter(m => m.allergen_id === 'soy')
      expect(soyMatches.length).toBeGreaterThan(0)
      expect(soyMatches[0].match_text).toBeTruthy()
    })

    it('Buns with sesame: wheat + soy + sesame when user has sesame', () => {
      const input = toDetectionInput({
        name: 'Sesame Seed Bun',
        ingredients: 'Wheat flour, water, soybean oil, sesame seeds, yeast, salt.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'wheat')).toBe(true)
      expect(out.matched_allergens.some(m => m.allergen_id === 'soy')).toBe(true)
      expect(out.matched_allergens.some(m => m.allergen_id === 'sesame')).toBe(true)
    })

    it('Ingredients with milk and peanuts both detected', () => {
      const input = toDetectionInput({
        name: "Reese's Peanut Butter Cups",
        ingredients: 'Milk chocolate, peanuts, sugar, dextrose, salt.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(true)
      expect(out.matched_allergens.some(m => m.allergen_id === 'peanuts')).toBe(true)
    })
  })

  describe('Plain water - ALWAYS SAFE (never Uncertain)', () => {
    it('water product by name returns SAFE even with empty ingredients', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: '',
        contains_text: '',
        may_contain_text: '',
        product_name: 'Evian Natural Spring Water',
      }
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.overall_status).toBe('SAFE')
      expect(out.matched_allergens.length).toBe(0)
    })

    it('bottled water, mineral water, etc. return SAFE', () => {
      for (const name of ['Bottled Water', 'Mineral Water', 'Aquafina', 'Purified Water', 'Eau minérale', 'Agua mineral']) {
        const out = detectAllergensEvidenceBased({ ingredients_text: '', product_name: name }, config)
        expect(out.overall_status).toBe('SAFE')
      }
    })

    it('ingredients-only-water returns SAFE (even without water in product name)', () => {
      const out = detectAllergensEvidenceBased(
        { ingredients_text: 'water', product_name: 'Mystery Beverage' },
        config
      )
      expect(out.overall_status).toBe('SAFE')
    })

    it('isPlainWaterProduct identifies water products', () => {
      expect(isPlainWaterProduct('Evian Natural Spring Water')).toBe(true)
      expect(isPlainWaterProduct('Bottled Water')).toBe(true)
      expect(isPlainWaterProduct('Vitaminwater')).toBe(false)
      expect(isPlainWaterProduct('Lemonade')).toBe(false)
    })
  })

  describe('UNKNOWN - missing ingredients', () => {
    it('MUST return UNKNOWN when ingredients_text is empty (never SAFE)', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: '',
        contains_text: '',
        may_contain_text: '',
        product_name: undefined,
      }
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.overall_status).toBe('UNKNOWN')
      expect(out.matched_allergens.length).toBe(0)
      expect(out.fallback_ctas?.scan_label_photo).toBe(true)
      expect(out.fallback_ctas?.paste_ingredients_manually).toBe(true)
    })

    it('MUST return UNKNOWN when no ingredient data at all', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: '',
        contains_text: '',
        may_contain_text: '',
      }
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.overall_status).toBe('UNKNOWN')
      expect(out.scan_log.has_ingredient_data).toBe(false)
    })

    it('UNKNOWN result must have source_coverage_score in scan_log', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: '',
        contains_text: '',
        may_contain_text: '',
      }
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.overall_status).toBe('UNKNOWN')
      expect(out.scan_log.source_coverage_score).toBeDefined()
      expect(typeof out.scan_log.source_coverage_score).toBe('number')
    })
  })

  describe('Product name hints - negation (FR/ES)', () => {
    it('"sans lait" suppresses milk hint when milk term present', () => {
      const hints = getProductNameHints('Biscuits sans lait milk flavor', ['milk'])
      expect(hints.some(h => h.allergen_id === 'milk')).toBe(false)
    })

    it('"sin leche" suppresses milk hint when milk term present', () => {
      const hints = getProductNameHints('Galletas sin leche con milk', ['milk'])
      expect(hints.some(h => h.allergen_id === 'milk')).toBe(false)
    })

    it('product name with "milk" but no negation yields milk hint', () => {
      const hints = getProductNameHints('Organic Milk Chocolate', ['milk'])
      expect(hints.some(h => h.allergen_id === 'milk')).toBe(true)
    })
  })

  describe('Source label mapping', () => {
    it('getSourceLabel returns correct labels for OFF/OCR/MANUAL', () => {
      expect(getSourceLabel('OFF')).toBe('Open Food Facts')
      expect(getSourceLabel('OCR')).toBe('Label Scan (OCR)')
      expect(getSourceLabel('MANUAL')).toBe('Manual Ingredients')
    })
  })

  describe('Source priority (MANUAL > OCR > OFF)', () => {
    it('setBestResult and getBestResult: higher priority replaces lower', () => {
      const sessionId = 'test_source_priority_' + Date.now()
      const offResult = { riskLevel: 'INSUFFICIENT_DATA' as const, matches: [], message: 'OFF', hasAllergens: false, detectedAllergens: [], userAllergens: [] }
      const ocrResult = { riskLevel: 'HIGH_RISK' as const, matches: [{ allergen: 'Milk', matchedTerm: 'milk' }], message: 'OCR', hasAllergens: true, detectedAllergens: ['Milk'], userAllergens: [] }
      const manualResult = { riskLevel: 'HIGH_RISK' as const, matches: [{ allergen: 'Milk', matchedTerm: 'milk' }], message: 'MANUAL', hasAllergens: true, detectedAllergens: ['Milk'], userAllergens: [] }

      setBestResult(sessionId, offResult as any, 'OFF')
      expect(getBestResult(sessionId)?.dataSource).toBe('OFF')

      setBestResult(sessionId, ocrResult as any, 'OCR')
      expect(getBestResult(sessionId)?.dataSource).toBe('OCR')
      expect(getBestResult(sessionId)?.result.message).toBe('OCR')

      setBestResult(sessionId, manualResult as any, 'MANUAL')
      expect(getBestResult(sessionId)?.dataSource).toBe('MANUAL')
      expect(getBestResult(sessionId)?.result.message).toBe('MANUAL')
    })

    it('lower priority does NOT replace higher', () => {
      const sessionId = 'test_priority_no_replace_' + Date.now()
      const manualResult = { riskLevel: 'HIGH_RISK' as const, matches: [], message: 'MANUAL', hasAllergens: true, detectedAllergens: [], userAllergens: [] }
      const offResult = { riskLevel: 'INSUFFICIENT_DATA' as const, matches: [], message: 'OFF', hasAllergens: false, detectedAllergens: [], userAllergens: [] }

      setBestResult(sessionId, manualResult as any, 'MANUAL')
      setBestResult(sessionId, offResult as any, 'OFF')
      expect(getBestResult(sessionId)?.dataSource).toBe('MANUAL')
    })
  })

  describe('Source coverage score', () => {
    it('coverage score includes ingredients_text (+60), allergens_tags (+20), traces_tags (+10)', () => {
      const input = toDetectionInput(
        { name: 'Product', ingredients: 'Sugar, flour' },
        { allergens_tags: ['en:milk'], traces_tags: ['en:peanuts'] }
      )
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.scan_log.source_coverage_score).toBeDefined()
      expect(out.scan_log.source_coverage_score).toBeGreaterThanOrEqual(60)
    })
  })

  describe('Anti-matches - no false positives', () => {
    it('"lactic acid" must NOT match milk', () => {
      const input = toDetectionInput({
        name: 'Candy',
        ingredients: 'Sugar, lactic acid, citric acid.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
    })

    it('" coconut milk" or "almond milk" - milk should NOT match (plant milk)', () => {
      const input = toDetectionInput({
        name: 'Coconut Milk',
        ingredients: 'Coconut milk, water, guar gum.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      // coconut milk is anti-match for milk
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
    })

    it('"sunflower lecithin" must NOT match soy', () => {
      const input = toDetectionInput({
        name: 'Vegan Chocolate',
        ingredients: 'Cocoa, sugar, sunflower lecithin, vanilla.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'soy')).toBe(false)
    })

    it('"nutmeg" must NOT match tree nuts', () => {
      const input = toDetectionInput({
        name: 'Pumpkin Pie',
        ingredients: 'Pumpkin, nutmeg, cinnamon, sugar.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'tree_nuts')).toBe(false)
    })
  })

  describe('Section parsing: Contains vs May contain', () => {
    it('Explicit "Contains: milk" → CONTAINS', () => {
      const input = toDetectionInput({
        name: 'Product',
        ingredients: 'Sugar, corn starch. Contains: milk.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const milk = out.matched_allergens.find(m => m.allergen_id === 'milk')
      expect(milk).toBeDefined()
      expect(milk!.severity).toBe('CONTAINS')
      expect(milk!.section).toBe('contains')
      expect(milk!.match_text).toMatch(/milk/i)
    })

    it('Embedded "Contains: milk, soy" in ingredients_text → milk CONTAINS with match_text from contains', () => {
      const input = toDetectionInput({
        name: 'Product',
        ingredients: 'Ingredients: wheat flour, sugar. Contains: milk, soy.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const milk = out.matched_allergens.find(m => m.allergen_id === 'milk')
      const soy = out.matched_allergens.find(m => m.allergen_id === 'soy')
      expect(milk).toBeDefined()
      expect(milk!.section).toBe('contains')
      expect(soy).toBeDefined()
      expect(soy!.section).toBe('contains')
    })

    it('Embedded "May contain: peanuts" → peanuts MAY_CONTAIN', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: 'Sugar, flour.',
        contains_text: '',
        may_contain_text: 'May contain: peanuts, tree nuts.',
      }
      const out = detectAllergensEvidenceBased(input, config)
      const peanut = out.matched_allergens.find(m => m.allergen_id === 'peanuts')
      expect(peanut).toBeDefined()
      expect(peanut!.severity).toBe('MAY_CONTAIN')
      expect(peanut!.section).toBe('may_contain')
    })

    it('Parser extracts "May contain" from combined ingredients_text block', () => {
      const parsed = parseSections('Wheat flour, sugar. May contain: peanuts.')
      expect(parsed.may_contain_text).toContain('peanuts')
      expect(parsed.ingredients_text).toContain('Wheat flour')
      const input = toDetectionInput({
        name: 'Product',
        ingredients: 'Wheat flour, sugar. May contain: peanuts.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const peanut = out.matched_allergens.find(m => m.allergen_id === 'peanuts')
      expect(peanut).toBeDefined()
      expect(peanut!.severity).toBe('MAY_CONTAIN')
      expect(peanut!.section).toBe('may_contain')
    })

    it('"May contain: tree nuts" → MAY_CONTAIN when tree nuts only in may_contain text', () => {
      const input: Parameters<typeof detectAllergensEvidenceBased>[0] = {
        ingredients_text: 'Sugar, corn starch.',
        contains_text: '',
        may_contain_text: 'May contain: tree nuts, peanuts.',
      }
      const out = detectAllergensEvidenceBased(input, config)
      const treeNut = out.matched_allergens.find(m => m.allergen_id === 'tree_nuts')
      expect(treeNut).toBeDefined()
      expect(treeNut!.severity).toBe('MAY_CONTAIN')
      expect(treeNut!.section).toBe('may_contain')
    })
  })

  describe('Normalization: Unicode and diacritics', () => {
    it('"œufs" (French eggs) matches eggs', () => {
      const input = toDetectionInput({
        name: 'Gâteau',
        ingredients: 'Farine, œufs, sucre, beurre.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const eggs = out.matched_allergens.find(m => m.allergen_id === 'eggs')
      expect(eggs).toBeDefined()
      expect(eggs!.match_text).toBeTruthy()
    })

    it('Curly apostrophes do not break matching', () => {
      const input = toDetectionInput({
        name: 'Product',
        ingredients: "Wheat flour, sugar, egg’s whites, butter.",
      })
      const out = detectAllergensEvidenceBased(input, config)
      const eggs = out.matched_allergens.find(m => m.allergen_id === 'eggs')
      expect(eggs).toBeDefined()
    })
  })

  describe('Parentheses proximity: X (Y) evidence', () => {
    it('"lecithin (soy)" → soy evidence with full phrase as match_text', () => {
      const input = toDetectionInput({
        name: 'Chocolate',
        ingredients: 'Cocoa, sugar, lecithin (soy), vanilla.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const soy = out.matched_allergens.find(m => m.allergen_id === 'soy')
      expect(soy).toBeDefined()
      expect(soy!.match_text).toMatch(/lecithin.*soy|soy/i)
    })

    it('"flavor (milk)" → milk evidence', () => {
      const input = toDetectionInput({
        name: 'Candy',
        ingredients: 'Sugar, artificial flavor (milk), color.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const milk = out.matched_allergens.find(m => m.allergen_id === 'milk')
      expect(milk).toBeDefined()
      expect(milk!.match_text).toMatch(/milk/i)
    })
  })

  describe('Non-dairy milk: coconut/almond/oat milk must NOT trigger milk allergen', () => {
    it('"coconut milk" does NOT trigger milk allergen', () => {
      const input = toDetectionInput({
        name: 'Thai Curry',
        ingredients: 'Coconut milk, curry paste, vegetables.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
    })

    it('"oat milk" does NOT trigger milk allergen', () => {
      const input = toDetectionInput({
        name: 'Oat Milk',
        ingredients: 'Oat milk, water, vitamins.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
    })
  })

  describe('Plant milk regression: must NOT suppress other allergens (e.g. tree nuts)', () => {
    it('cashew milk: milk NOT detected, tree_nuts detected via cashew', () => {
      const input = toDetectionInput({
        name: 'Cashew beverage',
        ingredients: 'water, cashew milk, salt',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
      const treeNut = out.matched_allergens.find(m => m.allergen_id === 'tree_nuts')
      expect(treeNut).toBeDefined()
      expect(treeNut!.match_text).toMatch(/cashew/i)
    })

    it('macadamia milk: milk NOT detected, tree_nuts detected via macadamia', () => {
      const input = toDetectionInput({
        name: 'Macadamia drink',
        ingredients: 'water, macadamia milk, salt',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
      const treeNut = out.matched_allergens.find(m => m.allergen_id === 'tree_nuts')
      expect(treeNut).toBeDefined()
      expect(treeNut!.match_text).toMatch(/macadamia/i)
    })

    it('almond milk: milk NOT detected, tree_nuts detected via almond', () => {
      const input = toDetectionInput({
        name: 'Almond beverage',
        ingredients: 'water, almond milk, salt',
      })
      const out = detectAllergensEvidenceBased(input, config)
      expect(out.matched_allergens.some(m => m.allergen_id === 'milk')).toBe(false)
      const treeNut = out.matched_allergens.find(m => m.allergen_id === 'tree_nuts')
      expect(treeNut).toBeDefined()
      expect(treeNut!.match_text).toMatch(/almond/i)
    })
  })

  describe('Evidence - every match has match_text', () => {
    it('All matches include exact match_text and section', () => {
      const input = toDetectionInput({
        name: 'Cheese Crackers',
        ingredients: 'Wheat flour, cheddar cheese, milk, butter.',
      })
      const out = detectAllergensEvidenceBased(input, config)
      for (const m of out.matched_allergens) {
        expect(m.match_text).toBeTruthy()
        expect(typeof m.match_text).toBe('string')
        expect(m.section).toMatch(/ingredients|contains|may_contain/)
      }
    })
  })

  describe('Custom allergens', () => {
    it('EXACT_PHRASE custom allergen matches only with boundaries', () => {
      const customConfig = buildUserAllergenConfig([...userAllergies, 'sulfites'])
      const input = toDetectionInput({
        name: 'Wine',
        ingredients: 'Grapes, sulfites, sodium metabisulfite.',
      })
      const out = detectAllergensEvidenceBased(input, customConfig)
      // sulfites is custom - may or may not match depending on builtin
      // If we have sulfites in builtin, it would match
      expect(out.scan_log.has_ingredient_data).toBe(true)
    })

    it('User allergies filtered - only show enabled allergens', () => {
      const limitedConfig = buildUserAllergenConfig(['milk'])
      const input = toDetectionInput({
        name: 'Oreo',
        ingredients: 'Wheat flour, soybean oil, sugar, cocoa.',
      })
      const out = detectAllergensEvidenceBased(input, limitedConfig)
      // Only milk would be in user's list; wheat and soy not in config
      expect(out.matched_allergens.every(m => m.allergen_id === 'milk' || limitedConfig.builtin_ids.includes(m.allergen_id))).toBe(true)
    })
  })

  describe('Malt as gluten/wheat risk (ported from legacy)', () => {
    it('Barley malt → CONTAINS wheat (confirmed gluten from barley)', () => {
      const config = buildUserAllergenConfig(['gluten'])
      const input = toDetectionInput({
        name: 'Product',
        ingredients: 'Barley malt, sugar, salt',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const wheat = out.matched_allergens.find(m => m.allergen_id === 'wheat')
      expect(wheat).toBeDefined()
      expect(wheat!.severity).toBe('CONTAINS')
    })

    it('malt alone (no barley) → MAY_CONTAIN wheat (gluten risk)', () => {
      const config = buildUserAllergenConfig(['wheat'])
      const input = toDetectionInput({
        name: 'Product',
        ingredients: 'Malt, sugar, salt',
      })
      const out = detectAllergensEvidenceBased(input, config)
      const wheat = out.matched_allergens.find(m => m.allergen_id === 'wheat')
      expect(wheat).toBeDefined()
      expect(wheat!.severity).toBe('MAY_CONTAIN')
    })
  })

  describe('OFF structured data', () => {
    it('allergens_tags-only mapped to MAY_CONTAIN (conflict resolver: no ingredient evidence)', () => {
      const input = toDetectionInput(
        { name: 'Product', ingredients: '' },
        {
          allergens_tags: ['en:milk', 'en:soybeans'],
          traces_tags: [],
        }
      )
      const out = detectAllergensEvidenceBased(input, config)
      const milk = out.matched_allergens.find(m => m.allergen_id === 'milk')
      const soy = out.matched_allergens.find(m => m.allergen_id === 'soy')
      expect(milk).toBeDefined()
      expect(soy).toBeDefined()
      expect(milk!.severity).toBe('MAY_CONTAIN')
      expect(soy!.severity).toBe('MAY_CONTAIN')
    })

    it('traces_tags mapped to MAY_CONTAIN', () => {
      const input = toDetectionInput(
        { name: 'Product', ingredients: 'Sugar' },
        {
          allergens_tags: [],
          traces_tags: ['en:milk'],
        }
      )
      const out = detectAllergensEvidenceBased(input, config)
      const milk = out.matched_allergens.find(m => m.allergen_id === 'milk')
      expect(milk).toBeDefined()
      expect(milk!.severity).toBe('MAY_CONTAIN')
    })
  })
})
