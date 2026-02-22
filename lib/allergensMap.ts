// Comprehensive Allergen Synonym & Derivative Mapping
// Supports English + French (bilingual Canadian products)

export interface AllergenMap {
  canonical: string
  aliases: string[] // Direct synonyms
  derived: string[] // Derived ingredients that indicate this allergen
  french: string[] // French terms
  antiMatches?: string[] // Terms that should NOT trigger this allergen (false positive prevention)
  treeNutMembers?: string[] // For tree_nuts: specific nuts that map to this
}

export const ALLERGEN_MAP: Record<string, AllergenMap> = {
  milk: {
    canonical: "milk",
    aliases: [
      "milk", "skim milk", "whole milk", "milk powder", "nonfat milk", "dairy", "dairy product",
      "butter", "butterfat", "ghee", "cream", "sour cream", "heavy cream", "light cream",
      "whipping cream", "cheese", "yogurt", "yoghurt", "kefir", "buttermilk", "curds",
      "cream cheese", "ricotta", "mascarpone", "cottage cheese", "mozzarella", "cheddar",
      "swiss cheese", "parmesan", "feta", "goat cheese", "sheep cheese", "buffalo milk",
      "half and half", "evaporated milk", "condensed milk", "powdered milk", "dry milk"
    ],
    derived: [
      "whey", "whey powder", "whey protein", "whey isolate", "whey concentrate",
      "casein", "caseinate", "sodium caseinate", "calcium caseinate", "potassium caseinate",
      "ammonium caseinate", "magnesium caseinate", "casein hydrolysate",
      "lactose", "lactalbumin", "alpha-lactalbumin", "beta-lactalbumin",
      "lactoglobulin", "beta-lactoglobulin", "milk solids", "milk protein",
      "milk fat", "milk sugar", "nonfat dry milk", "dry milk", "milk derivative",
      "rennet", "rennin", "lactoferrin", "lactoperoxidase", "galactose", "lactulose"
    ],
    french: [
      "lait", "lait écrémé", "lait entier", "poudre de lait", "lactosérum", "caséine",
      "beurre", "beurre clarifié", "crème", "crème sure", "fromage", "yaourt", "lactose",
      "produits laitiers", "sans lactose", "lait de vache", "lait de chèvre", "lait de brebis"
    ],
    antiMatches: [
      // Do NOT add "peanut butter"/"lactic acid" here: would skip milk when product has both milk and those
      "milk-free", "sans lait", "dairy-free", "sans produits laitiers", "non-dairy",
      "soy milk", "almond milk", "coconut milk", "oat milk", "rice milk", "hemp milk",
      "cashew milk", "macadamia milk", "hazelnut milk", "pea milk", "flax milk",
      "milk thistle", "milkweed", "milkshake",
      "cream of tartar", "coconut cream", "whipped topping", "non-dairy creamer"
      // "butter" in "peanut butter"/"cocoa butter" etc. is handled in detection loop, not global skip
    ]
  },
  eggs: {
    canonical: "eggs",
    aliases: [
      "egg", "eggs", "egg whites", "egg white", "egg yolk", "egg yolks", "albumen", "albumin",
      "whole egg", "liquid egg", "frozen egg", "dried egg", "powdered egg"
    ],
    derived: [
      "ovalbumin", "ovomucoid", "ovoglobulin", "ovotransferrin", "lysozyme",
      "lecithin", // Only if not explicitly "soy lecithin" or "sunflower lecithin"
      "egg powder", "dried egg", "egg solids", "egg protein", "globulin",
      "livetin", "phosvitin", "avidin", "conalbumin", "ovomucin",
      "egg substitute", "egg replacer" // May contain egg derivatives
    ],
    french: [
      "œuf", "oeuf", "oeufs", "blancs d'œufs", "blanc d'œuf", "jaune d'œuf", "jaunes d'œufs",
      "albumine", "poudre d'œuf", "œuf en poudre", "œuf liquide"
    ],
    antiMatches: [
      "eggplant", // Vegetable; whole-word "egg" would match inside "eggplant"
      "eggnog", // eggnog actually contains eggs
      "mayonnaise" // Context-dependent, but often contains eggs - this is tricky
      // Do NOT add "cocoa"/"chocolate"/"vegetable" - would skip eggs when product has egg powder + cocoa
    ]
  },
  wheat: {
    canonical: "wheat",
    aliases: [
      "wheat", "wheat flour", "durum", "semolina", "farina", "bulgur", "couscous",
      "spelt", "épeautre", "kamut", "gluten", "wheat gluten", "vital wheat gluten",
      "barley", "rye", "malt", "brewer's yeast", "malt extract", "malt syrup",
      "malt vinegar", "malt flour", "barley malt", "maltose", "maltodextrin",
      "triticale", "farro", "einkorn", "emmer", "rye flour", "rye bread", "rye malt"
    ],
    derived: [
      "wheat starch", "wheat protein", "wheat germ", "wheat bran", "wheat berries",
      "wheat gluten", "vital wheat gluten", "graham flour", "enriched wheat flour",
      "whole wheat flour", "bread flour", "cake flour", "pastry flour", "all-purpose flour",
      "enriched flour", // In US, "enriched flour" without type specification is typically wheat
      "flour", // In US, "flour" without type specification is typically wheat (unless non-wheat flours are explicitly listed)
      "barley malt extract", "barley malt syrup", "malt vinegar", "maltodextrin",
      "brewer's yeast", "malt flour", "rye flour", "rye bread", "triticale flour"
    ],
    french: [
      "blé", "farine de blé", "semoule", "épeautre", "kamut", "gluten", "orge", "seigle",
      "malt", "levure de bière", "extrait de malt", "sirop de malt", "vinaigre de malt",
      "farine de seigle", "pain de seigle"
    ],
    antiMatches: [
      "wheatgrass", "sweet wheat",
      "glutamate", "monosodium glutamate", "msg", "glutamic acid", "glutamine",
      "glutathione", "glutamic", "glutamate sodium", "gluten-free", "sans gluten",
      "wheat-free", "sans blé"
    ]
  },
  tree_nuts: {
    canonical: "tree_nuts",
    aliases: [
      "tree nuts", "tree nut", "nuts", "nut", "mixed nuts", "assorted nuts"
    ],
    derived: [
      "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans",
      "hazelnut", "hazelnuts", "pistachio", "pistachios", "macadamia", "macadamias",
      "brazil nut", "brazil nuts", "pine nut", "pine nuts", "chestnut", "chestnuts",
      "beechnut", "beechnuts", "pili nut", "pili nuts", "black walnut", "butternut",
      "almond oil", "walnut oil", "hazelnut oil", "cashew butter", "almond butter",
      "hazelnut butter", "pistachio butter", "marzipan", "praline", "nougat",
      "almond extract", "almond flour", "almond meal", "walnut flour", "hazelnut flour",
      "pistachio paste", "almond paste", "frangipane"
    ],
    treeNutMembers: [
      "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans",
      "hazelnut", "hazelnuts", "pistachio", "pistachios", "macadamia", "macadamias",
      "brazil nut", "brazil nuts", "pine nut", "pine nuts", "chestnut", "chestnuts",
      "beechnut", "beechnuts", "pili nut", "pili nuts", "black walnut", "butternut"
    ],
    french: [
      "noix", "noix d'arbre", "amande", "amandes", "noix de cajou", "noix de cajou",
      "noix", "noix de Grenoble", "pacane", "pacanes", "noisette", "noisettes",
      "pistache", "pistaches", "macadamia", "macadamias", "noix du brésil",
      "pignon", "pignons", "châtaigne", "châtaignes", "marron"
    ],
    antiMatches: [
      "coconut", "coco", "coconut oil", "coconut milk", "coconut cream", // Not tree nuts
      "nutmeg", "noix de muscade", // Spice, not a tree nut
      "water chestnut", "châtaigne d'eau" // Not a tree nut
      // Do NOT add peanut/peanuts here: that would skip tree_nuts whenever peanuts appear in text.
      // Products can contain BOTH peanuts AND tree nuts (e.g. mixed nuts). Whole-word matching
      // already prevents "nut"/"nuts" from matching inside "peanuts".
    ]
  },
  peanuts: {
    canonical: "peanuts",
    aliases: [
      "peanut", "peanuts", "groundnut", "ground nuts", "goober", "goobers", "arachis",
      // Brand/product names famously associated with peanuts
      "reese", "reeses", "reeses pieces", "reeses cups", "reeses puffs", "reeses sticks",
      "reeses peanut butter", "reeses peanut butter cup", "reeses peanut butter cups",
      "skippy", "jif", "peter pan", "planters", "honey roasted peanuts", // Major peanut brands
      "peanut m&m", "peanut m&ms", "peanut m and m", "peanut m and ms"
    ],
    derived: [
      "peanut oil", "peanut butter", "peanut flour", "peanut protein", "peanut isolate",
      "peanut extract", "peanut paste", "peanut meal", "peanut butter cup",
      "peanut butter cups", "peanut butter candy", "peanut candy", "peanut brittle",
      "peanut sauce", "satay sauce", "pad thai sauce", "peanut dressing",
      "peanut powder", "defatted peanut flour", "roasted peanuts", "salted peanuts"
    ],
    french: [
      "arachide", "cacahuète", "cacahuètes", "beurre d'arachide", "huile d'arachide"
    ],
    antiMatches: [
      "peanut-free", "sans arachide", "sans cacahuète" // Explicitly safe
    ]
  },
  soy: {
    canonical: "soy",
    aliases: [
      "soy", "soya", "soybean", "soybeans", "soya bean", "soya beans"
    ],
    derived: [
      "tofu", "tempeh", "edamame", "miso", "soy sauce", "tamari", "teriyaki sauce",
      "soy lecithin", "lecithin", // Generic lecithin is usually soy unless specified otherwise
      "soy protein", "soy protein isolate", "soy protein concentrate", "textured soy protein",
      "soy oil", "soybean oil", "soy flour", "soy meal", "soy isolate", "soy concentrate",
      "soy milk", "soy yogurt", "soy cheese", "soy cream", "soy ice cream",
      "natto", "okara", "yuba", "soy fiber", "soy grits", "hydrolyzed soy protein",
      "soy sauce powder", "soy paste", "soy curd"
    ],
    french: [
      "soja", "tofu", "miso", "sauce soja", "lécithine de soja", "lécithine",
      "huile de soja", "farine de soja", "protéine de soja", "lait de soja"
    ],
    antiMatches: [
      // Prevent false positive when lecithin is explicitly sunflower-based.
      // Do NOT block generic "lecithin" here, because "soy lecithin" must match soy.
      "sunflower lecithin", "lecithin from sunflower", "soy-free", "sans soja"
    ]
  },
  fish: {
    canonical: "fish",
    aliases: [
      "fish", "fish product", "seafood"
    ],
    derived: [
      "anchovy", "anchovies", "bass", "sea bass", "catfish", "cod", "flounder", "grouper",
      "haddock", "hake", "halibut", "herring", "mahi", "mahi-mahi", "perch", "pike",
      "pollock", "salmon", "sardine", "sardines", "snapper", "sole", "swordfish", "tilapia",
      "trout", "tuna", "albacore", "yellowfin", "bluefin", "skipjack",
      "fish oil", "fish sauce", "fish paste", "fish extract", "fish stock", "fish broth",
      "worcestershire sauce", // Contains anchovies
      "caesar dressing", // Often contains anchovies
      "surimi", "imitation crab", "imitation lobster", // May contain fish
      "gelatin", // Can be fish-based
      "omega-3", "omega 3" // Often from fish oil
    ],
    french: [
      "poisson", "anchois", "anchois", "saumon", "thon", "sardine", "sardines",
      "morue", "flétan", "truite", "maquereau", "huile de poisson", "sauce de poisson"
    ],
    antiMatches: [
      "fish-free", "sans poisson", "vegetarian", "vegan" // Explicitly safe
    ]
  },
  shellfish: {
    canonical: "shellfish",
    aliases: [
      "shellfish", "crustacean", "crustaceans", "mollusk", "mollusks"
    ],
    derived: [
      "shrimp", "prawn", "prawns", "crab", "crabs", "lobster", "lobsters",
      "clam", "clams", "mussel", "mussels", "oyster", "oysters", "scallop", "scallops",
      "squid", "octopus", "crawfish", "crayfish", "crab meat", "shrimp paste",
      "lobster paste", "crab extract"
    ],
    french: [
      "crustacés", "mollusques", "crevette", "crabe", "homard", "huître"
    ],
    antiMatches: []
  },
  sesame: {
    canonical: "sesame",
    aliases: [
      "sesame", "sesame seeds", "sesame seed", "sesame seed oil"
    ],
    derived: [
      "tahini", "tahina", "sesamol", "sesamolin", "sesame oil", "sesame paste",
      "halva", "halvah", "benne", "simsim", "sesame flour", "sesame meal",
      "sesame protein", "sesame butter", "gomasio", "gomashio", "sesame salt",
      "hummus", // Often contains tahini
      "baba ganoush" // Often contains tahini
    ],
    french: [
      "sésame", "graines de sésame", "tahin", "tahini", "huile de sésame",
      "pâte de sésame", "halva"
    ],
    antiMatches: [
      "sesame-free", "sans sésame" // Explicitly safe
    ]
  },
  mustard: {
    canonical: "mustard",
    aliases: [
      "mustard", "mustard seed", "mustard seeds", "mustard powder"
    ],
    derived: [
      "mustard oil", "mustard flour", "mustard extract", "mustard greens",
      "dijon mustard", "yellow mustard", "brown mustard", "black mustard",
      "mustard sauce", "mustard dressing"
    ],
    french: [
      "moutarde", "graine de moutarde", "graines de moutarde", "huile de moutarde"
    ],
    antiMatches: [
      "mustard-free", "sans moutarde" // Explicitly safe
    ]
  },
  sulfites: {
    canonical: "sulfites",
    aliases: [
      "sulfites", "sulphites", "sulfiting agents", "sulphiting agents"
    ],
    derived: [
      "sulfur dioxide", "sodium sulfite", "sodium bisulfite", "sodium metabisulfite",
      "potassium sulfite", "potassium bisulfite", "potassium metabisulfite",
      "calcium sulfite", "calcium bisulfite", "calcium metabisulfite"
    ],
    french: [
      "sulfites", "sulfite de sodium", "dioxyde de soufre", "bisulfite de sodium"
    ],
    antiMatches: []
  },
  celery: {
    canonical: "celery",
    aliases: [
      "celery", "celery seed", "celery seeds", "celery salt"
    ],
    derived: [
      "celery root", "celeriac", "celery extract", "celery powder",
      "celery juice", "celery flakes"
    ],
    french: [
      "céleri", "graine de céleri", "graines de céleri", "sel de céleri", "céleri-rave"
    ],
    antiMatches: [
      "celery-free", "sans céleri" // Explicitly safe
    ]
  },
  lupin: {
    canonical: "lupin",
    aliases: [
      "lupin", "lupine", "lupini", "lupin bean", "lupin beans"
    ],
    derived: [
      "lupin flour", "lupin protein", "lupin seed", "lupin meal"
    ],
    french: [
      "lupin", "lupine", "farine de lupin", "protéine de lupin"
    ],
    antiMatches: []
  },
  // Additives / sensitivities (user-added; common E-numbers so barcode scan detects them)
  aspartame: {
    canonical: "aspartame",
    aliases: ["aspartame"],
    derived: [
      "e951", "e-951", "e 951"
    ],
    french: ["aspartame", "e951", "e-951"],
    antiMatches: []
  }
}

