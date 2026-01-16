// Ingredient Image Library - Local asset system that never fails
// Uses clean gradient placeholders with category-based colors
// Structure ready for adding real image files later (just replace placeholder logic)

type IngredientImageResult = {
  category: string
  isPlaceholder: boolean
}

// Normalize ingredient names for consistent matching
const DESCRIPTOR_WORDS = [
  'organic', 'fresh', 'wild', 'skinless', 'boneless', 'raw', 'cooked',
  'large', 'small', 'medium', 'whole', 'sliced', 'diced', 'chopped',
  'marinated', 'frozen', 'canned', 'dried', 'ground', 'pure', 'extra virgin'
]

function normalizeIngredientName(name: string): string {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word && !DESCRIPTOR_WORDS.includes(word))
    .join(' ')
    .trim()
}

// Category-based color schemes for placeholder images
const CATEGORY_COLORS: Record<string, { primary: string; secondary: string; icon: string }> = {
  protein: {
    primary: '#FF6B6B',
    secondary: '#FF8787',
    icon: '🥩'
  },
  fish: {
    primary: '#4ECDC4',
    secondary: '#6EDDD6',
    icon: '🐟'
  },
  greens: {
    primary: '#51CF66',
    secondary: '#69DB7A',
    icon: '🥬'
  },
  vegetable: {
    primary: '#FFA726',
    secondary: '#FFB74D',
    icon: '🥕'
  },
  fruit: {
    primary: '#FF6B9D',
    secondary: '#FF8AB5',
    icon: '🍎'
  },
  grains: {
    primary: '#D4A574',
    secondary: '#E0B88A',
    icon: '🌾'
  },
  dairy: {
    primary: '#FFE66D',
    secondary: '#FFED8A',
    icon: '🥛'
  },
  pantry: {
    primary: '#A8E6CF',
    secondary: '#B8F0D9',
    icon: '🧂'
  },
  default: {
    primary: '#E0E0E0',
    secondary: '#F0F0F0',
    icon: '🍽️'
  }
}

