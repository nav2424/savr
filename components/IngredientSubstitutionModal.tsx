// Ingredient Substitution Modal Component
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePantry } from '../lib/PantryContext'

interface IngredientSubstitutionModalProps {
  visible: boolean
  onClose: () => void
  ingredient: {
    name: string
    amount: string
    unit: string
  }
  onSubstitute: (original: string, substitute: string, amount: string) => void
}

// Common ingredient substitutions
const SUBSTITUTIONS: Record<string, string[]> = {
  'butter': ['margarine', 'coconut oil', 'olive oil', 'vegetable oil'],
  'milk': ['almond milk', 'soy milk', 'oat milk', 'coconut milk', 'water'],
  'eggs': ['flax eggs', 'applesauce', 'banana', 'yogurt', 'silken tofu'],
  'flour': ['almond flour', 'coconut flour', 'oat flour', 'rice flour'],
  'sugar': ['honey', 'maple syrup', 'stevia', 'coconut sugar', 'agave'],
  'oil': ['butter', 'coconut oil', 'olive oil', 'applesauce'],
  'cheese': ['nutritional yeast', 'cashew cheese', 'dairy-free cheese'],
  'cream': ['coconut cream', 'cashew cream', 'almond milk'],
  'yogurt': ['coconut yogurt', 'almond yogurt', 'soy yogurt'],
  'chicken': ['tofu', 'tempeh', 'mushrooms', 'beans'],
  'beef': ['lentils', 'mushrooms', 'tofu', 'beans'],
  'pork': ['chicken', 'turkey', 'tofu', 'mushrooms'],
  'fish': ['tofu', 'tempeh', 'mushrooms', 'chickpeas'],
  'onion': ['shallots', 'leeks', 'scallions', 'onion powder'],
  'garlic': ['garlic powder', 'shallots', 'leeks'],
  'tomato': ['tomato paste', 'canned tomatoes', 'sun-dried tomatoes'],
  'lemon': ['lime', 'vinegar', 'citric acid'],
  'lime': ['lemon', 'vinegar', 'citric acid'],
  'wine': ['broth', 'vinegar', 'juice', 'water'],
  'vinegar': ['lemon juice', 'lime juice', 'wine'],
  'salt': ['soy sauce', 'tamari', 'miso paste'],
  'pepper': ['cayenne', 'paprika', 'chili powder'],
  'herbs': ['dried herbs', 'herb paste', 'herb oil']
}

export default function IngredientSubstitutionModal({
  visible,
  onClose,
  ingredient,
  onSubstitute
}: IngredientSubstitutionModalProps) {
  const { items: pantryItems } = usePantry()
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>('')
  const [customSubstitute, setCustomSubstitute] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [loading, setLoading] = useState(false)

  // Get available substitutions
  const getSubstitutions = () => {
    const ingredientName = ingredient.name.toLowerCase()
    
    // Find direct matches
    for (const [key, subs] of Object.entries(SUBSTITUTIONS)) {
      if (ingredientName.includes(key)) {
        return subs
      }
    }
    
    // Check pantry for available alternatives
    const pantryAlternatives = pantryItems
      .filter(item => 
        item.name.toLowerCase() !== ingredientName &&
        (item.name.toLowerCase().includes(ingredientName.split(' ')[0]) ||
         ingredientName.includes(item.name.toLowerCase().split(' ')[0]))
      )
      .map(item => item.name)
    
    // Combine with common substitutions
    const commonSubs = SUBSTITUTIONS[ingredientName] || []
    return [...new Set([...commonSubs, ...pantryAlternatives])]
  }

  const substitutions = getSubstitutions()

  const handleSubstitute = async () => {
    if (!selectedSubstitute && !customSubstitute) {
      Alert.alert('Please select a substitute', 'Choose from the list or enter a custom substitute.')
      return
    }

    setLoading(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const substitute = selectedSubstitute || customSubstitute
      onSubstitute(ingredient.name, substitute, ingredient.amount)
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onClose()
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to substitute ingredient. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedSubstitute('')
    setCustomSubstitute('')
    setShowCustomInput(false)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={24} color="#1C1C1E" />
          </Pressable>
          <Text style={styles.title}>Substitute Ingredient</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Ingredient Info */}
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName}>{ingredient.name}</Text>
          <Text style={styles.ingredientAmount}>
            {ingredient.amount} {ingredient.unit}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Suggested Substitutions */}
          {substitutions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested Substitutions</Text>
              {substitutions.map((sub, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.substituteOption,
                    selectedSubstitute === sub && styles.selectedOption
                  ]}
                  onPress={() => {
                    setSelectedSubstitute(sub)
                    setCustomSubstitute('')
                    setShowCustomInput(false)
                  }}
                >
                  <Text style={[
                    styles.substituteText,
                    selectedSubstitute === sub && styles.selectedText
                  ]}>
                    {sub}
                  </Text>
                  {selectedSubstitute === sub && (
                    <Ionicons name="checkmark" size={20} color="#6A9571" />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Custom Substitute */}
          <View style={styles.section}>
            <Pressable
              style={styles.customButton}
              onPress={() => {
                setShowCustomInput(!showCustomInput)
                setSelectedSubstitute('')
              }}
            >
              <Text style={styles.customButtonText}>
                {showCustomInput ? 'Hide' : 'Enter'} Custom Substitute
              </Text>
              <Ionicons 
                name={showCustomInput ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#6A9571" 
              />
            </Pressable>

            {showCustomInput && (
              <TextInput
                style={styles.customInput}
                placeholder="Enter substitute ingredient..."
                value={customSubstitute}
                onChangeText={setCustomSubstitute}
                autoFocus
              />
            )}
          </View>

          {/* Pantry Items */}
          {pantryItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>From Your Pantry</Text>
              {pantryItems.slice(0, 5).map((item, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.substituteOption,
                    selectedSubstitute === item.name && styles.selectedOption
                  ]}
                  onPress={() => {
                    setSelectedSubstitute(item.name)
                    setCustomSubstitute('')
                    setShowCustomInput(false)
                  }}
                >
                  <Text style={[
                    styles.substituteText,
                    selectedSubstitute === item.name && styles.selectedText
                  ]}>
                    {item.name}
                  </Text>
                  {selectedSubstitute === item.name && (
                    <Ionicons name="checkmark" size={20} color="#6A9571" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          
          <Pressable
            style={[styles.substituteButton, loading && styles.disabledButton]}
            onPress={handleSubstitute}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.substituteButtonText}>Substitute</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  placeholder: {
    width: 40,
  },
  ingredientInfo: {
    padding: 20,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
  },
  ingredientName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  ingredientAmount: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  substituteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  selectedOption: {
    backgroundColor: '#E8F5E8',
    borderColor: '#6A9571',
  },
  substituteText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  selectedText: {
    color: '#6A9571',
    fontWeight: '500',
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  customButtonText: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '500',
  },
  customInput: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    fontSize: 16,
    color: '#1C1C1E',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  substituteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#6A9571',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  substituteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
