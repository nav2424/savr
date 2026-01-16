// SAVR AI Scanning Service - Receipt & Item Recognition with OpenAI Vision
import config from '../config'
import { formatPantryItem, normalizeCategory, getItemEmoji } from './PantryItemFormatter'
import { findProductPackInfo, isWarehouseStore } from './ProductKnowledgeDatabase'

export interface ScannedItem {
  name: string
  emoji: string  // Specific emoji for this item
  quantity: number
  unit: string
  category: string
  location: 'fridge' | 'freezer' | 'pantry'
  price?: number
  store?: string
  expiry_date?: string  // Optional expiry date (can be auto-predicted)
  originalQuantity?: number  // Original quantity from receipt before bulk adjustment
  bulkPackApplied?: boolean  // Whether bulk pack intelligence was applied
}

export interface ScanResult {
  items: ScannedItem[]
  totalItems: number
  store?: string
  date?: string
  receiptTotal?: number  // The actual total from the receipt
  calculatedTotal?: number  // Sum of all item prices
  validationPassed?: boolean  // Whether totals match
  rawText?: string
}

// Utility function to capitalize category names properly
export function capitalizeCategoryName(category: string): string {
  if (!category) return category
  
  // Handle special cases with & or multiple words
  const specialCases: { [key: string]: string } = {
    'produce': 'Produce',
    'fruits & vegetables': 'Produce',
    'meat & seafood': 'Meat, Poultry & Seafood',
    'meat, poultry & seafood': 'Meat, Poultry & Seafood',
    'dairy & eggs': 'Dairy & Eggs',
    'grains, bread & pasta': 'Grains, Bread & Pasta',
    'grains & bread': 'Grains, Bread & Pasta',
    'condiments, sauces & spreads': 'Condiments, Sauces & Spreads',
    'condiments & sauces': 'Condiments, Sauces & Spreads',
    'condiments': 'Condiments, Sauces & Spreads',
    'pantry staples & essentials': 'Pantry Staples & Essentials',
    'pantry staples': 'Pantry Staples & Essentials',
    'plant-based proteins & legumes': 'Plant-Based Proteins & Legumes',
    'plant based proteins & legumes': 'Plant-Based Proteins & Legumes',
    'snacks, sweets & desserts': 'Snacks, Sweets & Desserts',
    'snacks & sweets': 'Snacks, Sweets & Desserts',
    'beverages': 'Beverages',
    'non-food / misc': 'Non-Food / Misc',
    'non food / misc': 'Non-Food / Misc'
  }
  
  const lowerCategory = category.toLowerCase()
  if (specialCases[lowerCategory]) {
    return specialCases[lowerCategory]
  }
  
  // Capitalize first letter of each word
  return category
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

class ScanningService {
  private applyBulkPackIntelligence(items: ScannedItem[], store?: string): ScannedItem[] {
    return items.map(item => {
      if (!isWarehouseStore(store)) {
        return item
      }

      const packInfo = findProductPackInfo(item.name, store)
      
      if (packInfo && item.quantity <= 3) {
        // IMPORTANT: Preserve the original price - it's the total for the receipt line
        // We're adjusting quantity for inventory accuracy, but price stays the same
        return {
          ...item,
          originalQuantity: item.quantity,
          quantity: item.quantity * packInfo.packQuantity,
          unit: packInfo.unit,
          bulkPackApplied: true,
          price: item.price // Explicitly preserve original price
        }
      }
      
      return item
    })
  }

  // Expand abbreviated item names to full English names
  private expandItemName(name: string): string {
    let expanded = name.trim()
    
    // French abbreviation expansions to English
    expanded = expanded
      .replace(/^dian\s+/i, 'Diana ')
      .replace(/^phil\s+/i, 'Philadelphia ')
      .replace(/^clas\s+/i, 'Classico ')
      .replace(/\ssce\s/gi, ' Sauce ')
      .replace(/\ssce$/i, ' Sauce')
      .replace(/\scrm\s/gi, ' Cream ')
      .replace(/\sreg\s/gi, ' Regular ')
      .replace(/\sbriq\s?$/i, ' Brick')
      .replace(/\smiel\s/gi, ' Honey ')
      .replace(/\sail\s?$/i, ' Garlic')
      .replace(/\sbasilic\s?$/i, ' Basil')
      .replace(/\smari\s?$/i, ' Marinara')
      .replace(/^sce\s+di\s+/i, '')
      .replace(/cereales\s+/i, 'Cereals ')
      .replace(/\snature\s+bio/gi, 'Nature Bio')
      .replace(/tom\s/gi, 'Tomato ')
      .replace(/di\s+campania/gi, 'Campania')
    
    // Capitalize properly (title case)
    expanded = expanded
      .split(' ')
      .map(word => {
        if (word.length === 0) return word
        // Keep brand names capitalized
        if (['Diana', 'Philadelphia', 'Classico', 'Campania', 'Nature', 'Bio'].includes(word)) {
          return word
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
      .trim()
    
    return expanded
  }

  // Normalize item name for duplicate detection (handles bilingual receipts)
  private normalizeItemName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]/g, '') // remove all non-alphanumeric
      .trim()
  }

  // Check if two items are similar (for duplicate detection)
  private areItemsSimilar(name1: string, name2: string): boolean {
    const norm1 = this.normalizeItemName(name1)
    const norm2 = this.normalizeItemName(name2)
    
    // If normalized names are identical, they're the same
    if (norm1 === norm2) return true
    
    // Extract brand names (first word or two) - be more specific
    const getBrand = (name: string) => {
      const nameLower = name.toLowerCase()
      // Check for known brands first
      if (nameLower.includes('diana') || nameLower.includes('dian')) return 'diana'
      if (nameLower.includes('campania') || nameLower.includes('scedicampania')) return 'campania'
      if (nameLower.includes('classico') || nameLower.includes('clas')) return 'classico'
      if (nameLower.includes('philadelphia') || nameLower.includes('phil')) return 'philadelphia'
      if (nameLower.includes('nature') || nameLower.includes('cereales')) return 'nature'
      
      // Fallback to first word
      const words = nameLower.split(/\s+/)
      return words[0] || ''
    }
    
    const brand1 = getBrand(name1)
    const brand2 = getBrand(name2)
    
    // CRITICAL: Items must have the SAME brand to be considered similar
    // This prevents "Diana Sauce" from matching "Campania Sauce"
    if (brand1 && brand2 && brand1 !== brand2) {
      // Different brands - can't be the same item
      return false
    }
    
    if (brand1 && brand2 && brand1 === brand2) {
      // Remove brand from both and check remaining similarity
      const rest1 = norm1.replace(brand1, '')
      const rest2 = norm2.replace(brand2, '')
      
      // If remaining parts share significant characters, they're the same
      if (rest1.length > 3 && rest2.length > 3) {
        const shared = rest1.split('').filter(c => rest2.includes(c)).length
        if (shared >= Math.min(rest1.length, rest2.length) * 0.4) {
          return true
        }
      }
    }
    
    // Check if one contains the other (handles abbreviations)
    // BUT ONLY if they have the same brand - this prevents cross-brand matches
    
    if (norm1.length > 5 && norm2.length > 5 && brand1 === brand2) {
      const longer = norm1.length > norm2.length ? norm1 : norm2
      const shorter = norm1.length > norm2.length ? norm2 : norm1
      if (longer.includes(shorter) && shorter.length >= longer.length * 0.6) {
        return true
      }
    }
    
    // Check for common bilingual patterns (using original names for better matching)
    const name1Lower = name1.toLowerCase()
    const name2Lower = name2.toLowerCase()
    
    const bilingualPatterns = [
      { en: 'honey', fr: 'miel' },
      { en: 'garlic', fr: 'ail' },
      { en: 'basil', fr: 'basilic' },
      { en: 'tomato', fr: 'tomate' },
      { en: 'sauce', fr: 'sce' },
      { en: 'cream', fr: 'crm' },
      { en: 'cheese', fr: 'fromage' },
      { en: 'diana', fr: 'dian' },
      { en: 'campania', fr: 'campania' },
      { en: 'classico', fr: 'clas' },
      { en: 'philadelphia', fr: 'phil' },
      { en: 'marinara', fr: 'mari' },
      { en: 'cereals', fr: 'cereales' },
      { en: 'nature', fr: 'nature' },
      { en: 'brick', fr: 'briq' },
      { en: 'regular', fr: 'reg' },
    ]
    
    // Also check for common brand name patterns
    const brandPatterns = [
      { full: 'dianasauce', abbrev: 'diansauce' },
      { full: 'campaniamarinara', abbrev: 'scedicampaniamari' },
      { full: 'classicotomatobasil', abbrev: 'classcetombasilic' },
      { full: 'philadelphiacreamcheese', abbrev: 'philfrcrmregbriq' },
    ]
    
    // Check brand patterns
    for (const brand of brandPatterns) {
      const hasFull1 = norm1.includes(brand.full) || name1Lower.includes(brand.full)
      const hasAbbrev1 = norm1.includes(brand.abbrev) || name1Lower.includes(brand.abbrev)
      const hasFull2 = norm2.includes(brand.full) || name2Lower.includes(brand.full)
      const hasAbbrev2 = norm2.includes(brand.abbrev) || name2Lower.includes(brand.abbrev)
      
      if ((hasFull1 && hasAbbrev2) || (hasAbbrev1 && hasFull2)) {
        return true
      }
    }
    
    // Count how many bilingual pattern matches we have
    // CRITICAL: Only match if they have the SAME brand
    // (brand1 and brand2 are already defined above)
    
    // If brands don't match, they can't be the same item
    if (brand1 !== brand2) {
      return false
    }
    
    let patternMatches = 0
    let hasAnyPattern = false
    
    for (const pattern of bilingualPatterns) {
      const hasEn1 = name1Lower.includes(pattern.en)
      const hasFr1 = name1Lower.includes(pattern.fr)
      const hasEn2 = name2Lower.includes(pattern.en)
      const hasFr2 = name2Lower.includes(pattern.fr)
      
      // If one has English and other has French of same word
      if ((hasEn1 && hasFr2) || (hasFr1 && hasEn2)) {
        hasAnyPattern = true
        patternMatches++
        
        // Remove the pattern words and check if remaining parts are similar
        const rest1 = norm1.replace(new RegExp(pattern.en, 'gi'), '').replace(new RegExp(pattern.fr, 'gi'), '')
        const rest2 = norm2.replace(new RegExp(pattern.en, 'gi'), '').replace(new RegExp(pattern.fr, 'gi'), '')
        
        // If remaining parts are similar (one contains the other), they're the same item
        if (rest1.length > 3 && rest2.length > 3) {
          const longerRest = rest1.length > rest2.length ? rest1 : rest2
          const shorterRest = rest1.length > rest2.length ? rest2 : rest1
          if (longerRest.includes(shorterRest) && shorterRest.length >= longerRest.length * 0.5) {
            return true
          }
        } else if (rest1.length <= 3 && rest2.length <= 3) {
          // If both have very short remaining parts, they're likely the same
          return true
        }
      }
    }
    
    // If we have multiple pattern matches AND same brand, they're definitely the same item
    if (patternMatches >= 2) {
      return true
    }
    
    // If we have at least one pattern match and the normalized names share significant characters
    if (hasAnyPattern) {
      // Check if they share at least 50% of characters
      const minLen = Math.min(norm1.length, norm2.length)
      if (minLen > 5) {
        let sharedChars = 0
        const chars1 = new Set(norm1.split(''))
        const chars2 = new Set(norm2.split(''))
        for (const char of chars1) {
          if (chars2.has(char)) sharedChars++
        }
        if (sharedChars / Math.max(chars1.size, chars2.size) >= 0.5) {
          return true
        }
      }
    }
    
    // Calculate similarity score using Levenshtein-like approach
    // If names are very similar (80%+ character overlap), they're likely the same
    const minLen = Math.min(norm1.length, norm2.length)
    const maxLen = Math.max(norm1.length, norm2.length)
    if (minLen > 10) {
      let matches = 0
      for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
        if (norm1[i] === norm2[i]) matches++
      }
      if (matches / maxLen >= 0.7) {
        return true
      }
    }
    
    return false
  }

  // Filter out non-item lines (discounts, totals, etc.)
  private isNonItemLine(name: string): boolean {
    const normalized = this.normalizeItemName(name)
    const nameLower = name.toLowerCase()
    
    return (
      normalized.includes('rabais') ||
      normalized.includes('points') ||
      normalized.includes('soustotal') ||
      normalized === 'total' ||
      normalized.includes('taxe') ||
      normalized.includes('media') ||
      normalized.includes('monnaie') ||
      normalized.includes('nombredarticles') ||
      nameLower.includes('discount') ||
      nameLower.includes('coupon') ||
      nameLower.includes('savings') ||
      nameLower.includes('rebate') ||
      nameLower.includes('promotion') ||
      nameLower.includes('subtotal') ||
      nameLower.includes('tax') ||
      nameLower.includes('points obtained') ||
      nameLower.includes('points obtenus')
    )
  }

  // Aggregate receipt items by quantity (for receipts, repeated items = quantity, not duplicates)
  private aggregateReceiptItems(items: ScannedItem[]): ScannedItem[] {
    // First, filter out non-item lines
    const validItems = items.filter(item => !this.isNonItemLine(item.name))
    
    console.log(`🔍 Aggregating ${validItems.length} items (filtered from ${items.length})...`)
    
    const map = new Map<string, ScannedItem>()
    
    for (const item of validItems) {
      const normalizedName = this.normalizeItemName(item.name)
      const price = item.price || 0
      
      // For weight-based items (kg, lb, etc.), price is already the LINE TOTAL
      // For count-based items, price is UNIT PRICE
      const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
      
      // Key: normalized name + unit price (exact match only - no fuzzy matching for receipts)
      // But also check for similar names with same price (handles "Large Eggs" vs "Eggs")
      let key = `${normalizedName}|${price.toFixed(2)}`
      let existing = map.get(key)
      
      // If not found, try to find similar item (for duplicates like "Large Eggs" vs "Eggs", "Hass Avocado" vs "Avocado Hass")
      // For weight-based items, also check if weights are very similar (likely same item from different passes)
      if (!existing) {
        for (const [existingKey, existingItem] of map.entries()) {
          const existingNormalized = this.normalizeItemName(existingItem.name)
          const existingPrice = existingItem.price || 0
          const existingQuantity = existingItem.quantity || 1
          
          // Extract core words (remove common prefixes/suffixes and numbers)
          // Also remove common descriptive words for better matching
          const commonWords = new Set(['large', 'white', 'hass', 'yellow', 'red', 'green', 'orange', 'small', 'medium'])
          const coreWords1 = normalizedName.split(/\s+/).filter(w => w.length > 2 && !/^\d+/.test(w) && !commonWords.has(w))
          const coreWords2 = existingNormalized.split(/\s+/).filter(w => w.length > 2 && !/^\d+/.test(w) && !commonWords.has(w))
          
          // Calculate similarity based on core words
          let similarity = 0
          if (coreWords1.length > 0 && coreWords2.length > 0) {
            const sharedWords = coreWords1.filter(w => coreWords2.includes(w))
            similarity = sharedWords.length / Math.max(coreWords1.length, coreWords2.length)
          }
          
          // Also check all words (including common ones) for better matching
          const allWords1 = normalizedName.split(/\s+/).filter(w => w.length > 2)
          const allWords2 = existingNormalized.split(/\s+/).filter(w => w.length > 2)
          const sharedAll = allWords1.filter(w => allWords2.includes(w))
          if (sharedAll.length > 0) {
            const allSimilarity = sharedAll.length / Math.max(allWords1.length, allWords2.length)
            // Use the higher similarity score
            similarity = Math.max(similarity, allSimilarity)
          }
          
          // Special case: if they share a key word (like "eggs", "avocado", "onions"), boost similarity
          const keyWords = ['eggs', 'egg', 'avocado', 'onions', 'onion', 'pepper', 'peppers', 'banana', 'bananas', 'potato', 'potatoes', 'asparagus']
          const hasKeyWord = keyWords.some(kw => normalizedName.includes(kw) && existingNormalized.includes(kw))
          if (hasKeyWord && similarity >= 0.4) {
            // If they share a key word and have at least 40% similarity, boost to 70%+
            similarity = Math.max(similarity, 0.7)
          }
          
          if (similarity >= 0.6) {
            // Names are similar - check if they're the same item
            if (isWeightBased && existingItem.unit === item.unit) {
              // For weight items, if weights are very similar (within 10%), they're duplicates from different passes
              const weightDiff = Math.abs((existingQuantity || 0) - (item.quantity || 0))
              const avgWeight = ((existingQuantity || 0) + (item.quantity || 0)) / 2
              if (avgWeight > 0 && weightDiff / avgWeight < 0.1) {
                // Same weight item from different passes - keep the one with price closer to receipt average
                key = existingKey
                existing = existingItem
                console.log(`  🔗 Matched duplicate weight item: "${item.name}" ≈ "${existingItem.name}" (same weight)`)
                break
              }
            } else if (!isWeightBased) {
              // For count items, if names are very similar (>= 70% similarity), they're likely duplicates
              // Be more aggressive - if core words match, merge them (price differences are often OCR errors)
              if (similarity >= 0.7) {
                // Very similar names - definitely the same item, merge them
                key = existingKey
                existing = existingItem
                console.log(`  🔗 Matched duplicate count item (high similarity): "${item.name}" ≈ "${existingItem.name}"`)
                break
              } else if (similarity >= 0.6) {
                // Moderately similar - check if prices are close or quantities match
                const priceDiff = Math.abs(existingPrice - price)
                const avgPrice = (existingPrice + price) / 2
                if (avgPrice > 0 && (priceDiff / avgPrice < 0.3 || Math.abs(existingQuantity - (item.quantity || 1)) < 2)) {
                  key = existingKey
                  existing = existingItem
                  console.log(`  🔗 Matched duplicate count item: "${item.name}" ≈ "${existingItem.name}"`)
                  break
                }
              }
            }
          }
        }
      }
      
      if (existing) {
        // Same item with same price = increase quantity
        // For weight-based items, we need to add the weights, not multiply
        if (isWeightBased && existing.unit === item.unit) {
          // For weight items, check if weights are very similar (likely duplicate from different passes)
          const weightDiff = Math.abs((existing.quantity || 0) - (item.quantity || 0))
          const avgWeight = ((existing.quantity || 0) + (item.quantity || 0)) / 2
          
          if (avgWeight > 0 && weightDiff / avgWeight < 0.1) {
            // Same weight item from different passes - keep the first one, don't add weights
            console.log(`  ⚠️ Duplicate weight item (different pass): "${item.name}" - keeping first occurrence`)
          } else {
            // Different weights - actually bought multiple times, add weights
            existing.quantity = (existing.quantity || 0) + (item.quantity || 0)
            // Use the higher price (more likely to be correct)
            if (price > existing.price) {
              existing.price = price
            }
            console.log(`  ➕ Aggregated weight: "${item.name}" → qty ${existing.quantity} ${existing.unit}`)
          }
        } else if (!isWeightBased) {
          // For count items, check if they're duplicates from different passes
          // If names matched via similarity (not exact), they're likely duplicates from different passes
          const wasMatchedBySimilarity = normalizedName !== this.normalizeItemName(existing.name)
          const priceDiff = Math.abs(existing.price - price)
          const quantityDiff = Math.abs((existing.quantity || 1) - (item.quantity || 1))
          
          if (wasMatchedBySimilarity) {
            // Matched by similarity - likely duplicate from different passes
            // Use the price/quantity that makes more sense
            const existingUnitPrice = existing.price / (existing.quantity || 1)
            const itemUnitPrice = price / (item.quantity || 1)
            
            // If prices are very different, one is likely wrong - use the one with more reasonable unit price
            if (priceDiff > 0.5) {
              // Prices are significantly different - determine which is more reasonable
              // Reasonable unit price for groceries is typically $1-15
              const existingIsReasonable = existingUnitPrice >= 0.5 && existingUnitPrice <= 15
              const itemIsReasonable = itemUnitPrice >= 0.5 && itemUnitPrice <= 15
              
              if (itemIsReasonable && !existingIsReasonable) {
                // Item has reasonable price, existing doesn't - replace
                existing.price = price
                existing.quantity = item.quantity || 1
                console.log(`  🔄 Updated duplicate item with better price: "${item.name}" → price $${price}, qty ${item.quantity || 1}`)
              } else if (existingIsReasonable && !itemIsReasonable) {
                // Existing has reasonable price, item doesn't - keep existing
                console.log(`  ⚠️ Duplicate count item (unreasonable price): "${item.name}" - keeping first occurrence`)
              } else if (Math.abs(existingUnitPrice - itemUnitPrice) / Math.max(existingUnitPrice, itemUnitPrice) > 0.5) {
                // Unit prices are very different - keep the lower one (more likely to be unit price, not line total)
                if (itemUnitPrice < existingUnitPrice) {
                  existing.price = price
                  existing.quantity = item.quantity || 1
                  console.log(`  🔄 Updated duplicate item with lower unit price: "${item.name}" → price $${price}, qty ${item.quantity || 1}`)
                } else {
                  console.log(`  ⚠️ Duplicate count item (higher unit price): "${item.name}" - keeping first occurrence`)
                }
              } else {
                // Both reasonable, keep first
                console.log(`  ⚠️ Duplicate count item (both reasonable): "${item.name}" - keeping first occurrence`)
              }
            } else if (priceDiff < 0.01 && quantityDiff < 2) {
              // Same price, similar quantity - likely duplicate, don't aggregate
              console.log(`  ⚠️ Duplicate count item (same price/qty): "${item.name}" - keeping first occurrence`)
            } else {
              // Different prices but close - might be same item with OCR error, keep first
              console.log(`  ⚠️ Duplicate count item (similar price): "${item.name}" - keeping first occurrence`)
            }
          } else {
            // Exact match - same item, add quantities (actually bought multiple times)
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1)
            console.log(`  ➕ Aggregated count: "${item.name}" → qty ${existing.quantity}`)
          }
        }
      } else {
        // New item - add to map
        // For weight-based items, price is already the line total, so we don't need to multiply
        map.set(key, {
          ...item,
          quantity: item.quantity || 1
        })
      }
    }
    
    const aggregated = Array.from(map.values())
    console.log(`✅ Aggregated: ${validItems.length} → ${aggregated.length} unique items`)
    
    return aggregated
  }

  // Deduplicate items (handles bilingual receipts and similar items) - ONLY for non-receipt scans
  private deduplicateItems(items: ScannedItem[]): ScannedItem[] {
    // For receipts, use aggregation instead
    return this.aggregateReceiptItems(items)
  }

  // Scan receipt using OpenAI Vision API with validation and double-checking
  async scanReceipt(imageBase64: string): Promise<ScanResult> {
    try {
      const apiKey = config.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      // First pass: Extract all items and receipt metadata
      const firstPassResult = await this.performReceiptScan(imageBase64, 'first')
      
      // Second pass: Verification - check for missed items and validate totals
      const verifiedResult = await this.verifyReceiptScan(imageBase64, firstPassResult)
      
      return verifiedResult

    } catch (error) {
      console.error('Error scanning receipt:', error)
      throw error
    }
  }

  // Perform aggressive receipt scan with custom prompt for mismatched totals
  private async performAggressiveReceiptScan(
    imageBase64: string, 
    customSystemPrompt: string,
    expectedTotal: number,
    currentTotal: number
  ): Promise<ScanResult> {
    try {
      const apiKey = config.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY
      
      const userPrompt = `The receipt total is $${expectedTotal.toFixed(2)} but only $${currentTotal.toFixed(2)} was found. You MUST find the missing items or correct the prices. Extract ALL items with correct prices.`
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: customSystemPrompt + `

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "receiptTotal": ${expectedTotal.toFixed(2)},
  "items": [
    {
      "name": "Full Product Name",
      "emoji": "🍅",
      "quantity": 1,
      "unit": "pieces",
      "category": "Category",
      "location": "pantry",
      "price": 4.99
    }
  ]
}

CRITICAL: The sum of all item prices must equal approximately $${expectedTotal.toFixed(2)}.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'
      
      // Parse JSON response
      let parsed = content.trim()
      if (parsed.startsWith('```')) {
        parsed = parsed.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      }
      
      const result = JSON.parse(parsed)
      
      // Process items same as regular scan
      const processedItems = (result.items || []).map((item: any) => {
        if (!item.name || typeof item.name !== 'string') {
          return null
        }
        
        // Expand abbreviated names to full English names
        let expandedName = this.expandItemName(item.name.trim())
        
        const normalizedCategory = normalizeCategory(item.category || 'Other')
        const properEmoji = getItemEmoji(expandedName, normalizedCategory)
        
        let price = item.price
        if (price !== undefined && price !== null) {
          price = typeof price === 'number' ? price : parseFloat(price)
          if (isNaN(price) || price < 0) {
            price = undefined
          }
        }
        
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 
          ? item.quantity 
          : 1
        
        return {
          name: expandedName,
          emoji: properEmoji,
          quantity,
          unit: item.unit || 'pieces',
          category: normalizedCategory,
          location: item.location || 'pantry',
          price,
          store: item.store,
        }
      }).filter((item): item is ScannedItem => item !== null)
      
      const bulkAdjustedItems = this.applyBulkPackIntelligence(processedItems, result.store)
      
      // Aggregate items by quantity (for receipts, repeated items = quantity, not duplicates)
      const aggregatedItems = this.aggregateReceiptItems(bulkAdjustedItems)
      
      return {
        items: aggregatedItems,
        totalItems: aggregatedItems.length,
        store: result.store,
        date: result.date,
        receiptTotal: result.receiptTotal,
        rawText: content,
      }
    } catch (error) {
      console.error('Error in aggressive receipt scan:', error)
      return {
        items: [],
        totalItems: 0,
        store: 'Unknown',
        date: new Date().toISOString().split('T')[0],
        rawText: '',
      }
    }
  }

  // Perform the actual receipt scan
  private async performReceiptScan(imageBase64: string, pass: 'first' | 'verification'): Promise<ScanResult> {
    try {
      const apiKey = config.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY
      
      const isVerification = pass === 'verification'
      const systemPrompt = isVerification 
      ? `You are verifying a receipt scan. Check if ANY items were missed. Look for:
- Items in small print
- Items at the top or bottom edges
- Items that might have been skipped
- Any line items that represent products

Return ONLY the items that were MISSED in the previous scan. If no items were missed, return empty items array.`
      : `You are an EXPERT grocery receipt analyzer with deep knowledge of retail abbreviations, store brands, and product naming conventions. 

🚨 CRITICAL: You MUST extract EVERY SINGLE ITEM on the receipt. Missing items is UNACCEPTABLE.

SCANNING CHECKLIST - Before finishing, verify:
1. ✅ Did you count ALL line items? Count them manually and match your item count
2. ✅ Did you check the ENTIRE receipt from top to bottom?
3. ✅ Did you include items in small print or at edges?
4. ✅ Did you extract the receipt TOTAL amount (the final total at bottom)?
5. ✅ Did you get the store name and date?
6. ✅ Did you verify: Sum of all item prices ≈ receipt total (within $1-2 for tax)?
7. ✅ Did you check for "Nombre d'articles" or "Number of items" on the receipt and match that count?

⚠️ CRITICAL: DO NOT EXTRACT DISCOUNT LINES AS ITEMS:
- Lines like "RABAIS SUR LE PRIX COURANT", "DISCOUNT", "COUPON", "SAVINGS", "REBATE" are NOT items
- These are discount/rebate lines - IGNORE them completely
- Only extract actual PRODUCT items (food, beverages, etc.)
- If a line shows a negative amount or says "RABAIS", "DISCOUNT", "COUPON", "SAVINGS" - SKIP IT

PRICE EXTRACTION RULES:
- Look at the RIGHTMOST price column - that's usually the LINE TOTAL (price AFTER any discounts)
- The price shown is the FINAL price the customer paid for that line item
- If receipt shows "QTY: 4" and "$4.99", check if $4.99 is per-unit or line total
- If receipt format shows "4 × $4.99" or "4 @ $4.99", the line total is $19.96
- If receipt shows "$4.99" with quantity 4, multiply: $4.99 × 4 = $19.96 (unless $4.99 is already the line total)
- ALWAYS verify: Sum of all prices should equal receipt total (within $1-2)
- If receipt shows "Nombre d'articles: 10", you MUST extract exactly 10 items (not more, not less)

Extract ALL grocery items with INTELLIGENT interpretation.`

    const userPrompt = isVerification
      ? `Review this receipt image carefully. Find ANY items that might have been missed in a previous scan. Return only the MISSED items. If nothing was missed, return empty items array. DO NOT extract discount lines (RABAIS, DISCOUNT, COUPON) as items.`
      : `Extract ALL grocery items from this receipt. 
CRITICAL REQUIREMENTS:
- Extract EVERY SINGLE ITEM - do not skip any line items
- Extract the receipt TOTAL amount (the final total shown on receipt)
- Count items carefully - missing items is unacceptable
- ⚠️ DO NOT extract discount lines as items:
  * Lines like "RABAIS SUR LE PRIX COURANT", "DISCOUNT", "COUPON", "SAVINGS", "REBATE" are NOT items
  * These are discount/rebate lines - IGNORE them completely
  * Only extract actual PRODUCT items (food, beverages, household items)
- If receipt shows "Nombre d'articles: 10", extract exactly 10 PRODUCT items (not discount lines)
- ⚠️ CRITICAL: Expand ALL abbreviations to FULL ENGLISH product names:
  * "DIAN SAUCE MIEL AIL" → "Diana Sauce Honey Garlic"
  * "CEREALES NATURE BIO" → "Nature Bio Cereals"
  * "SCE DI CAMPANIA MARI" → "Campania Marinara Sauce"
  * "CLAS SCE TOM AIL" → "Classico Tomato Garlic Sauce"
  * "CLAS SCE TOM BASILIC" → "Classico Tomato Basil Sauce"
  * "PHIL FR CRM REG BRIQ" → "Philadelphia Cream Cheese Brick"
  * NEVER use abbreviated names - always expand to full product names
- Parse quantities from item names (e.g., "18ct eggs" = 18 eggs)
- Identify the store and expand any store brand abbreviations
- Make product names user-friendly and easy to understand`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // GPT-4 with vision
          messages: [
            {
              role: 'system',
            content: `${systemPrompt}

🎯 CRITICAL INTELLIGENCE REQUIREMENTS:

🎯 CRITICAL INTELLIGENCE REQUIREMENTS:

1. EXPAND ABBREVIATIONS - Receipts use shortcuts, you must understand them:
   
   PREPARATION TERMS:
   - "chpd" = chopped, "dcd" = diced, "sld" = sliced, "whl" = whole, "shrd" = shredded
   - "mshd" = mashed, "mxd" = mixed, "crshd" = crushed, "grtd" = grated
   
   PRODUCE:
   - "tom" = tomatoes, "pot" = potatoes, "brcl" = broccoli, "strbry" = strawberries
   - "avoc" = avocado, "cuc" = cucumber, "bnn" = banana, "org" = orange
   - "appl" = apple, "grp" = grapes, "lttc" = lettuce, "spnch" = spinach
   - "crrt" = carrots, "ppr" = peppers, "oni" = onions, "grl" = garlic
   
   PRODUCT DESCRIPTORS:
   - "org" = organic, "frz" = frozen, "frsh" = fresh, "rf" = reduced fat
   - "ff" = fat free, "lf" = low fat, "ns" = no salt, "ls" = low sodium
   - "whl grn" = whole grain, "mlti grn" = multi grain
   
   SIZES:
   - "lg" = large, "sm" = small, "md" = medium, "xl" = extra large
   - "jmb" = jumbo, "fam" = family size
   
   UNITS:
   - "pk" = pack, "ct" = count, "oz" = ounce, "lb" = pound, "gal" = gallon
   - "qt" = quart, "pt" = pint, "dz" = dozen, "ea" = each

2. PARSE QUANTITIES FROM NAMES - Extract counts embedded in item names:
   - "18ct eggs" → name: "Eggs", quantity: 18, unit: "pieces"
   - "6pk yogurt" → name: "Yogurt", quantity: 6, unit: "pieces"
   - "12oz chips" → name: "Chips", quantity: 12, unit: "oz"
   - "3lb bananas" → name: "Bananas", quantity: 3, unit: "lbs"

3. STORE-SPECIFIC BRAND INTELLIGENCE:
   COSTCO:
   - "KS" = "Kirkland Signature" (their house brand)
   - Example: "KS diced tom" → "Kirkland Signature Diced Tomatoes"
   
   TRADER JOE'S:
   - "TJ" = "Trader Joe's"
   - Look for unique TJ product names
   
   WALMART:
   - "GV" = "Great Value" (their house brand)
   - "MM" = "Marketside"
   - "EF" = "Equate" (health/pharmacy)
   
   TARGET:
   - "GU" or "G&G" = "Good & Gather"
   - "MB" = "Market Pantry" (legacy brand)
   - "FH" = "Favorite Day" (snacks/treats)
   
   KROGER (including Smith's, Ralph's, Fred Meyer):
   - "SP" or "SV" = "Simple Truth" (organic)
   - "PS" = "Private Selection" (premium)
   
   SAFEWAY/ALBERTSONS:
   - "SF" = "Signature Select"
   - "OO" = "O Organics"
   
   ALDI:
   - "SD" = "Specially Selected" (premium)
   - "LI" = "liveGfree" (gluten-free)
   - Most products are house brand
   
   WHOLE FOODS:
   - "365" = "365 by Whole Foods"
   - Often uses full names but watch for "WF" prefix
   
   SPROUTS:
   - "SF" = "Sprouts Farmers Market" brand
   - "SB" = "Sprouts Brand"

4. CONTEXT-AWARE INTERPRETATION - Real Examples:
   - "KS dcd tom" (Costco) → name: "Kirkland Signature Diced Tomatoes", quantity: extracted from context
   - "18ct eggs" → name: "Eggs", quantity: 18, unit: "pieces"
   - "chpd onion" → name: "Chopped Onions", quantity: 1, unit: "bag"
   - "org chpd onion" → name: "Organic Chopped Onions"
   - "frz brcl florets" → name: "Frozen Broccoli Florets"
   - "GV mlti grn brd" (Walmart) → name: "Great Value Multi Grain Bread"
   - "TJ org sls" (Trader Joe's) → name: "Trader Joe's Organic Salsa"
   - "2lb bnn" → name: "Bananas", quantity: 2, unit: "lbs"
   - "6pk yog cups" → name: "Yogurt Cups", quantity: 6, unit: "pieces"

5. SMART QUANTITY EXTRACTION:
   - If item says "2 @ 3.99" → quantity is 2
   - If item has "x2" or "*2" → quantity is 2
   - ⚠️ CRITICAL: If item name contains weight (e.g., "5LB", "3kg", "2lb"), that's the PACKAGE SIZE, not quantity:
     * "OIGNONS JAUNES 5LB" → quantity is 1, unit is "lbs" (it's a 5lb bag, you bought 1 bag)
     * "POTATOES 3LB" → quantity is 1, unit is "lbs" (it's a 3lb bag, you bought 1 bag)
     * DO NOT use the weight number as the quantity - quantity is how many packages you bought
   - For weight-based produce (sold by weight at checkout):
     * "BANANE 0.980 kg" → quantity is 0.980, unit is "kg" (this is the actual weight)
     * "POIVRON VERT 0.275 kg" → quantity is 0.275, unit is "kg" (this is the actual weight)

6. ⚠️ CRITICAL PRICE EXTRACTION RULES - READ CAREFULLY:
   - PRICE EXTRACTION DEPENDS ON ITEM TYPE:
   
   **COUNT-BASED ITEMS (eggs, cans, bottles, etc.):**
   - PRICE = THE UNIT PRICE (price per item)
   - If receipt shows "Water 2 @ $3.99" or "2 × Water $7.98" → price is 3.99 (unit price), quantity is 2
   - If receipt shows "$4.99" with quantity 4 → price is 4.99 (unit price), quantity is 4
   - If you see "QTY: 4" and "$4.99" → price is 4.99 (unit), quantity is 4
   - If you see "$4.99" with no quantity shown, assume quantity 1, price is $4.99 (unit price)
   
   **WEIGHT-BASED ITEMS (produce sold by weight: kg, lb, etc.):**
   - PRICE = THE LINE TOTAL (total amount paid for that weight) - NOT per-kg price
   - If receipt shows "BANANE 0.980 kg @ $1.96 / kg" with price $1.92 → price is 1.92 (LINE TOTAL), quantity is 0.980, unit is "kg"
   - If receipt shows "POIVRON VERT 0.275 kg @ $8.80 / kg" with price $2.42 → price is 2.42 (LINE TOTAL), quantity is 0.275, unit is "kg"
   - DO NOT multiply price by quantity for weight items - the price shown IS the total for that weight
   
   - CRITICAL: Sum of prices for ALL items MUST equal the receipt total (within $1-2 for tax)
     * For count items: sum(unitPrice × quantity)
     * For weight items: sum(lineTotal) - don't multiply!
   - If your calculated total doesn't match the receipt total, you're missing items or prices are wrong
   - DO NOT include tax, subtotal, or receipt total in item prices
   - Extract the price shown in the price column for that line item
   - If price is not visible for an item, omit the price field entirely

7. ⚠️ BILINGUAL RECEIPT HANDLING - CRITICAL:
   - Many receipts (especially in Canada) show items in BOTH English and French
   - DO NOT extract the same item twice just because it appears in two languages
   - Examples of SAME item in different languages:
     * "Diana Sauce Honey Garlic" = "Diana Sauce Miel Ail" (same item, different language)
     * "Nature Bio Cereals" = "Cereales Nature Bio" (same item)
     * "Campania Mart Sauce" = "Sce Di Campania Mari" (same item, abbreviated)
     * "Classico Tomato Basil Sauce" = "Clas Sce Tom Basilic" (same item)
   - Extract each item ONLY ONCE, using the English name if available
   - If you see two items with the EXACT SAME PRICE and similar names, they're likely the same item
   - Count unique items, not language variations

8. ⚠️ DISCOUNT LINES - DO NOT EXTRACT:
   - Lines that say "RABAIS", "DISCOUNT", "COUPON", "SAVINGS", "REBATE", "PROMOTION" are NOT items
   - These are discount/rebate lines that appear AFTER items - IGNORE them completely
   - Only extract actual PRODUCT items (food, beverages, household items)
   - If a line has a negative amount or shows a discount percentage, it's NOT an item
   - The receipt may show "RABAIS SUR LE PRIX COURANT" with amounts - these are discounts, NOT items

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "store": "Costco" or "Walmart" or detected store name,
  "date": "YYYY-MM-DD",
  "receiptTotal": 79.38,
  "items": [
    {
      "name": "Kirkland Signature Diced Tomatoes",
      "emoji": "🍅",
      "quantity": 6,
      "unit": "cans",
      "category": "Pantry Staples",
      "location": "pantry",
      "price": 8.99
    }
  ]
}

⚠️ CRITICAL VALIDATION RULES:
- ALWAYS include "receiptTotal" - this is the FINAL TOTAL shown at the bottom of the receipt
- Extract EVERY item - count line by line, check top to bottom, left to right
- If receipt shows "Nombre d'articles: 13" or "Number of items: 13", you MUST extract exactly 13 PRODUCT items (not discount lines)
- DO NOT extract discount lines (RABAIS, DISCOUNT, COUPON, SAVINGS, REBATE) as items - these are NOT products
- ⚠️ CRITICAL: ALL item names MUST be in FULL ENGLISH - expand abbreviations:
  * "COMP OEUFS BL GROS" → "Large White Eggs" (NOT "Company Eggs")
  * "AVOCAT HASS" → "Hass Avocado" (NOT "Avocado Hass")
  * "OIGNONS JAUNES 5LB" → "Yellow Onions" (quantity: 1, unit: "lbs" - 5LB is package size, not quantity)
  * "POIVRON VERT" → "Green Pepper"
  * "BANANE" → "Banana"
  * NEVER use abbreviated or French names
- ⚠️ QUANTITY HANDLING - CRITICAL:
  * If item name contains weight (e.g., "5LB", "3kg"), that's PACKAGE SIZE, not quantity:
    - "OIGNONS JAUNES 5LB" → quantity is 1 (you bought 1 bag), unit is "lbs"
    - DO NOT use the weight number as quantity
  * If the same item appears multiple times (e.g., "COMP OEUFS BL GROS" appears 5 times):
    - Extract EACH occurrence separately (our system will aggregate them)
- After extracting, VERIFY: Sum of prices for ALL items MUST equal receiptTotal (within $1-2 for tax)
  * For count items: sum(unitPrice × quantity)
  * For weight items: sum(lineTotal) - don't multiply!
- If sum doesn't match receiptTotal, you're missing items OR prices are wrong - FIX IT
- Check for items in small print, at edges, or split across lines
- Double-check your item count matches "Nombre d'articles" on the receipt

CATEGORIES:
Produce, Meat & Seafood, Dairy & Eggs, Bakery, Pantry Staples, Beverages, Frozen, Snacks, Condiments

STORAGE LOCATIONS:
- fridge (fresh produce, dairy, meats, deli items)
- freezer (frozen foods, ice cream, frozen meats)
- pantry (canned goods, dry goods, snacks, condiments)

EMOJI GUIDELINES - Be SPECIFIC:
🍌 banana, 🍎 apple, 🥛 milk, 🥖 bread, 🥩 meat, 🧀 cheese, 🥚 eggs, 🥕 carrots, 🍅 tomato, 🥦 broccoli, 🍓 strawberry, 🍊 orange, 🥤 beverage, 🍗 chicken, 🐟 fish, 🧈 butter, 🥓 bacon, 🍫 chocolate, 🍪 cookies, 🥔 potato, 🧅 onion, 🧄 garlic, 🌽 corn, 🥒 cucumber, 🫑 pepper, 🍋 lemon, 🍇 grapes, 🍉 watermelon, 🍑 peach, 🥥 coconut

⚠️ REMEMBER: Your job is to make abbreviated, cryptic receipt text into clear, user-friendly product names!`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000, // Increased to ensure full receipt capture
          temperature: 0.1, // Very low temperature for maximum accuracy and consistency
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Vision API request failed')
      }

      const data = await response.json()
      let content = data.choices[0]?.message?.content || '{}'
      
      // Clean up response - remove markdown code blocks if present
      content = content.trim()
      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/\n?```$/, '')
      }
      
      // Additional cleanup: remove any leading/trailing text before/after JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      // Parse JSON response with better error handling
      let result
      try {
        result = JSON.parse(content)
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content)
        console.error('Parse error:', parseError)
        // Return empty result if parsing fails
        return {
          items: [],
          totalItems: 0,
          store: 'Unknown',
          date: new Date().toISOString().split('T')[0],
          rawText: content,
        }
      }
      
      // Normalize categories and ensure proper emojis using unified formatter
      const processedItems = (result.items || []).map((item: any) => {
        // Validate item has required fields
        if (!item.name || typeof item.name !== 'string') {
          console.warn('Skipping invalid item:', item)
          return null
        }
        
        // Expand abbreviated names to full English names
        // Expand abbreviated names to full English names
        let expandedName = this.expandItemName(item.name.trim())
        
        const normalizedCategory = normalizeCategory(item.category || 'Other')
        const properEmoji = getItemEmoji(expandedName, normalizedCategory)
        
        // Validate and normalize price
        let price = item.price
        if (price !== undefined && price !== null) {
          price = typeof price === 'number' ? price : parseFloat(price)
          if (isNaN(price) || price < 0) {
            price = undefined
          }
        }
        
        // Validate quantity
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 
          ? item.quantity 
          : 1
        
        return {
          name: expandedName,
          emoji: properEmoji,
          quantity,
          unit: item.unit || 'pieces',
          category: normalizedCategory,
          location: item.location || 'pantry',
          price,
          store: item.store,
        }
      }).filter((item): item is ScannedItem => item !== null)
      
      const bulkAdjustedItems = this.applyBulkPackIntelligence(processedItems, result.store)
      
      // Aggregate items by quantity (for receipts, repeated items = quantity, not duplicates)
      const aggregatedItems = this.aggregateReceiptItems(bulkAdjustedItems)
      
      return {
        items: aggregatedItems,
        totalItems: aggregatedItems.length,
        store: result.store,
        date: result.date,
        receiptTotal: result.receiptTotal,
        rawText: content,
      }

    } catch (error) {
      console.error(`Error in ${pass} pass receipt scan:`, error)
      // Return empty result on error
      return {
        items: [],
        totalItems: 0,
        store: 'Unknown',
        date: new Date().toISOString().split('T')[0],
        rawText: '',
      }
    }
  }

  // Verify receipt scan - check for missed items and validate totals
  private async verifyReceiptScan(imageBase64: string, firstPassResult: ScanResult): Promise<ScanResult> {
    try {
      // Check if receipt total was extracted
      const receiptTotal = firstPassResult.receiptTotal
      
      // Calculate total from items
      // For weight-based items, price is already the LINE TOTAL (don't multiply)
      // For count-based items, price is UNIT PRICE (multiply by quantity)
      const calculatedTotal = firstPassResult.items.reduce((sum, item) => {
        const price = item.price || 0
        const quantity = item.quantity || 1
        const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
        
        // For weight-based items, price is already the total for that weight
        // For count-based items, multiply unit price by quantity
        if (isWeightBased) {
          return sum + price // Price is already line total
        } else {
          return sum + (price * quantity) // Price is unit price
        }
      }, 0)
      const totalDifference = receiptTotal 
        ? Math.abs(receiptTotal - calculatedTotal)
        : null
      
      // If totals don't match or receipt total wasn't extracted, do verification pass
      // Use very strict threshold - any mismatch > $0.50 needs verification
      const needsVerification = !receiptTotal || (totalDifference !== null && totalDifference > 0.50)
      
      if (needsVerification) {
        console.log('🔍 Receipt validation: Running verification pass...', {
          receiptTotal,
          calculatedTotal,
          difference: totalDifference,
          itemCount: firstPassResult.items.length
        })
        
        // Second pass to find missed items
        const verificationResult = await this.performReceiptScan(imageBase64, 'verification')
        
        // Merge any additional items found - aggregation will handle quantities
        let allItems = [...firstPassResult.items]
        if (verificationResult.items.length > 0) {
          console.log(`✅ Verification found ${verificationResult.items.length} additional items`)
          // Simply merge all items - aggregation will combine same items with same price into quantities
          allItems = [...firstPassResult.items, ...verificationResult.items]
        }
        
        // Final aggregation pass before calculating totals
        const finalAggregatedItems = this.aggregateReceiptItems(allItems)
        
        // Recalculate total
        // For weight-based items, price is already the LINE TOTAL (don't multiply)
        // For count-based items, price is UNIT PRICE (multiply by quantity)
        const newCalculatedTotal = finalAggregatedItems.reduce((sum, item) => {
          const price = item.price || 0
          const quantity = item.quantity || 1
          const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes((item.unit || '').toLowerCase())
          
          if (isWeightBased) {
            return sum + price // Price is already line total
          } else {
            return sum + (price * quantity) // Price is unit price
          }
        }, 0)
        
        // Use receipt total from verification if first pass didn't have it
        const finalReceiptTotal = receiptTotal || verificationResult.receiptTotal
        const finalDifference = finalReceiptTotal 
          ? Math.abs(finalReceiptTotal - newCalculatedTotal)
          : null
        
        // If still doesn't match, try one more aggressive pass
        if (finalReceiptTotal && finalDifference !== null && finalDifference > 1.00) {
          console.log(`⚠️ Still mismatched after verification (diff: $${finalDifference.toFixed(2)}). Running aggressive third pass...`)
          
          // Third pass with explicit total mismatch information
          const aggressiveSystemPrompt = `🚨 CRITICAL ERROR: The receipt total is $${finalReceiptTotal.toFixed(2)} but only $${newCalculatedTotal.toFixed(2)} was calculated. You are MISSING ITEMS or PRICES ARE WRONG.

MANDATORY STEPS:
1. Count EVERY line item on the receipt - if receipt shows "Nombre d'articles: 13", you MUST extract exactly 13 PRODUCT items
2. PRICE EXTRACTION - DEPENDS ON ITEM TYPE:
   - COUNT-BASED ITEMS: Extract UNIT PRICE (price per item)
   - WEIGHT-BASED ITEMS: Extract LINE TOTAL (total amount for that weight) - NOT per-kg price
3. QUANTITY HANDLING:
   - COUNT ITEMS: If receipt shows "4 × $4.99" or "QTY 4 $4.99" → price is 4.99 (unit), quantity is 4
   - WEIGHT ITEMS: If receipt shows "0.980 kg @ $1.96 / kg" with price $1.92 → price is 1.92 (LINE TOTAL), quantity is 0.980, unit is "kg"
   - If you see the same item multiple times on separate lines, extract EACH occurrence separately (our system will aggregate them)
4. Look for items in tiny print, at top/bottom edges, or split across lines
5. ⚠️ CRITICAL: ALL item names MUST be in FULL ENGLISH:
   * "COMP OEUFS BL GROS" → "Large Eggs" (NOT "Company Eggs" or "Comp Eggs")
   * "AVOCAT HASS" → "Hass Avocado" (NOT "Avocado Hass" or "Avocat Hass")
   * "OIGNONS JAUNES" → "Yellow Onions" (NOT "Onions Jaunes")
   * "POIVRON VERT" → "Green Pepper" (NOT "Poivron Vert")
   * "BANANE" → "Banana" (NOT "Banane")
   * NEVER use abbreviated or French names - always translate to English
6. Verify: Sum of prices for ALL items MUST equal $${finalReceiptTotal.toFixed(2)} (within $1-2 for tax)
   * For count items: sum(unitPrice × quantity)
   * For weight items: sum(lineTotal) - don't multiply!
7. If your sum doesn't match, you're missing items - look more carefully at EVERY line

The receipt total is $${finalReceiptTotal.toFixed(2)}. Your extracted items MUST sum to this amount.`
          
          // Create a modified scan with the aggressive prompt
          const thirdPassResult = await this.performAggressiveReceiptScan(imageBase64, aggressiveSystemPrompt, finalReceiptTotal, newCalculatedTotal)
          
          // If third pass found items, merge them - aggregation will handle quantities
          if (thirdPassResult.items.length > 0) {
            console.log(`✅ Third pass found ${thirdPassResult.items.length} items`)
            // Simply merge all items - aggregation will combine same items with same price into quantities
            allItems = [...allItems, ...thirdPassResult.items]
            
            // Final aggregation pass before returning
            const finalAggregatedItems = this.aggregateReceiptItems(allItems)
            
            // Recalculate one more time - price is unit price, multiply by quantity
            const thirdPassTotal = finalAggregatedItems.reduce((sum, item) => {
              const unitPrice = item.price || 0
              const quantity = item.quantity || 1
              return sum + (unitPrice * quantity)
            }, 0)
            
            const thirdPassDifference = finalReceiptTotal 
              ? Math.abs(finalReceiptTotal - thirdPassTotal)
              : null
            
            console.log(`💰 Third pass calculation:`, {
              calculatedTotal: thirdPassTotal.toFixed(2),
              receiptTotal: finalReceiptTotal.toFixed(2),
              difference: thirdPassDifference?.toFixed(2),
              itemCountBeforeAgg: allItems.length,
              itemCountAfterAgg: finalAggregatedItems.length
            })
            
            return {
              items: finalAggregatedItems,
              totalItems: finalAggregatedItems.length,
              store: firstPassResult.store || verificationResult.store || thirdPassResult.store,
              date: firstPassResult.date || verificationResult.date || thirdPassResult.date,
              receiptTotal: finalReceiptTotal,
              calculatedTotal: thirdPassTotal,
              validationPassed: thirdPassDifference !== null && thirdPassDifference <= 2.00, // Allow $2 tolerance for tax/rounding
              rawText: firstPassResult.rawText,
            }
          }
        }
        
        return {
          items: finalAggregatedItems,
          totalItems: finalAggregatedItems.length,
          store: firstPassResult.store || verificationResult.store,
          date: firstPassResult.date || verificationResult.date,
          receiptTotal: finalReceiptTotal,
          calculatedTotal: newCalculatedTotal,
          validationPassed: finalDifference !== null && finalDifference <= 2.00, // Allow $2 tolerance for tax/rounding
          rawText: firstPassResult.rawText,
        }
      }
      
      // Return first pass result with validation info
      return {
        ...firstPassResult,
        calculatedTotal: calculatedTotal,
        validationPassed: totalDifference !== null && totalDifference <= 1.00, // Allow $1 tolerance for tax/rounding
      }
      
    } catch (error) {
      console.error('Error in receipt verification:', error)
      // Return first pass result even if verification fails
      // Apply aggregation before returning
      const aggregatedItems = this.aggregateReceiptItems(firstPassResult.items)
      
      // Calculate total
      // For weight-based items, price is already the LINE TOTAL (don't multiply)
      // For count-based items, price is UNIT PRICE (multiply by quantity)
      const calculatedTotal = aggregatedItems.reduce((sum, item) => {
        const price = item.price || 0
        const quantity = item.quantity || 1
        const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
        
        if (isWeightBased) {
          return sum + price // Price is already line total
        } else {
          return sum + (price * quantity) // Price is unit price
        }
      }, 0)
      
      const totalDifference = receiptTotal 
        ? Math.abs(receiptTotal - calculatedTotal)
        : null
      
      return {
        ...firstPassResult,
        items: aggregatedItems,
        totalItems: aggregatedItems.length,
        calculatedTotal,
        validationPassed: totalDifference !== null && totalDifference <= 2.00,
      }
    }
  }

  // Scan single item using OpenAI Vision API
  async scanItem(imageBase64: string): Promise<ScannedItem | null> {
    try {
      const apiKey = config.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert at identifying grocery items with extreme precision. Look carefully at the image and identify the food item.

CRITICAL ACCURACY REQUIREMENTS:
- Count the EXACT number of items visible in the image
- If you see 4 bananas, say 4, not 5 or 6
- Look very carefully at the image before determining quantity
- Be specific with item names

Determine:
1. Item name (very specific, e.g., "Yellow Bananas" not just "Bananas")
2. Emoji (the MOST SPECIFIC emoji for this exact item, e.g., 🍌 for bananas)
3. Quantity (EXACT count of items you can see - count carefully!)
4. Unit (pieces, lbs, kg, bunch, carton, bag, bottle, etc.)
5. Category (Produce, Meat & Seafood, Dairy & Eggs, Bakery, Pantry Staples, Beverages, Frozen, Snacks, Condiments)
6. Storage location (fridge, freezer, or pantry)

Respond ONLY with valid JSON in this exact format:
{
  "name": "Yellow Bananas",
  "emoji": "🍌",
  "quantity": 4,
  "unit": "pieces",
  "category": "Produce",
  "location": "fridge"
}

Emoji Examples:
🍌 banana, 🍎 apple, 🥛 milk, 🥖 bread, 🥩 meat, 🧀 cheese, 🥚 eggs, 🥕 carrots, 🍅 tomato, 🥦 broccoli, 🍓 strawberry, 🍊 orange, 🥤 beverage, 🍞 bread, 🍗 chicken, 🐟 fish, 🧈 butter, 🥓 bacon, 🍫 chocolate, 🍪 cookies, 🥔 potato, 🧅 onion, 🧄 garlic, 🌽 corn, 🥒 cucumber, 🫑 pepper, 🍋 lemon, 🍇 grapes, 🍉 watermelon, 🍑 peach, 🥥 coconut

If you can't identify the item clearly, return null.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What grocery item is this?'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Vision API request failed')
      }

      const data = await response.json()
      let content = data.choices[0]?.message?.content || 'null'
      
      // Clean up response - remove markdown code blocks if present
      content = content.trim()
      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/\n?```$/, '')
      }
      
      // Additional cleanup: remove any leading/trailing text before/after JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      // Parse JSON response with better error handling
      let result
      try {
        result = JSON.parse(content)
      } catch (parseError) {
        console.error('Failed to parse OpenAI item response:', content)
        console.error('Parse error:', parseError)
        return null
      }
      
      if (!result || !result.name) return null
      
      // Normalize category and ensure proper emoji using unified formatter
      const normalizedCategory = normalizeCategory(result.category || 'Other')
      const properEmoji = getItemEmoji(result.name, normalizedCategory)
      
      return {
        ...result,
        category: normalizedCategory,
        emoji: properEmoji,  // Ensure emoji is set properly
      }

    } catch (error) {
      console.error('Error scanning item:', error)
      throw error
    }
  }

  // Helper: Convert image URI to base64
  async imageUriToBase64(uri: string): Promise<string> {
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          // Remove data:image/jpeg;base64, prefix
          const base64Data = base64.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting image to base64:', error)
      throw error
    }
  }

  // Scan expiry date from package image using OCR (EXTREMELY ACCURATE VERSION)
  async scanExpiryDate(imageBase64: string): Promise<{ expiryDate?: string; error?: string; confidence?: string }> {
    try {
      const apiKey = config.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      // Enhanced system prompt for extreme accuracy
      const systemPrompt = `You are an EXPERT at reading expiry dates from product packaging with EXTREME ACCURACY. Your job is to find and extract ONLY the expiry date, best before date, or use-by date from the image.

🚨 CRITICAL ACCURACY REQUIREMENTS:
1. Read EVERY character carefully - check for OCR errors (0 vs O, 1 vs I, 5 vs S, etc.)
2. Distinguish between expiry dates and manufacturing/production dates
3. Only return dates that are CLEARLY expiry dates
4. If uncertain, return null - accuracy is more important than guessing

📅 DATE FORMATS TO RECOGNIZE (all variations):
- MM/DD/YYYY or MM-DD-YYYY (US format: "12/25/2025" or "12-25-2025")
- DD/MM/YYYY or DD-MM-YYYY (European format: "25/12/2025" or "25-12-2025")
- YYYY-MM-DD (ISO format: "2025-12-25")
- YYYY/MM/DD or YYYY.MM.DD ("2025/12/25" or "2025.12.25")
- Month DD, YYYY (e.g., "Dec 25, 2025", "December 25, 2025", "DEC 25 2025")
- DD MMM YYYY (e.g., "25 Dec 2025", "25 DEC 2025")
- DD.MM.YYYY or DD/MM/YY (European: "25.12.2025" or "25/12/25")
- YYMMDD or MMDDYY (compact: "251225" or "122525")
- YYYY MMM DD (e.g., "2026 JA 09" = January 9, 2026, "2025 FE 15" = February 15, 2025)
- YYYY MMMDD (e.g., "2026JA09", "2025FE15")
- Month abbreviations: JA/Jan/January, FE/Feb/February, MR/Mar/March, AP/Apr/April, MY/May, JN/Jun/June, JL/Jul/July, AU/Aug/August, SE/Sep/September, OC/Oct/October, NO/Nov/November, DE/Dec/December
- Julian dates (YYDDD format: "25359" = day 359 of 2025)

🏷️ LABELS TO LOOK FOR (expiry indicators):
- "Best Before", "Best By", "BB", "B.B.", "BEST BY"
- "Use By", "Use-By", "UB", "USE BY"
- "Expires", "Expiry Date", "EXP", "EXPIRES", "EXP DATE"
- "Sell By", "Sell-By", "SELL BY"
- "Consume By", "Consume Before"
- "Best if used by", "Best if used before"
- "Enjoy by", "Enjoy before"

❌ DO NOT EXTRACT (manufacturing/production indicators):
- "MFG", "Manufactured", "Production Date", "Packed On", "Made On"
- "Lot", "Batch", "LOT", "BATCH"
- "Pack Date", "Packed Date"
- Dates near "Produced", "Manufactured", "Made"

🔍 SCANNING STRATEGY:
1. Scan the ENTIRE image systematically (top to bottom, left to right)
2. Look for date patterns near expiry-related labels
3. Check for multiple dates - choose the one labeled as expiry
4. Verify date reasonableness (not in past, not too far in future - typically 1 day to 5 years)
5. Check for OCR errors (common: 0/O, 1/I/l, 5/S, 6/G, 8/B)

✅ VALIDATION RULES:
- Year should be current year or 1-5 years in future (reasonable shelf life)
- Month should be 01-12
- Day should be valid for that month (e.g., no Feb 30)
- Date should make logical sense (not "01/01/1900" or "99/99/9999")

📊 CONFIDENCE LEVELS:
- "high": Date is crystal clear, unambiguous, near expiry label, format is standard
- "medium": Date is readable but slightly ambiguous, or format is unusual
- "low": Date is unclear, ambiguous, or could be manufacturing date - DO NOT RETURN

Return ONLY a JSON object with this EXACT format:
{
  "expiryDate": "2025-12-25" or null,
  "confidence": "high" | "medium" | "low",
  "rawText": "the exact text you read from the image",
  "labelFound": "the expiry label you found (e.g., 'Best Before')"
}

If no expiry date is found or confidence is low, return:
{
  "expiryDate": null,
  "confidence": "low",
  "rawText": null,
  "labelFound": null
}`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract the expiry date from this product package image with EXTREME ACCURACY. Read carefully and verify the date is an expiry date, not a manufacturing date. Return only the JSON object.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high' // Request high detail for better OCR accuracy
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.1 // Low temperature for more deterministic, accurate results
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'
      
      // Parse JSON response (handle markdown code blocks if present)
      let parsed = content.trim()
      if (parsed.startsWith('```')) {
        parsed = parsed.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      }
      
      const result = JSON.parse(parsed)
      
      // Parse raw text if expiryDate is not in YYYY-MM-DD format
      let parsedExpiryDate = result.expiryDate
      if (result.rawText && !parsedExpiryDate) {
        // Try to parse formats like "2026 JA 09" (January 9, 2026)
        const monthAbbrevMap: Record<string, string> = {
          'ja': '01', 'jan': '01', 'january': '01',
          'fe': '02', 'feb': '02', 'february': '02',
          'mr': '03', 'mar': '03', 'march': '03',
          'ap': '04', 'apr': '04', 'april': '04',
          'my': '05', 'may': '05',
          'jn': '06', 'jun': '06', 'june': '06',
          'jl': '07', 'jul': '07', 'july': '07',
          'au': '08', 'aug': '08', 'august': '08',
          'se': '09', 'sep': '09', 'september': '09',
          'oc': '10', 'oct': '10', 'october': '10',
          'no': '11', 'nov': '11', 'november': '11',
          'de': '12', 'dec': '12', 'december': '12'
        }
        
        // Try to parse "2026 JA 09" format
        const jaFormatMatch = result.rawText.match(/(\d{4})\s*(JA|FE|MR|AP|MY|JN|JL|AU|SE|OC|NO|DE|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i)
        if (jaFormatMatch) {
          const [, year, monthAbbrev, day] = jaFormatMatch
          const month = monthAbbrevMap[monthAbbrev.toLowerCase()]
          if (month) {
            const dayPadded = day.padStart(2, '0')
            parsedExpiryDate = `${year}-${month}-${dayPadded}`
            console.log('✅ Parsed expiry date from JA format:', parsedExpiryDate)
          }
        }
      }
      
      // Only accept high confidence results for maximum accuracy
      if (parsedExpiryDate && result.confidence === 'high') {
        // Validate the date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (dateRegex.test(parsedExpiryDate)) {
          // Additional validation: check date reasonableness
          const date = new Date(result.expiryDate)
          const now = new Date()
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          const fiveYearsFromNow = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate())
          
          // Date should be in the future (or very recent past for items that just expired)
          // But not more than 5 years in the future (unrealistic shelf life)
          if (date >= oneYearAgo && date <= fiveYearsFromNow) {
            // Verify the date components match what was parsed
            const [year, month, day] = parsedExpiryDate.split('-').map(Number)
            if (date.getFullYear() === year && 
                date.getMonth() === month - 1 && 
                date.getDate() === day) {
              console.log('✅ Expiry date scanned successfully:', {
                date: parsedExpiryDate,
                confidence: result.confidence,
                rawText: result.rawText,
                labelFound: result.labelFound
              })
              return { 
                expiryDate: parsedExpiryDate,
                confidence: result.confidence
              }
            }
          } else {
            console.warn('⚠️ Scanned date is outside reasonable range:', result.expiryDate)
          }
        }
      } else if (result.confidence === 'medium') {
        // For medium confidence, try to parse raw text if expiryDate not provided
        if (!parsedExpiryDate && result.rawText) {
          const monthAbbrevMap: Record<string, string> = {
            'ja': '01', 'jan': '01', 'january': '01',
            'fe': '02', 'feb': '02', 'february': '02',
            'mr': '03', 'mar': '03', 'march': '03',
            'ap': '04', 'apr': '04', 'april': '04',
            'my': '05', 'may': '05',
            'jn': '06', 'jun': '06', 'june': '06',
            'jl': '07', 'jul': '07', 'july': '07',
            'au': '08', 'aug': '08', 'august': '08',
            'se': '09', 'sep': '09', 'september': '09',
            'oc': '10', 'oct': '10', 'october': '10',
            'no': '11', 'nov': '11', 'november': '11',
            'de': '12', 'dec': '12', 'december': '12'
          }
          
          const jaFormatMatch = result.rawText.match(/(\d{4})\s*(JA|FE|MR|AP|MY|JN|JL|AU|SE|OC|NO|DE|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i)
          if (jaFormatMatch) {
            const [, year, monthAbbrev, day] = jaFormatMatch
            const month = monthAbbrevMap[monthAbbrev.toLowerCase()]
            if (month) {
              const dayPadded = day.padStart(2, '0')
              parsedExpiryDate = `${year}-${month}-${dayPadded}`
              console.log('✅ Parsed expiry date from JA format (medium confidence):', parsedExpiryDate)
            }
          }
        }
        
        // For medium confidence, we could do a second pass or ask user to confirm
        console.log('⚠️ Medium confidence expiry date detected:', result)
        // Still validate but be more cautious
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (parsedExpiryDate && dateRegex.test(parsedExpiryDate)) {
          const date = new Date(parsedExpiryDate)
          const now = new Date()
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          const fiveYearsFromNow = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate())
          
          if (date >= oneYearAgo && date <= fiveYearsFromNow) {
            const [year, month, day] = parsedExpiryDate.split('-').map(Number)
            if (date.getFullYear() === year && 
                date.getMonth() === month - 1 && 
                date.getDate() === day) {
              console.log('✅ Medium confidence date accepted after validation:', parsedExpiryDate)
              return { 
                expiryDate: parsedExpiryDate,
                confidence: result.confidence
              }
            }
          }
        }
      }
      
      return { 
        expiryDate: undefined, 
        error: result.rawText 
          ? `Could not find a clear expiry date. Found text: "${result.rawText}" but confidence was ${result.confidence}. Please try again or enter manually.`
          : 'No valid expiry date found. Please ensure the expiry date is clearly visible in the image.'
      }
    } catch (error) {
      console.error('Error scanning expiry date:', error)
      return { 
        expiryDate: undefined, 
        error: error instanceof Error ? error.message : 'Failed to scan expiry date. Please try again or enter manually.'
      }
    }
  }
}

export const scanningService = new ScanningService()


