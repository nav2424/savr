// Simple Theme Context - Minimal Dark/Light Mode Management
// Simplified version to avoid any complex issues

import React, { createContext, useContext, useEffect, useState } from 'react'
import { StatusBar } from 'react-native'
import { dataManager, UserPreferences } from './dataManager'

export type Theme = 'light' | 'dark'
export type ProgressiveTheme = 'warm'

interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  shadow: string
  success: string
  warning: string
  error: string
  info: string
}

interface ThemeContextType {
  theme: Theme
  progressiveTheme: ProgressiveTheme
  isDark: boolean
  colors: ThemeColors
  toggleTheme: () => Promise<void>
  setProgressiveTheme: (theme: ProgressiveTheme) => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Modern Minimal Color Palette - Clean, glassmorphic aesthetic
const warmColors: ThemeColors = {
  primary: '#6A9571', // Sage green - premium, calm, intelligent
  secondary: '#8E8E93', // Medium gray - sophisticated, readable
  accent: '#6A9571', // Sage green accent
  background: '#FEFCF6', // Off-white - warm, premium, calm
  surface: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white - glassmorphic
  text: '#000000', // Pure black - maximum contrast
  textSecondary: '#8E8E93', // Medium gray - secondary text
  border: 'rgba(255, 255, 255, 0.5)', // Semi-transparent borders - glass effect
  shadow: 'rgba(0, 0, 0, 0.15)', // Clean black shadows - depth
  success: '#6A9571', // Sage green - clean success
  warning: '#FFC107', // Modern yellow - clean warning
  error: '#DC3545', // Modern red - clean error
  info: '#6A9571' // Sage green - consistent branding
}

const darkColors: ThemeColors = {
  primary: '#63b3ed', // Bright tech blue for dark mode
  secondary: '#a0aec0', // Light warm gray
  accent: '#68d391', // Bright fresh green
  background: '#1a202c', // Deep charcoal background
  surface: 'rgba(255, 255, 255, 0.05)', // Subtle glassmorphism surface
  text: '#f7fafc', // Pure white for perfect contrast
  textSecondary: '#cbd5e0', // Light gray for secondary text
  border: 'rgba(255, 255, 255, 0.1)', // Subtle white borders
  shadow: 'rgba(0, 0, 0, 0.4)', // Deep shadows
  success: '#68d391', // Bright green for success
  warning: '#f6ad55', // Warm orange for warnings
  error: '#fc8181', // Soft red for errors
  info: '#63b3ed' // Bright blue for info
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export function SimpleThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const [progressiveTheme, setProgressiveTheme] = useState<ProgressiveTheme>('warm')
  const [isLoading, setIsLoading] = useState(true)

  // Load theme preferences on mount
  useEffect(() => {
    loadThemePreferences()
  }, [])

  // Update status bar when theme changes
  useEffect(() => {
    StatusBar.setBarStyle(theme === 'dark' ? 'light-content' : 'dark-content', true)
  }, [theme])

  const loadThemePreferences = async () => {
    try {
      const preferences = await dataManager.getUserPreferences()
      setTheme(preferences.theme)
    } catch (error) {
      console.error('Failed to load theme preferences:', error)
      // Default to light mode
      setTheme('light')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    
    try {
      const preferences = await dataManager.getUserPreferences()
      const updatedPreferences: UserPreferences = {
        ...preferences,
        theme: newTheme
      }
      await dataManager.saveUserPreferences(updatedPreferences)
    } catch (error) {
      console.error('Failed to save theme preference:', error)
    }
  }

  const handleSetProgressiveTheme = async (newProgressiveTheme: ProgressiveTheme) => {
    setProgressiveTheme(newProgressiveTheme)
    
    try {
      const preferences = await dataManager.getUserPreferences()
      const updatedPreferences: UserPreferences = {
        ...preferences,
        progressiveTheme: newProgressiveTheme
      }
      await dataManager.saveUserPreferences(updatedPreferences)
    } catch (error) {
      console.error('Failed to save progressive theme preference:', error)
    }
  }

  // Get current colors based on progressive theme
  const getColors = () => {
    if (theme === 'dark') return darkColors
    return warmColors
  }
  
  const colors = getColors()
  const isDark = theme === 'dark'

  const value: ThemeContextType = {
    theme,
    progressiveTheme,
    isDark,
    colors,
    toggleTheme,
    setProgressiveTheme: handleSetProgressiveTheme
  }

  if (isLoading) {
    // Return minimal loading state
    return (
      <ThemeContext.Provider value={value}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useSimpleTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useSimpleTheme must be used within a SimpleThemeProvider')
  }
  return context
}
