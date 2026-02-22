// SAVR Barcode Service - Scans barcodes and fetches product data with household scaling
import { supabase } from './supabase'
import { userPreferencesService } from './UserPreferencesService'
import {
  detectAllergensEvidenceBased,
  toDetectionInput,
  toDetectionInputFromNormalized,
  buildUserAllergenConfig,
} from './allergenEngine'
import { toLegacyAllergenCheckResult } from './allergenEngine/legacyAdapter'
import { getSourceLabel, setBestResult } from './AllergenResultStore'
import { normalizeOFFProduct, hasUsableOFFAllergenData } from './allergenEngine/offNormalizer'
import { createScanSession } from './ScanSessionService'

export interface ScannedProduct {
  barcode: string
  name: string
  brand?: string
  category: string
  image?: string
  nutrition: {
    servingSize: string
    servingSizeGrams?: number
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
    sugar?: number
    sodium?: number
  }
  ingredients?: string
  allergens?: string[]
  traces?: string[]  // Cross-contact warnings from Open Food Facts
  // Expiry tracking
  expiryDate?: string // Best before / use by date from product
  shelfLife?: number // Days from purchase to expiry
  storageInstructions?: string // Storage recommendations
  // Household scaling
  householdScaled: boolean
  originalServing?: string
  scaledServing?: string
  householdSize?: number
  // Source tracking
  source: 'openfoodfacts' | 'local_db' | 'manual'
  confidence: number
  lastUpdated: string
}

// Bulletproof allergen detection types
export type AllergenRiskLevel = "HIGH_RISK" | "POSSIBLE_RISK" | "NO_MATCH_FOUND" | "INSUFFICIENT_DATA"

export interface AllergenMatch {
  allergen: string              // user-selected allergen (canonical name)
  allergenId?: string           // builtin/custom id for reporting
  matchedTerm: string           // what exactly triggered the hit
  source: "ingredients" | "allergens" | "traces" | "product_name"
  confidence: "HIGH" | "MEDIUM"
}

export interface AllergenCheckResult {
  // Legacy fields for backward compatibility
  hasAllergens: boolean
  detectedAllergens: string[]
  userAllergens: string[]
  
  // New bulletproof fields
  riskLevel: AllergenRiskLevel
  matches: AllergenMatch[]
  message: string
  scannedText?: {
    ingredientsText?: string
    allergensText?: string
    tracesText?: string
    productName?: string
  }
  /** When UNKNOWN: CTAs for fallback (scan label photo, paste ingredients) */
  fallbackCtas?: {
    scanLabelPhoto?: boolean
    pasteIngredientsManually?: boolean
  }
  /** 0-100 OFF completeness; when UNKNOWN and <60, show "OFF data incomplete" */
  sourceCoverageScore?: number
  /** Where ingredients/allergen evidence came from */
  dataSource?: 'OFF' | 'OCR' | 'MANUAL'
  /** Human-readable source label for UI */
  sourceLabel?: string
}

export interface ScanResult {
  found: boolean
  product?: ScannedProduct
  barcode: string
  scanSessionId?: string
  needsManualEntry?: boolean
  suggestedCategory?: string
  errorMessage?: string
  allergenCheck?: AllergenCheckResult
}

class BarcodeService {
  private static instance: BarcodeService
  private productCache: Map<string, ScannedProduct> = new Map()
  private pendingScans: Map<string, number> = new Map() // Track pending scans by userId+barcode
  private scanHistoryLocks: Map<string, Promise<void>> = new Map() // Lock mechanism for scan history saves
  private activeScans: Map<string, Promise<ScanResult>> = new Map() // Track active scan operations

  static getInstance(): BarcodeService {
    if (!BarcodeService.instance) {
      BarcodeService.instance = new BarcodeService()
    }
    return BarcodeService.instance
  }

  // Main scan function - handles entire flow
  async scanBarcode(barcode: string, userId: string): Promise<ScanResult> {
    // Create a unique key for this scan operation
    const scanOperationKey = `${userId}:${barcode}:${Date.now()}`
    const scanKey = `${userId}:${barcode}`
    
    // Check if there's already an active scan for this exact barcode
    const existingScan = this.activeScans.get(scanKey)
    if (existingScan) {
      console.log('Duplicate scanBarcode call detected - returning existing result')
      return existingScan
    }
    
    // Create the scan promise
    const scanPromise = this.performScanBarcode(barcode, userId, scanKey)
    this.activeScans.set(scanKey, scanPromise)
    
    try {
      const result = await scanPromise
      return result
    } finally {
      // Clean up after a short delay to allow for rapid successive scans
      setTimeout(() => {
        this.activeScans.delete(scanKey)
      }, 2000)
    }
  }

