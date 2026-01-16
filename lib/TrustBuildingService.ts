// SAVR Trust Building Service - Subtle elements that build user confidence and trust
import { aiLearningService } from './AILearningService'
import { userPreferencesService } from './UserPreferencesService'

export interface TrustIndicator {
  type: 'savings' | 'accuracy' | 'convenience' | 'learning' | 'personalization'
  message: string
  value?: string
  icon?: string
  subtle?: boolean
}

export interface UserTrustMetrics {
  totalSavings: number
  accuracyScore: number
  convenienceScore: number
  learningProgress: number
  personalizationLevel: number
  trustIndicators: TrustIndicator[]
}

class TrustBuildingService {
  private static instance: TrustBuildingService

  static getInstance(): TrustBuildingService {
    if (!TrustBuildingService.instance) {
      TrustBuildingService.instance = new TrustBuildingService()
    }
    return TrustBuildingService.instance
  }

  // Generate trust indicators for the user
  async generateTrustIndicators(userId: string): Promise<TrustIndicator[]> {
    try {
      const preferences = await userPreferencesService.loadPreferences(userId)
      const behaviorData = await aiLearningService.getLearningInsights(userId)
      
      const indicators: TrustIndicator[] = []

      // Savings indicators
      const savingsIndicators = this.generateSavingsIndicators(behaviorData, preferences)
      indicators.push(...savingsIndicators)

      // Accuracy indicators
      const accuracyIndicators = this.generateAccuracyIndicators(behaviorData)
      indicators.push(...accuracyIndicators)

      // Convenience indicators
      const convenienceIndicators = this.generateConvenienceIndicators(behaviorData, preferences)
      indicators.push(...convenienceIndicators)

      // Learning indicators
      const learningIndicators = this.generateLearningIndicators(behaviorData)
      indicators.push(...learningIndicators)

      // Personalization indicators
      const personalizationIndicators = this.generatePersonalizationIndicators(preferences)
      indicators.push(...personalizationIndicators)

      return indicators.filter(indicator => indicator.subtle !== false).slice(0, 3) // Show max 3 subtle indicators
    } catch (error) {
      console.error('Error generating trust indicators:', error)
      return []
    }
  }

  // Generate savings-related trust indicators
  private generateSavingsIndicators(behaviorData: any, preferences: any): TrustIndicator[] {
    const indicators: TrustIndicator[] = []

    // Mock savings calculation (in real app, this would be calculated from actual data)
    const estimatedSavings = 127.50
    const budget = preferences?.budget?.monthly ? parseInt(preferences.budget.monthly) : 500
    const savingsPercentage = (estimatedSavings / budget) * 100

    if (savingsPercentage > 20) {
      indicators.push({
        type: 'savings',
        message: 'Great savings this month',
        value: `$${estimatedSavings.toFixed(2)}`,
        icon: '💰',
        subtle: true
      })
    }

    // Shopping frequency optimization
    if (behaviorData.shoppingPattern === 'weekly') {
      indicators.push({
        type: 'savings',
        message: 'Weekly shopping saves money',
        icon: '📅',
        subtle: true
      })
    }

    return indicators
  }

  // Generate accuracy-related trust indicators
  private generateAccuracyIndicators(behaviorData: any): TrustIndicator[] {
    const indicators: TrustIndicator[] = []

    // Recipe accuracy based on cooking frequency
    if (behaviorData.cookingFrequency > 5) {
      indicators.push({
        type: 'accuracy',
        message: 'Recipes match your preferences',
        value: '95%',
        icon: '🎯',
        subtle: true
      })
    }

    // Household scaling accuracy
    if (behaviorData.cookingFrequency > 0) {
      indicators.push({
        type: 'accuracy',
        message: 'Perfect portions every time',
        icon: '⚖️',
        subtle: true
      })
    }

    return indicators
  }

  // Generate convenience-related trust indicators
  private generateConvenienceIndicators(behaviorData: any, preferences: any): TrustIndicator[] {
    const indicators: TrustIndicator[] = []

    // Time saved
    const timeSaved = behaviorData.cookingFrequency * 15 // 15 minutes saved per recipe
    if (timeSaved > 60) {
      indicators.push({
        type: 'convenience',
        message: 'Time saved this week',
        value: `${Math.round(timeSaved / 60)}h`,
        icon: '⏰',
        subtle: true
      })
    }

    // Effortless scaling
    if (preferences?.household?.size && parseInt(preferences.household.size) > 1) {
      indicators.push({
        type: 'convenience',
        message: 'No more portion math',
        icon: '🧮',
        subtle: true
      })
    }

    return indicators
  }

  // Generate learning-related trust indicators
  private generateLearningIndicators(behaviorData: any): TrustIndicator[] {
    const indicators: TrustIndicator[] = []

    // Learning progress
    if (behaviorData.cookingFrequency > 10) {
      indicators.push({
        type: 'learning',
        message: 'Getting smarter with each use',
        icon: '🧠',
        subtle: true
      })
    }

    // Preference learning
    if (behaviorData.favoriteIngredients.length > 3) {
      indicators.push({
        type: 'learning',
        message: 'Learning your taste preferences',
        icon: '👅',
        subtle: true
      })
    }

    return indicators
  }

