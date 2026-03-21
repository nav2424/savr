/**
 * Lifetime complimentary premium for early accounts (DB flag and/or signup cutoff).
 * See supabase/migrations/*_grandfather_lifetime_premium.sql and EXPO_PUBLIC_PAYWALL_GRANDFATHER_CUTOFF_ISO.
 */

import config from '../config';
import { supabase } from './supabase';

export function isAccountGrandfatheredBySignupDate(
  createdAtIso: string | undefined
): boolean {
  const cutoff = config.paywallGrandfatherCutoffIso?.trim();
  if (!cutoff || !createdAtIso) return false;
  const c = new Date(cutoff);
  const a = new Date(createdAtIso);
  if (Number.isNaN(c.getTime()) || Number.isNaN(a.getTime())) return false;
  return a.getTime() < c.getTime();
}

export async function resolveGrandfatheredPremiumForUser(user: {
  id: string;
  created_at?: string;
}): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('grandfathered_lifetime_premium')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn('[grandfatherPremium] users row fetch failed:', error.message);
      }
      // Don’t grant grandfather via cutoff when we can’t read the row (avoids overriding an explicit false).
      return false;
    }

    // Row exists: DB boolean is authoritative — true or false both short-circuit (no cutoff override).
    if (profile != null) {
      if (profile.grandfathered_lifetime_premium === true) return true;
      if (profile.grandfathered_lifetime_premium === false) return false;
    }

    // No public.users row (or empty result): client cutoff fallback only here.
    return isAccountGrandfatheredBySignupDate(user.created_at);
  } catch {
    return false;
  }
}