  // Perform the actual scan operation
  private async performScanBarcode(barcode: string, userId: string, scanKey: string): Promise<ScanResult> {
    try {
      let result: ScanResult | null = null
      let scanSessionId: string | undefined

      // 1. Check cache first (fastest)
      if (this.productCache.has(barcode)) {
        const cachedProduct = this.productCache.get(barcode)!
        const scaledProduct = await this.scaleForHousehold(cachedProduct, userId)
        const session = createScanSession({
          userId,
          barcode,
          offFound: true,
          offProductName: cachedProduct.name,
          offBrands: cachedProduct.brand,
          hasIngredientData: Boolean(cachedProduct.ingredients || (cachedProduct.allergens?.length) || (cachedProduct.traces?.length)),
        })
        scanSessionId = session.id
        const allergenCheck = await this.checkForAllergens(scaledProduct, userId, undefined, session.id, 'OFF')
        setBestResult(session.id, allergenCheck, 'OFF')
        result = { found: true, product: scaledProduct, barcode, scanSessionId, allergenCheck }
      }

      // 2. Check local database
      if (!result) {
        const localProduct = await this.checkLocalDatabase(barcode)
        if (localProduct) {
          this.productCache.set(barcode, localProduct)
          const scaledProduct = await this.scaleForHousehold(localProduct, userId)
          const session = createScanSession({
            userId,
            barcode,
            offFound: true,
            offProductName: localProduct.name,
            offBrands: localProduct.brand,
            hasIngredientData: Boolean(localProduct.ingredients || (localProduct.allergens?.length) || (localProduct.traces?.length)),
          })
          scanSessionId = session.id
          const allergenCheck = await this.checkForAllergens(scaledProduct, userId, undefined, session.id, 'OFF')
          setBestResult(session.id, allergenCheck, 'OFF')
          result = { found: true, product: scaledProduct, barcode, scanSessionId, allergenCheck }
        }
      }

      // 3. Try Open Food Facts API
      if (!result) {
        try {
          const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
          const offData = await offResponse.json()

          if (offData.status === 1 && offData.product) {
            const offProductRaw = offData.product
            const norm = normalizeOFFProduct(offProductRaw)
            const hasData = norm && hasUsableOFFAllergenData(norm)

            const session = createScanSession({
              userId,
              barcode,
              offFound: true,
              offProductCode: norm?.product_code ?? barcode,
              offProductName: norm?.product_name,
              offBrands: norm?.brands,
              hasIngredientData: hasData,
            })
            scanSessionId = session.id

            const offProduct = await this.fetchFromOpenFoodFacts(barcode)
            if (offProduct) {
              await this.saveToLocalDatabase(offProduct)
              this.productCache.set(barcode, offProduct)
              const scaledProduct = await this.scaleForHousehold(offProduct, userId)
              const allergenCheck = await this.checkForAllergens(scaledProduct, userId, offData, session.id, 'OFF', norm)
              setBestResult(session.id, allergenCheck, 'OFF')
              result = { found: true, product: scaledProduct, barcode, scanSessionId, allergenCheck }
            }
          }
        } catch (offErr) {
          // OFF fetch failed - continue to not-found path
        }
      }

      // 4. Product not found - UNKNOWN, include session for fallback (OCR/paste)
      if (!result) {
        const session = createScanSession({
          userId,
          barcode,
          offFound: false,
          hasIngredientData: false,
        })
        scanSessionId = session.id
        const allergenCheck = await this.checkForAllergensUnknown(userId, session.id)
        setBestResult(session.id, allergenCheck, 'OFF')
        result = {
          found: false,
          barcode,
          scanSessionId,
          needsManualEntry: true,
          suggestedCategory: 'Other',
          errorMessage: 'Product not found in database. Please add it manually.',
          allergenCheck,
        }
      }

      if (result.found && result.product) {
        await this.saveScanHistory(userId, barcode, result.product.name)
      }

      return result
    } catch (error) {
      console.error('Error scanning barcode:', error)
      return {
        found: false,
        barcode,
        needsManualEntry: true,
        errorMessage: 'Error scanning barcode. Please try again.'
      }
    }
  }

