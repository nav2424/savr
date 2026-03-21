// SAVR Lists Context - Shared state for grocery lists across the app
import React, { createContext, useContext, useState, ReactNode } from 'react'

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

export interface GroceryList {
  id: string
  name: string
  itemCount: number
  completedCount: number
  color: string
  icon: string
  lastUpdated: string
  items: ListItem[]
}

interface ListsContextType {
  lists: GroceryList[]
  addList: (list: Omit<GroceryList, 'id'>) => void
  deleteList: (listId: string) => void
  addItemToList: (listId: string, item: Omit<ListItem, 'id' | 'completed' | 'addedBy' | 'addedDate'>) => void
  updateListItem: (listId: string, itemId: string, updates: Partial<ListItem>) => void
  toggleItemCompletion: (listId: string, itemId: string) => void
}

const ListsContext = createContext<ListsContextType | undefined>(undefined)

// Initial sample lists
const INITIAL_LISTS: GroceryList[] = [
  {
    id: '1',
    name: 'Weekly Groceries',
    itemCount: 0,
    completedCount: 0,
    color: '#E8F5E8',
    icon: '🛒',
    lastUpdated: 'Just now',
    items: []
  },
  {
    id: '2',
    name: 'Dinner Party',
    itemCount: 0,
    completedCount: 0,
    color: '#E3F2FD',
    icon: '🍽️',
    lastUpdated: 'Yesterday',
    items: []
  },
  {
    id: '3',
    name: 'Healthy Snacks',
    itemCount: 0,
    completedCount: 0,
    color: '#F3E5AB',
    icon: '🥗',
    lastUpdated: '3 days ago',
    items: []
  },
  {
    id: '4',
    name: 'Weekend BBQ',
    itemCount: 0,
    completedCount: 0,
    color: '#FFEBEE',
    icon: '🔥',
    lastUpdated: '1 week ago',
    items: []
  }
]

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<GroceryList[]>(INITIAL_LISTS)

  const addList = (list: Omit<GroceryList, 'id'>) => {
    const newList: GroceryList = {
      ...list,
      id: Date.now().toString(),
    }
    setLists(prev => [newList, ...prev])
  }

  const deleteList = (listId: string) => {
    setLists(prev => prev.filter(list => list.id !== listId))
  }

  const addItemToList = (listId: string, item: Omit<ListItem, 'id' | 'completed' | 'addedBy' | 'addedDate'>) => {
    const itemName = (item?.name && String(item.name).trim()) || 'Unknown item'
    const safeItem = { ...item, name: itemName, quantity: item?.quantity ?? '1', category: item?.category ?? 'Groceries' }

    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        const newItem: ListItem = {
          ...safeItem,
          id: Date.now().toString(),
          completed: false,
          addedBy: 'You',
          addedDate: new Date().toISOString().split('T')[0]
        }
        const updatedItems = [...list.items, newItem]
        const completedCount = updatedItems.filter(i => i.completed).length
        
        return {
          ...list,
          items: updatedItems,
          itemCount: updatedItems.length,
          completedCount,
          lastUpdated: 'Just now'
        }
      }
      return list
    }))
  }

  const updateListItem = (listId: string, itemId: string, updates: Partial<ListItem>) => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        const updatedItems = list.items.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        )
        const completedCount = updatedItems.filter(i => i.completed).length
        
        return {
          ...list,
          items: updatedItems,
          completedCount,
          lastUpdated: 'Just now'
        }
      }
      return list
    }))
  }

  const toggleItemCompletion = (listId: string, itemId: string) => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        const updatedItems = list.items.map(item => 
          item.id === itemId ? { ...item, completed: !item.completed } : item
        )
        const completedCount = updatedItems.filter(i => i.completed).length
        
        return {
          ...list,
          items: updatedItems,
          completedCount,
          lastUpdated: 'Just now'
        }
      }
      return list
    }))
  }

  return (
    <ListsContext.Provider
      value={{
        lists,
        addList,
        deleteList,
        addItemToList,
        updateListItem,
        toggleItemCompletion,
      }}
    >
      {children}
    </ListsContext.Provider>
  )
}

export function useLists() {
  const context = useContext(ListsContext)
  if (context === undefined) {
    throw new Error('useLists must be used within a ListsProvider')
  }
  return context
}


