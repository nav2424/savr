/**
 * SAVR Price Discovery Service
 * 
 * Multi-source price scraping system for Canada and USA grocery stores
 * Supports: Flipp, Open Food Facts, and custom scrapers
 */

import { supabase } from './supabase';

// ============================================
// Types
// ============================================

export interface PriceData {
  productName: string;
  brand?: string;
  barcode?: string;
  category?: string;
  price: number;
  originalPrice?: number;
  currency: 'CAD' | 'USD';
  unit?: string;
  unitPrice?: number;
  isOnSale: boolean;
  discountPercentage?: number;
  dealDescription?: string;
  validFrom?: string;
  validTo?: string;
  storeChain: string;
  country: 'CA' | 'US';
  dataSource: string;
  sourceUrl?: string;
  imageUrl?: string;
  productData?: any;
}

export interface StoreLocation {
  storeChain: string;
  storeName: string;
  country: 'CA' | 'US';
  provinceState?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface SearchOptions {
  country?: 'CA' | 'US';
  postalCode?: string;
  storeChains?: string[];
  maxResults?: number;
  onSaleOnly?: boolean;
}

// ============================================
// Price Discovery Service
// ============================================

class PriceDiscoveryService {
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Search for product prices across all sources
   */
  async searchProductPrices(
    productName: string,
    options: SearchOptions = {}
  ): Promise<PriceData[]> {
    const {
      country = 'CA',
      postalCode,
      storeChains,
      maxResults = 20,
      onSaleOnly = false
    } = options;

    try {
      // Build query
      let query = supabase
        .from('product_prices')
        .select('*')
        .ilike('product_name', `%${productName}%`)
        .eq('country', country)
        .order('price', { ascending: true });

      // Filter by postal code (requires joining with store_locations)
      // Note: For now, we skip postal code filtering in the main query
      // In production, you'd join with store_locations table or use a stored procedure
      // if (postalCode) {
      //   // This would require a JOIN or separate query
      // }

      // Filter by store chains
      if (storeChains && storeChains.length > 0) {
        query = query.in('store_chain', storeChains);
      }

      // Filter by sale status
      if (onSaleOnly) {
        query = query.eq('is_on_sale', true);
      }

      // Limit results
      query = query.limit(maxResults);

      const { data, error } = await query;

      if (error) throw error;

      return this.mapToPriceData(data || []);
    } catch (error) {
      console.error('Error searching product prices:', error);
      return [];
    }
  }

  /**
   * Get current deals/sales near a location
   */
  async getDealsNearby(
    postalCode: string,
    country: 'CA' | 'US' = 'CA',
    category?: string
  ): Promise<PriceData[]> {
    try {
      let query = supabase
        .from('product_prices')
        .select('*')
        .eq('country', country)
        .eq('is_on_sale', true)
        .gte('valid_to', new Date().toISOString().split('T')[0])
        .order('discount_percentage', { ascending: false })
        .limit(50);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return this.mapToPriceData(data || []);
    } catch (error) {
      console.error('Error fetching nearby deals:', error);
      return [];
    }
  }

