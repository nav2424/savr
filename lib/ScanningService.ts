// SAVR AI Scanning Service - Receipt & Item Recognition with OpenAI Vision
import Constants from 'expo-constants'
import * as FileSystemLegacy from 'expo-file-system/legacy'
import config from '../config'
import { formatPantryItem, normalizeCategory, getItemEmoji, detectCategoryFromName } from './PantryItemFormatter'
import { findProductPackInfo, isWarehouseStore } from './ProductKnowledgeDatabase'
import { buildScannedItemsFromOcr, completeItemName, parseReceiptOcrText, parseTotalsFromText } from './ReceiptOcrParser'

export interface ScannedItem {
  name: string
  emoji: string  // Specific emoji for this item
  quantity: number
  unit: string
  category: string
  location: 'fridge' | 'freezer' | 'pantry'
  price?: number  // For count items: unit price. For weight items: line total (same as lineTotal)
  unitPrice?: number  // Unit price (for weight items: price per lb/kg)
  lineTotal?: number  // Line total (for weight items: total for that weight)
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
  receiptSubtotal?: number  // Subtotal before tax/fees
  receiptTax?: number  // Tax/fees amount from receipt (NOT the rate)
  receiptTaxRate?: number  // Tax rate percentage (e.g., 10.000)
  calculatedSubtotal?: number  // Sum of all item line totals
  calculatedTotal?: number  // calculatedSubtotal + receiptTax
  validationPassed?: boolean  // Whether totals match
  subtotalMismatch?: boolean  // Whether calculatedSubtotal differs from receiptSubtotal
  totalMismatch?: boolean  // Whether calculatedTotal differs from receiptTotal
  needsReview?: boolean  // True if OCR failed or validation failed - requires manual review
  estimatedTax?: number  // Estimated tax/fees when subtotal differs from receipt total
  rawText?: string
  // Debug fields
  selectedTotalsBlockIndex?: number
  allParsedTotalsBlocks?: Array<{ subtotal?: number; tax?: number; total?: number }>
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
  private getCandidateBases(): string[] {
    const baseFromConfig = (config as any).apiBase
    // Expo Go: hostUri/debuggerHost are set. Dev builds may not—use linkingUri as fallback so OCR can reach your machine.
    const debuggerHost =
      (Constants?.expoConfig as any)?.hostUri ||
      (Constants as any)?.manifest?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost

    let hostFromLinking: string | null = null
    const linkingUri = (Constants as any)?.linkingUri
    if (typeof linkingUri === 'string' && linkingUri.startsWith('exp://')) {
      try {
        const url = new URL(linkingUri)
        if (url.hostname) hostFromLinking = url.hostname
      } catch (_) {}
    }

    const hostFromDebugger = typeof debuggerHost === 'string' ? debuggerHost.split(':')[0] : null
    const devHost = hostFromDebugger || hostFromLinking
    
    // Build candidate URLs
    const candidates: (string | null)[] = []
    
    // 1. Use configured API base if available
    if (baseFromConfig) {
      candidates.push(baseFromConfig)
    }
    
    // 2. Dev server host (Expo Go has it; dev build may get it from linkingUri when launched from Expo)
    if (devHost) {
      candidates.push(`http://${devHost}:3000`)
    }
    candidates.push('http://localhost:3000')
    candidates.push('http://127.0.0.1:3000')
    
    const uniqueBases = Array.from(new Set(candidates.filter(Boolean))) as string[]
    
    console.log('🔍 OCR candidate base URLs:', uniqueBases)
    
    return uniqueBases
  }

  private async callReceiptOcr(imageBase64: string, timeoutMs: number = 30000): Promise<string | null> {
    const candidateBases = this.getCandidateBases()
    
    // Use ONLY /api/ocr endpoint (single endpoint)
    const endpoint = '/api/ocr'
    
    for (const baseUrl of candidateBases) {
      const ocrUrl = `${baseUrl}${endpoint}`
      try {
        console.log(`🔍 Attempting OCR at ${ocrUrl}...`)
        
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        
        const response = await fetch(ocrUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ imageBase64 })
        })
        
        clearTimeout(timeout)

        // Get response text for error logging
        const responseText = await response.text().catch(() => '')
        
        // 422 = OCR failed (image too small, etc.) - fall back to LLM
        if (response.status === 422) {
          console.log(`⚠️ OCR rejected image (status 422): ${responseText.substring(0, 200)}`)
          continue
        }
        
        if (!response.ok) {
          console.error(`❌ OCR endpoint error (status ${response.status}): ${responseText.substring(0, 200)}`)
          continue
        }
        
