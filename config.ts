// SAVR Configuration
// Add your API keys here
import Constants from 'expo-constants'

function readEnv(name: string, fallback: string = ''): string {
  // Prefer process.env for EXPO_PUBLIC_* inlines
  const fromProcess = (process.env as any)?.[name]
  if (fromProcess && typeof fromProcess === 'string') return fromProcess

  // Fallback to app config extras (useful in dev clients/TestFlight)
  const fromExtra =
    (Constants?.expoConfig as any)?.extra?.[name] ??
    (Constants?.manifest as any)?.extra?.[name] ??
    (Constants?.manifest2 as any)?.extra?.[name]
  if (fromExtra && typeof fromExtra === 'string') return fromExtra

  // Also check unprefixed variant (OPENAI_API_KEY)
  if (name.startsWith('EXPO_PUBLIC_')) {
    const alt = name.replace('EXPO_PUBLIC_', '')
    const fromProcessAlt = (process.env as any)?.[alt]
    if (fromProcessAlt && typeof fromProcessAlt === 'string') return fromProcessAlt
    const fromExtraAlt =
      (Constants?.expoConfig as any)?.extra?.[alt] ??
      (Constants?.manifest as any)?.extra?.[alt] ??
      (Constants?.manifest2 as any)?.extra?.[alt]
    if (fromExtraAlt && typeof fromExtraAlt === 'string') return fromExtraAlt
  }

  return fallback
}

export const config = {
  // OpenAI API - do not expose in client env (use server proxy instead)
  get openaiApiKey() {
    return readEnv('OPENAI_API_KEY', '')
  },
  get openaiModel() {
    return 'gpt-4o'
  },
  // Optional fallback model to improve availability under load
  get openaiFallbackModel() {
    return 'gpt-4o'
  },
  // Retry behavior for transient errors (429, network)
  get openaiMaxRetries() {
    return 2
  },
  get openaiInitialRetryMs() {
    return 600
  },
  get openaiTemperature() {
    return 0.7
  },
  get openaiMaxTokens() {
    return 500
  },
  
  // OpenRouter (multi-provider) fallback - optional
  get openrouterApiKey() {
    return readEnv('EXPO_PUBLIC_OPENROUTER_API_KEY', '')
  },
  get openrouterModel() {
    return 'openrouter/auto'
  },
  
  // API base for proxy server
  get apiBase() {
    // Prefer Expo public env to support device builds; fall back to API_BASE.
    return readEnv('EXPO_PUBLIC_API_BASE', readEnv('API_BASE', 'http://localhost:3000'))
  },
  
  // Supabase - Get from: https://app.supabase.com (Project Settings > API)
  get supabaseUrl() {
    return readEnv('EXPO_PUBLIC_SUPABASE_URL', '')
  },
  get supabaseAnonKey() {
    return readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '')
  },

  // Feature flags – set EXPO_PUBLIC_ENABLE_* to "true" or "1" to enable
  get enablePaywall(): boolean {
    const v = readEnv('EXPO_PUBLIC_ENABLE_PAYWALL', '').toLowerCase()
    return v === 'true' || v === '1'
  },
  get enableRecipes(): boolean {
    const v = readEnv('EXPO_PUBLIC_ENABLE_RECIPES', '').toLowerCase()
    return v === 'true' || v === '1'
  },

  /**
   * ISO datetime (UTC): accounts with auth created_at strictly before this get premium without RevenueCat
   * when the DB grandfather column is false/missing (fallback if migration not applied yet).
   * Set to empty string to disable client-side cutoff (DB flag only).
   */
  get paywallGrandfatherCutoffIso(): string {
    return readEnv(
      'EXPO_PUBLIC_PAYWALL_GRANDFATHER_CUTOFF_ISO',
      '2026-03-20T00:00:00.000Z'
    )
  },
}

export default config
