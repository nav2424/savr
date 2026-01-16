/**
 * Test Utility: Open Food Facts Integration
 * 
 * Test the free Open Food Facts API integration
 */

import { openFoodFactsService } from '../scrapers/FlyerScraperService';
import { priceDiscoveryService } from '../PriceDiscoveryService';

export interface OpenFoodFactsTestResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Test barcodes (known to exist in Open Food Facts database)
 */
const TEST_BARCODES = {
  // Coca-Cola (very common, should always work)
  cocaCola: '0049000042566',
  // Nutella
  nutella: '3017620422003',
  // Cheerios
  cheerios: '0016000119192',
  // Ben & Jerry's
  benJerrys: '0076840100132',
  // Invalid barcode (should fail gracefully)
  invalid: '0000000000000',
};

/**
 * Test 1: Fetch product by barcode
 */
export async function testGetProduct(barcode: string = TEST_BARCODES.cocaCola): Promise<OpenFoodFactsTestResult> {
  console.log(`🧪 Testing Open Food Facts: Get Product by Barcode\n`);
  console.log(`Barcode: ${barcode}\n`);

  try {
    const product = await openFoodFactsService.getProduct(barcode);

    if (!product) {
      return {
        success: false,
        message: '❌ Product not found in Open Food Facts database',
      };
    }

    console.log(`✅ Product found!\n`);
    console.log(`Product Details:`);
    console.log(`  Name: ${product.product_name || 'Unknown'}`);
    console.log(`  Brand: ${product.brands || 'Unknown'}`);
    console.log(`  Categories: ${product.categories || 'Unknown'}`);
    console.log(`  Image: ${product.image_url ? 'Available' : 'Not available'}`);
    console.log('');

    return {
      success: true,
      message: `✅ Successfully fetched product: ${product.product_name}`,
      data: product,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Test 2: Search products by name
 */
export async function testSearchProducts(query: string = 'milk'): Promise<OpenFoodFactsTestResult> {
  console.log(`🧪 Testing Open Food Facts: Search Products\n`);
  console.log(`Query: "${query}"\n`);

  try {
    const products = await openFoodFactsService.searchProducts(query);

    if (!products || products.length === 0) {
      return {
        success: false,
        message: `❌ No products found for query: ${query}`,
      };
    }

    console.log(`✅ Found ${products.length} products:\n`);
    
    products.slice(0, 5).forEach((product, index) => {
      console.log(`${index + 1}. ${product.product_name || 'Unknown'}`);
      console.log(`   Brand: ${product.brands || 'Unknown'}`);
      console.log(`   Barcode: ${product.code || 'Unknown'}`);
      console.log('');
    });

    return {
      success: true,
      message: `✅ Found ${products.length} products for "${query}"`,
      data: products,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Test 3: Import product to database
 */
export async function testImportProduct(barcode: string = TEST_BARCODES.cocaCola): Promise<OpenFoodFactsTestResult> {
  console.log(`🧪 Testing Open Food Facts: Import to Database\n`);
  console.log(`Barcode: ${barcode}\n`);

  try {
    const priceData = await priceDiscoveryService.importFromOpenFoodFacts(barcode);

    if (!priceData) {
      return {
        success: false,
        message: '❌ Failed to import product',
      };
    }

    console.log(`✅ Product imported successfully!\n`);
    console.log(`Imported Data:`);
    console.log(`  Name: ${priceData.productName}`);
    console.log(`  Brand: ${priceData.brand || 'Unknown'}`);
    console.log(`  Category: ${priceData.category}`);
    console.log(`  Barcode: ${priceData.barcode}`);
    console.log(`  Image: ${priceData.imageUrl ? 'Available' : 'Not available'}`);
    console.log('');

    return {
      success: true,
      message: `✅ Successfully imported: ${priceData.productName}`,
      data: priceData,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Test 4: Get products by category
 */
export async function testGetByCategory(category: string = 'beverages'): Promise<OpenFoodFactsTestResult> {
  console.log(`🧪 Testing Open Food Facts: Get by Category\n`);
  console.log(`Category: "${category}"\n`);

  try {
    const products = await openFoodFactsService.getProductsByCategory(category);

    if (!products || products.length === 0) {
      return {
        success: false,
        message: `❌ No products found in category: ${category}`,
      };
    }

    console.log(`✅ Found ${products.length} products in category:\n`);
    
    products.slice(0, 5).forEach((product, index) => {
      console.log(`${index + 1}. ${product.product_name || 'Unknown'}`);
      console.log(`   Brand: ${product.brands || 'Unknown'}`);
      console.log('');
    });

    return {
      success: true,
      message: `✅ Found ${products.length} products in "${category}"`,
      data: products,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error: ${(error as Error).message}`,
    };
  }
}

/**
 * Run all Open Food Facts tests
 */
export async function runAllOpenFoodFactsTests(): Promise<void> {
  console.log('🚀 Running Open Food Facts Integration Tests...\n');
  console.log('='.repeat(50) + '\n');

  const results: OpenFoodFactsTestResult[] = [];

  // Test 1: Get product
  console.log('TEST 1: Get Product by Barcode');
  console.log('-'.repeat(50));
  const test1 = await testGetProduct();
  results.push(test1);
  console.log(test1.message);
  console.log('='.repeat(50) + '\n');

  // Test 2: Search products
  console.log('TEST 2: Search Products');
  console.log('-'.repeat(50));
  const test2 = await testSearchProducts('chocolate');
  results.push(test2);
  console.log(test2.message);
  console.log('='.repeat(50) + '\n');

  // Test 3: Import to database
  console.log('TEST 3: Import to Database');
  console.log('-'.repeat(50));
  const test3 = await testImportProduct();
  results.push(test3);
  console.log(test3.message);
  console.log('='.repeat(50) + '\n');

  // Test 4: Get by category
  console.log('TEST 4: Get by Category');
  console.log('-'.repeat(50));
  const test4 = await testGetByCategory('dairy');
  results.push(test4);
  console.log(test4.message);
  console.log('='.repeat(50) + '\n');

  // Test 5: Invalid barcode (should fail gracefully)
  console.log('TEST 5: Invalid Barcode Handling');
  console.log('-'.repeat(50));
  const test5 = await testGetProduct(TEST_BARCODES.invalid);
  results.push(test5);
  console.log(test5.message);
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

  if (failed === 0 || (failed === 1 && !results[4].success)) {
    // It's OK if only the invalid barcode test fails
    console.log('🎉 All tests passed! Open Food Facts integration is working.\n');
    console.log('💡 Tips:');
    console.log('   - No API key required!');
    console.log('   - 2.8M+ products available');
    console.log('   - Free forever');
    console.log('   - Great for product info\n');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above.\n');
  }
}

/**
 * Quick test with a specific barcode
 */
export async function quickTest(barcode: string): Promise<void> {
  console.log(`\n🔍 Quick Test: ${barcode}\n`);
  console.log('='.repeat(50) + '\n');

  const result = await testGetProduct(barcode);
  console.log(result.message + '\n');

  if (result.success && result.data) {
    console.log('Product Info:');
    console.log(JSON.stringify(result.data, null, 2));
  }
}

/**
 * Test common grocery items
 */
export async function testCommonGroceries(): Promise<void> {
  console.log('🛒 Testing Common Grocery Items\n');
  console.log('='.repeat(50) + '\n');

  const items = [
    { name: 'Coca-Cola', barcode: TEST_BARCODES.cocaCola },
    { name: 'Nutella', barcode: TEST_BARCODES.nutella },
    { name: 'Cheerios', barcode: TEST_BARCODES.cheerios },
    { name: 'Ben & Jerry\'s', barcode: TEST_BARCODES.benJerrys },
  ];

  for (const item of items) {
    console.log(`Testing: ${item.name}`);
    console.log('-'.repeat(50));
    const result = await testGetProduct(item.barcode);
    console.log(result.message + '\n');
  }

  console.log('✅ Common grocery items test complete!\n');
}

// Export test barcodes for use in other tests
export { TEST_BARCODES };