// Specific ingredient mappings with icons and categories
const INGREDIENT_MAPPINGS: Record<string, { category: string; icon: string; color?: { primary: string; secondary: string } }> = {
  // Proteins
  'salmon': { category: 'fish', icon: '🐟' },
  'salmon fillet': { category: 'fish', icon: '🐟' },
  'chicken': { category: 'protein', icon: '🍗' },
  'chicken breast': { category: 'protein', icon: '🍗' },
  'chicken thigh': { category: 'protein', icon: '🍗' },
  'chicken leg': { category: 'protein', icon: '🍗' },
  'beef': { category: 'protein', icon: '🥩' },
  'ground beef': { category: 'protein', icon: '🥩' },
  'pork': { category: 'protein', icon: '🥩' },
  'turkey': { category: 'protein', icon: '🦃' },
  'shrimp': { category: 'fish', icon: '🦐' },
  'tuna': { category: 'fish', icon: '🐟' },
  'fish': { category: 'fish', icon: '🐟' },
  'tofu': { category: 'protein', icon: '🧈' },
  'egg': { category: 'protein', icon: '🥚' },
  'eggs': { category: 'protein', icon: '🥚' },
  
  // Leafy Greens
  'arugula': { category: 'greens', icon: '🥬' },
  'spring mix': { category: 'greens', icon: '🥬' },
  'lettuce': { category: 'greens', icon: '🥬' },
  'spinach': { category: 'greens', icon: '🥬' },
  'kale': { category: 'greens', icon: '🥬' },
  'mixed greens': { category: 'greens', icon: '🥬' },
  'organic arugula': { category: 'greens', icon: '🥬' },
  
  // Vegetables
  'tomato': { category: 'vegetable', icon: '🍅' },
  'tomatoes': { category: 'vegetable', icon: '🍅' },
  'tomato sauce': { category: 'vegetable', icon: '🍅' },
  'onion': { category: 'vegetable', icon: '🧅' },
  'onions': { category: 'vegetable', icon: '🧅' },
  'shallot': { category: 'vegetable', icon: '🧅' },
  'shallots': { category: 'vegetable', icon: '🧅' },
  'garlic': { category: 'vegetable', icon: '🧄' },
  'bell pepper': { category: 'vegetable', icon: '🫑' },
  'pepper': { category: 'vegetable', icon: '🫑' },
  'broccoli': { category: 'vegetable', icon: '🥦' },
  'carrot': { category: 'vegetable', icon: '🥕' },
  'carrots': { category: 'vegetable', icon: '🥕' },
  'cucumber': { category: 'vegetable', icon: '🥒' },
  'zucchini': { category: 'vegetable', icon: '🥒' },
  'potato': { category: 'vegetable', icon: '🥔' },
  'potatoes': { category: 'vegetable', icon: '🥔' },
  'sweet potato': { category: 'vegetable', icon: '🍠' },
  'sweet potatoes': { category: 'vegetable', icon: '🍠' },
  
  // Fruits
  'pomegranate': { category: 'fruit', icon: '🍎' },
  'pomegranates': { category: 'fruit', icon: '🍎' },
  'lemon': { category: 'fruit', icon: '🍋' },
  'lemons': { category: 'fruit', icon: '🍋' },
  'lime': { category: 'fruit', icon: '🍋' },
  'orange': { category: 'fruit', icon: '🍊' },
  'strawberry': { category: 'fruit', icon: '🍓' },
  'strawberries': { category: 'fruit', icon: '🍓' },
  'blueberry': { category: 'fruit', icon: '🫐' },
  'blueberries': { category: 'fruit', icon: '🫐' },
  'raspberry': { category: 'fruit', icon: '🫐' },
  'raspberries': { category: 'fruit', icon: '🫐' },
  'banana': { category: 'fruit', icon: '🍌' },
  'bananas': { category: 'fruit', icon: '🍌' },
  'avocado': { category: 'fruit', icon: '🥑' },
  
  // Grains & Starches
  'rice': { category: 'grains', icon: '🍚' },
  'basmati rice': { category: 'grains', icon: '🍚' },
  'pasta': { category: 'grains', icon: '🍝' },
  'spaghetti': { category: 'grains', icon: '🍝' },
  'noodles': { category: 'grains', icon: '🍜' },
  'quinoa': { category: 'grains', icon: '🌾' },
  'bread': { category: 'grains', icon: '🍞' },
  'tortilla': { category: 'grains', icon: '🌮' },
  'tortillas': { category: 'grains', icon: '🌮' },
  
  // Dairy
  'milk': { category: 'dairy', icon: '🥛' },
  'cheese': { category: 'dairy', icon: '🧀' },
  'butter': { category: 'dairy', icon: '🧈' },
  'yogurt': { category: 'dairy', icon: '🥛' },
  'sour cream': { category: 'dairy', icon: '🥛' },
  
  // Pantry Items
  'olive oil': { category: 'pantry', icon: '🫒' },
  'vegetable oil': { category: 'pantry', icon: '🫒' },
  'oil': { category: 'pantry', icon: '🫒' },
  'honey': { category: 'pantry', icon: '🍯' },
  'vinegar': { category: 'pantry', icon: '🍶' },
  'soy sauce': { category: 'pantry', icon: '🍶' },
  'salt': { category: 'pantry', icon: '🧂' },
  'black pepper': { category: 'pantry', icon: '🌶️' },
  'pepper': { category: 'pantry', icon: '🌶️' },
  'sugar': { category: 'pantry', icon: '🍬' },
  'flour': { category: 'pantry', icon: '🌾' },
}

// Note: Placeholder images are rendered using LinearGradient in the carousel component
// This ensures they always work and never fail to load

