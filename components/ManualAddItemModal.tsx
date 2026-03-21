// SAVR Manual Add Item Modal - Add items to pantry manually
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import * as Haptics from 'expo-haptics'
import { formatPantryItem } from '../lib/PantryItemFormatter'
import { expiryPredictionService } from '../lib/ExpiryPredictionService'
import { usePantry } from '../lib/PantryContext'

interface ManualAddItemModalProps {
  visible: boolean
  onClose: () => void
}

const UNITS = [
  { id: 'lb', label: 'lb' },
  { id: 'oz', label: 'oz' },
  { id: 'kg', label: 'kg' },
  { id: 'g', label: 'g' },
  { id: 'pieces', label: 'pieces' },
  { id: 'bag', label: 'bag' },
  { id: 'box', label: 'box' },
  { id: 'bottle', label: 'bottle' },
  { id: 'can', label: 'can' },
  { id: 'jar', label: 'jar' },
  { id: 'carton', label: 'carton' },
]

const CATEGORIES = [
  { id: 'Produce', label: 'Produce', emoji: '🥦' },
  { id: 'Meat, Poultry & Seafood', label: 'Meat, Poultry & Seafood', emoji: '🍗' },
  { id: 'Dairy & Eggs', label: 'Dairy & Eggs', emoji: '🥛' },
  { id: 'Grains, Bread & Pasta', label: 'Grains, Bread & Pasta', emoji: '🌾' },
  { id: 'Condiments, Sauces & Spreads', label: 'Condiments and Sauces', emoji: '🥫' },
  { id: 'Pantry Staples & Essentials', label: 'Pantry Staples & Essentials', emoji: '🧂' },
  { id: 'Plant-Based Proteins & Legumes', label: 'Proteins and Legumes', emoji: '🍱' },
  { id: 'Snacks, Sweets & Desserts', label: 'Snacks, Sweets & Desserts', emoji: '🍫' },
  { id: 'Beverages', label: 'Beverages', emoji: '🥤' },
  { id: 'Frozen', label: 'Frozen', emoji: '❄️' },
  { id: 'Household & Cleaning', label: 'Household & Cleaning', emoji: '🧹' },
  { id: 'Non-Food / Misc', label: 'Non-Food / Misc', emoji: '📦' },
]

const LOCATIONS = [
  { id: 'fridge', label: 'Fridge', emoji: '🧊' },
  { id: 'freezer', label: 'Freezer', emoji: '❄️' },
  { id: 'pantry', label: 'Pantry', emoji: '🏠' },
]


