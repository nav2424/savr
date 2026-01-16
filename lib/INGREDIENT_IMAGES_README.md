# Ingredient Image System

## Overview
This is a **local asset system that never fails**. It uses clean, minimal gradient placeholders with category-based colors and emoji icons. The system is designed to always work, even if network requests fail or images are missing.

## Current Implementation
- **Placeholder System**: Uses `LinearGradient` components with category-based color schemes
- **Icons**: Emoji icons for each ingredient category (🥩 🐟 🥬 🥕 🍎 🌾 🥛 🧂)
- **Categories**: Automatically categorizes ingredients (protein, fish, greens, vegetable, fruit, grains, dairy, pantry)
- **Never Fails**: Always returns valid data, no network dependencies

## How It Works

### 1. Ingredient Normalization
Ingredients are normalized by:
- Converting to lowercase
- Removing special characters
- Filtering out descriptor words (organic, fresh, wild, etc.)
- Matching against a comprehensive ingredient database

### 2. Category Detection
The system uses a two-tier approach:
1. **Specific Mappings**: Exact matches for common ingredients (salmon, chicken, arugula, etc.)
2. **Keyword Fallback**: Pattern matching for unknown ingredients

### 3. Visual Rendering
The `IngredientCarousel` component renders:
- Gradient background (category-based colors)
- Large emoji icon (ingredient-specific or category default)
- Clean, minimal design matching the "plain images" aesthetic

## Adding Real Images (Future)

When you're ready to add actual ingredient photos:

### Step 1: Create Asset Folder Structure
```
assets/
  ingredients/
    salmon.png
    chicken.png
    arugula.png
    pomegranate.png
    ...
```

### Step 2: Update `IngredientImageLibrary.ts`
Replace the placeholder logic in `getIngredientImage()`:

```typescript
// Add local image imports at the top
const LOCAL_IMAGES: Record<string, any> = {
  'salmon': require('../../assets/ingredients/salmon.png'),
  'chicken': require('../../assets/ingredients/chicken.png'),
  // ... etc
}

export function getIngredientImage(name: string): IngredientImageResult {
  const normalized = normalizeIngredientName(name)
  
  // Try local image first
  if (LOCAL_IMAGES[normalized]) {
    return {
      source: LOCAL_IMAGES[normalized],
      isPlaceholder: false,
      category: getIngredientCategory(normalized)
    }
  }
  
  // Fallback to placeholder (current system)
  return {
    isPlaceholder: true,
    category: getIngredientCategory(normalized)
  }
}
```

### Step 3: Update `IngredientCarousel.tsx`
Modify the render logic to handle both local images and placeholders:

```typescript
{imageData.isPlaceholder ? (
  // Current gradient + icon system
  <LinearGradient ...>
    <Text>{icon}</Text>
  </LinearGradient>
) : (
  // Real image
  <Image source={imageData.source} ... />
)}
```

## Image Requirements
When adding real images, follow these guidelines:
- **Style**: Clean, minimal, white/light background
- **Format**: PNG with transparency or JPG with white background
- **Size**: 800x800px minimum, square aspect ratio
- **Subject**: Single ingredient, isolated, well-lit
- **Consistency**: All images should have the same aesthetic (like the "leaves" example)

## Current Ingredient Mappings
The system recognizes 50+ common ingredients with specific icons and categories. See `INGREDIENT_MAPPINGS` in `IngredientImageLibrary.ts` for the full list.

## Benefits
✅ **Never fails** - No network dependencies  
✅ **Fast** - Instant rendering, no loading states  
✅ **Consistent** - Same look for all ingredients  
✅ **Extensible** - Easy to add real images later  
✅ **Clean design** - Matches the "plain images" aesthetic  

