// SAVR Lists - Clean Modern Minimal Grocery Lists
import React, { useState, useEffect } from 'react'
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
  Animated,
  PanResponder
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useListsUnified } from '../../lib/useListsUnified'
// import { useCollaborativeLists } from '../../lib/CollaborativeListsContext' // Using useListsUnified instead
import SageAssistant from '../../components/SageAssistantV2'
import * as Haptics from 'expo-haptics'
import {
  scaleSize,
  scaleWidth,
  responsivePadding,
  responsiveFonts,
  responsiveSpacing,
  getResponsiveDimensions,
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

// Swipeable List Item Component
interface SwipeableListItemProps {
  children: React.ReactNode
  onDelete: () => void
}

function SwipeableListItem({ children, onDelete }: SwipeableListItemProps) {
  const translateX = useState(new Animated.Value(0))[0]
  
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to horizontal swipes - lower threshold for easier activation
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5
    },
    onPanResponderMove: (_, gestureState) => {
      // Allow swiping left (negative values) and right (positive values) but limit range
      const newValue = Math.max(Math.min(gestureState.dx, 0), -100)
      translateX.setValue(newValue)
    },
    onPanResponderRelease: (_, gestureState) => {
      // Get current position
      const currentValue = (translateX as any)._value || 0
      
      if (gestureState.dx < -30 && currentValue > -50) {
        // Swiping left - show delete button (lowered threshold from -50 to -30)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        Animated.spring(translateX, {
          toValue: -100,
          useNativeDriver: false,
          friction: 5,
          tension: 50,
        }).start()
      } else if (gestureState.dx > 30 && currentValue < -50) {
        // Swiping right from open state - close delete button (lowered threshold)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: false,
          friction: 5,
          tension: 50,
        }).start()
      } else if (currentValue < -40) {
        // Currently open, small movement - stay open (lowered threshold)
        Animated.spring(translateX, {
          toValue: -100,
          useNativeDriver: false,
          friction: 5,
          tension: 50,
        }).start()
      } else {
        // Return to closed position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: false,
          friction: 5,
          tension: 50,
        }).start()
      }
    },
  })
  
  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onDelete()
  }
  
  return (
    <View style={styles.swipeableContainer}>
      {/* Delete Button (behind) */}
      <View style={styles.deleteButtonBehind}>
        <Pressable
          style={styles.deleteButtonPressable}
          onPress={handleDeletePress}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
      
      {/* Swipeable Content - sits on top */}
      <Animated.View
        style={[
          styles.swipeableContent,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.swipeableBackground}>
          {children}
        </View>
      </Animated.View>
    </View>
  )
}

// Sample grocery lists
const SAMPLE_LISTS = [
  {
    id: '1',
    name: 'Weekly Groceries',
    itemCount: 12,
    completedCount: 8,
    color: '#E8F5E8',
    icon: '🛒',
    lastUpdated: '2 hours ago'
  },
  {
    id: '2',
    name: 'Dinner Party',
    itemCount: 8,
    completedCount: 3,
    color: '#E3F2FD',
    icon: '🍽️',
    lastUpdated: 'Yesterday'
  },
  {
    id: '3',
    name: 'Healthy Snacks',
    itemCount: 6,
    completedCount: 6,
    color: '#F3E5AB',
    icon: '🥗',
    lastUpdated: '3 days ago'
  },
  {
    id: '4',
    name: 'Weekend BBQ',
    itemCount: 15,
    completedCount: 2,
    color: '#FFEBEE',
    icon: '🔥',
    lastUpdated: '1 week ago'
  }
]

