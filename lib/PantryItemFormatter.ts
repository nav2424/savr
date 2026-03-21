// SAVR Pantry Item Formatter - Unified formatting for all pantry items
// Ensures consistent emoji/image assignment and categorization across all import methods

export interface FormattedPantryItem {
  name: string
  icon: string  // Emoji for the item
  category: string
  quantity: number
  unit: string
  location: 'fridge' | 'freezer' | 'pantry'
  barcode?: string
  notes?: string
  expiry_date?: string
  price?: number
  image_url?: string
}

/**
 * Comprehensive emoji mapping for pantry items
 * Maps item names (and variations) to specific emojis
 */
const ITEM_EMOJI_MAP: Record<string, string> = {
  // Fruits
  'apple': '🍎', 'apples': '🍎', 'green apple': '🍏',
  'banana': '🍌', 'bananas': '🍌',
  'orange': '🍊', 'oranges': '🍊', 'tangerine': '🍊',
  'lemon': '🍋', 'lemons': '🍋',
  'lime': '🍋', 'limes': '🍋',
  'strawberry': '🍓', 'strawberries': '🍓',
  'cherry': '🍒', 'cherries': '🍒',
  'grape': '🍇', 'grapes': '🍇',
  'watermelon': '🍉',
  'peach': '🍑', 'peaches': '🍑',
  'pear': '🍐', 'pears': '🍐',
  'pineapple': '🍍',
  'mango': '🥭', 'mangoes': '🥭', 'mangos': '🥭',
  'avocado': '🥑', 'avocados': '🥑',
  'kiwi': '🥝',
  'blueberry': '🫐', 'blueberries': '🫐',
  'coconut': '🥥',
  
  // Vegetables
  'tomato': '🍅', 'tomatoes': '🍅',
  'broccoli': '🥦',
  'carrot': '🥕', 'carrots': '🥕',
  'corn': '🌽',
  'pepper': '🫑', 'peppers': '🫑', 'bell pepper': '🫑',
  'cucumber': '🥒', 'cucumbers': '🥒',
  'lettuce': '🥬', 'salad': '🥗', 'greens': '🥬',
  'spinach': '🥬',
  'potato': '🥔', 'potatoes': '🥔',
  'onion': '🧅', 'onions': '🧅',
  'garlic': '🧄',
  'eggplant': '🍆', 'aubergine': '🍆',
  'mushroom': '🍄', 'mushrooms': '🍄',
  'peas': '🫛',
  'beans': '🫘',
  
  // Dairy & Eggs
  'milk': '🥛',
  'cheese': '🧀',
  'butter': '🧈',
  'egg': '🥚', 'eggs': '🥚',
  'yogurt': '🥛', 'yoghurt': '🥛',
  'cream': '🥛', 'heavy cream': '🥛',
  'sour cream': '🥛',
  'ice cream': '🍦',
  
  // Meat & Seafood
  'chicken': '🍗', 'poultry': '🍗',
  'beef': '🥩', 'steak': '🥩',
  'pork': '🥩',
  'bacon': '🥓',
  'ham': '🍖',
  'turkey': '🍗',
  'fish': '🐟',
  'salmon': '🐟',
  'tuna': '🐟',
  'shrimp': '🦐',
  'crab': '🦀',
  'lobster': '🦞',
  
  // Bakery & Grains
  'bread': '🍞',
  'baguette': '🥖',
  'croissant': '🥐',
  'bagel': '🥯',
  'rice': '🍚',
  'pasta': '🍝',
  'cereal': '🥣',
  'oatmeal': '🥣', 'oats': '🥣',
  'pancake': '🥞', 'pancakes': '🥞',
  'waffle': '🧇', 'waffles': '🧇',
  
  // Beverages
  'coffee': '☕', 'espresso': '☕',
  'tea': '🍵',
  'water': '💧', 'bottled water': '💧',
  'juice': '🧃',
  'soda': '🥤', 'pop': '🥤', 'soft drink': '🥤',
  'beer': '🍺', 'lager': '🍺',
  'wine': '🍷',
  'cocktail': '🍹',
  
  // Snacks & Sweets
  'cookie': '🍪', 'cookies': '🍪',
  'chocolate': '🍫',
  'candy': '🍬',
  'chips': '🥔', 'crisps': '🥔', 'potato chips': '🥔',
  'popcorn': '🍿',
  'pretzel': '🥨', 'pretzels': '🥨',
  'donut': '🍩', 'doughnut': '🍩',
  'cake': '🍰',
  'pie': '🥧',
  'honey': '🍯',
  
  // Condiments & Sauces
  'ketchup': '🍅', 'catsup': '🍅',
  'mustard': '🌭',
  'mayonnaise': '🥚', 'mayo': '🥚',
  'hot sauce': '🌶️',
  'soy sauce': '🥢',
  'olive oil': '🫒', 'oil': '🫒',
  'vinegar': '🍶',
  'salt': '🧂',
  'ground pepper': '🧂', 'black pepper': '🧂',
  'sugar': '🍚',
  'flour': '🌾',
  
  // Canned & Packaged
  'soup': '🥫', 'canned soup': '🥫',
  'canned beans': '🫘', 'black beans': '🫘', 'kidney beans': '🫘',
  'canned tuna': '🐟',
  
  // Prepared Foods
  'pizza': '🍕',
  'burger': '🍔', 'hamburger': '🍔',
  'hot dog': '🌭', 'hotdog': '🌭',
  'taco': '🌮', 'tacos': '🌮',
  'burrito': '🌯',
  'sandwich': '🥪', 'sub': '🥪',
  'sushi': '🍣',
  'ramen': '🍜', 'noodles': '🍜',
  
  // Nuts & Seeds
  'peanut': '🥜', 'peanuts': '🥜',
  'almond': '🌰', 'almonds': '🌰',
  'walnut': '🌰', 'walnuts': '🌰',
  'cashew': '🥜', 'cashews': '🥜',
}

