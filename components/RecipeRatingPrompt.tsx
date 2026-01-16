// Recipe Rating Prompt - Simple, non-intrusive way to collect recipe feedback
import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, Modal } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { recipeSuccessTrackingService, RecipeOutcome } from '../lib/RecipeSuccessTrackingService'

interface RecipeRatingPromptProps {
  visible: boolean
  recipeId: string
  recipeName: string
  userId: string
  statedCookTime: number
  onComplete: () => void
  onSkip: () => void
}

export default function RecipeRatingPrompt({
  visible,
  recipeId,
  recipeName,
  userId,
  statedCookTime,
  onComplete,
  onSkip
}: RecipeRatingPromptProps) {
  const [enjoyment, setEnjoyment] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<'easier_than_expected' | 'as_expected' | 'harder_than_expected' | null>(null)
  const [wouldMakeAgain, setWouldMakeAgain] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleStarPress = (rating: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEnjoyment(rating)
  }

  const handleSubmit = async () => {
    if (!enjoyment || !wouldMakeAgain) return

    setSubmitting(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const outcome: RecipeOutcome = {
      userId,
      recipeId,
      completed: true,
      enjoymentRating: enjoyment,
      difficultyFeedback: difficulty || 'as_expected',
      wouldMakeAgain: wouldMakeAgain === true,
      cookedAt: new Date()
    }

    await recipeSuccessTrackingService.trackRecipeOutcome(outcome)
    
    // Reset state
    setEnjoyment(null)
    setDifficulty(null)
    setWouldMakeAgain(null)
    setSubmitting(false)

    onComplete()
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEnjoyment(null)
    setDifficulty(null)
    setWouldMakeAgain(null)
    onSkip()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleSkip} />
        
        <View style={styles.container}>
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.emoji}>👨‍🍳</Text>
              <Text style={styles.title}>How was it?</Text>
              <Text style={styles.subtitle}>{recipeName}</Text>
            </View>

            {/* Star Rating */}
            <View style={styles.section}>
              <Text style={styles.question}>How much did you enjoy it?</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Pressable
                    key={star}
                    style={styles.starButton}
                    onPress={() => handleStarPress(star)}
                  >
                    <Text style={[
                      styles.star,
                      (enjoyment && star <= enjoyment) ? styles.starFilled : undefined
                    ]}>
                      {enjoyment && star <= enjoyment ? '⭐' : '☆'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Make Again? */}
            <View style={styles.section}>
              <Text style={styles.question}>Would you make it again?</Text>
              <View style={styles.yesNoButtons}>
                <Pressable
                  style={[
                    styles.yesNoButton,
                    wouldMakeAgain === true && styles.yesNoButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setWouldMakeAgain(true)
                  }}
                >
                  <Text style={[
                    styles.yesNoText,
                    wouldMakeAgain === true && styles.yesNoTextActive
                  ]}>
                    👍 Yes
                  </Text>
                </Pressable>
                
                <Pressable
                  style={[
                    styles.yesNoButton,
                    wouldMakeAgain === false && styles.yesNoButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setWouldMakeAgain(false)
                  }}
                >
                  <Text style={[
                    styles.yesNoText,
                    wouldMakeAgain === false && styles.yesNoTextActive
                  ]}>
                    👎 No
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Optional: Difficulty (collapsed for simplicity) */}
            {enjoyment && enjoyment >= 4 && (
              <View style={styles.section}>
                <Text style={styles.questionOptional}>Was it easier or harder than expected?</Text>
                <View style={styles.difficultyButtons}>
                  <Pressable
                    style={[styles.diffButton, difficulty === 'easier_than_expected' && styles.diffButtonActive]}
                    onPress={() => setDifficulty('easier_than_expected')}
                  >
                    <Text style={[styles.diffText, difficulty === 'easier_than_expected' && styles.diffTextActive]}>
                      Easier
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.diffButton, difficulty === 'as_expected' && styles.diffButtonActive]}
                    onPress={() => setDifficulty('as_expected')}
                  >
                    <Text style={[styles.diffText, difficulty === 'as_expected' && styles.diffTextActive]}>
                      Just Right
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.diffButton, difficulty === 'harder_than_expected' && styles.diffButtonActive]}
                    onPress={() => setDifficulty('harder_than_expected')}
                  >
                    <Text style={[styles.diffText, difficulty === 'harder_than_expected' && styles.diffTextActive]}>
                      Harder
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.submitButton,
                  (!enjoyment || wouldMakeAgain === null) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!enjoyment || wouldMakeAgain === null || submitting}
              >
                <LinearGradient
                  colors={enjoyment && wouldMakeAgain !== null
                    ? ['#6A9571', '#8AB896']
                    : ['#E0E0E0', '#CCCCCC']
                  }
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText}>
                    {submitting ? 'Saving...' : 'Submit'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            {/* AI Learning Notice */}
            <Text style={styles.notice}>
              🧠 Helps AI suggest better recipes for you
            </Text>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  gradient: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  questionOptional: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 36,
    color: '#E0E0E0',
  },
  starFilled: {
    color: '#FFD700',
  },
  yesNoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  yesNoButtonActive: {
    backgroundColor: '#E9F1EB',
    borderColor: '#6A9571',
  },
  yesNoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  yesNoTextActive: {
    color: '#6A9571',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  diffButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  diffButtonActive: {
    backgroundColor: '#E9F1EB',
    borderColor: '#6A9571',
  },
  diffText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  diffTextActive: {
    color: '#6A9571',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  submitButton: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  notice: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
  },
})

