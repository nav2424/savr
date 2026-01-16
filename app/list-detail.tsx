// SAVR List Detail - Comprehensive List Management
import React, { useState, useEffect, useRef } from 'react'

// Type definitions
interface Collaborator {
  id: string
  name: string
  avatar: string
  role: string
  status: string
}

interface ListItem {
  id: string
  name: string
  category: string
  quantity: string
  completed: boolean
  addedBy: string
  addedDate: string
  notes?: string
}

interface ListData {
  id: string
  name: string
  description: string
  icon: string
  color: string
  createdDate: string
  lastUpdated: string
  totalItems: number
  completedItems: number
  itemCount: number
  completedCount: number
  collaborators: Collaborator[]
  items: ListItem[]
  categories: string[]
  shareCode?: string
}
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSimpleTheme } from '../lib/SimpleThemeContext'
import { useListsUnified } from '../lib/useListsUnified'
import { useCollaborativeLists } from '../lib/CollaborativeListsContext'
import { supabase } from '../lib/supabase'
import { collaborativeListsService } from '../lib/CollaborativeListsService'
import { categorizeForShopping } from '../lib/ItemCategorizer'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'
import { logger } from '../lib/Logger'

const { width } = Dimensions.get('window')

// Extended list data with collaborators and detailed items
const LIST_DATA: Record<string, ListData> = {
  '1': {
    id: '1',
    name: 'Weekly Groceries',
    description: 'Essential groceries for the week including fresh produce and pantry staples',
    icon: '🛒',
    color: '#E8F5E8',
    createdDate: '2024-04-20',
    lastUpdated: '2 hours ago',
    totalItems: 12,
    completedItems: 8,
    itemCount: 12,
    completedCount: 8,
    collaborators: [
      { id: '1', name: 'Nav', avatar: 'N', role: 'Owner', status: 'active' },
      { id: '2', name: 'Sarah', avatar: 'S', role: 'Editor', status: 'active' },
      { id: '3', name: 'Mike', avatar: 'M', role: 'Viewer', status: 'active' }
    ],
    items: [
      {
        id: '1',
        name: 'Organic Bananas',
        category: 'Produce',
        quantity: '6 pieces',
        completed: false,
        addedBy: 'Nav',
        addedDate: '2024-04-20',
        notes: 'Prefer organic, green/yellow mix'
      },
      {
        id: '2',
        name: 'Whole Milk',
        category: 'Dairy',
        quantity: '1 gallon',
        completed: false,
        addedBy: 'Sarah',
        addedDate: '2024-04-20',
        notes: '2% fat preferred'
      },
      {
        id: '3',
        name: 'Free Range Eggs',
        category: 'Dairy',
        quantity: '12 count',
        completed: false,
        addedBy: 'Nav',
        addedDate: '2024-04-20',
        notes: 'Large size'
      },
      {
        id: '4',
        name: 'Whole Wheat Bread',
        category: 'Bakery',
        quantity: '1 loaf',
        completed: false,
        addedBy: 'Mike',
        addedDate: '2024-04-21',
        notes: 'Fresh baked preferred'
      },
      {
        id: '5',
        name: 'Greek Yogurt',
        category: 'Dairy',
        quantity: '32 oz',
        completed: false,
        addedBy: 'Sarah',
        addedDate: '2024-04-21',
        notes: 'Plain, non-fat'
      },
      {
        id: '6',
        name: 'Spinach',
        category: 'Produce',
        quantity: '1 bag',
        completed: false,
        addedBy: 'Nav',
        addedDate: '2024-04-21',
        notes: 'Baby spinach preferred'
      },
      {
        id: '7',
        name: 'Chicken Breast',
        category: 'Meat',
        quantity: '2 lbs',
        completed: false,
        addedBy: 'Sarah',
        addedDate: '2024-04-20',
        notes: 'Free range, organic'
      },
      {
        id: '8',
        name: 'Quinoa',
        category: 'Grains',
        quantity: '1 bag',
        completed: false,
        addedBy: 'Nav',
        addedDate: '2024-04-20',
        notes: 'Organic white quinoa'
      },
      {
        id: '9',
        name: 'Avocados',
        category: 'Produce',
        quantity: '4 pieces',
        completed: false,
        addedBy: 'Mike',
        addedDate: '2024-04-20',
        notes: 'Hass avocados, ripe'
      },
      {
        id: '10',
        name: 'Coconut Oil',
        category: 'Pantry',
        quantity: '16 oz',
        completed: false,
        addedBy: 'Sarah',
        addedDate: '2024-04-21',
        notes: 'Virgin, unrefined'
      },
      {
        id: '11',
        name: 'Almonds',
        category: 'Nuts',
        quantity: '1 lb',
        completed: false,
        addedBy: 'Nav',
        addedDate: '2024-04-21',
        notes: 'Raw, unsalted'
      },
      {
        id: '12',
        name: 'Dark Chocolate',
        category: 'Snacks',
        quantity: '1 bar',
        completed: false,
        addedBy: 'Mike',
        addedDate: '2024-04-20',
        notes: '70% cocoa, fair trade'
      }
    ],
    categories: ['Produce', 'Dairy', 'Bakery', 'Meat', 'Grains', 'Pantry', 'Nuts', 'Snacks']
  }
}