/**
 * Category-based emoji fallbacks
 * When specific item isn't found, use category-based emoji
 */
const CATEGORY_EMOJI_MAP: Record<string, string> = {
  'Produce': '🥦',
  'Meat, Poultry & Seafood': '🍗',
  'Dairy & Eggs': '🥛',
  'Grains, Bread & Pasta': '🌾',
  'Condiments, Sauces & Spreads': '🥫',
  'Pantry Staples & Essentials': '🧂',
  'Plant-Based Proteins & Legumes': '🍱',
  'Snacks, Sweets & Desserts': '🍫',
  'Beverages': '🥤',
  'Frozen': '❄️',
  'Household & Cleaning': '🧹',
  'Non-Food / Misc': '📦',
}

/**
 * Standardized category names
 * Ensures consistent category naming across all import methods
 */
const STANDARD_CATEGORIES = [
  'Produce',
  'Meat, Poultry & Seafood',
  'Dairy & Eggs',
  'Grains, Bread & Pasta',
  'Condiments, Sauces & Spreads',
  'Pantry Staples & Essentials',
  'Plant-Based Proteins & Legumes',
  'Snacks, Sweets & Desserts',
  'Beverages',
  'Frozen',
  'Household & Cleaning',
  'Non-Food / Misc',
]

/**
 * Normalizes category names to standard format
 */
