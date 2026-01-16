// Cooking Flashcards - Enhanced Step-by-step cooking mode with Voice & Timers
import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Alert,
  ScrollView,
  Switch
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as Speech from 'expo-speech'
import { Ionicons } from '@expo/vector-icons'
import { useRecipes } from '../lib/RecipesContext'
import { usePantry } from '../lib/PantryContext'
import RecipeRatingPrompt from '../components/RecipeRatingPrompt'
import { useAuth } from '../lib/AuthContext'
import { recipeSuccessTrackingService } from '../lib/RecipeSuccessTrackingService'
import { formatIngredientDisplay } from '../lib/IngredientFormatter'

const { width, height } = Dimensions.get('window')



export default function CookingFlashcardsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { recipeId, recipe: recipeParam } = params
  const { getRecipeById, calculateIngredientMatch, markRecipeCooked, saveRecipe } = useRecipes()
  const { items: pantryItems, consumeItem } = usePantry()
  const { user } = useAuth()
  
  const [recipe, setRecipe] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(-1) // -1 = ingredient checklist, 0+ = cooking steps
  const [loading, setLoading] = useState(true)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [timerActive, setTimerActive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerPaused, setTimerPaused] = useState(false)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const [showRatingPrompt, setShowRatingPrompt] = useState(false)
  const [actualCookTime, setActualCookTime] = useState(0)
  const [multipleTimers, setMultipleTimers] = useState<Array<{id: string, name: string, seconds: number, active: boolean}>>([])
  const timerInterval = useRef<any>(null)

  useEffect(() => {
    loadRecipe()
    
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [recipeId, recipeParam])
  
  // Auto-read instruction when step changes
  useEffect(() => {
    if (recipe && voiceEnabled) {
      readCurrentInstruction()
    }
  }, [currentStep, recipe, voiceEnabled])
  

  const readCurrentInstruction = () => {
    if (!recipe || !recipe.instructions[currentStep]) return
    
    const instruction = typeof recipe.instructions[currentStep] === 'string'
      ? recipe.instructions[currentStep]
      : recipe.instructions[currentStep]?.description || ''
    
    Speech.speak(`Step ${currentStep + 1}. ${instruction}`, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    })
  }
  
  const startTimerFromStep = () => {
    const instruction = typeof recipe.instructions[currentStep] === 'string'
      ? recipe.instructions[currentStep]
      : recipe.instructions[currentStep]?.description || ''
    
    // Extract time from instruction (e.g., "10 minutes", "5 min", "30 seconds")
    const timeMatch = instruction.match(/(\d+)\s*(minute|min|second|sec)/i)
    
    if (timeMatch) {
      const amount = parseInt(timeMatch[1])
      const unit = timeMatch[2].toLowerCase()
      const seconds = unit.startsWith('min') ? amount * 60 : amount
      
      startTimer(seconds)
    } else {
      Alert.alert('No Timer Found', 'This step doesn\'t mention a specific time')
    }
  }
  
  const startTimer = (seconds: number, timerName?: string) => {
    // Stop any existing timer
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    
    setTimerSeconds(seconds)
    setTimerActive(true)
    setTimerPaused(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    
    // Add to multiple timers if name provided
    if (timerName) {
      const timerId = Date.now().toString()
      setMultipleTimers(prev => [...prev, {
        id: timerId,
        name: timerName,
        seconds: seconds,
        active: true
      }])
    }
    
    timerInterval.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current)
          setTimerActive(false)
          setTimerPaused(false)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          
          // Enhanced timer completion
          const completionMessage = timerName 
            ? `${timerName} timer finished!` 
            : 'Timer finished!'
          
          Speech.speak(completionMessage, { 
            language: 'en-US',
            rate: 0.8,
            pitch: 1.1
          })
          
          Alert.alert(
            '⏰ Timer Complete!', 
            completionMessage,
            [
              { text: 'OK', style: 'default' },
              { text: 'Start Next Timer', onPress: () => startNextTimer() }
            ]
          )
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }
  
  const pauseTimer = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    setTimerPaused(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Speech.speak('Timer paused', { language: 'en-US' })
  }
  
  const resumeTimer = () => {
    if (timerPaused && timerSeconds > 0) {
      setTimerPaused(false)
      timerInterval.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval.current)
            setTimerActive(false)
            setTimerPaused(false)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            Speech.speak('Timer finished!', { language: 'en-US' })
            Alert.alert('⏰ Timer Complete!', 'Your timer has finished')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Speech.speak('Timer resumed', { language: 'en-US' })
    }
  }
  
  const stopTimer = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    setTimerActive(false)
    setTimerPaused(false)
    setTimerSeconds(0)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Speech.speak('Timer stopped', { language: 'en-US' })
  }
  
  const startNextTimer = () => {
    const nextTimer = multipleTimers.find(t => !t.active)
    if (nextTimer) {
      startTimer(nextTimer.seconds, nextTimer.name)
    }
  }
  
  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const loadRecipe = async () => {
    // First check if recipe is passed as param (from AI recipe detail)
    if (recipeParam && typeof recipeParam === 'string') {
      try {
        const recipeData = JSON.parse(recipeParam)
        setRecipe(recipeData)
        setStartTime(new Date()) // Start tracking time
        setLoading(false)
        return
      } catch (error) {
        console.error('Error parsing recipe param:', error)
      }
    }
    
    // Otherwise, load by recipeId
    if (!recipeId || typeof recipeId !== 'string') {
      setLoading(false)
      return
    }
    
    const recipeData = await getRecipeById(recipeId)
    if (recipeData) {
      setRecipe(recipeData)
      setStartTime(new Date()) // Start tracking time
    }
    setLoading(false)
  }

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // Start cooking (from ingredients checklist)
    if (currentStep === -1) {
      setCurrentStep(0)
      setStartTime(new Date()) // Start tracking time when cooking begins
      
      // Deduct ingredients from pantry that are in pantry
      if (recipe && recipe.ingredients && pantryItems && consumeItem) {
        recipe.ingredients.forEach(async (ing: any) => {
          if (ing.inPantry) {
            // Find matching pantry item
            for (const pantryItem of pantryItems) {
              const { ingredientMatchingService } = require('../lib/IngredientMatchingService')
              const matchResult = ingredientMatchingService.matchIngredient(ing.name, pantryItem.name)
              
              if (matchResult.isMatch && matchResult.confidence >= 0.70) {
                // Calculate quantity to deduct based on recipe quantity
                const recipeQty = parseFloat(ing.quantity) || 1
                
                // Use consumeItem API which takes itemName and quantity
                await consumeItem(pantryItem.name, recipeQty)
                
                console.log(`✅ Deducted ${recipeQty} ${ing.unit} ${ing.name} from pantry`)
                break
              }
            }
          }
        })
      }
      
      return
    }
    
    if (currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // User completed all steps - record cooking event
      handleCookingComplete()
    }
  }

  const handlePrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentStep > -1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  const toggleIngredientCheck = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newChecked = new Set(checkedIngredients)
    if (newChecked.has(index)) {
      newChecked.delete(index)
    } else {
      newChecked.add(index)
    }
    setCheckedIngredients(newChecked)
  }
  
  const checkIngredientInPantry = (ingredientName: string) => {
    const normalizedName = ingredientName.toLowerCase()
    return pantryItems.some((item: any) => 
      item.name.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(item.name.toLowerCase())
    )
  }

  const handleCookingComplete = async () => {
    if (!recipe || !user) return
    
    // Stop any active timer
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    setTimerActive(false)
    setTimerPaused(false)
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    
    // Calculate cooking time
    const endTime = new Date()
    const timeTaken = startTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60) : 0
    setActualCookTime(timeTaken)
    
    // Enhanced completion celebration with voice
    const celebrationMessages = [
      `Congratulations! You've completed ${recipe.title}!`,
      `Great job! You finished cooking in ${timeTaken} minutes!`,
      `Amazing work! Your ${recipe.title} is ready!`,
      `Fantastic! You've successfully cooked ${recipe.title}!`
    ]
    
    const randomMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]
    
    // Speak celebration message
    if (voiceEnabled) {
      Speech.speak(randomMessage, { 
        language: 'en-US',
        rate: 0.8,
        pitch: 1.1
      })
    }
    
    // 🧠 AI LEARNING: Automatically track that user cooked this recipe
    try {
      // Track to recipe_outcomes table (for AI learning)
      await recipeSuccessTrackingService.trackRecipeOutcome({
        userId: user.id,
        recipeId: recipe.id,
        completed: true,
        actualCookTime: timeTaken,
        wouldMakeAgain: true, // Will be updated if they rate
        cookedAt: new Date()
      })
      console.log(`🧠 Auto-tracked recipe cooked: ${recipe.title} in ${timeTaken}min`)
      
      // CRITICAL: Also update saved_recipes.times_cooked so it appears in cooking history
      // First, ensure the recipe is saved (if it's not already)
      // saveRecipe returns true if already saved or successfully saved
      const wasSaved = await saveRecipe(recipe.id)
      
      if (wasSaved) {
        // Now mark it as cooked (this updates times_cooked and last_cooked in saved_recipes)
        const marked = await markRecipeCooked(recipe.id)
        if (marked) {
          console.log(`✅ Updated cooking history: ${recipe.title} (now appears in history)`)
        } else {
          console.warn(`⚠️ Failed to mark recipe as cooked: ${recipe.title}`)
        }
      } else {
        console.warn(`⚠️ Could not save recipe before marking as cooked: ${recipe.title}`)
      }
    } catch (error) {
      console.error('Error tracking recipe:', error)
    }
    
    // Show rating prompt instead of alert
    setShowRatingPrompt(true)
  }

  const handleRatingComplete = () => {
    setShowRatingPrompt(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    
    // Show quick success message
    Alert.alert(
      '🎉 Great job!',
      'Thanks for cooking with SAVR!',
      [{ text: 'Done', onPress: () => router.back() }]
    )
  }

  const handleRatingSkip = () => {
    setShowRatingPrompt(false)
    router.back()
  }

  const handleClose = () => {
    Alert.alert(
      'Exit Cooking?',
      'Your progress will not be saved',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Exit', 
          style: 'destructive',
          onPress: () => router.back()
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          style={styles.gradient}
        >
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </LinearGradient>
      </View>
    )
  }

  if (!recipe) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          style={styles.gradient}
        >
          <Text style={styles.errorText}>Recipe not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </LinearGradient>
      </View>
    )
  }

  // Ingredient checklist view (before cooking starts)
  if (currentStep === -1) {
    const ingredientsWithStatus = recipe.ingredients.map((ing: any, index: number) => ({
      ...ing,
      inPantry: checkIngredientInPantry(ing.name),
      checked: checkedIngredients.has(index)
    }))
    
    const allChecked = checkedIngredients.size === recipe.ingredients.length
    
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="dark" />
        
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#1C1C1E" />
            </Pressable>
            
            <View style={styles.headerInfo}>
              <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.stepCounter}>Gather your ingredients</Text>
            </View>
          </View>
          
          {/* Ingredients Checklist */}
          <ScrollView 
            style={styles.checklistScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.checklistContainer}
          >
            <Text style={styles.checklistTitle}>📋 Ingredient Checklist</Text>
            <Text style={styles.checklistSubtitle}>
              Check off ingredients as you gather them
            </Text>
            
            {ingredientsWithStatus.map((ing: any, index: number) => (
              <Pressable
                key={index}
                style={styles.ingredientCheckItem}
                onPress={() => toggleIngredientCheck(index)}
              >
                <View style={[
                  styles.checkbox,
                  ing.checked && styles.checkboxChecked
                ]}>
                  {ing.checked && (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  )}
                </View>
                
                <View style={styles.ingredientCheckInfo}>
                  <Text style={[
                    styles.ingredientCheckName,
                    ing.checked && styles.ingredientCheckNameChecked
                  ]}>
                    {formatIngredientDisplay(ing.quantity, ing.unit, ing.name)}
                  </Text>
                </View>
                
                {ing.inPantry && (
                  <View style={styles.inPantryBadge}>
                    <Text style={styles.inPantryText}>In Pantry</Text>
                  </View>
                )}
              </Pressable>
            ))}
            
            <View style={{ height: 120 }} />
          </ScrollView>
          
          {/* Start Cooking Button */}
          <View style={styles.startCookingContainer}>
            <Pressable
              style={styles.startCookingButton}
              onPress={handleNext}
            >
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startCookingGradient}
              >
                <Ionicons name="flame" size={24} color="#FFFFFF" />
                <Text style={styles.startCookingText}>
                  {allChecked ? 'Start Cooking!' : 'Start Cooking Anyway'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    )
  }
  
  // Cooking steps view
  const currentInstruction = recipe.instructions[currentStep]
  const progress = ((currentStep + 1) / recipe.instructions.length) * 100
  
  // Check if current instruction mentions time (for timer suggestion)
  const instructionText = typeof currentInstruction === 'string' 
    ? currentInstruction 
    : currentInstruction?.description || ''
  const hasTime = /(\d+)\s*(minute|min|second|sec)/i.test(instructionText)

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#1C1C1E" />
          </Pressable>
          
          <View style={styles.headerInfo}>
            <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
            <Text style={styles.stepCounter}>
              Step {currentStep + 1} of {recipe.instructions.length}
            </Text>
          </View>
          
          {/* Voice Toggle */}
          <View style={styles.voiceToggle}>
            <Ionicons name="volume-high" size={18} color="#6A9571" />
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ false: '#E0E0E0', true: '#6A9571' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        {/* Timer Display (if active) */}
        {timerActive && (
          <View style={styles.timerContainer}>
            <LinearGradient
              colors={timerPaused 
                ? ['rgba(255, 193, 7, 0.95)', 'rgba(255, 152, 0, 0.95)']
                : ['rgba(106, 149, 113, 0.95)', 'rgba(138, 184, 150, 0.95)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timerGradient}
            >
              <Ionicons 
                name={timerPaused ? "pause-circle" : "timer-outline"} 
                size={32} 
                color="#FFFFFF" 
              />
              <Text style={styles.timerText}>
                {timerPaused ? 'PAUSED' : formatTime(timerSeconds)}
              </Text>
              <View style={styles.timerControls}>
                {timerPaused ? (
                  <Pressable 
                    onPress={resumeTimer} 
                    style={styles.timerControlButton}
                    accessibilityLabel="Resume timer"
                    accessibilityHint="Resumes the paused timer"
                  >
                    <Ionicons name="play-circle" size={32} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <Pressable 
                    onPress={pauseTimer} 
                    style={styles.timerControlButton}
                    accessibilityLabel="Pause timer"
                    accessibilityHint="Pauses the running timer"
                  >
                    <Ionicons name="pause-circle" size={32} color="#FFFFFF" />
                  </Pressable>
                )}
                <Pressable 
                  onPress={stopTimer} 
                  style={styles.timerControlButton}
                  accessibilityLabel="Stop timer"
                  accessibilityHint="Stops and cancels the timer"
                >
                  <Ionicons name="stop-circle" size={32} color="#FFFFFF" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Flashcard */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.cardGradient}
            >
              <ScrollView 
                style={styles.cardScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.cardContent}
              >
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>{currentStep + 1}</Text>
                </View>
                
                <Text style={styles.instructionText}>{instructionText}</Text>
                
                {/* Timer Button if step mentions time */}
                {hasTime && !timerActive && (
                  <Pressable 
                    style={styles.startTimerButton}
                    onPress={startTimerFromStep}
                  >
                    <Ionicons name="timer-outline" size={20} color="#6A9571" />
                    <Text style={styles.startTimerText}>Start Timer</Text>
                  </Pressable>
                )}
              </ScrollView>
            </LinearGradient>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <Pressable
            style={styles.repeatButton}
            onPress={readCurrentInstruction}
            accessibilityLabel="Repeat instruction"
            accessibilityHint="Repeats the current cooking step"
          >
            <Ionicons name="refresh-outline" size={24} color="#6A9571" />
          </Pressable>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigation}>
          <Pressable
            style={[styles.navButton, currentStep === -1 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentStep === -1}
            accessibilityLabel="Previous step"
            accessibilityHint={currentStep === -1 ? "Cannot go back from ingredient checklist" : "Go to previous cooking step"}
          >
            <LinearGradient
              colors={currentStep === -1 
                ? ['#E0E0E0', '#CCCCCC']
                : ['rgba(106, 149, 113, 0.2)', 'rgba(138, 184, 150, 0.3)']
              }
              style={styles.navButtonGradient}
            >
              <Ionicons 
                name="chevron-back" 
                size={24} 
                color={currentStep === -1 ? '#999999' : '#6A9571'} 
              />
              <Text style={[
                styles.navButtonText,
                currentStep === -1 && styles.navButtonTextDisabled
              ]}>
                Previous
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.navButton}
            onPress={handleNext}
            accessibilityLabel={currentStep === recipe.instructions.length - 1 ? "Finish cooking" : "Next step"}
            accessibilityHint={currentStep === recipe.instructions.length - 1 ? "Complete the recipe" : "Go to next cooking step"}
          >
            <LinearGradient
              colors={currentStep === recipe.instructions.length - 1
                ? ['#6A9571', '#8AB896']
                : ['rgba(106, 149, 113, 0.2)', 'rgba(138, 184, 150, 0.3)']
              }
              style={styles.navButtonGradient}
            >
              <Text style={[
                styles.navButtonText,
                currentStep === recipe.instructions.length - 1 && styles.navButtonTextActive
              ]}>
                {currentStep === recipe.instructions.length - 1 ? 'Finish Cooking' : 'Next'}
              </Text>
              <Ionicons 
                name={currentStep === recipe.instructions.length - 1 ? 'checkmark' : 'chevron-forward'}
                size={24} 
                color={currentStep === recipe.instructions.length - 1 ? '#FFFFFF' : '#6A9571'} 
              />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Recipe Rating Prompt - shown after completing all flashcards */}
      {recipe && user && (
        <RecipeRatingPrompt
          visible={showRatingPrompt}
          recipeId={recipe.id}
          recipeName={recipe.title}
          userId={user.id}
          statedCookTime={recipe.cook_time || 30}
          onComplete={handleRatingComplete}
          onSkip={handleRatingSkip}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6A9571',
    minWidth: 45,
    textAlign: 'right',
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    minHeight: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardGradient: {
    flex: 1,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepNumberBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepNumberText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  instructionText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  startTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 2,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  startTimerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6A9571',
  },
  timerContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  timerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 2,
  },
  timerStopButton: {
    padding: 4,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 8,
  },
  timerControlButton: {
    padding: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  repeatButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  navigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  navButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 8,
  },
  navButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6A9571',
    letterSpacing: -0.3,
  },
  navButtonTextDisabled: {
    color: '#999999',
  },
  navButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginTop: height / 2 - 50,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: height / 2 - 100,
  },
  backButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#6A9571',
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Ingredient Checklist Styles
  checklistScroll: {
    flex: 1,
  },
  checklistContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  checklistTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  checklistSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 24,
  },
  ingredientCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  checkboxChecked: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  ingredientCheckInfo: {
    flex: 1,
  },
  ingredientCheckName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  ingredientCheckNameChecked: {
    color: '#8E8E93',
    textDecorationLine: 'line-through',
  },
  ingredientCheckAmount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  inPantryBadge: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inPantryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6A9571',
  },
  startCookingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(254, 252, 246, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  startCookingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startCookingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  startCookingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
})

