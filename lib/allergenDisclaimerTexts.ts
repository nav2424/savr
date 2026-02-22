// Bilingual allergen disclaimer texts - used by AllergenDisclaimer and tests

export type DisclaimerVariant = 'default' | 'unknown' | 'may_contain'

export const DISCLAIMER_TEXTS: Record<
  DisclaimerVariant,
  { en: string; fr: string }
> = {
  default: {
    en: 'Results are based on available product label data. Always verify the package ingredients and allergen statements.',
    fr: "Les résultats sont basés sur les informations disponibles. Vérifiez toujours les ingrédients et allergènes sur l'emballage.",
  },
  unknown: {
    en: "We couldn't retrieve ingredients for this barcode. Please verify the package.",
    fr: "Nous n'avons pas pu obtenir les ingrédients pour ce code-barres. Vérifiez l'emballage.",
  },
  may_contain: {
    en: "'May contain' indicates potential cross-contact risk.",
    fr: '« Peut contenir » indique un risque potentiel de contamination croisée.',
  },
}
