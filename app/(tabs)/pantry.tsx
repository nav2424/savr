// SAVR Pantry - Real-time Pantry Management with Supabase
import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native'
import { TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useListsUnified } from '../../lib/useListsUnified'
import { usePantry } from '../../lib/PantryContext'
import { PantryItem as PantryItemType } from '../../lib/supabase'
import { expiryPredictionService } from '../../lib/ExpiryPredictionService'
import { capitalizeCategoryName } from '../../lib/ScanningService'
import { normalizeCategory, detectCategoryFromName } from '../../lib/PantryItemFormatter'
import * as Haptics from 'expo-haptics'
import SageAssistant from '../../components/SageAssistantV2'
import ManualAddItemModal from '../../components/ManualAddItemModal'
import { Ionicons } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Calendar } from 'react-native-calendars'
import { 
  scaleSize, 
  scaleFont, 
  scaleWidth, 
  scaleHeight, 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

// Location and category options for editing
const LOCATIONS = [
  { id: 'fridge', label: 'Fridge', emoji: '🧊' },
  { id: 'freezer', label: 'Freezer', emoji: '❄️' },
  { id: 'pantry', label: 'Pantry', emoji: '🏠' },
]

type CategoryMeta = {
  key: string
  label: string
  emoji: string
  colors: { background: string; border: string }
}

type AggregatedPantryItem = PantryItemType & {
  aggregatedQuantity: number
  aggregatedItems: PantryItemType[]
  isAggregated: boolean
}

const CATEGORY_METADATA: CategoryMeta[] = [
  {
    key: 'produce',
    label: 'Produce',
    emoji: '🥦',
    colors: { background: 'rgba(52, 199, 89, 0.08)', border: 'rgba(52, 199, 89, 0.2)' }
  },
  {
    key: 'meat, poultry & seafood',
    label: 'Meat, Poultry & Seafood',
    emoji: '🍗',
    colors: { background: 'rgba(255, 99, 71, 0.08)', border: 'rgba(255, 99, 71, 0.2)' }
  },
  {
    key: 'dairy & eggs',
    label: 'Dairy & Eggs',
    emoji: '🥛',
    colors: { background: 'rgba(90, 200, 250, 0.08)', border: 'rgba(90, 200, 250, 0.2)' }
  },
  {
    key: 'grains, bread & pasta',
    label: 'Grains, Bread & Pasta',
    emoji: '🌾',
    colors: { background: 'rgba(255, 204, 0, 0.08)', border: 'rgba(255, 204, 0, 0.2)' }
  },
  {
    key: 'condiments, sauces & spreads',
    label: 'Condiments, Sauces & Spreads',
    emoji: '🥫',
    colors: { background: 'rgba(255, 118, 117, 0.08)', border: 'rgba(255, 118, 117, 0.2)' }
  },
  {
    key: 'pantry staples & essentials',
    label: 'Pantry Staples & Essentials',
    emoji: '🧂',
    colors: { background: 'rgba(142, 142, 147, 0.08)', border: 'rgba(142, 142, 147, 0.2)' }
  },
  {
    key: 'plant-based proteins & legumes',
    label: 'Plant-Based Proteins & Legumes',
    emoji: '🍱',
    colors: { background: 'rgba(64, 221, 170, 0.08)', border: 'rgba(64, 221, 170, 0.2)' }
  },
  {
    key: 'snacks, sweets & desserts',
    label: 'Snacks, Sweets & Desserts',
    emoji: '🍫',
    colors: { background: 'rgba(255, 149, 0, 0.08)', border: 'rgba(255, 149, 0, 0.2)' }
  },
  {
    key: 'beverages',
    label: 'Beverages',
    emoji: '🥤',
    colors: { background: 'rgba(175, 82, 222, 0.08)', border: 'rgba(175, 82, 222, 0.2)' }
  },
  {
    key: 'non-food / misc',
    label: 'Non-Food / Misc',
    emoji: '📦',
    colors: { background: 'rgba(120, 120, 128, 0.08)', border: 'rgba(120, 120, 128, 0.2)' }
  }
]

const CATEGORY_CONFIG = CATEGORY_METADATA.reduce<Record<string, CategoryMeta>>((acc, meta) => {
  acc[meta.key] = meta
  return acc
}, {})

const CATEGORY_ORDER = CATEGORY_METADATA.map(meta => meta.key)

const DEFAULT_CATEGORY_META =
  CATEGORY_CONFIG['pantry staples & essentials'] || {
    key: 'pantry staples & essentials',
    label: 'Pantry Staples & Essentials',
    emoji: '🧂',
    colors: { background: 'rgba(142, 142, 147, 0.08)', border: 'rgba(142, 142, 147, 0.2)' }
  }

const CATEGORIES = CATEGORY_METADATA.map(meta => ({
  id: meta.label,
  label: meta.label,
  emoji: meta.emoji,
}))

// Filter options
const FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'expiring', name: 'Expiring Soon' },
  { id: 'fridge', name: 'Fridge' },
  { id: 'freezer', name: 'Freezer' },
  { id: 'pantry', name: 'Pantry' }
]