export default function ListsScreen() {
  const { progressiveTheme } = useSimpleTheme()
  const router = useRouter()
  const params = useLocalSearchParams()
  const { lists, addList: addListFn, deleteList, addItemToList, joinListByCode } = useListsUnified()
  
  const addList = (nameOrList: string | any, icon?: string) => {
    addListFn(nameOrList, icon)
  }
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListIcon, setNewListIcon] = useState('🛒')
  const [joinCode, setJoinCode] = useState('')

  // Handle URL parameter to open new list modal
  useEffect(() => {
    if (params.openNewList === 'true') {
      console.log('🎯 Opening new list modal from dashboard')
      setShowAddModal(true)
    }
  }, [params.openNewList])

  const handleListPress = (listId: string, listName: string) => {
    console.log(`List pressed: ${listName} (ID: ${listId})`)
    
    // Add haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // Navigate to list detail screen
    router.push(`/list-detail?id=${listId}`)
  }
  
  const handleAddList = () => {
    if (newListName.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      addList(newListName.trim(), newListIcon)
      
      setNewListName('')
      setNewListIcon('🛒')
      setShowAddModal(false)
      
      Alert.alert('List Created', `"${newListName}" has been created!`)
    }
  }

  const handleJoinList = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Code Required', 'Please enter a share code.')
      return
    }

    try {
      if (!joinListByCode) {
        Alert.alert('Error', 'Join list feature is not available')
        return
      }
      
      const result = await joinListByCode(joinCode.trim())
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'You have joined the list successfully!',
          [{ text: 'OK', onPress: () => setShowJoinModal(false) }]
        )
        setJoinCode('')
      } else {
        Alert.alert('Error', result.error || 'Failed to join list. Please check the code.')
      }
    } catch (error) {
      console.error('Error joining list:', error)
      Alert.alert('Error', 'Failed to join list. Please try again.')
    }
  }
  
  const handleDeleteList = (listId: string, listName: string, isOwner?: boolean) => {
    if (isOwner === false) {
      Alert.alert('Cannot Delete', 'Only the list owner can delete this list.')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${listName}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteList(listId)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          },
        },
      ]
    )
  }
  
  const handleVoiceListCommand = (action: 'add', itemName: string, listName: string, quantity: number) => {
    // Find list by name (fuzzy match)
    const foundList = lists.find(list => 
      list.name.toLowerCase().includes(listName.toLowerCase()) ||
      listName.toLowerCase().includes(list.name.toLowerCase())
    )
    
    if (foundList) {
      addItemToList(foundList.id, {
        name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
        category: 'Grocery',
        quantity: `${quantity} pieces`,
        notes: 'Added via voice'
      })
    } else {
      Alert.alert(
        'List Not Found',
        `Could not find a list matching "${listName}"`,
        [{ text: 'OK' }]
      )
    }
  }

  // Clean Modern Minimal Lists Layout
  if (progressiveTheme === 'warm') {
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
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Clean & Minimal */}
          <View style={styles.header}>
            <View>
              <Text style={styles.cleanAppTitle}>SAVR</Text>
              <Text style={styles.headerSubtitle}>
                {lists.length} {lists.length === 1 ? 'list' : 'lists'} • {lists.reduce((sum, list) => sum + list.itemCount, 0)} items
              </Text>
            </View>
            <View style={styles.headerButtons}>
              <Pressable 
                style={styles.joinListButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowJoinModal(true)
                }}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.joinListGradient}
                >
                  <Text style={styles.joinListText}>Join</Text>
                </LinearGradient>
              </Pressable>
              <Pressable 
                style={styles.newListButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowAddModal(true)
                }}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.newListGradient}
                >
                  <Text style={styles.newListText}>+ New</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* Grocery Lists - Compact */}
          <View style={styles.listsContainer}>
            {lists.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyTitle}>No Lists Yet</Text>
                <Text style={styles.emptySubtitle}>Create your first grocery list</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.createFirstListButton,
                    pressed && styles.createFirstListButtonPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setShowAddModal(true)
                  }}
                >
                  <LinearGradient
                    colors={['#5A8A6A', '#6A9571', '#7BA67D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.createFirstListGradient}
                  >
                    <Text style={styles.createFirstListText}>+ Create Your First List</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              lists.map((list) => (
                <Pressable
                  key={list.id}
                  style={styles.compactListCard}
                  onPress={() => handleListPress(list.id, list.name)}
                  onLongPress={() => handleDeleteList(list.id, list.name, list.isOwner)}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.compactListGradient}
                  >
                    <View style={styles.compactListHeader}>
                      <View style={styles.compactListLeft}>
                        <Text style={styles.compactListIcon}>{list.icon}</Text>
                        <View style={styles.compactListInfo}>
                          <Text style={styles.compactListName}>{list.name}</Text>
                          <Text style={styles.compactListMeta}>
                            {list.completedCount}/{list.itemCount} items • {list.itemCount > 0 ? Math.round((list.completedCount / list.itemCount) * 100) : 0}%
                          </Text>
                        </View>
                      </View>
                      <View style={styles.compactListRight}>
                        <View style={styles.circularProgress}>
                          <Text 
                            style={styles.circularProgressText}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.7}
                          >
                            {list.itemCount > 0 ? Math.round((list.completedCount / list.itemCount) * 100) : 0}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              ))
            )}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.cleanBottomSpacing} />
        </ScrollView>
        
        {/* SAGE Assistant */}
        <SageAssistant 
          onListCommand={handleVoiceListCommand}
        />
        
        {/* Add List Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#FEFCF6', '#E9F1EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            />
            <LinearGradient
              colors={['rgba(106, 149, 113, 0.25)', 'transparent', 'transparent']}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGlassmorphicOverlay}
            />
            
            {/* Modal Header - Outside ScrollView for better touch handling */}
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowAddModal(false)
                  setNewListName('')
                  setNewListIcon('🛒')
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Create New List</Text>
            </View>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>

              {/* List Name Section */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>LIST NAME</Text>
                <View style={styles.modalInputCard}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Weekly Groceries"
                    placeholderTextColor="#8E8E93"
                    value={newListName}
                    onChangeText={setNewListName}
                    autoFocus
                  />
                </View>
              </View>

              {/* Icon Selection Section */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>CHOOSE ICON</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.iconScrollContainer}
                  contentContainerStyle={styles.iconScrollContent}
                >
                  {[
                    // Basic Shopping & Categories
                    '🛒', '🏪', '📝', '📋', '✅',
                    
                    // Meal Types & Occasions
                    '🍽️', '🥗', '🍳', '🍕', '🍔', '🌮', '🍝', '🍜', '🥘', '🍲',
                    
                    // Food Categories
                    '🥕', '🍎', '🥑', '🍞', '🥛', '🧀', '🥚', '🍗', '🐟', '🍓',
                    
                    // Special Occasions & Events
                    '🎂', '🎉', '🏠', '👶', '💊', '🧴', '🧽', '🌿', '☕', '🍪'
                  ].map((icon) => (
                    <Pressable
                      key={icon}
                      style={[
                        styles.iconOptionHorizontal,
                        newListIcon === icon && styles.iconOptionSelected
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setNewListIcon(icon)
                      }}
                    >
                      <Text style={styles.iconOptionText}>{icon}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              
              {/* Actions */}
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowAddModal(false)
                    setNewListName('')
                    setNewListIcon('🛒')
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalCreateButton]}
                  onPress={handleAddList}
                >
                  <Text style={styles.modalCreateButtonText}>Create List</Text>
                </Pressable>
              </View>
              
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </Modal>

        {/* Join List Modal */}
        <Modal
          visible={showJoinModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowJoinModal(false)}
        >
          <View style={styles.joinModalContainer}>
            <LinearGradient
              colors={['#FEFCF6', '#E9F1EB']}
              start={{ x: 0.3, y: 0.3 }}
              end={{ x: 1, y: 1 }}
              style={styles.joinModalGradient}
            >
              
            {/* Modal Header - Outside ScrollView for better touch handling */}
            <View style={styles.joinModalHeader}>
              <Pressable
                style={styles.joinModalCloseButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowJoinModal(false)
                  setJoinCode('')
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.joinModalCloseText}>✕</Text>
              </Pressable>
              <Text style={styles.joinModalTitle}>Join List</Text>
            </View>
            
            <ScrollView style={styles.joinModalScroll} showsVerticalScrollIndicator={false}>
              {/* Join Code Input */}
              <View style={styles.joinModalSection}>
                <Text style={styles.joinModalLabel}>Share Code</Text>
                <View style={styles.joinModalInputContainer}>
                  <TextInput
                    style={styles.joinModalInput}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="Enter share code"
                    placeholderTextColor="#8E8E93"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
                <Text style={styles.joinModalHint}>
                  Ask the list owner for the share code
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.joinModalActions}>
                <Pressable 
                  style={styles.joinModalJoinButton}
                  onPress={handleJoinList}
                >
                  <LinearGradient
                    colors={['#6A9571', '#8AB896']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.joinModalJoinGradient}
                  >
                    <Text style={styles.joinModalJoinText}>Join List</Text>
                  </LinearGradient>
                </Pressable>
                
                <Pressable 
                  style={styles.joinModalCancelButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowJoinModal(false)
                    setJoinCode('')
                  }}
                >
                  <Text style={styles.joinModalCancelText}>Cancel</Text>
                </Pressable>
              </View>
              
              {/* Bottom Spacing */}
              <View style={styles.joinModalBottomSpacing} />
            </ScrollView>
            </LinearGradient>
          </View>
        </Modal>
      </View>
    )
  }

  // Default SAVR Lists Layout (fallback)
  return (
    <View style={styles.defaultContainer}>
      <ExpoStatusBar style="dark" />
      <View style={styles.defaultContent}>
        <Text style={styles.defaultTitle}>Lists</Text>
        <Text style={styles.defaultSubtitle}>Your grocery lists</Text>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Clean Modern Minimal Lists Styles
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

  // Header Styles
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsivePadding.lg,
    paddingTop: (responsiveDims.isSmallScreen ? scaleSize(50) : scaleSize(60)) + 20,
    paddingBottom: responsiveSpacing.lg,
  },
  cleanAppTitle: {
    fontSize: responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.xs,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  cleanHeaderButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  cleanHeaderButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cleanHeaderButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cleanHeaderButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.3,
  },
  cleanHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanAddIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: responsivePadding.xl,
    paddingTop: (responsiveDims.isSmallScreen ? scaleSize(50) : scaleSize(60)) + 20,
    paddingBottom: responsiveSpacing.xxl,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  headerSubtitle: {
    fontSize: responsiveFonts.md,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  joinListButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  joinListGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  joinListText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newListButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newListGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  newListText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  
  // Lists Container
  listsContainer: {
    paddingHorizontal: 28,
    paddingTop: 40,
    gap: 12,
    marginBottom: 40,
  },
  
  // Compact List Cards
  compactListCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  compactListGradient: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  compactListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  compactListIcon: {
    fontSize: 32,
  },
  compactListInfo: {
    flex: 1,
  },
  compactListName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  compactListMeta: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.1,
  },
  compactListRight: {
    marginLeft: 12,
  },
  circularProgress: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(106, 149, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6A9571',
  },
  circularProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A9571',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  createFirstListButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  createFirstListGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFirstListButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  createFirstListText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  
  // Old Stats Section (removed)
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6A9571',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Lists Section
  listsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  listCardPressed: {
    backgroundColor: '#F8F8F8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    transform: [{ scale: 0.98 }],
  },
  listIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listEmoji: {
    fontSize: 24,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  listProgress: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  listUpdated: {
    fontSize: 12,
    color: '#C7C7CC',
  },
  listProgressBar: {
    alignItems: 'flex-end',
    width: 60,
  },
  progressBackground: {
    width: '100%',
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },

  // Swipeable List Item Styles
  swipeableContainer: {
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
  },
  deleteButtonBehind: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteButtonPressable: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swipeableContent: {
    position: 'relative',
    width: '100%',
    zIndex: 2,
  },
  swipeableBackground: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },

  // Add List Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalGlassmorphicOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  modalSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  modalInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  modalInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    padding: 0,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconScrollContainer: {
    marginHorizontal: -4,
  },
  iconScrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  iconOption: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionHorizontal: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 12,
  },
  iconOptionSelected: {
    backgroundColor: 'rgba(106, 149, 113, 0.2)',
    borderColor: '#6A9571',
    shadowColor: '#6A9571',
    shadowOpacity: 0.2,
  },
  iconOptionText: {
    fontSize: 28,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  modalCreateButton: {
    backgroundColor: '#6A9571',
    shadowColor: '#6A9571',
    shadowOpacity: 0.3,
  },
  modalCreateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBottomSpacing: {
    height: 60,
  },

  // Default Styles (fallback)
  defaultContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  defaultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  defaultTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  defaultSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },

  // Join Modal Styles
  joinModalContainer: {
    flex: 1,
  },
  joinModalGradient: {
    flex: 1,
  },
  joinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  joinModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  joinModalCloseText: {
    fontSize: 24,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  joinModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
    marginLeft: -36,
  },
  joinModalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  joinModalSection: {
    marginBottom: 24,
  },
  joinModalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  joinModalInputContainer: {
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
  joinModalInput: {
    fontSize: 16,
    color: '#1C1C1E',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  joinModalHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  joinModalActions: {
    marginTop: 32,
    gap: 12,
  },
  joinModalJoinButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinModalJoinGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  joinModalJoinText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  joinModalCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  joinModalBottomSpacing: {
    height: 100,
  },
})
