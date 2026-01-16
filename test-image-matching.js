// Test script to verify image matching is working correctly
const { costEffectiveImageService } = require('./lib/CostEffectiveImageService.ts');

async function testImageMatching() {
  console.log('🧪 Testing image matching...');
  
  const testRecipes = [
    'Quesadilla with Whatever',
    'Chicken Curry',
    'Pasta with Garlic',
    'Beef Burger',
    'Sushi Roll',
    'Pizza Margherita'
  ];
  
  for (const recipe of testRecipes) {
    try {
      const imageUrl = await costEffectiveImageService.getRecipeImage(recipe);
      console.log(`✅ ${recipe}: ${imageUrl}`);
    } catch (error) {
      console.error(`❌ ${recipe}: Error -`, error);
    }
  }
}

testImageMatching();
