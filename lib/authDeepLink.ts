// Parse Supabase auth tokens from email verification / magic link URL and establish session
import Constants from 'expo-constants'
import { supabase } from './supabase'

/**
 * Canonical redirect URL for email verification. Must match Supabase Dashboard → Auth → URL Configuration → Redirect URLs exactly.
 * Use savr://email-verification (no path slashes) so the link in the email opens the app, not the website.
 * If this doesn't match Supabase, Supabase falls back to Site URL (e.g. savrgrocery.com) and the user lands on the landing page.
 */
export function getEmailVerificationRedirectUrl(): string {
  const fromEnv = (Constants.expoConfig?.extra as Record<string, string | undefined>)?.EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL
  if (fromEnv?.trim()) return fromEnv.trim()
  return 'savr://email-verification'
}

/**
 * Canonical redirect URL for password reset. Must match Supabase Dashboard → Auth → URL Configuration → Redirect URLs exactly.
 * Use savr://password-reset so the link in the email opens the app.
 */
export function getPasswordResetRedirectUrl(): string {
  const fromEnv = (Constants.expoConfig?.extra as Record<string, string | undefined>)?.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL
  if (fromEnv?.trim()) return fromEnv.trim()
  return 'savr://password-reset'
}

/** Parse access_token and refresh_token from URL hash or query (Supabase redirect). */
export function getAuthTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  try {
    const hashIndex = url.indexOf('#')
    const queryIndex = url.indexOf('?')
    const queryPart =
      queryIndex >= 0
        ? url.slice(queryIndex + 1, hashIndex > queryIndex ? hashIndex : undefined)
        : ''
    const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : ''
    if (!queryPart && !hashPart) return {}

    const queryParams = new URLSearchParams(queryPart)
    const hashParams = new URLSearchParams(hashPart)

    // Supabase usually sends tokens in hash; keep that priority but support query+hash split URLs.
    const access_token =
      hashParams.get('access_token') ?? queryParams.get('access_token') ?? undefined
    const refresh_token =
      hashParams.get('refresh_token') ?? queryParams.get('refresh_token') ?? undefined
    return { access_token, refresh_token }
  } catch {
    return {}
  }
}

/** Create Supabase session from URL so user is signed in when returning from email verification link. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const { access_token, refresh_token } = getAuthTokensFromUrl(url)
  if (!access_token) return false
  try {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    })
    if (error) return false
    return true
  } catch {
    return false
  }
}
