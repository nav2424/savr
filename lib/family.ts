/**
 * Family plan premium access (Supabase + RevenueCat via edge function).
 * Direct `pro` subscription is handled in SubscriptionContext / revenuecat.
 */

import { supabase } from './supabase';
import { getProStatusWithInfo } from './revenuecat';
import { resolveGrandfatheredPremiumForUser } from './grandfatherPremium';

/** DB grandfather flag and/or signup cutoff (see grandfatherPremium.ts). */
export async function fetchGrandfatheredPremium(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;
    return resolveGrandfatheredPremiumForUser(user);
  } catch {
    return false;
  }
}

/** True if RevenueCat `pro`, grandfathered lifetime, OR active family seat (edge-verified). */
export async function hasProAccess(): Promise<boolean> {
  const { hasPro } = await getProStatusWithInfo();
  if (hasPro) return true;
  if (await fetchGrandfatheredPremium()) return true;
  return fetchFamilyPremiumOnly();
}

/**
 * Family sharing only (skip RC). Used after we already know `!isSubscribed` from CustomerInfo.
 */
export async function fetchFamilyPremiumOnly(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;

    const { data: row, error } = await supabase
      .from('family_members')
      .select('family_plans!inner ( owner_id )')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();

    if (error || !row) return false;

    const ownerId = (row as { family_plans?: { owner_id?: string } }).family_plans
      ?.owner_id;
    if (!ownerId) return false;

    const { data, error: fnError } = await supabase.functions.invoke<{
      active?: boolean;
    }>('check-owner-subscription', { body: { ownerId } });

    // Graceful fallback for environments where edge functions are not deployed yet.
    if (fnError) return false;
    return data?.active === true;
  } catch {
    return false;
  }
}
