// Recipe Import Script
// Run this script to import curated recipes into your database
// Usage: npx ts-node scripts/import-recipes.ts

import { recipeImportService } from '../lib/RecipeImportService'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Import recipes from a JSON file
 */
async function importFromFile(filePath: string, userId?: string) {
  try {
    console.log(`📂 Reading recipes from: ${filePath}`)

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const jsonData = JSON.parse(fileContent)

    const result = await recipeImportService.importFromJSON(jsonData, userId, {
      generateEmbeddings: true,
      batchSize: 10,
      continueOnError: true,
    })

    console.log('\n📊 Import Summary:')
    console.log(`✅ Successfully imported: ${result.imported}`)
    console.log(`❌ Failed: ${result.failed}`)
    
    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }

    return result
  } catch (error) {
    console.error('❌ Error importing from file:', error)
    throw error
  }
}

/**
 * Generate and import sample recipes for testing
 */
async function importSamples(count: number = 20, userId?: string) {
  console.log(`🎲 Generating ${count} sample recipes...`)
  
  const samples = recipeImportService.generateSampleRecipes(count)
  const result = await recipeImportService.importRecipes(samples, userId, {
    generateEmbeddings: true,
    batchSize: 5,
    continueOnError: true,
  })

  console.log('\n📊 Sample Import Summary:')
  console.log(`✅ Successfully imported: ${result.imported}`)
  console.log(`❌ Failed: ${result.failed}`)

  return result
}

/**
 * Update embeddings for existing recipes
 */
async function updateEmbeddings(limit: number = 100) {
  console.log(`🔮 Updating embeddings for existing recipes...`)
  const updated = await recipeImportService.updateMissingEmbeddings(limit)
  console.log(`✅ Updated ${updated} embeddings`)
  return updated
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'file':
        const filePath = args[1] || './recipes.json'
        await importFromFile(filePath)
        break

      case 'samples':
        const count = parseInt(args[1] || '20', 10)
        await importSamples(count)
        break

      case 'embeddings':
        const limit = parseInt(args[1] || '100', 10)
        await updateEmbeddings(limit)
        break

      default:
        console.log(`
📚 Recipe Import Script

Usage:
  npx ts-node scripts/import-recipes.ts <command> [options]

Commands:
  file <path>        Import recipes from JSON file
  samples [count]    Generate and import sample recipes (default: 20)
  embeddings [limit] Update embeddings for existing recipes (default: 100)

Examples:
  npx ts-node scripts/import-recipes.ts file ./recipes.json
  npx ts-node scripts/import-recipes.ts samples 50
  npx ts-node scripts/import-recipes.ts embeddings 200
        `)
    }
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { importFromFile, importSamples, updateEmbeddings }

