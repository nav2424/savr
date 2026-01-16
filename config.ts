// SAVR Configuration
// Add your API keys here
import Constants from 'expo-constants'

function readEnv(name: string, fallback: string = ''): string {
  // Prefer process.env for EXPO_PUBLIC_* inlines
  const fromProcess = (process.env as any)?.[name]
  if (fromProcess && typeof fromProcess === 'string') return fromProcess

  // Fallback to app config extras (useful in dev clients/TestFlight)
  const fromExtra = (Constants?.expoConfig as any)?.extra?.[name]
  if (fromExtra && typeof fromExtra === 'string') return fromExtra

  // Also check unprefixed variant (OPENAI_API_KEY)
  if (name.startsWith('EXPO_PUBLIC_')) {
    const alt = name.replace('EXPO_PUBLIC_', '')
    const fromProcessAlt = (process.env as any)?.[alt]
    if (fromProcessAlt && typeof fromProcessAlt === 'string') return fromProcessAlt
    const fromExtraAlt = (Constants?.expoConfig as any)?.extra?.[alt]
    if (fromExtraAlt && typeof fromExtraAlt === 'string') return fromExtraAlt
  }

  return fallback
}

export const config = {
  // OpenAI API - Get from: https://platform.openai.com/api-keys
  openaiApiKey: readEnv('EXPO_PUBLIC_OPENAI_API_KEY', ''),
  openaiModel: 'gpt-4o',
  // Optional fallback model to improve availability under load
  openaiFallbackModel: 'gpt-4o',
  // Retry behavior for transient errors (429, network)
  openaiMaxRetries: 2,
  openaiInitialRetryMs: 600,
  openaiTemperature: 0.7,
  openaiMaxTokens: 500,
  
  // OpenRouter (multi-provider) fallback - optional
  openrouterApiKey: readEnv('EXPO_PUBLIC_OPENROUTER_API_KEY', ''),
  openrouterModel: 'openrouter/auto',
  
  // API base for proxy server
  apiBase: readEnv('API_BASE', 'http://localhost:3000'),
  
  // Supabase - Get from: https://app.supabase.com (Project Settings > API)
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
}

export default config
