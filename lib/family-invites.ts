/**
 * Client helpers for family plan (owner UI). Invites go through edge function for email + seat limits.
 */

import { supabase } from './supabase';

export type FamilyMemberRow = {
  id: string;
  invite_email: string | null;
  member_id: string | null;
  invite_code: string;
  status: 'pending' | 'accepted' | 'removed';
  invited_at: string;
  accepted_at: string | null;
};

function getFunctionErrorMessage(
  error: { message?: string; name?: string } | null,
  data: { error?: string } | null | undefined,
  fallback: string
): string {
  if (data?.error?.trim()) return data.error;
  if (error?.message?.trim()) return error.message;
  return fallback;
}

export async function ensureFamilyPlanId(ownerId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('family_plans')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('family_plans')
    .insert({ owner_id: ownerId })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? 'Could not create family plan');
  }
  return (created as { id: string }).id;
}

export async function listFamilyMembers(
  familyPlanId: string
): Promise<FamilyMemberRow[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select(
      'id, invite_email, member_id, invite_code, status, invited_at, accepted_at'
    )
    .eq('family_plan_id', familyPlanId)
    .order('invited_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FamilyMemberRow[];
}

export async function removeFamilyMember(memberRowId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ status: 'removed' })
    .eq('id', memberRowId);

  if (error) throw new Error(error.message);
}

export async function sendFamilyInviteEmail(email: string): Promise<{
  inviteCode?: string;
  emailSent: boolean;
  joinUrl?: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    inviteCode?: string;
    emailSent?: boolean;
    joinUrl?: string;
    error?: string;
  }>('send-family-invite', { body: { email: email.trim().toLowerCase() } });

  const message = getFunctionErrorMessage(
    error as { message?: string } | null,
    data,
    'Could not send family invite.'
  );
  if (error || data?.error) {
    throw new Error(message);
  }
  return {
    inviteCode: data?.inviteCode,
    emailSent: Boolean(data?.emailSent),
    joinUrl: data?.joinUrl,
  };
}

export async function acceptFamilyInviteWithCode(
  code: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'accept-family-invite',
    { body: { code: code.trim() } }
  );

  const message = getFunctionErrorMessage(
    error as { message?: string } | null,
    data,
    'Could not accept family invite.'
  );
  if (error || (data && 'error' in data && data.error)) {
    throw new Error(message);
  }
}

export async function getFamilyInvitePreview(code: string): Promise<{
  ownerFirstName: string;
  planType: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    ownerFirstName?: string;
    planType?: string;
    error?: string;
  }>('get-family-invite-preview', { body: { code: code.trim() } });

  const message = getFunctionErrorMessage(
    error as { message?: string } | null,
    data,
    'Could not load invite preview.'
  );
  if (error || data?.error) {
    throw new Error(message);
  }

  if (!data?.ownerFirstName || !data?.planType) {
    throw new Error('Invite preview is unavailable.');
  }

  return {
    ownerFirstName: data.ownerFirstName,
    planType: data.planType,
  };
}
