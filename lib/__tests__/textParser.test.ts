import { parseSections } from '../allergenEngine/textParser'

describe('parseSections', () => {
  it('extracts May contain from combined block', () => {
    const parsed = parseSections('Wheat flour, sugar. May contain: peanuts.')
    expect(parsed.ingredients_text).toBe('Wheat flour, sugar')
    expect(parsed.may_contain_text).toContain('peanuts')
  })
})
