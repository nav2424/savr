// Supabase Client Configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import config from '../config'

let supabaseClient: SupabaseClient | null = null

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = config.supabaseUrl || ''
  const supabaseAnonKey = config.supabaseAnonKey || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = 'Supabase configuration is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in EAS environment variables.'
    console.error('⚠️', errorMessage)
    // Throw error but with better message - ErrorBoundary will catch it
    throw new Error(errorMessage)
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })

  return supabaseClient
}

// Lazy proxy so config can hydrate before client is created
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient() as any
    return client[prop]
  },
}) as SupabaseClient

// Database types
export interface User {
  id: string
  email: string
  name: string
  nickname?: string
  avatar_url?: string
  created_at: string
  last_seen: string
}

export interface List {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  owner_id: string
  created_at: string
  updated_at: string
  share_code: string
}

export interface ListItem {
  id: string
  list_id: string
  name: string
  category: string
  quantity: string
  notes?: string
  completed: boolean
  added_by: string
  added_by_name: string
  added_date: string
  completed_by?: string
  completed_by_name?: string
  completed_date?: string
  created_at: string
  updated_at: string
}

export interface Collaborator {
  id: string
  list_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  added_by: string
  added_at: string
  accepted: boolean
  user?: User
}

export interface Activity {
  id: string
  list_id: string
  user_id: string
  user_name: string
  action: 'added_item' | 'removed_item' | 'completed_item' | 'uncompleted_item' | 'updated_item' | 'added_collaborator' | 'removed_collaborator'
  item_name?: string
  details?: string
  created_at: string
}

export interface Household {
  id: string
  name: string
  owner_id: string
  share_code: string | null
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  added_by: string | null
  added_at: string
  accepted: boolean
  user?: User
}

export interface PantryItem {
  id: string
  user_id: string
  household_id?: string | null
  added_by?: string | null
  name: string
  icon: string
  category: string
  quantity: number
  unit: string
  location: 'fridge' | 'freezer' | 'pantry'
  expiry_date?: string
  purchase_date?: string
  price?: number
  store?: string
  notes?: string
  barcode?: string
  brand?: string
  image_url?: string
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  name: string
  quantity: string
  unit: string
}

export interface RecipeInstruction {
  step: number
  description: string
}

export interface Recipe {
  id: string
  title: string
  description?: string
  image_url?: string
  prep_time?: number
  cook_time?: number
  servings: number
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  cuisine_type?: string
  meal_type?: string
  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  tags: string[]
  source: 'user_created' | 'ai_generated' | 'imported' | 'curated'
  created_by?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface SavedRecipe {
  id: string
  user_id: string
  recipe_id: string
  notes?: string
  rating?: number
  is_favorite: boolean
  last_cooked?: string
  times_cooked: number
  custom_ingredients?: RecipeIngredient[]
  custom_instructions?: RecipeInstruction[]
  created_at: string
  updated_at: string
  recipe?: Recipe
}

export interface RecipeCollection {
  id: string
  user_id: string
  name: string
  description?: string
  icon: string
  color: string
  recipe_ids: string[]
  created_at: string
  updated_at: string
}