function getIngredientCategory(normalizedName: string): string {
  if (!normalizedName) return 'default'
  
  // Check specific mappings first
  if (INGREDIENT_MAPPINGS[normalizedName]) {
    return INGREDIENT_MAPPINGS[normalizedName].category
  }
  
  // Fallback to keyword matching
  if (normalizedName.includes('salmon') || normalizedName.includes('fish') || normalizedName.includes('tuna') || normalizedName.includes('shrimp')) {
    return 'fish'
  }
  if (normalizedName.includes('chicken') || normalizedName.includes('beef') || normalizedName.includes('pork') || normalizedName.includes('turkey') || normalizedName.includes('egg')) {
    return 'protein'
  }
  if (normalizedName.includes('arugula') || normalizedName.includes('lettuce') || normalizedName.includes('spinach') || normalizedName.includes('kale') || normalizedName.includes('spring mix')) {
    return 'greens'
  }
  if (normalizedName.includes('pomegranate') || normalizedName.includes('berry') || normalizedName.includes('lemon') || normalizedName.includes('lime') || normalizedName.includes('orange') || normalizedName.includes('banana') || normalizedName.includes('avocado')) {
    return 'fruit'
  }
  if (normalizedName.includes('broccoli') || normalizedName.includes('tomato') || normalizedName.includes('pepper') || normalizedName.includes('onion') || normalizedName.includes('garlic') || normalizedName.includes('carrot') || normalizedName.includes('potato')) {
    return 'vegetable'
  }
  if (normalizedName.includes('rice') || normalizedName.includes('quinoa') || normalizedName.includes('pasta') || normalizedName.includes('noodle') || normalizedName.includes('bread') || normalizedName.includes('tortilla')) {
    return 'grains'
  }
  if (normalizedName.includes('milk') || normalizedName.includes('cheese') || normalizedName.includes('butter') || normalizedName.includes('yogurt')) {
    return 'dairy'
  }
  if (normalizedName.includes('oil') || normalizedName.includes('honey') || normalizedName.includes('vinegar') || normalizedName.includes('salt') || normalizedName.includes('sugar') || normalizedName.includes('flour')) {
    return 'pantry'
  }
  
  return 'default'
}

export function getIngredientImage(name: string): IngredientImageResult {
  if (!name) {
    return {
      isPlaceholder: true,
      category: 'default'
    }
  }
  
  const normalized = normalizeIngredientName(name)
  
  // Check if we have a specific mapping
  const mapping = INGREDIENT_MAPPINGS[normalized]
  const category = mapping?.category || getIngredientCategory(normalized)
  
  // Always returns valid category - never fails
  return {
    isPlaceholder: true,
    category
  }
}

// Export category colors for use in carousel component
export function getCategoryColors(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default
}

// Export icon for ingredient
export function getIngredientIcon(name: string): string {
  if (!name) return CATEGORY_COLORS.default.icon
  
  const normalized = normalizeIngredientName(name)
  const mapping = INGREDIENT_MAPPINGS[normalized]
  
  if (mapping) {
    return mapping.icon
  }
  
  // Fuzzy matching for similar ingredients
  // Check if ingredient name contains keywords that match existing mappings
  for (const [key, value] of Object.entries(INGREDIENT_MAPPINGS)) {
    // If the normalized name contains the key, or vice versa, use that icon
    if (normalized.includes(key) || key.includes(normalized)) {
      return value.icon
    }
  }
  
  // Category-based fallback with better keyword matching
  const category = getIngredientCategory(normalized)
  const categoryIcon = CATEGORY_COLORS[category]?.icon || CATEGORY_COLORS.default.icon
  
  // Special handling for common ingredient patterns
  if (normalized.includes('berry') || normalized.includes('berries')) {
    return '🫐' // Use berry emoji for any berry type
  }
  if (normalized.includes('nut')) {
    return '🥜' // Nuts emoji
  }
  if (normalized.includes('seed')) {
    return '🌰' // Seeds emoji
  }
  if (normalized.includes('herb') || normalized.includes('basil') || normalized.includes('parsley') || normalized.includes('cilantro')) {
    return '🌿' // Herbs emoji
  }
  if (normalized.includes('mushroom')) {
    return '🍄' // Mushroom emoji
  }
  
  return categoryIcon
}
