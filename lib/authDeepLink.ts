// Parse Supabase auth tokens from email verification / magic link URL and establish session
import Constants from 'expo-constants'
import { supabase } from './supabase'

type EmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'

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

/** Merge ?query and #hash segments so PKCE (?code=) and implicit (#access_token=) both work. */
export function collectUrlAuthParams(url: string): URLSearchParams {
  const merged = new URLSearchParams()
  try {
    const q = url.indexOf('?')
    const h = url.indexOf('#')
    if (q >= 0) {
      const end = h >= 0 && h > q ? h : url.length
      const queryPart = url.slice(q + 1, end)
      new URLSearchParams(queryPart).forEach((v, k) => merged.set(k, v))
    }
    if (h >= 0) {
      new URLSearchParams(url.slice(h + 1)).forEach((v, k) => merged.set(k, v))
    }
  } catch {
    /* ignore */
  }
  return merged
}

/** Parse access_token and refresh_token from URL (hash and/or query). */
export function getAuthTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  const params = collectUrlAuthParams(url)
  return {
    access_token: params.get('access_token') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
  }
}

const EMAIL_OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function parseEmailOtpType(raw: string | null): EmailOtpType {
  if (raw && EMAIL_OTP_TYPES.has(raw)) {
    return raw as EmailOtpType
  }
  return 'signup'
}

/** True if this URL likely needs session exchange (call before routing so child effects see a session). */
export function urlMayNeedSessionExchange(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (
    !lower.includes('email-verification') &&
    !lower.includes('password-reset')
  ) {
    return false
  }
  const p = collectUrlAuthParams(url)
  return Boolean(
    p.get('code') ||
      p.get('token_hash') ||
      p.get('access_token') ||
      p.get('refresh_token')
  )
}

/**
 * Establish Supabase session from redirect URL:
 * - PKCE: ?code= (needs code_verifier in storage from same device signup)
 * - token_hash + type (some Supabase email templates)
 * - Implicit: #access_token= & refresh_token=
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  try {
    const params = collectUrlAuthParams(url)
    const code = params.get('code')
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        if (__DEV__) console.warn('[authDeepLink] PKCE exchange failed:', error.message)
        return false
      }
      return Boolean(data?.session)
    }

    const tokenHash = params.get('token_hash')
    if (tokenHash) {
      const type = parseEmailOtpType(params.get('type'))
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (error) {
        if (__DEV__) console.warn('[authDeepLink] verifyOtp token_hash failed:', error.message)
        return false
      }
      return Boolean(data?.session)
    }

    const { access_token, refresh_token } = getAuthTokensFromUrl(url)
    if (!access_token) return false
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    })
    if (error) {
      if (__DEV__) console.warn('[authDeepLink] setSession failed:', error.message)
      return false
    }
    return true
  } catch (e) {
    if (__DEV__) console.warn('[authDeepLink] createSessionFromUrl exception:', e)
    return false
  }
}

/** Run session exchange and refresh JWT so email_confirmed_at is visible to getUser(). */
export async function processAuthDeepLink(url: string): Promise<boolean> {
  if (!urlMayNeedSessionExchange(url)) return false
  const ok = await createSessionFromUrl(url)
  if (ok) {
    await supabase.auth.refreshSession().catch(() => {})
  }
  return ok
}
