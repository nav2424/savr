/**
 * Secure storage adapter for Supabase auth.
 * Uses expo-secure-store (device keychain) when value fits; falls back to AsyncStorage
 * if SecureStore fails (e.g. value too large >2KB, or on web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const SECURE_SIZE_LIMIT = 2048 // iOS keychain limit per key

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>
  setItemAsync: (key: string, value: string) => Promise<void>
  deleteItemAsync: (key: string) => Promise<void>
}

let secureStoreModule: SecureStoreModule | null | undefined

function getSecureStore(): SecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule
  try {
    // Resolve at runtime so environments without ExpoSecureStore don't crash on import.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    secureStoreModule = require('expo-secure-store') as SecureStoreModule
  } catch {
    secureStoreModule = null
  }
  return secureStoreModule
}

/**
 * Storage adapter: SecureStore for auth tokens when possible, AsyncStorage fallback.
 * Supabase passes keys like sb-<project>-auth-token.
 */
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const SecureStore = getSecureStore()
    try {
      const value = await SecureStore?.getItemAsync(key)
      if (value != null) return value
    } catch {
      // SecureStore not available (e.g. web) or error
    }
    const legacy = await AsyncStorage.getItem(key)
    // Migrate legacy auth from AsyncStorage to SecureStore (one-time, non-blocking)
    if (SecureStore && legacy != null && legacy.length <= SECURE_SIZE_LIMIT) {
      SecureStore.setItemAsync(key, legacy)
        .then(() => AsyncStorage.removeItem(key))
        .catch(() => {})
    }
    return legacy
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const SecureStore = getSecureStore()
    if (value.length <= SECURE_SIZE_LIMIT) {
      try {
        if (!SecureStore) throw new Error('SecureStore unavailable')
        await SecureStore.setItemAsync(key, value)
        await AsyncStorage.removeItem(key) // Clear legacy from AsyncStorage
        return
      } catch {
        // Fall through to AsyncStorage
      }
    }
    await AsyncStorage.setItem(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    const SecureStore = getSecureStore()
    try {
      await SecureStore?.deleteItemAsync(key)
    } catch {
      // Ignore
    }
    try {
      await AsyncStorage.removeItem(key)
    } catch {
      // Ignore
    }
  },
}
