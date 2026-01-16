// Intelligent recipe image component with multiple image sources
import React, { useState, useEffect } from 'react'
import { Image, StyleSheet, View, Text } from 'react-native'
import { RecipeImageService } from '../lib/RecipeImageService'

interface SimpleRecipeImageProps {
  recipeTitle?: string
  recipeDescription?: string
  ingredients?: string[]
  uri?: string
  style?: any
}

// Enhanced intelligent image matcher with precise keyword prioritization
// This function uses the recipe title to find the most accurate image match
const getImageForRecipe = (title: string, description?: string): string => {
  if (!title) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'
  
  const lower = title.toLowerCase()
  const descLower = description?.toLowerCase() || ''
  const combined = `${lower} ${descLower}`
  
  // PRIORITY 0: Smoothies & Drinks (HIGHEST - check before everything else)
  if (combined.match(/smoothie.*bowl|smoothie bowl/)) {
    return 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80' // Smoothie bowl
  }
  if (combined.match(/raspberry.*smoothie|smoothie.*raspberry/)) {
    return 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&q=80' // Raspberry smoothie
  }
  if (combined.match(/parfait|yogurt.*parfait|granola.*parfait/)) {
    return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80' // Parfait
  }
  if (combined.match(/raspberry.*yogurt|yogurt.*raspberry/)) {
    return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80' // Raspberry yogurt parfait
  }
  if (combined.match(/cedar.*nut.*pomegranate|pomegranate.*cedar.*nut|cedar.*nut.*energy|energy.*bar.*cedar/)) {
    return 'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80' // Cedar nut energy bars
  }
  if (combined.match(/energy.*bar|granola.*bar|protein.*bar|nut.*bar|cedar.*nut/)) {
    return 'https://images.unsplash.com/photo-1606312619070-d48b4bc6d0e3?w=800&q=80' // Energy bars
  }
  if (lower.match(/juice|shake|milkshake|protein shake/) || descLower.match(/juice|shake|milkshake|protein shake/)) {
    return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80' // Juice/shake
  }
  
  // PRIORITY 1: Desserts & Sweets (check FIRST before other categories)
  if (lower.match(/brownie|fudge|chocolate.*cake|chocolate.*chip|cookie|cupcake|muffin|donut|doughnut/) || 
      descLower.match(/brownie|fudge|chocolate.*cake|chocolate.*chip|cookie|cupcake|muffin|donut|doughnut/)) {
    return 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=800&q=80' // Chocolate desserts
  }
  if (lower.match(/cake|dessert|sweet|pastry|pie|tart|cheesecake/) || 
      descLower.match(/cake|dessert|sweet|pastry|pie|tart|cheesecake/)) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80' // Cakes/desserts
  }
  
  // PRIORITY 2: Specific Dishes (before general categories)
  if (lower.match(/curry/) || descLower.match(/curry/)) {
    return 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80' // Curry
  }
  if (lower.match(/pizza/) || descLower.match(/pizza/)) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80' // Pizza
  }
  if (lower.match(/burger/) || descLower.match(/burger/)) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80' // Burger
  }
  if (lower.match(/taco|burrito|quesadilla/) || descLower.match(/taco|burrito|quesadilla/)) {
    return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80' // Tacos
  }
  if (lower.match(/sushi|roll/) || descLower.match(/sushi|roll/)) {
    return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80' // Sushi
  }
  if (lower.match(/ramen|noodle.*soup/) || descLower.match(/ramen|noodle.*soup/)) {
    return 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=800&q=80' // Ramen
  }
  
  // PRIORITY 2.5: More Specific Dishes
  if (lower.match(/lasagna/)) {
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Lasagna
  }
  if (lower.match(/risotto/)) {
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Risotto
  }
  if (lower.match(/paella/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Paella
  }
  if (lower.match(/pad thai/)) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Pad Thai
  }
  if (lower.match(/fried rice/)) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Fried Rice
  }
  if (lower.match(/chicken.*wings/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Chicken Wings
  }
  if (lower.match(/fish.*and.*chips/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Fish and Chips
  }
  
  // PRIORITY 3: Main Categories
  if (lower.match(/pasta|spaghetti|linguine|fettuccine|penne/)) {
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&q=80' // Pasta
  }
  if (lower.match(/stir.*fry|stir fry/)) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Stir-fry
  }
  if (lower.match(/soup|stew|chowder|bisque/)) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80' // Soup
  }
  // Specific salad types - check exact matches first
  if (combined.match(/sweet.*potato.*arugula|arugula.*sweet.*potato/)) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80' // Sweet potato and arugula salad
  }
  if (combined.match(/arugula.*salad|salad.*arugula/)) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80' // Arugula salad
  }
  if (combined.match(/spring.*mix|mixed.*greens.*salad|marinated.*chicken.*spring.*mix/)) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80' // Spring mix salad
  }
  if (combined.match(/sweet.*potato.*salad/)) {
    return 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80' // Sweet potato salad
  }
  if (combined.match(/salad/) && !combined.match(/chicken|beef|tuna|egg/)) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80' // Green salad
  }
  if (lower.match(/sandwich|sub|hoagie|wrap/)) {
    return 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800&q=80' // Sandwich
  }
  if (lower.match(/bowl/) && lower.match(/rice|grain|buddha|poke/)) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80' // Bowl
  }
  
  // PRIORITY 4: Proteins (more specific matching)
  if (lower.match(/chicken.*breast|grilled.*chicken|baked.*chicken/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Chicken breast
  }
  if (lower.match(/chicken.*thigh|chicken.*leg|drumstick/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Chicken thighs/legs
  }
  if (combined.match(/souvlaki.*chicken|chicken.*souvlaki/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Souvlaki chicken
  }
  if (combined.match(/marinated.*chicken|chicken.*marinated/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Marinated chicken
  }
  if (combined.match(/chicken/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // General chicken
  }
  if (combined.match(/maple.*glazed.*salmon|glazed.*salmon.*raspberry|salmon.*raspberry.*coulis/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Maple-glazed salmon with raspberry
  }
  if (combined.match(/maple.*glazed.*salmon|glazed.*salmon|salmon.*glaze/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Glazed salmon
  }
  if (combined.match(/salmon.*fillet|grilled.*salmon|baked.*salmon/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // Salmon fillet
  }
  if (combined.match(/salmon|fish/)) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80' // General fish
  }
  if (lower.match(/beef.*steak|grilled.*beef|ribeye|sirloin/)) {
    return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80' // Beef steak
  }
  if (lower.match(/beef.*stew|beef.*roast|pot.*roast/)) {
    return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80' // Beef stew/roast
  }
  if (lower.match(/beef|steak/)) {
    return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80' // General beef
  }
  if (lower.match(/pork.*chop|pork.*tenderloin|pork.*roast/)) {
    return 'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80' // Pork chops
  }
  if (lower.match(/bacon/)) {
    return 'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80' // Bacon
  }
  if (lower.match(/pork/)) {
    return 'https://images.unsplash.com/photo-1602473812169-4af20e5a7a58?w=800&q=80' // General pork
  }
  if (lower.match(/shrimp.*scampi|garlic.*shrimp|shrimp.*pasta/)) {
    return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80' // Shrimp dishes
  }
  if (lower.match(/shrimp|prawn|seafood/)) {
    return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80' // General seafood
  }
  
  // PRIORITY 5: Meal Types
  if (combined.match(/sweet.*potato.*shallot.*frittata|frittata.*sweet.*potato/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Sweet potato frittata
  }
  if (combined.match(/frittata/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Frittata
  }
  if (combined.match(/egg.*sweet.*potato.*hash|sweet.*potato.*hash.*egg/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Egg and sweet potato hash
  }
  if (combined.match(/hash/) && combined.match(/egg|sweet.*potato|potato/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Hash
  }
  if (combined.match(/egg.*shallot.*scramble|shallot.*scramble.*egg/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Egg and shallot scramble
  }
  if (combined.match(/scramble/) && combined.match(/egg/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Scrambled eggs
  }
  if (lower.match(/breakfast/) || lower.match(/pancake|waffle|french toast|omelette|omelet/)) {
    return 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80' // Breakfast
  }
  if (lower.match(/toast/) && lower.match(/avocado/)) {
    return 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800&q=80' // Avocado toast
  }
  
  // PRIORITY 6: Cooking Methods (for more variety)
  if (lower.match(/sautéed|sauteed/)) {
    return 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80' // Sautéed dishes
  }
  if (lower.match(/roasted/)) {
    return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80' // Roasted dishes
  }
  if (lower.match(/grilled/)) {
    return 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80' // Grilled dishes
  }
  if (lower.match(/braised/)) {
    return 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80' // Braised dishes
  }
  if (lower.match(/steamed/)) {
    return 'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80' // Steamed dishes
  }
  if (lower.match(/stir.fried|stir-fried/)) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80' // Stir-fried dishes
  }
  if (lower.match(/baked/)) {
    return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80' // Baked dishes
  }
  if (lower.match(/pan.seared/)) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80' // Pan-seared dishes
  }
  
  // PRIORITY 7: Vegetables (ONLY if no other match and specifically vegetarian)
  if (lower.match(/vegetable|veggie|vegetarian/) && !lower.match(/curry|stir/)) {
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80' // Vegetables
  }
  
  // PRIORITY 8: Diverse default images based on recipe hash for variety
  const recipeHash = title.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // Food platter
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Cooking
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80', // Roasted
    'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80', // Grilled
    'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Braised
    'https://images.unsplash.com/photo-1563379091339-03246963d4d1?w=800&q=80', // Steamed
    'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80', // Asian
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80'  // Mexican
  ]
  
  return defaultImages[Math.abs(recipeHash) % defaultImages.length]
}

/**
 * Generate AI image for recipe using various services
 */
async function generateAIRecipeImage(title: string, description?: string): Promise<string | null> {
  try {
    // Option 1: Use OpenAI DALL-E API
    const prompt = `A beautiful, appetizing photo of ${title}. ${description ? `The dish should look like: ${description}` : ''} Professional food photography, high quality, appetizing, well-lit, restaurant style.`
    
    // For now, return null to use fallback (you can implement actual API calls)
    console.log('🎨 Would generate AI image for:', title, 'with prompt:', prompt)
    return null
    
    // Uncomment below to use actual OpenAI API:
    /*
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    })
    
    const data = await response.json()
    return data.data[0].url
    */
  } catch (error) {
    console.error('❌ Error generating AI image:', error)
    return null
  }
}

export default function SimpleRecipeImage({ recipeTitle, recipeDescription, ingredients, uri, style }: SimpleRecipeImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  
  // Get image using the new service
  // CRITICAL: Always generate fresh images - ignore stored URIs from database
  // This ensures each recipe gets an accurate, unique image based on its current content
  useEffect(() => {
    if (!recipeTitle) {
      setImageUrl(uri || null)
      setLoading(false)
      return
    }

    setLoading(true)
    setImageError(false)
    setRetryCount(0)

    const svc = RecipeImageService.getInstance()

    const ingredientNames =
      (ingredients || [])
        .map(ing => (typeof ing === 'string' ? ing : (ing as any)?.name || ''))
        .filter(Boolean)

    const cacheKey = svc.buildDeterministicKey(
      recipeTitle,
      recipeDescription || '',
      ingredientNames
    )

    // Use Unsplash API for accurate image search based on recipe details
    svc.getRecipeImage(
      recipeTitle,
      recipeDescription,
      ingredientNames,
      { service: 'unsplash', fallbackToStock: true, preferLocal: false },
      cacheKey
    ).then(url => {
      if (url) {
        setImageUrl(url)
        setLoading(false)
        setImageError(false)
      } else {
        // Final fallback to intelligent matching
        const fallbackUrl = getImageForRecipe(recipeTitle, recipeDescription)
        setImageUrl(fallbackUrl)
        setLoading(false)
        setImageError(false)
      }
    }).catch((error) => {
      console.warn(`⚠️ Image service failed for "${recipeTitle}", using intelligent fallback:`, error)
      // Use intelligent fallback function that always returns a valid URL
      const fallbackUrl = getImageForRecipe(recipeTitle, recipeDescription)
      setImageUrl(fallbackUrl)
      setLoading(false)
      setImageError(false) // Don't mark as error since we have a valid fallback
    })
  }, [recipeTitle, recipeDescription, JSON.stringify(ingredients)])
  
  if (loading) {
    return (
      <View style={[styles.image, styles.fallbackContainer, style]}>
        <Text style={styles.fallbackText}>⏳</Text>
        {recipeTitle && <Text style={styles.fallbackLabel}>Loading image...</Text>}
      </View>
    )
  }

  if (imageError || !imageUrl) {
    return (
      <View style={[styles.image, styles.fallbackContainer, style]}>
        <Text style={styles.fallbackText}>🍽️</Text>
        {recipeTitle && <Text style={styles.fallbackLabel}>{recipeTitle}</Text>}
      </View>
    )
  }
  
  return (
    <Image
      source={{ uri: imageUrl || undefined }}
      style={[styles.image, style]}
      resizeMode="cover"
      onError={(error) => {
        console.log(`⚠️ Image failed for "${recipeTitle || 'unknown'}"`, error.nativeEvent.error)
        // Retry with fallback if we haven't already
        if (retryCount < 1 && imageUrl && recipeTitle) {
          console.log(`🔄 Retrying with fallback image for "${recipeTitle}"`)
          const fallbackUrl = getImageForRecipe(recipeTitle, recipeDescription)
          setImageUrl(fallbackUrl)
          setRetryCount(prev => prev + 1)
          setImageError(false) // Don't show error yet, try fallback first
        } else {
          // If fallback also failed, show placeholder
          console.log(`❌ All image attempts failed for "${recipeTitle || 'unknown'}", showing placeholder`)
          setImageError(true)
        }
      }}
      onLoad={() => {
        console.log(`✅ Image loaded successfully for "${recipeTitle}"`)
        setImageError(false)
        setRetryCount(0) // Reset retry count on successful load
      }}
    />
  )
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  fallbackText: {
    fontSize: 32,
    marginBottom: 8,
  },
  fallbackLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
})
