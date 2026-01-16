// SAVR Pantry Context - Real-time pantry management with Supabase
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, PantryItem } from './supabase'
import { useAuth } from './AuthContext'
import { notificationsService } from './NotificationsService'
import { logger } from './Logger'
import { DatabaseError, getErrorMessage } from './errors'

interface PantryContextType {
  items: PantryItem[]
  loading: boolean
  error: string | null
  addItem: (item: Omit<PantryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<PantryItem | null>
  removeItem: (itemId: string) => Promise<boolean>
  updateItem: (itemId: string, updates: Partial<PantryItem>) => Promise<boolean>
  updateQuantity: (itemId: string, quantity: number) => Promise<boolean>
  findItemByName: (name: string) => PantryItem | undefined
  findItemByBarcode: (barcode: string) => PantryItem | undefined
  consumeItem: (itemName: string, quantity: number) => Promise<boolean>
  refreshItems: () => Promise<void>
  getItemsByLocation: (location: 'fridge' | 'freezer' | 'pantry') => PantryItem[]
  getItemsByCategory: (category: string) => PantryItem[]
  getExpiringItems: (daysThreshold?: number) => PantryItem[]
}

const PantryContext = createContext<PantryContextType | undefined>(undefined)

export function PantryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load items when user changes
  useEffect(() => {
    if (user) {
      loadItems()
      
      // Subscribe to realtime changes
      const subscription = supabase
        .channel('pantry_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pantry_items',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            handleRealtimeUpdate(payload)
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } else {
      setItems([])
      setLoading(false)
    }
  }, [user])

  const loadItems = async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Filter out items with quantity <= 0 (shouldn't exist, but handle edge cases)
      const validItems = (data || []).filter(item => item.quantity > 0)
      
      // If any items were filtered out, remove them from database
      const itemsToRemove = (data || []).filter(item => item.quantity <= 0)
      if (itemsToRemove.length > 0) {
        logger.info(`Found ${itemsToRemove.length} items with quantity <= 0, removing from database`, {
          count: itemsToRemove.length,
          userId: user.id,
        })
        for (const item of itemsToRemove) {
          await supabase
            .from('pantry_items')
            .delete()
            .eq('id', item.id)
            .eq('user_id', user.id)
        }
      }

      setItems(validItems)
      
      // Schedule expiry notifications for loaded items
      if (validItems.length > 0 && user?.id) {
        await notificationsService.scheduleSmartNotifications(user.id, validItems)
      }
    } catch (err: unknown) {
      logger.dbError('loadItems', err, { userId: user.id })
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        // Only add if quantity > 0
        if (newRecord.quantity > 0) {
          setItems(prev => [newRecord as PantryItem, ...prev])
        }
        break
      case 'UPDATE':
        // If quantity is 0 or less, remove the item instead
        if (newRecord.quantity <= 0) {
          setItems(prev => prev.filter(item => item.id !== newRecord.id))
        } else {
          setItems(prev => prev.map(item => 
            item.id === newRecord.id ? newRecord as PantryItem : item
          ))
        }
        break
      case 'DELETE':
        setItems(prev => prev.filter(item => item.id !== oldRecord.id))
        break
    }
  }

  const addItem = async (item: Omit<PantryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<PantryItem | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setError(null)

      // Check database directly for existing item to avoid race conditions
      // This ensures that even if we scan the same barcode twice quickly,
      // we'll find the first item before it appears in the local state
      let existingItem: PantryItem | null = null

      if (item.barcode) {
        // Check by barcode and location first (most accurate)
        const { data: barcodeMatch } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('barcode', item.barcode)
          .eq('location', item.location)
          .maybeSingle()

        if (barcodeMatch) {
          existingItem = barcodeMatch as PantryItem
        }
      }

      // If no barcode match, check by name (case-insensitive) and location
      if (!existingItem) {
        const { data: nameMatches } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('location', item.location)
          .ilike('name', item.name)

        if (nameMatches && nameMatches.length > 0) {
          // Find exact match (case-insensitive, trimmed)
          existingItem = nameMatches.find(i => 
            i.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          ) as PantryItem || null
        }
      }

      if (existingItem) {
        // Item exists - merge by updating quantity
        const newQuantity = existingItem.quantity + (item.quantity || 1)
        
        // If quantity becomes 0 or less, remove the item instead
        if (newQuantity <= 0) {
          logger.info('Merged quantity results in 0 or less, removing item', {
            itemId: existingItem.id,
            itemName: item.name,
          })
          await removeItem(existingItem.id)
          return null
        }
        
        const { data, error: updateError } = await supabase
          .from('pantry_items')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingItem.id)
          .select()
          .single()

        if (updateError) throw updateError

        // Update local state immediately
        setItems(prev => prev.map(i => 
          i.id === existingItem!.id ? data as PantryItem : i
        ))

        logger.info('Merged duplicate pantry item', {
          itemName: item.name,
          barcode: item.barcode || 'no barcode',
          oldQuantity: existingItem.quantity,
          newQuantity,
        })
        
        // Reschedule notifications if expiry date exists
        if (data.expiry_date && user?.id) {
          const updatedItems = items.map(i => 
            i.id === existingItem!.id ? data as PantryItem : i
          )
          await notificationsService.scheduleSmartNotifications(user.id, updatedItems)
        }
        
        return data as PantryItem
      }