export function normalizeCategory(category: string): string {
  if (!category) return 'Other'
  
  const lower = category
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  const standardMatch = STANDARD_CATEGORIES.find(standard =>
    standard.toLowerCase() === lower
  )
  if (standardMatch) {
    return standardMatch
  }
  
  // Direct mapping
  const categoryMap: Record<string, string> = {
    'produce': 'Produce',
    'fruits': 'Produce',
    'fruit': 'Produce',
    'vegetables': 'Produce',
    'vegetable': 'Produce',
    'veggies': 'Produce',
    'greens': 'Produce',
    'herbs': 'Produce',
    'fresh produce': 'Produce',
    
    'meat': 'Meat, Poultry & Seafood',
    'meats': 'Meat, Poultry & Seafood',
    'seafood': 'Meat, Poultry & Seafood',
    'meat & seafood': 'Meat, Poultry & Seafood',
    'meat and seafood': 'Meat, Poultry & Seafood',
    'poultry': 'Meat, Poultry & Seafood',
    'fish': 'Meat, Poultry & Seafood',
    
    'dairy': 'Dairy & Eggs',
    'dairy & eggs': 'Dairy & Eggs',
    'dairy and eggs': 'Dairy & Eggs',
    'eggs': 'Dairy & Eggs',
    'egg': 'Dairy & Eggs',
    'cheese': 'Dairy & Eggs',
    'yogurt': 'Dairy & Eggs',
    'yoghurt': 'Dairy & Eggs',
    'yogourt': 'Dairy & Eggs',
    'butter': 'Dairy & Eggs',
    
    'bakery': 'Grains, Bread & Pasta',
    'bread': 'Grains, Bread & Pasta',
    'grains': 'Grains, Bread & Pasta',
    'grains & bread': 'Grains, Bread & Pasta',
    'grains and bread': 'Grains, Bread & Pasta',
    'cereals': 'Grains, Bread & Pasta',
    'tortillas': 'Grains, Bread & Pasta',
    'flatbreads': 'Grains, Bread & Pasta',
    'wraps': 'Grains, Bread & Pasta',
    'pasta': 'Grains, Bread & Pasta',
    
    'snacks': 'Snacks, Sweets & Desserts',
    'snack': 'Snacks, Sweets & Desserts',
    'sweets': 'Snacks, Sweets & Desserts',
    'desserts': 'Snacks, Sweets & Desserts',
    'dessert': 'Snacks, Sweets & Desserts',
    'treats': 'Snacks, Sweets & Desserts',
    'bars': 'Snacks, Sweets & Desserts',
    
    'condiments': 'Condiments, Sauces & Spreads',
    'condiment': 'Condiments, Sauces & Spreads',
    'sauces': 'Condiments, Sauces & Spreads',
    'sauce': 'Condiments, Sauces & Spreads',
    'seasonings': 'Condiments, Sauces & Spreads',
    'spices': 'Condiments, Sauces & Spreads',
    'syrups': 'Condiments, Sauces & Spreads',
    'syrup': 'Condiments, Sauces & Spreads',
    'spread': 'Condiments, Sauces & Spreads',
    'spreads': 'Condiments, Sauces & Spreads',
    'pesto': 'Condiments, Sauces & Spreads',
    
    'plant-based': 'Plant-Based Proteins & Legumes',
    'plant based': 'Plant-Based Proteins & Legumes',
    'plant-based protein': 'Plant-Based Proteins & Legumes',
    'vegetarian protein': 'Plant-Based Proteins & Legumes',
    'veggie protein': 'Plant-Based Proteins & Legumes',
    'meat alternatives': 'Plant-Based Proteins & Legumes',
    'meat alternative': 'Plant-Based Proteins & Legumes',
    'tofu': 'Plant-Based Proteins & Legumes',
    'tempeh': 'Plant-Based Proteins & Legumes',
    'seitan': 'Plant-Based Proteins & Legumes',
    'legumes': 'Plant-Based Proteins & Legumes',
    'lentils': 'Plant-Based Proteins & Legumes',
    'chickpeas': 'Plant-Based Proteins & Legumes',
    'beans': 'Plant-Based Proteins & Legumes',
    
    'pantry': 'Pantry Staples & Essentials',
    'pantry staples': 'Pantry Staples & Essentials',
    'pantry items': 'Pantry Staples & Essentials',
    'pantry staple': 'Pantry Staples & Essentials',
    'pantry item': 'Pantry Staples & Essentials',
    'canned goods': 'Pantry Staples & Essentials',
    'dry goods': 'Pantry Staples & Essentials',
    'canned': 'Pantry Staples & Essentials',
    'packaged': 'Pantry Staples & Essentials',
    'shelf-stable': 'Pantry Staples & Essentials',
    'shelf stable': 'Pantry Staples & Essentials',
    'cooking essentials': 'Pantry Staples & Essentials',
    'baking': 'Pantry Staples & Essentials',
    'oils': 'Pantry Staples & Essentials',
    'oil': 'Pantry Staples & Essentials',
    
    'beverages': 'Beverages',
    'drinks': 'Beverages',
    'drink': 'Beverages',
    'coffee': 'Beverages',
    'tea': 'Beverages',
    'soda': 'Beverages',
    'juice': 'Beverages',
    
    'frozen': 'Frozen',
    'frozen foods': 'Frozen',
    'frozen food': 'Frozen',
    'frozen meals': 'Frozen',
    'frozen meal': 'Frozen',
    'frozen entree': 'Frozen',
    'frozen entrees': 'Frozen',
    'frozen dinner': 'Frozen',
    'frozen dinners': 'Frozen',
    
    'non-food': 'Non-Food / Misc',
    'non food': 'Non-Food / Misc',
    'misc': 'Non-Food / Misc',
    'other': 'Non-Food / Misc',
    'miscellaneous': 'Non-Food / Misc',
    'household': 'Household & Cleaning',
    'household & cleaning': 'Household & Cleaning',
    'cleaning': 'Household & Cleaning',
    'cleaning products': 'Household & Cleaning',
    'household products': 'Household & Cleaning',
    'paper goods': 'Household & Cleaning',
    'parchment': 'Household & Cleaning',
    'parchment paper': 'Household & Cleaning',
    'foil': 'Household & Cleaning',
    'aluminium foil': 'Household & Cleaning',
    'aluminum foil': 'Household & Cleaning',
    'supplies': 'Non-Food / Misc',
    'wrap': 'Non-Food / Misc',
    'paper': 'Non-Food / Misc',
    'bags': 'Non-Food / Misc',
  }
  
  return categoryMap[lower] || 'Non-Food / Misc'
}

/**
 * Get emoji for an item based on its name and category
 */
export function getItemEmoji(itemName: string, category?: string): string {
  if (!itemName) return '📦'
  
  const lower = itemName.toLowerCase().trim()
  const padded = ` ${lower.replace(/\s+/g, ' ')} `
  
  // 1) Exact match first (most reliable)
  if (ITEM_EMOJI_MAP[lower]) return ITEM_EMOJI_MAP[lower]

  // 2) Whole-word / phrase match (prevents "water" -> "watermelon")
  for (const [key, emoji] of Object.entries(ITEM_EMOJI_MAP)) {
    if (padded.includes(` ${key} `)) {
      return emoji
    }
  }

  // 3) Fallback to substring match where the emoji key is contained in the name.
  // IMPORTANT: do NOT do reverse matching (key.includes(lower)) because it causes
  // short names to match longer keys (e.g., "water" matching "watermelon").
  for (const [key, emoji] of Object.entries(ITEM_EMOJI_MAP)) {
    if (lower.includes(key)) {
      return emoji
    }
  }
  
  // If no specific emoji found, use category-based emoji
  if (category) {
    const normalizedCategory = normalizeCategory(category)
    return CATEGORY_EMOJI_MAP[normalizedCategory] || '📦'
  }
  
  return '📦'
}

/**
 * Determines storage location based on item category and name
 * This is the main function used for location detection
 */
