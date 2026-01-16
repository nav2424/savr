// SAVR Collaborative Lists Context - Real-time list management with Supabase
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { collaborativeListsService } from './CollaborativeListsService'
import { recategorizeItem } from './ItemCategorizer'
import { List, ListItem as SupabaseListItem, Collaborator, Activity } from './supabase'
import { useAuth } from './AuthContext'

// Local list item interface (matches existing app structure)
export interface ListItem {
  id: string
  name: string
  category: string
  quantity: string
  completed: boolean
  addedBy: string
  addedDate: string
  notes?: string
}

export interface ListData {
  id: string
  name: string
  icon: string
  color: string
  itemCount: number
  completedCount: number
  items: ListItem[]
  shareCode?: string
  collaborators?: Collaborator[]
  isOwner?: boolean
  userRole?: 'owner' | 'editor' | 'viewer'
}

interface CollaborativeListsContextType {
  lists: ListData[]
  loading: boolean
  addList: (name: string, icon: string) => Promise<void>
  deleteList: (listId: string) => Promise<void>
  addItemToList: (listId: string, item: Omit<ListItem, 'id' | 'completed' | 'addedBy' | 'addedDate'>) => Promise<void>
  deleteItemFromList: (listId: string, itemId: string) => Promise<void>
  updateListItem: (listId: string, itemId: string, updates: Partial<ListItem>) => Promise<void>
  toggleItemCompletion: (listId: string, itemId: string) => Promise<void>
  joinListByCode: (shareCode: string) => Promise<{ success: boolean; error?: string }>
  getListCollaborators: (listId: string) => Promise<Collaborator[]>
  getListActivity: (listId: string) => Promise<Activity[]>
  inviteCollaborator: (listId: string, email: string, role: 'editor' | 'viewer') => Promise<{ success: boolean; error?: string }>
  removeCollaborator: (collaboratorId: string) => Promise<{ error?: any }>
  ensureSubscription: (listId: string) => void
}

const CollaborativeListsContext = createContext<CollaborativeListsContextType | undefined>(undefined)

