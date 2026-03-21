import AsyncStorage from '@react-native-async-storage/async-storage'
import { safeJsonParse } from './safeUtils'

// Data persistence keys
const STORAGE_KEYS = {
  LISTS: 'savr_grocery_lists',
  PANTRY: 'savr_pantry_items',
  RECIPES: 'savr_saved_recipes',
  USER_PREFS: 'savr_user_preferences',
  HOUSEHOLD: 'savr_household_data',
  SHOPPING_HISTORY: 'savr_shopping_history',
  NOTIFICATIONS: 'savr_notifications',
  BUDGET: 'savr_budget_data',
  SCAN_HISTORY: 'savr_scan_history'
}

// Data types
export interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit?: string
  category: string
  price?: number
  store?: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  addedDate: string
  completedDate?: string
  notes?: string
}

export interface GroceryList {
  id: string
  name: string
  type: 'shopping' | 'meal_prep' | 'party' | 'custom'
  items: GroceryItem[]
  createdDate: string
  lastModified: string
  sharedWith: string[]
  color: string
  totalEstimated: number
  completedItems: number
  totalItems: number
}

export interface PantryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  expiryDate: string
  purchaseDate: string
  price: number
  store: string
  location: string
  barcode?: string
  brand?: string
  image?: string
  nutrition?: {
    calories: number
    protein: number
    carbs: number
    fiber: number
  }
  aiSuggestion?: string
  status: 'fresh' | 'expiring_soon' | 'expired'
  daysUntilExpiry: number
  notes?: string
}

export interface Recipe {
  id: string
  title: string
  description: string
  prepTime: number
  cookTime: number
  servings: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  rating: number
  calories: number
  image: string
  ingredients: string[]
  instructions: string[]
  tags: string[]
  aiGenerated: boolean
  pantryMatch: number
  missingIngredients: string[]
  priceEstimate: number
  nutrition: {
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
}

export interface UserPreferences {
  weeklyBudget: number
  preferredStores: string[]
  dietaryRestrictions: string[]
  totalItemsAdded: number
  listsCreated: number
  moneySaved: number
  notificationsEnabled: boolean
  theme: 'dark' | 'light'
  progressiveTheme: 'warm'
  units: 'metric' | 'imperial'
  aestheticMode: 'premium' | 'global'
  systemTheme?: boolean
}

export interface Household {
  id: string
  name: string
  members: string[]
  preferences: {
    vegetarian: boolean
    keto: boolean
    halal: boolean
    glutenFree: boolean
    dairyFree: boolean
  }
  sharedLists: string[]
  budget: number
}

export interface ShoppingHistory {
  id: string
  items: {
    name: string
    price: number
    quantity: number
  }[]
  total: number
  store: string
  date: string
  receiptImage?: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'expiry' | 'list_update' | 'recipe' | 'budget'
  read: boolean
  timestamp: string
  actionRequired: boolean
}

export interface ScanResult {
  id: string
  type: 'barcode' | 'receipt'
  data: any
  timestamp: string
  confidence?: number
  store?: string
  itemsCount?: number
  total?: number
  imageUri?: string
}

// Data Manager Class
class DataManager {
  // Generic storage methods
  private async saveData<T>(key: string, data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error(`Error saving ${key}:`, error)
      throw error
    }
  }

  private async loadData<T>(key: string): Promise<T | null> {
    try {
      const data = await AsyncStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error(`Error loading ${key}:`, error)
      return null
    }
  }

  // Grocery Lists Management
  async getGroceryLists(): Promise<GroceryList[]> {
    const lists = await this.loadData<GroceryList[]>(STORAGE_KEYS.LISTS)
    return lists || this.getDefaultLists()
  }

  async saveGroceryLists(lists: GroceryList[]): Promise<void> {
    await this.saveData(STORAGE_KEYS.LISTS, lists)
  }

  async createGroceryList(name: string, type: GroceryList['type'] = 'shopping'): Promise<GroceryList> {
    const lists = await this.getGroceryLists()
    const newList: GroceryList = {
      id: Date.now().toString(),
      name,
      type,
      items: [],
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      sharedWith: [],
      color: this.getRandomColor(),
      totalEstimated: 0,
      completedItems: 0,
      totalItems: 0
    }
    
    lists.push(newList)
    await this.saveGroceryLists(lists)
    return newList
  }