export function determineStorageLocation(
  itemName: string, 
  category: string,
  existingLocation?: 'fridge' | 'freezer' | 'pantry'
): 'fridge' | 'freezer' | 'pantry' {
  // Use existing location if provided
  if (existingLocation) {
    return existingLocation
  }
  
  const lower = itemName
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const normalizedCategory = normalizeCategory(category)
  
  // Frozen items - check first
  if (lower.includes('frozen') || lower.includes('ice cream')) {
    return 'freezer'
  }
  
  // Fridge items - ALL produce goes in fridge
  if (normalizedCategory === 'Produce') {
    return 'fridge'
  }
  
  // ALL Dairy & Eggs go in fridge
  if (normalizedCategory === 'Dairy & Eggs') {
    return 'fridge'
  }
  
  // ALL Meat, Poultry & Seafood go in fridge (unless frozen)
  if (normalizedCategory === 'Meat, Poultry & Seafood') {
    return 'fridge'
  }
  
  // Plant-based proteins - most go in fridge, but check for shelf-stable
  if (normalizedCategory === 'Plant-Based Proteins & Legumes') {
    // Canned or dried legumes go in pantry
    if (lower.includes('canned') || lower.includes('dried') || lower.includes('dry')) {
      return 'pantry'
    }
    // Fresh tofu, tempeh, etc. go in fridge
    return 'fridge'
  }
  
  // Fresh/refrigerated keywords
  if (lower.includes('fresh') || lower.includes('refrigerated')) {
    return 'fridge'
  }
  
  // Default to pantry for shelf-stable items (Grains, Bread & Pasta, Pantry Staples, etc.)
  return 'pantry'
}

/**
 * Smart category detection based on item name
 */