export default function ListDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { lists, updateListItem, toggleItemCompletion, addItemToList, deleteItemFromList } = useListsUnified()
  const { inviteCollaborator, getListActivity, getListCollaborators, ensureSubscription } = useCollaborativeLists()
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showEditItemModal, setShowEditItemModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showShareCodeModal, setShowShareCodeModal] = useState(false)
  const [showCollaborationSections, setShowCollaborationSections] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [activities, setActivities] = useState<any[]>([])
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [generatedShareCode, setGeneratedShareCode] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const quantityInputRef = useRef<any>(null)
  const editQuantityInputRef = useRef<any>(null)

  // Load activities when component mounts
  useEffect(() => {
    if (id) {
      loadActivities()
    }
  }, [id])

  // Ensure real-time subscription is active when viewing this list
  useEffect(() => {
    if (id) {
      // Ensure subscription is active for this list
      ensureSubscription(id as string)
    }
  }, [id, ensureSubscription])

  const loadActivities = async () => {
    if (!id) return
    
    try {
      const activitiesData = await getListActivity(id as string)
      setActivities(activitiesData)
    } catch (error) {
      logger.error('Error loading activities', { error, listId: id })
    }
  }
  
  
  
  // AI-powered auto-categorization based on item name
  const getAutoCategory = (itemName: string): string => {
    return categorizeForShopping(itemName)
  }
  
  // Common units for selection
  const AVAILABLE_UNITS = [
    'pieces', 'lbs', 'oz', 'kg', 'g',
    'bags', 'boxes', 'bottles', 'cans', 'jars', 'containers', 'cartons',
    'packages', 'packs', 'bunches', 'heads', 'dozen'
  ]

  // Auto-detect unit based on item name - realistic shopping units
  const getAutoUnit = (itemName: string): string => {
    const name = itemName.toLowerCase()
    
    // Individual items that you buy by piece
    if (name.includes('banana') || name.includes('apple') || name.includes('orange') || 
        name.includes('lemon') || name.includes('lime') || name.includes('avocado') ||
        name.includes('egg') || name.includes('bread') || name.includes('roll') ||
        name.includes('bagel') || name.includes('muffin') || name.includes('cookie') ||
        name.includes('tomato') || name.includes('onion') || name.includes('potato')) {
      return 'pieces'
    }
    
    // Liquid items sold in containers/cartons
    if (name.includes('milk')) {
      return 'cartons'
    }
    if (name.includes('juice') || name.includes('water') || name.includes('soda') ||
        name.includes('beer') || name.includes('wine')) {
      return 'bottles'
    }
    if (name.includes('oil') || name.includes('vinegar')) {
      return 'bottles'
    }
    
    // Meat items sold by weight
    if (name.includes('chicken breast') || name.includes('chicken thigh') || 
        name.includes('beef') || name.includes('pork') || name.includes('fish') || 
        name.includes('turkey') || name.includes('ground beef') || name.includes('steak')) {
      return 'lbs'
    }
    
    // Dry goods sold in bags
    if (name.includes('rice') || name.includes('pasta') || name.includes('quinoa') ||
        name.includes('oats') || name.includes('cereal') || name.includes('flour') ||
        name.includes('sugar') || name.includes('beans') || name.includes('lentils')) {
      return 'bags'
    }
    
    // Dairy products in containers
    if (name.includes('yogurt') || name.includes('sour cream') || name.includes('cottage cheese') ||
        name.includes('cream cheese') || name.includes('butter')) {
      return 'containers'
    }
    
    // Cheese can be by weight or packages
    if (name.includes('cheese')) {
      return 'lbs'
    }
    
    // Small items in bottles/jars
    if (name.includes('spice') || name.includes('herb') || name.includes('salt') ||
        name.includes('pepper') || name.includes('yeast') || name.includes('baking powder') ||
        name.includes('sauce') || name.includes('ketchup') || name.includes('mustard')) {
      return 'bottles'
    }
    
    // Nuts and seeds in bags
    if (name.includes('nuts') || name.includes('seeds') || name.includes('almonds') ||
        name.includes('walnuts') || name.includes('cashews')) {
      return 'bags'
    }
    
    // Default to pieces for unknown items
    return 'pieces'
  }
  
  // Get list from shared context - always use context data
  // This will automatically update when lists context changes
  const currentList = lists.find(list => list.id === id)
  
  // Force re-render when lists change to ensure instant updates
  useEffect(() => {
    // This effect ensures the component re-renders when lists update
    // The currentList will automatically update because it's derived from lists
  }, [lists, id])
  
  // Clear generated share code when list changes (user navigates to different list)
  useEffect(() => {
    setGeneratedShareCode(null)
  }, [id])
  
  // Auto-update quantity unit when item name changes
  useEffect(() => {
    if (newItemName.trim()) {
      const autoUnit = getAutoUnit(newItemName)
      const currentQuantity = newItemQuantity.trim() || '1'
      const quantityNumber = currentQuantity.split(' ')[0] || '1'
      // Only update if unit is missing or different
      const currentUnit = currentQuantity.split(' ').slice(1).join(' ')
      if (!currentUnit || currentUnit !== autoUnit) {
        setNewItemQuantity(`${quantityNumber} ${autoUnit}`)
      }
    } else {
      // Reset to default when name is cleared
      setNewItemQuantity('1 pieces')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItemName])
  
  // Load collaborators when list is found - refresh from service to get latest
  useEffect(() => {
    const loadCollaborators = async () => {
      if (currentList && id) {
        try {
          const collaboratorsData = await getListCollaborators(id as string)
          if (collaboratorsData && collaboratorsData.length > 0) {
            setCollaborators(collaboratorsData.map((collab: any) => ({
              id: collab.id || collab.user_id || `owner-${collab.user_id}`,
              name: collab.user?.name || collab.name || 'Unknown',
              avatar: (collab.user?.name || collab.name || 'U').charAt(0).toUpperCase(),
              role: collab.role || 'editor',
              status: 'active'
            })))
          }
        } catch (error) {
          logger.error('Error loading collaborators', { error, listId: id })
          // Fallback to context data
          if (currentList.collaborators) {
            setCollaborators(currentList.collaborators.map((collab: any) => ({
              id: collab.id || collab.user_id,
              name: collab.user?.name || collab.name || 'Unknown',
              avatar: (collab.user?.name || collab.name || 'U').charAt(0).toUpperCase(),
              role: collab.role || 'editor',
              status: 'active'
            })))
          }
        }
      }
    }
    loadCollaborators()
  }, [currentList, id])
  
  // Create list data, ensuring we always use live context data
  const listData = currentList ? {
    ...currentList,
    description: `Shopping list with ${currentList.itemCount} items`,
    createdDate: '2024-04-20',
    collaborators: collaborators.length > 0 ? collaborators : (currentList.collaborators || []).map((collab: any) => ({
      id: collab.id || collab.user_id,
      name: collab.user?.name || collab.name || 'Unknown',
      avatar: (collab.user?.name || collab.name || 'U').charAt(0).toUpperCase(),
      role: collab.role || 'editor',
      status: 'active'
    })),
    categories: ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry']
  } : null
  
  if (!listData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>List not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    )
  }


  const handleCheckboxToggle = async (itemId: string, event: any) => {
    event.stopPropagation()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // Use currentList since we know it exists (listData is only set if currentList exists)
    if (currentList) {
      toggleItemCompletion(currentList.id, itemId)
    } else {
      logger.error('No current list found when toggling item', { itemId })
    }
  }
  

  const handleItemPress = (item: ListItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedItem(item)
    
    // Extract number from current quantity, auto-detect appropriate unit
    const parts = item.quantity.split(' ')
    const number = parts[0] || '1'
    const autoUnit = getAutoUnit(item.name)
    setEditQuantity(`${number} ${autoUnit}`)
    setEditNotes(item.notes || '')
    setShowEditItemModal(true)
  }

  const handleDeleteItem = (itemId: string, itemName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    Alert.alert(
      'Delete Item',
      `Remove "${itemName}" from this list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (currentList?.id && deleteItemFromList) {
              deleteItemFromList(currentList.id, itemId)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            }
          },
        },
      ]
    )
  }

  const handleSaveItemEdit = () => {
    if (selectedItem && currentList) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      // editQuantity is already in "number unit" format from auto-detection
      const finalQuantity = editQuantity || '1 pieces'
      
      // Update the item in the shared context
      updateListItem(currentList.id, selectedItem.id, {
        quantity: finalQuantity,
        notes: editNotes
      })
      
      Alert.alert(
        'Item Updated',
        `"${selectedItem.name}" has been updated\nQuantity: ${finalQuantity}\nNotes: ${editNotes || 'None'}`,
        [{ text: 'OK' }]
      )
      setShowEditItemModal(false)
      setSelectedItem(null)
      setEditQuantity('')
      setEditNotes('')
    }
  }

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name')
      return
    }
    
    if (!id) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    // AI auto-categorization
    const autoCategory = getAutoCategory(newItemName)
    
    // Add item to list using context with AI-detected category
    addItemToList(id.toString(), {
      name: newItemName.trim(),
      category: autoCategory,
      quantity: newItemQuantity.trim() || '1',
      notes: newItemNotes.trim()
    })
    
    // Reset form
    setNewItemName('')
    setNewItemQuantity('1')
    setNewItemNotes('')
    setShowAddItemModal(false)
    
    Alert.alert('Added!', `${newItemName} added to ${autoCategory}`)
  }

  const handleCollaboratorPress = (collaborator: Collaborator) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(`/list-collaborators?id=${id}`)
  }

  const handleGenerateShareCode = async () => {
    if (!id) {
      Alert.alert('Error', 'List ID not found.')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      // Use the service method to generate and update share code (ensures uniqueness)
      const { data, error } = await collaborativeListsService.generateAndUpdateShareCode(id as string)

      if (error) {
        logger.error('Error generating share code', { error, listId: id })
        // Extract the actual error message
        const errorMessage = error instanceof Error ? error.message : (error?.message || 'Failed to generate share code. Please try again.')
        Alert.alert('Error', errorMessage)
        return
      }

      if (data && data.share_code) {
        // Store the actual share code from database (this is the source of truth)
        const actualShareCode = data.share_code
        setGeneratedShareCode(actualShareCode)
        
        // The generatedShareCode state will be used by getDisplayShareCode() which takes priority
        // This ensures the UI shows the correct code instantly, matching what's in the database
        
        setShowInviteModal(false)
        setShowShareCodeModal(true)
      } else {
        Alert.alert('Error', 'Share code was generated but not returned. Please try again.')
      }
    } catch (error) {
      logger.error('Error generating share code', { error, listId: id })
      // Extract the actual error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate share code. Please try again.'
      Alert.alert('Error', errorMessage)
    }
  }

  const handleShareCode = async () => {
    // Use generated share code if available, otherwise use from context, otherwise show error
    const shareCode = generatedShareCode || currentList?.shareCode || (listData as any)?.shareCode
    
    if (!shareCode) {
      Alert.alert('Error', 'No share code available. Please generate one first.')
      return
    }
    
    const shareMessage = `Join my shopping list on SAVR! Use code: ${shareCode}\n\nDownload SAVR: [App Store Link]`
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await Share.share({
        message: shareMessage,
        title: 'Join my SAVR list'
      })
    } catch (error) {
      logger.error('Error sharing code', { error })
      Alert.alert('Error', 'Failed to share code.')
    }
  }
  
  // Get the actual share code to display (prioritize generated, then context, then listData)
  const getDisplayShareCode = (): string => {
    return generatedShareCode || currentList?.shareCode || (listData as any)?.shareCode || ''
  }

  const getFilteredItems = (): ListItem[] => {
    switch (selectedFilter) {
      case 'completed':
        return listData.items.filter((item: ListItem) => item.completed)
      case 'pending':
        return listData.items.filter((item: ListItem) => !item.completed)
      default:
        return listData.items
    }
  }

  // Group items by category for easier shopping
  const getItemsByCategory = (): Record<string, ListItem[]> => {
    const filtered = getFilteredItems()
    const grouped: Record<string, ListItem[]> = {}
    
    filtered.forEach((item) => {
      const category = item.category || 'Groceries'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(item)
    })
    
    return grouped
  }

  // Get category order for shopping (logical store layout order)
  const getCategoryOrder = (): string[] => {
    return [
      'Produce',
      'Meat & Seafood',
      'Dairy & Eggs',
      'Bakery & Bread',
      'Pantry Staples',
      'Beverages',
      'Frozen Foods',
      'Snacks',
      'Condiments',
      'Groceries', // Default/Other category last
    ]
  }

  // Get sorted categories (known categories first, then others alphabetically)
  const getSortedCategories = (): string[] => {
    const itemsByCategory = getItemsByCategory()
    const categoryOrder = getCategoryOrder()
    const knownCategories: string[] = []
    const otherCategories: string[] = []
    
    Object.keys(itemsByCategory).forEach((category) => {
      const index = categoryOrder.indexOf(category)
      if (index !== -1) {
        knownCategories.push(category)
      } else {
        otherCategories.push(category)
      }
    })
    
    // Sort known categories by order, others alphabetically
    knownCategories.sort((a, b) => {
      return categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
    })
    otherCategories.sort()
    
    return [...knownCategories, ...otherCategories]
  }

  // Auto-collapse all categories when list loads or items change
  useEffect(() => {
    if (listData && listData.items && listData.items.length > 0) {
      // Get all unique categories from items
      const categories = new Set<string>()
      listData.items.forEach((item: ListItem) => {
        const category = item.category || 'Groceries'
        categories.add(category)
      })
      
      // Collapse all categories by default (add all to collapsed Set)
      setCollapsedCategories(new Set(categories))
    }
  }, [listData?.id, listData?.items?.length]) // Re-collapse when list ID or item count changes

  const toggleCategory = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }
  
  const getCompletedCount = () => {
    return listData.items.filter(item => item.completed).length
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      {/* Glassmorphic Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.12)', 'transparent', 'transparent']}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{listData.name}</Text>
            <Text style={styles.headerSubtitle}>{listData.description}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{getCompletedCount()}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{listData.itemCount}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{listData.itemCount > 0 ? Math.round((getCompletedCount() / listData.itemCount) * 100) : 0}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>

        {/* Collaborators - Always visible */}
        <View style={[styles.section, { marginTop: 4 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COLLABORATORS</Text>
            <Pressable
              style={styles.inviteButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setShowInviteModal(true)
              }}
            >
              <LinearGradient
                colors={['#6A9571', '#5A8561']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.inviteButtonGradient}
              >
                <Text style={styles.inviteButtonText}>+ Invite</Text>
              </LinearGradient>
            </Pressable>
          </View>
          <View style={styles.collaboratorsContainer}>
            {listData.collaborators.map((collaborator) => (
              <Pressable
                key={collaborator.id}
                style={styles.collaboratorCard}
                onPress={() => handleCollaboratorPress(collaborator)}
              >
                <View style={styles.collaboratorAvatar}>
                  <Text style={styles.collaboratorAvatarText}>{collaborator.avatar}</Text>
                </View>
                <View style={styles.collaboratorInfo}>
                  <Text style={styles.collaboratorName}>{collaborator.name}</Text>
                  <Text style={styles.collaboratorRole}>{collaborator.role}</Text>
                </View>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: collaborator.status === 'active' ? '#6BCF7F' : '#FF6B6B' }
                ]} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Additional Collaboration Sections - Only show when people icon is clicked */}
        {showCollaborationSections && (
          <>
            {/* Share Code */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SHARE CODE</Text>
              <View style={styles.shareCodeContainer}>
                <View style={styles.shareCodeCard}>
                  <View style={styles.shareCodeInfo}>
                    <Text style={styles.shareCodeLabel}>Share this code to invite others</Text>
                    <Text style={styles.shareCodeValue}>{getDisplayShareCode() || 'No code yet'}</Text>
                  </View>
                  <Pressable
                    style={styles.copyButton}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      try {
                        const codeToCopy = getDisplayShareCode()
                        if (!codeToCopy) {
                          Alert.alert('Error', 'No share code available to copy.')
                          return
                        }
                        await Clipboard.setStringAsync(codeToCopy)
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        Alert.alert('Copied!', 'Share code copied to clipboard')
                      } catch (error) {
                        logger.error('Error copying to clipboard', { error })
                        Alert.alert('Error', 'Failed to copy share code')
                      }
                    }}
                  >
                    <LinearGradient
                      colors={['#6A9571', '#5A8561']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.copyButtonGradient}
                    >
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Activity Feed */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
                <Pressable
                  style={styles.activityButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowActivityModal(true)
                  }}
                >
                  <Text style={styles.activityButtonText}>View All</Text>
                </Pressable>
              </View>
              <View style={styles.activityContainer}>
                {activities.slice(0, 3).map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityIcon}>
                      <Text style={styles.activityIconText}>
                        {activity.action === 'added' ? '➕' : 
                         activity.action === 'completed' ? '✅' : 
                         activity.action === 'deleted' ? '🗑️' : '📝'}
                      </Text>
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText}>
                        <Text style={styles.activityUser}>{activity.user_name}</Text>
                        {' '}{activity.action} {activity.item_name}
                      </Text>
                      <Text style={styles.activityTime}>
                        {new Date(activity.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
                {activities.length === 0 && (
                  <View style={styles.emptyActivity}>
                    <Text style={styles.emptyActivityText}>No recent activity</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* Filter Buttons */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterContainer}>
              {[
                { id: 'all', name: 'All Items' },
                { id: 'pending', name: 'Pending' },
                { id: 'completed', name: 'Completed' }
              ].map((filter) => (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter.id && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedFilter(filter.id)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedFilter === filter.id && styles.filterButtonTextActive
                  ]}>
                    {filter.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* List Items - Grouped by Category */}
        <View style={styles.section}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>ITEMS ({getFilteredItems().length})</Text>
            <Pressable 
              style={styles.addItemButtonInline}
              onPress={() => setShowAddItemModal(true)}
            >
              <Text style={styles.addItemButtonText}>+</Text>
            </Pressable>
          </View>
          
          {getSortedCategories().map((category) => {
            const itemsByCategory = getItemsByCategory()
            const items = itemsByCategory[category] || []
            const isCollapsed = collapsedCategories.has(category)
            const completedInCategory = items.filter(item => item.completed).length
            
            if (items.length === 0) return null
            
            return (
              <View key={category} style={styles.categorySection}>
                {/* Category Header */}
                <Pressable
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(category)}
                >
                  <View style={styles.categoryHeaderLeft}>
                    <Text style={styles.categoryHeaderTitle}>{category}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {items.length} {items.length === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                    {completedInCategory > 0 && (
                      <View style={styles.categoryCompletedBadge}>
                        <Text style={styles.categoryCompletedBadgeText}>
                          {completedInCategory}/{items.length}
                        </Text>
                      </View>
                    )}
                    <Ionicons 
                      name={isCollapsed ? "chevron-down" : "chevron-up"} 
                      size={18} 
                      color="#6A9571" 
                      style={{ marginLeft: 'auto' }}
                    />
                  </View>
                </Pressable>
                
                {/* Category Items */}
                {!isCollapsed && items.map((item: ListItem) => {
                  const isCompleted = item.completed
                  const hasMultipleCollaborators = listData.collaborators && listData.collaborators.length > 1
                  
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.itemCard,
                        isCompleted && styles.itemCardCompleted
                      ]}
                      onPress={() => handleItemPress(item)}
                      onLongPress={() => handleDeleteItem(item.id, item.name)}
                    >
                      <View style={styles.itemLeft}>
                        <Pressable
                          style={[
                            styles.checkbox,
                            isCompleted && styles.checkboxCompleted
                          ]}
                          onPress={(e) => handleCheckboxToggle(item.id, e)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>
                      
                      <View style={styles.itemInfo}>
                        <Text 
                          style={[
                            styles.itemName,
                            isCompleted && styles.itemNameCompleted
                          ]}
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>
                        <View style={styles.itemDetails}>
                          <Text style={styles.itemQuantity} numberOfLines={1}>
                            {item.quantity}
                          </Text>
                          {hasMultipleCollaborators && (
                            <Text style={styles.itemAddedBy} numberOfLines={1}>• {item.addedBy}</Text>
                          )}
                        </View>
                        {item.notes && (
                          <Text style={styles.itemNotes} numberOfLines={2}>
                            {item.notes}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
                )}
              </View>
            )
          })}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <View style={styles.editModalContainer}>
          {/* Glassmorphic Background */}
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editModalGradient}
          />
          <LinearGradient
            colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
            start={{ x: 0.3, y: 0.3 }}
            end={{ x: 1, y: 1 }}
            style={styles.editModalOverlay}
          />
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editModalScroll}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={styles.editModalScroll}
              contentContainerStyle={styles.editModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Header */}
              <View style={styles.editModalHeader}>
                <Pressable 
                  style={styles.editModalCloseButton}
                  onPress={() => {
                    setShowAddItemModal(false)
                    setNewItemName('')
                    setNewItemQuantity('1')
                    setNewItemNotes('')
                  }}
                >
                  <Text style={styles.editModalCloseText}>✕</Text>
                </Pressable>
              </View>

            {/* Title Section */}
            <View style={styles.addItemTitleSection}>
              <Text style={styles.addItemMainTitle}>Add New Item</Text>
              <Text style={styles.addItemSubtitle}>Create a new item for your shopping list</Text>
            </View>

            {/* Item Name Section */}
            <View style={styles.addItemSection}>
              <Text style={styles.addItemLabel}>Item Name</Text>
              <View style={styles.addItemInputCard}>
                <TextInput
                  style={styles.addItemInput}
                  placeholder="e.g., Bananas, Milk, Chicken..."
                  placeholderTextColor="#8E8E93"
                  value={newItemName}
                  onChangeText={setNewItemName}
                  autoFocus
                />
              </View>
              {newItemName.trim() && (
                <View style={styles.addItemCategoryBadge}>
                  <Ionicons name="pricetag-outline" size={14} color="#6A9571" />
                  <Text style={styles.addItemCategoryText}>
                    {getAutoCategory(newItemName)}
                  </Text>
                </View>
              )}
            </View>

            {/* Quantity & Unit Section - Redesigned */}
            <View style={styles.addItemSection}>
              <Text style={styles.addItemLabel}>Quantity & Unit</Text>
              <View style={styles.addItemQuantityCard}>
                <View style={styles.addItemQuantityRow}>
                  <TextInput
                    ref={quantityInputRef}
                    style={styles.addItemQuantityInput}
                    placeholder="1"
                    placeholderTextColor="#8E8E93"
                    value={newItemQuantity.split(' ')[0].trim() || ''}
                    onChangeText={(text) => {
                      // Only allow numbers, but allow empty string while typing
                      const numbersOnly = text.replace(/[^0-9]/g, '')
                      const currentUnit = newItemQuantity.split(' ').slice(1).join(' ') || getAutoUnit(newItemName || 'item')
                      
                      // Allow empty while typing, update the full quantity string
                      if (numbersOnly === '') {
                        setNewItemQuantity(` ${currentUnit}`)
                      } else {
                        setNewItemQuantity(`${numbersOnly} ${currentUnit}`)
                      }
                    }}
                    onBlur={() => {
                      // Validate on blur - ensure minimum of 1
                      const currentNumber = newItemQuantity.split(' ')[0].trim() || ''
                      const currentUnit = newItemQuantity.split(' ').slice(1).join(' ') || getAutoUnit(newItemName || 'item')
                      
                      if (currentNumber === '' || currentNumber === '0' || parseInt(currentNumber) < 1) {
                        setNewItemQuantity(`1 ${currentUnit}`)
                      } else {
                        // Ensure it's a valid number
                        const parsed = parseInt(currentNumber)
                        if (!isNaN(parsed)) {
                          setNewItemQuantity(`${parsed} ${currentUnit}`)
                        }
                      }
                    }}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    editable={true}
                    selectTextOnFocus={true}
                    blurOnSubmit={true}
                  />
                  
                  <View style={styles.addItemDivider} />
                  
                  <Pressable 
                    style={styles.addItemUnitDisplay}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowUnitPicker(true)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addItemUnitText}>
                      {newItemQuantity.split(' ').slice(1).join(' ') || getAutoUnit(newItemName || 'item')}
                    </Text>
                    {newItemName.trim() && (
                      <Ionicons name="sparkles" size={10} color="#6A9571" style={{ marginLeft: 4 }} />
                    )}
                    <Ionicons name="chevron-down" size={12} color="#6A9571" style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Notes Section */}
            <View style={styles.addItemSection}>
              <Text style={styles.addItemLabel}>Notes <Text style={styles.addItemOptional}>(Optional)</Text></Text>
              <View style={styles.addItemNotesCard}>
                <TextInput
                  style={styles.addItemNotesInput}
                  placeholder="Add any special notes or preferences..."
                  placeholderTextColor="#8E8E93"
                  value={newItemNotes}
                  onChangeText={setNewItemNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.addItemActions}>
              <Pressable
                style={styles.addItemButton}
                onPress={handleAddItem}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addItemButtonGradient}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.addItemButtonText}>Add to List</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <Pressable 
          style={styles.unitPickerOverlay}
          onPress={() => setShowUnitPicker(false)}
        >
          <Pressable 
            style={styles.unitPickerContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.unitPickerHeader}>
              <Text style={styles.unitPickerTitle}>Select Unit</Text>
              <Pressable 
                onPress={() => setShowUnitPicker(false)}
                style={styles.unitPickerCloseButton}
              >
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.unitPickerScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.unitPickerGrid}>
                {AVAILABLE_UNITS.map((unit) => {
                  // Determine which modal is active and get current unit
                  const isEditMode = showEditItemModal && selectedItem
                  const currentQuantity = isEditMode ? editQuantity : newItemQuantity
                  const currentName = isEditMode ? selectedItem?.name || 'item' : newItemName || 'item'
                  const currentUnit = currentQuantity.split(' ').slice(1).join(' ') || getAutoUnit(currentName)
                  const isSelected = unit === currentUnit
                  
                  return (
                    <Pressable
                      key={unit}
                      style={[
                        styles.unitPickerItem,
                        isSelected && styles.unitPickerItemSelected
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        const quantityNumber = currentQuantity.split(' ')[0] || '1'
                        const newQuantity = `${quantityNumber} ${unit}`
                        
                        // Close modal FIRST to ensure immediate visual feedback
                        setShowUnitPicker(false)
                        
                        // Then update state - this ensures modal closes immediately
                        // and unit appears right away
                        if (isEditMode) {
                          setEditQuantity(newQuantity)
                        } else {
                          setNewItemQuantity(newQuantity)
                        }
                      }}
                    >
                      <Text style={[
                        styles.unitPickerItemText,
                        isSelected && styles.unitPickerItemTextSelected
                      ]}>
                        {unit}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#6A9571" />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>


      {/* Edit Item Modal */}
      <Modal
        visible={showEditItemModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEditItemModal(false)}
      >
        <View style={styles.editModalContainer}>
          {/* Glassmorphic Background */}
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editModalGradient}
          />
          <LinearGradient
            colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
            start={{ x: 0.3, y: 0.3 }}
            end={{ x: 1, y: 1 }}
            style={styles.editModalOverlay}
          />
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editModalScroll}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={styles.editModalScroll}
              contentContainerStyle={styles.editModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {selectedItem && (
                <>
                  {/* Header */}
                  <View style={styles.editModalHeader}>
                  <Pressable 
                    style={styles.editModalCloseButton}
                    onPress={() => setShowEditItemModal(false)}
                  >
                    <Text style={styles.editModalCloseText}>✕</Text>
                  </Pressable>
                </View>

                {/* Title Section - Matching Add Item Modal */}
                <View style={styles.addItemTitleSection}>
                  <Text style={styles.addItemMainTitle}>Edit Item</Text>
                  <Text style={styles.addItemSubtitle}>Update item details for your shopping list</Text>
                </View>

                {/* Item Name Display - Matching Add Item Modal */}
                {selectedItem.name.trim() && (
                  <View style={styles.itemNameDisplaySection}>
                    <Text style={styles.itemNameDisplayTitle}>{selectedItem.name}</Text>
                    <Text style={styles.itemNameDisplayUnit}>
                      {editQuantity.split(' ').slice(1).join(' ') || 'pieces'}
                    </Text>
                  </View>
                )}

                {/* Quantity & Unit Section - Matching Add Item Modal */}
                <View style={styles.addItemSection}>
                  <Text style={styles.addItemLabel}>Quantity & Unit</Text>
                  <View style={styles.addItemQuantityCard}>
                    <View style={styles.addItemQuantityRow}>
                      <TextInput
                        ref={editQuantityInputRef}
                        style={styles.addItemQuantityInput}
                        placeholder="1"
                        placeholderTextColor="#8E8E93"
                        value={editQuantity.split(' ')[0].trim() || ''}
                        onChangeText={(text) => {
                          // Only allow numbers, but allow empty string while typing
                          const numbersOnly = text.replace(/[^0-9]/g, '')
                          const currentUnit = editQuantity.split(' ').slice(1).join(' ') || 'pieces'
                          
                          // Allow empty while typing, update the full quantity string
                          if (numbersOnly === '') {
                            setEditQuantity(` ${currentUnit}`)
                          } else {
                            setEditQuantity(`${numbersOnly} ${currentUnit}`)
                          }
                        }}
                        onBlur={() => {
                          // Validate on blur - ensure minimum of 1
                          const currentNumber = editQuantity.split(' ')[0].trim() || ''
                          const currentUnit = editQuantity.split(' ').slice(1).join(' ') || 'pieces'
                          
                          if (currentNumber === '' || currentNumber === '0' || parseInt(currentNumber) < 1) {
                            setEditQuantity(`1 ${currentUnit}`)
                          } else {
                            // Ensure it's a valid number
                            const parsed = parseInt(currentNumber)
                            if (!isNaN(parsed)) {
                              setEditQuantity(`${parsed} ${currentUnit}`)
                            }
                          }
                        }}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        editable={true}
                        selectTextOnFocus={true}
                        blurOnSubmit={true}
                      />
                      
                      <View style={styles.addItemDivider} />
                      
                      <Pressable 
                        style={styles.addItemUnitDisplay}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setShowUnitPicker(true)
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addItemUnitText}>
                          {editQuantity.split(' ').slice(1).join(' ') || 'pieces'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#6A9571" style={{ marginLeft: 4 }} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Notes Section - Matching Add Item Modal */}
                <View style={styles.addItemSection}>
                  <Text style={styles.addItemLabel}>Notes <Text style={styles.addItemOptional}>(Optional)</Text></Text>
                  <View style={styles.addItemNotesCard}>
                    <TextInput
                      style={styles.addItemNotesInput}
                      placeholder="Add any special notes or preferences..."
                      placeholderTextColor="#8E8E93"
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                {/* Action Buttons - Matching Add Item Modal */}
                <View style={styles.addItemActions}>
                  <Pressable
                    style={styles.addItemButton}
                    onPress={handleSaveItemEdit}
                  >
                    <LinearGradient
                      colors={['#6A9571', '#8AB896']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.addItemButtonGradient}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.addItemButtonText}>Save Changes</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                <View style={{ height: 40 }} />
              </>
            )}

            {/* Unit Picker - Rendered inside Edit Modal to appear on top */}
            {showUnitPicker && showEditItemModal && (
              <View style={styles.unitPickerOverlayInside}>
                <Pressable 
                  style={styles.unitPickerOverlayBackdrop}
                  onPress={() => setShowUnitPicker(false)}
                >
                  <Pressable 
                    style={styles.unitPickerContent}
                    onPress={(e) => e.stopPropagation()}
                  >
                    <View style={styles.unitPickerHeader}>
                      <Text style={styles.unitPickerTitle}>Select Unit</Text>
                      <Pressable 
                        onPress={() => setShowUnitPicker(false)}
                        style={styles.unitPickerCloseButton}
                      >
                        <Ionicons name="close" size={24} color="#1C1C1E" />
                      </Pressable>
                    </View>
                    
                    <ScrollView 
                      style={styles.unitPickerScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.unitPickerGrid}>
                        {AVAILABLE_UNITS.map((unit) => {
                          // For edit mode, use editQuantity
                          const currentQuantity = editQuantity
                          const currentName = selectedItem?.name || 'item'
                          const currentUnit = currentQuantity.split(' ').slice(1).join(' ') || getAutoUnit(currentName)
                          const isSelected = unit === currentUnit
                          
                          return (
                            <Pressable
                              key={unit}
                              style={[
                                styles.unitPickerItem,
                                isSelected && styles.unitPickerItemSelected
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                const quantityNumber = currentQuantity.split(' ')[0] || '1'
                                const newQuantity = `${quantityNumber} ${unit}`
                                
                                // Close picker FIRST to ensure immediate visual feedback
                                setShowUnitPicker(false)
                                
                                // Then update state - this ensures picker closes immediately
                                // and unit appears right away
                                setEditQuantity(newQuantity)
                              }}
                            >
                              <Text style={[
                                styles.unitPickerItemText,
                                isSelected && styles.unitPickerItemTextSelected
                              ]}>
                                {unit}
                              </Text>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={20} color="#6A9571" />
                              )}
                            </Pressable>
                          )
                        })}
                      </View>
                    </ScrollView>
                  </Pressable>
                </Pressable>
              </View>
            )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Invite Collaborator Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.inviteModalContainer}>
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            style={styles.inviteModalGradient}
          >
            <View style={styles.inviteModalContent}>
              {/* Header */}
              <View style={styles.inviteModalHeader}>
                <Pressable
                  style={styles.inviteModalCloseButton}
                  onPress={() => setShowInviteModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.inviteModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.inviteModalScroll} showsVerticalScrollIndicator={false}>
                {/* Top Spacing */}
                <View style={styles.inviteModalTopSpacing} />
                
                {/* Icon */}
                <View style={styles.inviteModalIconContainer}>
                  <Text style={styles.inviteModalIcon}>🔗</Text>
                </View>

                {/* Instructions */}
                <View style={styles.inviteModalSection}>
                  <Text style={styles.inviteModalTitle}>Invite Collaborators</Text>
                  <Text style={styles.inviteModalDescription}>
                    Generate a share code to invite others to collaborate on this list. 
                    Share the code via iMessage, Instagram, Snapchat, or any other platform.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.inviteModalActions}>
                  <Pressable 
                    style={styles.inviteModalSendButton}
                    onPress={handleGenerateShareCode}
                  >
                    <LinearGradient
                      colors={['#6A9571', '#5A8561']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inviteModalSendGradient}
                    >
                      <Text style={styles.inviteModalSendText}>Generate Share Code</Text>
                    </LinearGradient>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.inviteModalCancelButton}
                    onPress={() => setShowInviteModal(false)}
                  >
                    <Text style={styles.inviteModalCancelText}>Cancel</Text>
                  </Pressable>
                </View>

                {/* Bottom Spacing */}
                <View style={styles.inviteModalBottomSpacing} />
              </ScrollView>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Share Code Modal */}
      <Modal
        visible={showShareCodeModal}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        onRequestClose={() => setShowShareCodeModal(false)}
      >
        <View style={styles.shareCodeModalContainer}>
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            style={styles.shareCodeModalGradient}
          >
            <View style={styles.shareCodeModalContent}>
              {/* Header */}
              <View style={styles.shareCodeModalHeader}>
                <Pressable
                  style={styles.shareCodeModalCloseButton}
                  onPress={() => setShowShareCodeModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.shareCodeModalCloseText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.shareCodeModalScroll} showsVerticalScrollIndicator={false}>
                {/* Top Spacing */}
                <View style={styles.shareCodeModalTopSpacing} />
                
                {/* Success Icon */}
                <View style={styles.shareCodeModalIconContainer}>
                  <Text style={styles.shareCodeModalIcon}>✅</Text>
                </View>

                {/* Title */}
                <View style={styles.shareCodeModalTitleContainer}>
                  <Text style={styles.shareCodeModalTitle}>Share Code Generated!</Text>
                  <Text style={styles.shareCodeModalSubtitle}>
                    Your unique code is ready to share
                  </Text>
                </View>

                {/* Share Code Display */}
                <View style={styles.shareCodeModalCodeSection}>
                  <View style={styles.shareCodeModalCodeContainer}>
                    <Text style={styles.shareCodeModalCodeLabel}>Share Code</Text>
                    <Text style={styles.shareCodeModalCodeText}>
                      {getDisplayShareCode() || 'Generating...'}
                    </Text>
                  </View>
                  <Text style={styles.shareCodeModalDescription}>
                    Share this code with others to invite them to collaborate on your list.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.shareCodeModalActions}>
                  <Pressable 
                    style={styles.shareCodeModalShareButton}
                    onPress={handleShareCode}
                  >
                    <LinearGradient
                      colors={['#6A9571', '#5A8561']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shareCodeModalShareGradient}
                    >
                      <Text style={styles.shareCodeModalShareText}>Share Code</Text>
                    </LinearGradient>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.shareCodeModalCopyButton}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      try {
                        const codeToCopy = getDisplayShareCode()
                        if (!codeToCopy) {
                          Alert.alert('Error', 'No share code available to copy.')
                          return
                        }
                        await Clipboard.setStringAsync(codeToCopy)
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        Alert.alert('Copied!', 'Share code copied to clipboard')
                      } catch (error) {
                        logger.error('Error copying to clipboard', { error })
                        Alert.alert('Error', 'Failed to copy share code')
                      }
                    }}
                  >
                    <Text style={styles.shareCodeModalCopyText}>Copy Code</Text>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.shareCodeModalCancelButton}
                    onPress={() => setShowShareCodeModal(false)}
                  >
                    <Text style={styles.shareCodeModalCancelText}>Done</Text>
                  </Pressable>
                </View>

                {/* Bottom Spacing */}
                <View style={styles.shareCodeModalBottomSpacing} />
              </ScrollView>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Activity Feed Modal */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.activityModalContainer}>
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            style={styles.activityModalGradient}
          >
            <View style={styles.activityModalContent}>
              {/* Header */}
              <View style={styles.activityModalHeader}>
                <Pressable
                  style={styles.activityModalCloseButton}
                  onPress={() => setShowActivityModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.activityModalCloseText}>✕</Text>
                </Pressable>
                <Text style={styles.activityModalTitle}>Activity Feed</Text>
                <View style={styles.activityModalHeaderSpacer} />
              </View>

              <ScrollView style={styles.activityModalScroll} showsVerticalScrollIndicator={false}>
                {activities.length === 0 ? (
                  <View style={styles.emptyActivityModal}>
                    <Text style={styles.emptyActivityModalTitle}>No Activity Yet</Text>
                    <Text style={styles.emptyActivityModalSubtitle}>
                      Activity will appear here when collaborators make changes to the list
                    </Text>
                  </View>
                ) : (
                  <View style={styles.activityModalList}>
                    {activities.map((activity, index) => (
                      <View key={index} style={styles.activityModalItem}>
                        <View style={styles.activityModalIcon}>
                          <Text style={styles.activityModalIconText}>
                            {activity.action === 'added' ? '➕' : 
                             activity.action === 'completed' ? '✅' : 
                             activity.action === 'deleted' ? '🗑️' : '📝'}
                          </Text>
                        </View>
                        <View style={styles.activityModalContent}>
                          <Text style={styles.activityModalText}>
                            <Text style={styles.activityModalUser}>{activity.user_name}</Text>
                            {' '}{activity.action} {activity.item_name}
                          </Text>
                          <Text style={styles.activityModalTime}>
                            {new Date(activity.created_at).toLocaleString()}
                          </Text>
                          {activity.details && (
                            <Text style={styles.activityModalDetails}>{activity.details}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bottom Spacing */}
                <View style={styles.activityModalBottomSpacing} />
              </ScrollView>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#2C2C2E',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8E8E93',
    letterSpacing: 0.1,
    marginTop: 2,
  },

  // Stats
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 36,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.3,
    lineHeight: 26,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A3A3C',
    marginBottom: 16,
    marginTop: 4,
    letterSpacing: 1.2,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addItemButtonInline: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  addItemButtonText: {
    fontSize: 22,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 22,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  inviteButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteButtonGradient: {
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Share Code
  shareCodeContainer: {
    marginBottom: 8,
  },
  shareCodeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  shareCodeInfo: {
    flex: 1,
  },
  shareCodeLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  shareCodeValue: {
    fontSize: 22,
    fontWeight: '500',
    color: '#6A9571',
    letterSpacing: 2.5,
  },
  copyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  copyButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Collaborators
  collaboratorsContainer: {
    gap: 10,
    paddingTop: 2,
  },
  collaboratorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  collaboratorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  collaboratorAvatarText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  collaboratorRole: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    letterSpacing: 0.1,
  },
  statusIndicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    shadowColor: '#6BCF7F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },

  // Filters
  filterSection: {
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: '#6A9571',
    borderColor: '#6A9571',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#3A3A3C',
    letterSpacing: 0.2,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Items
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  itemCardCompleted: {
    backgroundColor: 'rgba(107, 207, 127, 0.08)',
    borderColor: 'rgba(107, 207, 127, 0.2)',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxCompleted: {
    backgroundColor: '#6BCF7F',
    borderColor: '#6BCF7F',
    shadowColor: '#6BCF7F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  checkmark: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 8,
    flexWrap: 'wrap',
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  itemNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
    opacity: 0.6,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    flexShrink: 0,
    letterSpacing: 0.1,
  },
  itemCategory: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  
  // Category Sections
  categorySection: {
    marginBottom: 18,
  },
  categoryHeader: {
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryHeaderIcon: {
    fontSize: 12,
    color: '#6A9571',
    fontWeight: '500',
    width: 16,
  },
  categoryHeaderTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1C1C1E',
    flex: 1,
    letterSpacing: -0.2,
  },
  categoryBadge: {
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6A9571',
    letterSpacing: 0.2,
  },
  categoryCompletedBadge: {
    backgroundColor: 'rgba(107, 207, 127, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  categoryCompletedBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6BCF7F',
    letterSpacing: 0.2,
  },
  itemAddedBy: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  itemNotes: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
    flexWrap: 'wrap',
    letterSpacing: 0.1,
    lineHeight: 18,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  modalContent: {
    padding: 20,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  modalHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  modalItemName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    marginTop: 8,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // Edit Modal Styles (Glassmorphic)
  editModalContainer: {
    flex: 1,
  },
  editModalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editModalScroll: {
    flex: 1,
  },
  editModalScrollContent: {
    paddingHorizontal: 20,
  },
  editModalHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  editModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  editModalCloseText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '500',
  },
  editModalItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  editModalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  editModalItemSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8E8E93',
    textAlign: 'center',
  },
  editModalItemName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  editModalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editModalItemCategory: {
    fontSize: 14,
    color: '#6A9571',
    fontWeight: '500',
  },
  editModalItemDot: {
    fontSize: 14,
    color: '#8E8E93',
    marginHorizontal: 8,
  },
  editModalItemAddedBy: {
    fontSize: 14,
    color: '#8E8E93',
  },
  editModalSection: {
    marginBottom: 28,
  },
  editModalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 12,
  },
  editModalInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  editModalTextAreaCard: {
    minHeight: 120,
  },
  editModalInput: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  editModalTextArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  editModalHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
  },
  editModalActions: {
    marginTop: 16,
    gap: 12,
  },
  editModalSaveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  editModalSaveGradient: {
    padding: 18,
    alignItems: 'center',
  },
  editModalSaveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  editModalSaveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  editModalBottomSpacing: {
    height: 40,
  },

  // Quantity Input Styles - Numeric Keyboard
  editModalQuantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 20,
  },
  editModalQuantityInputWrapper: {
    flex: 1,
    maxWidth: 120,
  },
  editModalQuantityInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  editModalUnitSection: {
    flex: 1,
    alignItems: 'center',
  },
  editModalUnitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  editModalUnitDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    minWidth: 100,
    alignItems: 'center',
  },
  editModalUnitDisplayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6A9571',
  },
  editModalAutoDetected: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Add Item Modal - Redesigned Styles
  addItemTitleSection: {
    marginBottom: 32,
    paddingTop: 8,
  },
  addItemMainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  addItemSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8E8E93',
    lineHeight: 20,
  },
  itemNameDisplaySection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  itemNameDisplayTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  itemNameDisplayUnit: {
    fontSize: 14,
    color: '#8E8E93',
  },
  addItemSection: {
    marginBottom: 28,
  },
  addItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  addItemOptional: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  addItemInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemInput: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '500',
    padding: 0,
  },
  addItemCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  addItemCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
  },
  addItemQuantityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addItemQuantityInput: {
    flex: 1,
    backgroundColor: 'rgba(106, 149, 113, 0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemUnitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 90,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemUnitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  addItemNotesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  addItemNotesInput: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '400',
    minHeight: 88,
    textAlignVertical: 'top',
    padding: 0,
  },
  addItemActions: {
    marginTop: 8,
  },
  addItemButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  addItemButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Unit Picker Modal Styles - Matching Pantry Section
  unitPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  // Unit Picker Inside Edit Modal - Appears on top
  unitPickerOverlayInside: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  unitPickerOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  unitPickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  unitPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  unitPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  unitPickerCloseButton: {
    padding: 4,
  },
  unitPickerScroll: {
    maxHeight: 400,
  },
  unitPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  unitPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(106, 149, 113, 0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
    gap: 8,
  },
  unitPickerItemSelected: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderColor: '#6A9571',
  },
  unitPickerItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  unitPickerItemTextSelected: {
    color: '#6A9571',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
  },

  // Bottom Spacing
  bottomSpacing: {
    height: 100,
  },
  
  // AI Category Hint
  aiCategoryHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
    marginTop: 8,
    marginLeft: 4,
  },
  
  

  // Invite Modal
  inviteModalContainer: {
    flex: 1,
  },
  inviteModalGradient: {
    flex: 1,
  },
  inviteModalContent: {
    flex: 1,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  inviteModalCloseButton: {
    padding: 8,
  },
  inviteModalCloseText: {
    fontSize: 20,
    color: '#8E8E93',
  },
  inviteModalScroll: {
    flex: 1,
  },
  inviteModalSection: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inviteModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  inviteModalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 8,
  },
  inviteModalTopSpacing: {
    height: 40,
  },
  inviteModalIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  inviteModalIcon: {
    fontSize: 48,
  },
  inviteModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 16,
  },
  inviteModalInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteModalInput: {
    fontSize: 16,
    color: '#1C1C1E',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  inviteModalRoleContainer: {
    gap: 12,
  },
  inviteModalRoleOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteModalRoleSelected: {
    borderColor: '#6A9571',
    backgroundColor: 'rgba(106, 149, 113, 0.05)',
  },
  inviteModalRoleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  inviteModalRoleTextSelected: {
    color: '#6A9571',
  },
  inviteModalRoleDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  inviteModalActions: {
    marginTop: 32,
    gap: 16,
    paddingHorizontal: 20,
  },
  inviteModalSendButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  inviteModalSendGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  inviteModalSendText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteModalCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  inviteModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  inviteModalBottomSpacing: {
    height: 100,
  },

  // Activity Feed
  activityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  activityContainer: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 2,
  },
  activityUser: {
    fontWeight: '600',
    color: '#6A9571',
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyActivityText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Activity Modal
  activityModalContainer: {
    flex: 1,
  },
  activityModalGradient: {
    flex: 1,
  },
  activityModalContent: {
    flex: 1,
    paddingTop: 60,
  },
  activityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  activityModalCloseButton: {
    padding: 8,
  },
  activityModalCloseText: {
    fontSize: 20,
    color: '#8E8E93',
  },
  activityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
    marginLeft: -36,
  },
  activityModalHeaderSpacer: {
    width: 36,
  },
  activityModalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyActivityModal: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyActivityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyActivityModalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  activityModalList: {
    gap: 12,
  },
  activityModalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  activityModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityModalIconText: {
    fontSize: 18,
  },
  activityModalText: {
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 22,
  },
  activityModalUser: {
    fontWeight: '600',
    color: '#6A9571',
  },
  activityModalTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  activityModalDetails: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  activityModalBottomSpacing: {
    height: 100,
  },

  // Share Code Modal Styles
  shareCodeModalContainer: {
    flex: 1,
  },
  shareCodeModalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shareCodeModalContent: {
    flex: 1,
  },
  shareCodeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  shareCodeModalCloseButton: {
    padding: 8,
  },
  shareCodeModalCloseText: {
    fontSize: 20,
    color: '#8E8E93',
  },
  shareCodeModalScroll: {
    flex: 1,
  },
  shareCodeModalTopSpacing: {
    height: 40,
  },
  shareCodeModalIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  shareCodeModalIcon: {
    fontSize: 64,
  },
  shareCodeModalTitleContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  shareCodeModalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  shareCodeModalSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  shareCodeModalCodeSection: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  shareCodeModalCodeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  shareCodeModalCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  shareCodeModalCodeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#6A9571',
    letterSpacing: 3,
  },
  shareCodeModalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    textAlign: 'center',
  },
  shareCodeModalActions: {
    gap: 16,
    paddingHorizontal: 20,
  },
  shareCodeModalShareButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shareCodeModalShareGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  shareCodeModalShareText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareCodeModalCopyButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  shareCodeModalCopyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  shareCodeModalCancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareCodeModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  shareCodeModalBottomSpacing: {
    height: 100,
  },
})