  async addItemToList(listId: string, item: Omit<GroceryItem, 'id' | 'addedDate'>): Promise<GroceryItem> {
    const lists = await this.getGroceryLists()
    const list = lists.find(l => l.id === listId)
    if (!list) throw new Error('List not found')

    const newItem: GroceryItem = {
      ...item,
      id: Date.now().toString(),
      addedDate: new Date().toISOString()
    }

    list.items.push(newItem)
    list.totalItems = list.items.length
    list.completedItems = list.items.filter(i => i.completed).length
    list.totalEstimated = list.items.reduce((sum, item) => sum + (item.price || 0), 0)
    list.lastModified = new Date().toISOString()

    await this.saveGroceryLists(lists)
    return newItem
  }

  async updateListItem(listId: string, itemId: string, updates: Partial<GroceryItem>): Promise<void> {
    const lists = await this.getGroceryLists()
    const list = lists.find(l => l.id === listId)
    if (!list) throw new Error('List not found')

    const item = list.items.find(i => i.id === itemId)
    if (!item) throw new Error('Item not found')

    Object.assign(item, updates)
    
    if (updates.completed !== undefined) {
      item.completedDate = updates.completed ? new Date().toISOString() : undefined
    }

    list.completedItems = list.items.filter(i => i.completed).length
    list.totalEstimated = list.items.reduce((sum, item) => sum + (item.price || 0), 0)
    list.lastModified = new Date().toISOString()

    await this.saveGroceryLists(lists)
  }

  async deleteListItem(listId: string, itemId: string): Promise<void> {
    const lists = await this.getGroceryLists()
    const list = lists.find(l => l.id === listId)
    if (!list) throw new Error('List not found')

    list.items = list.items.filter(i => i.id !== itemId)
    list.totalItems = list.items.length
    list.completedItems = list.items.filter(i => i.completed).length
    list.totalEstimated = list.items.reduce((sum, item) => sum + (item.price || 0), 0)
    list.lastModified = new Date().toISOString()

    await this.saveGroceryLists(lists)
  }

  async deleteGroceryList(listId: string): Promise<void> {
    const lists = await this.getGroceryLists()
    const filteredLists = lists.filter(l => l.id !== listId)
    await this.saveGroceryLists(filteredLists)
  }

  // Pantry Management
  async getPantryItems(): Promise<PantryItem[]> {
    const items = await this.loadData<PantryItem[]>(STORAGE_KEYS.PANTRY)
    return items || this.getDefaultPantryItems()
  }

  async savePantryItems(items: PantryItem[]): Promise<void> {
    // Update expiry status before saving
    const updatedItems = items.map(item => {
      const daysUntilExpiry = this.calculateDaysUntilExpiry(item.expiryDate)
      const status = this.getExpiryStatus(daysUntilExpiry)
      return { ...item, daysUntilExpiry, status }
    })
    
    await this.saveData(STORAGE_KEYS.PANTRY, updatedItems)
  }

  async addPantryItem(item: Omit<PantryItem, 'id' | 'daysUntilExpiry' | 'status'>): Promise<PantryItem> {
    const items = await this.getPantryItems()
    const daysUntilExpiry = this.calculateDaysUntilExpiry(item.expiryDate)
    const status = this.getExpiryStatus(daysUntilExpiry)
    
    const newItem: PantryItem = {
      ...item,
      id: Date.now().toString(),
      daysUntilExpiry,
      status
    }

    items.push(newItem)
    await this.savePantryItems(items)
    return newItem
  }

  async updatePantryItem(itemId: string, updates: Partial<PantryItem>): Promise<void> {
    const items = await this.getPantryItems()
    const item = items.find(i => i.id === itemId)
    if (!item) throw new Error('Item not found')

    Object.assign(item, updates)
    
    if (updates.expiryDate) {
      item.daysUntilExpiry = this.calculateDaysUntilExpiry(updates.expiryDate)
      item.status = this.getExpiryStatus(item.daysUntilExpiry)
    }

    await this.savePantryItems(items)
  }

  async deletePantryItem(itemId: string): Promise<void> {
    const items = await this.getPantryItems()
    const filteredItems = items.filter(i => i.id !== itemId)
    await this.savePantryItems(filteredItems)
  }

