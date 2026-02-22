// SAVR Configuration Validator - Validates required environment variables on startup
import Constants from 'expo-constants'
import { ConfigurationError } from './errors'
import { logger } from './Logger'

interface RequiredConfig {
  key: string
  name: string
  description: string
  required: boolean
}

const REQUIRED_CONFIG: RequiredConfig[] = [
  {
    key: 'EXPO_PUBLIC_SUPABASE_URL',
    name: 'Supabase URL',
    description: 'Required for database connection',
    required: true,
  },
  {
    key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    name: 'Supabase Anon Key',
    description: 'Required for database authentication',
    required: true,
  },
]

function readEnv(name: string): string | undefined {
  // Check process.env first
  const fromProcess = (process.env as Record<string, string | undefined>)?.[name]
  if (fromProcess) return fromProcess

  // Check expo config extras
  const fromExtra = (Constants?.expoConfig as any)?.extra?.[name]
  if (fromExtra && typeof fromExtra === 'string') return fromExtra

  // Check unprefixed variant
  if (name.startsWith('EXPO_PUBLIC_')) {
    const alt = name.replace('EXPO_PUBLIC_', '')
    const fromProcessAlt = (process.env as Record<string, string | undefined>)?.[alt]
    if (fromProcessAlt) return fromProcessAlt
    const fromExtraAlt = (Constants?.expoConfig as any)?.extra?.[alt]
    if (fromExtraAlt && typeof fromExtraAlt === 'string') return fromExtraAlt
  }

  return undefined
}

export function validateConfiguration(): void {
  const missing: string[] = []
  const warnings: string[] = []

  for (const config of REQUIRED_CONFIG) {
    const value = readEnv(config.key)

    if (!value || value.trim() === '') {
      if (config.required) {
        missing.push(`${config.name} (${config.key})`)
      } else {
        warnings.push(`${config.name} (${config.key}) - ${config.description}`)
      }
    } else {
      logger.debug(`✅ Config validated: ${config.name}`)
    }
  }

  if (missing.length > 0) {
    const errorMessage = `Missing required configuration:\n${missing.map(m => `  - ${m}`).join('\n')}\n\nPlease add these to your .env file or app.config.js`
    logger.error('Configuration validation failed', { missing })
    
    // In production, log error but don't crash - let the app try to run
    // Supabase will handle missing config gracefully
    if (__DEV__) {
      throw new ConfigurationError(errorMessage, missing.join(', '))
    } else {
      console.error('⚠️ Configuration validation failed:', missing)
      console.error('⚠️ Some features may not work. Please configure environment variables in EAS.')
    }
  }

  if (warnings.length > 0 && __DEV__) {
    logger.warn('Optional configuration missing (features may be limited):', { warnings })
    console.warn(
      '⚠️  Optional configuration missing:\n' +
      warnings.map(w => `  - ${w}`).join('\n') +
      '\n\nSome features may not work without these keys.'
    )
  }

  logger.info('✅ Configuration validated successfully')
}

// Export helper to check if a specific config exists
export function hasConfig(key: string): boolean {
  const value = readEnv(key)
  return value !== undefined && value.trim() !== ''
}

// Export helper to get config value safely
export function getConfig(key: string, defaultValue?: string): string {
  const value = readEnv(key)
  if (!value || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new ConfigurationError(`Configuration key ${key} is not set and no default provided`, key)
  }
  return value
}
