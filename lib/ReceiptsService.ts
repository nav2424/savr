// SAVR Receipts Service - Store and retrieve scanned receipts
import { supabase } from './supabase'
import { ScanResult } from './ScanningService'
import { priceDiscoveryService } from './PriceDiscoveryService'

export interface Receipt {
  id: string
  user_id: string
  store_name: string | null
  purchase_date: string | null
  total_amount: number | null
  image_url: string | null
  scan_result: ScanResult
  created_at: string
  updated_at: string
}

export interface SaveReceiptParams {
  userId: string
  scanResult: ScanResult
  imageBase64?: string
}

class ReceiptsService {
  // Save a scanned receipt to the database
  async saveReceipt(params: SaveReceiptParams): Promise<{ success: boolean; receipt?: Receipt; error?: any }> {
    try {
      const { userId, scanResult, imageBase64 } = params
      
      // Calculate total from items
      // For weight-based items, price is already the LINE TOTAL (don't multiply)
      // For count-based items, price is UNIT PRICE (multiply by quantity)
      const calculatedTotal = scanResult.items.reduce((sum, item) => {
        const price = typeof item.price === 'number' ? item.price : 0
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
        const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
        
        if (isWeightBased) {
          return sum + price // Price is already line total
        } else {
          return sum + (price * quantity) // Price is unit price
        }
      }, 0)
      
      // CRITICAL: Always use receiptTotal (includes tax) for budget tracking
      // This is what the user actually paid at the store
      // If receiptTotal exists and is valid, use it; otherwise use calculated total
      const useReceiptTotal = !!scanResult.receiptTotal && scanResult.receiptTotal > 0
      let totalAmount = useReceiptTotal ? scanResult.receiptTotal : calculatedTotal
      
      // Validation: Ensure totalAmount is a valid number
      if (isNaN(totalAmount) || !isFinite(totalAmount) || totalAmount < 0) {
        console.warn('⚠️ Invalid totalAmount calculated, using 0:', { totalAmount, calculatedTotal, receiptTotal: scanResult.receiptTotal })
        totalAmount = 0
      }
      
      if (useReceiptTotal) {
        console.log(`💰 Using receipt total for budget: $${scanResult.receiptTotal?.toFixed(2)} (includes tax)`)
      }
      
      // Use mismatch flags from scanResult (fixes undefined subtotalMismatch crash)
      const subtotalMismatch = scanResult.subtotalMismatch ?? false
      const totalMismatch = scanResult.totalMismatch ?? false
      
      // Log receipt details for debugging
      const itemsWithPrices = scanResult.items.filter(item => item.price && item.price > 0)
      console.log(`💰 Receipt calculation:`, {
        itemCount: scanResult.items.length,
        itemsWithPrices: itemsWithPrices.length,
        receiptTotal: scanResult.receiptTotal,
        receiptSubtotal: scanResult.receiptSubtotal,
        receiptTax: scanResult.receiptTax,
        calculatedTotal: calculatedTotal.toFixed(2),
        finalTotal: totalAmount.toFixed(2),
        validationPassed: scanResult.validationPassed && !subtotalMismatch && !totalMismatch,
        subtotalMismatch,
        totalMismatch,
        needsReview: scanResult.needsReview,
        estimatedTax: scanResult.estimatedTax,
        difference: scanResult.receiptTotal ? Math.abs(scanResult.receiptTotal - calculatedTotal).toFixed(2) : 'N/A',
        selectedTotalsBlockIndex: scanResult.selectedTotalsBlockIndex,
        allParsedTotalsBlocks: scanResult.allParsedTotalsBlocks
      })
      
      if (totalAmount === 0 && scanResult.items.length > 0) {
        console.warn('⚠️ Receipt saved with $0 total - items may not have prices extracted')
      }
      
      // Warn if validation failed
      if (scanResult.receiptTotal && (!scanResult.validationPassed || subtotalMismatch || totalMismatch) && !scanResult.estimatedTax) {
        const difference = Math.abs(scanResult.receiptTotal - calculatedTotal)
        console.warn(`⚠️ Receipt validation failed:`, {
          receiptTotal: scanResult.receiptTotal.toFixed(2),
          calculatedTotal: calculatedTotal.toFixed(2),
          difference: difference.toFixed(2),
          subtotalMismatch,
          totalMismatch,
          needsReview: scanResult.needsReview
        })
      }

      // Optionally upload image to Supabase Storage
      let imageUrl = null
      if (imageBase64) {
        const uploadResult = await this.uploadReceiptImage(userId, imageBase64)
        if (uploadResult.success) {
          imageUrl = uploadResult.url
        }
      }

      // Validate and format purchase date
      // Ensure date is in YYYY-MM-DD format or use today's date
      let purchaseDate: string
      if (scanResult.date && scanResult.date !== 'Unknown' && /^\d{4}-\d{2}-\d{2}$/.test(scanResult.date)) {
        // Valid date format
        purchaseDate = scanResult.date
      } else {
        // Invalid or missing date - use today's date
        purchaseDate = new Date().toISOString().split('T')[0]
      }

      // Insert receipt into database
      // Always save total_amount (even if 0) so budget tracking works correctly
      const { data, error } = await supabase
        .from('receipts')
        .insert({
          user_id: userId,
          store_name: scanResult.store || 'Unknown Store',
          purchase_date: purchaseDate,
          total_amount: totalAmount >= 0 ? totalAmount : 0, // Always save amount (0 if no prices found)
          image_url: imageUrl,
          scan_result: scanResult,
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving receipt:', error)
        return { success: false, error }
      }

      // 🆕 AUTO-EXTRACT PRICES: Store price data from receipt items
      if (scanResult.items && scanResult.items.length > 0) {
        await this.extractAndStorePrices(
          scanResult.items,
          scanResult.store || 'Unknown Store',
          purchaseDate // Use the validated date
        )
      }

      return { success: true, receipt: data }
    } catch (error) {
      console.error('Error in saveReceipt:', error)
      return { success: false, error }
    }
  }

  // Upload receipt image to Supabase Storage
  async uploadReceiptImage(userId: string, base64: string): Promise<{ success: boolean; url?: string; error?: any }> {
    try {
      // Remove data URI prefix if present
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
      
      // Convert base64 to ArrayBuffer for React Native
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      // Generate unique filename
      const fileName = `${userId}/${Date.now()}.jpg`
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        })

      if (error) {
        console.error('Error uploading image:', error)
        return { success: false, error }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      return { success: true, url: urlData.publicUrl }
    } catch (error) {
      console.error('Error in uploadReceiptImage:', error)
      return { success: false, error }
    }
  }