export function detectCategoryFromName(itemName: string): string {
  const lower = itemName
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  // Use space-padded matching to avoid substring false positives (e.g., "steak" containing "tea")
  const padded = ` ${lower.replace(/\s+/g, ' ')} `
  const hasTerm = (term: string) => padded.includes(` ${term} `)
  const hasAnyTerm = (terms: string[]) => terms.some(hasTerm)
  
  // Produce detection
  const produceKeywords = [
    'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'lemon', 'lemons',
    'lime', 'limes', 'mandarin', 'mandarins', 'tangerine', 'tangerines', 'clementine', 'clementines',
    'strawberry', 'strawberries', 'cherry', 'cherries', 'grape', 'grapes',
    'watermelon', 'peach', 'peaches', 'pear', 'pears', 'pineapple', 'mango', 'mangoes',
    'avocado', 'avocados', 'kiwi', 'blueberry', 'blueberries', 'raspberry', 'raspberries',
    'blackberry', 'blackberries', 'berry', 'berries', 'coconut',
    'tomato', 'tomatoes', 'broccoli', 'carrot', 'carrots', 'corn', 'pepper', 'peppers',
    'cucumber', 'cucumbers', 'lettuce', 'salad', 'greens', 'spinach', 'potato', 'potatoes',
    'onion', 'onions', 'shallot', 'shallots', 'garlic', 'eggplant', 'mushroom', 'mushrooms', 'peas',
    'beet', 'beets', 'celery', 'zucchini', 'squash', 'kale', 'cabbage', 'radish', 'radishes',
    'coriander', 'coriander leaves', 'cilantro', 'dill', 'thyme', 'oregano', 'rosemary', 'sage',
    'organic', 'fresh', 'fruit', 'vegetable', 'veggie', 'produce', 'arugula', 'spring mix'
  ]
  
  // Dairy detection
  const dairyKeywords = [
    'milk', 'cheese', 'butter', 'egg', 'eggs', 'yogurt', 'yoghurt', 'yogourt', 'cream',
    'sour cream', 'heavy cream', 'ice cream', 'dairy', 'lactose'
  ]
  
  // Meat, poultry, seafood detection - comprehensive and STRICT list
  // CRITICAL: This must catch ALL meat items before they fall through to Pantry Staples
  const meatKeywords = [
    // Core meat terms (highest priority)
    'meat', 'seafood', 'poultry',
    
    // Beef cuts and variations
    'beef', 'steak', 'steaks', 'ribeye', 'sirloin', 'filet', 't-bone', 'porterhouse',
    'new york', 'ny strip', 'strip steak', 'strip steaks', 'boneless', 'bone-in',
    'beef roast', 'beef brisket', 'beef ribs', 'beef tenderloin', 'beef chuck', 'beef round',
    'ground beef', 'beef patty', 'beef patties', 'beef burger', 'beef burgers',
    
    // Pork cuts and variations
    'pork', 'bacon', 'ham', 'pork chops', 'pork tenderloin', 'pork shoulder', 'pork ribs',
    'pork loin', 'pork belly', 'ground pork', 'pork sausage', 'pork sausages',
    
    // Chicken and poultry
    'chicken', 'turkey', 'duck', 'goose', 'quail', 'cornish hen',
    'chicken breast', 'chicken thighs', 'chicken wings', 'chicken drumsticks', 'chicken legs',
    'chicken thighs', 'chicken tenderloin', 'chicken tenders', 'ground chicken', 'ground turkey',
    'turkey breast', 'turkey leg', 'turkey wing',
    
    // Other meats
    'lamb', 'veal', 'venison', 'bison', 'buffalo',
    'lamb chops', 'lamb leg', 'lamb shoulder', 'veal cutlet', 'veal chops',
    
    // Fish and seafood
    'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'mahi mahi', 'halibut', 'trout', 'mackerel',
    'shrimp', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'lobsters',
    'scallops', 'mussels', 'clams', 'oysters', 'squid', 'octopus', 'calamari',
    'anchovy', 'anchovies', 'sardine', 'sardines', 'caviar',
    
    // Processed meat terms
    'sausage', 'sausages', 'hot dog', 'hot dogs', 'bratwurst', 'chorizo', 'pepperoni',
    'deli meat', 'deli', 'cold cuts', 'lunch meat', 'prosciutto', 'salami', 'pastrami'
  ]
  
  // Grain & bread detection
  const grainKeywords = [
    'bread', 'baguette', 'croissant', 'bagel', 'pancake', 'pancakes',
    'waffle', 'waffles', 'muffin', 'muffins', 'cake', 'pie', 'bakery',
    'rice', 'pasta', 'noodles', 'cereal', 'oatmeal', 'oats', 'quinoa', 'barley',
    'wheat', 'flour', 'grains', 'grain', 'tortilla', 'tortillas',
    'taco', 'tacos', 'soft taco', 'flatbread', 'wrap', 'wraps'
  ]
  
  // Plant-based detection
  const plantBasedKeywords = [
    'tofu', 'tempeh', 'seitan', 'jackfruit', 'chickpea', 'chickpeas', 'lentil', 'lentils',
    'legume', 'legumes', 'edamame', 'falafel', 'veggie burger', 'veggie patties',
    'bean', 'beans', 'black bean', 'black beans', 'kidney bean', 'kidney beans', 'pinto bean', 'pinto beans',
    'plant-based', 'plant based', 'vegetarian protein', 'meatless', 'meat alternative',
    'beyond meat', 'impossible', 'soy protein'
  ]
  
  // Beverages detection
  const beverageKeywords = [
    'coffee', 'tea', 'water', 'juice', 'soda', 'pop', 'beer', 'wine',
    'cocktail', 'drink', 'beverage', 'smoothie'
  ]

  // Strong beverage phrases that should override fruit/produce words (e.g. "orange sports drink")
  const beverageStrongKeywords = [
    'sports drink',
    'energy drink',
    'soft drink',
    'sparkling water',
    'seltzer',
    'iced tea',
    'lemonade',
    'orange juice',
    'apple juice',
    'cranberry juice',
    'grape juice',
  ]
  
  // Frozen detection - check for frozen foods, pizzas, frozen meals
  // "frozen" alone catches "frozen chicken", "frozen beef", etc.
  const frozenKeywords = [
    'frozen', 'ice cream', 'frozen vegetables', 'frozen fruit', 'frozen meal',
    'frozen pizza', 'pizza', 'pizzas', 'frozen entree', 'frozen dinner',
    'frozen breakfast', 'frozen lunch', 'frozen snack', 'frozen appetizer',
    'frozen chicken', 'frozen beef', 'frozen fish', 'frozen salmon', 'frozen shrimp',
    'frozen broccoli', 'frozen peas', 'frozen corn', 'frozen mixed vegetables'
  ]
  
  // Household & Cleaning - detergent, cleaners, paper goods, foil, parchment, etc.
  const cleaningKeywords = [
    'detergent', 'bleach', 'cleaner', 'cleaning spray', 'all-purpose cleaner',
    'glass cleaner', 'disinfectant', 'dish soap', 'laundry soap', 'soap', 'fabric softener',
    'dryer sheet', 'sponge', 'scrubber', 'mop', 'broom', 'trash bag', 'trash bags',
    'garbage bag', 'garbage bags', 'paper towel', 'paper towels', 'napkin', 'napkins',
    'aluminum foil', 'aluminium foil', 'aluminium paper', 'tin foil', 'plastic wrap', 'cling wrap',
    'ziploc', 'storage bag', 'storage bags', 'parchment paper', 'parchment', 'baking paper', 'wax paper',
    'vim', 'javel', 'scouring pad', 'scouring powder', 'toilet cleaner', 'drain cleaner', 'window cleaner',
    'downy', 'tide', 'gain', 'clorox'
  ]
  
  // Snacks detection
  const snackKeywords = [
    'cookie', 'cookies', 'chocolate', 'candy', 'chips', 'crisps', 'popcorn',
    'pretzel', 'pretzels', 'donut', 'doughnut', 'snack', 'sweet', 'dessert',
    'brownie', 'brownies', 'protein bar', 'protein snack', 'granola bar',
    'ice cream', 'cake', 'pastry', 'treat'
  ]
  
  // Condiments detection
  const condimentKeywords = [
    'ketchup', 'mustard', 'mayonnaise', 'mayo', 'hot sauce', 'soy sauce',
    'vinegar', 'honey', 'relish',
    'condiment', 'sauce', 'salsa', 'marinara', 'pesto', 'aioli', 'dressing',
    'syrup', 'spread', 'jam', 'jelly', 'preserve', 'chutney', 'tahini'
  ]
  
  // Pantry Staples detection - comprehensive keywords for canned/packaged/dry goods
  // NOTE: Exclude items that should be in other categories (tortillas, bread, etc.)
  const pantryStaplesKeywords = [
    'canned', 'can', 'jar', 'jarred', 'bottle', 'bottled', 'packaged', 'package',
    'soup', 'broth', 'stock',
    'crackers', 'nuts', 'seeds', 'dried', 'dehydrated',
    'spices', 'herbs', 'seasoning', 'mix', 'mixes',
    'salt', 'pepper', 'sugar',
    'peanut butter', 'jam', 'jelly', 'preserves', 'marmalade',
    'olive oil', 'vegetable oil', 'canola oil', 'cooking oil',
    'coconut milk', 'evaporated milk', 'condensed milk',
    'tuna', 'salmon', 'sardines', 'anchovies', 'canned fish',
    'pickles', 'olives', 'capers', 'artichokes',
    'bouillon', 'stock cubes', 'broth cubes',
    'baking powder', 'baking soda', 'yeast', 'vanilla extract',
    'chocolate chips', 'cocoa powder', 'cacao',
    'breadcrumbs', 'panko', 'croutons',
    'instant', 'quick-cook', 'ready-to-eat'
  ]

  // Non-food items that are NOT cleaning (go to Non-Food / Misc)
  // Note: parchment, foil, napkin, paper towel, garbage bag are in cleaningKeywords (Household & Cleaning)
  const nonFoodKeywords = [
    'baking sheet', 'zipper bag', 'filter', 'candle', 'disposable', 'container', 'baguette bag',
    'foil sheet', 'towel'
  ]

  // Baby & personal care - NOT pantry/food (check before pantry staples)
  const babyAndPersonalCareKeywords = [
    'diaper', 'diapers', 'pull-up', 'pull-ups', 'pullup', 'pullups',
    'baby wipe', 'baby wipes', 'wipes', 'training pant', 'training pants',
    'shampoo', 'conditioner', 'toothpaste', 'mouthwash', 'deodorant',
    'body wash', 'hand soap', 'bar soap', 'razor', 'razors', 'shave gel',
    'floss', 'lotion', 'sunscreen', 'facial', 'cleanser', 'serum',
    'cerave', 'dove ', 'degree ', 'downy ', 'crest ', 'colgate ',
    'tampon', 'pad', 'pads', 'feminine', 'cotton ball', 'q-tip', 'qtip'
  ]
  
  // Check for matches - prioritize specific categories first
  // IMPORTANT: Order matters! Check frozen and grains BEFORE produce to avoid false matches

  // Brand/product overrides (before meat so "ham" in "Arm & Hammer" doesn't match)
  const normalizedForBrand = lower.replace(/\s*&\s*/g, ' ').replace(/\s+/g, ' ')
  if (normalizedForBrand.includes('arm') && normalizedForBrand.includes('hammer')) {
    return 'Pantry Staples & Essentials' // Arm & Hammer = baking soda / household
  }
  if (lower.includes('chobani')) {
    return 'Dairy & Eggs' // Chobani = yogurt brand
  }
  
  // Frozen foods - check FIRST (highest priority)
  // This catches "frozen chicken", "pizza with peppers" as frozen, not meat/produce
  if (frozenKeywords.some(keyword => lower.includes(keyword))) {
    return 'Frozen'
  }
  
  // Household & Cleaning - check SECOND (before food categories)
  if (cleaningKeywords.some(keyword => lower.includes(keyword))) {
    return 'Household & Cleaning'
  }
  
  // Grains, Bread & Pasta - check THIRD (before produce to catch tortillas correctly)
  // This ensures tortillas always go to Grains, not Pantry Staples
  if (grainKeywords.some(keyword => lower.includes(keyword))) {
    return 'Grains, Bread & Pasta'
  }
  
  // Meat, poultry, seafood - check THIRD (CRITICAL: Must be strict and comprehensive)
  // Use word boundary matching to avoid false positives
  for (const keyword of meatKeywords) {
    // Exact match
    if (lower === keyword) {
      return 'Meat, Poultry & Seafood'
    }
    // Starts with keyword (e.g., "beef roast", "chicken breast", "boneless chicken")
    if (lower.startsWith(keyword + ' ')) {
      return 'Meat, Poultry & Seafood'
    }
    // Ends with keyword (e.g., "ground beef", "new york strip")
    if (lower.endsWith(' ' + keyword)) {
      return 'Meat, Poultry & Seafood'
    }
    // Contains keyword as whole word (e.g., "boneless meat", "new york strip thin")
    if (lower.includes(' ' + keyword + ' ')) {
      return 'Meat, Poultry & Seafood'
    }
    // Special case: "boneless" or "strip" at start followed by meat term
    if ((keyword === 'boneless' || keyword === 'strip') && 
        meatKeywords.some(k => k !== keyword && lower.includes(k))) {
      return 'Meat, Poultry & Seafood'
    }
  }
  
  // Additional strict checks for common meat patterns
  // "boneless [meat type]" pattern
  if (lower.startsWith('boneless ') && meatKeywords.some(k => lower.includes(k) && k !== 'boneless')) {
    return 'Meat, Poultry & Seafood'
  }
  // "new york strip" pattern
  if (lower.includes('new york') && (lower.includes('strip') || lower.includes('steak'))) {
    return 'Meat, Poultry & Seafood'
  }
  // "strip" followed by meat indicators
  if (lower.includes('strip') && (lower.includes('steak') || lower.includes('beef') || lower.includes('meat'))) {
    return 'Meat, Poultry & Seafood'
  }
  
  // Final fallback: check if item name contains any meat keyword (but be more strict)
  // Only match if keyword appears as a significant part of the name
  for (const keyword of meatKeywords) {
    if (lower.includes(keyword)) {
      // Ensure it's not part of a non-meat word (e.g., "meatball" is OK, but "sweetmeat" should be checked)
      const keywordIndex = lower.indexOf(keyword)
      // Check if it's at the start, end, or surrounded by spaces (whole word)
      if (keywordIndex === 0 || 
          lower[keywordIndex - 1] === ' ' || 
          keywordIndex + keyword.length === lower.length ||
          lower[keywordIndex + keyword.length] === ' ') {
        return 'Meat, Poultry & Seafood'
      }
    }
  }

  // Beverages - check BEFORE Produce so we classify by the full item name.
  // Example: "Orange Sports Drink" should be Beverages, not Produce.
  // Use "strong" phrases first, then fallback to standalone beverage keywords.
  if (hasAnyTerm(beverageStrongKeywords)) {
    return 'Beverages'
  }
  // Avoid classifying pantry items like "drink mix" as beverages
  if ((hasTerm('drink') || hasTerm('beverage')) && (hasTerm('mix') || hasTerm('powder'))) {
    // fall through (likely pantry staples)
  } else if (hasAnyTerm(['coffee', 'tea', 'water', 'juice', 'soda', 'pop', 'beer', 'wine', 'cocktail', 'smoothie']) || hasTerm('drink') || hasTerm('beverage')) {
    return 'Beverages'
  }
  
  // Coriander seeds / ground coriander = Pantry (spice), not Produce (fresh herb)
  if (hasAnyTerm(['coriander seeds', 'coriander seed', 'ground coriander'])) {
    return 'Pantry Staples & Essentials'
  }

  // Produce - check FOURTH (after frozen/grains to avoid false matches)
  // Only match if the item IS produce, not just contains produce as an ingredient
  // Use stricter matching to avoid "pizza with peppers" being classified as produce
  for (const keyword of produceKeywords) {
    // Exact match or starts with keyword (e.g., "peppers" or "peppers organic")
    if (lower === keyword || lower.startsWith(keyword + ' ')) {
      return 'Produce'
    }
    // Ends with keyword (e.g., "organic peppers")
    if (lower.endsWith(' ' + keyword)) {
      return 'Produce'
    }
    // Contains keyword but check if it's a standalone word, not part of a compound item
    // Skip if it's part of a larger item name (like "pizza with peppers")
    if (lower.includes(' ' + keyword + ' ')) {
      // Only match if keyword appears early in the name (likely the main item)
      const keywordIndex = lower.indexOf(' ' + keyword + ' ')
      if (keywordIndex < 20) { // Within first 20 chars, likely the main item
        return 'Produce'
      }
    }
  }
  // Only do loose matching for very specific produce items that are unlikely to be ingredients
  const strictProduceKeywords = ['organic', 'fresh', 'fruit', 'vegetable', 'veggie', 'produce', 'arugula', 'spring mix']
  if (strictProduceKeywords.some(keyword => lower.includes(keyword) && (lower.startsWith(keyword) || lower.indexOf(keyword) < 15))) {
    return 'Produce'
  }
  
  // Baby & personal care - BEFORE dairy (so "Cerave Cream" is Non-Food, not Dairy)
  if (babyAndPersonalCareKeywords.some(keyword => {
    const k = keyword.trim()
    return lower.includes(k) && (
      lower.startsWith(k) ||
      lower.endsWith(k) ||
      lower.includes(' ' + k + ' ') ||
      lower.includes(' ' + k) ||
      lower.includes(k + ' ')
    )
  })) {
    return 'Non-Food / Misc'
  }
  
  // Dairy - check FIFTH
  for (const keyword of dairyKeywords) {
    if (lower === keyword || lower.startsWith(keyword + ' ') || lower.endsWith(' ' + keyword) || lower.includes(' ' + keyword + ' ')) {
      return 'Dairy & Eggs'
    }
  }
  if (dairyKeywords.some(keyword => lower.includes(keyword))) {
    return 'Dairy & Eggs'
  }
  
  // Plant-based - check SIXTH
  for (const keyword of plantBasedKeywords) {
    if (lower === keyword || lower.startsWith(keyword + ' ') || lower.endsWith(' ' + keyword) || lower.includes(' ' + keyword + ' ')) {
      return 'Plant-Based Proteins & Legumes'
    }
  }
  if (plantBasedKeywords.some(keyword => lower.includes(keyword))) {
    return 'Plant-Based Proteins & Legumes'
  }
  
  // Beverages - check SEVENTH
  if (beverageKeywords.some(keyword => lower.includes(keyword))) {
    return 'Beverages'
  }
  
  // Snacks - check EIGHTH
  if (snackKeywords.some(keyword => lower.includes(keyword))) {
    return 'Snacks, Sweets & Desserts'
  }
  
  // Condiments - check NINTH
  if (condimentKeywords.some(keyword => lower.includes(keyword))) {
    return 'Condiments, Sauces & Spreads'
  }
  
  // Pantry staples - check LAST (lowest priority, after grains to avoid conflicts)
  // Make sure it's not already categorized as something else
  if (pantryStaplesKeywords.some(keyword => lower.includes(keyword))) {
    // Double-check it's not a grain item (tortillas, bread, etc.)
    if (!grainKeywords.some(keyword => lower.includes(keyword))) {
      return 'Pantry Staples & Essentials'
    }
  }
  
  if (nonFoodKeywords.some(keyword => lower.includes(keyword))) {
    return 'Non-Food / Misc'
  }
  
  return 'Pantry Staples & Essentials'
}