  // Generate personalization-related trust indicators
  private generatePersonalizationIndicators(preferences: any): TrustIndicator[] {
    const indicators: TrustIndicator[] = []

    // Dietary preferences
    if (preferences?.dietary?.preferences?.length > 0) {
      indicators.push({
        type: 'personalization',
        message: 'Tailored to your diet',
        icon: '🥗',
        subtle: true
      })
    }

    // Household personalization
    if (preferences?.household?.size) {
      indicators.push({
        type: 'personalization',
        message: `Perfect for ${preferences.household.size} people`,
        icon: '👥',
        subtle: true
      })
    }

    return indicators
  }

  // Generate gentle success messages
  generateSuccessMessage(context: 'recipe_cooked' | 'shopping_completed' | 'list_created' | 'preferences_saved'): string {
    const messages = {
      recipe_cooked: [
        'Perfect portions, every time! 🎯',
        'Cooking made effortless! 👨‍🍳',
        'Another great meal! 🍽️'
      ],
      shopping_completed: [
        'Smart shopping complete! 🛒',
        'Everything you need, nothing you don\'t! ✅',
        'Shopping made simple! 🎉'
      ],
      list_created: [
        'Your smart list is ready! 📝',
        'All scaled perfectly for your household! ⚖️',
        'Shopping made effortless! 🚀'
      ],
      preferences_saved: [
        'Your preferences are saved! 💾',
        'Getting to know you better! 🤝',
        'Personalized just for you! ✨'
      ]
    }

    const contextMessages = messages[context] || ['Great job! 🎉']
    return contextMessages[Math.floor(Math.random() * contextMessages.length)]
  }

  // Generate gentle encouragement messages
  generateEncouragementMessage(context: 'first_recipe' | 'first_shopping' | 'learning_progress'): string {
    const messages = {
      first_recipe: [
        'You\'re getting the hang of this! 🌟',
        'First recipe down, many more to go! 🚀',
        'Great start! The app is learning your preferences! 🧠'
      ],
      first_shopping: [
        'Smart shopping in action! 🛒',
        'You\'re saving time and money already! 💰',
        'Effortless shopping at its finest! ✨'
      ],
      learning_progress: [
        'The app is getting smarter about your preferences! 🧠',
        'Your personalized experience is improving! 📈',
        'We\'re learning what you love! ❤️'
      ]
    }

    const contextMessages = messages[context] || ['Keep it up! 🌟']
    return contextMessages[Math.floor(Math.random() * contextMessages.length)]
  }

  // Generate subtle confidence boosters
  generateConfidenceBooster(): string {
    const boosters = [
      'You\'ve got this! 💪',
      'Making cooking effortless! ✨',
      'Smart choices, every time! 🎯',
      'You\'re a natural! 🌟',
      'Effortless cooking master! 👨‍🍳',
      'Saving time and money! 💰',
      'Perfect portions, every time! ⚖️',
      'Your kitchen, your rules! 👑'
    ]

    return boosters[Math.floor(Math.random() * boosters.length)]
  }

  // Track trust-building interactions
  async trackTrustInteraction(userId: string, interaction: {
    type: 'success' | 'encouragement' | 'confidence_boost'
    context: string
    message: string
  }): Promise<void> {
    // This would track which trust-building messages resonate with users
    // For now, just log for analytics
    console.log(`Trust interaction: ${interaction.type} - ${interaction.context} - ${interaction.message}`)
  }

  // Get user trust metrics
  async getUserTrustMetrics(userId: string): Promise<UserTrustMetrics> {
    try {
      const behaviorData = await aiLearningService.getLearningInsights(userId)
      const preferences = await userPreferencesService.loadPreferences(userId)
      
      // Calculate trust metrics
      const totalSavings = 127.50 // Mock data
      const accuracyScore = Math.min(95, 70 + (behaviorData.cookingFrequency * 2))
      const convenienceScore = Math.min(98, 80 + (behaviorData.cookingFrequency * 3))
      const learningProgress = Math.min(100, behaviorData.cookingFrequency * 10)
      const personalizationLevel = preferences ? 85 : 0

      const trustIndicators = await this.generateTrustIndicators(userId)

      return {
        totalSavings,
        accuracyScore,
        convenienceScore,
        learningProgress,
        personalizationLevel,
        trustIndicators
      }
    } catch (error) {
      console.error('Error getting user trust metrics:', error)
      return {
        totalSavings: 0,
        accuracyScore: 0,
        convenienceScore: 0,
        learningProgress: 0,
        personalizationLevel: 0,
        trustIndicators: []
      }
    }
  }
}

export const trustBuildingService = TrustBuildingService.getInstance()
