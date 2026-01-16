// Test script to verify realistic recipe generation
const { realisticRecipeGenerator } = require('./lib/RealisticRecipeGenerator.ts');

async function testRealisticRecipeGeneration() {
  console.log('🧪 Testing realistic recipe generation...');
  
  // Mock pantry items that a user might actually have
  const mockPantryItems = [
    { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'meat' },
    { name: 'Rice', quantity: 1, unit: 'bag', category: 'grains' },
    { name: 'Bell Peppers', quantity: 3, unit: 'pieces', category: 'produce' },
    { name: 'Onion', quantity: 1, unit: 'piece', category: 'produce' },
    { name: 'Garlic', quantity: 1, unit: 'head', category: 'produce' },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments' },
    { name: 'Pasta', quantity: 1, unit: 'box', category: 'grains' },
    { name: 'Tomatoes', quantity: 4, unit: 'pieces', category: 'produce' },
    { name: 'Eggs', quantity: 12, unit: 'pieces', category: 'dairy' },
    { name: 'Cheese', quantity: 1, unit: 'block', category: 'dairy' },
    { name: 'Spinach', quantity: 1, unit: 'bag', category: 'produce' },
    { name: 'Soy Sauce', quantity: 1, unit: 'bottle', category: 'condiments' }
  ];
  
  const options = {
    allergies: [],
    dietaryPreferences: [],
    householdSize: 2,
    count: 5
  };
  
  try {
    const recipes = await realisticRecipeGenerator.generateRecipesFromPantry(mockPantryItems, options);
    
    if (recipes.length > 0) {
      console.log(`✅ Successfully generated ${recipes.length} realistic recipes:`);
      console.log('');
      
      recipes.forEach((recipe, index) => {
        console.log(`--- Recipe ${index + 1}: ${recipe.title} ---`);
        console.log(`Description: ${recipe.description}`);
        console.log(`Cuisine: ${recipe.cuisine}`);
        console.log(`Meal Type: ${recipe.mealType}`);
        console.log(`Difficulty: ${recipe.difficulty}`);
        console.log(`Prep Time: ${recipe.prepTime} min`);
        console.log(`Cook Time: ${recipe.cookTime} min`);
        console.log(`Base Ingredients: ${recipe.baseIngredients.join(', ')}`);
        console.log(`Instructions:`);
        recipe.instructions.forEach((instruction, i) => {
          console.log(`  ${i + 1}. ${instruction}`);
        });
        console.log(`Tags: ${recipe.tags.join(', ')}`);
        console.log(`Nutrition: ${recipe.calories} cal, ${recipe.protein}g protein, ${recipe.carbs}g carbs, ${recipe.fat}g fat`);
        console.log('');
      });
      
      // Verify that recipes are realistic and cookable
      console.log('🔍 Verifying recipes are realistic and cookable...');
      
      recipes.forEach((recipe, index) => {
        console.log(`Recipe ${index + 1} (${recipe.title}):`);
        
        // Check if it's a proper meal
        const hasProtein = recipe.baseIngredients.some(ing => 
          ['chicken', 'beef', 'pork', 'fish', 'eggs', 'cheese', 'beans'].some(protein => 
            ing.toLowerCase().includes(protein)
          )
        );
        
        const hasVegetable = recipe.baseIngredients.some(ing => 
          ['onion', 'garlic', 'tomato', 'pepper', 'carrot', 'celery', 'spinach', 'broccoli'].some(veg => 
            ing.toLowerCase().includes(veg)
          )
        );
        
        const hasStarch = recipe.baseIngredients.some(ing => 
          ['rice', 'pasta', 'potato', 'bread'].some(starch => 
            ing.toLowerCase().includes(starch)
          )
        );
        
        const hasSeasoning = recipe.baseIngredients.some(ing => 
          ['oil', 'salt', 'pepper', 'soy sauce', 'garlic'].some(seasoning => 
            ing.toLowerCase().includes(seasoning)
          )
        );
        
        console.log(`  ✅ Has protein: ${hasProtein}`);
        console.log(`  ✅ Has vegetable: ${hasVegetable}`);
        console.log(`  ✅ Has starch: ${hasStarch}`);
        console.log(`  ✅ Has seasoning: ${hasSeasoning}`);
        console.log(`  ✅ Is cookable: ${hasProtein && hasVegetable && hasSeasoning}`);
        console.log('');
      });
      
      // Check for any nonsensical combinations
      console.log('🚫 Checking for nonsensical combinations...');
      const badCombinations = recipes.filter(recipe => {
        const ingredients = recipe.baseIngredients.join(' ').toLowerCase();
        return ingredients.includes('milk') && ingredients.includes('tortilla') ||
               ingredients.includes('bread') && ingredients.includes('milk') ||
               ingredients.includes('tortilla') && ingredients.includes('milk');
      });
      
      if (badCombinations.length === 0) {
        console.log('✅ No nonsensical combinations found!');
      } else {
        console.log(`❌ Found ${badCombinations.length} nonsensical combinations:`);
        badCombinations.forEach(recipe => {
          console.log(`  - ${recipe.title}: ${recipe.baseIngredients.join(', ')}`);
        });
      }
      
    } else {
      console.log('❌ No recipes generated.');
    }
  } catch (error) {
    console.error('❌ Error during realistic recipe generation test:', error);
  }
}

testRealisticRecipeGeneration();
