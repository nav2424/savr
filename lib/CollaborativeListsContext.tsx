// SAVR Collaborative Lists Context - Real-time list management with Supabase
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { Alert } from 'react-native'
import { collaborativeListsService } from './CollaborativeListsService'
import { recategorizeItem } from './ItemCategorizer'
import { List, ListItem as SupabaseListItem, Collaborator, Activity } from './supabase'
import { useAuth } from './AuthContext'
import { logger } from './Logger'

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
  listsLoadError: Error | null
  refreshLists: () => Promise<void>
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
  const [listsLoadError, setListsLoadError] = useState<Error | null>(null)
  const listsRef = useRef<ListData[]>([])
  const pendingDeletesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    listsRef.current = lists
  }, [lists])

  const subscribeToList = useCallback((listId: string) => {
    // Unsubscribe from existing subscription if any
    collaborativeListsService.unsubscribeFromList(listId)
    
    logger.debug('Setting up real-time subscription for list', { listId })
    
    collaborativeListsService.subscribeToList(listId, {
      onItemAdded: (item) => {
        logger.debug('Real-time item added', { listId, itemName: item.name })
        setLists(prev => prev.map(list => {
          if (list.id === listId) {
            // Check if item already exists by ID (from optimistic update)
            const existingById = list.items.find(i => i.id === item.id)
            if (existingById) {
              // Item already exists with this ID, skip
              logger.debug('Skipping duplicate item (already exists by id)', { listId, itemName: item.name })
              return list
            }

            // Check for temp item with same name (optimistic update to replace)
            const itemName = (item?.name && String(item.name).trim()) || ''
            const tempItemIndex = list.items.findIndex(i =>
              i.id.startsWith('temp-') &&
              (i.name || '').toLowerCase().trim() === itemName.toLowerCase()
            )
            if (tempItemIndex !== -1) {
              // Replace temp item with real one from database
              logger.debug('Replacing temp item with real item', { listId, itemName: item.name })
              const updatedItems = [...list.items]
              updatedItems[tempItemIndex] = {
                id: item.id,
                name: itemName || (item?.name && String(item.name).trim()) || 'Unknown item',
                category: item.category || 'Groceries',
                quantity: item.quantity || '1',
                completed: item.completed ?? false,
                addedBy: item.added_by_name || 'Unknown',
                addedDate: item.added_date || new Date().toISOString().split('T')[0],
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
              (i.name || '').toLowerCase().trim() === itemName.toLowerCase() &&
              !i.id.startsWith('temp-')
            )
            if (duplicateByName) {
              // Duplicate detected, skip adding
              logger.debug('Skipping duplicate item (by name)', { listId, itemName: item.name })
              return list
            }

            // New item from another user - add it INSTANTLY
            const safeName = itemName || (item?.name && String(item.name).trim()) || 'Unknown item'
            logger.debug('Adding new item from another user', { listId, itemName: safeName, addedBy: item.added_by_name })
            const newItem: ListItem = {
              id: item.id,
              name: safeName,
              category: item.category || 'Groceries',
              quantity: item.quantity || '1',
              completed: item.completed ?? false,
              addedBy: item.added_by_name || 'Unknown',
              addedDate: item.added_date || new Date().toISOString().split('T')[0],
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
        logger.debug('Real-time item updated', { listId, itemName: item.name })
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
        logger.debug('Real-time item deleted', { listId, itemId })
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
    
    logger.debug('Real-time subscription active for list', { listId })
  }, [])

  const loadLists = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setListsLoadError(null)
    try {
      const { data: listsData, error } = await collaborativeListsService.getUserLists()
      
      if (error) {
        console.error('Error loading lists:', error)
        setListsLoadError(error instanceof Error ? error : new Error(String(error)))
        setLists([])
        return
      }

      if (listsData && listsData.length > 0) {
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

        // Never re-add lists that are in the process of being deleted (prevents race with refreshLists)
        const pending = pendingDeletesRef.current
        const filtered = pending.size > 0
          ? listsWithItems.filter(l => !pending.has(l.id))
          : listsWithItems
        setLists(filtered)
        setListsLoadError(null)
        
        // Subscribe to real-time updates for each list
        logger.debug('Setting up real-time subscriptions for lists', { count: filtered.length })
        filtered.forEach(list => {
          subscribeToList(list.id)
        })
        logger.debug('All real-time subscriptions set up', { count: listsWithItems.length })
      } else {
        setLists([])
        setListsLoadError(null)
      }
    } catch (error) {
      logger.error('Error loading lists', { error })
      setListsLoadError(error instanceof Error ? error : new Error(String(error)))
      setLists([])
    } finally {
      setLoading(false)
    }
  }, [user, subscribeToList])

  // Load user's lists when authenticated
  useEffect(() => {
    if (user) {
      loadLists()
    } else {
      setLists([])
      setLoading(false)
    }
  }, [user, loadLists])

  const addList = useCallback(async (name: string, icon: string) => {
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
      logger.error('Error creating list', { error })
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
  }, [user, subscribeToList])

  const deleteList = useCallback(async (listId: string) => {
    // Track pending delete so loadLists/refreshLists won't re-add this list (race fix)
    pendingDeletesRef.current.add(listId)

    // Optimistic update - IMMEDIATELY remove from UI (synchronous)
    collaborativeListsService.unsubscribeFromList(listId)
    setLists(prev => prev.filter(list => list.id !== listId))

    try {
      const { error } = await collaborativeListsService.deleteList(listId)
      if (error) {
        logger.error('Error deleting list', { error })
        pendingDeletesRef.current.delete(listId)
        loadLists()
        Alert.alert(
          'Could Not Delete',
          'Only the list owner can delete this list. The list has been restored.',
          [{ text: 'OK' }]
        )
        return
      }
    } finally {
      pendingDeletesRef.current.delete(listId)
    }
  }, [loadLists])

  const addItemToList = useCallback(async (
    listId: string,
    item: Omit<ListItem, 'id' | 'completed' | 'addedBy' | 'addedDate'>
  ) => {
    // Guard: item.name is required - prevent crash from undefined/null
    const itemName = (item?.name && String(item.name).trim()) || 'Unknown item'
    const safeItem = { ...item, name: itemName, quantity: item?.quantity ?? '1', category: item?.category ?? 'Groceries' }

    // Check for duplicates FIRST
    const targetList = listsRef.current.find(l => l.id === listId)
    if (targetList) {
      const isDuplicate = targetList.items.some(existingItem =>
        (existingItem.name || '').toLowerCase().trim() === itemName.toLowerCase().trim()
      )
      
      if (isDuplicate) {
        // Show alert and return early - DO NOT add duplicate
        const { Alert } = await import('react-native')
        Alert.alert(
          'Already in List',
          `"${itemName}" is already in your list`,
          [{ text: 'OK' }]
        )
        return
      }
    }

    // Optimistic update - IMMEDIATELY update UI (synchronous)
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimisticItem: ListItem = {
      id: tempId,
      name: safeItem.name,
      category: safeItem.category,
      quantity: safeItem.quantity,
      notes: safeItem.notes,
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

    logger.debug('Adding item to list', { listId, name: safeItem.name, category: safeItem.category })

    const { error, data } = await collaborativeListsService.addItem(listId, {
      name: safeItem.name,
      category: safeItem.category,
      quantity: safeItem.quantity,
      notes: safeItem.notes,
      completed: false,
      added_date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      logger.error('Error adding item to list', { error, listId, itemName: safeItem.name })
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
  }, [])

  const updateListItem = useCallback(async (listId: string, itemId: string, updates: Partial<ListItem>) => {
    // Store original item for rollback
    const originalItem = listsRef.current.find(l => l.id === listId)?.items.find(i => i.id === itemId)
    
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
      logger.error('Error updating list item', { error, listId, itemId })
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
  }, [])

  const toggleItemCompletion = useCallback(async (listId: string, itemId: string) => {
    const list = listsRef.current.find(l => l.id === listId)
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
      logger.error('Error toggling item completion', { error, listId, itemId })
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
  }, [])

  const deleteItemFromList = useCallback(async (listId: string, itemId: string) => {
    // Store original items for rollback
    const originalList = listsRef.current.find(l => l.id === listId)
    
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
      logger.error('Error deleting item from list', { error, listId, itemId })
      // Rollback on error
      if (originalList) {
        setLists(prev => prev.map(list => 
          list.id === listId ? originalList : list
        ))
      }
    }
  }, [])

  const joinListByCode = useCallback(async (shareCode: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await collaborativeListsService.joinListByCode(shareCode)
    
    if (error) {
      return { success: false, error: error.message || 'Failed to join list' }
    }

    if (data) {
      logger.info('Successfully joined list', { listId: data.id, name: data.name })
      // Reload all lists and set up subscriptions
      await loadLists()
      // Ensure subscription is active for the newly joined list
      subscribeToList(data.id)
      return { success: true }
    }

    return { success: false, error: 'Unknown error' }
  }, [loadLists, subscribeToList])

  const getListCollaborators = useCallback(async (listId: string): Promise<Collaborator[]> => {
    const { data, error } = await collaborativeListsService.getListCollaborators(listId)
    if (error) {
      logger.error('Error getting collaborators', { error, listId })
      return []
    }
    return data || []
  }, [])

  const getListActivity = useCallback(async (listId: string): Promise<Activity[]> => {
    const { data, error } = await collaborativeListsService.getListActivity(listId)
    if (error) {
      logger.error('Error getting activity', { error, listId })
      return []
    }
    return data || []
  }, [])

  const inviteCollaborator = useCallback(async (
    listId: string,
    email: string,
    role: 'editor' | 'viewer'
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await collaborativeListsService.inviteCollaborator(listId, email, role)
    
    if (error) {
      return { success: false, error: error.message || 'Failed to invite collaborator' }
    }

    return { success: true }
  }, [])

  const removeCollaborator = useCallback(async (collaboratorId: string): Promise<{ error?: any }> => {
    const { error } = await collaborativeListsService.removeCollaborator(collaboratorId)
    if (error) {
      logger.error('Error removing collaborator', { error, collaboratorId })
      return { error }
    }
    return {}
  }, [])

  // Function to ensure subscription is active for a specific list
  const ensureSubscription = useCallback((listId: string) => {
    // Always set up subscription - don't check if list exists in state
    // This ensures subscriptions work even if list hasn't loaded yet
    subscribeToList(listId)
    logger.debug('Ensured real-time subscription is active for list', { listId })
  }, [subscribeToList])

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
        listsLoadError,
        refreshLists: loadLists,
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