  // Recipes Management
  async getSavedRecipes(): Promise<Recipe[]> {
    const recipes = await this.loadData<Recipe[]>(STORAGE_KEYS.RECIPES)
    return recipes || []
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    const recipes = await this.getSavedRecipes()
    const existingIndex = recipes.findIndex(r => r.id === recipe.id)
    
    if (existingIndex >= 0) {
      recipes[existingIndex] = recipe
    } else {
      recipes.push(recipe)
    }
    
    await this.saveData(STORAGE_KEYS.RECIPES, recipes)
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    const recipes = await this.getSavedRecipes()
    const filteredRecipes = recipes.filter(r => r.id !== recipeId)
    await this.saveData(STORAGE_KEYS.RECIPES, filteredRecipes)
  }

  // User Preferences
  async getUserPreferences(): Promise<UserPreferences> {
    const prefs = await this.loadData<UserPreferences>(STORAGE_KEYS.USER_PREFS)
    return prefs || this.getDefaultPreferences()
  }

  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    await this.saveData(STORAGE_KEYS.USER_PREFS, preferences)
  }

  async updateBudget(newBudget: number): Promise<void> {
    const prefs = await this.getUserPreferences()
    prefs.weeklyBudget = newBudget
    await this.saveUserPreferences(prefs)
  }

  // Shopping History
  async getShoppingHistory(): Promise<ShoppingHistory[]> {
    const history = await this.loadData<ShoppingHistory[]>(STORAGE_KEYS.SHOPPING_HISTORY)
    return history || []
  }

  async addShoppingHistory(history: Omit<ShoppingHistory, 'id'>): Promise<ShoppingHistory> {
    const histories = await this.getShoppingHistory()
    const newHistory: ShoppingHistory = {
      ...history,
      id: Date.now().toString()
    }
    
    histories.unshift(newHistory) // Add to beginning
    await this.saveData(STORAGE_KEYS.SHOPPING_HISTORY, histories.slice(0, 50)) // Keep last 50
    return newHistory
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const notifications = await this.loadData<Notification[]>(STORAGE_KEYS.NOTIFICATIONS)
    return notifications || []
  }

  async addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<Notification> {
    const notifications = await this.getNotifications()
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    }
    
    notifications.unshift(newNotification)
    await this.saveData(STORAGE_KEYS.NOTIFICATIONS, notifications.slice(0, 100)) // Keep last 100
    return newNotification
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const notifications = await this.getNotifications()
    const notification = notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      await this.saveData(STORAGE_KEYS.NOTIFICATIONS, notifications)
    }
  }

  // Scan History Management
  async getScanHistory(): Promise<ScanResult[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_HISTORY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Failed to get scan history:', error)
      return []
    }
  }

  async addScanResult(scanResult: Omit<ScanResult, 'id' | 'timestamp'>): Promise<ScanResult> {
    const newScanResult: ScanResult = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...scanResult
    }

    const history = await this.getScanHistory()
    const updated = [newScanResult, ...history].slice(0, 100) // Keep last 100 scans
    await this.saveData(STORAGE_KEYS.SCAN_HISTORY, updated)
    
    return newScanResult
  }

  async clearScanHistory(): Promise<void> {
    await this.saveData(STORAGE_KEYS.SCAN_HISTORY, [])
  }

  async getScanStatistics(): Promise<{
    totalScans: number
    receiptScans: number
    barcodeScans: number
    averageConfidence: number
    mostScannedStore: string
    lastScanDate: string | null
  }> {
    const history = await this.getScanHistory()
    
    const receiptScans = history.filter(scan => scan.type === 'receipt').length
    const barcodeScans = history.filter(scan => scan.type === 'barcode').length
    
    const confidenceValues = history
      .filter(scan => scan.confidence !== undefined)
      .map(scan => scan.confidence!)
    
    const averageConfidence = confidenceValues.length > 0 
      ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length
      : 0

    const storeCounts = history
      .filter(scan => scan.store)
      .reduce((acc, scan) => {
        acc[scan.store!] = (acc[scan.store!] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const mostScannedStore = Object.keys(storeCounts).reduce((a, b) => 
      storeCounts[a] > storeCounts[b] ? a : b, ''
    )

    const lastScanDate = history.length > 0 ? history[0].timestamp : null

    return {
      totalScans: history.length,
      receiptScans,
      barcodeScans,
      averageConfidence,
      mostScannedStore,
      lastScanDate
    }
  }

  // Utility Methods
  private calculateDaysUntilExpiry(expiryDate: string): number {
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  private getExpiryStatus(daysUntilExpiry: number): PantryItem['status'] {
    if (daysUntilExpiry < 0) return 'expired'
    if (daysUntilExpiry <= 3) return 'expiring_soon'
    return 'fresh'
  }

  private getRandomColor(): string {
    const colors = ['#00FF88', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFD93D', '#FF6B6B', '#A8E6CF', '#FFB6C1']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // Default Data
  private getDefaultLists(): GroceryList[] {
    return [
      {
        id: '1',
        name: 'Weekly Groceries',
        type: 'shopping',
        items: [
          {
            id: 'i1',
            name: 'Organic Spinach',
            quantity: 1,
            unit: 'bag',
            category: 'produce',
            price: 3.99,
            store: 'Whole Foods',
            priority: 'high',
            completed: false,
            addedDate: new Date().toISOString()
          },
          {
            id: 'i2',
            name: 'Greek Yogurt',
            quantity: 2,
            unit: 'containers',
            category: 'dairy',
            price: 4.50,
            store: 'Costco',
            priority: 'medium',
            completed: false,
            addedDate: new Date().toISOString()
          }
        ],
        createdDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        sharedWith: ['Sarah', 'Mike'],
        color: '#00FF88',
        totalEstimated: 8.49,
        completedItems: 0,
        totalItems: 2
      }
    ]
  }

  private getDefaultPantryItems(): PantryItem[] {
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    return [
      {
        id: '1',
        name: 'Organic Spinach',
        category: 'produce',
        quantity: 1,
        unit: 'bag',
        expiryDate: tomorrow.toISOString().split('T')[0],
        purchaseDate: today.toISOString().split('T')[0],
        price: 3.99,
        store: 'Whole Foods',
        location: 'Fridge - Crisper',
        daysUntilExpiry: 1,
        status: 'expiring_soon',
        nutrition: { calories: 23, protein: 3, carbs: 4, fiber: 2 },
        aiSuggestion: 'Use in salads or smoothies'
      },
      {
        id: '2',
        name: 'Chicken Breast',
        category: 'meat',
        quantity: 2,
        unit: 'lbs',
        expiryDate: nextWeek.toISOString().split('T')[0],
        purchaseDate: today.toISOString().split('T')[0],
        price: 8.99,
        store: 'Whole Foods',
        location: 'Freezer',
        daysUntilExpiry: 7,
        status: 'fresh',
        nutrition: { calories: 165, protein: 31, carbs: 0, fiber: 0 },
        aiSuggestion: 'Great for stir-fries or grilling'
      }
    ]
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      weeklyBudget: 150,
      preferredStores: ['Whole Foods', 'Costco', 'Trader Joe\'s'],
      dietaryRestrictions: [],
      totalItemsAdded: 0,
      listsCreated: 1,
      moneySaved: 0,
      notificationsEnabled: true,
      theme: 'light',
      progressiveTheme: 'warm',
      units: 'imperial',
      aestheticMode: 'global'
    }
  }

  // Data Export/Import
  async exportAllData(): Promise<string> {
    const data = {
      lists: await this.getGroceryLists(),
      pantry: await this.getPantryItems(),
      recipes: await this.getSavedRecipes(),
      preferences: await this.getUserPreferences(),
      shoppingHistory: await this.getShoppingHistory(),
      notifications: await this.getNotifications(),
      exportDate: new Date().toISOString()
    }
    return JSON.stringify(data, null, 2)
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = safeJsonParse<Record<string, unknown>>(jsonData, null)
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format')
      }
      
      if (data.lists) await this.saveGroceryLists(data.lists)
      if (data.pantry) await this.savePantryItems(data.pantry)
      if (data.recipes) await this.saveData(STORAGE_KEYS.RECIPES, data.recipes)
      if (data.preferences) await this.saveUserPreferences(data.preferences)
      if (data.shoppingHistory) await this.saveData(STORAGE_KEYS.SHOPPING_HISTORY, data.shoppingHistory)
      if (data.notifications) await this.saveData(STORAGE_KEYS.NOTIFICATIONS, data.notifications)
    } catch (error) {
      throw new Error('Invalid data format')
    }
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS)
    await AsyncStorage.multiRemove(keys)
  }
}

// Export singleton instance
export const dataManager = new DataManager()
