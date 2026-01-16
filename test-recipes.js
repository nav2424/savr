// Test script to verify recipe generation is working
const { localRecipeGenerator } = require('./lib/LocalRecipeGenerator.ts');

async function testRecipeGeneration() {
  console.log('🧪 Testing recipe generation...');
  
  try {
    const testPantryItems = [
      'chicken breast',
      'pasta',
      'garlic',
      'olive oil',
      'rice',
      'eggs',
      'soy sauce',
      'vegetables'
    ];
    
    const recipes = await localRecipeGenerator.generatePersonalizedRecipes({
      pantryItems: testPantryItems,
      allergies: [],
      dietaryPreferences: [],
      householdSize: 2,
      count: 5
    });
    
    console.log(`✅ Generated ${recipes.length} recipes:`);
    recipes.forEach((recipe, index) => {
      console.log(`${index + 1}. ${recipe.title} (${recipe.cuisine})`);
      console.log(`   Ingredients: ${recipe.baseIngredients.join(', ')}`);
      console.log(`   Difficulty: ${recipe.difficulty}, Time: ${recipe.prepTime + recipe.cookTime}min`);
      console.log('');
    });
    
    if (recipes.length > 0) {
      console.log('🎉 Recipe generation is working!');
    } else {
      console.log('❌ No recipes generated');
    }
    
  } catch (error) {
    console.error('❌ Error testing recipe generation:', error);
  }
}

testRecipeGeneration();
