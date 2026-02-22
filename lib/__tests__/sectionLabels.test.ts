import { getSectionLabel } from '../allergenEngine/sectionLabels'

describe('getSectionLabel', () => {
  describe('bilingual output', () => {
    it('maps ingredients to bilingual label', () => {
      expect(getSectionLabel('ingredients', { bilingual: true })).toBe(
        'Ingredients / Ingrédients'
      )
    })

    it('maps contains to bilingual label', () => {
      expect(getSectionLabel('contains', { bilingual: true })).toBe(
        'Contains / Contient'
      )
    })

    it('maps allergens to contains bilingual label', () => {
      expect(getSectionLabel('allergens', { bilingual: true })).toBe(
        'Contains / Contient'
      )
    })

    it('maps may_contain to bilingual label', () => {
      expect(getSectionLabel('may_contain', { bilingual: true })).toBe(
        'May contain / Peut contenir'
      )
    })

    it('maps traces to may_contain bilingual label', () => {
      expect(getSectionLabel('traces', { bilingual: true })).toBe(
        'May contain / Peut contenir'
      )
    })

    it('maps product_name_hint to bilingual label', () => {
      expect(getSectionLabel('product_name_hint', { bilingual: true })).toBe(
        'Unverified (name) / Non vérifié (nom)'
      )
    })

    it('maps product_name to product_name_hint bilingual label', () => {
      expect(getSectionLabel('product_name', { bilingual: true })).toBe(
        'Unverified (name) / Non vérifié (nom)'
      )
    })

    it('maps off_tags to bilingual label', () => {
      expect(getSectionLabel('off_tags', { bilingual: true })).toBe(
        'OFF tags / Étiquettes OFF'
      )
    })

    it('maps unknown to bilingual label', () => {
      expect(getSectionLabel('unknown', { bilingual: true })).toBe(
        'Unknown / Inconnu'
      )
    })

    it('maps INSUFFICIENT_DATA to unknown bilingual label', () => {
      expect(getSectionLabel('INSUFFICIENT_DATA', { bilingual: true })).toBe(
        'Unknown / Inconnu'
      )
    })

    it('maps contains_text to contains bilingual label', () => {
      expect(getSectionLabel('contains_text', { bilingual: true })).toBe(
        'Contains / Contient'
      )
    })
  })

  describe('English-only output', () => {
    it('returns English only when bilingual is false', () => {
      expect(getSectionLabel('ingredients', { bilingual: false })).toBe(
        'Ingredients'
      )
    })

    it('returns English only when opts omitted', () => {
      expect(getSectionLabel('traces')).toBe('May contain')
    })
  })

  describe('normalization', () => {
    it('handles empty string', () => {
      expect(getSectionLabel('', { bilingual: true })).toBe(
        'Unknown / Inconnu'
      )
    })

    it('handles case-insensitive input', () => {
      expect(getSectionLabel('INGREDIENTS', { bilingual: true })).toBe(
        'Ingredients / Ingrédients'
      )
    })
  })
})
