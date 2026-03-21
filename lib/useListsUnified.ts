// Unified Lists Hook - Works with both authenticated and unauthenticated users
import { useAuth } from './AuthContext'
import { useLists } from './ListsContext'
import { useCollaborativeLists } from './CollaborativeListsContext'

/**
 * Universal hook for accessing lists functionality
 * Automatically uses the correct provider based on auth state.
 * IMPORTANT: Both hooks are called unconditionally to comply with Rules of Hooks.
 */
export function useListsUnified() {
  const { user } = useAuth()
  const localLists = useLists()
  const collabLists = useCollaborativeLists()

  // Use collaborative lists for authenticated users, local for guests
  if (user) {
    const addList = (nameOrList: string | any, icon?: string) => {
      if (typeof nameOrList === 'string' && icon) {
        return collabLists.addList(nameOrList, icon)
      }
      if (typeof nameOrList === 'object') {
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
  }

  // Unauthenticated: use local lists
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
    deleteItemFromList: async () => {},
    refreshLists: async () => {},
    loading: false,
    listsLoadError: null,
  }
}