  // Fetch product from Open Food Facts API
  private async fetchFromOpenFoodFacts(barcode: string): Promise<ScannedProduct | null> {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
      const data = await response.json()

      if (data.status !== 1 || !data.product) {
        return null
      }

      const product = data.product

      // Extract nutrition data (per 100g from Open Food Facts)
      const nutriments = product.nutriments || {}
      const servingSize = product.serving_size || product.product_quantity || '100g'
      const servingSizeGrams = this.parseServingSize(servingSize)
      
      // CRITICAL: Open Food Facts provides nutrition per 100g, so we need to scale to actual serving size
      // If serving size is 50g, we multiply per-100g values by 0.5
      const servingScaleFactor = servingSizeGrams / 100

      // Extract expiry date information
      const expiryInfo = this.extractExpiryInfo(product)

      // Calculate accurate nutrition for the actual serving size
      const baseCalories = nutriments.energy_kcal_100g || nutriments['energy-kcal_100g'] || 0
      const baseProtein = nutriments.proteins_100g || 0
      const baseCarbs = nutriments.carbohydrates_100g || 0
      const baseFat = nutriments.fat_100g || 0
      const baseFiber = nutriments.fiber_100g || 0
      const baseSugar = nutriments.sugars_100g || 0
      const baseSodium = nutriments.sodium_100g || 0

      return {
        barcode,
        name: product.product_name || 'Unknown Product',
        brand: product.brands || undefined,
        category: this.mapCategory(product.categories_tags),
        image: product.image_url || product.image_front_url || undefined,
        nutrition: {
          servingSize,
          servingSizeGrams,
          // Scale nutrition values to actual serving size (not per 100g)
          calories: Math.round(baseCalories * servingScaleFactor),
          protein: Math.round((baseProtein * servingScaleFactor) * 10) / 10,
          carbs: Math.round((baseCarbs * servingScaleFactor) * 10) / 10,
          fat: Math.round((baseFat * servingScaleFactor) * 10) / 10,
          fiber: baseFiber > 0 ? Math.round((baseFiber * servingScaleFactor) * 10) / 10 : undefined,
          sugar: baseSugar > 0 ? Math.round((baseSugar * servingScaleFactor) * 10) / 10 : undefined,
          sodium: baseSodium > 0 ? Math.round((baseSodium * servingScaleFactor) * 1000) : undefined // Convert g to mg
        },
        ingredients: product.ingredients_text || product.ingredients_text_en || undefined,
        allergens: product.allergens_tags?.map((tag: string) => tag.replace('en:', '')) || [],
        traces: product.traces_tags?.map((tag: string) => tag.replace('en:', '')) || [],
        expiryDate: expiryInfo.expiryDate,
        shelfLife: expiryInfo.shelfLife,
        storageInstructions: expiryInfo.storageInstructions,
        householdScaled: false,
        source: 'openfoodfacts',
        confidence: product.completeness || 0.7,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching from Open Food Facts:', error)
      return null
    }
  }

  // Check local database for product
  private async checkLocalDatabase(barcode: string): Promise<ScannedProduct | null> {
    try {
      const { data, error } = await supabase
        .from('scanned_products')
        .select('*')
        .eq('barcode', barcode)
        .single()

      if (error || !data) return null

      return data.product_data as ScannedProduct
    } catch (error) {
      console.error('Error checking local database:', error)
      return null
    }
  }