/**
 * Smart location detection based on item name and category
 * Uses normalized category names to ensure accurate location assignment
 */
function detectLocationFromName(itemName: string, category: string): 'fridge' | 'freezer' | 'pantry' {
  const lower = itemName
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  
  // Normalize category to match standard category names
  const normalizedCategory = normalizeCategory(category)
  
  // Frozen items - check first
  if (lower.includes('frozen') || lower.includes('ice cream')) {
    return 'freezer'
  }
  
  // Fridge items - based on normalized categories
  // ALL Produce items go in fridge (fruits, vegetables, berries, etc.)
  if (normalizedCategory === 'Produce') {
    return 'fridge'
  }
  
  // ALL Dairy & Eggs go in fridge
  if (normalizedCategory === 'Dairy & Eggs') {
    return 'fridge'
  }
  
  // ALL Meat, Poultry & Seafood go in fridge (unless frozen)
  if (normalizedCategory === 'Meat, Poultry & Seafood') {
    return 'fridge'
  }
  
  // Plant-based proteins (tofu, tempeh, etc.) go in fridge
  if (normalizedCategory === 'Plant-Based Proteins & Legumes') {
    // Check if it's a shelf-stable legume (canned beans, dried lentils)
    if (lower.includes('canned') || lower.includes('dried') || lower.includes('dry')) {
      return 'pantry'
    }
    return 'fridge'
  }
  
  // Fresh items with keywords
  if (lower.includes('fresh') || lower.includes('refrigerated')) {
    return 'fridge'
  }
  
  // Specific item keywords that need fridge
  const fridgeKeywords = [
    'milk', 'cheese', 'butter', 'egg', 'eggs', 'yogurt', 'cream', 'sour cream',
    'chicken', 'beef', 'steak', 'steaks', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
    'turkey', 'duck', 'lamb', 'veal', 'bacon', 'ham', 'ground beef', 'ground pork',
    'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries',
    'blackberry', 'blackberries', 'cherry', 'cherries', 'grape', 'grapes',
    'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'lemon', 'lemons',
    'tomato', 'tomatoes', 'lettuce', 'spinach', 'carrot', 'carrots', 'broccoli',
    'cucumber', 'cucumbers', 'pepper', 'peppers', 'celery', 'mushroom', 'mushrooms',
    'avocado', 'avocados', 'peach', 'peaches', 'pear', 'pears', 'plum', 'plums',
    'kiwi', 'mango', 'mangoes', 'pineapple', 'watermelon', 'cantaloupe', 'honeydew'
  ]
  
  if (fridgeKeywords.some(keyword => lower.includes(keyword))) {
    return 'fridge'
  }
  
  // Default to pantry for shelf-stable items
  return 'pantry'
}