export function CollaborativeListsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [lists, setLists] = useState<ListData[]>([])
  const [loading, setLoading] = useState(true)

  // Load user's lists when authenticated
  useEffect(() => {
    if (user) {
      loadLists()
    } else {
      setLists([])
      setLoading(false)
    }
  }, [user])

  const loadLists = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data: listsData, error } = await collaborativeListsService.getUserLists()
      
      if (error) {
        console.error('Error loading lists:', error)
        return
      }

      if (listsData) {
        // Load items and collaborators for each list in parallel
        const listsWithItems = await Promise.all(
          listsData.map(async (list: List) => {
            // Fetch items and collaborators in parallel
            const [itemsResult, collaboratorsResult] = await Promise.all([
              collaborativeListsService.getListItems(list.id),
              collaborativeListsService.getListCollaborators(list.id)
            ])
            
            const listItems: ListItem[] = (itemsResult.data || []).map((item: SupabaseListItem) => {
              // Recategorize items with incorrect categories (like "Recipe Ingredient", "Ingredients", etc.)
              const correctCategory = recategorizeItem(item.name, item.category || 'Groceries')
              
              // If category changed, update it in the database (async, non-blocking)
              if (correctCategory !== item.category && item.category) {
                collaborativeListsService.updateItem(item.id, { category: correctCategory }).catch(err => {
                  console.error('Error updating item category:', err)
                })
              }
              
              return {
                id: item.id,
                name: item.name,
                category: correctCategory,
                quantity: item.quantity,
                completed: item.completed,
                addedBy: item.added_by_name,
                addedDate: item.added_date,
                notes: item.notes,
              }
            })

            const completedCount = listItems.filter(item => item.completed).length

            return {
              id: list.id,
              name: list.name,
              icon: list.icon,
              color: list.color,
              itemCount: listItems.length,
              completedCount,
              items: listItems,
              shareCode: list.share_code,
              collaborators: collaboratorsResult.data || [],
              isOwner: list.owner_id === user.id,
              userRole: list.owner_id === user.id ? 'owner' as const : 'editor' as const,
            }
          })
        )

        setLists(listsWithItems)
        
        // Subscribe to real-time updates for each list
        console.log(`🔔 Setting up real-time subscriptions for ${listsWithItems.length} lists`)
        listsWithItems.forEach(list => {
          subscribeToList(list.id)
        })
        console.log(`✅ All real-time subscriptions set up`)
      }
    } catch (error) {
      console.error('Error loading lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToList = (listId: string) => {
    // Unsubscribe from existing subscription if any
    collaborativeListsService.unsubscribeFromList(listId)
    
    console.log(`🔔 Setting up real-time subscription for list: ${listId}`)
    
    collaborativeListsService.subscribeToList(listId, {
      onItemAdded: (item) => {
        console.log(`📥 Real-time: Item added to list ${listId}:`, item.name)
        setLists(prev => prev.map(list => {
          if (list.id === listId) {
            // Check if item already exists by ID (from optimistic update)
            const existingById = list.items.find(i => i.id === item.id)
            if (existingById) {
              // Item already exists with this ID, skip
              console.log(`⏭️ Item ${item.name} already exists, skipping duplicate`)
              return list
            }

            // Check for temp item with same name (optimistic update to replace)
            const tempItemIndex = list.items.findIndex(i => 
              i.id.startsWith('temp-') &&
              i.name.toLowerCase().trim() === item.name.toLowerCase().trim()
            )
            if (tempItemIndex !== -1) {
              // Replace temp item with real one from database
              console.log(`🔄 Replacing temp item with real item: ${item.name}`)
              const updatedItems = [...list.items]
              updatedItems[tempItemIndex] = {
                id: item.id,
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                completed: item.completed,
                addedBy: item.added_by_name,
                addedDate: item.added_date,
                notes: item.notes,
              }
              return {
                ...list,
                items: updatedItems,
                itemCount: updatedItems.length,
              }
            }

            // Check for duplicate by name (prevent duplicates from real-time)
            const duplicateByName = list.items.find(i => 
              i.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
              !i.id.startsWith('temp-')
            )
            if (duplicateByName) {
              // Duplicate detected, skip adding
              console.log('⚠️ Duplicate item detected from real-time, skipping:', item.name)
              return list
            }

            // New item from another user - add it INSTANTLY
            console.log(`✨ Adding new item from another user: ${item.name} (added by ${item.added_by_name})`)
            const newItem: ListItem = {
              id: item.id,
              name: item.name,
              category: item.category,
              quantity: item.quantity,
              completed: item.completed,
              addedBy: item.added_by_name,
              addedDate: item.added_date,
              notes: item.notes,
            }
            const newItems = [...list.items, newItem]
            return {
              ...list,
              items: newItems,
              itemCount: newItems.length,
            }
          }
          return list
        }))
      },
      onItemUpdated: (item) => {
        console.log(`📝 Real-time: Item updated in list ${listId}:`, item.name)
        setLists(prev => prev.map(list => {
          if (list.id === listId) {
            const updatedItems = list.items.map(i => {
              if (i.id === item.id) {
                return {
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  quantity: item.quantity,
                  completed: item.completed,
                  addedBy: item.added_by_name,
                  addedDate: item.added_date,
                  notes: item.notes,
                }
              }
              return i
            })
            const completedCount = updatedItems.filter(i => i.completed).length
            return {
              ...list,
              items: updatedItems,
              completedCount,
            }
          }
          return list
        }))
      },
      onItemDeleted: (itemId) => {
        console.log(`🗑️ Real-time: Item deleted from list ${listId}:`, itemId)
        setLists(prev => prev.map(list => {
          if (list.id === listId) {
            const updatedItems = list.items.filter(i => i.id !== itemId)
            const completedCount = updatedItems.filter(i => i.completed).length
            return {
              ...list,
              items: updatedItems,
              itemCount: updatedItems.length,
              completedCount,
            }
          }
          return list
        }))
      },
    })
    
    console.log(`✅ Real-time subscription active for list: ${listId}`)
  }

  const addList = async (name: string, icon: string) => {
    if (!user) return

    // Optimistic update - create list IMMEDIATELY with temp ID
    const tempId = `temp-list-${Date.now()}`
    const optimisticList: ListData = {
      id: tempId,
      name,
      icon,
      color: '#E8F5E8',
      itemCount: 0,
      completedCount: 0,
      items: [],
      shareCode: undefined,
      collaborators: [],
      isOwner: true,
      userRole: 'owner',
    }
    
    // Add to UI IMMEDIATELY (synchronous)
    setLists(prev => [optimisticList, ...prev])

    // Create in database (non-blocking, happens in background)
    const { data, error } = await collaborativeListsService.createList(name, icon)
    if (error) {
      console.error('Error creating list:', error)
      // Rollback on error
      setLists(prev => prev.filter(l => l.id !== tempId))
      return
    }

    if (data) {
      const newList: ListData = {
        id: data.id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        itemCount: 0,
        completedCount: 0,
        items: [],
        shareCode: data.share_code,
        collaborators: [],
        isOwner: true,
        userRole: 'owner',
      }
      // Replace temp list with real one INSTANTLY
      setLists(prev => prev.map(l => l.id === tempId ? newList : l))
      // Set up real-time subscription for the new list
      subscribeToList(data.id)
    }
  }

  const deleteList = async (listId: string) => {
    // Optimistic update - IMMEDIATELY remove from UI (synchronous)
    collaborativeListsService.unsubscribeFromList(listId)
    setLists(prev => prev.filter(list => list.id !== listId))

    // Delete in database (non-blocking, happens in background)
    const { error } = await collaborativeListsService.deleteList(listId)
    if (error) {
      console.error('Error deleting list:', error)
      // On error, reload lists to restore
      loadLists()
      return
    }
  }

  const addItemToList = async (
    listId: string,
    item: Omit<ListItem, 'id' | 'completed' | 'addedBy' | 'addedDate'>
  ) => {
    // Check for duplicates FIRST
    const targetList = lists.find(l => l.id === listId)
    if (targetList) {
      const isDuplicate = targetList.items.some(existingItem => 
        existingItem.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      )
      
      if (isDuplicate) {
        // Show alert and return early - DO NOT add duplicate
        const { Alert } = await import('react-native')
        Alert.alert(
          'Already in List',
          `"${item.name}" is already in your list`,
          [{ text: 'OK' }]
        )
        return
      }
    }
    
    // Optimistic update - IMMEDIATELY update UI (synchronous)
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimisticItem: ListItem = {
      id: tempId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      notes: item.notes,
      completed: false,
      addedBy: 'You',
      addedDate: new Date().toISOString().split('T')[0],
    }

    // Use functional update to ensure we get the latest state
    setLists(prev => {
      const updated = prev.map(list => {
        if (list.id === listId) {
          const newItems = [...list.items, optimisticItem]
          return {
            ...list,
            items: newItems,
            itemCount: newItems.length,
            completedCount: newItems.filter(i => i.completed).length,
          }
        }
        return list
      })
      return updated
    })

    // Ensure category is always provided (use AI-detected or default)
    const categoryToUse = item.category || 'Groceries'
    console.log('🎯 Adding item to list:', { name: item.name, category: categoryToUse })
    
    const { error, data } = await collaborativeListsService.addItem(listId, {
      name: item.name,
      category: categoryToUse,
      quantity: item.quantity,
      notes: item.notes,
      completed: false,
      added_date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      console.error('Error adding item:', error)
      // Rollback optimistic update on error
      setLists(prev => prev.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            items: list.items.filter(i => i.id !== tempId),
            itemCount: list.items.length - 1,
          }
        }
        return list
      }))
    } else if (data) {
      // Replace temp item with real one - INSTANT update
      setLists(prev => prev.map(list => {
        if (list.id === listId) {
          const updatedItems = list.items.map(i => 
            i.id === tempId ? {
              id: data.id,
              name: data.name,
              category: data.category,
              quantity: data.quantity,
              completed: data.completed,
              addedBy: data.added_by_name,
              addedDate: data.added_date,
              notes: data.notes,
            } : i
          )
          return {
            ...list,
            items: updatedItems,
            itemCount: updatedItems.length,
          }
        }
        return list
      }))
    }
  }

  const updateListItem = async (listId: string, itemId: string, updates: Partial<ListItem>) => {
    // Store original item for rollback
    const originalItem = lists.find(l => l.id === listId)?.items.find(i => i.id === itemId)
    
    // Optimistic update - IMMEDIATELY update UI (synchronous)
    setLists(prev => {
      return prev.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            items: list.items.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            ),
          }
        }
        return list
      })
    })

    const { error } = await collaborativeListsService.updateItem(itemId, {
      name: updates.name,
      quantity: updates.quantity,
      notes: updates.notes,
    })

    if (error) {
      console.error('Error updating item:', error)
      // Rollback on error
      if (originalItem) {
        setLists(prev => prev.map(list => {
          if (list.id === listId) {
            return {
              ...list,
              items: list.items.map(item => 
                item.id === itemId ? originalItem : item
              ),
            }
          }
          return list
        }))
      }
    }
  }

  const toggleItemCompletion = async (listId: string, itemId: string) => {
    const list = lists.find(l => l.id === listId)
    const item = list?.items.find(i => i.id === itemId)
    
    if (!item) return

    const newCompletedState = !item.completed

    // Optimistic update - IMMEDIATELY update UI (synchronous)
    setLists(prev => {
      return prev.map(l => {
        if (l.id === listId) {
          const updatedItems = l.items.map(i => 
            i.id === itemId ? { ...i, completed: newCompletedState } : i
          )
          const completedCount = updatedItems.filter(i => i.completed).length
          return {
            ...l,
            items: updatedItems,
            completedCount,
          }
        }
        return l
      })
    })

    // Update in background (non-blocking)
    const { error } = await collaborativeListsService.toggleItemCompletion(itemId, newCompletedState)

    if (error) {
      console.error('Error toggling item:', error)
      // Rollback on error
      setLists(prev => prev.map(l => {
        if (l.id === listId) {
          const updatedItems = l.items.map(i => 
            i.id === itemId ? { ...i, completed: !newCompletedState } : i
          )
          const completedCount = updatedItems.filter(i => i.completed).length
          return {
            ...l,
            items: updatedItems,
            completedCount,
          }
        }
        return l
      }))
    }
  }

  const deleteItemFromList = async (listId: string, itemId: string) => {
    // Store original items for rollback
    const originalList = lists.find(l => l.id === listId)
    
    // Optimistic update - IMMEDIATELY remove from UI (synchronous)
    setLists(prev => {
      return prev.map(list => {
        if (list.id === listId) {
          const updatedItems = list.items.filter(item => item.id !== itemId)
          const completedCount = updatedItems.filter(i => i.completed).length
          return {
            ...list,
            items: updatedItems,
            itemCount: updatedItems.length,
            completedCount,
          }
        }
        return list
      })
    })

    const { error } = await collaborativeListsService.deleteItem(itemId)

    if (error) {
      console.error('Error deleting item:', error)
      // Rollback on error
      if (originalList) {
        setLists(prev => prev.map(list => 
          list.id === listId ? originalList : list
        ))
      }
    }
  }

  const joinListByCode = async (shareCode: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await collaborativeListsService.joinListByCode(shareCode)
    
    if (error) {
      return { success: false, error: error.message || 'Failed to join list' }
    }

    if (data) {
      console.log(`✅ Successfully joined list: ${data.id} (${data.name})`)
      // Reload all lists and set up subscriptions
      await loadLists()
      // Ensure subscription is active for the newly joined list
      subscribeToList(data.id)
      return { success: true }
    }

    return { success: false, error: 'Unknown error' }
  }

  const getListCollaborators = async (listId: string): Promise<Collaborator[]> => {
    const { data, error } = await collaborativeListsService.getListCollaborators(listId)
    if (error) {
      console.error('Error getting collaborators:', error)
      return []
    }
    return data || []
  }

  const getListActivity = async (listId: string): Promise<Activity[]> => {
    const { data, error } = await collaborativeListsService.getListActivity(listId)
    if (error) {
      console.error('Error getting activity:', error)
      return []
    }
    return data || []
  }

  const inviteCollaborator = async (
    listId: string,
    email: string,
    role: 'editor' | 'viewer'
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await collaborativeListsService.inviteCollaborator(listId, email, role)
    
    if (error) {
      return { success: false, error: error.message || 'Failed to invite collaborator' }
    }

    return { success: true }
  }

  const removeCollaborator = async (collaboratorId: string): Promise<{ error?: any }> => {
    const { error } = await collaborativeListsService.removeCollaborator(collaboratorId)
    if (error) {
      console.error('Error removing collaborator:', error)
      return { error }
    }
    return {}
  }

  // Function to ensure subscription is active for a specific list
  const ensureSubscription = useCallback((listId: string) => {
    // Check if list exists in our state
    const listExists = lists.some(list => list.id === listId)
    if (listExists) {
      // Ensure subscription is active
      subscribeToList(listId)
      console.log(`✅ Ensured real-time subscription is active for list: ${listId}`)
    } else {
      console.log(`⚠️ List ${listId} not found in state, cannot set up subscription`)
    }
  }, [lists])

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      collaborativeListsService.unsubscribeAll()
    }
  }, [])

  return (
    <CollaborativeListsContext.Provider
      value={{
        lists,
        loading,
        addList,
        deleteList,
        addItemToList,
        deleteItemFromList,
        updateListItem,
        toggleItemCompletion,
        joinListByCode,
        getListCollaborators,
        getListActivity,
        inviteCollaborator,
        removeCollaborator,
        ensureSubscription,
      }}
    >
      {children}
    </CollaborativeListsContext.Provider>
  )
}

export function useCollaborativeLists() {
  const context = useContext(CollaborativeListsContext)
  if (!context) {
    throw new Error('useCollaborativeLists must be used within CollaborativeListsProvider')
  }
  return context
}

