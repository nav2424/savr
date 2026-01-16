// Curated recipe image catalog
// Provides deterministic, high-quality images for common recipe categories

export interface RecipeImageContext {
  title: string
  description?: string
  ingredients: string[]
  tags?: string[]
}

interface RecipeImageRule {
  id: string
  imageUrl: string
  match: (ctx: NormalizedContext) => boolean
}

interface NormalizedContext {
  title: string
  description: string
  ingredients: string[]
  text: string
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80&auto=format&fit=crop'

const CURATED_RULES: RecipeImageRule[] = [
  // --- Signature combinations -------------------------------------------------
  {
    id: 'maple-salmon',
    imageUrl:
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1200&q=80&auto=format&fit=crop',
    match: ctx => hasAll(ctx, ['maple', 'salmon']),
  },
  {
    id: 'maple-chicken',
    imageUrl:
      'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=1200&q=80&auto=format&fit=crop',
    match: ctx => hasAll(ctx, ['maple', 'chicken']),
  },
  {
    id: 'tofu-taco',
    imageUrl:
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=1200&q=80&auto=format&fit=crop',
    match: ctx => hasAll(ctx, ['tofu', 'tortilla']) || hasAll(ctx, ['tofu', 'taco']),
  },
  {
    id: 'sweet-potato',
    imageUrl:
      'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['sweet potato', 'sweet-potato']),
  },
  // --- Desserts ---------------------------------------------------------------
  {
    id: 'chocolate-dessert',
    imageUrl:
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['chocolate', 'brownie', 'cake', 'mousse', 'dessert']),
  },
  {
    id: 'fruit-dessert',
    imageUrl:
      'https://images.unsplash.com/photo-1464306076886-da185f6a9d05?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['raspberry', 'berry', 'fruit tart', 'fruit dessert']),
  },
  // --- Breakfast / Drinks -----------------------------------------------------
  {
    id: 'smoothie',
    imageUrl:
      'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['smoothie', 'smoothie bowl', 'protein shake']),
  },
  {
    id: 'breakfast',
    imageUrl:
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['breakfast', 'pancake', 'waffle', 'french toast']),
  },
  // --- Bowls & salads ---------------------------------------------------------
  {
    id: 'salad-green',
    imageUrl:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['salad', 'arugula', 'spring mix', 'greens']),
  },
  {
    id: 'grain-bowl',
    imageUrl:
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['bowl', 'grain bowl', 'buddha bowl', 'poke']),
  },
  // --- Pasta / Rice -----------------------------------------------------------
  {
    id: 'pasta',
    imageUrl:
      'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['pasta', 'spaghetti', 'linguine', 'penne']),
  },
  {
    id: 'fried-rice',
    imageUrl:
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['fried rice', 'stir fried rice']),
  },
  {
    id: 'ramen',
    imageUrl:
      'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['ramen', 'noodle soup', 'pho']),
  },
  // --- Proteins ---------------------------------------------------------------
  {
    id: 'salmon',
    imageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['salmon', 'fish fillet', 'sea bass']),
  },
  {
    id: 'chicken',
    imageUrl:
      'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['chicken']),
  },
  {
    id: 'beef',
    imageUrl:
      'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['beef', 'steak', 'ribeye', 'sirloin']),
  },
  {
    id: 'shrimp',
    imageUrl:
      'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['shrimp', 'prawn', 'seafood']),
  },
  {
    id: 'pork',
    imageUrl:
      'https://images.unsplash.com/photo-1604908177793-13708194e8c0?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['pork', 'ham', 'bacon', 'pulled pork']),
  },
  {
    id: 'tofu',
    imageUrl:
      'https://images.unsplash.com/photo-1574484284002-952d92456975?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['tofu', 'tempeh']),
  },
  // --- Cuisines / dishes ------------------------------------------------------
  {
    id: 'mexican',
    imageUrl:
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['taco', 'quesadilla', 'burrito', 'enchilada']),
  },
  {
    id: 'pizza',
    imageUrl:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['pizza']),
  },
  {
    id: 'burger',
    imageUrl:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['burger', 'sliders']),
  },
  {
    id: 'sandwich',
    imageUrl:
      'https://images.unsplash.com/photo-1528735602780-6152e11ab613?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['sandwich', 'wrap', 'panini', 'sub']),
  },
  {
    id: 'curry',
    imageUrl:
      'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['curry', 'masala', 'korma', 'tikka', 'indian']),
  },
  // --- Generic fallbacks ------------------------------------------------------
  {
    id: 'soup',
    imageUrl:
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['soup', 'stew', 'bisque']),
  },
  {
    id: 'stirfry',
    imageUrl:
      'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=1200&q=80&auto=format&fit=crop',
    match: ctx => includesAny(ctx, ['stir fry', 'wok', 'sauteed vegetables']),
  },
]

const FALLBACK_IMAGES = [
  DEFAULT_IMAGE,
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1574484284002-952d92456975?w=1200&q=80&auto=format&fit=crop',
]

function normalizeContext(ctx: RecipeImageContext): NormalizedContext {
  const title = ctx.title.toLowerCase()
  const description = (ctx.description || '').toLowerCase()
  const ingredients = (ctx.ingredients || []).map(ing => ing.toLowerCase())
  const tags = (ctx.tags || []).map(tag => tag.toLowerCase())
  const text = [title, description, ingredients.join(' '), tags.join(' ')].join(' ')

  return { title, description, ingredients, text }
}

function includesAny(ctx: NormalizedContext, keywords: string[]): boolean {
  return keywords.some(keyword => ctx.text.includes(keyword.toLowerCase()))
}

function hasAll(ctx: NormalizedContext, keywords: string[]): boolean {
  return keywords.every(keyword => ctx.text.includes(keyword.toLowerCase()))
}

export function findCuratedRecipeImage(ctx: RecipeImageContext): {
  imageUrl: string
  matchedRule: string
} {
  const normalized = normalizeContext(ctx)

  for (const rule of CURATED_RULES) {
    try {
      if (rule.match(normalized)) {
        return { imageUrl: rule.imageUrl, matchedRule: rule.id }
      }
    } catch {
      // ignore malformed rule
    }
  }

  // Fallback – pick a deterministic image so the UI stays consistent
  const hash = ctx.title
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
  const index = Math.abs(hash) % FALLBACK_IMAGES.length

  return { imageUrl: FALLBACK_IMAGES[index], matchedRule: 'fallback' }
}

export { DEFAULT_IMAGE }