  // Save product to local database
  private async saveToLocalDatabase(product: ScannedProduct): Promise<void> {
    try {
      const { error } = await supabase
        .from('scanned_products')
        .upsert({
          barcode: product.barcode,
          product_data: product,
          name: product.name,
          brand: product.brand,
          category: product.category,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error saving to local database:', error)
      }
    } catch (error) {
      console.error('Error saving to local database:', error)
    }
  }

  // Save scan history to user_scanned_history table
  private async saveScanHistory(userId: string, barcode: string, productName: string): Promise<void> {
    // Create a unique key for this scan to prevent duplicates
    const scanKey = `${userId}:${barcode}`
    const now = Date.now()
    
    // ATOMIC CHECK: Check both pendingScans and locks together to prevent race conditions
    const lastScanTime = this.pendingScans.get(scanKey)
    const existingLock = this.scanHistoryLocks.get(scanKey)
    
    // If there's a recent scan (within 10 seconds) OR an existing lock, skip/wait
    if (lastScanTime && (now - lastScanTime) < 10000) {
      console.log('Duplicate scan detected (in-memory) - skipping history save')
      // If there's a lock, wait for it to complete
      if (existingLock) {
        await existingLock
      }
      return
    }
    
    // If there's an existing lock but no recent scan time, wait for it
    if (existingLock) {
      console.log('Duplicate scan detected (pending lock) - waiting for existing save')
      await existingLock
      // After waiting, check again if a scan was just saved
      const newLastScanTime = this.pendingScans.get(scanKey)
      if (newLastScanTime && (now - newLastScanTime) < 10000) {
        console.log('Scan was saved by waiting operation - skipping duplicate')
        return
      }
    }
    
    // IMMEDIATELY mark as pending and create lock BEFORE any async operations
    // This prevents race conditions where two calls pass the checks simultaneously
    this.pendingScans.set(scanKey, now)
    const savePromise = this.performScanHistorySave(userId, barcode, productName, scanKey, now)
    this.scanHistoryLocks.set(scanKey, savePromise)
    
    try {
      await savePromise
    } finally {
      // Clean up lock after operation completes
      this.scanHistoryLocks.delete(scanKey)
      // Keep pendingScans for 10 seconds to prevent duplicates
      setTimeout(() => {
        this.pendingScans.delete(scanKey)
      }, 10000)
    }
  }

  // Perform the actual scan history save operation
  private async performScanHistorySave(
    userId: string, 
    barcode: string, 
    productName: string, 
    scanKey: string, 
    now: number
  ): Promise<void> {
    try {
      // Check database for recent scans (within last 15 seconds to be safe)
      // Use a slightly longer window to account for any timing differences
      const fifteenSecondsAgo = new Date(now - 15000).toISOString()
      
      const { data: recentScans, error: checkError } = await supabase
        .from('user_scanned_history')
        .select('id, scanned_at')
        .eq('user_id', userId)
        .eq('barcode', barcode)
        .gte('scanned_at', fifteenSecondsAgo)
        .order('scanned_at', { ascending: false })
        .limit(1)

      if (checkError) {
        console.error('Error checking for duplicate scans:', checkError)
        // Continue with insert even if check fails - better to have a duplicate than miss a scan
      }

      // If a recent scan exists in database, don't insert again
      if (recentScans && recentScans.length > 0) {
        const mostRecentScan = recentScans[0]
        const scanTime = new Date(mostRecentScan.scanned_at).getTime()
        const timeDiff = now - scanTime
        
        // Only skip if scan was within last 10 seconds
        if (timeDiff < 10000) {
          console.log('Duplicate scan detected (database) - skipping history save', {
            timeDiff: `${timeDiff}ms`,
            mostRecentScan: mostRecentScan.scanned_at
          })
          return
        }
      }

      // Use the exact timestamp from 'now' to ensure consistency
      const scannedAt = new Date(now).toISOString()

      // Insert new scan history
      const { error } = await supabase
        .from('user_scanned_history')
        .insert({
          user_id: userId,
          barcode: barcode,
          product_name: productName,
          scanned_at: scannedAt,
          added_to_pantry: false
        })

      if (error) {
        // Check if error is due to duplicate (shouldn't happen with our checks, but handle gracefully)
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          console.log('Duplicate scan detected (database constraint) - skipping history save')
          return
        }
        console.error('Error saving scan history:', error)
        throw error
      } else {
        console.log('Scan history saved successfully:', { userId, barcode, productName, scannedAt })
      }
    } catch (error) {
      console.error('Error in performScanHistorySave:', error)
      throw error
    }
  }

  // Scale product for household size
  private async scaleForHousehold(product: ScannedProduct, userId: string): Promise<ScannedProduct> {
    try {
      const preferences = await userPreferencesService.loadPreferences(userId)
      const householdSize = preferences?.household?.size ? parseInt(preferences.household.size) : 1

      if (householdSize <= 1) {
        return product // No scaling needed
      }

      // Scale nutrition based on household size
      const scaleFactor = householdSize
      const originalServing = product.nutrition.servingSize
      
      return {
        ...product,
        nutrition: {
          ...product.nutrition,
          calories: Math.round(product.nutrition.calories * scaleFactor),
          protein: Math.round(product.nutrition.protein * scaleFactor * 10) / 10,
          carbs: Math.round(product.nutrition.carbs * scaleFactor * 10) / 10,
          fat: Math.round(product.nutrition.fat * scaleFactor * 10) / 10,
          fiber: product.nutrition.fiber ? Math.round(product.nutrition.fiber * scaleFactor * 10) / 10 : undefined,
          sugar: product.nutrition.sugar ? Math.round(product.nutrition.sugar * scaleFactor * 10) / 10 : undefined,
          sodium: product.nutrition.sodium ? Math.round(product.nutrition.sodium * scaleFactor) : undefined
        },
        householdScaled: true,
        originalServing,
        scaledServing: `${householdSize} servings`,
        householdSize
      }
    } catch (error) {
      console.error('Error scaling for household:', error)
      return product
    }
  }