export default function PantryScreen() {
  const { progressiveTheme } = useSimpleTheme()
  const router = useRouter()
  const params = useLocalSearchParams()
  const { lists, addItemToList } = useListsUnified()
  const { 
    items, 
    loading, 
    error,
    updateQuantity,
    updateItem,
    removeItem,
    addItem,
    consumeItem,
    refreshItems,
    getExpiringItems
  } = usePantry()

  const [selectedItem, setSelectedItem] = useState<PantryItemType | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [showListSelector, setShowListSelector] = useState(false)
  const [itemToAddToList, setItemToAddToList] = useState<AggregatedPantryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // Initialize filter from URL params on mount
  const initialFilter = params.filter && typeof params.filter === 'string' ? params.filter : 'all'
  const [selectedFilter, setSelectedFilter] = useState(initialFilter)
  const lastProcessedFilter = useRef<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showManualAddModal, setShowManualAddModal] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [aggregatedSelection, setAggregatedSelection] = useState<AggregatedPantryItem | null>(null)
  const [showAggregatedItemsModal, setShowAggregatedItemsModal] = useState(false)
  
  // Edit mode states for item details modal
  const [editedQuantity, setEditedQuantity] = useState<string>('')
  const [editedCategory, setEditedCategory] = useState<string>('')
  const [editedLocation, setEditedLocation] = useState<'fridge' | 'freezer' | 'pantry'>('pantry')
  const [editedExpiryDate, setEditedExpiryDate] = useState<string>('')
  const [editedNotes, setEditedNotes] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempDateValue, setTempDateValue] = useState<Date>(new Date())
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // New modal states for ManualAddItemModal-style interface
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showExpiryModal, setShowExpiryModal] = useState(false)
  
  // Debug modal state changes
  useEffect(() => {
    console.log('🔍 Modal states:', { 
      modalVisible, 
      showCategoryModal, 
      showLocationModal, 
      showExpiryModal,
      selectedItem: selectedItem?.name 
    })
  }, [modalVisible, showCategoryModal, showLocationModal, showExpiryModal, selectedItem])
  const [selectedDate, setSelectedDate] = useState('')
  const [predictedExpiry, setPredictedExpiry] = useState<{
    date: string
    days: number
    confidence: string
    notes?: string
  } | null>(null)

  // Filter and search items
  const filteredItems = useMemo(() => {
    let filtered = items

    // Apply filter
    if (selectedFilter === 'expiring') {
      // Use 7 days threshold to match dashboard calculation
      const expiringItems = getExpiringItems(7)
      console.log('🔍 Filtering by expiring - found', expiringItems.length, 'expiring items')
      console.log('🔍 Expiring items:', expiringItems.map(item => `${item.name} (${item.expiry_date})`))
      const expiringIds = new Set(expiringItems.map(item => item.id))
      filtered = items.filter(item => expiringIds.has(item.id))
      console.log('✅ Filtered items count:', filtered.length)
    } else if (selectedFilter !== 'all') {
      filtered = items.filter(item => item.location === selectedFilter)
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [items, selectedFilter, searchQuery, getExpiringItems])

  // Organize items by category with aggregation
  const itemsByCategory = useMemo<Record<string, AggregatedPantryItem[]>>(() => {
    const grouped: Record<string, AggregatedPantryItem[]> = {}
    const groupedMaps: Record<string, Record<string, AggregatedPantryItem>> = {}
    
    filteredItems.forEach(item => {
      const detectedCategory = detectCategoryFromName(item.name)
      let normalizedCategory = normalizeCategory(item.category || detectedCategory || 'Non-Food / Misc')

      if (
        detectedCategory &&
        detectedCategory !== 'Pantry Staples & Essentials' &&
        detectedCategory !== 'Non-Food / Misc' &&
        detectedCategory !== normalizedCategory
      ) {
        normalizedCategory = detectedCategory
      } else if (
        normalizedCategory === 'Pantry Staples & Essentials' ||
        normalizedCategory === 'Non-Food / Misc'
      ) {
        normalizedCategory = detectedCategory || normalizedCategory
      }

      const categoryKey = normalizedCategory.toLowerCase()
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = []
        groupedMaps[categoryKey] = {}
      }

      const nameKey = item.name.trim().toLowerCase()
      const existing = groupedMaps[categoryKey][nameKey]

      if (existing) {
        const updatedQuantity = existing.aggregatedQuantity + item.quantity
        existing.aggregatedQuantity = updatedQuantity
        existing.quantity = updatedQuantity
        existing.aggregatedItems = [...existing.aggregatedItems, item]
        existing.isAggregated = existing.aggregatedItems.length > 1

        const existingExpiry = existing.expiry_date
        if (item.expiry_date) {
          if (!existingExpiry) {
            existing.expiry_date = item.expiry_date
          } else {
            const existingDate = new Date(existingExpiry).getTime()
            const newDate = new Date(item.expiry_date).getTime()
            if (!Number.isNaN(existingDate) && !Number.isNaN(newDate) && newDate < existingDate) {
              existing.expiry_date = item.expiry_date
            }
          }
        }
      } else {
        const aggregatedItem: AggregatedPantryItem = {
          ...item,
          aggregatedQuantity: item.quantity,
          aggregatedItems: [item],
          isAggregated: false,
        }
        grouped[categoryKey].push(aggregatedItem)
        groupedMaps[categoryKey][nameKey] = aggregatedItem
      }
    })

    return grouped
  }, [filteredItems])

  const getPrimaryItem = (item: AggregatedPantryItem): PantryItemType => {
    if (item.aggregatedItems && item.aggregatedItems.length > 0) {
      return item.aggregatedItems[0]
    }
    return item
  }

  const getDisplayQuantity = (item: AggregatedPantryItem): number => {
    return item.aggregatedQuantity ?? item.quantity
  }

  const getDisplayUnit = (item: AggregatedPantryItem): string => {
    if (item.aggregatedItems && item.aggregatedItems.length > 1) {
      const uniqueUnits = Array.from(new Set(item.aggregatedItems.map(child => (child.unit || '').trim()))).filter(Boolean)
      if (uniqueUnits.length === 1) {
        return uniqueUnits[0]
      }
      return 'units'
    }
    return item.unit || 'units'
  }

  // Update filter when screen is focused or URL params change
  useEffect(() => {
    // Handle both string and array formats (expo-router can return arrays)
    const filterValue = Array.isArray(params.filter) ? params.filter[0] : params.filter
    
    if (filterValue && typeof filterValue === 'string') {
      // Only update if this is a new filter value we haven't processed
      if (filterValue !== lastProcessedFilter.current) {
        console.log('✅ Setting filter to:', filterValue)
        lastProcessedFilter.current = filterValue
        setSelectedFilter(filterValue)
        
        // If filtering by expiring, expand all categories to show all items
        if (filterValue === 'expiring') {
          console.log('📅 Expiring filter active - expanding all categories')
          setCollapsedCategories(new Set())
        }
      }
    } else if (!filterValue && lastProcessedFilter.current !== null) {
      // Reset if filter param is removed
      lastProcessedFilter.current = null
      setSelectedFilter('all')
    }
  }, [params.filter])
  
  // Expand categories when expiring filter is active and items are loaded
  useEffect(() => {
    if (selectedFilter === 'expiring' && items.length > 0) {
      console.log('📅 Expiring filter active with items - ensuring categories are expanded')
      setCollapsedCategories(new Set())
    }
  }, [selectedFilter, items.length])

  // Initialize all categories as collapsed on mount only (not when items change)
  const hasInitializedCategories = useRef(false)
  const hasLoadedItemsOnce = useRef(false)
  
  // Track when items first load (separate effect that only runs once)
  useEffect(() => {
    if (items.length > 0 && !hasLoadedItemsOnce.current) {
      hasLoadedItemsOnce.current = true
    }
  }, [items.length])
  
  // Initialize categories as collapsed (only once, never again)
  useEffect(() => {
    // Early return if already initialized - never run again
    if (hasInitializedCategories.current) {
      return
    }
    
    // Only initialize on first load, when we have items, and not filtering by expiring
    if (hasLoadedItemsOnce.current && 
        items.length > 0 && 
        collapsedCategories.size === 0 && 
        selectedFilter !== 'expiring') {
      const allCategories = new Set(Object.keys(itemsByCategory))
      if (allCategories.size > 0) {
        setCollapsedCategories(allCategories)
        hasInitializedCategories.current = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter]) // Only depend on selectedFilter - items checked via refs

  // Auto-uncollapse categories when searching
  const hasSearchedBefore = useRef(false)
  useEffect(() => {
    if (searchQuery.trim()) {
      hasSearchedBefore.current = true
      // Find categories that have matching items
      const categoriesWithResults = new Set(Object.keys(itemsByCategory))
      
      // Uncollapse categories that have search results
      setCollapsedCategories(prev => {
        const newCollapsed = new Set(prev)
        categoriesWithResults.forEach(category => {
          newCollapsed.delete(category)
        })
        return newCollapsed
      })
    } else if (hasSearchedBefore.current) {
      // Only collapse all categories when search is cleared IF user had searched before
      // This prevents collapsing on initial load or when items change
      const allCategories = new Set(Object.keys(itemsByCategory))
      setCollapsedCategories(allCategories)
      hasSearchedBefore.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]) // Only depend on searchQuery, not itemsByCategory

  // Handle category parameter from URL (from dashboard cards)
  useEffect(() => {
    if (params.category && items.length > 0) {
      const targetCategory = params.category as string
      console.log('🎯 Opening category from dashboard:', targetCategory)
      
      // Find the matching category (case-insensitive)
      const matchingCategory = Object.keys(itemsByCategory).find(category => 
        category.toLowerCase() === targetCategory.toLowerCase()
      )
      
      if (matchingCategory) {
        // Uncollapse the specific category
        setCollapsedCategories(prev => {
          const newCollapsed = new Set(prev)
          newCollapsed.delete(matchingCategory)
          return newCollapsed
        })
        
        // Clear any existing search to show the category clearly
        setSearchQuery('')
      }
    }
  }, [params.category, itemsByCategory])

  // Handle manual add parameter from URL (from dashboard quick action)
  useEffect(() => {
    if (params.openManualAdd === 'true') {
      console.log('🎯 Opening manual add modal from dashboard')
      setShowManualAddModal(true)
    }
  }, [params.openManualAdd])

  // Initialize edit state when item is selected
  useEffect(() => {
    if (selectedItem) {
      setEditedQuantity(selectedItem.quantity.toString())
      setEditedCategory(selectedItem.category)
      setEditedLocation(selectedItem.location)
      setEditedExpiryDate(selectedItem.expiry_date || '')
      setSelectedDate(selectedItem.expiry_date || '')
      setEditedNotes(selectedItem.notes || '')
      
      // Don't show AI suggestion when editing existing items
      // Only show AI suggestions when adding new items
      setPredictedExpiry(null)
    }
  }, [selectedItem])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshItems()
    setRefreshing(false)
  }

  const openItemDetail = (item: PantryItemType) => {
    console.log('🔍 Opening edit modal for item:', item.name)
    setSelectedItem(item)
    setModalVisible(true)
  }

  const handleItemPress = (item: AggregatedPantryItem) => {
    if (item.aggregatedItems && item.aggregatedItems.length > 1) {
      setAggregatedSelection(item)
      setShowAggregatedItemsModal(true)
      return
    }

    openItemDetail(getPrimaryItem(item))
  }

  const closeModal = () => {
    setModalVisible(false)
    setSelectedItem(null)
    setPredictedExpiry(null)
  }

  const handleSaveChanges = async () => {
    if (!selectedItem) {
      Alert.alert('Error', 'No item selected')
      return
    }

    const quantity = parseInt(editedQuantity, 10)
    if (isNaN(quantity) || quantity < 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity')
      return
    }

    setIsSaving(true)
    
    try {
      const updates: Partial<PantryItemType> = {
        quantity,
        category: editedCategory,
        location: editedLocation,
        expiry_date: editedExpiryDate || undefined,
        notes: editedNotes?.trim() || undefined
      }

      console.log('Saving pantry item updates:', { id: selectedItem.id, updates })
      const success = await updateItem(selectedItem.id, updates)
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        await refreshItems()
        closeModal()
      } else {
        Alert.alert('Error', 'Failed to update item. Please try again.')
      }
    } catch (error) {
      console.error('Error saving changes:', error)
      Alert.alert('Error', 'An error occurred while saving. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyPredictedExpiry = () => {
    if (predictedExpiry) {
      setEditedExpiryDate(predictedExpiry.date)
      setPredictedExpiry(null)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  const handleQuantityChange = (delta: number) => {
    const current = parseInt(editedQuantity, 10) || 0
    const newQuantity = Math.max(0, current + delta)
    setEditedQuantity(newQuantity.toString())
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const handleQuantityIncrease = async (item: AggregatedPantryItem, event: any) => {
    event.stopPropagation()
    if (item.aggregatedItems && item.aggregatedItems.length > 1) {
      setAggregatedSelection(item)
      setShowAggregatedItemsModal(true)
      return
    }
    const targetItem = getPrimaryItem(item)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await updateQuantity(targetItem.id, targetItem.quantity + 1)
  }

  const handleQuantityDecrease = async (item: AggregatedPantryItem, event: any) => {
    event.stopPropagation()
    if (item.aggregatedItems && item.aggregatedItems.length > 1) {
      setAggregatedSelection(item)
      setShowAggregatedItemsModal(true)
      return
    }
    const targetItem = getPrimaryItem(item)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    if (targetItem.quantity <= 1) {
      Alert.alert(
        'Remove Item?',
        `Do you want to remove "${targetItem.name}" from your pantry?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove', 
            style: 'destructive',
            onPress: async () => {
              await removeItem(targetItem.id)
            }
          }
        ]
      )
    } else {
      await updateQuantity(targetItem.id, targetItem.quantity - 1)
    }
  }

  const handleAddToListPress = (item: AggregatedPantryItem, event: any) => {
    event.stopPropagation()
    setItemToAddToList(item)
    setShowListSelector(true)
  }

  const handleSelectList = (listId: string, listName: string) => {
    if (itemToAddToList) {
      const quantityValue = getDisplayQuantity(itemToAddToList)
      const unitValue = getDisplayUnit(itemToAddToList)
      const categoryValue = normalizeCategory(itemToAddToList.category)
      addItemToList(listId, {
        name: itemToAddToList.name,
        category: categoryValue,
        quantity: `${quantityValue} ${unitValue}`,
        notes: `Added from pantry`
      })
      
      Alert.alert(
        'Added!',
        `"${itemToAddToList.name}" has been added to "${listName}"`,
        [{ text: 'OK' }]
      )
      setShowListSelector(false)
      setItemToAddToList(null)
    }
  }

  const handleVoicePantryCommand = async (
    action: 'remove' | 'add',
    itemName: string,
    quantity: number,
    unit?: string,
    category?: string,
    location?: string
  ) => {
    if (action === 'add') {
      // Determine icon based on item name
      let icon = '🥬' // default
      const lowerName = itemName.toLowerCase()
      if (lowerName.includes('banana')) icon = '🍌'
      else if (lowerName.includes('apple')) icon = '🍎'
      else if (lowerName.includes('chicken')) icon = '🍗'
      else if (lowerName.includes('milk')) icon = '🥛'
      else if (lowerName.includes('cheese')) icon = '🧀'
      else if (lowerName.includes('tomato')) icon = '🍅'
      else if (lowerName.includes('bread')) icon = '🍞'
      else if (lowerName.includes('rice')) icon = '🍚'
      else if (lowerName.includes('egg')) icon = '🥚'
      else if (lowerName.includes('carrot')) icon = '🥕'
      else if (lowerName.includes('potato')) icon = '🥔'
      
      const result = await addItem({
        name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
        icon,
        category: category || 'other',
        quantity,
        unit: unit || 'pieces',
        location: (location as 'fridge' | 'freezer' | 'pantry') || 'pantry',
      })
      
      if (result) {
        Alert.alert(
          'Added to Pantry',
          `${quantity} ${unit || 'pieces'} of ${itemName} added to your ${location || 'pantry'}`,
          [{ text: 'OK' }]
        )
      }
    } else if (action === 'remove') {
      const success = await consumeItem(itemName, quantity)
      
      if (success) {
        Alert.alert(
          'Pantry Updated',
          `Removed ${quantity} ${itemName}`,
          [{ text: 'OK' }]
        )
      } else {
        Alert.alert(
          'Item Not Found',
          `Could not find "${itemName}" in your pantry`,
          [{ text: 'OK' }]
        )
      }
    }
  }

  const handleVoiceListCommand = (action: 'add', itemName: string, listName: string, quantity: number) => {
    const foundList = lists.find(list =>
      list.name.toLowerCase().includes(listName.toLowerCase()) ||
      listName.toLowerCase().includes(list.name.toLowerCase())
    )
    
    if (foundList) {
      addItemToList(foundList.id, {
        name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
        category: 'Pantry Item',
        quantity: `${quantity} pieces`,
        notes: 'Added via voice'
      })
      
      Alert.alert(
        'Added to List',
        `"${itemName}" has been added to "${foundList.name}"`,
        [{ text: 'OK' }]
      )
    } else {
      Alert.alert(
        'List Not Found',
        `Could not find a list matching "${listName}"`,
        [{ text: 'OK' }]
      )
    }
  }

  const calculateDaysUntilExpiry = (expiryDate?: string): number | null => {
    if (!expiryDate) return null
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getExpiryText = (expiryDate?: string): string => {
    if (!expiryDate) return 'No expiry date'
    const days = calculateDaysUntilExpiry(expiryDate)
    if (days === null) return 'No expiry date'
    
    // PART 5 — "EXPIRES IN" LABEL RULES
    if (days < 0) return 'Expired'
    if (days === 0) return 'Expires today'
    if (days <= 6) return `Expires in ${days} day${days > 1 ? 's' : ''}`
    if (days <= 13) return `Expires in ${days} days` // Show actual days instead of "Expires soon"
    if (days <= 60) return `Expires in ${days} days`
    
    // > 60 days: Show in months
    const months = Math.floor(days / 30)
    return `Expires in ${months} month${months > 1 ? 's' : ''}`
  }

  const getExpiryColor = (expiryDate?: string): string => {
    if (!expiryDate) return '#8E8E93'
    const days = calculateDaysUntilExpiry(expiryDate)
    if (days === null) return '#8E8E93'
    
    // Red if expiry is within a week (7 days or less), otherwise dark grey
    if (days <= 7) return '#FF3B30' // Red - Within a week
    return '#8E8E93' // Dark grey - More than a week
  }

  const getExpiryBorderColor = (expiryDate?: string): string => {
    if (!expiryDate) return 'transparent'
    const days = calculateDaysUntilExpiry(expiryDate)
    if (days === null) return 'transparent'
    if (days < 0) return '#FF3B30' // Red for expired
    if (days <= 3) return '#FF9500' // Orange for expiring soon
    if (days <= 7) return '#FFCC00' // Yellow for use soon
    return '#34C759' // Green for fresh
  }

const getCategoryMeta = (categoryKey: string): CategoryMeta => {
  const key = categoryKey.toLowerCase()
  return CATEGORY_CONFIG[key] || DEFAULT_CATEGORY_META
}

const getCategoryColor = (category: string): { background: string, border: string } => {
  const meta = getCategoryMeta(category)
  return meta.colors
}

const getCategoryDisplay = (category: string): string => {
  const directMeta = CATEGORY_CONFIG[category.toLowerCase()]
  if (directMeta) {
    return `${directMeta.emoji} ${directMeta.label}`
  }

  const normalized = normalizeCategory(category)
  const normalizedMeta = CATEGORY_CONFIG[normalized.toLowerCase()]
  if (normalizedMeta) {
    return `${normalizedMeta.emoji} ${normalizedMeta.label}`
  }

  const fallbackLabel = capitalizeCategoryName(category)
  return `${DEFAULT_CATEGORY_META.emoji} ${fallbackLabel}`
}

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories)
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category)
    } else {
      newCollapsed.add(category)
    }
    setCollapsedCategories(newCollapsed)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  // Render empty state
  if (!loading && items.length === 0) {
    return (
      <View style={styles.cleanContainer}>
        <ExpoStatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🥗</Text>
          <Text style={styles.emptyTitle}>Your Pantry is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Start adding items to your pantry
          </Text>
          
          <View style={styles.emptyButtonsContainer}>
            {/* Scan Items (Barcode) */}
            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                router.push('/scan')
              }}
            >
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>📸 Scan Items</Text>
              </LinearGradient>
            </Pressable>

            {/* Add Item Manually */}
            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setShowManualAddModal(true)
              }}
            >
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>➕ Add Item Manually</Text>
              </LinearGradient>
            </Pressable>

            {/* Scan Receipt */}
            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                router.push('/scan?mode=receipt')
              }}
            >
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>🧾 Scan Receipt</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
        
        {/* Manual Add Item Modal */}
        <ManualAddItemModal
          visible={showManualAddModal}
          onClose={() => setShowManualAddModal(false)}
        />
        
        <SageAssistant
          onPantryCommand={handleVoicePantryCommand}
          onListCommand={handleVoiceListCommand}
        />
      </View>
    )
  }

  return (
    <View style={styles.cleanContainer}>
      <ExpoStatusBar style="dark" />
      
      {/* Glassmorphic Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />
      
      {/* Header */}
      <View style={styles.cleanHeader}>
        <View>
          <Text style={styles.cleanAppTitle}>SAVR</Text>
          <Text style={styles.headerSubtitle}>
            {items.length} items in your pantry
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.addButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setShowManualAddModal(true)
            }}
          >
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <Pressable
            style={styles.scanButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.push('/scan?mode=receipt')
            }}
          >
            <LinearGradient
              colors={['#5A8461', '#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanIconContainer}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.scanButtonText}>Scan</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
      
      {/* Scrollable Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6A9571"
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search ingredients"
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
        
        {/* Filter Buttons */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <View style={styles.filterContainer}>
              {FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter.id && styles.filterButtonActive
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedFilter(filter.id)
                  }}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter === filter.id && styles.filterButtonTextActive
                    ]}
                  >
                    {filter.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
        
        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A9571" />
            <Text style={styles.loadingText}>Loading pantry...</Text>
          </View>
        )}
        
        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Pressable style={styles.retryButton} onPress={refreshItems}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}
        
        {/* Pantry Categories */}
        {!loading && !error && (
          <View style={styles.categoriesSection}>
            {Object.keys(itemsByCategory).length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsEmoji}>🔍</Text>
                <Text style={styles.noResultsText}>No items found</Text>
                <Text style={styles.noResultsSubtext}>Try adjusting your filters</Text>
              </View>
            ) : (
              Object.entries(itemsByCategory)
                .sort(([categoryA], [categoryB]) => {
                  const indexA = CATEGORY_ORDER.indexOf(categoryA)
                  const indexB = CATEGORY_ORDER.indexOf(categoryB)
                  const safeIndexA = indexA === -1 ? CATEGORY_ORDER.length : indexA
                  const safeIndexB = indexB === -1 ? CATEGORY_ORDER.length : indexB
                  if (safeIndexA === safeIndexB) {
                    return categoryA.localeCompare(categoryB)
                  }
                  return safeIndexA - safeIndexB
                })
                .map(([category, categoryItems]) => {
                const categoryColor = getCategoryColor(category)
                const isCollapsed = collapsedCategories.has(category)
                
                return (
                  <View 
                    key={category} 
                    style={[
                      styles.categoryCard,
                      { 
                        backgroundColor: categoryColor.background,
                        borderColor: categoryColor.border,
                      }
                    ]}
                  >
                    <Pressable 
                      style={styles.categoryHeader}
                      onPress={() => toggleCategory(category)}
                    >
                      <Text style={styles.categoryTitle}>
                        {getCategoryDisplay(category)}
                      </Text>
                      <View style={styles.categoryHeaderRight}>
                        <Text style={styles.categoryCount}>{categoryItems.length}</Text>
                        <Ionicons 
                          name={isCollapsed ? "chevron-down" : "chevron-up"} 
                          size={20} 
                          color="#6A9571" 
                        />
                      </View>
                    </Pressable>
                    
                    {!isCollapsed && categoryItems.map((item) => {
                      const isAggregatedGroup = item.aggregatedItems && item.aggregatedItems.length > 1
                      const displayQuantity = getDisplayQuantity(item)
                      
                      return (
                        <Pressable
                          key={item.id}
                          style={styles.itemRow}
                          onPress={() => handleItemPress(item)}
                        >
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                            <Text style={[styles.itemDetails, { color: getExpiryColor(item.expiry_date) }]}>
                              {getExpiryText(item.expiry_date)}
                            </Text>
                            {isAggregatedGroup && (
                              <Text style={styles.aggregatedHint}>
                                {item.aggregatedItems.length} entries grouped
                              </Text>
                            )}
                          </View>

                          {isAggregatedGroup ? (
                            <View style={styles.aggregatedBadge}>
                              <Ionicons name="layers-outline" size={16} color="#6A9571" />
                              <Text style={styles.aggregatedQuantityText}>{displayQuantity}</Text>
                            </View>
                          ) : (
                            <>
                              <View style={styles.itemQuantityControls}>
                                <Pressable
                                  style={styles.quantityControlButton}
                                  onPress={(e) => handleQuantityDecrease(item, e)}
                                >
                                  <Text style={styles.quantityControlText}>−</Text>
                                </Pressable>
                                
                                <Text style={styles.inventoryText}>
                                  {displayQuantity}
                                </Text>
                                
                                <Pressable
                                  style={styles.quantityControlButton}
                                  onPress={(e) => handleQuantityIncrease(item, e)}
                                >
                                  <Text style={styles.quantityControlText}>+</Text>
                                </Pressable>
                              </View>

                              <View style={styles.controlDivider} />
                            </>
                          )}
                          
                          <Pressable
                            style={styles.addToListButton}
                            onPress={(e) => handleAddToListPress(item, e)}
                          >
                            <Text style={styles.addToListText}>List</Text>
                          </Pressable>
                        </Pressable>
                      )
                    })}
                  </View>
                )
              })
            )}
          </View>
        )}
        
        {/* Bottom Spacing */}
        <View style={styles.cleanBottomSpacing} />
      </ScrollView>
      
      {/* SAGE Assistant */}
      <SageAssistant
        onPantryCommand={handleVoicePantryCommand}
        onListCommand={handleVoiceListCommand}
      />

      {/* Item Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <LinearGradient
          colors={['#F8FAF9', '#FFFFFF']}
          style={styles.editModalContainer}
        >
          {/* Header */}
          <View style={styles.editModalHeader}>
            <Pressable 
              style={styles.editModalCloseButton}
              onPress={closeModal}
              disabled={isSaving}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </Pressable>
            <Text style={styles.editModalHeaderTitle}>Edit Item</Text>
            <Pressable 
              style={styles.editModalSaveButton}
              onPress={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#6A9571" />
              ) : (
                <Ionicons 
                  name="checkmark" 
                  size={24} 
                  color={isSaving ? "#C7C7CC" : "#6A9571"} 
                />
              )}
            </Pressable>
          </View>
          
          {selectedItem && (
            <ScrollView 
              style={styles.editModalContent}
              contentContainerStyle={styles.editModalContentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Item Name Display */}
              <View style={styles.editItemNameSection}>
                <Text style={styles.editItemNameTitle}>{selectedItem.name}</Text>
                <Text style={styles.editItemUnitText}>{selectedItem.unit}</Text>
              </View>

              {/* Quantity & Unit Section */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>QUANTITY & UNIT</Text>
                <View style={styles.editQuantityUnitContainer}>
                  <View style={styles.editQuantityWrapper}>
                    <TextInput
                      style={styles.editQuantityInput}
                      value={editedQuantity}
                      onChangeText={(text) => {
                        // Only allow numbers and decimal point, but allow empty while typing
                        const numbersOnly = text.replace(/[^0-9.]/g, '')
                        const parts = numbersOnly.split('.')
                        const cleaned = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : numbersOnly
                        // Allow empty string while typing
                        setEditedQuantity(cleaned)
                      }}
                      onBlur={() => {
                        // Validate on blur - ensure minimum of 1
                        if (editedQuantity === '' || editedQuantity === '0' || parseFloat(editedQuantity) < 1) {
                          setEditedQuantity('1')
                        } else {
                          // Ensure it's a valid number
                          const parsed = parseFloat(editedQuantity)
                          if (!isNaN(parsed)) {
                            setEditedQuantity(parsed.toString())
                          }
                        }
                      }}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      textAlign="center"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.editUnitDivider} />
                  <View style={styles.editUnitDisplay}>
                    <Text style={styles.editUnitText}>{selectedItem.unit}</Text>
                  </View>
                </View>
                <Text style={styles.editAutoDetectedText}>
                  Auto-detected for {selectedItem.name}
                </Text>
              </View>

              {/* Editable Category */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>CATEGORY</Text>
                <Pressable 
                  style={styles.editCategoryInput}
                  onPress={() => {
                    console.log('🔍 Opening category modal')
                    setShowCategoryModal(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Text style={styles.editCategoryText}>
                    {CATEGORIES.find(cat => cat.id === editedCategory)?.label || 'Select Category'}
                  </Text>
                  <Text style={styles.editCategoryEmoji}>
                    {CATEGORIES.find(cat => cat.id === editedCategory)?.emoji || '📦'}
                  </Text>
                </Pressable>
                
                {/* Category Selection View - inside main modal */}
                {showCategoryModal && (
                  <View style={styles.selectionViewContainer}>
                    <View style={styles.selectionViewHeader}>
                      <Text style={styles.selectionViewTitle}>Select Category</Text>
                      <Pressable onPress={() => setShowCategoryModal(false)}>
                        <Ionicons name="close" size={24} color="#8E8E93" />
                      </Pressable>
                    </View>
                    <ScrollView style={styles.selectionViewContent} nestedScrollEnabled>
                      {CATEGORIES.map((category) => (
                        <Pressable
                          key={category.id}
                          style={styles.selectionItem}
                          onPress={() => {
                            setEditedCategory(category.id)
                            setShowCategoryModal(false)
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          }}
                        >
                          <Text style={styles.selectionEmoji}>{category.emoji}</Text>
                          <Text style={styles.selectionLabel}>{category.label}</Text>
                          {editedCategory === category.id && (
                            <Ionicons name="checkmark" size={20} color="#6A9571" />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Editable Location */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>LOCATION</Text>
                <Pressable 
                  style={styles.editLocationInput}
                  onPress={() => {
                    console.log('🔍 Opening location modal')
                    setShowLocationModal(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Text style={styles.editLocationText}>
                    {LOCATIONS.find(loc => loc.id === editedLocation)?.label || 'Select Location'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </Pressable>
                
                {/* Location Selection View - inside main modal */}
                {showLocationModal && (
                  <View style={styles.selectionViewContainer}>
                    <View style={styles.selectionViewHeader}>
                      <Text style={styles.selectionViewTitle}>Select Location</Text>
                      <Pressable onPress={() => setShowLocationModal(false)}>
                        <Ionicons name="close" size={24} color="#8E8E93" />
                      </Pressable>
                    </View>
                    <ScrollView style={styles.selectionViewContent} nestedScrollEnabled>
                      {LOCATIONS.map((location) => (
                        <Pressable
                          key={location.id}
                          style={styles.selectionItem}
                          onPress={() => {
                            setEditedLocation(location.id as 'fridge' | 'freezer' | 'pantry')
                            setShowLocationModal(false)
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          }}
                        >
                          <Text style={styles.selectionEmoji}>{location.emoji}</Text>
                          <Text style={styles.selectionLabel}>{location.label}</Text>
                          {editedLocation === location.id && (
                            <Ionicons name="checkmark" size={20} color="#6A9571" />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Editable Expiry Date */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>EXPIRY DATE</Text>
                
                {/* AI Predicted Expiry Suggestion */}
                {predictedExpiry && (
                  <Pressable
                    style={styles.editAiPredictionCard}
                    onPress={handleApplyPredictedExpiry}
                  >
                    <Ionicons name="sparkles" size={16} color="#6A9571" />
                    <View style={styles.editAiPredictionText}>
                      <Text style={styles.editAiPredictionTitle}>
                        AI Suggestion: {formatDateForDisplay(predictedExpiry.date)}
                      </Text>
                      <Text style={styles.editAiPredictionSubtitle}>
                        ~{predictedExpiry.days} days
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6A9571" />
                  </Pressable>
                )}

                <Pressable 
                  style={styles.editExpiryInput}
                  onPress={() => {
                    console.log('🔍 Opening expiry modal')
                    setShowExpiryModal(true)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Ionicons name="sparkles" size={20} color="#6A9571" />
                  <View style={styles.editExpiryText}>
                    <Text style={styles.editExpiryTitle}>
                      {editedExpiryDate 
                        ? new Date(editedExpiryDate).toLocaleDateString() 
                        : predictedExpiry 
                          ? `AI Suggestion: ${formatDateForDisplay(predictedExpiry.date)}`
                          : 'AI Suggestion: Tap to set'}
                    </Text>
                    <Text style={styles.editExpirySubtitle}>
                      {editedExpiryDate 
                        ? 'Custom date' 
                        : predictedExpiry 
                          ? `~${predictedExpiry.days} days`
                          : 'Tap to select'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </Pressable>
                
                {/* Expiry Date Selection View - inside main modal */}
                {showExpiryModal && (
                  <View style={styles.selectionViewContainer}>
                    <View style={styles.selectionViewHeader}>
                      <Text style={styles.selectionViewTitle}>Select Expiry Date</Text>
                      <Pressable onPress={() => setShowExpiryModal(false)}>
                        <Ionicons name="close" size={24} color="#8E8E93" />
                      </Pressable>
                    </View>
                    <View style={styles.expirySelectionContent}>
                      <Calendar
                        onDayPress={(day) => {
                          setSelectedDate(day.dateString)
                          setEditedExpiryDate(day.dateString)
                          setShowExpiryModal(false)
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
                  </View>
                )}
                
                {editedExpiryDate && (
                  <Text style={[styles.expiryPreview, { color: getExpiryColor(editedExpiryDate) }]}>
                    {getExpiryText(editedExpiryDate)}
                  </Text>
                )}
              </View>

              {/* Freeze Suggestion */}
              {editedExpiryDate && editedLocation !== 'freezer' && (() => {
                const daysLeft = calculateDaysUntilExpiry(editedExpiryDate)
                const freezeInfo = expiryPredictionService.getFreezeExtension(
                  selectedItem.name,
                  editedCategory,
                  editedLocation as 'fridge' | 'freezer' | 'pantry'
                )
                
                if (daysLeft !== null && daysLeft <= 3 && freezeInfo.canFreeze) {
                  return (
                    <Pressable
                      style={styles.freezeSuggestionCardMinimal}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        Alert.alert(
                          'Freeze to Extend Life',
                          `Move ${selectedItem.name} to freezer to extend its life by ${Math.round(freezeInfo.extensionDays / 30)} months.\n\n${freezeInfo.notes || ''}`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Move to Freezer',
                              onPress: () => {
                                setEditedLocation('freezer')
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                              }
                            }
                          ]
                        )
                      }}
                    >
                      <Ionicons name="snow-outline" size={16} color="#4DABF7" />
                      <View style={styles.freezeSuggestionText}>
                        <Text style={styles.freezeSuggestionTitleMinimal}>
                          Freeze to extend life
                        </Text>
                        <Text style={styles.freezeSuggestionSubtitleMinimal}>
                          +{Math.round(freezeInfo.extensionDays / 30)} months
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#4DABF7" />
                    </Pressable>
                  )
                }
                return null
              })()}
              
              {(selectedItem.store || selectedItem.price || selectedItem.purchase_date) && (
                <View style={styles.editSection}>
                  <Text style={styles.editSectionLabel}>PURCHASE INFO</Text>
                  {selectedItem.store && (
                    <View style={styles.detailsRowMinimal}>
                      <Text style={styles.detailsLabelMinimal}>Store</Text>
                      <Text style={styles.detailsValueMinimal}>{selectedItem.store}</Text>
                    </View>
                  )}
                  {selectedItem.price && (
                    <View style={styles.detailsRowMinimal}>
                      <Text style={styles.detailsLabelMinimal}>Price</Text>
                      <Text style={styles.detailsValueMinimal}>${selectedItem.price.toFixed(2)}</Text>
                    </View>
                  )}
                  {selectedItem.purchase_date && (
                    <View style={styles.detailsRowMinimal}>
                      <Text style={styles.detailsLabelMinimal}>Purchased</Text>
                      <Text style={styles.detailsValueMinimal}>
                        {new Date(selectedItem.purchase_date).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>NOTES</Text>
                <TextInput
                  style={styles.editNotesInput}
                  placeholder="Add notes (optional)"
                  placeholderTextColor="#C7C7CC"
                  value={editedNotes}
                  onChangeText={setEditedNotes}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
              
              <Pressable
                style={styles.editDeleteButton}
                onPress={() => {
                  Alert.alert(
                    'Remove Item',
                    `Are you sure you want to remove "${selectedItem.name}" from your pantry?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          await removeItem(selectedItem.id)
                          closeModal()
                        }
                      }
                    ]
                  )
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.editDeleteButtonText}>Remove from Pantry</Text>
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </LinearGradient>
      </Modal>

      {/* Aggregated Items Selector Modal */}
      <Modal
        visible={showAggregatedItemsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAggregatedItemsModal(false)
          setAggregatedSelection(null)
        }}
      >
        <View style={styles.listSelectorContainer}>
          <View style={styles.listSelectorHeader}>
            <Pressable
              style={styles.listSelectorCloseButton}
              onPress={() => {
                setShowAggregatedItemsModal(false)
                setAggregatedSelection(null)
              }}
            >
              <Text style={styles.listSelectorCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.listSelectorTitle}>
              {aggregatedSelection?.name}
            </Text>
            {aggregatedSelection && (
              <Text style={styles.listSelectorSubtitle}>
                Select an entry to manage individually
              </Text>
            )}
          </View>

          <ScrollView style={styles.listSelectorContent}>
            {aggregatedSelection?.aggregatedItems.map((child) => (
              <Pressable
                key={child.id}
                style={styles.listSelectorItem}
                onPress={() => {
                  setShowAggregatedItemsModal(false)
                  setAggregatedSelection(null)
                  openItemDetail(child)
                }}
              >
                <View style={styles.listSelectorItemLeft}>
                  <Text style={styles.listSelectorItemIcon}>{aggregatedSelection?.icon || '📦'}</Text>
                  <View>
                    <Text style={styles.listSelectorItemName}>
                      {child.quantity} {child.unit} • {child.location.charAt(0).toUpperCase() + child.location.slice(1)}
                    </Text>
                    <Text style={styles.listSelectorItemCount}>
                      {child.expiry_date ? `Expires ${getExpiryText(child.expiry_date)}` : 'No expiry date'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* List Selector Modal */}
      <Modal
        visible={showListSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowListSelector(false)}
      >
        <View style={styles.listSelectorContainer}>
          <View style={styles.listSelectorHeader}>
            <Pressable
              style={styles.listSelectorCloseButton}
              onPress={() => setShowListSelector(false)}
            >
              <Text style={styles.listSelectorCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.listSelectorTitle}>Add to List</Text>
            {itemToAddToList && (
              <Text style={styles.listSelectorSubtitle}>
                Select a list for {itemToAddToList.icon} {itemToAddToList.name}
              </Text>
            )}
          </View>
          
          <ScrollView style={styles.listSelectorContent}>
            {lists.map((list) => (
              <Pressable
                key={list.id}
                style={styles.listSelectorItem}
                onPress={() => handleSelectList(list.id, list.name)}
              >
                <View style={styles.listSelectorItemLeft}>
                  <Text style={styles.listSelectorItemIcon}>{list.icon}</Text>
                  <View>
                    <Text style={styles.listSelectorItemName}>{list.name}</Text>
                    <Text style={styles.listSelectorItemCount}>{list.itemCount} items</Text>
                  </View>
                </View>
                <Text style={styles.listSelectorItemArrow}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Manual Add Item Modal */}
      <ManualAddItemModal
        visible={showManualAddModal}
        onClose={() => setShowManualAddModal(false)}
      />
      
    </View>
  )
}

const styles = StyleSheet.create({
  cleanContainer: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassmorphicOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  cleanBottomSpacing: {
    height: 130,
  },

  // Sticky Header Container
  stickyHeader: {
    paddingBottom: 16,
    zIndex: 100,
    overflow: 'hidden',
  },

  // Header Styles
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 28,
  },
  cleanAppTitle: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  scanIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
  },
  clearIcon: {
    fontSize: 18,
    color: '#8E8E93',
    marginLeft: 8,
  },

  // Filter Section
  filterSection: {
    marginTop: 16,
    marginBottom: 32,
  },
  filterScrollView: {
    paddingHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  filterButtonTextActive: {
    fontWeight: '600',
    color: '#6A9571',
  },

  // Categories Section
  categoriesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#6A9571',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 2,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: -16,
    marginRight: -16,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 3,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  itemDetails: {
    fontSize: 12,
    fontWeight: '400',
  },
  aggregatedHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6A9571',
    marginTop: 4,
  },
  aggregatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderRadius: 12,
  },
  aggregatedQuantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
  },
  controlDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 8,
  },
  addToListButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addToListText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  itemQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  quantityControlButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityControlText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A9571',
  },
  inventoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    minWidth: 20,
    textAlign: 'center',
  },

  // Loading & Error States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6A9571',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 16,
    color: '#8E8E93',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emptyButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 0,
  },
  emptyButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  emptyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Edit Modal Styles - Matching Add Item Modal
  editModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  editModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalSaveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  editModalContent: {
    flex: 1,
  },
  editModalContentContainer: {
    padding: 20,
  },
  editItemNameSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  editItemNameTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  editItemUnitText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  itemHeaderMinimal: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemHeaderInfo: {
    flex: 1,
  },
  itemNameLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  freezeSuggestionText: {
    flex: 1,
  },
  freezeSuggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4DABF7',
    marginBottom: 2,
  },
  freezeSuggestionSubtitle: {
    fontSize: 13,
    color: '#4DABF7',
    opacity: 0.8,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailsLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  notesText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // List Selector Modal
  listSelectorContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listSelectorHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listSelectorCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  listSelectorCloseText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
  },
  listSelectorTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    paddingRight: 40,
  },
  listSelectorSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    paddingRight: 40,
  },
  listSelectorContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  listSelectorItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  listSelectorItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listSelectorItemIcon: {
    fontSize: 28,
  },
  listSelectorItemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  listSelectorItemCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  listSelectorItemArrow: {
    fontSize: 24,
    color: '#8E8E93',
  },

  // Edit Section Styles - Matching Add Item Modal
  editSection: {
    marginBottom: 20,
  },
  editSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  // Quantity & Unit - Matching Add Item Modal
  editQuantityUnitContainer: {
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
  editQuantityWrapper: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  editQuantityInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  editUnitDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  editUnitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 100,
  },
  editUnitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  editAutoDetectedText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Category Input - Matching Add Item Modal
  editCategoryInput: {
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
  editCategoryText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  editCategoryEmoji: {
    fontSize: 20,
  },
  // Location Input - Matching Add Item Modal
  editLocationInput: {
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
  editLocationText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  // Expiry Input - Matching Add Item Modal
  editExpiryInput: {
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
  editExpiryText: {
    flex: 1,
  },
  editExpiryTitle: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '600',
  },
  editExpirySubtitle: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '500',
    marginTop: 2,
  },
  // AI Prediction Card - Matching Add Item Modal
  editAiPredictionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    gap: 12,
    marginBottom: 12,
  },
  editAiPredictionText: {
    flex: 1,
  },
  editAiPredictionTitle: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '600',
  },
  editAiPredictionSubtitle: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '500',
    marginTop: 2,
  },
  // Notes Input - Matching Add Item Modal
  editNotesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    minHeight: 60,
    paddingTop: 14,
  },
  // Delete Button - Matching Add Item Modal
  editDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  editDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  editCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },

  // Quantity Edit Styles (Minimal)
  quantityEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  quantityEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityEditButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quantityEditInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    minWidth: 60,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  quantityUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // Picker Styles
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  picker: {
    height: 44,
  },

  // AI Prediction Styles (Minimal)
  aiPredictionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  aiPredictionCardMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  aiPredictionText: {
    flex: 1,
  },
  aiPredictionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
    marginBottom: 4,
  },
  aiPredictionTitleMinimal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
    marginBottom: 2,
  },
  aiPredictionSubtitle: {
    fontSize: 13,
    color: '#6A9571',
    opacity: 0.8,
  },
  aiPredictionSubtitleMinimal: {
    fontSize: 11,
    color: '#6A9571',
    opacity: 0.7,
  },

  // Date Input Styles (Minimal)
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dateButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateClearButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
  },
  dateClearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expiryPreview: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'left',
  },
  notesInputEditable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)'
  },

  // Freeze Suggestion Card (Minimal)
  freezeSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(77, 171, 247, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'rgba(77, 171, 247, 0.3)',
  },
  freezeSuggestionCardMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(77, 171, 247, 0.05)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.15)',
  },
  freezeSuggestionTitleMinimal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4DABF7',
    marginBottom: 2,
  },
  freezeSuggestionSubtitleMinimal: {
    fontSize: 11,
    color: '#4DABF7',
    opacity: 0.7,
  },
  
  // Details Section (Minimal)
  detailsSectionMinimal: {
    marginBottom: 20,
  },
  detailsRowMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  detailsLabelMinimal: {
    fontSize: 14,
    color: '#8E8E93',
  },
  detailsValueMinimal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  notesTextMinimal: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    marginTop: 4,
  },
  
  // Delete Button (Minimal)
  deleteButtonMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  deleteButtonTextMinimal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  datePickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  datePickerCancel: {
    fontSize: 17,
    color: '#8E8E93',
  },
  datePickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6A9571',
  },
  datePicker: {
    height: 216,
  },
  
  // Location Picker Styles
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  locationSelectorText: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  locationPickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  locationPickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  locationPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  locationPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  locationPickerCancel: {
    fontSize: 17,
    color: '#8E8E93',
  },
  locationPickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6A9571',
  },
  pickerWheel: {
    height: 216,
  },
  locationPickerAndroidContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 40,
    borderRadius: 16,
    padding: 20,
  },
  locationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },

  // New ManualAddItemModal-style interface styles
  categoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    marginTop: 8,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 20,
    marginLeft: 8,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    marginTop: 8,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },
  expiryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    marginTop: 8,
  },
  expiryText: {
    flex: 1,
    marginLeft: 12,
  },
  expiryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  expirySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Modal overlay and selection styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  selectionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 200,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  selectionContent: {
    maxHeight: 400,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  selectionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
  },

  // Selection views (inside main modal)
  selectionViewContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  selectionViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  selectionViewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  selectionViewContent: {
    maxHeight: 300,
  },
  expirySelectionContent: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  datePickerViewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  datePickerViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },

  // Calendar modal styles
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
    borderBottomColor: '#E5E5E7',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  calendarContainer: {
    padding: 20,
  },
  calendarFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  calendarConfirmButton: {
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calendarConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
