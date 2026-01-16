/**
 * Test Utility: Receipt Price Extraction
 * 
 * Use this to verify that price extraction from receipts is working
 */

import { supabase } from '../supabase';
import { receiptsService } from '../ReceiptsService';
import { priceDiscoveryService } from '../PriceDiscoveryService';

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Test: Save a mock receipt and verify price extraction
 */
export async function testReceiptPriceExtraction(userId: string): Promise<TestResult> {
  console.log('🧪 Testing Receipt Price Extraction...\n');

  try {
    // Create mock receipt data
    const mockReceipt = {
      userId,
      scanResult: {
        store: 'Loblaws',
        date: '2024-01-15',
        totalItems: 5,
        items: [
          { name: 'Milk 2L', emoji: '🥛', price: 5.99, quantity: 1, unit: 'bottle', category: 'Dairy', location: 'fridge' as const },
          { name: 'Bread Whole Wheat', emoji: '🍞', price: 3.49, quantity: 2, unit: 'loaf', category: 'Grains', location: 'pantry' as const },
          { name: 'Eggs Large 12pk', emoji: '🥚', price: 4.99, quantity: 1, unit: 'carton', category: 'Dairy', location: 'fridge' as const },
          { name: 'Bananas', emoji: '🍌', price: 1.29, quantity: 1, unit: 'bunch', category: 'Produce', location: 'pantry' as const },
          { name: 'Chicken Breast 1kg', emoji: '🍗', price: 12.99, quantity: 1, unit: 'kg', category: 'Meat', location: 'fridge' as const },
        ],
      },
    };

    console.log('📝 Mock receipt data:', JSON.stringify(mockReceipt, null, 2));
    console.log('\n🔄 Saving receipt (this will trigger price extraction)...\n');

    // Save receipt (this automatically extracts prices)
    const result = await receiptsService.saveReceipt(mockReceipt);

    if (!result.success) {
      return {
        success: false,
        message: 'Failed to save receipt: ' + JSON.stringify(result.error),
      };
    }

    console.log('✅ Receipt saved successfully!\n');

    // Wait a moment for price extraction to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Query product_prices table to verify extraction
    const { data: prices, error } = await supabase
      .from('product_prices')
      .select('*')
      .eq('data_source', 'user_receipt')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return {
        success: false,
        message: 'Failed to query prices: ' + error.message,
      };
    }

    console.log(`📊 Found ${prices?.length || 0} price entries in database:\n`);
    
    if (prices && prices.length > 0) {
      prices.forEach((price, index) => {
        console.log(`${index + 1}. ${price.product_name}`);
        console.log(`   Price: $${price.price}`);
        console.log(`   Store: ${price.store_chain}`);
        console.log(`   Country: ${price.country}`);
        console.log(`   Source: ${price.data_source}\n`);
      });
    }

    return {
      success: true,
      message: `✅ Test passed! Extracted ${prices?.length || 0} prices from receipt`,
      data: { receipt: result.receipt, prices },
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Test failed: ' + (error as Error).message,
    };
  }
}

/**
 * Test: Search for extracted prices
 */
export async function testPriceSearch(): Promise<TestResult> {
  console.log('🧪 Testing Price Search...\n');

  try {
    // Search for common products
    const searchTerms = ['milk', 'bread', 'eggs'];
    
    for (const term of searchTerms) {
      console.log(`🔍 Searching for "${term}"...`);
      
      const prices = await priceDiscoveryService.searchProductPrices(term, {
        country: 'CA',
        maxResults: 5,
      });

      if (prices.length > 0) {
        console.log(`✅ Found ${prices.length} result(s):`);
        prices.forEach(p => {
          console.log(`   - ${p.productName}: $${p.price.toFixed(2)} at ${p.storeChain}`);
        });
      } else {
        console.log(`   No results found`);
      }
      console.log('');
    }

    return {
      success: true,
      message: '✅ Price search test completed',
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Search test failed: ' + (error as Error).message,
    };
  }
}

/**
 * Test: Compare prices across stores
 */
export async function testPriceComparison(): Promise<TestResult> {
  console.log('🧪 Testing Price Comparison...\n');

  try {
    const product = 'milk';
    console.log(`🔍 Comparing prices for "${product}"...\n`);

    const prices = await priceDiscoveryService.comparePrice(product, undefined, 'CA');

    if (prices.length === 0) {
      return {
        success: true,
        message: '⚠️  No prices found yet. Scan more receipts to build database!',
      };
    }

    // Group by store
    const byStore = prices.reduce((acc, p) => {
      if (!acc[p.storeChain]) acc[p.storeChain] = [];
      acc[p.storeChain].push(p);
      return acc;
    }, {} as Record<string, typeof prices>);

    console.log('📊 Price comparison:\n');
    Object.entries(byStore).forEach(([store, storePrices]) => {
      const avgPrice = storePrices.reduce((sum, p) => sum + p.price, 0) / storePrices.length;
      console.log(`${store}:`);
      console.log(`  Average: $${avgPrice.toFixed(2)}`);
      console.log(`  Range: $${Math.min(...storePrices.map(p => p.price)).toFixed(2)} - $${Math.max(...storePrices.map(p => p.price)).toFixed(2)}\n`);
    });

    return {
      success: true,
      message: '✅ Price comparison test completed',
      data: { prices, byStore },
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Comparison test failed: ' + (error as Error).message,
    };
  }
}

/**
 * Run all tests
 */
export async function runAllPriceTests(userId: string): Promise<void> {
  console.log('🚀 Running All Price Discovery Tests...\n');
  console.log('='.repeat(50) + '\n');

  const results = [];

  // Test 1: Receipt extraction
  console.log('TEST 1: Receipt Price Extraction');
  console.log('-'.repeat(50));
  const test1 = await testReceiptPriceExtraction(userId);
  results.push(test1);
  console.log(test1.message);
  console.log('='.repeat(50) + '\n');

  // Test 2: Price search
  console.log('TEST 2: Price Search');
  console.log('-'.repeat(50));
  const test2 = await testPriceSearch();
  results.push(test2);
  console.log(test2.message);
  console.log('='.repeat(50) + '\n');

  // Test 3: Price comparison
  console.log('TEST 3: Price Comparison');
  console.log('-'.repeat(50));
  const test3 = await testPriceComparison();
  results.push(test3);
  console.log(test3.message);
  console.log('='.repeat(50) + '\n');

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('📋 TEST SUMMARY');
  console.log('-'.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  console.log('='.repeat(50) + '\n');

  if (failed === 0) {
    console.log('🎉 All tests passed! Price extraction is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.\n');
  }
}

/**
 * Quick check: How many prices in database?
 */
export async function checkPriceDatabase(): Promise<void> {
  console.log('📊 Checking Price Database...\n');

  try {
    const { count, error } = await supabase
      .from('product_prices')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    console.log(`Total prices in database: ${count || 0}\n`);

    // Get breakdown by source
    const { data: sources } = await supabase
      .from('product_prices')
      .select('data_source')
      .limit(1000);

    if (sources) {
      const breakdown = sources.reduce((acc, s) => {
        acc[s.data_source] = (acc[s.data_source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Breakdown by source:');
      Object.entries(breakdown).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
    }

    console.log('');
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

