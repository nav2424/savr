// Test script to verify dynamic pantry recipe generation
const { dynamicPantryRecipeGenerator } = require('./lib/DynamicPantryRecipeGenerator.ts');

async function testDynamicRecipeGeneration() {
  console.log('🧪 Testing dynamic pantry recipe generation...');
  
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
    const recipes = await dynamicPantryRecipeGenerator.generateRecipesFromPantry(mockPantryItems, options);
    
    if (recipes.length > 0) {
      console.log(`✅ Successfully generated ${recipes.length} recipes using actual pantry ingredients:`);
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
      
      // Verify that recipes actually use pantry ingredients
      console.log('🔍 Verifying recipes use actual pantry ingredients...');
      const pantryItemNames = mockPantryItems.map(item => item.name.toLowerCase());
      
      recipes.forEach((recipe, index) => {
        const usedIngredients = recipe.baseIngredients.filter(ingredient => 
          pantryItemNames.some(pantryItem => 
            ingredient.toLowerCase().includes(pantryItem) || 
            pantryItem.includes(ingredient.toLowerCase())
          )
        );
        
        console.log(`Recipe ${index + 1} (${recipe.title}):`);
        console.log(`  Uses ${usedIngredients.length}/${recipe.baseIngredients.length} pantry ingredients`);
        console.log(`  Pantry ingredients used: ${usedIngredients.join(', ')}`);
        console.log('');
      });
      
    } else {
      console.log('❌ No recipes generated.');
    }
  } catch (error) {
    console.error('❌ Error during dynamic recipe generation test:', error);
  }
}

testDynamicRecipeGeneration();
