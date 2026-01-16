// SAVR Share Service - Recipe sharing for viral growth
import { Share } from 'react-native'

export interface ShareableRecipe {
  id: string
  title: string
  image_url?: string
  matchPercentage?: number
  cookTime?: number
  servings?: number
}

class ShareService {
  private static instance: ShareService

  static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService()
    }
    return ShareService.instance
  }

  // Share recipe as text
  async shareRecipe(recipe: ShareableRecipe): Promise<boolean> {
    try {
      const shareText = this.createShareText(recipe)
      
      await Share.share({
        message: shareText,
        title: `Check out this recipe: ${recipe.title}`
      })

      return true
    } catch (error) {
      console.error('Error sharing recipe:', error)
      return false
    }
  }

  // Create shareable text format
  private createShareText(recipe: ShareableRecipe): string {
    let text = `🍽️ ${recipe.title}\n\n`
    
    if (recipe.matchPercentage) {
      text += `✅ ${recipe.matchPercentage}% match with my pantry!\n`
    }
    
    if (recipe.servings) {
      text += `👥 Serves ${recipe.servings}\n`
    }
    
    if (recipe.cookTime) {
      text += `⏱️ ${recipe.cookTime} minutes\n`
    }
    
    text += `\n📱 Made with SAVR - Smart Grocery & Recipe App`
    text += `\n💡 Save money by cooking with what you have!`
    
    return text
  }

  // Share shopping list
  async shareShoppingList(listName: string, items: string[]): Promise<boolean> {
    try {
      const shareText = `📝 ${listName}\n\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n📱 Created with SAVR`
      
      await Share.share({
        message: shareText,
        title: `Shopping List: ${listName}`
      })

      return true
    } catch (error) {
      console.error('Error sharing shopping list:', error)
      return false
    }
  }

  // Share meal plan
  async shareMealPlan(weekStart: Date, meals: any): Promise<boolean> {
    try {
      let shareText = `📅 Meal Plan for week of ${weekStart.toLocaleDateString()}\n\n`
      
      Object.entries(meals).forEach(([day, dayMeals]: [string, any]) => {
        if (dayMeals.breakfast || dayMeals.lunch || dayMeals.dinner) {
          shareText += `${day.toUpperCase()}:\n`
          if (dayMeals.breakfast) shareText += `  🍳 ${dayMeals.breakfast.title}\n`
          if (dayMeals.lunch) shareText += `  🥗 ${dayMeals.lunch.title}\n`
          if (dayMeals.dinner) shareText += `  🍽️ ${dayMeals.dinner.title}\n`
          shareText += `\n`
        }
      })
      
      shareText += `📱 Planned with SAVR - Save money, eat better!`
      
      await Share.share({
        message: shareText,
        title: 'My Meal Plan'
      })

      return true
    } catch (error) {
      console.error('Error sharing meal plan:', error)
      return false
    }
  }
}

export const shareService = ShareService.getInstance()