// Get all search terms for an allergen (aliases + derived + french)
export function getAllergenSearchTerms(allergenKey: string): string[] {
  const map = ALLERGEN_MAP[allergenKey]
  if (!map) return [allergenKey]
  
  return [
    map.canonical,
    ...map.aliases,
    ...map.derived,
    ...map.french
  ]
}

// Check if a term is an anti-match (should NOT trigger allergen)
// Uses whole-word matching so e.g. "cocoa" does not trigger the "coco" antiMatch for tree_nuts.
export function isAntiMatch(allergenKey: string, text: string): boolean {
  const map = ALLERGEN_MAP[allergenKey]
  if (!map?.antiMatches) return false
  
  return map.antiMatches.some(anti => isWholeWordMatch(text, anti))
}

// Normalize text for matching
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[()\[\]{}]/g, " ")
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Check if term matches as whole word (prevents false positives)
export function isWholeWordMatch(text: string, term: string): boolean {
  const normalizedText = normalizeText(text)
  const normalizedTerm = normalizeText(term)
  
  // Exact phrase match for multi-word terms
  if (normalizedTerm.includes(" ")) {
    return normalizedText.includes(normalizedTerm)
  }
  
  // Whole word match using word boundaries
  const wordBoundaryRegex = new RegExp(
    `\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  )
  return wordBoundaryRegex.test(normalizedText)
}

// Map tree nut member to tree_nuts canonical
export function mapTreeNutToCanonical(nutName: string): string | null {
  const normalized = normalizeText(nutName)
  const treeNutsMap = ALLERGEN_MAP.tree_nuts
  
  if (treeNutsMap?.treeNutMembers) {
    for (const member of treeNutsMap.treeNutMembers) {
      if (normalizeText(member) === normalized) {
        return "tree_nuts"
      }
    }
  }
  
  return null
}