      // No duplicate - add new item
      const { data, error: insertError } = await supabase
        .from('pantry_items')
        .insert({
          user_id: user.id,
          ...item,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state (optimistic update handled by realtime subscription)
      logger.info('Added new pantry item', { itemName: item.name, itemId: data.id })
      
      // Reschedule notifications after adding item (if it has expiry date)
      if (data.expiry_date && user?.id) {
        await notificationsService.scheduleSmartNotifications(user.id, items.concat([data as PantryItem]))
      }
      
      return data as PantryItem
    } catch (err: unknown) {
      logger.dbError('addItem', err, { itemName: item.name, userId: user.id })
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      return null
    }
  }

  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated')
      return false
    }

    // Store item for rollback
    const itemToRemove = items.find(i => i.id === itemId)
    
    // Optimistic update - immediately remove from UI
    setItems(prev => prev.filter(i => i.id !== itemId))

    try {
      setError(null)
      
      const { error: deleteError } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      // Reschedule notifications after removing item (to cancel its notifications)
      if (user?.id) {
        const remainingItems = items.filter(i => i.id !== itemId)
        await notificationsService.scheduleSmartNotifications(user.id, remainingItems)
      }

      return true
    } catch (err: unknown) {
      logger.dbError('removeItem', err, { itemId, userId: user.id })
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      // Rollback - add item back
      if (itemToRemove) {
        setItems(prev => [itemToRemove, ...prev])
      }
      return false
    }
  }

  const updateItem = async (itemId: string, updates: Partial<PantryItem>): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated')
      return false
    }

    // If quantity is being updated to 0 or less, automatically remove the item
    if (updates.quantity !== undefined && updates.quantity <= 0) {
      logger.info('Quantity is 0 or less, automatically removing item', { itemId })
      return await removeItem(itemId)
    }

    // Store original item for rollback
    const originalItem = items.find(i => i.id === itemId)
    
    // Optimistic update - immediately update UI
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    ))

    try {
      setError(null)
      
      const { error: updateError } = await supabase
        .from('pantry_items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Reschedule notifications if expiry date was updated
      if (updates.expiry_date !== undefined && user?.id) {
        // Reload items to get updated state, then reschedule
        const updatedItems = items.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        )
        await notificationsService.scheduleSmartNotifications(user.id, updatedItems)
      }

      return true
    } catch (err: unknown) {
      logger.dbError('updateItem', err, { itemId, userId: user.id, updates })
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      // Rollback - restore original item
      if (originalItem) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? originalItem : item
        ))
      }
      return false
    }
  }

  const updateQuantity = async (itemId: string, quantity: number): Promise<boolean> => {
    return updateItem(itemId, { quantity })
  }

  const findItemByName = (name: string): PantryItem | undefined => {
    const lowerName = name.toLowerCase()
    return items.find(item => 
      item.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(item.name.toLowerCase())
    )
  }

  const findItemByBarcode = (barcode: string): PantryItem | undefined => {
    if (!barcode) return undefined
    return items.find(item => item.barcode === barcode)
  }

  const consumeItem = async (itemName: string, quantity: number): Promise<boolean> => {
    const item = findItemByName(itemName)
    if (item) {
      const newQuantity = Math.max(0, item.quantity - quantity)
      return await updateQuantity(item.id, newQuantity)
    }
    return false
  }

  const refreshItems = async (): Promise<void> => {
    await loadItems()
  }

  const getItemsByLocation = (location: 'fridge' | 'freezer' | 'pantry'): PantryItem[] => {
    return items.filter(item => item.location === location)
  }

  const getItemsByCategory = (category: string): PantryItem[] => {
    return items.filter(item => item.category.toLowerCase() === category.toLowerCase())
  }

  const getExpiringItems = (daysThreshold: number = 3): PantryItem[] => {
    const now = new Date()
    // Set time to start of day for consistent comparison
    now.setHours(0, 0, 0, 0)
    
    return items.filter(item => {
      if (!item.expiry_date) return false
      
      const expiryDate = new Date(item.expiry_date)
      // Set time to start of day for consistent comparison
      expiryDate.setHours(0, 0, 0, 0)
      
      const diffTime = expiryDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      // Items expiring today (0 days) through daysThreshold days
      return diffDays >= 0 && diffDays <= daysThreshold
    })
  }

  return (
    <PantryContext.Provider
      value={{
        items,
        loading,
        error,
        addItem,
        removeItem,
        updateItem,
        updateQuantity,
        findItemByName,
        findItemByBarcode,
        consumeItem,
        refreshItems,
        getItemsByLocation,
        getItemsByCategory,
        getExpiringItems,
      }}
    >
      {children}
    </PantryContext.Provider>
  )
}

export function usePantry() {
  const context = useContext(PantryContext)
  if (context === undefined) {
    throw new Error('usePantry must be used within a PantryProvider')
  }
  return context
}