        // Parse JSON response
        let data: any
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error(`❌ OCR response parse error: ${responseText.substring(0, 200)}`)
          continue
        }
        
        if (data?.text && typeof data.text === 'string' && data.text.trim().length > 10) {
          const provider = data.provider || 'google_vision'
          const textLength = data.textLength || data.text.length
          console.log(`✅ OCR success (${provider}): ${textLength} characters extracted`)
          return data.text
        } else {
          console.warn(`⚠️ OCR returned insufficient text: ${data?.text?.length || 0} characters`)
          continue
        }
      } catch (error: any) {
        // Log detailed error information
        const errorMsg = error?.message || String(error)
        const errorName = error?.name || 'UnknownError'
        
        // Check if it's a network error (server not running)
        const isNetworkError = errorMsg.includes('Network request failed') || 
                              errorMsg.includes('Failed to connect') ||
                              errorName === 'TypeError'
        
        if (isNetworkError) {
          console.warn(`⚠️ OCR server not reachable at ${ocrUrl} (server may not be running)`)
        } else {
          console.error(`❌ OCR request failed at ${ocrUrl}:`, {
            error: errorMsg,
            name: errorName,
            type: error?.constructor?.name
          })
        }
        // Continue to next base URL
        continue
      }
    }
    
    console.log('⚠️ All OCR endpoints failed, falling back to LLM')
    console.log('💡 Tip: Make sure the server is running: cd server && npm start')
    return null
  }
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
    let expanded = completeItemName(name.trim())
    
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

  private async callChatCompletion(
    messages: any[],
    options: { model?: string; max_tokens?: number; temperature?: number; timeoutMs?: number } = {}
  ): Promise<any> {
    const { model = 'gpt-4o', max_tokens = 2000, temperature = 0.2, timeoutMs = 120000 } = options
    const candidateBases = this.getCandidateBases()

    let lastProxyError: string | null = null

    for (const baseUrl of candidateBases) {
      const proxyUrl = `${baseUrl}/api/sage/chat`
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages,
            temperature,
            max_tokens
          })
        })
        clearTimeout(timeout)

        if (proxyResponse.ok) {
          return await proxyResponse.json()
        }

        const proxyErrorText = await proxyResponse.text().catch(() => '')
        lastProxyError = `SAGE proxy error at ${baseUrl}: ${proxyResponse.status} ${proxyResponse.statusText} ${proxyErrorText}`.trim()
      } catch (error) {
        const errorMsg = String(error)
        if (errorMsg.includes('AbortError') || errorMsg.includes('aborted')) {
          lastProxyError = `SAGE proxy timeout at ${baseUrl} (request took longer than ${timeoutMs}ms)`
        } else {
          lastProxyError = `SAGE proxy unreachable at ${baseUrl}: ${errorMsg}`
        }
      }
    }

    // If proxy isn't reachable, try direct OpenRouter (client-side) when key is provided.
    if (config.openrouterApiKey) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.openrouterApiKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.openrouterModel || model,
            messages,
            max_tokens,
            temperature
          })
        })
        clearTimeout(timeout)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.error?.message || `OpenRouter error: ${response.status}`)
        }

        return await response.json()
      } catch (error) {
        lastProxyError = `OpenRouter direct call failed: ${String(error)}`
      }
    }

    if (!config.openaiApiKey) {
      throw new Error(
        `OpenAI proxy is not reachable. Tried: ${candidateBases.join(', ')}. ` +
          `${lastProxyError ?? ''} ` +
          'Start the server with OPENAI_API_KEY and ensure API_BASE points to it, or set EXPO_PUBLIC_OPENROUTER_API_KEY for direct fallback.'
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature
      })
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData?.error?.message || `API error: ${response.status}`)
    }

    return await response.json()
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

  /** True if this is a receipt discount/promo line (Saved $, Cartwheel, etc.), not a product. */
  private isDiscountOrPromoItem(name: string): boolean {
    const n = this.normalizeItemName(name)
    return n === 'saved' || n === 'cartwheel15' || n.startsWith('cartwheel') || n === 'rebate' || n === 'coupon' || n === 'discount'
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
      
      // Only merge when we're confident it's the SAME line item (true duplicate), not a different product.
      // Avoid merging distinct items (e.g. "Milk" vs "Almond Milk", "Tomato" vs "Tomato Sauce").
      if (!existing) {
        for (const [existingKey, existingItem] of map.entries()) {
          const existingNormalized = this.normalizeItemName(existingItem.name)
          const existingPrice = existingItem.price || 0
          const existingQuantity = existingItem.quantity || 1
          const itemQty = item.quantity || 1
          const priceTolerance = 0.02 // 2% - only merge if prices are nearly identical
          const priceDiff = Math.abs(existingPrice - price)
          const avgPrice = (existingPrice + price) / 2
          const pricesMatch = avgPrice > 0 && priceDiff / avgPrice <= priceTolerance

          if (isWeightBased && existingItem.unit === item.unit) {
            // Weight items: only treat as duplicate if weight is within 5% (same item from different OCR passes)
            const weightDiff = Math.abs(existingQuantity - itemQty)
            const avgWeight = (existingQuantity + itemQty) / 2
            if (avgWeight > 0 && weightDiff / avgWeight < 0.05 && pricesMatch) {
              key = existingKey
              existing = existingItem
              console.log(`  🔗 Matched duplicate weight item: "${item.name}" ≈ "${existingItem.name}" (same weight, same price)`)
              break
            }
          } else if (!isWeightBased) {
            // Count items: require very high name similarity (0.9+) AND same price to avoid merging different products
            const coreWords1 = normalizedName.split(/\s+/).filter(w => w.length > 2 && !/^\d+/.test(w))
            const coreWords2 = existingNormalized.split(/\s+/).filter(w => w.length > 2 && !/^\d+/.test(w))
            let similarity = 0
            if (coreWords1.length > 0 && coreWords2.length > 0) {
              const shared = coreWords1.filter(w => coreWords2.includes(w))
              similarity = shared.length / Math.max(coreWords1.length, coreWords2.length)
            }
            const allWords1 = normalizedName.split(/\s+/).filter(w => w.length > 2)
            const allWords2 = existingNormalized.split(/\s+/).filter(w => w.length > 2)
            if (allWords1.length > 0 && allWords2.length > 0) {
              const sharedAll = allWords1.filter(w => allWords2.includes(w))
              similarity = Math.max(similarity, sharedAll.length / Math.max(allWords1.length, allWords2.length))
            }
            // Only merge if almost the same name (0.9+) and same price - prevents "Milk" + "Almond Milk" etc.
            if (similarity >= 0.9 && pricesMatch) {
              key = existingKey
              existing = existingItem
              console.log(`  🔗 Matched duplicate count item (≥0.9 similarity, same price): "${item.name}" ≈ "${existingItem.name}"`)
              break
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
            const existingQty = existing.quantity || 1
            const itemQty = item.quantity || 1
            existing.quantity = existingQty + itemQty
            
            // CRITICAL: Update lineTotal to sum of all instances
            // If both have lineTotal, sum them
            // If only one has lineTotal, multiply by quantity
            // If neither has lineTotal, use price * quantity
            const existingLineTotalBefore = existing.lineTotal
            const itemLineTotalBefore = item.lineTotal
            
            if (existing.lineTotal !== undefined && existing.lineTotal !== null) {
              if (item.lineTotal !== undefined && item.lineTotal !== null) {
                // Both have lineTotal - sum them
                existing.lineTotal = existing.lineTotal + item.lineTotal
                console.log(`  💰 Aggregating lineTotals: ${existingLineTotalBefore} + ${itemLineTotalBefore} = ${existing.lineTotal}`)
              } else {
                // Existing has lineTotal, item doesn't - need to calculate item's contribution
                // Use item's price * quantity
                const itemContribution = (item.price || 0) * itemQty
                existing.lineTotal = existing.lineTotal + itemContribution
                console.log(`  💰 Aggregating: ${existingLineTotalBefore} + (price ${item.price} × qty ${itemQty}) = ${existing.lineTotal}`)
              }
            } else if (item.lineTotal !== undefined && item.lineTotal !== null) {
              // Item has lineTotal, existing doesn't - calculate existing's contribution
              const existingContribution = (existing.price || 0) * existingQty
              existing.lineTotal = existingContribution + item.lineTotal
              console.log(`  💰 Aggregating: (price ${existing.price} × qty ${existingQty}) + ${itemLineTotalBefore} = ${existing.lineTotal}`)
            } else {
              // Neither has lineTotal - calculate from prices
              const existingContribution = (existing.price || 0) * existingQty
              const itemContribution = (item.price || 0) * itemQty
              existing.lineTotal = existingContribution + itemContribution
              console.log(`  💰 Aggregating: (price ${existing.price} × qty ${existingQty}) + (price ${item.price} × qty ${itemQty}) = ${existing.lineTotal}`)
            }
            
            // Update price to be the unit price (for display)
            // If we have lineTotal and quantity, unit price = lineTotal / quantity
            if (existing.lineTotal !== undefined && existing.lineTotal !== null && existing.quantity > 0) {
              const oldPrice = existing.price
              existing.price = existing.lineTotal / existing.quantity
              console.log(`  💰 Updated unit price: ${oldPrice} → ${existing.price.toFixed(2)} (lineTotal ${existing.lineTotal} / qty ${existing.quantity})`)
            } else {
              // Keep the existing price (should be unit price already)
              existing.price = existing.price || item.price || 0
            }
            
            console.log(`  ➕ Aggregated count: "${item.name}" → qty ${existing.quantity}, lineTotal ${existing.lineTotal?.toFixed(2) || 'N/A'}, price ${existing.price?.toFixed(2) || 'N/A'}`)
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

  /**
   * Calculate subtotal from items with proper handling of weight vs count items
   * Returns validation results with tolerance checking
   */
  private calculateSubtotal(items: ScannedItem[]): {
    calculatedSubtotal: number
    calculatedTotal: number
    passed: boolean
    diffs: { subtotalDiff: number | null; totalDiff: number | null }
  } {
    // Runtime guard: Warn if items array might contain duplicates
    const itemNames = new Map<string, number>()
    for (const item of items) {
      const normalizedName = this.normalizeItemName(item.name).toLowerCase()
      itemNames.set(normalizedName, (itemNames.get(normalizedName) || 0) + 1)
    }
    const duplicates = Array.from(itemNames.entries()).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      console.warn('⚠️ WARNING: calculateSubtotal called with items that may contain duplicates:', {
        duplicateNames: duplicates.map(([name, count]) => `${name} (${count}x)`),
        itemCount: items.length,
        uniqueItemCount: itemNames.size
      })
    }
    
    const calculatedSubtotal = items.reduce((sum, item) => {
      // CRITICAL: Always use lineTotal if available (for weight items and count items with explicit totals)
      // This prevents weight items from being calculated as unitPrice * quantity
      if (item.lineTotal !== undefined && item.lineTotal !== null) {
        // GUARD: For weight items, ensure lineTotal is NOT the weight
        const isWeightItem = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
        if (isWeightItem) {
          const weight = item.quantity || 0
          const weightDiff = Math.abs(item.lineTotal - weight)
          if (weightDiff < 0.01) {
            console.error(`❌ ERROR: weight-used-as-total in calculateSubtotal for "${item.name}"`)
            console.error(`  Weight: ${weight}, lineTotal: ${item.lineTotal}, unit: ${item.unit}`)
            console.error(`  This item should be marked needsReview - using lineTotal anyway but logging error`)
            // Still use it for now, but log the error
          }
        }
        return sum + item.lineTotal
      }
      // Fallback: use price * quantity (for count items without explicit lineTotal)
      const price = item.price || 0
      const quantity = item.quantity || 1
      return sum + (price * quantity)
    }, 0)
    
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const itemsWithLineTotal = items.filter(item => item.lineTotal !== undefined && item.lineTotal !== null).length
      console.log('💰 Subtotal calculation:', {
        itemCount: items.length,
        uniqueItemCount: itemNames.size,
        itemsWithLineTotal,
        calculatedSubtotal: Math.round(calculatedSubtotal * 100) / 100,
        breakdown: items.slice(0, 10).map(item => ({
          name: item.name.substring(0, 25),
          lineTotal: item.lineTotal,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          used: item.lineTotal ?? (item.price || 0) * (item.quantity || 1)
        }))
      })
    }
    
    return {
      calculatedSubtotal: Math.round(calculatedSubtotal * 100) / 100,
      calculatedTotal: calculatedSubtotal, // Will be updated with tax if available
      passed: false, // Will be set by caller
      diffs: { subtotalDiff: null, totalDiff: null }
    }
  }

  /**
   * Strict totals sanity checks
   * Returns true if totals are valid, false if invalid
   */
  private validateTotalsSanity(
    receiptSubtotal?: number,
    receiptTax?: number,
    receiptTotal?: number,
    items: ScannedItem[] = []
  ): { isValid: boolean; reason?: string } {
    if (!receiptSubtotal && !receiptTotal) {
      return { isValid: false, reason: 'Missing both subtotal and total' }
    }

    // Find largest item price
    const largestItemPrice = items.reduce((max, item) => {
      const itemTotal = item.lineTotal ?? (item.price ?? 0) * (item.quantity ?? 1)
      return Math.max(max, itemTotal)
    }, 0)

    // Check: receiptSubtotal should be >= largest item price
    if (receiptSubtotal && receiptSubtotal < largestItemPrice) {
      return { 
        isValid: false, 
        reason: `Subtotal (${receiptSubtotal}) is less than largest item price (${largestItemPrice})` 
      }
    }

    // Check: receiptTax should be < receiptSubtotal (tax is typically 5-15% of subtotal)
    if (receiptTax !== undefined && receiptSubtotal && receiptTax >= receiptSubtotal) {
      return { 
        isValid: false, 
        reason: `Tax (${receiptTax}) is greater than or equal to subtotal (${receiptSubtotal})` 
      }
    }

    // Check: receiptTotal should be >= receiptSubtotal
    if (receiptTotal && receiptSubtotal && receiptTotal < receiptSubtotal) {
      return { 
        isValid: false, 
        reason: `Total (${receiptTotal}) is less than subtotal (${receiptSubtotal})` 
      }
    }

    return { isValid: true }
  }

  /**
   * Repair items for totals mismatch using deterministic fixes
   * Only runs if diffs exceed tolerance
   */
  private repairItemsForTotalsMismatch(
    items: ScannedItem[],
    receiptSubtotal: number,
    receiptTotal: number,
    receiptTax?: number
  ): ScannedItem[] {
    const calc = this.calculateSubtotal(items)
    const subtotalDiff = Math.abs(calc.calculatedSubtotal - receiptSubtotal)
    
    // Only repair if difference exceeds tolerance
    if (subtotalDiff <= 0.05) {
      return items
    }
    
    console.log(`🔧 Attempting to repair items (subtotal diff: $${subtotalDiff.toFixed(2)})...`)
    
    const repaired = [...items]
    
    // Fix 1: Detect items where quantity looks like a unit price
    // (e.g., qty < 1 and price matches typical produce total)
    for (let i = 0; i < repaired.length; i++) {
      const item = repaired[i]
      const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
      
      // If it's a weight item but quantity < 1 and price looks like a line total
      if (isWeightBased && item.quantity < 1 && item.price && item.price > 0.5 && item.price < 20) {
        // Check if swapping makes sense: if unitPrice * quantity ≈ price, then quantity was actually the unit price
        if (item.unitPrice && Math.abs(item.unitPrice * item.quantity - item.price) < 0.1) {
          // This looks like a swap - but we need more context, skip for now
          continue
        }
      }
      
      // Fix 2: Re-parse money values on suspicious lines
      // If an item's price is very close to the difference, it might be misread
      const priceDiff = Math.abs((item.price || 0) - subtotalDiff)
      if (priceDiff < 0.10 && item.price && item.price > 0) {
        console.log(`  ⚠️ Suspicious price near difference: "${item.name}" $${item.price}`)
        // Could be misread, but we can't fix without OCR text
      }
    }
    
    // If still mismatched after repairs, return original items
    // (caller will set needsReview: true)
    const newCalc = this.calculateSubtotal(repaired)
    const newDiff = Math.abs(newCalc.calculatedSubtotal - receiptSubtotal)
    
    if (newDiff < subtotalDiff) {
      console.log(`  ✅ Repair improved difference: $${subtotalDiff.toFixed(2)} → $${newDiff.toFixed(2)}`)
      return repaired
    }
    
    console.log(`  ⚠️ Repair did not improve difference, keeping original items`)
    return items
  }

  // Scan receipt using OpenAI Vision API with validation and double-checking
  // Can accept either base64 string or image URI (for preprocessing)
  async scanReceipt(imageBase64OrUri: string): Promise<ScanResult> {
    // If it's a URI (starts with file:// or http://), preprocess it first
    let imageBase64: string
    if (imageBase64OrUri.startsWith('file://') || imageBase64OrUri.startsWith('http://') || imageBase64OrUri.startsWith('https://')) {
      // Preprocess image for OCR (resize, enhance quality)
      imageBase64 = await this.preprocessImageForOCR(imageBase64OrUri)
    } else {
      // Already base64, use as-is
      imageBase64 = imageBase64OrUri
    }
    try {
      const scanStart = Date.now()
      // OCR-first pipeline (fast + deterministic totals)
      const ocrText = await this.callReceiptOcr(imageBase64)
      const ocrFailed = !ocrText
      
      if (ocrText) {
        console.log('✅ Google Vision OCR text extracted, parsing totals and items...')
        const parsed = parseReceiptOcrText(ocrText)
        
        // Log totals extraction
        console.log('📊 Totals extracted from Google Vision OCR:', {
          receiptSubtotal: parsed.receiptSubtotal,
          receiptTax: parsed.receiptTax,
          receiptTaxRate: parsed.receiptTaxRate,
          receiptTotal: parsed.receiptTotal,
          itemCount: parsed.items.length,
          selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
          allParsedTotalsBlocks: parsed.allParsedTotalsBlocks?.length || 0
        })
        
        // Process if totals are present (items may be missing, that's OK - we'll mark needsReview)
        if (parsed.receiptTotal && parsed.receiptSubtotal && parsed.receiptTax !== undefined) {
          // If items are missing, still process but mark needsReview
          if (parsed.items.length === 0) {
            console.warn('⚠️ Totals extracted but no items found - marking needsReview=true')
            return {
              items: [],
              totalItems: 0,
              store: parsed.store,
              date: parsed.date,
              receiptTotal: parsed.receiptTotal,
              receiptSubtotal: parsed.receiptSubtotal,
              receiptTax: parsed.receiptTax,
              receiptTaxRate: parsed.receiptTaxRate,
              calculatedSubtotal: 0,
              calculatedTotal: 0,
              validationPassed: false,
              subtotalMismatch: true,
              totalMismatch: true,
              needsReview: true,
              rawText: ocrText,
              selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
              allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
            }
          }
          
          // Items are present - process normally
          const ocrItems = buildScannedItemsFromOcr(parsed.items)
          const aggregatedItems = this.aggregateReceiptItems(ocrItems)
          
          // Strict totals sanity checks
          const sanityCheck = this.validateTotalsSanity(
            parsed.receiptSubtotal,
            parsed.receiptTax,
            parsed.receiptTotal,
            aggregatedItems
          )
          
          // Aggregation safety: if subtotal > 100 and itemCount <= 2, flag as invalid
          const aggregationSafetyCheck = parsed.receiptSubtotal > 100 && aggregatedItems.length <= 2
          
          if (!sanityCheck.isValid || aggregationSafetyCheck) {
            console.warn('⚠️ Totals failed sanity check:', {
              reason: sanityCheck.reason,
              aggregationSafety: aggregationSafetyCheck,
              receiptSubtotal: parsed.receiptSubtotal,
              receiptTax: parsed.receiptTax,
              receiptTotal: parsed.receiptTotal,
              itemCount: aggregatedItems.length
            })
            
            return {
              items: aggregatedItems,
              totalItems: aggregatedItems.length,
              store: parsed.store,
              date: parsed.date,
              receiptTotal: parsed.receiptTotal,
              receiptSubtotal: parsed.receiptSubtotal,
              receiptTax: parsed.receiptTax,
              receiptTaxRate: parsed.receiptTaxRate,
              calculatedSubtotal: 0,
              calculatedTotal: 0,
              validationPassed: false,
              subtotalMismatch: true,
              totalMismatch: true,
              needsReview: true, // Force review on sanity check failure
              rawText: ocrText,
              selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
              allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
            }
          }
          
          // SINGLE SOURCE OF TRUTH: finalItems = aggregatedItems
          // All subtotal calculations must use ONLY finalItems, never raw items
          let finalItems = aggregatedItems

          // Remove discount/promo lines (Saved $, Cartwheel 15% $, etc.) — they are not products
          finalItems = finalItems.filter(item => !this.isDiscountOrPromoItem(item.name))

          // Merge duplicates by normalized name (sum quantity & lineTotal) instead of erroring
          const byNormalizedName = new Map<string, ScannedItem>()
          for (const item of finalItems) {
            const key = this.normalizeItemName(item.name).toLowerCase()
            const existing = byNormalizedName.get(key)
            if (!existing) {
              byNormalizedName.set(key, { ...item })
            } else {
              const q = (existing.quantity || 1) + (item.quantity || 1)
              const lt = (existing.lineTotal ?? (existing.price ?? 0) * (existing.quantity || 1)) + (item.lineTotal ?? (item.price ?? 0) * (item.quantity || 1))
              existing.quantity = q
              existing.lineTotal = lt
              if (existing.price != null && item.price != null && q > 0) {
                existing.price = lt / q
              }
            }
          }
          finalItems = Array.from(byNormalizedName.values())
          
          // Use new calculateSubtotal function - ONLY from finalItems (aggregated)
          const calc = this.calculateSubtotal(finalItems)
          const calculatedTotal = calc.calculatedSubtotal + (parsed.receiptTax || 0)
          
          // Calculate mismatches
          const subtotalDiff = Math.abs(parsed.receiptSubtotal - calc.calculatedSubtotal)
          const totalDiff = Math.abs(parsed.receiptTotal - calculatedTotal)
          
          const subtotalMismatch = subtotalDiff > 0.05
          const totalMismatch = totalDiff > 0.05
          
          // Validation: both must pass
          const validationPassed = !subtotalMismatch && !totalMismatch
          
          // Try repair if validation failed
          if (!validationPassed && subtotalMismatch) {
            finalItems = this.repairItemsForTotalsMismatch(
              aggregatedItems,
              parsed.receiptSubtotal,
              parsed.receiptTotal,
              parsed.receiptTax
            )
            // Recalculate after repair
            const repairedCalc = this.calculateSubtotal(finalItems)
            const repairedSubtotalDiff = Math.abs(parsed.receiptSubtotal - repairedCalc.calculatedSubtotal)
            const repairedTotalDiff = Math.abs(parsed.receiptTotal - (repairedCalc.calculatedSubtotal + (parsed.receiptTax || 0)))
            const finalSubtotalMismatch = repairedSubtotalDiff > 0.05
            const finalTotalMismatch = repairedTotalDiff > 0.05
            const finalValidationPassed = !finalSubtotalMismatch && !finalTotalMismatch
            
            console.log('🔧 Repair results:', {
              originalSubtotalDiff: subtotalDiff.toFixed(2),
              repairedSubtotalDiff: repairedSubtotalDiff.toFixed(2),
              originalTotalDiff: totalDiff.toFixed(2),
              repairedTotalDiff: repairedTotalDiff.toFixed(2),
              validationPassed: finalValidationPassed
            })
            
            return {
              items: finalItems,
              totalItems: finalItems.length,
              store: parsed.store,
              date: parsed.date,
              receiptTotal: parsed.receiptTotal,
              receiptSubtotal: parsed.receiptSubtotal,
              receiptTax: parsed.receiptTax,
              receiptTaxRate: parsed.receiptTaxRate,
              calculatedSubtotal: repairedCalc.calculatedSubtotal,
              calculatedTotal: repairedCalc.calculatedSubtotal + (parsed.receiptTax || 0),
              validationPassed: finalValidationPassed,
              subtotalMismatch: finalSubtotalMismatch,
              totalMismatch: finalTotalMismatch,
              needsReview: !finalValidationPassed,
              rawText: ocrText,
              selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
              allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
            }
          }

          // Final check: Ensure no duplicates in finalItems before returning
          const finalItemNames = new Map<string, { count: number; items: ScannedItem[] }>()
          for (const item of finalItems) {
            const normalizedName = this.normalizeItemName(item.name).toLowerCase()
            if (!finalItemNames.has(normalizedName)) {
              finalItemNames.set(normalizedName, { count: 0, items: [] })
            }
            const entry = finalItemNames.get(normalizedName)!
            entry.count++
            entry.items.push(item)
          }
          
          const finalDuplicates = Array.from(finalItemNames.entries()).filter(([_, data]) => data.count > 1)
          if (finalDuplicates.length > 0) {
            console.error('❌ ERROR: Duplicate items in finalItems before return:', finalDuplicates.map(([name, data]) => ({
              name,
              count: data.count,
              items: data.items.map(i => ({ name: i.name, quantity: i.quantity, lineTotal: i.lineTotal }))
            })))
            // Re-aggregate to fix duplicates
            finalItems = this.aggregateReceiptItems(finalItems)
            // Recalculate with fixed items
            const fixedCalc = this.calculateSubtotal(finalItems)
            const fixedCalculatedTotal = fixedCalc.calculatedSubtotal + (parsed.receiptTax || 0)
            const fixedSubtotalDiff = Math.abs(parsed.receiptSubtotal - fixedCalc.calculatedSubtotal)
            const fixedTotalDiff = Math.abs(parsed.receiptTotal - fixedCalculatedTotal)
            console.warn('⚠️ Re-aggregated items to fix duplicates:', {
              beforeCount: finalItemNames.size + finalDuplicates.reduce((sum, [_, data]) => sum + data.count - 1, 0),
              afterCount: finalItems.length,
              newSubtotal: fixedCalc.calculatedSubtotal,
              newSubtotalDiff: fixedSubtotalDiff.toFixed(2)
            })
            // Use fixed values
            const fixedSubtotalMismatch = fixedSubtotalDiff > 0.05
            const fixedTotalMismatch = fixedTotalDiff > 0.05
            const fixedValidationPassed = !fixedSubtotalMismatch && !fixedTotalMismatch
            
            return {
              items: finalItems,
              totalItems: finalItems.length,
              store: parsed.store,
              date: parsed.date,
              receiptTotal: parsed.receiptTotal,
              receiptSubtotal: parsed.receiptSubtotal,
              receiptTax: parsed.receiptTax,
              receiptTaxRate: parsed.receiptTaxRate,
              calculatedSubtotal: fixedCalc.calculatedSubtotal,
              calculatedTotal: fixedCalculatedTotal,
              validationPassed: fixedValidationPassed,
              subtotalMismatch: fixedSubtotalMismatch,
              totalMismatch: fixedTotalMismatch,
              needsReview: !fixedValidationPassed || !parsed.receiptTotal || !parsed.receiptSubtotal,
              rawText: ocrText,
              selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
              allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
            }
          }

          console.log('✅ Google Vision OCR receipt scan complete:', {
            ocrStatus: 'SUCCESS',
            provider: 'google_vision',
            itemCount: finalItems.length,
            uniqueItemCount: finalItemNames.size,
            receiptSubtotal: parsed.receiptSubtotal,
            receiptTax: parsed.receiptTax,
            receiptTotal: parsed.receiptTotal,
            calculatedSubtotal: calc.calculatedSubtotal,
            calculatedTotal,
            subtotalDiff: subtotalDiff.toFixed(2),
            totalDiff: totalDiff.toFixed(2),
            subtotalMismatch,
            totalMismatch,
            validationPassed,
            selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
            allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
          })

          return {
            items: finalItems,
            totalItems: finalItems.length,
            store: parsed.store,
            date: parsed.date,
            receiptTotal: parsed.receiptTotal,
            receiptSubtotal: parsed.receiptSubtotal,
            receiptTax: parsed.receiptTax,
            receiptTaxRate: parsed.receiptTaxRate,
            calculatedSubtotal: calc.calculatedSubtotal,
            calculatedTotal,
            validationPassed,
            subtotalMismatch,
            totalMismatch,
            needsReview: !validationPassed || !parsed.receiptTotal || !parsed.receiptSubtotal, // needsReview if totals missing
            rawText: ocrText,
            selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
            allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
          }
        } else {
          // OCR succeeded but totals are missing - mark needsReview=true but keep OCR text
          // This happens when keywords aren't found in bottom section
          console.log('⚠️ Google Vision OCR succeeded but totals missing - needsReview=true, keeping OCR text for debugging')
          console.log('  Totals status:', {
            receiptSubtotal: parsed.receiptSubtotal,
            receiptTax: parsed.receiptTax,
            receiptTotal: parsed.receiptTotal,
            itemCount: parsed.items.length
          })
          return {
            items: buildScannedItemsFromOcr(parsed.items),
            totalItems: parsed.items.length,
            store: parsed.store,
            date: parsed.date,
            receiptSubtotal: parsed.receiptSubtotal,
            receiptTax: parsed.receiptTax,
            receiptTotal: parsed.receiptTotal,
            receiptTaxRate: parsed.receiptTaxRate,
            calculatedSubtotal: 0,
            calculatedTotal: 0,
            validationPassed: false,
            subtotalMismatch: true,
            totalMismatch: true,
            needsReview: true, // CRITICAL: needsReview=true when totals missing
            rawText: ocrText, // Keep OCR text for debugging
            selectedTotalsBlockIndex: parsed.selectedTotalsBlockIndex,
            allParsedTotalsBlocks: parsed.allParsedTotalsBlocks
          }
        }
      }

      // If OCR isn't available or failed, fall back to LLM but mark needsReview
      // ocrFailed already declared at line 947 - use existing variable
      if (ocrFailed) {
        console.log('⚠️ Google Vision OCR failed or unavailable, falling back to LLM scan (will mark needsReview=true)')
        // Continue to LLM fallback below - will set needsReview: true
      } else {
        // OCR succeeded but parser might have failed, still fall through to LLM
          console.log('⚠️ Google Vision OCR succeeded but totals missing, marking needsReview=true and falling back to LLM scan')
      }

      // Preprocess image for better LLM extraction (resize to optimal size)
      const preprocessedImageBase64 = await this.preprocessImageForLLM(imageBase64)
      
      // Store preprocessed image for verification pass
      const llmImageBase64 = preprocessedImageBase64
      
      // First pass: Extract all items and receipt metadata (LLM fallback)
      // Use 120s timeout - receipt scanning can take a while for large receipts
      const firstPassResult = await this.performReceiptScan(llmImageBase64, 'first', {
        timeoutMs: 120000,
        max_tokens: 3000, // Increased for large receipts like Costco
        ocrFailed // Pass flag to prompt
      })
      
      console.log('📊 LLM extraction results:', {
        ocrStatus: ocrFailed ? 'FAILED' : 'SUCCESS',
        itemCountPreFilter: firstPassResult.items.length,
        extractedItems: firstPassResult.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }))
      })
      
      // STRICT EXECUTION GATE: If OCR failed, return immediately after item extraction
      // Do NOT run validation, reconciliation, repair, or totals parsing
      // BUT: Extract totals from LLM if available (for display and budget tracking)
      if (ocrFailed) {
        console.log('⚠️ Google Vision OCR failed → skipping validation/reconciliation/repair (LLM-only mode, needsReview=true)')
        
        // Force quantity=1 for all items in LLM-only mode
        // LLM extracts line totals, not weights, so quantities should be 1
        const itemsWithFixedQuantities = firstPassResult.items.map(item => ({
          ...item,
          quantity: 1, // CRITICAL: Force quantity=1 in LLM-only mode
          unit: item.unit || 'pieces' // Ensure unit is set
        }))
        
        // Extract totals from LLM result if available (LLM prompt asks for them)
        const llmReceiptSubtotal = typeof firstPassResult.receiptSubtotal === 'number' ? firstPassResult.receiptSubtotal : undefined
        const llmReceiptTax = typeof firstPassResult.receiptTax === 'number' ? firstPassResult.receiptTax : undefined
        const llmReceiptTotal = typeof firstPassResult.receiptTotal === 'number' ? firstPassResult.receiptTotal : undefined
        const llmReceiptTaxRate = typeof firstPassResult.receiptTaxRate === 'number' ? firstPassResult.receiptTaxRate : undefined
        
        // Calculate subtotal from items
        const calc = this.calculateSubtotal(itemsWithFixedQuantities)
        const calculatedSubtotal = calc.calculatedSubtotal
        const calculatedTotal = calculatedSubtotal + (llmReceiptTax || 0)
        
        // Check if LLM totals match calculated totals (for validation, but still mark needsReview)
        const subtotalMismatch = llmReceiptSubtotal ? Math.abs(calculatedSubtotal - llmReceiptSubtotal) > 0.05 : true
        const totalMismatch = llmReceiptTotal ? Math.abs(calculatedTotal - llmReceiptTotal) > 0.05 : true
        
        // Use LLM totals if available, otherwise use calculated
        const finalReceiptSubtotal = llmReceiptSubtotal || calculatedSubtotal
        const finalReceiptTax = llmReceiptTax || 0
        const finalReceiptTotal = llmReceiptTotal || calculatedTotal
        
        console.log('📊 LLM totals extraction:', {
          llmExtracted: {
            receiptSubtotal: llmReceiptSubtotal,
            receiptTax: llmReceiptTax,
            receiptTotal: llmReceiptTotal,
            receiptTaxRate: llmReceiptTaxRate
          },
          calculated: {
            calculatedSubtotal,
            calculatedTotal
          },
          final: {
            receiptSubtotal: finalReceiptSubtotal,
            receiptTax: finalReceiptTax,
            receiptTotal: finalReceiptTotal
          },
          subtotalMismatch,
          totalMismatch
        })
        
        // Return with LLM-extracted totals (if available) for display and budget tracking
        // Still mark needsReview=true because OCR failed
        const llmOnlyResult: ScanResult = {
          items: itemsWithFixedQuantities,
          totalItems: itemsWithFixedQuantities.length,
          store: firstPassResult.store,
          date: firstPassResult.date,
          // Use LLM-extracted totals if available, otherwise calculated
          receiptSubtotal: finalReceiptSubtotal,
          receiptTax: finalReceiptTax,
          receiptTotal: finalReceiptTotal,
          receiptTaxRate: llmReceiptTaxRate,
          calculatedSubtotal,
          calculatedTotal,
          subtotalMismatch,
          totalMismatch,
          validationPassed: !subtotalMismatch && !totalMismatch && llmReceiptSubtotal && llmReceiptTotal,
          needsReview: true, // HARD RULE: Always true when OCR failed
          rawText: firstPassResult.rawText
        }
        
        console.log('✅ LLM-only receipt scan complete:', {
          ocrStatus: 'FAILED',
          itemCount: llmOnlyResult.items.length,
          receiptTotal: llmOnlyResult.receiptTotal,
          receiptSubtotal: llmOnlyResult.receiptSubtotal,
          calculatedTotal: llmOnlyResult.calculatedTotal,
          calculatedSubtotal: llmOnlyResult.calculatedSubtotal,
          needsReview: llmOnlyResult.needsReview,
          validationPassed: llmOnlyResult.validationPassed,
          totalsExtracted: !!(llmReceiptSubtotal || llmReceiptTotal),
          quantitiesFixed: true
        })
        
        return llmOnlyResult
      }
      
      // OCR succeeded - proceed with normal validation/reconciliation flow
      // Verify and validate totals (only run when OCR succeeded)
      const verifiedResult = await this.verifyReceiptScan(preprocessedImageBase64, firstPassResult, ocrText, ocrFailed)
      
      // Apply safety flags to ensure needsReview is correct
      verifiedResult.needsReview = this.applySafetyFlags({
        ocrFailed: false,
        validationPassed: verifiedResult.validationPassed || false,
        receiptTotal: verifiedResult.receiptTotal,
        existingNeedsReview: verifiedResult.needsReview || false
      })
      
      // Final logging - single source of truth
      console.log('✅ Receipt scan complete (FINAL RESULT):', {
        ocrStatus: 'SUCCESS',
        itemCount: verifiedResult.items.length,
        receiptSubtotal: verifiedResult.receiptSubtotal,
        receiptTax: verifiedResult.receiptTax,
        receiptTotal: verifiedResult.receiptTotal,
        needsReview: verifiedResult.needsReview,
        validationPassed: verifiedResult.validationPassed,
        subtotalMismatch: verifiedResult.subtotalMismatch,
        totalMismatch: verifiedResult.totalMismatch
      })
      
      // Return the verified result - this is the SINGLE SOURCE OF TRUTH
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
      const userPrompt = `The receipt total is $${expectedTotal.toFixed(2)} but only $${currentTotal.toFixed(2)} was found. You MUST find the missing items or correct the prices. Extract ALL items with correct prices.`
      
      const data = await this.callChatCompletion(
        [
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
        { model: 'gpt-4o', max_tokens: 1400, temperature: 0.1, timeoutMs: 20000 }
      )
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
        
        // CRITICAL: Re-classify meat items if LLM misclassified them
        let category = item.category || 'Other'
        const itemNameLower = expandedName.toLowerCase()
        
        // Strict meat detection - override LLM classification if needed
        const meatTerms = ['meat', 'beef', 'chicken', 'pork', 'fish', 'steak', 'boneless', 'strip', 'new york', 
                          'sirloin', 'ribeye', 'filet', 'ground beef', 'ground pork', 'ground turkey', 
                          'chicken breast', 'chicken thighs', 'pork chops', 'lamb', 'veal', 'salmon', 'tuna', 
                          'shrimp', 'crab', 'lobster', 'turkey', 'bacon', 'ham', 'sausage']
        
        // If item name contains meat terms and was classified as Pantry Staples, fix it
        if (meatTerms.some(term => itemNameLower.includes(term)) && 
            (category.toLowerCase().includes('pantry') || category.toLowerCase().includes('staples'))) {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood"`)
          category = 'Meat, Poultry & Seafood'
        }
        
        // Use detectCategoryFromName as final authority for meat items
        const detectedCategory = detectCategoryFromName(expandedName)
        if (detectedCategory === 'Meat, Poultry & Seafood' && category !== 'Meat, Poultry & Seafood') {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood" (detected)`)
          category = 'Meat, Poultry & Seafood'
        }
        
        const normalizedCategory = normalizeCategory(category || detectedCategory || 'Other')
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
  private async performReceiptScan(
    imageBase64: string,
    pass: 'first' | 'verification',
    overrides: { max_tokens?: number; timeoutMs?: number; ocrFailed?: boolean } = {}
  ): Promise<ScanResult> {
    try {
      const isVerification = pass === 'verification'
      const ocrFailed = overrides.ocrFailed || false
      
      const systemPrompt = isVerification 
      ? `You are verifying a receipt scan. Check if ANY items were missed. Look for:
- Items in small print
- Items at the top or bottom edges
- Items that might have been skipped
- Any line items that represent products

Return ONLY the items that were MISSED in the previous scan. If no items were missed, return empty items array.`
      : `You are a FAST and ACCURATE grocery receipt analyzer.

🚨 CRITICAL MISSION: Extract EVERY item between "Bottom of Basket" and the first "SUBTOTAL" line.

RULES:
1. Extract ALL line items with EXACT prices from receipt
2. Do NOT stop early after finding one match - scan the ENTIRE receipt
3. Extract receiptSubtotal (before tax), receiptTax, receiptTotal (final paid amount)
4. Sum of all item line totals MUST EQUAL receiptSubtotal
5. receiptTotal = receiptSubtotal + receiptTax (this goes to user's budget)
6. SKIP discount lines (RABAIS, DISCOUNT, COUPON, REBATE, EXECUTIVE REBATE)
7. Do NOT treat "Executive Rebate" section as items

ITEM EXTRACTION GUIDELINES:
- Costco receipts: Items may have leading tax codes (E, F, T) or SKU numbers - EXTRACT THEM
- Items may have short names - EXTRACT THEM if they have a price
- Items may end with "A" suffix - EXTRACT THEM
- A valid item line contains a money amount (price) at the right side
- Keep items with names >= 3 characters after cleaning

PRICE EXTRACTION:
- COUNT items (eggs, cans): price = UNIT PRICE × quantity = line total
- WEIGHT items (kg/lb produce): price = LINE TOTAL (already calculated for that weight)
- If you see "2 @ $3.99" → price is 3.99, quantity is 2, line total is 7.98

⚠️ VALIDATION: Add up ALL your item line totals. It MUST equal receiptSubtotal.
If it doesn't match, you're MISSING ITEMS - go back and find them!

⚠️ IMPORTANT: Return an ARRAY of items, never a single object. Extract ALL items you can see.`

    const userPrompt = isVerification
      ? `Review this receipt image carefully. Find ANY items that might have been missed in a previous scan. Return only the MISSED items. If nothing was missed, return empty items array. DO NOT extract discount lines (RABAIS, DISCOUNT, COUPON, REBATE) as items.`
      : `Extract ALL items from this receipt with their EXACT prices.

CRITICAL INSTRUCTIONS:
1. Scan from "Bottom of Basket" (or top of item list) to the first "SUBTOTAL" line
2. Extract EVERY line item that has a price - do not stop after finding one item
3. Extract receiptSubtotal (before tax), receiptTax, and receiptTotal
4. Sum of item prices MUST equal receiptSubtotal
5. DO NOT include tax in item prices
6. Expand abbreviations to full English names
7. Skip discount/rebate lines (REBATE, EXECUTIVE REBATE, DISCOUNT, COUPON)
8. Items with tax codes (E, F, T) or SKU numbers are VALID - extract them
9. Return an ARRAY of items - never return just one item

If you extract fewer than 5 items but the receipt clearly has more lines, you are missing items. Go back and extract ALL items.`

      const data = await this.callChatCompletion(
        [
          {
            role: 'system',
            content: `${systemPrompt}

OUTPUT FORMAT - Return ONLY valid JSON (items MUST be an array):
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "receiptSubtotal": 91.09,
  "receiptTax": 8.91,
  "receiptTotal": 100.00,
  "items": [
    {"name": "Product Name", "emoji": "🍅", "quantity": 1, "unit": "pieces", "category": "Produce", "location": "fridge", "price": 5.99},
    {"name": "Another Product", "emoji": "🥛", "quantity": 2, "unit": "pieces", "category": "Dairy & Eggs", "location": "fridge", "price": 3.49}
  ]
}

CRITICAL: 
- "items" MUST be an array with multiple items
- Do NOT return a single object or stop after one item
- Extract ALL items between item list start and SUBTOTAL line
- If receipt has many items, extract ALL of them

CRITICAL VALIDATION:
- Sum of (price × quantity) for count items + price for weight items = receiptSubtotal
- receiptTotal = receiptSubtotal + receiptTax (this is what user paid)
- If your sum doesn't match receiptSubtotal, you're MISSING ITEMS!

CATEGORIES (STRICT CLASSIFICATION RULES):
- Meat, Poultry & Seafood: ANY item containing meat, poultry, or seafood terms (beef, chicken, pork, fish, steak, boneless, strip, new york, sirloin, ribeye, filet, ground beef, ground pork, ground turkey, chicken breast, chicken thighs, pork chops, lamb, veal, salmon, tuna, shrimp, crab, lobster, etc.). Items like "boneless meat", "new york strip", "chicken breast", "ground beef" MUST be classified as "Meat, Poultry & Seafood", NEVER as "Pantry Staples & Essentials".
- Produce: Fresh fruits and vegetables only
- Dairy & Eggs: Milk, cheese, butter, eggs, yogurt, cream
- Grains, Bread & Pasta: Bread, pasta, rice, tortillas, cereal
- Pantry Staples & Essentials: Canned goods, packaged dry goods, spices, oils, baking supplies. NEVER classify meat items here.
- Condiments, Sauces & Spreads: Sauces, condiments, spreads
- Snacks, Sweets & Desserts: Snacks, candy, desserts
- Beverages: Drinks, juices, sodas
- Plant-Based Proteins & Legumes: Tofu, beans, lentils, plant-based proteins
- Non-Food / Misc: Non-food items

CRITICAL: If an item name contains ANY meat-related term (meat, beef, chicken, pork, steak, boneless, strip, new york, sirloin, etc.), it MUST be classified as "Meat, Poultry & Seafood", NOT "Pantry Staples & Essentials".

LOCATIONS: fridge, freezer, pantry`
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
        {
          model: 'gpt-4o',
          max_tokens: isVerification ? 600 : (overrides.max_tokens || 2000),
          temperature: 0.1,
          timeoutMs: isVerification ? 20000 : (overrides.timeoutMs || 120000)
        }
      )
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
        console.error('Failed to parse OpenAI response:', content.substring(0, 500))
        console.error('Parse error:', parseError)

        // Try to fix truncated JSON by detecting incomplete structure
        if (content.includes('"items"') && content.includes('[')) {
          const itemsMatch = content.match(/"items"\s*:\s*\[([\s\S]*)/)
          if (itemsMatch) {
            const itemsSection = itemsMatch[1]
            // Count how many items we have
            const itemCount = (itemsSection.match(/^\s*\{/gm) || []).length
            // Try to close the JSON properly
            let fixedContent = content.trim()
            // Remove trailing commas
            fixedContent = fixedContent.replace(/,\s*$/, '')
            // Close arrays/objects that might be open
            const openBraces = (fixedContent.match(/\{/g) || []).length
            const closeBraces = (fixedContent.match(/\}/g) || []).length
            const openBrackets = (fixedContent.match(/\[/g) || []).length
            const closeBrackets = (fixedContent.match(/\]/g) || []).length
            
            // Add missing closing brackets/braces
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              fixedContent += '\n]'
            }
            for (let i = 0; i < openBraces - closeBraces; i++) {
              fixedContent += '\n}'
            }
            
            try {
              result = JSON.parse(fixedContent)
              console.log(`✅ Fixed truncated JSON: recovered ${itemCount} items`)
            } catch (fixError) {
              // Fix failed, continue to retry
            }
          }
        }

        // Retry once with a compact response shape to avoid truncation
        if (!result) {
          try {
            const compactPrompt = `Extract receipt items and totals.
Return ONLY JSON:
{
  "store": "Store Name",
  "date": "YYYY-MM-DD",
  "receiptSubtotal": 0.00,
  "receiptTax": 0.00,
  "receiptTotal": 0.00,
  "items": [
    { "name": "Item Name", "quantity": 1, "unit": "pieces", "price": 1.23 }
  ]
}
Rules:
- Use line total for weight-based items (kg/lb).
- Do NOT include discount lines as items.
- Do NOT add extra fields.`

            const compactData = await this.callChatCompletion(
              [
                { role: 'system', content: compactPrompt },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Extract items and totals from this receipt image.' },
                    {
                      type: 'image_url',
                      image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' }
                    }
                  ]
                }
              ],
              { model: 'gpt-4o', max_tokens: 1200, temperature: 0.0, timeoutMs: 40000 }
            )

            let compactContent = compactData.choices[0]?.message?.content || '{}'
            compactContent = compactContent.trim()
            if (compactContent.startsWith('```json')) {
              compactContent = compactContent.replace(/```json\n?/, '').replace(/\n?```$/, '')
            } else if (compactContent.startsWith('```')) {
              compactContent = compactContent.replace(/```\n?/, '').replace(/\n?```$/, '')
            }
            const compactMatch = compactContent.match(/\{[\s\S]*\}/)
            if (compactMatch) {
              compactContent = compactMatch[0]
            }
            result = JSON.parse(compactContent)
          } catch (compactError) {
            console.error('Compact receipt retry failed:', compactError)
            // Return empty result if parsing fails
            return {
              items: [],
              totalItems: 0,
              store: 'Unknown',
              date: new Date().toISOString().split('T')[0],
              rawText: content,
            }
          }
        }
      }
      
      // Normalize categories and ensure proper emojis using unified formatter
      let processedItems = (result.items || []).map((item: any) => {
        // Handle case where LLM returns single object instead of array
        if (!Array.isArray(result.items) && typeof result.items === 'object' && result.items.name) {
          // LLM returned single item object - convert to array
          console.warn('⚠️ LLM returned single item object instead of array, converting...')
          result.items = [result.items]
        }
        
        // Validate item has required fields
        if (!item.name || typeof item.name !== 'string') {
          console.warn('Skipping invalid item:', item)
          return null
        }
        
        // Expand abbreviated names to full English names
        let expandedName = this.expandItemName(item.name.trim())
        
        // Validate name length (keep items with >= 3 chars after cleaning)
        if (expandedName.length < 3) {
          console.warn(`Skipping item with name too short: "${expandedName}"`)
          return null
        }
        
        // CRITICAL: Re-classify meat items if LLM misclassified them
        let category = item.category || 'Other'
        const itemNameLower = expandedName.toLowerCase()
        
        // Strict meat detection - override LLM classification if needed
        const meatTerms = ['meat', 'beef', 'chicken', 'pork', 'fish', 'steak', 'boneless', 'strip', 'new york', 
                          'sirloin', 'ribeye', 'filet', 'ground beef', 'ground pork', 'ground turkey', 
                          'chicken breast', 'chicken thighs', 'pork chops', 'lamb', 'veal', 'salmon', 'tuna', 
                          'shrimp', 'crab', 'lobster', 'turkey', 'bacon', 'ham', 'sausage']
        
        // If item name contains meat terms and was classified as Pantry Staples, fix it
        if (meatTerms.some(term => itemNameLower.includes(term)) && 
            (category.toLowerCase().includes('pantry') || category.toLowerCase().includes('staples'))) {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood"`)
          category = 'Meat, Poultry & Seafood'
        }
        
        // Use detectCategoryFromName as final authority for meat items
        const detectedCategory = detectCategoryFromName(expandedName)
        if (detectedCategory === 'Meat, Poultry & Seafood' && category !== 'Meat, Poultry & Seafood') {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood" (detected)`)
          category = 'Meat, Poultry & Seafood'
        }
        
        const normalizedCategory = normalizeCategory(category || detectedCategory || 'Other')
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
        // CRITICAL: In LLM-only mode (OCR failed), force quantity=1
        // LLM extracts line totals, not weights, so quantities should always be 1
        let quantity = typeof item.quantity === 'number' && item.quantity > 0 
          ? item.quantity 
          : 1
        
        // If OCR failed, force quantity=1 (no weight parsing in LLM-only mode)
        if (ocrFailed) {
          quantity = 1
        }
        
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
      
      // Guardrail: If fewer than 5 items extracted but receipt likely has more, run second pass
      const itemCountPreFilter = processedItems.length
      if (!isVerification && itemCountPreFilter < 5 && !overrides.ocrFailed) {
        console.log(`⚠️ Only ${itemCountPreFilter} items extracted - running second pass to find more items...`)
        
        // Second pass with focus on middle area
        const secondPassPrompt = `This receipt likely has more than ${itemCountPreFilter} items. 
Focus on the MIDDLE section of the receipt (between top and SUBTOTAL line).
Extract ALL items you can see in that area. Return an array of items.`
        
        try {
          const secondPassData = await this.callChatCompletion(
            [
              {
                role: 'system',
                content: `Extract ALL items from the MIDDLE section of this receipt.
Return ONLY JSON with items array:
{
  "items": [
    {"name": "Item Name", "price": 1.23, "quantity": 1, "unit": "pieces", "category": "Produce", "location": "pantry", "emoji": "🍎"}
  ]
}

STRICT CATEGORY RULES:
- Meat, Poultry & Seafood: ANY item with meat/poultry/seafood terms (beef, chicken, pork, fish, steak, boneless, strip, new york, sirloin, ribeye, filet, ground beef, chicken breast, pork chops, lamb, veal, salmon, tuna, shrimp, crab, lobster, etc.). "boneless meat", "new york strip", "chicken breast" MUST be "Meat, Poultry & Seafood", NEVER "Pantry Staples".
- Produce: Fresh fruits and vegetables only
- Dairy & Eggs: Milk, cheese, butter, eggs, yogurt
- Grains, Bread & Pasta: Bread, pasta, rice, tortillas
- Pantry Staples & Essentials: Canned goods, packaged items, spices, oils. NEVER meat items.
- Other categories as appropriate

Extract ALL items - do not stop after finding a few.`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: secondPassPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' }
                  }
                ]
              }
            ],
            { model: 'gpt-4o', max_tokens: 2000, temperature: 0.1, timeoutMs: 40000 }
          )
          
          let secondPassContent = secondPassData.choices[0]?.message?.content || '{}'
          secondPassContent = secondPassContent.trim()
          if (secondPassContent.startsWith('```json')) {
            secondPassContent = secondPassContent.replace(/```json\n?/, '').replace(/\n?```$/, '')
          } else if (secondPassContent.startsWith('```')) {
            secondPassContent = secondPassContent.replace(/```\n?/, '').replace(/\n?```$/, '')
          }
          const secondPassMatch = secondPassContent.match(/\{[\s\S]*\}/)
          if (secondPassMatch) {
            secondPassContent = secondPassMatch[0]
          }
          
          const secondPassResult = JSON.parse(secondPassContent)
          const secondPassItems = (secondPassResult.items || []).map((item: any) => {
            if (!item.name || typeof item.name !== 'string' || item.name.length < 3) return null
            const expandedName = this.expandItemName(item.name.trim())
            // CRITICAL: Re-classify meat items if LLM misclassified them
            let category = item.category || 'Other'
            const itemNameLower = expandedName.toLowerCase()
            
            // Strict meat detection - override LLM classification if needed
            const meatTerms = ['meat', 'beef', 'chicken', 'pork', 'fish', 'steak', 'boneless', 'strip', 'new york', 
                              'sirloin', 'ribeye', 'filet', 'ground beef', 'ground pork', 'ground turkey', 
                              'chicken breast', 'chicken thighs', 'pork chops', 'lamb', 'veal', 'salmon', 'tuna', 
                              'shrimp', 'crab', 'lobster', 'turkey', 'bacon', 'ham', 'sausage']
            
            // If item name contains meat terms and was classified as Pantry Staples, fix it
            if (meatTerms.some(term => itemNameLower.includes(term)) && 
                (category.toLowerCase().includes('pantry') || category.toLowerCase().includes('staples'))) {
              console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood"`)
              category = 'Meat, Poultry & Seafood'
            }
            
            // Use detectCategoryFromName as final authority for meat items
            const detectedCategory = detectCategoryFromName(expandedName)
            if (detectedCategory === 'Meat, Poultry & Seafood' && category !== 'Meat, Poultry & Seafood') {
              console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood" (detected)`)
              category = 'Meat, Poultry & Seafood'
            }
            
            const normalizedCategory = normalizeCategory(category || detectedCategory || 'Other')
            const properEmoji = getItemEmoji(expandedName, normalizedCategory)
            let price = item.price
            if (price !== undefined && price !== null) {
              price = typeof price === 'number' ? price : parseFloat(price)
              if (isNaN(price) || price < 0) price = undefined
            }
            // CRITICAL: In LLM-only mode (OCR failed), force quantity=1
            let quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
            if (ocrFailed) {
              quantity = 1 // Force quantity=1 in LLM-only mode
            }
            return {
              name: expandedName,
              emoji: properEmoji,
              quantity,
              unit: item.unit || 'pieces',
              category: normalizedCategory,
              location: item.location || 'pantry',
              price,
            }
          }).filter((item): item is ScannedItem => item !== null)
          
          // Merge second pass items (avoid duplicates)
          const existingNames = new Set(processedItems.map(i => i.name.toLowerCase()))
          const newItems = secondPassItems.filter(item => !existingNames.has(item.name.toLowerCase()))
          processedItems = [...processedItems, ...newItems]
          
          console.log(`✅ Second pass found ${newItems.length} additional items (total: ${processedItems.length})`)
        } catch (secondPassError) {
          console.warn('Second pass failed:', secondPassError)
        }
      }
      
      console.log(`📦 Item extraction: ${itemCountPreFilter} → ${processedItems.length} items (post-filter)`)
      
      const bulkAdjustedItems = this.applyBulkPackIntelligence(processedItems, result.store)
      
      // Aggregate items by quantity (for receipts, repeated items = quantity, not duplicates)
      const aggregatedItems = this.aggregateReceiptItems(bulkAdjustedItems)
      
      // Parse subtotal and tax from response
      const receiptSubtotal = typeof result.receiptSubtotal === 'number' ? result.receiptSubtotal : undefined
      const receiptTax = typeof result.receiptTax === 'number' ? result.receiptTax : undefined
      
      return {
        items: aggregatedItems,
        totalItems: aggregatedItems.length,
        store: result.store,
        date: result.date,
        receiptTotal: result.receiptTotal,
        receiptSubtotal,
        receiptTax,
        rawText: content,
      }

    } catch (error) {
      console.error(`Error in ${pass} pass receipt scan:`, error)
      // If the first pass fails, bubble up so UI can show the real error
      if (pass === 'first') {
        throw error
      }
      // Verification pass should never break the flow
      return {
        items: [],
        totalItems: 0,
        store: 'Unknown',
        date: new Date().toISOString().split('T')[0],
        rawText: '',
      }
    }
  }

  private estimateTaxDifference(receiptTotal?: number, calculatedTotal?: number): number | null {
    if (!receiptTotal || !calculatedTotal) return null
    const diff = receiptTotal - calculatedTotal
    if (diff <= 0.01) return null
    const ratio = diff / receiptTotal

    // Typical sales tax/fees range: 2% - 15% of total
    if (ratio < 0.02 || ratio > 0.15) return null

    return diff
  }

  private async scanReceiptTotals(imageBase64: string): Promise<{
    receiptTotal?: number
    receiptSubtotal?: number
    receiptTax?: number
  }> {
    const normalizeMoney = (value: any) => {
      const num = typeof value === 'number' ? value : parseFloat(value)
      if (Number.isNaN(num)) return undefined
      return Math.round(num * 100) / 100
    }

    const totalsPrompt = `Extract ONLY receipt totals. Return JSON:
{"receiptSubtotal": 75.57, "receiptTax": 14.52, "receiptTotal": 90.09}
- receiptSubtotal = sum of items (before tax)
- receiptTax = tax amount
- receiptTotal = final amount paid`

    try {
      const data = await this.callChatCompletion(
        [
          {
            role: 'system',
            content: totalsPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract totals.' },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }
        ],
        { model: 'gpt-4o', max_tokens: 150, temperature: 0.0, timeoutMs: 15000 }
      )

      let content = data.choices[0]?.message?.content || '{}'
      content = content.trim()
      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/\n?```$/, '')
      }

      const parsed = JSON.parse(content)
      return {
        receiptTotal: normalizeMoney(parsed.receiptTotal),
        receiptSubtotal: normalizeMoney(parsed.receiptSubtotal),
        receiptTax: normalizeMoney(parsed.receiptTax)
      }
    } catch (error) {
      console.warn('Failed to extract receipt totals:', error)
      return {}
    }
  }

  private async reconcileReceiptItems(
    imageBase64: string,
    currentItems: ScannedItem[],
    targetSubtotal: number
  ): Promise<ScannedItem[] | null> {
    const reconcilePrompt = `You are reconciling a grocery receipt scan.
Your job: ADD any missing items from the receipt. Do NOT remove items. Do NOT change prices to force the subtotal to match.

CRITICAL RULES:
- Return ALL items visible on the receipt (at least as many as the current list, preferably more if any were missed).
- Keep each item's price and quantity exactly as shown on the receipt. Do not scale or adjust prices.
- If the sum of item totals does not equal $${targetSubtotal.toFixed(2)}, that is OK - we will mark for review. Do not alter prices to match.
- Do NOT include tax/fees as line items.
- For weight-based items (kg/lb): price is the LINE TOTAL for that weight.
- For count-based items: price is UNIT PRICE and quantity is count.

Return ONLY JSON:
{
  "items": [
    { "name": "...", "price": 1.23, "quantity": 1, "unit": "pieces", "category": "Produce", "location": "pantry", "emoji": "🍎" }
  ]
}

STRICT CATEGORY RULES:
- Meat, Poultry & Seafood: ANY item with meat/poultry/seafood terms (beef, chicken, pork, fish, steak, boneless, strip, new york, sirloin, ribeye, filet, ground beef, chicken breast, pork chops, lamb, veal, salmon, tuna, shrimp, crab, lobster, etc.). "boneless meat", "new york strip", "chicken breast" MUST be "Meat, Poultry & Seafood", NEVER "Pantry Staples".
- Produce: Fresh fruits and vegetables only
- Dairy & Eggs: Milk, cheese, butter, eggs, yogurt
- Grains, Bread & Pasta: Bread, pasta, rice, tortillas
- Pantry Staples & Essentials: Canned goods, packaged items, spices, oils. NEVER meat items.
- Other categories as appropriate`

    try {
      const data = await this.callChatCompletion(
        [
          { role: 'system', content: reconcilePrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Current extracted items:\n${JSON.stringify(currentItems, null, 2)}` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        { model: 'gpt-4o', max_tokens: 800, temperature: 0.0, timeoutMs: 30000 }
      )

      let content = data.choices[0]?.message?.content || '{}'
      content = content.trim()
      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/\n?```$/, '')
      }

      const parsed = JSON.parse(content)
      const items = Array.isArray(parsed.items) ? parsed.items : []
      const processedItems = items.map((item: any) => {
        if (!item.name || typeof item.name !== 'string') {
          return null
        }
        const expandedName = this.expandItemName(item.name.trim())
        
        // CRITICAL: Re-classify meat items if LLM misclassified them
        let category = item.category || 'Other'
        const itemNameLower = expandedName.toLowerCase()
        
        // Strict meat detection - override LLM classification if needed
        const meatTerms = ['meat', 'beef', 'chicken', 'pork', 'fish', 'steak', 'boneless', 'strip', 'new york', 
                          'sirloin', 'ribeye', 'filet', 'ground beef', 'ground pork', 'ground turkey', 
                          'chicken breast', 'chicken thighs', 'pork chops', 'lamb', 'veal', 'salmon', 'tuna', 
                          'shrimp', 'crab', 'lobster', 'turkey', 'bacon', 'ham', 'sausage']
        
        // If item name contains meat terms and was classified as Pantry Staples, fix it
        if (meatTerms.some(term => itemNameLower.includes(term)) && 
            (category.toLowerCase().includes('pantry') || category.toLowerCase().includes('staples'))) {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood"`)
          category = 'Meat, Poultry & Seafood'
        }
        
        // Use detectCategoryFromName as final authority for meat items
        const detectedCategory = detectCategoryFromName(expandedName)
        if (detectedCategory === 'Meat, Poultry & Seafood' && category !== 'Meat, Poultry & Seafood') {
          console.log(`🔧 Re-classifying "${expandedName}" from "${category}" to "Meat, Poultry & Seafood" (detected)`)
          category = 'Meat, Poultry & Seafood'
        }
        
        const normalizedCategory = normalizeCategory(category || detectedCategory || 'Other')
        const properEmoji = getItemEmoji(expandedName, normalizedCategory)
        let price = item.price
        if (price !== undefined && price !== null) {
          price = typeof price === 'number' ? price : parseFloat(price)
          if (isNaN(price) || price < 0) {
            price = undefined
          }
        }
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
        return {
          name: expandedName,
          emoji: properEmoji,
          quantity,
          unit: item.unit || 'pieces',
          category: normalizedCategory,
          location: item.location || 'pantry',
          price,
          store: item.store
        }
      }).filter((item): item is ScannedItem => item !== null)

      return this.aggregateReceiptItems(processedItems)
    } catch (error) {
      console.warn('Reconciliation pass failed:', error)
      return null
    }
  }

  // Verify receipt scan - check for missed items and validate totals
  private async verifyReceiptScan(imageBase64: string, firstPassResult: ScanResult, ocrText?: string | null, ocrFailed?: boolean): Promise<ScanResult> {
    try {
      // CRITICAL: Use items from firstPassResult (should already be aggregated)
      // Declare itemsToUse first to ensure consistency throughout function
      const itemsToUse = firstPassResult.items
      
      // STRICT GATE: If OCR failed, this function should NOT be called
      // But add a safety check just in case
      if (ocrFailed) {
        console.warn('⚠️ verifyReceiptScan called with ocrFailed=true - this should not happen')
        // Return early with items only - use itemsToUse to ensure consistency
        return {
          ...firstPassResult,
          items: itemsToUse, // Ensure we return the same items used for calculation
          receiptSubtotal: undefined,
          receiptTax: undefined,
          receiptTotal: undefined,
          needsReview: true,
          validationPassed: false
        }
      }
      
      const hasItems = itemsToUse.length > 0
      // Check if receipt total was extracted
      let receiptTotal = firstPassResult.receiptTotal
      let receiptSubtotal = firstPassResult.receiptSubtotal
      let receiptTax = firstPassResult.receiptTax
      // Runtime guard: Check for duplicates and re-aggregate if needed
      const itemNameCounts = new Map<string, number>()
      for (const item of itemsToUse) {
        const normalizedName = this.normalizeItemName(item.name).toLowerCase()
        itemNameCounts.set(normalizedName, (itemNameCounts.get(normalizedName) || 0) + 1)
      }
      const unaggregatedDuplicates = Array.from(itemNameCounts.entries()).filter(([_, count]) => count > 1)
      
      // CRITICAL: If duplicates found, re-aggregate to prevent double-counting
      let finalItemsToUse = itemsToUse
      if (unaggregatedDuplicates.length > 0) {
        console.warn('⚠️ WARNING: verifyReceiptScan received items that appear unaggregated:', {
          duplicateNames: unaggregatedDuplicates.map(([name, count]) => `${name} (${count}x)`),
          totalItemCount: itemsToUse.length,
          uniqueItemCount: itemNameCounts.size
        })
        // Re-aggregate to fix duplicates
        finalItemsToUse = this.aggregateReceiptItems(itemsToUse)
        if (finalItemsToUse.length < itemsToUse.length) {
          console.warn(`⚠️ Re-aggregated items to fix duplicates: ${itemsToUse.length} → ${finalItemsToUse.length}`)
        }
      }
      
      // Use new calculateSubtotal function - ONLY from finalItemsToUse (aggregated)
      const calc = this.calculateSubtotal(finalItemsToUse)
      const calculatedSubtotal = calc.calculatedSubtotal
      
      // Always try to get accurate totals first
      // CRITICAL: Only parse totals from OCR text, NOT from LLM rawText
      // LLM totals are unreliable - only use OCR-based totals
      let totals: { receiptTotal?: number; receiptSubtotal?: number; receiptTax?: number; receiptTaxRate?: number; selectedTotalsBlockIndex?: number; allParsedTotalsBlocks?: Array<{ subtotal?: number; tax?: number; total?: number }> } = {}
      if (ocrText) {
        // Only parse from OCR text - this is reliable
        const parsedTotals = parseTotalsFromText(ocrText)
        totals = {
          receiptTotal: parsedTotals.total,
          receiptSubtotal: parsedTotals.subtotal,
          receiptTax: parsedTotals.taxAmount,
          receiptTaxRate: parsedTotals.taxRate,
          selectedTotalsBlockIndex: parsedTotals.selectedTotalsBlockIndex,
          allParsedTotalsBlocks: parsedTotals.allParsedTotalsBlocks
        }
      }
      // DO NOT parse from LLM rawText - it's unreliable
      // DO NOT call scanReceiptTotals - LLM totals are not trustworthy
      
      // NEVER overwrite subtotal with tax or item prices
      // CRITICAL: Only use parsed values from OCR - never infer from item prices
      // If totals are missing, they must remain undefined (never set to last item price)
      if (typeof totals.receiptTotal === 'number' && totals.receiptTotal > 0) {
        receiptTotal = totals.receiptTotal
      }
      if (typeof totals.receiptSubtotal === 'number' && totals.receiptSubtotal > 0) {
        receiptSubtotal = totals.receiptSubtotal
      }
      if (typeof totals.receiptTax === 'number' && totals.receiptTax >= 0) {
        receiptTax = totals.receiptTax
      }
      
      // CRITICAL: Never set receiptSubtotal to an item price as fallback
      // If totals are missing, they must remain undefined

      // Derive missing values if possible (but NEVER overwrite subtotal with tax or item prices)
      if (receiptSubtotal && receiptTax && !receiptTotal) {
        receiptTotal = Math.round((receiptSubtotal + receiptTax) * 100) / 100
      }
      // DO NOT derive subtotal from total - this can cause the bug where subtotal = tax
      // Only derive if we have total and tax but no subtotal, and it makes sense
      if (receiptTotal && receiptTax && !receiptSubtotal && receiptTax < receiptTotal * 0.2) {
        receiptSubtotal = Math.round((receiptTotal - receiptTax) * 100) / 100
      }
      if (receiptTotal && receiptSubtotal && !receiptTax) {
        receiptTax = Math.round((receiptTotal - receiptSubtotal) * 100) / 100
      }
      
      // Strict totals sanity checks - use finalItemsToUse (same items used for calculation)
      const sanityCheck = this.validateTotalsSanity(
        receiptSubtotal,
        receiptTax,
        receiptTotal,
        finalItemsToUse
      )
      
      // Aggregation safety: if subtotal > 100 and itemCount <= 2, flag as invalid
      const aggregationSafetyCheck = receiptSubtotal && receiptSubtotal > 100 && finalItemsToUse.length <= 2
      
      // The key validation: calculatedSubtotal should match receiptSubtotal
      // Tax explains the difference between subtotal and total
      let subtotalDifference = receiptSubtotal
        ? Math.abs(receiptSubtotal - calculatedSubtotal)
        : null
      
      // NEVER infer subtotal from TAX or item prices
      // If we don't have explicit subtotal, we can't validate properly
      
      // Calculate mismatches
      const calculatedTotal = calculatedSubtotal + (receiptTax || 0)
      const totalDifference = receiptTotal
        ? Math.abs(receiptTotal - calculatedTotal)
        : null
      
      const subtotalMismatch = subtotalDifference !== null && subtotalDifference > 0.05
      const totalMismatch = totalDifference !== null && totalDifference > 0.05
      
      // Validation passes if both subtotal and total match (within $0.05) AND sanity checks pass
      // BUT: If OCR failed, validationPassed must remain false (handled in scanReceipt)
      // CRITICAL: If receiptSubtotal/receiptTax/receiptTotal are undefined, validation must fail
      const hasValidTotals = receiptSubtotal !== null && receiptSubtotal !== undefined && receiptSubtotal > 0 &&
                             receiptTotal !== null && receiptTotal !== undefined && receiptTotal > 0
      
      const validationPassed = hasValidTotals && !subtotalMismatch && !totalMismatch && sanityCheck.isValid && !aggregationSafetyCheck
      const needsVerification = !hasValidTotals || !receiptSubtotal || subtotalMismatch || !sanityCheck.isValid || aggregationSafetyCheck
      
      if (needsVerification) {
        // CRITICAL: Do not log validation details if OCR failed (shouldn't reach here, but safety check)
        if (ocrFailed) {
          console.log('⚠️ OCR failed → skipping verification pass (should not reach here)')
          // Return early
          return {
            ...firstPassResult,
            receiptSubtotal,
            receiptTax,
            receiptTotal,
            calculatedSubtotal,
            calculatedTotal: calculatedSubtotal + (receiptTax || 0),
            validationPassed: false,
            needsReview: true,
            subtotalMismatch: true,
            totalMismatch: true
          }
        }
        
        console.log('🔍 Receipt validation: Running verification pass...', {
          receiptTotal,
          receiptSubtotal,
          calculatedSubtotal,
          subtotalDifference,
          itemCount: firstPassResult.items.length
        })
        
        // Second pass to find missed items (use same preprocessed image)
        const verificationResult = await this.performReceiptScan(imageBase64, 'verification', { ocrFailed })

        const isDuplicateReceiptItem = (item: ScannedItem, existingItems: ScannedItem[]) => {
          const normalizedName = this.normalizeItemName(item.name)
          const price = item.price || 0
          const quantity = item.quantity || 1
          const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())

          return existingItems.some(existing => {
            const existingNormalized = this.normalizeItemName(existing.name)
            const existingPrice = existing.price || 0
            const existingQuantity = existing.quantity || 1
            const existingIsWeight = existing.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(existing.unit.toLowerCase())

            // Exact normalized name and close price
            if (normalizedName === existingNormalized && Math.abs(existingPrice - price) <= 0.1) {
              return true
            }

            // Weight items: same unit and similar weight
            if (isWeightBased && existingIsWeight && item.unit === existing.unit) {
              const weightDiff = Math.abs(existingQuantity - quantity)
              const avgWeight = (existingQuantity + quantity) / 2
              if (avgWeight > 0 && weightDiff / avgWeight < 0.1) {
                return true
              }
            }

            // Fuzzy name match with similar price
            if (this.areItemsSimilar(item.name, existing.name)) {
              const avgPrice = (existingPrice + price) / 2
              if (avgPrice > 0 && Math.abs(existingPrice - price) / avgPrice < 0.2) {
                return true
              }
            }

            return false
          })
        }

        // Merge only truly new items from verification pass
        // CRITICAL: Only use verification items if they add MORE items than we already have
        // Prevent regression: if verification returns 0 items or fewer items, IGNORE it
        // Use finalItemsToUse (already aggregated) as the base
        let allItems = [...finalItemsToUse]
        const originalItemCount = allItems.length
        
        if (verificationResult.items.length > 0) {
          const newItems = verificationResult.items.filter(item => !isDuplicateReceiptItem(item, allItems))
          const newItemCount = newItems.length
          console.log(`✅ Verification found ${verificationResult.items.length} items, ${newItemCount} are new`)
          
          // ONLY merge if we're adding items (prevent regression)
          if (newItemCount > 0) {
            allItems = [...allItems, ...newItems]
            console.log(`✅ Merged ${newItemCount} new items: ${originalItemCount} → ${allItems.length} items`)
          } else {
            console.log(`⚠️ Verification found no new items, keeping original ${originalItemCount} items`)
          }
        } else {
          console.log(`⚠️ Verification returned 0 items, keeping original ${originalItemCount} items`)
        }
        
        // CRITICAL: If verification reduced item count, revert to original
        if (allItems.length < originalItemCount) {
          console.warn(`⚠️ Item count regression detected: ${allItems.length} < ${originalItemCount}, reverting to original items`)
          allItems = [...firstPassResult.items]
        }
        
        // Final aggregation pass before calculating totals
        // CRITICAL: Re-aggregate to ensure no duplicates after merging verification items
        const finalAggregatedItems = this.aggregateReceiptItems(allItems)
        
        // Runtime guard: Check for duplicates after aggregation
        const aggregatedItemNames = new Map<string, number>()
        for (const item of finalAggregatedItems) {
          const normalizedName = this.normalizeItemName(item.name).toLowerCase()
          aggregatedItemNames.set(normalizedName, (aggregatedItemNames.get(normalizedName) || 0) + 1)
        }
        const aggregatedDuplicates = Array.from(aggregatedItemNames.entries()).filter(([_, count]) => count > 1)
        if (aggregatedDuplicates.length > 0) {
          console.error('❌ ERROR: Duplicate items found after aggregation in verifyReceiptScan:', aggregatedDuplicates.map(([name]) => name))
        }
        
        // Recalculate subtotal using new function - ONLY from finalAggregatedItems
        const newCalc = this.calculateSubtotal(finalAggregatedItems)
        const newCalculatedSubtotal = newCalc.calculatedSubtotal
        
        // Use receipt totals from verification if first pass didn't have them
        const finalReceiptTotal = receiptTotal || verificationResult.receiptTotal
        const finalReceiptSubtotal = receiptSubtotal || verificationResult.receiptSubtotal
        const finalReceiptTax = receiptTax || verificationResult.receiptTax
        const finalSubtotalDifference = finalReceiptSubtotal
          ? Math.abs(finalReceiptSubtotal - newCalculatedSubtotal)
          : null
        const finalEstimatedTax = this.estimateTaxDifference(finalReceiptTotal, newCalculatedSubtotal)
        
      const allowAggressivePass = false

        // If still doesn't match, try one more aggressive pass (disabled for speed)
        if (
          allowAggressivePass &&
          finalReceiptSubtotal &&
          finalSubtotalDifference !== null &&
          finalSubtotalDifference > 0.05
        ) {
          console.log(`⚠️ Still mismatched after verification (subtotal diff: $${finalSubtotalDifference.toFixed(2)}). Running aggressive third pass...`)
          
          // Third pass with explicit total mismatch information
          const aggressiveSystemPrompt = `🚨 CRITICAL ERROR: The receipt subtotal is $${finalReceiptSubtotal?.toFixed(2) ?? 'unknown'} but only $${newCalculatedSubtotal.toFixed(2)} was calculated. You are MISSING ITEMS or PRICES ARE WRONG.

MANDATORY STEPS:
1. Count EVERY line item on the receipt
2. PRICE EXTRACTION:
   - COUNT items: Extract UNIT PRICE (price per item)
   - WEIGHT items: Extract LINE TOTAL (total amount for that weight)
3. Sum of item prices MUST equal SUBTOTAL (before tax), NOT the total
4. Expand all abbreviations to FULL ENGLISH names

The receipt subtotal is $${finalReceiptSubtotal?.toFixed(2) ?? 'unknown'}. Your extracted items MUST sum to this amount.`
          
          // Create a modified scan with the aggressive prompt
          const thirdPassResult = await this.performAggressiveReceiptScan(imageBase64, aggressiveSystemPrompt, finalReceiptSubtotal ?? finalReceiptTotal ?? 0, newCalculatedSubtotal)
          
          // If third pass found items, ONLY use if it has MORE items than current
          // Prevent regression: never reduce item count
          const currentItemCount = finalAggregatedItems.length
          if (thirdPassResult.items.length > currentItemCount) {
            console.log(`✅ Third pass found ${thirdPassResult.items.length} items (more than current ${currentItemCount})`)
            const thirdPassAggregatedItems = this.aggregateReceiptItems(thirdPassResult.items)
            
            // Recalculate subtotal
            const thirdPassCalc = this.calculateSubtotal(thirdPassAggregatedItems)
            const thirdPassSubtotal = thirdPassCalc.calculatedSubtotal
            const thirdPassSubtotalDiff = finalReceiptSubtotal
              ? Math.abs(finalReceiptSubtotal - thirdPassSubtotal)
              : null
            
            console.log(`💰 Third pass calculation:`, {
              calculatedSubtotal: thirdPassSubtotal.toFixed(2),
              receiptSubtotal: finalReceiptSubtotal?.toFixed(2),
              subtotalDiff: thirdPassSubtotalDiff?.toFixed(2),
              itemCount: thirdPassAggregatedItems.length
            })
            
            // Apply safety flags helper
            const thirdPassNeedsReview = this.applySafetyFlags({
              ocrFailed: ocrFailed || false,
              validationPassed: hasItems && thirdPassSubtotalDiff !== null && thirdPassSubtotalDiff <= 0.05,
              receiptTotal: finalReceiptTotal,
              existingNeedsReview: false
            })
            
            return {
              items: thirdPassAggregatedItems,
              totalItems: thirdPassAggregatedItems.length,
              store: thirdPassResult.store || firstPassResult.store || verificationResult.store,
              date: thirdPassResult.date || firstPassResult.date || verificationResult.date,
              receiptTotal: finalReceiptTotal,
              receiptSubtotal: finalReceiptSubtotal,
              receiptTax: finalReceiptTax,
              receiptTaxRate: totals.receiptTaxRate,
              calculatedSubtotal: thirdPassSubtotal,
              calculatedTotal: thirdPassSubtotal + (finalReceiptTax || 0),
              validationPassed: ocrFailed ? false : (hasItems && thirdPassSubtotalDiff !== null && thirdPassSubtotalDiff <= 0.05),
              needsReview: thirdPassNeedsReview,
              rawText: firstPassResult.rawText,
            }
          } else {
            console.log(`⚠️ Third pass found ${thirdPassResult.items.length} items (not more than current ${currentItemCount}), ignoring`)
          }
        }
        
        let reconciledItems = finalAggregatedItems
        let reconciledSubtotal = newCalculatedSubtotal
        let reconciledSubtotalDiff = finalSubtotalDifference
        const currentItemCount = finalAggregatedItems.length

        if (
          finalReceiptSubtotal &&
          reconciledSubtotalDiff !== null &&
          reconciledSubtotalDiff > 0.05
        ) {
          const reconciled = await this.reconcileReceiptItems(
            imageBase64,
            finalAggregatedItems,
            finalReceiptSubtotal
          )
          // CRITICAL: Only use reconciled items if they have MORE items than current
          // Prevent regression: never reduce item count
          if (reconciled && reconciled.length > currentItemCount) {
            console.log(`✅ Reconciliation increased items: ${currentItemCount} → ${reconciled.length}`)
            reconciledItems = reconciled
            const reconciledCalc = this.calculateSubtotal(reconciledItems)
            reconciledSubtotal = reconciledCalc.calculatedSubtotal
            reconciledSubtotalDiff = Math.abs(finalReceiptSubtotal - reconciledSubtotal)
          } else if (reconciled && reconciled.length > 0 && reconciled.length <= currentItemCount) {
            console.log(`⚠️ Reconciliation returned ${reconciled.length} items (not more than current ${currentItemCount}), keeping original items`)
            // Keep original items - don't reduce count
          } else if (reconciled && reconciled.length === 0) {
            console.log(`⚠️ Reconciliation returned 0 items, keeping original ${currentItemCount} items`)
            // Keep original items
          }
        }

        // Try repair if still mismatched
        let finalItems = reconciledItems
        if (finalReceiptSubtotal && reconciledSubtotalDiff !== null && reconciledSubtotalDiff > 0.05) {
          finalItems = this.repairItemsForTotalsMismatch(
            reconciledItems,
            finalReceiptSubtotal,
            finalReceiptTotal || 0,
            finalReceiptTax
          )
          const repairedCalc = this.calculateSubtotal(finalItems)
          reconciledSubtotal = repairedCalc.calculatedSubtotal
          reconciledSubtotalDiff = finalReceiptSubtotal
            ? Math.abs(finalReceiptSubtotal - reconciledSubtotal)
            : null
        }
        
        const finalCalc = this.calculateSubtotal(finalItems)
        const finalValidationPassed = hasItems && reconciledSubtotalDiff !== null && reconciledSubtotalDiff <= 0.05
        
        return {
          items: finalItems,
          totalItems: finalItems.length,
          store: firstPassResult.store || verificationResult.store,
          date: firstPassResult.date || verificationResult.date,
          receiptTotal: finalReceiptTotal,
          receiptSubtotal: finalReceiptSubtotal,
          receiptTax: finalReceiptTax,
          receiptTaxRate: totals.receiptTaxRate,
          calculatedSubtotal: finalCalc.calculatedSubtotal,
          calculatedTotal: finalCalc.calculatedSubtotal + (finalReceiptTax || 0),
          validationPassed: ocrFailed ? false : finalValidationPassed, // If OCR failed, validation must fail
          needsReview: this.applySafetyFlags({
            ocrFailed: ocrFailed || false,
            validationPassed: finalValidationPassed,
            receiptTotal: finalReceiptTotal,
            existingNeedsReview: false
          }), // HARD RULE: Immutable once true
          rawText: firstPassResult.rawText,
        }
      }
      
      // Try repair if validation failed
      let finalItems = firstPassResult.items
      if (receiptSubtotal && subtotalDifference !== null && subtotalDifference > 0.05) {
        finalItems = this.repairItemsForTotalsMismatch(
          firstPassResult.items,
          receiptSubtotal,
          receiptTotal || 0,
          receiptTax
        )
        const repairedCalc = this.calculateSubtotal(finalItems)
        calculatedSubtotal = repairedCalc.calculatedSubtotal
        subtotalDifference = receiptSubtotal
          ? Math.abs(receiptSubtotal - calculatedSubtotal)
          : null
      }
      
      const finalCalc = this.calculateSubtotal(finalItems)
      
      // Sanity check on final values
      const finalSanityCheck = this.validateTotalsSanity(
        receiptSubtotal,
        receiptTax,
        receiptTotal,
        finalItems
      )
      const finalAggregationSafety = receiptSubtotal && receiptSubtotal > 100 && finalItems.length <= 2
      
      const finalCalculatedTotal = finalCalc.calculatedSubtotal + (receiptTax || 0)
      const finalSubtotalDiff = receiptSubtotal
        ? Math.abs(receiptSubtotal - finalCalc.calculatedSubtotal)
        : null
      const finalTotalDiff = receiptTotal
        ? Math.abs(receiptTotal - finalCalculatedTotal)
        : null
      
      const finalSubtotalMismatch = finalSubtotalDiff !== null && finalSubtotalDiff > 0.05
      const finalTotalMismatch = finalTotalDiff !== null && finalTotalDiff > 0.05
      const finalValidationPassed = hasItems && !finalSubtotalMismatch && !finalTotalMismatch && finalSanityCheck.isValid && !finalAggregationSafety
      
      console.log('✅ First pass validation complete:', {
        itemCount: finalItems.length,
        receiptSubtotal,
        receiptTax,
        receiptTotal,
        calculatedSubtotal: finalCalc.calculatedSubtotal,
        calculatedTotal: finalCalculatedTotal,
        subtotalDiff: finalSubtotalDiff?.toFixed(2),
        totalDiff: finalTotalDiff?.toFixed(2),
        subtotalMismatch: finalSubtotalMismatch,
        totalMismatch: finalTotalMismatch,
        sanityCheck: finalSanityCheck.isValid,
        aggregationSafety: finalAggregationSafety,
        validationPassed: finalValidationPassed,
        selectedTotalsBlockIndex: totals.selectedTotalsBlockIndex,
        allParsedTotalsBlocks: totals.allParsedTotalsBlocks
      })
      
      // Return first pass result with validation info
      // If receiptTotal is null/undefined, validation must fail
      // BUT: If OCR failed, needsReview must ALWAYS be true (never override)
      const hasValidTotalsForReturn = receiptTotal !== null && receiptTotal !== undefined && receiptTotal > 0
      const returnValidationPassed = hasValidTotalsForReturn && finalValidationPassed
      
      // Apply safety flags helper - ensures needsReview is immutable once true
      const returnNeedsReview = this.applySafetyFlags({
        ocrFailed: ocrFailed || false,
        validationPassed: returnValidationPassed,
        receiptTotal: receiptTotal,
        existingNeedsReview: false
      })
      
      // Single source of truth: create final result ONCE
      const finalScanResult: ScanResult = {
        ...firstPassResult,
        items: finalItems, // Use finalItems (may have been repaired, but never reduced)
        totalItems: finalItems.length,
        calculatedSubtotal: finalCalc.calculatedSubtotal,
        calculatedTotal: finalCalculatedTotal,
        validationPassed: ocrFailed ? false : returnValidationPassed, // If OCR failed, validation must fail
        subtotalMismatch: finalSubtotalMismatch,
        totalMismatch: finalTotalMismatch,
        needsReview: returnNeedsReview, // HARD RULE: Immutable once true
        receiptTotal,
        receiptSubtotal,
        receiptTax,
        receiptTaxRate: totals.receiptTaxRate,
        selectedTotalsBlockIndex: totals.selectedTotalsBlockIndex,
        allParsedTotalsBlocks: totals.allParsedTotalsBlocks
      }
      
      console.log('✅ Final scan result (no verification path):', {
        itemCount: finalScanResult.items.length,
        needsReview: finalScanResult.needsReview,
        validationPassed: finalScanResult.validationPassed,
        ocrFailed: ocrFailed || false
      })
      
      return finalScanResult
      
    } catch (error) {
      console.error('Error in receipt verification:', error)
      // Return first pass result even if verification fails
      // Apply aggregation before returning
      const aggregatedItems = this.aggregateReceiptItems(firstPassResult.items)
      
      // Calculate subtotal using new function
      const calc = this.calculateSubtotal(aggregatedItems)
      const subtotalDiff = receiptSubtotal 
        ? Math.abs(receiptSubtotal - calc.calculatedSubtotal)
        : null
      
      const calculatedTotal = calc.calculatedSubtotal + (firstPassResult.receiptTax || 0)
      const totalDiff = receiptSubtotal 
        ? Math.abs((receiptSubtotal + (firstPassResult.receiptTax || 0)) - calculatedTotal)
        : null
      
      const subtotalMismatch = subtotalDiff !== null && subtotalDiff > 0.05
      const totalMismatch = totalDiff !== null && totalDiff > 0.05
      
      // If receiptTotal is null/undefined, validation must fail
      const hasValidTotalsForError = firstPassResult.receiptTotal !== null && firstPassResult.receiptTotal !== undefined && firstPassResult.receiptTotal > 0
      const validationPassed = hasValidTotalsForError && !subtotalMismatch && !totalMismatch
      
      return {
        ...firstPassResult,
        items: aggregatedItems,
        totalItems: aggregatedItems.length,
        calculatedSubtotal: calc.calculatedSubtotal,
        calculatedTotal,
        validationPassed: ocrFailed ? false : validationPassed, // If OCR failed, validation must fail
        subtotalMismatch,
        totalMismatch,
        needsReview: this.applySafetyFlags({
          ocrFailed: ocrFailed || false,
          validationPassed: validationPassed,
          receiptTotal: firstPassResult.receiptTotal,
          existingNeedsReview: false
        }), // HARD RULE: Immutable once true
      }
    }
  }

  /**
   * Apply safety flags - ensures needsReview is immutable once true
   * HARD RULE: If OCR failed, needsReview must ALWAYS be true
   * If receiptTotal is missing, needsReview must be true
   * If validation failed, needsReview must be true
   */
  private applySafetyFlags(params: {
    ocrFailed: boolean
    validationPassed: boolean
    receiptTotal?: number | null
    existingNeedsReview?: boolean
  }): boolean {
    const { ocrFailed, validationPassed, receiptTotal, existingNeedsReview = false } = params
    
    // HARD RULE: If already true, never set to false
    if (existingNeedsReview) {
      return true
    }
    
    // HARD RULE: If OCR failed, always true
    if (ocrFailed) {
      return true
    }
    
    // If receiptTotal is missing, needs review
    const totalsMissing = receiptTotal === null || receiptTotal === undefined || receiptTotal <= 0
    if (totalsMissing) {
      return true
    }
    
    // If validation failed, needs review
    if (!validationPassed) {
      return true
    }
    
    return false
  }

  // Scan single item using OpenAI Vision API
  async scanItem(imageBase64: string): Promise<ScannedItem | null> {
    try {
      const data = await this.callChatCompletion(
        [
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
5. Category (STRICT RULES):
   - Meat, Poultry & Seafood: ANY item with meat/poultry/seafood terms (beef, chicken, pork, fish, steak, boneless, strip, new york, sirloin, ribeye, filet, ground beef, chicken breast, pork chops, lamb, veal, salmon, tuna, shrimp, crab, lobster, etc.). Items like "boneless meat", "new york strip", "chicken breast" MUST be "Meat, Poultry & Seafood", NEVER "Pantry Staples".
   - Produce: Fresh fruits and vegetables
   - Dairy & Eggs: Milk, cheese, butter, eggs, yogurt
   - Grains, Bread & Pasta: Bread, pasta, rice, tortillas
   - Pantry Staples & Essentials: Canned goods, packaged items, spices, oils. NEVER meat items.
   - Condiments, Sauces & Spreads: Sauces, condiments
   - Snacks, Sweets & Desserts: Snacks, candy, desserts
   - Beverages: Drinks, juices
   - Plant-Based Proteins & Legumes: Tofu, beans, lentils
   - Non-Food / Misc: Non-food items
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
        { model: 'gpt-4o', max_tokens: 300, temperature: 0.2 }
      )
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
      
      // CRITICAL: Re-classify meat items if LLM misclassified them
      let category = result.category || 'Other'
      const itemNameLower = result.name.toLowerCase()
      
      // Strict meat detection - override LLM classification if needed
      const meatTerms = ['meat', 'beef', 'chicken', 'pork', 'fish', 'steak', 'boneless', 'strip', 'new york', 
                        'sirloin', 'ribeye', 'filet', 'ground beef', 'ground pork', 'ground turkey', 
                        'chicken breast', 'chicken thighs', 'pork chops', 'lamb', 'veal', 'salmon', 'tuna', 
                        'shrimp', 'crab', 'lobster', 'turkey', 'bacon', 'ham', 'sausage']
      
      // If item name contains meat terms and was classified as Pantry Staples, fix it
      if (meatTerms.some(term => itemNameLower.includes(term)) && 
          (category.toLowerCase().includes('pantry') || category.toLowerCase().includes('staples'))) {
        console.log(`🔧 Re-classifying "${result.name}" from "${category}" to "Meat, Poultry & Seafood"`)
        category = 'Meat, Poultry & Seafood'
      }
      
      // Use detectCategoryFromName as final authority for meat items
      const detectedCategory = detectCategoryFromName(result.name)
      if (detectedCategory === 'Meat, Poultry & Seafood' && category !== 'Meat, Poultry & Seafood') {
        console.log(`🔧 Re-classifying "${result.name}" from "${category}" to "Meat, Poultry & Seafood" (detected)`)
        category = 'Meat, Poultry & Seafood'
      }
      
      // Normalize category and ensure proper emoji using unified formatter
      const normalizedCategory = normalizeCategory(category || detectedCategory || 'Other')
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

  // Helper: Convert image URI to base64 (file:// or content URI)
  // Uses expo-file-system/legacy so receipt scanning works in React Native (main API deprecated readAsStringAsync).
  async imageUriToBase64(uri: string): Promise<string> {
    try {
      // file:// and content URIs: read with legacy API (reliable in RN)
      if (uri.startsWith('file://') || uri.startsWith('content://')) {
        const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
          encoding: 'base64',
        })
        return base64
      }
      // http(s) or data URI: use fetch + FileReader
      const response = await fetch(uri)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          const base64Data = base64.split(',')[1] || base64
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

  /**
   * Preprocess image for OCR and LLM extraction
   * Resizes to optimal size (2000px width), ensures high quality
   * Gracefully handles missing native module (Expo Go doesn't support it)
   */
  /**
   * Preprocess image for OCR and LLM extraction
   * NOTE: Preprocessing is disabled in Expo Go (requires dev client)
   * This function always returns the original image as base64
   * NEVER throws - always returns base64
   */
  private async preprocessImageForOCR(imageUri: string): Promise<string> {
    // Skip preprocessing entirely - expo-image-manipulator causes crashes in Expo Go
    // OCR works fine with original images, preprocessing is optional
    if (!(this as any)._imageManipulatorWarningLogged) {
      console.log('ℹ️ ImageManipulator unavailable in Expo Go; skipping preprocessing')
      ;(this as any)._imageManipulatorWarningLogged = true
    }
    
    // Always return original image as base64 - never throw
    return await this.imageUriToBase64(imageUri)
  }

  /**
   * Preprocess image for better LLM extraction
   * Resizes to optimal size (~1800px width) and ensures high quality
   */
  private async preprocessImageForLLM(imageBase64: string): Promise<string> {
    try {
      // For LLM, we already have base64, so just log size
      const imageSizeBytes = (imageBase64.length * 3) / 4 // Approximate
      console.log('📸 Image for LLM:', {
        base64Length: imageBase64.length,
        estimatedSizeBytes: Math.round(imageSizeBytes),
        estimatedSizeKB: Math.round(imageSizeBytes / 1024)
      })
      
      return imageBase64
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error)
      return imageBase64
    }
  }

  // Scan expiry date from package image using OCR (EXTREMELY ACCURATE VERSION)
  async scanExpiryDate(imageBase64: string): Promise<{ expiryDate?: string; error?: string; confidence?: string }> {
    try {
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

      const data = await this.callChatCompletion(
        [
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
        { model: 'gpt-4o', max_tokens: 300, temperature: 0.1 }
      )
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