  // Manual entry for products not found
  async addManualProduct(productData: {
    barcode: string
    name: string
    brand?: string
    category: string
    nutrition: {
      servingSize: string
      calories: number
      protein: number
      carbs: number
      fat: number
    }
  }, userId: string): Promise<ScannedProduct> {
    const manualProduct: ScannedProduct = {
      barcode: productData.barcode,
      name: productData.name,
      brand: productData.brand,
      category: productData.category,
      nutrition: {
        servingSize: productData.nutrition.servingSize,
        calories: productData.nutrition.calories,
        protein: productData.nutrition.protein,
        carbs: productData.nutrition.carbs,
        fat: productData.nutrition.fat
      },
      householdScaled: false,
      source: 'manual',
      confidence: 1.0,
      lastUpdated: new Date().toISOString()
    }

    // Save to database for community benefit
    await this.saveToLocalDatabase(manualProduct)
    this.productCache.set(productData.barcode, manualProduct)

    // Save scan history for manual products too
    await this.saveScanHistory(userId, productData.barcode, productData.name)

    // Return scaled version
    return await this.scaleForHousehold(manualProduct, userId)
  }

  // Helper: Parse serving size to grams
  private parseServingSize(servingSize: string): number {
    if (!servingSize || typeof servingSize !== 'string') {
      return 100 // Default to 100g if no serving size provided
    }

    // Try to extract number and unit from various formats
    // Examples: "100g", "50 g", "2.5 oz", "250ml", "1 cup", "1 piece"
    const match = servingSize.match(/(\d+\.?\d*)\s*(g|gram|grams|ml|milliliter|milliliters|oz|ounce|ounces|kg|kilogram|kilograms|lb|pound|pounds)/i)
    
    if (!match) {
      // If no unit found, try to extract just a number (assume grams)
      const numberMatch = servingSize.match(/(\d+\.?\d*)/)
      if (numberMatch) {
        return parseFloat(numberMatch[1])
      }
      return 100 // Default to 100g
    }

    const amount = parseFloat(match[1])
    const unit = match[2].toLowerCase()

    // Convert to grams
    if (unit === 'g' || unit === 'gram' || unit === 'grams') {
      return amount
    }
    if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') {
      return amount * 1000
    }
    if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
      return Math.round(amount * 28.35) // Convert oz to grams
    }
    if (unit === 'lb' || unit === 'pound' || unit === 'pounds') {
      return Math.round(amount * 453.6) // Convert lbs to grams
    }
    if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
      // For liquids, assume 1ml = 1g (water density)
      // This is approximate but reasonable for most beverages
      return amount
    }

    return amount // Default: assume grams
  }

  // Extract expiry date information from Open Food Facts product data
  // NOTE: Expiry dates are NOT extracted from barcode scans - users should scan expiry dates separately
  private extractExpiryInfo(product: any): {
    expiryDate?: string
    shelfLife?: number
    storageInstructions?: string
  } {
    const result: {
      expiryDate?: string
      shelfLife?: number
      storageInstructions?: string
    } = {}

    // Expiry dates are NOT extracted from barcode scans - removed per user request
    // Users should scan expiry dates separately if needed

    // Extract shelf life information (still useful for predictions)
    const shelfLife = product.shelf_life || product.shelf_life_days
    if (shelfLife) {
      const days = parseInt(shelfLife.toString())
      if (!isNaN(days)) {
        result.shelfLife = days
      }
    }

    // Extract storage instructions
    const storage = product.storage_instructions || product.storage_conditions
    if (storage) {
      result.storageInstructions = storage
    }

    return result
  }

  // Parse various expiry date formats (ENHANCED FOR ACCURACY)
  private parseExpiryDate(dateString: string): string | null {
    try {
      if (!dateString || typeof dateString !== 'string') {
        return null
      }

      // Clean the input string
      const cleaned = dateString.trim().replace(/\s+/g, ' ')

      // Handle various date formats with comprehensive patterns
      const formats = [
        // ISO and standard formats
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
        /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
        /^(\d{4})\.(\d{2})\.(\d{2})$/, // YYYY.MM.DD
        
        // US format (MM/DD/YYYY)
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY or MM/DD/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // M-D-YYYY or MM-DD-YYYY
        
        // European format (DD/MM/YYYY)
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // D/M/YYYY or DD/MM/YYYY (ambiguous - try both)
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // D.M.YYYY or DD.MM.YYYY
        
        // Two-digit year formats
        /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // M/D/YY or MM/DD/YY
        /^(\d{1,2})-(\d{1,2})-(\d{2})$/, // M-D-YY or MM-DD-YY
        
        // Compact formats
        /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
        /^(\d{2})(\d{2})(\d{2})$/, // YYMMDD or MMDDYY (ambiguous)
        
        // Text month formats
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i, // DD MMM YYYY
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})$/i, // MMM DD, YYYY
        
        // Compact month abbreviation formats (e.g., "2026 JA 09", "2025 FE 15")
        /^(\d{4})\s+(JA|FE|MR|AP|MY|JN|JL|AU|SE|OC|NO|DE|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i, // YYYY MMM DD
        /^(\d{4})(JA|FE|MR|AP|MY|JN|JL|AU|SE|OC|NO|DE|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})$/i, // YYYYMMMDD (no spaces)
      ]

      const monthNames: Record<string, number> = {
        'jan': 1, 'ja': 1, 'january': 1,
        'feb': 2, 'fe': 2, 'february': 2,
        'mar': 3, 'mr': 3, 'march': 3,
        'apr': 4, 'ap': 4, 'april': 4,
        'may': 5, 'my': 5,
        'jun': 6, 'jn': 6, 'june': 6,
        'jul': 7, 'jl': 7, 'july': 7,
        'aug': 8, 'au': 8, 'august': 8,
        'sep': 9, 'se': 9, 'september': 9,
        'oct': 10, 'oc': 10, 'october': 10,
        'nov': 11, 'no': 11, 'november': 11,
        'dec': 12, 'de': 12, 'december': 12
      }

      for (let i = 0; i < formats.length; i++) {
        const format = formats[i]
        const match = cleaned.match(format)
        
        if (match) {
          let year: string | number, month: string | number, day: string | number

          if (i === 0 || i === 1 || i === 2) { // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
            [, year, month, day] = match
          } else if (i >= 3 && i <= 4) { // US format MM/DD/YYYY or MM-DD-YYYY
            [, month, day, year] = match
          } else if (i === 5 || i === 6) { // European format DD/MM/YYYY or DD.MM.YYYY
            // Try both interpretations (DD/MM/YYYY and MM/DD/YYYY)
            const first = parseInt(match[1])
            const second = parseInt(match[2])
            
            // Heuristic: if first number > 12, it's likely DD/MM format
            if (first > 12) {
              [, day, month, year] = match
            } else if (second > 12) {
              [, month, day, year] = match
            } else {
              // Ambiguous - try DD/MM first (more common for expiry dates)
              [, day, month, year] = match
            }
          } else if (i === 7 || i === 8) { // Two-digit year
            [, month, day, year] = match
            const yearNum = parseInt(year)
            // Assume 20xx if year is 00-50, 19xx if 51-99
            year = yearNum <= 50 ? `20${year.padStart(2, '0')}` : `19${year}`
          } else if (i === 9) { // YYYYMMDD
            [, year, month, day] = match
          } else if (i === 10) { // YYMMDD or MMDDYY (ambiguous)
            // Try YYMMDD first (more common)
            const first = match[1]
            const second = match[2]
            const third = match[3]
            if (parseInt(first) >= 50) {
              // Likely YYMMDD
              year = `20${first}`
              month = second
              day = third
            } else {
              // Likely MMDDYY
              month = first
              day = second
              year = `20${third}`
            }
          } else if (i === 11) { // DD MMM YYYY
            [, day, monthName, year] = match
            month = monthNames[monthName.toLowerCase()]
          } else if (i === 12) { // MMM DD, YYYY
            [, monthName, day, year] = match
            month = monthNames[monthName.toLowerCase()]
          } else if (i === 13) { // YYYY MMM DD (e.g., "2026 JA 09")
            [, year, monthName, day] = match
            month = monthNames[monthName.toLowerCase()]
          } else if (i === 14) { // YYYYMMMDD (e.g., "2026JA09")
            [, year, monthName, day] = match
            month = monthNames[monthName.toLowerCase()]
          }

          // Validate and construct date
          if (year && month && day) {
            const yearNum = parseInt(year.toString())
            const monthNum = parseInt(month.toString())
            const dayNum = parseInt(day.toString())

            // Basic validation
            if (yearNum < 1900 || yearNum > 2100) continue
            if (monthNum < 1 || monthNum > 12) continue
            if (dayNum < 1 || dayNum > 31) continue

            // Create date and validate it's correct
            const date = new Date(yearNum, monthNum - 1, dayNum)
            
            // Verify the date components match (catches invalid dates like Feb 30)
            if (date.getFullYear() === yearNum && 
                date.getMonth() === monthNum - 1 && 
                date.getDate() === dayNum) {
              
              // Additional reasonableness check for expiry dates
              const now = new Date()
              const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
              const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())
              
              // Expiry dates should be reasonable (not too far in past or future)
              if (date >= oneYearAgo && date <= tenYearsFromNow) {
                return date.toISOString().split('T')[0] // Return YYYY-MM-DD format
              }
            }
          }
        }
      }

      // Try direct Date parsing as fallback (for formats like "Dec 25, 2025")
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) {
        const now = new Date()
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())
        
        if (date >= oneYearAgo && date <= tenYearsFromNow) {
          return date.toISOString().split('T')[0]
        }
      }
    } catch (error) {
      console.warn('Error parsing expiry date:', dateString, error)
    }

    return null
  }

  // Helper: Map Open Food Facts categories to SAVR categories
  private mapCategory(categories: string[] = []): string {
    const categoryMap: { [key: string]: string } = {
      'en:beverages': 'Beverages',
      'en:snacks': 'Snacks',
      'en:dairy': 'Dairy',
      'en:meats': 'Meat',
      'en:seafood': 'Seafood',
      'en:fruits': 'Produce',
      'en:vegetables': 'Produce',
      'en:cereals': 'Grains',
      'en:breads': 'Grains',
      'en:condiments': 'Condiments',
      'en:desserts': 'Snacks',
      'en:frozen-foods': 'Frozen'
    }

    for (const category of categories) {
      if (categoryMap[category]) {
        return categoryMap[category]
      }
    }

    return 'Other'
  }

  // Get barcode format info (for validation)
  getBarcodeInfo(barcode: string): {
    valid: boolean
    format: 'UPC-A' | 'UPC-E' | 'EAN-13' | 'EAN-8' | 'Unknown'
    type: string
  } {
    const length = barcode.length

    if (length === 12 && /^\d+$/.test(barcode)) {
      return { valid: true, format: 'UPC-A', type: 'Universal Product Code' }
    } else if (length === 13 && /^\d+$/.test(barcode)) {
      return { valid: true, format: 'EAN-13', type: 'European Article Number' }
    } else if (length === 8 && /^\d+$/.test(barcode)) {
      return { valid: true, format: 'EAN-8', type: 'European Article Number (Short)' }
    } else if (length === 6 && /^\d+$/.test(barcode)) {
      return { valid: true, format: 'UPC-E', type: 'Universal Product Code (Short)' }
    }

    return { valid: false, format: 'Unknown', type: 'Invalid barcode format' }
  }

  // Clear cache (for memory management)
  clearCache(): void {
    this.productCache.clear()
  }

  // Get cache stats (for debugging)
  getCacheStats(): { size: number; products: string[] } {
    return {
      size: this.productCache.size,
      products: Array.from(this.productCache.keys())
    }
  }

  // Check for allergens - EVIDENCE-BASED ENGINE (single source of truth)
  async checkForAllergens(
    product: ScannedProduct,
    userId: string,
    offProductData?: any,
    scanSessionId?: string,
    dataSource: 'OFF' | 'OCR' | 'MANUAL' = 'OFF',
    normalizedOFF?: import('./allergenEngine/offNormalizer').NormalizedOFFData
  ): Promise<AllergenCheckResult> {
    try {
      const preferences = await userPreferencesService.loadPreferences(userId)
      const userAllergensRaw = preferences?.dietary?.allergies || []

      if (userAllergensRaw.length === 0) {
        return {
          hasAllergens: false,
          detectedAllergens: [],
          userAllergens: [],
          riskLevel: 'NO_MATCH_FOUND',
          matches: [],
          message: 'No allergies set for your household.'
        }
      }

      const input = normalizedOFF
        ? toDetectionInputFromNormalized(normalizedOFF, product.name)
        : toDetectionInput(product, offProductData?.product)
      const userConfig = buildUserAllergenConfig(userAllergensRaw)
      const output = detectAllergensEvidenceBased(input, userConfig)
      const result = toLegacyAllergenCheckResult(output, userAllergensRaw) as AllergenCheckResult

      if (result.scannedText) {
        result.scannedText.productName = product.name
      }

      result.dataSource = dataSource
      result.sourceLabel = getSourceLabel(dataSource)

      logAllergenScan({
        userId,
        barcode: product.barcode,
        productName: product.name,
        output,
        scanSessionId,
        dataSource,
        offFound: !!offProductData?.product,
        sourceQuality: normalizedOFF?.source_quality,
      }).catch(() => {})

      return result as AllergenCheckResult
    } catch (error) {
      console.error('Error checking for allergens:', error)
      const prefs = await userPreferencesService.loadPreferences(userId)
      return {
        hasAllergens: false,
        detectedAllergens: [],
        userAllergens: prefs?.dietary?.allergies || [],
        riskLevel: 'INSUFFICIENT_DATA',
        matches: [],
        message: 'Ingredients unavailable; cannot verify allergens. Scan label photo or paste ingredients manually to check.'
      }
    }
  }

  private async checkForAllergensUnknown(userId: string, scanSessionId: string): Promise<AllergenCheckResult> {
    const prefs = await userPreferencesService.loadPreferences(userId)
    const userAllergensRaw = prefs?.dietary?.allergies || []
    if (userAllergensRaw.length === 0) {
      return {
        hasAllergens: false,
        detectedAllergens: [],
        userAllergens: [],
        riskLevel: 'NO_MATCH_FOUND',
        matches: [],
        message: 'No allergies set for your household.',
        dataSource: 'OFF',
        sourceLabel: getSourceLabel('OFF'),
      }
    }
    return {
      hasAllergens: false,
      detectedAllergens: [],
      userAllergens: userAllergensRaw,
      riskLevel: 'INSUFFICIENT_DATA',
      matches: [],
      message: 'Ingredients unavailable; cannot verify allergens.',
      fallbackCtas: { scanLabelPhoto: true, pasteIngredientsManually: true },
      dataSource: 'OFF',
      sourceLabel: getSourceLabel('OFF'),
    }
  }

  // Legacy fallback when OFF detection throws
  private async checkForAllergensLegacy(product: ScannedProduct, userId: string): Promise<AllergenCheckResult> {
    return this.checkForAllergens(product, userId)
  }

  // NOTE: Old legacy allergen detection and checkForAllergensUsingOFF removed.
  // All detection now uses evidence-based engine in lib/allergenEngine.
}

