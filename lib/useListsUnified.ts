// Unified Lists Hook - Works with both authenticated and unauthenticated users
import { useAuth } from './AuthContext'
import { useLists } from './ListsContext'
import { useCollaborativeLists } from './CollaborativeListsContext'

/**
 * Universal hook for accessing lists functionality
 * Automatically uses the correct provider based on auth state
 */
export function useListsUnified() {
  const { user } = useAuth()
  
  // Use collaborative lists for authenticated users
  if (user) {
    try {
      const collabLists = useCollaborativeLists()
      // Wrap addList to match both signatures (overloaded)
      const addList = (nameOrList: string | any, icon?: string) => {
        if (typeof nameOrList === 'string' && icon) {
          return collabLists.addList(nameOrList, icon)
        } else if (typeof nameOrList === 'object') {
          return collabLists.addList(nameOrList.name, nameOrList.icon || '🛒')
        }
        return collabLists.addList(String(nameOrList), icon || '🛒')
      }
      return {
        ...collabLists,
        addList,
        deleteItemFromList: collabLists.deleteItemFromList,
        joinListByCode: collabLists.joinListByCode,
      }
    } catch (error) {
      // Fallback to local lists if collaborative provider not available
      console.warn('Collaborative lists not available, using local lists')
    }
  }
  
  // Use local lists for unauthenticated users or as fallback
  try {
    const localLists = useLists()
    // Wrap addList to match both signatures (overloaded)
    const addList = (nameOrList: string | any, icon?: string) => {
      if (typeof nameOrList === 'string' && icon) {
        localLists.addList({
          name: nameOrList,
          icon,
          itemCount: 0,
          completedCount: 0,
          items: [],
          color: '#E8F5E8',
          lastUpdated: new Date().toISOString(),
        })
      } else if (typeof nameOrList === 'object') {
        localLists.addList(nameOrList)
      } else {
        localLists.addList({
          name: String(nameOrList),
          icon: icon || '🛒',
          itemCount: 0,
          completedCount: 0,
          items: [],
          color: '#E8F5E8',
          lastUpdated: new Date().toISOString(),
        })
      }
    }
    return {
      ...localLists,
      addList,
      deleteItemFromList: async () => {}, // Placeholder for local lists
    }
  } catch (error) {
    // Return empty state if no provider available
    console.warn('No lists provider available')
    return {
      lists: [],
      loading: false,
      addList: () => {},
      deleteList: async () => {},
      addItemToList: async () => {},
      deleteItemFromList: async () => {},
      updateListItem: async () => {},
      toggleItemCompletion: async () => {},
      joinListByCode: async () => ({ success: false, error: 'Not available' }),
      getListCollaborators: async () => [],
      getListActivity: async () => [],
      inviteCollaborator: async () => ({ success: false, error: 'Not available' }),
      removeCollaborator: async () => {},
    }
  }
}