  // Get all receipts for a user
  async getUserReceipts(userId: string): Promise<{ success: boolean; receipts?: Receipt[]; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching receipts:', error)
        return { success: false, error }
      }

      return { success: true, receipts: data || [] }
    } catch (error) {
      console.error('Error in getUserReceipts:', error)
      return { success: false, error }
    }
  }

  // Get a single receipt by ID
  async getReceipt(receiptId: string): Promise<{ success: boolean; receipt?: Receipt; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single()

      if (error) {
        console.error('Error fetching receipt:', error)
        return { success: false, error }
      }

      return { success: true, receipt: data }
    } catch (error) {
      console.error('Error in getReceipt:', error)
      return { success: false, error }
    }
  }

  // Alias for getReceipt for consistency
  async getReceiptById(receiptId: string): Promise<{ success: boolean; receipt?: Receipt; error?: any }> {
    return this.getReceipt(receiptId)
  }

  // Delete a receipt
  async deleteReceipt(receiptId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId)

      if (error) {
        console.error('Error deleting receipt:', error)
        return { success: false, error }
      }

      return { success: true }
    } catch (error) {
      console.error('Error in deleteReceipt:', error)
      return { success: false, error }
    }
  }

  // Get receipt statistics for a user
  async getReceiptStats(userId: string): Promise<{ totalReceipts: number; totalSpent: number; mostFrequentStore: string }> {
    try {
      const { data } = await supabase
        .from('receipts')
        .select('total_amount, store_name')
        .eq('user_id', userId)

      if (!data) {
        return { totalReceipts: 0, totalSpent: 0, mostFrequentStore: 'N/A' }
      }

      const totalReceipts = data.length
      const totalSpent = data.reduce((sum, receipt) => sum + (receipt.total_amount || 0), 0)
      
      // Find most frequent store
      const storeCounts: { [key: string]: number } = {}
      data.forEach(receipt => {
        if (receipt.store_name) {
          storeCounts[receipt.store_name] = (storeCounts[receipt.store_name] || 0) + 1
        }
      })
      
      const mostFrequentStore = Object.keys(storeCounts).length > 0
        ? Object.keys(storeCounts).reduce((a, b) => storeCounts[a] > storeCounts[b] ? a : b)
        : 'N/A'

      return { totalReceipts, totalSpent, mostFrequentStore }
    } catch (error) {
      console.error('Error getting receipt stats:', error)
      return { totalReceipts: 0, totalSpent: 0, mostFrequentStore: 'N/A' }
    }
  }

  // 🆕 PRICE DISCOVERY: Extract prices from receipt and store in price database
  private async extractAndStorePrices(
    items: any[],
    storeName: string,
    purchaseDate: string
  ): Promise<void> {
    try {
      // Determine country based on store name (you can make this smarter)
      const country = this.detectCountry(storeName)
      
      // Map store name to chain (normalize variants)
      const storeChain = this.normalizeStoreChain(storeName)
      
      // Extract items with valid prices
      const validItems = items
        .filter(item => item.name && typeof item.price === 'number' && item.price > 0)
        .map(item => ({
          name: item.name,
          price: item.price,
          barcode: item.barcode || undefined
        }))

      if (validItems.length === 0) {
        console.log('No valid items to extract prices from')
        return
      }

      // Use price discovery service to import receipt data
      await priceDiscoveryService.importFromReceipt(
        validItems,
        storeChain,
        country,
        purchaseDate
      )

      console.log(`✅ Extracted ${validItems.length} prices from receipt (${storeChain})`)
    } catch (error) {
      console.error('Error extracting prices from receipt:', error)
    }
  }

  // Helper: Detect country from store name
  private detectCountry(storeName: string): 'CA' | 'US' {
    const canadianStores = [
      'loblaws', 'metro', 'sobeys', 'nofrills', 'foodbasics',
      'fortinos', 'zehrs', 'independent', 'provigo', 'maxi'
    ]
    
    const storeLower = storeName.toLowerCase()
    
    if (canadianStores.some(store => storeLower.includes(store))) {
      return 'CA'
    }
    
    // Default to CA if unclear (you can add more logic)
    return 'CA'
  }

  // Helper: Normalize store chain names
  private normalizeStoreChain(storeName: string): string {
    const storeLower = storeName.toLowerCase()
    
    // Map variations to canonical names
    if (storeLower.includes('loblaws')) return 'Loblaws'
    if (storeLower.includes('no frills') || storeLower.includes('nofrills')) return 'No Frills'
    if (storeLower.includes('metro')) return 'Metro'
    if (storeLower.includes('sobeys')) return 'Sobeys'
    if (storeLower.includes('walmart')) return 'Walmart'
    if (storeLower.includes('food basics') || storeLower.includes('foodbasics')) return 'Food Basics'
    if (storeLower.includes('fortinos')) return 'Fortinos'
    if (storeLower.includes('zehrs')) return 'Zehrs'
    if (storeLower.includes('target')) return 'Target'
    if (storeLower.includes('kroger')) return 'Kroger'
    
    // Return original if no match
    return storeName
  }
}

export const receiptsService = new ReceiptsService()

