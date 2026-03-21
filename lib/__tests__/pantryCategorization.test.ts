import { detectCategoryFromName, getItemEmoji } from '../PantryItemFormatter'
import { categorizeForShopping } from '../ItemCategorizer'

describe('Pantry categorization (full-name aware)', () => {
  it('classifies "Orange Sports Drink" as Beverages (not Produce)', () => {
    expect(detectCategoryFromName('Orange Sports Drink')).toBe('Beverages')
  })

  it('classifies "Wild Berries" as Produce', () => {
    expect(detectCategoryFromName('Wild Berries')).toBe('Produce')
  })

  it('uses water emoji for "Water" (not watermelon)', () => {
    expect(getItemEmoji('Water', 'Beverages')).toBe('💧')
  })

  describe('baby & personal care (Non-Food / Misc, not Pantry)', () => {
    it('classifies Pull-ups / diapers as Non-Food / Misc', () => {
      expect(detectCategoryFromName('Pull-ups')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Pull-upsplus')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Kirkland Signature Diaper')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Diapers')).toBe('Non-Food / Misc')
    })

    it('classifies personal care items as Non-Food / Misc', () => {
      expect(detectCategoryFromName('Crest Mouthwash')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Shave Gel')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Shea Conditioner')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Cerave Cream')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Degree Ultra')).toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Dove Invigorating')).toBe('Non-Food / Misc')
    })

    it('does not classify food as Non-Food', () => {
      expect(detectCategoryFromName('Butter Bread')).not.toBe('Non-Food / Misc')
      expect(detectCategoryFromName('American Cheese')).not.toBe('Non-Food / Misc')
      expect(detectCategoryFromName('Organic Raspberry')).toBe('Produce')
    })
  })

  it('classifies Arm & Hammer as Pantry Staples (not Meat)', () => {
    expect(detectCategoryFromName('Arm&hammer')).toBe('Pantry Staples & Essentials')
    expect(detectCategoryFromName('Arm and Hammer')).toBe('Pantry Staples & Essentials')
  })

  it('classifies Chobani as Dairy (yogurt brand)', () => {
    expect(detectCategoryFromName('Chobani Zero')).toBe('Dairy & Eggs')
    expect(detectCategoryFromName('Chobani')).toBe('Dairy & Eggs')
  })

  it('classifies low carb soft taco as Grains', () => {
    expect(detectCategoryFromName('Low Carb Soft Taco')).toBe('Grains, Bread & Pasta')
    expect(detectCategoryFromName('low carb soft taco')).toBe('Grains, Bread & Pasta')
  })

  it('classifies coriander and coriander leaves as Produce', () => {
    expect(detectCategoryFromName('coriander')).toBe('Produce')
    expect(detectCategoryFromName('Coriander')).toBe('Produce')
    expect(detectCategoryFromName('coriander leaves')).toBe('Produce')
    expect(detectCategoryFromName('fresh coriander')).toBe('Produce')
  })

  it('classifies coriander seeds as Pantry Staples', () => {
    expect(detectCategoryFromName('coriander seeds')).toBe('Pantry Staples & Essentials')
    expect(detectCategoryFromName('ground coriander')).toBe('Pantry Staples & Essentials')
  })

  describe('frozen items', () => {
    it('classifies frozen chicken, beef, fish as Frozen (not Meat)', () => {
      expect(detectCategoryFromName('frozen chicken')).toBe('Frozen')
      expect(detectCategoryFromName('frozen beef')).toBe('Frozen')
      expect(detectCategoryFromName('frozen fish')).toBe('Frozen')
      expect(detectCategoryFromName('frozen broccoli')).toBe('Frozen')
      expect(detectCategoryFromName('frozen pizza')).toBe('Frozen')
    })
  })

  describe('household & cleaning', () => {
    it('classifies cleaning products as Household & Cleaning', () => {
      expect(detectCategoryFromName('dish soap')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('laundry detergent')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('bleach')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('all-purpose cleaner')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('paper towels')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('trash bags')).toBe('Household & Cleaning')
    })

    it('classifies garbage bags, vim, javel, parchment paper, aluminium foil as Household & Cleaning', () => {
      expect(detectCategoryFromName('garbage bags')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('garbage bag')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('Vim')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('Javel')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('parchment paper')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('aluminium foil')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('aluminum foil')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('baking paper')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('wax paper')).toBe('Household & Cleaning')
      expect(detectCategoryFromName('Kirkland parchment paper')).toBe('Household & Cleaning')
    })
  })
})

describe('List categorization (full-name aware)', () => {
  it('classifies "Orange Sports Drink" as Beverages', () => {
    expect(categorizeForShopping('Orange Sports Drink')).toBe('Beverages')
  })

  it('classifies "Wild Berries" as Produce', () => {
    expect(categorizeForShopping('Wild Berries')).toBe('Produce')
  })

  it('classifies coriander and coriander leaves as Produce', () => {
    expect(categorizeForShopping('coriander')).toBe('Produce')
    expect(categorizeForShopping('coriander leaves')).toBe('Produce')
  })

  it('classifies frozen chicken as Frozen (not Meat)', () => {
    expect(categorizeForShopping('frozen chicken')).toBe('Frozen')
    expect(categorizeForShopping('frozen pizza')).toBe('Frozen')
  })

  it('classifies cleaning products as Household & Cleaning', () => {
    expect(categorizeForShopping('dish soap')).toBe('Household & Cleaning')
    expect(categorizeForShopping('laundry detergent')).toBe('Household & Cleaning')
  })

  it('classifies garbage bags, vim, parchment paper, aluminium foil as Household & Cleaning', () => {
    expect(categorizeForShopping('garbage bags')).toBe('Household & Cleaning')
    expect(categorizeForShopping('Vim')).toBe('Household & Cleaning')
    expect(categorizeForShopping('parchment paper')).toBe('Household & Cleaning')
    expect(categorizeForShopping('aluminium foil')).toBe('Household & Cleaning')
    expect(categorizeForShopping('bleach')).toBe('Household & Cleaning')
  })
})

