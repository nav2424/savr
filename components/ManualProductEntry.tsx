// SAVR Manual Product Entry - For products not found in database
import React, { useState } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Modal, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { barcodeService } from '../lib/BarcodeService'
import { useAuth } from '../lib/AuthContext'

interface ManualProductEntryProps {
  visible: boolean
  barcode: string
  onClose: () => void
  onSuccess: (product: any) => void
}

export default function ManualProductEntry({ visible, barcode, onClose, onSuccess }: ManualProductEntryProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Other')
  const [servingSize, setServingSize] = useState('100g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = [
    'Produce', 'Meat', 'Seafood', 'Dairy', 'Grains', 
    'Snacks', 'Beverages', 'Condiments', 'Frozen', 'Other'
  ]

  const handleSave = async () => {
    if (!name || !calories || !protein || !carbs || !fat || !user?.id) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    setSaving(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const product = await barcodeService.addManualProduct({
        barcode,
        name,
        brand: brand || undefined,
        category,
        nutrition: {
          servingSize,
          calories: parseFloat(calories),
          protein: parseFloat(protein),
          carbs: parseFloat(carbs),
          fat: parseFloat(fat)
        }
      }, user.id)

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSuccess(product)
      resetForm()
      onClose()
    } catch (error) {
      console.error('Error saving manual product:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setName('')
    setBrand('')
    setCategory('Other')
    setServingSize('100g')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#F8FAF9', '#FFFFFF']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onClose()
            }}
          >
            <Ionicons name="close" size={24} color="#1C1C1E" />
          </Pressable>
          <Text style={styles.headerTitle}>Add Product</Text>
          <Pressable
            style={[styles.saveButton, (!name || !calories) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!name || !calories || saving}
          >
            <Text style={[styles.saveButtonText, (!name || !calories) && styles.saveButtonTextDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Barcode Info */}
          <View style={styles.barcodeInfo}>
            <Ionicons name="barcode-outline" size={32} color="#6A9571" />
            <View style={styles.barcodeDetails}>
              <Text style={styles.barcodeLabel}>Barcode</Text>
              <Text style={styles.barcodeValue}>{barcode}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Product Information</Text>

          {/* Product Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Organic Almond Milk"
              placeholderTextColor="#999999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Brand */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Brand (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Silk, Kroger"
              placeholderTextColor="#999999"
              value={brand}
              onChangeText={setBrand}
              autoCapitalize="words"
            />
          </View>

          {/* Category */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setCategory(cat)
                  }}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive
                  ]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.sectionTitle}>Nutrition Facts</Text>

          {/* Serving Size */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Serving Size</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 100g, 1 cup, 240ml"
              placeholderTextColor="#999999"
              value={servingSize}
              onChangeText={setServingSize}
            />
          </View>

          {/* Nutrition Grid */}
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.inputLabel}>Calories *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#999999"
                value={calories}
                onChangeText={setCalories}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.nutritionItem}>
              <Text style={styles.inputLabel}>Protein (g) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#999999"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.inputLabel}>Carbs (g) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#999999"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.nutritionItem}>
              <Text style={styles.inputLabel}>Fat (g) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#999999"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Helper Text */}
          <View style={styles.helperContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#6A9571" />
            <Text style={styles.helperText}>
              This product will be saved to help other SAVR users find it in the future!
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#6A9571',
  },
  saveButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#999999',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  barcodeDetails: {
    marginLeft: 16,
    flex: 1,
  },
  barcodeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  barcodeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A9571',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 8,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  categoriesContainer: {
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  categoryButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  nutritionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  nutritionItem: {
    flex: 1,
  },
  helperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#6A9571',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
})

