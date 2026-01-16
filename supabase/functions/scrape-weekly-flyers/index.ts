/**
 * Supabase Edge Function: Scrape Weekly Flyers
 * 
 * This function scrapes weekly grocery flyers and stores deals in the database.
 * Run as a scheduled cron job (weekly on Sundays).
 * 
 * Deploy:
 *   supabase functions deploy scrape-weekly-flyers
 * 
 * Schedule as cron:
 *   supabase functions schedule scrape-weekly-flyers --cron "0 6 * * 0"
 *   (Runs every Sunday at 6 AM)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface PriceData {
  productName: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
  discountPercentage?: number;
  storeChain: string;
  country: 'CA' | 'US';
  validFrom?: string;
  validTo?: string;
  imageUrl?: string;
  dataSource: string;
}

interface ScraperResult {
  success: boolean;
  itemsScraped: number;
  errors: string[];
}

/**
 * Open Food Facts API integration (100% free!)
 */
async function fetchOpenFoodFactsData(category: string = 'beverages'): Promise<any[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/category/${encodeURIComponent(category)}.json`
    );
    
    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error('Error fetching from Open Food Facts:', error);
    return [];
  }
}

/**
 * Mock flyer scraper (replace with actual implementation)
 * In production, this would scrape Flipp or store websites
 */
async function scrapeFlyers(country: 'CA' | 'US'): Promise<PriceData[]> {
  const deals: PriceData[] = [];

  // Example: In production, you'd scrape actual flyer websites
  // For now, we'll demonstrate with Open Food Facts
  
  const categories = ['dairy', 'beverages', 'snacks'];
  
  for (const category of categories) {
    const products = await fetchOpenFoodFactsData(category);
    
    // Convert to price data (simplified example)
    for (const product of products.slice(0, 10)) {
      // In a real scraper, you'd extract actual prices from flyers
      // This is just demo data
      deals.push({
        productName: product.product_name || 'Unknown Product',
        brand: product.brands || undefined,
        price: 0, // Would come from flyer
        isOnSale: false,
        storeChain: 'Various',
        country,
        dataSource: 'openfoodfacts',
      });
    }
  }

  return deals;
}

/**
 * Store scraped deals in database
 */
async function storeDeals(supabase: any, deals: PriceData[]): Promise<number> {
  if (deals.length === 0) return 0;

  const { data, error } = await supabase
    .from('product_prices')
    .insert(deals.map(deal => ({
      product_name: deal.productName,
      brand: deal.brand,
      price: deal.price,
      original_price: deal.originalPrice,
      currency: deal.country === 'CA' ? 'CAD' : 'USD',
      is_on_sale: deal.isOnSale,
      discount_percentage: deal.discountPercentage,
      valid_from: deal.validFrom,
      valid_to: deal.validTo,
      store_chain: deal.storeChain,
      country: deal.country,
      data_source: deal.dataSource,
      image_url: deal.imageUrl,
    })));

  if (error) {
    console.error('Error storing deals:', error);
    throw error;
  }

  return deals.length;
}

/**
 * Main scraping function
 */
async function runScraper(country: 'CA' | 'US'): Promise<ScraperResult> {
  const result: ScraperResult = {
    success: false,
    itemsScraped: 0,
    errors: [],
  };

  try {
    console.log(`Starting flyer scraper for ${country}...`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Scrape flyers
    const deals = await scrapeFlyers(country);
    console.log(`Scraped ${deals.length} deals`);

    // Store in database
    const stored = await storeDeals(supabase, deals);
    console.log(`Stored ${stored} deals in database`);

    result.success = true;
    result.itemsScraped = stored;
  } catch (error) {
    console.error('Scraper error:', error);
    result.errors.push((error as Error).message);
  }

  return result;
}

/**
 * Edge Function handler
 */
serve(async (req) => {
  try {
    // Parse request
    const { country = 'CA', testMode = false } = await req.json().catch(() => ({}));

    console.log('='.repeat(50));
    console.log('Weekly Flyer Scraper Started');
    console.log(`Country: ${country}`);
    console.log(`Test Mode: ${testMode}`);
    console.log('='.repeat(50));

    // Run scraper
    const result = await runScraper(country);

    // Log result
    console.log('\nScraper Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Items Scraped: ${result.itemsScraped}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(', ')}`);
    }
    console.log('='.repeat(50));

    // Return response
    return new Response(
      JSON.stringify({
        success: result.success,
        itemsScraped: result.itemsScraped,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500,
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * DEPLOYMENT INSTRUCTIONS:
 * 
 * 1. Install Supabase CLI:
 *    npm install -g supabase
 * 
 * 2. Link to your project:
 *    supabase link --project-ref your-project-ref
 * 
 * 3. Deploy function:
 *    supabase functions deploy scrape-weekly-flyers
 * 
 * 4. Set environment variables:
 *    supabase secrets set SUPABASE_URL=your-url
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
 * 
 * 5. Schedule as cron job (runs every Sunday at 6 AM):
 *    supabase functions schedule scrape-weekly-flyers --cron "0 6 * * 0"
 * 
 * 6. Test manually:
 *    curl -X POST https://your-project.supabase.co/functions/v1/scrape-weekly-flyers \
 *      -H "Authorization: Bearer YOUR_ANON_KEY" \
 *      -H "Content-Type: application/json" \
 *      -d '{"country": "CA", "testMode": true}'
 * 
 * PRODUCTION IMPROVEMENTS:
 * 
 * 1. Replace mock scraper with actual scraping:
 *    - Use Cheerio or similar for HTML parsing
 *    - Implement Flipp SDK if available
 *    - Add rate limiting and retries
 * 
 * 2. Add error notifications:
 *    - Email on failure
 *    - Slack/Discord webhook
 * 
 * 3. Implement deduplication:
 *    - Check for existing deals before inserting
 *    - Update prices if they've changed
 * 
 * 4. Add monitoring:
 *    - Log scraping stats
 *    - Track success rate
 *    - Alert on anomalies
 */

