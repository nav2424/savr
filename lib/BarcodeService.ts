// SAVR Barcode Service - Scans barcodes and fetches product data with household scaling
import { supabase } from './supabase'
import { userPreferencesService } from './UserPreferencesService'

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
  allergen: string              // user-selected allergen (canonical)
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
}

export interface ScanResult {
  found: boolean
  product?: ScannedProduct
  barcode: string
  needsManualEntry?: boolean
  suggestedCategory?: string
  errorMessage?: string
  allergenCheck?: AllergenCheckResult
}

// Allergen ontology: families, derivatives, multilingual terms
interface AllergenProfile {
  canonical: string
  aliases: string[]      // direct synonyms + common label terms
  derivatives: string[]  // ingredient derivatives
  excludes?: string[]    // terms that should NOT trigger this allergen (false positive prevention)
}

const ALLERGEN_MAP: Record<string, AllergenProfile> = {
  milk: {
    canonical: 'milk',
    aliases: [
      'milk', 'dairy', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'kefir', 'curds',
      'ghee', 'buttermilk', 'sour cream', 'whipped cream', 'heavy cream', 'light cream',
      'half and half', 'cream cheese', 'ricotta', 'mascarpone', 'cottage cheese'
    ],
    derivatives: [
      'whey', 'casein', 'caseinate', 'lactose', 'lactalbumin', 'lactoglobulin',
      'milk powder', 'milk solids', 'skim milk', 'whole milk', 'milk protein',
      'milk fat', 'milk sugar', 'nonfat dry milk', 'dry milk', 'evaporated milk',
      'condensed milk', 'milk derivative'
    ],
    excludes: [
      // Prevent false positives - these contain "milk" but aren't dairy
      'soy milk', 'almond milk', 'coconut milk', 'oat milk', 'rice milk', 'hemp milk',
      'milk thistle', 'milkweed'
    ],
  },
  egg: {
    canonical: 'egg',
    aliases: ['egg', 'eggs', 'egg yolk', 'egg white', 'albumen', 'albumin'],
    derivatives: [
      'ovalbumin', 'ovomucoid', 'ovoglobulin', 'lysozyme', 'lecithin',
      'egg powder', 'dried egg', 'egg solids', 'egg protein', 'globulin'
    ],
    excludes: [
      // Prevent false positives - these contain "egg" but aren't egg allergens
      'vegetable', 'vegetables', 'legume', 'legumes', 'eggplant', 'eggnog', // eggnog actually contains eggs
      'chocolate', 'cocoa', 'cacao' // Chocolate doesn't contain eggs (unless specifically added)
    ],
  },
  peanut: {
    canonical: 'peanut',
    aliases: ['peanut', 'peanuts', 'groundnut', 'ground nuts', 'arachis'],
    derivatives: [
      'peanut oil', 'peanut butter', 'peanut flour', 'peanut protein',
      'peanut extract', 'peanut paste', 'peanut meal'
    ],
  },
  tree_nuts: {
    canonical: 'tree_nuts',
    aliases: ['tree nuts', 'tree nut', 'nuts', 'nut'],
    derivatives: [
      'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts',
      'pecan', 'pecans', 'hazelnut', 'hazelnuts', 'pistachio', 'pistachios',
      'macadamia', 'macadamias', 'brazil nut', 'brazil nuts', 'pine nut', 'pine nuts',
      'chestnut', 'chestnuts', 'beechnut', 'beechnuts', 'pili nut', 'pili nuts',
      'almond oil', 'walnut oil', 'hazelnut oil', 'cashew butter', 'almond butter'
    ],
  },
  wheat: {
    canonical: 'wheat',
    aliases: ['wheat', 'whole wheat', 'wheat flour', 'enriched wheat flour'],
    derivatives: [
      'durum', 'semolina', 'farina', 'bulgur', 'couscous', 'graham',
      'wheat starch', 'wheat protein', 'wheat germ', 'wheat bran',
      'wheat berries', 'wheat gluten', 'vital wheat gluten'
    ],
    excludes: [
      // Prevent false positives - these contain "wheat" but aren't wheat allergens
      'wheatgrass', 'sweet wheat'
    ],
  },
  gluten: {
    canonical: 'gluten',
    aliases: ['gluten', 'wheat gluten', 'vital wheat gluten'],
    derivatives: [
      // Gluten grains
      'wheat', 'barley', 'rye', 'malt', 'malt extract', 'malt syrup',
      'malt vinegar', 'malt flour', 'barley malt', 'brewer\'s yeast',
      'maltose', 'maltodextrin', 'triticale', 'farro', 'einkorn', 'emmer',
      'rye flour', 'rye bread', 'rye malt',
      // Processed ingredients that often contain gluten
      'modified food starch', 'hydrolyzed vegetable protein',
      'textured vegetable protein', 'natural flavoring', 'artificial flavoring',
      'dextrin', 'caramel color', 'malt flavoring'
    ],
    excludes: [
      // Prevent false positives - these contain "glut" but aren't gluten
      'glutamate', 'monosodium glutamate', 'msg', 'glutamic acid', 'glutamine',
      'glutathione', 'glutamic', 'glutamate sodium'
    ],
  },
  soy: {
    canonical: 'soy',
    aliases: ['soy', 'soya', 'soybean', 'soybeans'],
    derivatives: [
      'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy lecithin',
      'soy protein', 'soy oil', 'soy flour', 'soy isolate', 'soy concentrate',
      'textured soy protein', 'soy milk', 'soy yogurt'
    ],
  },
  fish: {
    canonical: 'fish',
    aliases: ['fish'],
    derivatives: [
      'anchovy', 'anchovies', 'bass', 'catfish', 'cod', 'flounder', 'grouper',
      'haddock', 'hake', 'halibut', 'herring', 'mahi', 'perch', 'pike', 'pollock',
      'salmon', 'sardine', 'sardines', 'snapper', 'sole', 'swordfish', 'tilapia',
      'trout', 'tuna', 'fish oil', 'fish sauce', 'fish paste', 'fish extract'
    ],
  },
  shellfish: {
    canonical: 'shellfish',
    aliases: ['shellfish', 'crustacean', 'crustaceans', 'mollusk', 'mollusks'],
    derivatives: [
      'shrimp', 'prawn', 'prawns', 'crab', 'crabs', 'lobster', 'lobsters',
      'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'scallops',
      'squid', 'octopus', 'crawfish', 'crayfish', 'crab meat', 'shrimp paste',
      'lobster paste', 'crab extract'
    ],
  },
  sesame: {
    canonical: 'sesame',
    aliases: ['sesame', 'sesame seeds', 'sesame seed'],
    derivatives: [
      'tahini', 'sesamol', 'sesamolin', 'sesame oil', 'sesame paste',
      'halva', 'halvah', 'benne', 'simsim', 'sesame flour'
    ],
  },
  mustard: {
    canonical: 'mustard',
    aliases: ['mustard', 'mustard seed', 'mustard seeds'],
    derivatives: [
      'mustard oil', 'mustard powder', 'mustard flour', 'mustard extract'
    ],
  },
  sulfites: {
    canonical: 'sulfites',
    aliases: ['sulfites', 'sulphites', 'sulfiting agents'],
    derivatives: [
      'sulfur dioxide', 'sodium sulfite', 'sodium bisulfite', 'sodium metabisulfite',
      'potassium sulfite', 'potassium bisulfite', 'potassium metabisulfite'
    ],
  },
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
      
      // 1. Check cache first (fastest)
      if (this.productCache.has(barcode)) {
        const cachedProduct = this.productCache.get(barcode)!
        const scaledProduct = await this.scaleForHousehold(cachedProduct, userId)
        const allergenCheck = await this.checkForAllergens(scaledProduct, userId)
        result = { found: true, product: scaledProduct, barcode, allergenCheck }
      }

      // 2. Check local database
      if (!result) {
        const localProduct = await this.checkLocalDatabase(barcode)
        if (localProduct) {
          this.productCache.set(barcode, localProduct)
          const scaledProduct = await this.scaleForHousehold(localProduct, userId)
          const allergenCheck = await this.checkForAllergens(scaledProduct, userId)
          result = { found: true, product: scaledProduct, barcode, allergenCheck }
        }
      }

      // 3. Try Open Food Facts API
      if (!result) {
        const offProduct = await this.fetchFromOpenFoodFacts(barcode)
        if (offProduct) {
          // Save to local database for future
          await this.saveToLocalDatabase(offProduct)
          this.productCache.set(barcode, offProduct)
          const scaledProduct = await this.scaleForHousehold(offProduct, userId)
          const allergenCheck = await this.checkForAllergens(scaledProduct, userId)
          result = { found: true, product: scaledProduct, barcode, allergenCheck }
        }
      }

      // 4. Product not found - suggest manual entry
      if (!result) {
        result = {
          found: false,
          barcode,
          needsManualEntry: true,
          suggestedCategory: 'Other',
          errorMessage: 'Product not found in database. Please add it manually.'
        }
      }

      // Save scan history if product was found
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

    // Try to extract best before / use by date
    const bestBefore = product.best_before_date || product.best_before
    const useBy = product.use_by_date || product.use_by
    const expiryDate = bestBefore || useBy

    if (expiryDate) {
      // Parse various date formats
      const parsedDate = this.parseExpiryDate(expiryDate)
      if (parsedDate) {
        result.expiryDate = parsedDate
      }
    }

    // Extract shelf life information
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

  // Text normalization helpers for bulletproof matching
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[\(\)\[\]\{\}]/g, ' ')
      .replace(/[^a-z0-9%/ \-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private tokenize(text: string): string[] {
    return this.normalize(text).split(' ').filter(Boolean)
  }

  // Check if a term matches as a whole word (prevents false positives)
  private isWholeWordMatch(text: string, term: string): boolean {
    const normalizedText = this.normalize(text)
    const normalizedTerm = this.normalize(term)
    
    // Exact phrase match (for multi-word terms)
    if (normalizedTerm.includes(' ')) {
      return normalizedText.includes(normalizedTerm)
    }
    
    // Whole word match using word boundaries
    // Match: "milk" in "contains milk" or "milk protein"
    // Don't match: "milk" in "buttermilk" or "milky"
    const wordBoundaryRegex = new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    return wordBoundaryRegex.test(normalizedText)
  }

  // Comprehensive allergen ontology with families, derivatives, and multilingual terms
  private getAllergenProfile(canonical: string): AllergenProfile | null {
    return ALLERGEN_MAP[canonical] || null
  }

  // Check for allergens in a product based on user preferences (BULLETPROOF VERSION)
  async checkForAllergens(product: ScannedProduct, userId: string): Promise<AllergenCheckResult> {
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

      // Normalize user allergens to canonical form
      const userAllergens = userAllergensRaw.map(a => this.normalizeToCanonical(a))
      const userAllergensCanonical = Array.from(new Set(userAllergens))

      // Extract all relevant text fields from product
      const productName = product.name || ''
      const ingredientsText = product.ingredients || ''
      const allergensText = (product.allergens || []).join(', ')
      const tracesText = (product.traces || []).join(', ')

      // Fail-safe: Check if we have ANY data
      const hasAnyData = Boolean(
        (ingredientsText && ingredientsText.trim()) ||
        (allergensText && allergensText.trim()) ||
        (tracesText && tracesText.trim())
      )

      if (!hasAnyData) {
        return {
          hasAllergens: false,
          detectedAllergens: [],
          userAllergens: userAllergensRaw,
          riskLevel: 'INSUFFICIENT_DATA',
          matches: [],
          message: 'We couldn\'t verify ingredients for this product. Please confirm from the label.',
          scannedText: {
            ingredientsText,
            allergensText,
            tracesText,
            productName
          }
        }
      }

      // Create searchable blob from all text fields
      const blob = this.normalize([productName, ingredientsText, allergensText, tracesText]
        .filter(Boolean)
        .join(' | '))
      const tokens = new Set(this.tokenize(blob))

      const matches: AllergenMatch[] = []

      const addMatch = (
        canonical: string,
        matchedTerm: string,
        source: AllergenMatch['source'],
        confidence: AllergenMatch['confidence']
      ) => {
        // Avoid duplicates
        const existing = matches.find(m => 
          m.allergen === canonical && 
          m.matchedTerm === matchedTerm && 
          m.source === source
        )
        if (!existing) {
          matches.push({ allergen: canonical, matchedTerm, source, confidence })
        }
      }

      // Check each user allergen
      for (const userAllergenCanonical of userAllergensCanonical) {
        const profile = this.getAllergenProfile(userAllergenCanonical)
        
        // Check exclusions first - if any exclusion matches in ingredients, skip this allergen
        const searchableText = [ingredientsText, allergensText, tracesText]
          .filter(Boolean)
          .join(' | ')
        const normalizedSearchable = this.normalize(searchableText)
        
        if (profile?.excludes) {
          const hasExclusion = profile.excludes.some(exclusion => {
            const normalizedExclusion = this.normalize(exclusion)
            return this.isWholeWordMatch(normalizedSearchable, normalizedExclusion)
          })
          if (hasExclusion) {
            console.log(`Skipping ${userAllergenCanonical} due to exclusion match`)
            continue // Skip this allergen if exclusion found
          }
        }
        
        // Get all terms to check (aliases + derivatives + canonical)
        const terms = profile
          ? [...profile.aliases, ...profile.derivatives, profile.canonical]
          : [userAllergenCanonical]

        for (const term of terms) {
          const normalizedTerm = this.normalize(term)

          // CRITICAL: Only check in ingredients/allergens/traces, NOT product name
          // Product names can contain false positives (e.g., "chocolate" might match "egg" incorrectly)
          const searchableText = [ingredientsText, allergensText, tracesText]
            .filter(Boolean)
            .join(' | ')
          const normalizedSearchable = this.normalize(searchableText)

          // Layer A: Phrase match (for multi-word terms) - must be exact phrase
          if (normalizedTerm.includes(' ')) {
            if (this.isWholeWordMatch(normalizedSearchable, normalizedTerm)) {
              const source = this.inferSource(
                term,
                ingredientsText,
                allergensText,
                tracesText,
                productName
              )
              addMatch(
                profile?.canonical || userAllergenCanonical,
                term,
                source,
                'HIGH'
              )
              break // Found match, move to next allergen
            }
            continue
          }

          // Layer B: Whole word match (prevents false positives like "milk" in "buttermilk")
          // Only match if it's a complete word, not part of another word
          // ONLY check in ingredients/allergens/traces, NOT product name
          if (this.isWholeWordMatch(normalizedSearchable, normalizedTerm)) {
            const source = this.inferSource(
              term,
              ingredientsText,
              allergensText,
              tracesText,
              productName
            )
            addMatch(
              profile?.canonical || userAllergenCanonical,
              term,
              source,
              'HIGH'
            )
            break // Found match, move to next allergen
          }

          // Layer C: Substring match - REMOVED to prevent false positives
          // This was causing too many false matches (e.g., "gluten" matching in "glutamate")
          // Only use exact token matches for accuracy
        }
      }

      // Determine risk level
      const detected = Array.from(new Set(matches.map(m => m.allergen)))
      const hasTracesHit = matches.some(m => m.source === 'traces')
      
      let riskLevel: AllergenRiskLevel
      if (detected.length === 0) {
        riskLevel = 'NO_MATCH_FOUND'
      } else if (hasTracesHit) {
        riskLevel = 'POSSIBLE_RISK'
      } else {
        riskLevel = 'HIGH_RISK'
      }

      // Generate user-friendly message
      let message: string
      if (riskLevel === 'NO_MATCH_FOUND') {
        message = 'All good for your household.'
      } else if (riskLevel === 'POSSIBLE_RISK') {
        message = 'Potential allergy risk (cross-contact or facility warning).'
      } else {
        message = `Allergies detected: ${detected.join(', ')}`
      }

      // Map canonical back to user's original allergen names for display
      const detectedAllergensDisplay = detected.map(canonical => {
        const original = userAllergensRaw.find(raw => 
          this.normalizeToCanonical(raw) === canonical
        )
        return original || canonical
      })

      return {
        // Legacy fields
        hasAllergens: detected.length > 0,
        detectedAllergens: detectedAllergensDisplay,
        userAllergens: userAllergensRaw,
        // New bulletproof fields
        riskLevel,
        matches,
        message,
        scannedText: {
          ingredientsText,
          allergensText,
          tracesText,
          productName
        }
      }
    } catch (error) {
      console.error('Error checking for allergens:', error)
      return {
        hasAllergens: false,
        detectedAllergens: [],
        userAllergens: [],
        riskLevel: 'INSUFFICIENT_DATA',
        matches: [],
        message: 'Error checking allergens. Please verify from the label.'
      }
    }
  }

  // Infer which source field contained the match
  private inferSource(
    term: string,
    ingredients: string,
    allergens: string,
    traces: string,
    name: string
  ): AllergenMatch['source'] {
    const normalizedTerm = this.normalize(term)
    const normalizedAllergens = this.normalize(allergens)
    const normalizedTraces = this.normalize(traces)
    const normalizedIngredients = this.normalize(ingredients)
    const normalizedName = this.normalize(name)

    if (normalizedAllergens.includes(normalizedTerm)) return 'allergens'
    if (normalizedTraces.includes(normalizedTerm)) return 'traces'
    if (normalizedIngredients.includes(normalizedTerm)) return 'ingredients'
    if (normalizedName.includes(normalizedTerm)) return 'product_name'
    return 'ingredients' // Default fallback
  }

  // Normalize user-entered allergen to canonical form
  private normalizeToCanonical(allergen: string): string {
    const normalized = this.normalize(allergen)
    
    // Map common variations to canonical forms
    const canonicalMap: Record<string, string> = {
      'dairy': 'milk',
      'milk products': 'milk',
      'lactose': 'milk',
      'egg': 'egg',
      'eggs': 'egg',
      'peanut': 'peanut',
      'peanuts': 'peanut',
      'tree nut': 'tree_nuts',
      'tree nuts': 'tree_nuts',
      'nuts': 'tree_nuts',
      'fish': 'fish',
      'shellfish': 'shellfish',
      'crustacean': 'shellfish',
      'mollusk': 'shellfish',
      'soy': 'soy',
      'soya': 'soy',
      'soybean': 'soy',
      'wheat': 'wheat',
      'gluten': 'gluten',
      'sesame': 'sesame',
      'mustard': 'mustard',
      'sulfites': 'sulfites',
      'sulphites': 'sulfites'
    }

    return canonicalMap[normalized] || normalized
  }
}

export const barcodeService = BarcodeService.getInstance()