/** Log allergen scan for audit/debug. Fire-and-forget; does not block. */
async function logAllergenScan(params: {
  userId: string
  barcode: string
  productName?: string
  output: { scan_log: { ingredients_text_used: string; contains_text_used: string; may_contain_text_used: string; has_ingredient_data: boolean; source_coverage_score?: number }; overall_status: string; matched_allergens: Array<{ allergen_id: string; allergen_name: string; severity: string; section: string; match_text: string }> }
  scanSessionId?: string
  dataSource?: 'OFF' | 'OCR' | 'MANUAL'
  offFound?: boolean
  sourceQuality?: { ingredients_present: boolean; allergens_tags_present: boolean; traces_tags_present: boolean }
}): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: params.userId,
    barcode: params.barcode,
    product_name: params.productName,
    ingredients_text_used: params.output.scan_log.ingredients_text_used,
    contains_text_used: params.output.scan_log.contains_text_used,
    may_contain_text_used: params.output.scan_log.may_contain_text_used,
    has_ingredient_data: params.output.scan_log.has_ingredient_data,
    overall_status: (params.output.scan_log.has_ingredient_data ? params.output.overall_status : 'UNKNOWN') as string,
    matched_allergens: params.output.matched_allergens,
    source_coverage_score: params.output.scan_log.source_coverage_score,
    scan_session_id: params.scanSessionId,
    data_source: params.dataSource ?? 'OFF',
    off_found: params.offFound,
  }
  const { error } = await supabase.from('allergen_scan_logs').insert(row)
  if (error) {
    // Table may not exist or RLS may block; ignore
  }
}