/**
 * Unified formatter for all pantry items
 * Ensures consistent formatting regardless of import method (barcode, receipt, image scan)
 */
export function formatPantryItem(input: {
  name: string
  category?: string
  quantity?: number
  unit?: string
  location?: 'fridge' | 'freezer' | 'pantry'
  barcode?: string
  notes?: string
  expiry_date?: string
  price?: number
  emoji?: string
  image?: string
}): FormattedPantryItem {
  // Smart category detection - use provided category or detect from name
  const detectedCategory = input.category ? normalizeCategory(input.category) : detectCategoryFromName(input.name)
  
  // Get appropriate emoji (prefer provided emoji, then lookup by name)
  const icon = input.emoji || getItemEmoji(input.name, detectedCategory)
  
  // Smart location detection - use provided location or detect from name and category
  // Use determineStorageLocation which properly handles normalized categories
  const location = input.location || determineStorageLocation(input.name, detectedCategory)
  
  return {
    name: input.name,
    icon,
    category: detectedCategory,
    quantity: input.quantity || 1,
    unit: input.unit || 'unit',
    location,
    barcode: input.barcode,
    notes: input.notes,
    expiry_date: input.expiry_date,
    price: input.price,
    image_url: input.image,
  }
}

/**
 * Batch format multiple items (useful for receipt scanning)
 */
export function formatPantryItems(items: Array<{
  name: string
  category?: string
  quantity?: number
  unit?: string
  location?: 'fridge' | 'freezer' | 'pantry'
  barcode?: string
  notes?: string
  expiry_date?: string
  price?: number
  emoji?: string
  image?: string
}>): FormattedPantryItem[] {
  return items.map(item => formatPantryItem(item))
}

