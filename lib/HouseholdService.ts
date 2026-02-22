// Household Service - Shared pantry households (create, join, invite, members)
import { supabase, Household, HouseholdMember, User } from './supabase'
import { logger } from './Logger'

class HouseholdService {
  async createHousehold(name: string = 'My Household'): Promise<{ data: Household | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) return { data: null, error: authError || new Error('Not authenticated') }

      const shareCode = await this.generateShareCode()
      const { data, error } = await supabase
        .from('households')
        .insert({
          name: name.trim() || 'My Household',
          owner_id: userData.user.id,
          share_code: shareCode,
        })
        .select()
        .single()

      if (error) return { data: null, error }

      // Add owner as accepted member so get_my_household_ids() and RLS work consistently
      const { error: memberErr } = await supabase.from('household_members').insert({
        household_id: data.id,
        user_id: userData.user.id,
        role: 'owner',
        added_by: userData.user.id,
        accepted: true,
      })
      if (memberErr) {
        logger.error('Failed to add owner to household_members', { householdId: data.id, error: memberErr })
        // Still return the household; migration or manual fix can add the member
      }
      logger.info('Household created', { householdId: data.id, name: data.name })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async getMyHouseholds(): Promise<{ data: Household[] | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) return { data: null, error: authError || new Error('Not authenticated') }

      const uid = userData.user.id
      const { data: owned } = await supabase
        .from('households')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false })

      const { data: memberRows } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', uid)
        .eq('accepted', true)

      const memberIds = (memberRows || []).map(r => r.household_id).filter(Boolean)
      if (memberIds.length === 0 && (owned || []).length > 0) {
        return { data: owned || [], error: null }
      }
      if (memberIds.length === 0) return { data: [], error: null }

      const { data: memberHouseholds } = await supabase
        .from('households')
        .select('*')
        .in('id', memberIds)
        .order('created_at', { ascending: false })

      const seen = new Set<string>((owned || []).map(h => h.id))
      const combined = [...(owned || [])]
      for (const h of memberHouseholds || []) {
        if (!seen.has(h.id)) {
          seen.add(h.id)
          combined.push(h)
        }
      }
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return { data: combined, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async getHouseholdMembers(householdId: string): Promise<{ data: HouseholdMember[] | null; error: any }> {
    try {
      const { data: household } = await supabase
        .from('households')
        .select('owner_id')
        .eq('id', householdId)
        .single()

      if (!household) return { data: null, error: new Error('Household not found') }

      const { data: members, error } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)

      if (error) return { data: null, error }

      const ownerProfile = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('id', household.owner_id)
        .single()

      const all: HouseholdMember[] = []
      if (ownerProfile.data) {
        all.push({
          id: `owner-${ownerProfile.data.id}`,
          household_id: householdId,
          user_id: ownerProfile.data.id,
          role: 'owner',
          added_by: null,
          added_at: '',
          accepted: true,
          user: ownerProfile.data as User,
        } as HouseholdMember)
      }
      const userIds = (members || []).filter(m => m.user_id !== household.owner_id).map(m => m.user_id)
      let userMap: Record<string, User> = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, name, email, avatar_url').in('id', userIds)
        userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.id]: u as User }), {})
      }
      for (const m of members || []) {
        if (m.user_id !== household.owner_id) {
          all.push({ ...m, user: userMap[m.user_id] } as HouseholdMember)
        }
      }
      return { data: all, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async inviteByEmail(householdId: string, email: string, role: 'editor' | 'viewer' = 'editor'): Promise<{ error: any }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { error: new Error('Not authenticated') }

      const { data: invitedUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (userError || !invitedUser) return { error: new Error('User not found. They need to sign up first.') }

      const { error } = await supabase.from('household_members').insert({
        household_id: householdId,
        user_id: invitedUser.id,
        role,
        added_by: userData.user.id,
        accepted: false,
      })
      return { error }
    } catch (error) {
      return { error }
    }
  }

  async joinByCode(shareCode: string): Promise<{ data: Household | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) return { data: null, error: authError || new Error('Not authenticated') }

      const normalized = shareCode.trim().toUpperCase()
      const fullCode = normalized.startsWith('SAVR-H-') ? normalized : `SAVR-H-${normalized}`

      // RLS blocks SELECT on households for non-members and INSERT for non-owners; use RPC to lookup + join in one call
      const { data: rows, error } = await supabase.rpc('join_household_by_code', {
        p_share_code: fullCode,
      })
      const household = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      if (error || !household) return { data: null, error: error || new Error('Household not found') }
      logger.info('Joined household', { householdId: household.id })
      return { data: household, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async leaveHousehold(householdId: string): Promise<{ error: any }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { error: new Error('Not authenticated') }

      const { data: household } = await supabase
        .from('households')
        .select('owner_id')
        .eq('id', householdId)
        .single()

      if (!household) return { error: new Error('Household not found') }
      if (household.owner_id === userData.user.id) return { error: new Error('Owner cannot leave. Transfer ownership or delete the household.') }

      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', userData.user.id)
      return { error }
    } catch (error) {
      return { error }
    }
  }

  async updateHouseholdName(householdId: string, name: string): Promise<{ data: Household | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) return { data: null, error: authError || new Error('Not authenticated') }

      const trimmed = (name || '').trim() || 'My Household'
      const { data, error } = await supabase
        .from('households')
        .update({ name: trimmed })
        .eq('id', householdId)
        .select()
        .single()
      if (error) return { data: null, error }
      logger.info('Household name updated', { householdId, name: trimmed })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async regenerateShareCode(householdId: string): Promise<{ data: Household | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData.user) return { data: null, error: authError || new Error('Not authenticated') }

      const { data: h } = await supabase.from('households').select('id, owner_id').eq('id', householdId).single()
      if (!h || h.owner_id !== userData.user.id) return { data: null, error: new Error('Only the owner can regenerate the share code') }

      const shareCode = await this.generateShareCode()
      const { data, error } = await supabase
        .from('households')
        .update({ share_code: shareCode })
        .eq('id', householdId)
        .select()
        .single()
      return error ? { data: null, error } : { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  private async generateShareCode(): Promise<string> {
    let code = ''
    let exists = true
    while (exists) {
      code = 'SAVR-H-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data, error } = await supabase.from('households').select('id').eq('share_code', code).maybeSingle()
      if (error) exists = false
      else exists = !!data
    }
    return code
  }
}

export const householdService = new HouseholdService()