export const barcodeService = BarcodeService.getInstance()

/** Build AllergenCheckResult from engine output for OCR/manual flows (with dataSource) */
export async function buildAllergenCheckResultFromEngine(
  input: { ingredients_text: string; contains_text?: string; may_contain_text?: string },
  userId: string,
  dataSource: 'OCR' | 'MANUAL'
): Promise<AllergenCheckResult> {
  const prefs = await userPreferencesService.loadPreferences(userId)
  const userAllergensRaw = prefs?.dietary?.allergies || []
  if (userAllergensRaw.length === 0) {
    return {
      hasAllergens: false,
      detectedAllergens: [],
      userAllergens: [],
      riskLevel: 'NO_MATCH_FOUND',
      matches: [],
      message: 'No allergies set for your household.',
      dataSource,
      sourceLabel: getSourceLabel(dataSource),
    }
  }
  const userConfig = buildUserAllergenConfig(userAllergensRaw)
  const output = detectAllergensEvidenceBased(input, userConfig)
  const result = toLegacyAllergenCheckResult(output, userAllergensRaw) as AllergenCheckResult
  result.dataSource = dataSource
  result.sourceLabel = getSourceLabel(dataSource)
  if (result.scannedText) {
    result.scannedText.ingredientsText = output.scan_log.ingredients_text_used
    result.scannedText.allergensText = output.scan_log.contains_text_used
    result.scannedText.tracesText = output.scan_log.may_contain_text_used
  }
  return result
}

