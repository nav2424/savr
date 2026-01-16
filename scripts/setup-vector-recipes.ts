// Quick Setup Script for Vector Recipe System
// Run this after running the SQL migration
// Usage: npx ts-node scripts/setup-vector-recipes.ts

import { recipeImportService } from '../lib/RecipeImportService'
import { supabase } from '../lib/supabase'

async function main() {
  console.log('🚀 Setting up Vector Recipe System...\n')

  try {
    // Step 1: Check if we have any recipes
    console.log('📚 Step 1: Checking existing recipes...')
    const { data: existingRecipes, error: checkError } = await supabase
      .from('recipes')
      .select('id, title, embedding')
      .eq('is_public', true)
      .limit(1)

    if (checkError) {
      console.error('❌ Error checking recipes:', checkError)
      return
    }

    const hasRecipes = existingRecipes && existingRecipes.length > 0
    const recipesWithoutEmbeddings = existingRecipes?.filter(r => !r.embedding) || []

    console.log(`   Found ${existingRecipes?.length || 0} public recipes`)
    console.log(`   ${recipesWithoutEmbeddings.length} without embeddings\n`)

    // Step 2: Update embeddings for existing recipes
    if (recipesWithoutEmbeddings.length > 0) {
      console.log('🔮 Step 2: Generating embeddings for existing recipes...')
      console.log('   (This may take a few minutes and costs ~$0.01 per 1000 recipes)\n')
      
      const updated = await recipeImportService.updateMissingEmbeddings(100)
      console.log(`\n   ✅ Updated ${updated} embeddings\n`)
    } else if (hasRecipes) {
      console.log('   ✅ All recipes already have embeddings\n')
    }

    // Step 3: Import sample recipes if database is empty
    if (!hasRecipes || (existingRecipes?.length || 0) < 10) {
      console.log('📦 Step 3: Importing sample recipes...')
      console.log('   (Generating 20 sample recipes for testing)\n')

      const samples = recipeImportService.generateSampleRecipes(20)
      const result = await recipeImportService.importRecipes(samples, undefined, {
        generateEmbeddings: true,
        batchSize: 5,
        continueOnError: true,
      })

      console.log(`\n   ✅ Imported ${result.imported} sample recipes`)
      if (result.failed > 0) {
        console.log(`   ⚠️  ${result.failed} failed`)
      }
      console.log('')
    } else {
      console.log('   ✅ You already have recipes in the database\n')
    }

    // Step 4: Verify setup
    console.log('✅ Step 4: Verifying setup...')
    const { data: allRecipes, error: verifyError } = await supabase
      .from('recipes')
      .select('id, title, embedding')
      .eq('is_public', true)

    if (verifyError) {
      console.error('   ❌ Error verifying:', verifyError)
      return
    }

    const withEmbeddings = allRecipes?.filter(r => r.embedding) || []
    const withoutEmbeddings = allRecipes?.filter(r => !r.embedding) || []

    console.log(`   Total recipes: ${allRecipes?.length || 0}`)
    console.log(`   With embeddings: ${withEmbeddings.length}`)
    console.log(`   Without embeddings: ${withoutEmbeddings.length}`)

    if (withoutEmbeddings.length > 0) {
      console.log(`\n   ⚠️  Some recipes still need embeddings. Run again to update them.`)
    } else {
      console.log(`\n   🎉 Setup complete! All recipes have embeddings.`)
    }

    console.log('\n📖 Next Steps:')
    console.log('   1. Import your curated recipe dataset (1k-2k recipes recommended)')
    console.log('   2. Integrate RecipeFeedService in your Recipes screen')
    console.log('   3. Start using the smart surfacing feeds!')
    console.log('\n   See docs/RECIPE_VECTOR_SYSTEM_SETUP.md for details\n')

  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { main as setupVectorRecipes }