export default function ManualAddItemModal({ visible, onClose }: ManualAddItemModalProps) {
  const { addItem, refreshItems, findItemByName } = usePantry()
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedUnit, setSelectedUnit] = useState('pieces')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  
  // Auto-detected fields (now user-selectable)
  const [autoCategory, setAutoCategory] = useState('Pantry Staples & Essentials')
  const [autoLocation, setAutoLocation] = useState<'fridge' | 'freezer' | 'pantry'>('pantry')
  const [autoEmoji, setAutoEmoji] = useState('📦')
  const [expiryDate, setExpiryDate] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [predictedDays, setPredictedDays] = useState<number | null>(null)
  
  // Manual editing states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showExpiryModal, setShowExpiryModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)

  // Auto-detect category, location, and emoji when item name changes
  const handleItemNameChange = (text: string) => {
    setItemName(text)
    
    if (text.trim()) {
      // Use formatter to auto-detect category, location, and emoji
      const tempFormatted = formatPantryItem({
        name: text.trim(),
        quantity: 1,
        unit: 'unit',
      })
      
      setAutoCategory(tempFormatted.category)
      setAutoLocation(tempFormatted.location)
      setAutoEmoji(tempFormatted.icon)
      if (!selectedDate) {
        try {
          const purchaseDate = new Date().toISOString().split('T')[0]
          const prediction = expiryPredictionService.predictExpiry(
            text.trim(),
            tempFormatted.category,
            tempFormatted.location,
            purchaseDate
          )
          setExpiryDate(prediction.expiryDate)
          setPredictedDays(prediction.days)
        } catch {}
      }
    } else {
      setAutoCategory('Pantry Staples & Essentials')
      setAutoLocation('pantry')
      setAutoEmoji('📦')
      setExpiryDate('')
      setSelectedDate('')
      setPredictedDays(null)
    }
  }

  const handleReset = () => {
    setItemName('')
    setQuantity('1')
    setSelectedUnit('pieces')
    setNotes('')
    setAutoCategory('Pantry Staples & Essentials')
    setAutoLocation('pantry')
    setAutoEmoji('📦')
    setExpiryDate('')
    setSelectedDate('')
    setShowCategoryModal(false)
    setShowLocationModal(false)
    setShowExpiryModal(false)
    setShowUnitModal(false)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  // Recalculate prediction when autoCategory/autoLocation change (unless user picked a custom date)
  useEffect(() => {
    if (itemName.trim() && !selectedDate) {
      try {
        const purchaseDate = new Date().toISOString().split('T')[0]
        const prediction = expiryPredictionService.predictExpiry(
          itemName.trim(),
          autoCategory,
          autoLocation,
          purchaseDate
        )
        setExpiryDate(prediction.expiryDate)
        setPredictedDays(prediction.days)
      } catch {}
    }
  }, [autoCategory, autoLocation])

  const handleAddItem = async () => {
    if (!itemName.trim()) {
      Alert.alert('Missing Information', 'Please enter an item name')
      return
    }

    const quantityNum = parseFloat(quantity) || 1
    if (quantityNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity')
      return
    }

    setAdding(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Check for duplicate in pantry before adding
      const existingItem = findItemByName(itemName.trim())
      
      if (existingItem) {
        // Show warning about duplicate
        Alert.alert(
          'Item Already in Pantry',
          `You already have "${existingItem.name}" in your ${existingItem.location}.\n\nWould you like to add more anyway?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setAdding(false)
              }
            },
            {
              text: 'Add More',
              onPress: async () => {
                // Use unified formatter with auto-detected values
                const formattedItem = formatPantryItem({
                  name: itemName.trim(),
                  quantity: quantityNum,
                  unit: selectedUnit,
                  notes: notes.trim() || undefined,
                  expiry_date: expiryDate || undefined,
                })

                await addItem(formattedItem)
                // No need to refresh - real-time subscription handles updates
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('Success', `${itemName} added to pantry!`)
                handleReset()
                setTimeout(() => {
                  onClose()
                }, 500)
                setAdding(false)
              }
            }
          ]
        )
        return
      }

      // Use unified formatter with auto-detected values
      const formattedItem = formatPantryItem({
        name: itemName.trim(),
        quantity: quantityNum,
        unit: selectedUnit,
        notes: notes.trim() || undefined,
        expiry_date: expiryDate || undefined,
        // Auto-detected values are used by the formatter automatically
      })

      await addItem(formattedItem)
      
      // No need to refresh - real-time subscription will update UI instantly
      // refreshItems() is redundant and causes unnecessary network requests
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', `${itemName} added to pantry!`)
      
      handleReset()
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error('Error adding item:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to add item to pantry')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
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
              handleClose()
            }}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </Pressable>
          <Text style={styles.headerTitle}>Add Item</Text>
          <Pressable
            style={styles.saveButton}
            onPress={handleAddItem}
            disabled={adding || !itemName.trim()}
          >
            <Ionicons 
              name="checkmark" 
              size={24} 
              color={adding || !itemName.trim() ? "#C7C7CC" : "#6A9571"} 
            />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          {/* Item Name Section - Only show when user has typed */}
          {itemName.trim() && (
            <View style={styles.itemNameSection}>
              <Text style={styles.itemNameTitle}>{itemName.trim()}</Text>
              <Text style={styles.itemUnitText}>{UNITS.find(u => u.id === selectedUnit)?.label}</Text>
            </View>
          )}

          {/* Quantity Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>QUANTITY & UNIT</Text>
            <View style={styles.quantityUnitContainer}>
              <View style={styles.quantityWrapper}>
                <TextInput
                  style={styles.quantityInput}
                  placeholder="1"
                  placeholderTextColor="#8E8E93"
                  value={quantity}
                  onChangeText={(text) => {
                    // Only allow numbers and decimal point, but allow empty while typing
                    const numbersOnly = text.replace(/[^0-9.]/g, '')
                    // Prevent multiple decimal points
                    const parts = numbersOnly.split('.')
                    const cleaned = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : numbersOnly
                    // Allow empty string while typing
                    setQuantity(cleaned)
                  }}
                  onBlur={() => {
                    // Validate on blur - ensure minimum of 1
                    if (quantity === '' || quantity === '0' || parseFloat(quantity) < 1) {
                      setQuantity('1')
                    } else {
                      // Ensure it's a valid number
                      const parsed = parseFloat(quantity)
                      if (!isNaN(parsed)) {
                        setQuantity(parsed.toString())
                      }
                    }
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  textAlign="center"
                  editable={true}
                  selectTextOnFocus={true}
                  blurOnSubmit={true}
                />
              </View>
              <View style={styles.unitDivider} />
              <Pressable
                style={styles.unitSelector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowUnitModal(true)
                }}
              >
                <Text style={styles.unitSelectorText}>
                  {UNITS.find(u => u.id === selectedUnit)?.label || 'pieces'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6A9571" />
              </Pressable>
            </View>
          </View>

          {/* Item Name Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ITEM NAME</Text>
            <TextInput
              style={styles.textInput}
              value={itemName}
              onChangeText={handleItemNameChange}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <Pressable 
              style={styles.categoryInput}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={styles.categoryText}>{autoCategory}</Text>
              <Text style={styles.categoryEmoji}>{autoEmoji}</Text>
            </Pressable>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOCATION</Text>
            <Pressable 
              style={styles.locationInput}
              onPress={() => setShowLocationModal(true)}
            >
              <Text style={styles.locationText}>
                {autoLocation === 'fridge' ? 'Fridge' : autoLocation === 'freezer' ? 'Freezer' : 'Pantry'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>
          </View>

          {/* Expiry Date Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXPIRY DATE</Text>
            <Pressable 
              style={styles.expiryInput}
              onPress={() => setShowExpiryModal(true)}
            >
              <Ionicons name="sparkles" size={20} color="#6A9571" />
              <View style={styles.expiryText}>
                <Text style={styles.expiryTitle}>
                  {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'AI Suggestion: Tap to set'}
                </Text>
                <Text style={styles.expirySubtitle}>
                  {selectedDate
                    ? 'Custom date'
                    : expiryDate
                      ? `~${predictedDays ?? Math.max(1, Math.round((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days`
                      : 'Tap to select'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </Pressable>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Add notes (optional)"
              placeholderTextColor="#C7C7CC"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Category Selection Modal */}
        <Modal
          visible={showCategoryModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.selectionModal}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>Select Category</Text>
                <Pressable onPress={() => setShowCategoryModal(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </Pressable>
              </View>
              <ScrollView style={styles.selectionContent}>
                {CATEGORIES.map((category) => (
                  <Pressable
                    key={category.id}
                    style={styles.selectionItem}
                    onPress={() => {
                      setAutoCategory(category.label)
                      setAutoEmoji(category.emoji)
                      setShowCategoryModal(false)
                    }}
                  >
                    <Text style={styles.selectionEmoji}>{category.emoji}</Text>
                    <Text style={styles.selectionLabel}>{category.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Location Selection Modal */}
        <Modal
          visible={showLocationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLocationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.selectionModal}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>Select Location</Text>
                <Pressable onPress={() => setShowLocationModal(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </Pressable>
              </View>
              <ScrollView style={styles.selectionContent}>
                {LOCATIONS.map((location) => (
                  <Pressable
                    key={location.id}
                    style={styles.selectionItem}
                    onPress={() => {
                      setAutoLocation(location.id as 'fridge' | 'freezer' | 'pantry')
                      setShowLocationModal(false)
                    }}
                  >
                    <Text style={styles.selectionEmoji}>{location.emoji}</Text>
                    <Text style={styles.selectionLabel}>{location.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Unit Selection Modal */}
        <Modal
          visible={showUnitModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowUnitModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.selectionModal}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>Select Unit</Text>
                <Pressable onPress={() => setShowUnitModal(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </Pressable>
              </View>
              <ScrollView style={styles.selectionContent}>
                {UNITS.map((unit) => (
                  <Pressable
                    key={unit.id}
                    style={[
                      styles.selectionItem,
                      selectedUnit === unit.id && styles.selectionItemActive
                    ]}
                    onPress={() => {
                      setSelectedUnit(unit.id)
                      setShowUnitModal(false)
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }}
                  >
                    <Text style={[
                      styles.selectionLabel,
                      selectedUnit === unit.id && styles.selectionLabelActive
                    ]}>
                      {unit.label}
                    </Text>
                    {selectedUnit === unit.id && (
                      <Ionicons name="checkmark" size={20} color="#6A9571" />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Expiry Date Calendar Modal */}
        <Modal
          visible={showExpiryModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowExpiryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.calendarModal}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Expiry Date</Text>
                <Pressable onPress={() => setShowExpiryModal(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </Pressable>
              </View>
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={(day) => {
                    setSelectedDate(day.dateString)
                    setExpiryDate(day.dateString)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  markedDates={{
                    [selectedDate]: {
                      selected: true,
                      selectedColor: '#6A9571',
                      selectedTextColor: '#FFFFFF'
                    }
                  }}
                  theme={{
                    backgroundColor: '#FFFFFF',
                    calendarBackground: '#FFFFFF',
                    textSectionTitleColor: '#1C1C1E',
                    selectedDayBackgroundColor: '#6A9571',
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: '#6A9571',
                    dayTextColor: '#1C1C1E',
                    textDisabledColor: '#C7C7CC',
                    dotColor: '#6A9571',
                    selectedDotColor: '#FFFFFF',
                    arrowColor: '#6A9571',
                    monthTextColor: '#1C1C1E',
                    indicatorColor: '#6A9571',
                    textDayFontWeight: '500',
                    textMonthFontWeight: '600',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 16,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 14
                  }}
                  minDate={new Date().toISOString().split('T')[0]}
                  enableSwipeMonths={true}
                />
              </View>
              <View style={styles.calendarFooter}>
                <Pressable
                  style={styles.calendarConfirmButton}
                  onPress={() => {
                    if (selectedDate) {
                      setExpiryDate(selectedDate)
                    }
                    setShowExpiryModal(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  }}
                >
                  <Text style={styles.calendarConfirmText}>
                    {selectedDate ? 'Confirm Date' : 'Cancel'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  itemNameSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  itemNameTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  itemUnitText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  notesInput: {
    minHeight: 60,
    paddingTop: 14,
  },
  
  // Quantity & Unit - Clean Unified Design
  quantityUnitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quantityWrapper: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  quantityInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  unitDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 100,
    gap: 6,
  },
  unitSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  
  // Category Display
  categoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  categoryText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  
  // Location Display
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  locationText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  
  // AI Suggestion Box
  aiSuggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    gap: 12,
  },
  aiSuggestionText: {
    flex: 1,
  },
  aiSuggestionTitle: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '600',
  },
  aiSuggestionSubtitle: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Expiry Input
  expiryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    gap: 12,
  },
  expiryText: {
    flex: 1,
  },
  expiryTitle: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '600',
  },
  expirySubtitle: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Selection Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  selectionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  selectionContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  selectionItemActive: {
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
  },
  selectionEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
  },
  selectionLabelActive: {
    color: '#6A9571',
    fontWeight: '600',
  },
  
  // Calendar Modal
  calendarModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  calendarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  calendarFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  calendarConfirmButton: {
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
})

