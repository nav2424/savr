import { DISCLAIMER_TEXTS } from '../allergenDisclaimerTexts'

describe('allergenDisclaimerTexts', () => {
  it('default variant renders bilingual default disclaimer', () => {
    const { en, fr } = DISCLAIMER_TEXTS.default
    expect(en).toBe(
      'Results are based on available product label data. Always verify the package ingredients and allergen statements.'
    )
    expect(fr).toBe(
      "Les résultats sont basés sur les informations disponibles. Vérifiez toujours les ingrédients et allergènes sur l'emballage."
    )
  })

  it('unknown variant renders UNKNOWN disclaimer', () => {
    const { en, fr } = DISCLAIMER_TEXTS.unknown
    expect(en).toBe(
      "We couldn't retrieve ingredients for this barcode. Please verify the package."
    )
    expect(fr).toBe(
      "Nous n'avons pas pu obtenir les ingrédients pour ce code-barres. Vérifiez l'emballage."
    )
  })

  it('may_contain variant renders cross-contact line', () => {
    const { en, fr } = DISCLAIMER_TEXTS.may_contain
    expect(en).toBe("'May contain' indicates potential cross-contact risk.")
    expect(fr).toBe(
      '« Peut contenir » indique un risque potentiel de contamination croisée.'
    )
  })

  it('all variants have both en and fr', () => {
    const variants = ['default', 'unknown', 'may_contain'] as const
    for (const v of variants) {
      expect(DISCLAIMER_TEXTS[v].en).toBeTruthy()
      expect(DISCLAIMER_TEXTS[v].fr).toBeTruthy()
    }
  })
})