  /**
   * Compare prices across stores for a specific product
   */
  async comparePrice(
    productName: string,
    barcode?: string,
    country: 'CA' | 'US' = 'CA'
  ): Promise<PriceData[]> {
    try {
      let query = supabase
        .from('product_prices')
        .select('*')
        .eq('country', country)
        .order('price', { ascending: true });

      if (barcode) {
        query = query.eq('barcode', barcode);
      } else {
        query = query.ilike('product_name', `%${productName}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return this.mapToPriceData(data || []);
    } catch (error) {
      console.error('Error comparing prices:', error);
      return [];
    }
  }

  /**
   * Import price data from Open Food Facts API
   */
  async importFromOpenFoodFacts(barcode: string): Promise<PriceData | null> {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      
      if (!response.ok) return null;

      const data = await response.json();
      
      if (data.status !== 1 || !data.product) return null;

      const product = data.product;

      // Check if we already have this price data
      const { data: existingPrice } = await supabase
        .from('product_prices')
        .select('id')
        .eq('barcode', barcode)
        .eq('data_source', 'openfoodfacts')
        .single();

      const priceData: PriceData = {
        productName: product.product_name || 'Unknown Product',
        brand: product.brands || undefined,
        barcode: barcode,
        category: product.categories?.split(',')[0]?.trim() || 'Unknown',
        price: 0, // Open Food Facts doesn't have price data
        currency: 'CAD',
        isOnSale: false,
        storeChain: 'Various',
        country: 'CA',
        dataSource: 'openfoodfacts',
        imageUrl: product.image_url || undefined,
        productData: product
      };

      // Store in database if new
      if (!existingPrice) {
        await this.storePriceData(priceData);
      }

      return priceData;
    } catch (error) {
      console.error('Error importing from Open Food Facts:', error);
      return null;
    }
  }

  /**
   * Scrape prices from Flipp (placeholder - requires actual implementation)
   * Note: This is a simplified example. Real implementation would need:
   * 1. Flipp API key (they offer developer access)
   * 2. Proper scraping with respect to robots.txt
   * 3. Rate limiting
   */
  async scrapeFlippDeals(postalCode: string, country: 'CA' | 'US' = 'CA'): Promise<void> {
    console.log('Flipp scraping would happen here');
    // TODO: Implement actual Flipp scraping
    // Options:
    // 1. Use Flipp SDK if available
    // 2. Web scraping with Cheerio (respect robots.txt)
    // 3. Partner with Flipp for API access
  }

  /**
   * Store price data in database
   */
  async storePriceData(priceData: PriceData): Promise<void> {
    try {
      const { error } = await supabase
        .from('product_prices')
        .insert({
          product_name: priceData.productName,
          brand: priceData.brand,
          barcode: priceData.barcode,
          category: priceData.category,
          price: priceData.price,
          original_price: priceData.originalPrice,
          currency: priceData.currency,
          unit: priceData.unit,
          unit_price: priceData.unitPrice,
          is_on_sale: priceData.isOnSale,
          discount_percentage: priceData.discountPercentage,
          deal_description: priceData.dealDescription,
          valid_from: priceData.validFrom,
          valid_to: priceData.validTo,
          store_chain: priceData.storeChain,
          country: priceData.country,
          data_source: priceData.dataSource,
          source_url: priceData.sourceUrl,
          image_url: priceData.imageUrl,
          product_data: priceData.productData
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing price data:', error);
    }
  }

  /**
   * Batch import prices from receipt data
   */
  async importFromReceipt(
    receiptItems: Array<{
      name: string;
      price: number;
      barcode?: string;
    }>,
    storeChain: string,
    country: 'CA' | 'US',
    purchaseDate: string
  ): Promise<void> {
    try {
      const priceDataBatch = receiptItems.map(item => ({
        product_name: item.name,
        barcode: item.barcode,
        price: item.price,
        currency: country === 'CA' ? 'CAD' : 'USD',
        is_on_sale: false,
        store_chain: storeChain,
        country: country,
        data_source: 'user_receipt',
        scraped_at: purchaseDate
      }));

      const { error } = await supabase
        .from('product_prices')
        .insert(priceDataBatch);

      if (error) throw error;

      console.log(`Imported ${receiptItems.length} prices from receipt`);
    } catch (error) {
      console.error('Error importing receipt prices:', error);
    }
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(
    productName: string,
    barcode?: string,
    storeChain?: string,
    daysBack: number = 30
  ): Promise<PriceData[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);

      let query = supabase
        .from('product_prices')
        .select('*')
        .gte('scraped_at', dateThreshold.toISOString())
        .order('scraped_at', { ascending: false });

      if (barcode) {
        query = query.eq('barcode', barcode);
      } else {
        query = query.ilike('product_name', `%${productName}%`);
      }

      if (storeChain) {
        query = query.eq('store_chain', storeChain);
      }

      const { data, error } = await query;

      if (error) throw error;

      return this.mapToPriceData(data || []);
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  }

  /**
   * Set up price alert for a user
   */
  async createPriceAlert(
    userId: string,
    productName: string,
    maxPrice: number,
    barcode?: string,
    storeChains?: string[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .insert({
          user_id: userId,
          product_name: productName,
          barcode: barcode,
          max_price: maxPrice,
          store_chains: storeChains,
          is_active: true
        });

      if (error) throw error;

      console.log('Price alert created successfully');
    } catch (error) {
      console.error('Error creating price alert:', error);
    }
  }

  /**
   * Check price alerts and notify users
   */
  async checkPriceAlerts(): Promise<void> {
    try {
      // Get all active alerts
      const { data: alerts, error } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const alert of alerts || []) {
        // Find matching products below alert price
        let query = supabase
          .from('product_prices')
          .select('*')
          .ilike('product_name', `%${alert.product_name}%`)
          .lte('price', alert.max_price);

        if (alert.barcode) {
          query = query.eq('barcode', alert.barcode);
        }

        if (alert.store_chains && alert.store_chains.length > 0) {
          query = query.in('store_chain', alert.store_chains);
        }

        const { data: matches } = await query;

        if (matches && matches.length > 0) {
          // TODO: Send notification to user
          console.log(`Price alert triggered for user ${alert.user_id}:`, matches[0]);
          
          // Update last_triggered_at
          await supabase
            .from('price_alerts')
            .update({ last_triggered_at: new Date().toISOString() })
            .eq('id', alert.id);
        }
      }
    } catch (error) {
      console.error('Error checking price alerts:', error);
    }
  }

  /**
   * Helper: Map database records to PriceData type
   */
  private mapToPriceData(records: any[]): PriceData[] {
    return records.map(record => ({
      productName: record.product_name,
      brand: record.brand,
      barcode: record.barcode,
      category: record.category,
      price: parseFloat(record.price),
      originalPrice: record.original_price ? parseFloat(record.original_price) : undefined,
      currency: record.currency,
      unit: record.unit,
      unitPrice: record.unit_price ? parseFloat(record.unit_price) : undefined,
      isOnSale: record.is_on_sale,
      discountPercentage: record.discount_percentage,
      dealDescription: record.deal_description,
      validFrom: record.valid_from,
      validTo: record.valid_to,
      storeChain: record.store_chain,
      country: record.country,
      dataSource: record.data_source,
      sourceUrl: record.source_url,
      imageUrl: record.image_url,
      productData: record.product_data
    }));
  }
}

// Export singleton instance
export const priceDiscoveryService = new PriceDiscoveryService();
export default priceDiscoveryService;

