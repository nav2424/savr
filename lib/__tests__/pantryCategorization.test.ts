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
      expect(detectCategoryFromName('Downy Ultimate')).toBe('Non-Food / Misc')
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
})

