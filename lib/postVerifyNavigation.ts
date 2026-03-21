import AsyncStorage from '@react-native-async-storage/async-storage'
import { config } from '../config'
import { supabase } from './supabase'
import { trialEndIsoFromUserCreatedAt } from './freeTrial'

type ReplaceFn = (href: string | { pathname: string; params: Record<string, string> }) => void

function dismissedKey(userId: string) {
  return `post_verify_welcome_done_${userId}`
}

/**
 * After email is verified: first time (per user) with paywall enabled → welcome + trial copy on /paywall.
 * Otherwise → main tabs.
 */
export async function replaceAfterEmailVerified(replace: ReplaceFn): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id
  const trialEndsAt =
    trialEndIsoFromUserCreatedAt(user?.created_at ?? undefined) ?? ''

  let alreadyDismissed = false
  if (uid) {
    try {
      alreadyDismissed = (await AsyncStorage.getItem(dismissedKey(uid))) === '1'
    } catch {
      alreadyDismissed = false
    }
  }

  if (config.enablePaywall && uid && !alreadyDismissed && trialEndsAt) {
    replace({
      pathname: '/paywall',
      params: { trialEndsAt, welcome: '1' },
    })
    return
  }

  replace('/(tabs)')
}

export async function markPostVerifyWelcomeDone(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(dismissedKey(userId), '1')
  } catch {
    /* non-blocking */
  }
}
