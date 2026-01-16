// Collaborative Lists Service - Real-time list management with Supabase
import { supabase, List, ListItem, Collaborator, Activity } from './supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { notificationsService, formatListNotification } from './NotificationsService'

class CollaborativeListsService {
  private subscriptions: Map<string, RealtimeChannel> = new Map()
  private subscriptionStates: Map<string, { status: string; errorCount: number; lastError?: number }> = new Map()

  // ============= LIST OPERATIONS =============

  async createList(name: string, icon: string, description?: string): Promise<{ data: List | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          // Invalid refresh token - silently sign out
          await supabase.auth.signOut().catch(() => {})
          return { data: null, error: new Error('Session expired. Please sign in again.') }
        }
        return { data: null, error: authError }
      }
      
      if (!userData.user) return { data: null, error: new Error('Not authenticated') }

      // Generate unique share code
      const shareCode = await this.generateShareCode()

      const { data, error } = await supabase
        .from('lists')
        .insert({
          name,
          icon,
          description,
          owner_id: userData.user.id,
          share_code: shareCode,
        })
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  async generateAndUpdateShareCode(listId: string): Promise<{ data: List | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          await supabase.auth.signOut().catch(() => {})
          return { data: null, error: new Error('Session expired. Please sign in again.') }
        }
        return { data: null, error: authError }
      }
      
      if (!userData.user) return { data: null, error: new Error('Not authenticated') }

      // First, check if the list exists and verify ownership
      const { data: listCheck, error: listCheckError } = await supabase
        .from('lists')
        .select('id, owner_id')
        .eq('id', listId)
        .maybeSingle()

      if (listCheckError) {
        return { data: null, error: listCheckError }
      }

      if (!listCheck) {
        return { data: null, error: new Error('List not found') }
      }

      // Verify user is the owner before proceeding
      const isOwner = listCheck.owner_id === userData.user.id
      
      if (!isOwner) {
        // Check if user is a collaborator to provide helpful message
        const { data: collaboratorCheck } = await supabase
          .from('collaborators')
          .select('id')
          .eq('list_id', listId)
          .eq('user_id', userData.user.id)
          .eq('accepted', true)
          .maybeSingle()

        return { data: null, error: new Error('Only the owner of the list can generate share codes.') }
      }

      // User is confirmed owner - generate and update share code
      const shareCode = await this.generateShareCode()

      // Update the list with the new share code
      const { data, error } = await supabase
        .from('lists')
        .update({ share_code: shareCode })
        .eq('id', listId)
        .eq('owner_id', userData.user.id) // Double-check ownership in update
        .select()
        .maybeSingle()

      if (error) {
        return { data: null, error }
      }

      if (!data) {
        // This shouldn't happen if user is owner, but handle gracefully
        return { data: null, error: new Error('Failed to update share code. Please try again.') }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async getUserLists(): Promise<{ data: List[] | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          await supabase.auth.signOut().catch(() => {})
          return { data: null, error: new Error('Session expired. Please sign in again.') }
        }
        return { data: null, error: authError }
      }
      
      if (!userData.user) return { data: null, error: new Error('Not authenticated') }

      // Get lists where user is the owner
      const { data: ownedLists, error: ownedError } = await supabase
        .from('lists')
        .select('*')
        .eq('owner_id', userData.user.id)
        .order('updated_at', { ascending: false })

      if (ownedError) {
        console.error('Error fetching owned lists:', ownedError)
      }

      // Get lists where user is a collaborator
      const { data: collaboratorRecords, error: collabError } = await supabase
        .from('collaborators')
        .select('list_id')
        .eq('user_id', userData.user.id)
        .eq('accepted', true)

      if (collabError) {
        console.error('Error fetching collaborator records:', collabError)
      }

      // Get the actual list data for collaborated lists
      let collaboratedLists: List[] = []
      if (collaboratorRecords && collaboratorRecords.length > 0) {
        const listIds = collaboratorRecords.map(c => c.list_id)
        const { data: collabListsData, error: collabListsError } = await supabase
          .from('lists')
          .select('*')
          .in('id', listIds)
          .order('updated_at', { ascending: false })

        if (collabListsError) {
          console.error('Error fetching collaborated lists:', collabListsError)
        } else if (collabListsData) {
          collaboratedLists = collabListsData
        }
      }

      // Combine both lists and remove duplicates
      const allLists = [...(ownedLists || []), ...collaboratedLists]
      const uniqueLists = allLists.filter((list, index, self) =>
        index === self.findIndex(l => l.id === list.id)
      )

      // Sort by updated_at descending
      uniqueLists.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime()
        const dateB = new Date(b.updated_at).getTime()
        return dateB - dateA
      })

      return { data: uniqueLists, error: ownedError || collabError || null }
    } catch (error) {
      console.error('Error in getUserLists:', error)
      return { data: null, error }
    }
  }

  async deleteList(listId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId)

    return { error }
  }

  async joinListByCode(shareCode: string): Promise<{ data: List | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          await supabase.auth.signOut().catch(() => {})
          return { data: null, error: new Error('Session expired. Please sign in again.') }
        }
        return { data: null, error: authError }
      }
      
      if (!userData.user) return { data: null, error: new Error('Not authenticated') }

      // Normalize share code - remove spaces, ensure uppercase format
      const trimmed = (shareCode || '').trim()
      const normalized = trimmed.replace(/\s+/g, '').toUpperCase()
      
      // Try multiple variants to be user-friendly
      const candidates = [
        normalized, // Most likely format: SAVR-XXXXXX
        trimmed.toUpperCase(), // Original uppercase
        trimmed, // Original as-is
        trimmed.replace(/\s+/g, ''), // No spaces, original case
      ].filter((v, i, arr) => v && arr.indexOf(v) === i)

      console.log('🔍 Joining list with share code:', shareCode)
      console.log('🔍 Normalized to:', normalized)
      console.log('🔍 Trying candidates:', candidates)

      let listRow: any = null
      let rpcError: any = null

      // Method 1: Try RPC function (bypasses RLS)
      for (const candidate of candidates) {
        try {
          console.log(`🔍 Attempting RPC call with: "${candidate}"`)
          const { data, error } = await supabase
            .rpc('get_list_by_share_code', { p_share_code: candidate })
          
          console.log(`📊 RPC response for "${candidate}":`, { 
            hasData: !!data, 
            dataType: Array.isArray(data) ? 'array' : typeof data,
            dataLength: Array.isArray(data) ? data.length : 'N/A',
            hasError: !!error,
            error: error ? error.message : null
          })
          
          if (error) {
            rpcError = error
            console.log(`❌ RPC error for "${candidate}":`, {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            })
            // Continue trying other variants
            continue
          }
          
          if (data) {
            // Handle both array and single result
            if (Array.isArray(data) && data.length > 0) {
              listRow = data[0]
              console.log('✅ Found list via RPC (array):', listRow.name)
              break
            } else if (!Array.isArray(data) && data) {
              listRow = data
              console.log('✅ Found list via RPC (single):', listRow.name)
              break
            } else if (Array.isArray(data) && data.length === 0) {
              console.log(`⚠️ RPC returned empty array for "${candidate}"`)
            }
          } else {
            console.log(`⚠️ RPC returned null/undefined for "${candidate}"`)
          }
        } catch (err) {
          console.log(`❌ RPC exception for "${candidate}":`, err)
          rpcError = err
        }
      }

      // Method 2: Direct query with case-insensitive search (may be blocked by RLS)
      if (!listRow) {
        console.log('🔄 RPC didn\'t find list, trying direct query as backup...')
        for (const candidate of candidates) {
          try {
            const { data: directData, error: directError } = await supabase
              .from('lists')
              .select('*')
              .ilike('share_code', candidate)
              .maybeSingle()
            
            if (directError) {
              console.log(`❌ Direct query error for "${candidate}":`, directError.message)
              // RLS might be blocking - that's okay, we'll rely on RPC
              continue
            }
            
            if (directData) {
              listRow = directData
              console.log('✅ Found list via direct query:', listRow.name)
              break
            }
          } catch (err) {
            console.log(`❌ Direct query exception for "${candidate}":`, err)
          }
        }
      }

      // Debug: Show what we found
      if (listRow) {
        console.log('✅ Successfully found list:', {
          id: listRow.id,
          name: listRow.name,
          share_code: listRow.share_code,
          owner_id: listRow.owner_id
        })
      } else {
        console.log('❌ List not found after trying all methods')
        if (rpcError) {
          console.error('RPC error details:', rpcError)
        }
        
        // Debug: Check what lists exist (may be limited by RLS)
        try {
          const { data: allLists, error: debugError } = await supabase
            .from('lists')
            .select('id, name, share_code')
            .limit(10)
          
          if (debugError) {
            console.log('⚠️ Could not fetch debug list (RLS may be blocking):', debugError.message)
          } else {
            console.log('📋 Available lists (may be filtered by RLS):', allLists)
          }
        } catch (err) {
          console.log('⚠️ Debug query failed:', err)
        }
        
        return { 
          data: null, 
          error: new Error(`List not found with share code "${shareCode}". Please check the code and try again.`) 
        }
      }

      // Check if already a collaborator
      const { data: existing, error: existingError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('list_id', listRow.id)
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (existingError) {
        console.error('Error checking existing collaborator:', existingError)
        return { data: null, error: existingError }
      }

      if (existing) return { data: listRow, error: null }

      // Add as collaborator
      const { error: colabError } = await supabase
        .from('collaborators')
        .insert({
          list_id: listRow.id,
          user_id: userData.user.id,
          role: 'editor',
          added_by: listRow.owner_id,
          accepted: true,
        })

      // Notify the list owner that someone joined
      if (!colabError && listRow.owner_id) {
        try {
          // Get the joining user's name
          const { data: joiningUserProfile } = await supabase
            .from('users')
            .select('name')
            .eq('id', userData.user.id)
            .single()

          const joiningUserName = joiningUserProfile?.name || 'Someone'
          
          // Send notification to the owner
          await notificationsService.sendNotificationToUser(
            listRow.owner_id,
            '👋 New Collaborator Joined',
            `${joiningUserName} joined your list "${listRow.name}"`,
            {
              type: 'collaborator_joined',
              listId: listRow.id,
              listName: listRow.name,
              screen: `/list-detail?id=${listRow.id}`
            }
          )
        } catch (notifError) {
          console.error('Error notifying owner of new collaborator:', notifError)
          // Don't fail the join if notification fails
        }
      }

      return { data: listRow, error: colabError }
    } catch (error) {
      return { data: null, error }
    }
  }

  // ============= ITEM OPERATIONS =============

  async getListItems(listId: string): Promise<{ data: ListItem[] | null; error: any }> {
    const { data, error } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })

    return { data, error }
  }

  async addItem(listId: string, item: Omit<ListItem, 'id' | 'list_id' | 'added_by' | 'added_by_name' | 'created_at' | 'updated_at'>): Promise<{ data: ListItem | null; error: any }> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          await supabase.auth.signOut().catch(() => {})
          return { data: null, error: new Error('Session expired. Please sign in again.') }
        }
        return { data: null, error: authError }
      }
      
      if (!userData.user) return { data: null, error: new Error('Not authenticated') }

      const { data: userProfile } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.user.id)
        .single()

      // Ensure category is included (use 'Groceries' as default if not provided)
      const itemData = {
        list_id: listId,
        added_by: userData.user.id,
        added_by_name: userProfile?.name || 'Unknown',
        name: item.name,
        category: item.category || 'Groceries', // Ensure category is always set
        quantity: item.quantity || '1',
        notes: item.notes || null,
        completed: item.completed || false,
        added_date: item.added_date || new Date().toISOString().split('T')[0],
      }

      console.log('📝 Adding item with category:', itemData.category, 'for item:', itemData.name)

      const { data, error } = await supabase
        .from('list_items')
        .insert(itemData)
        .select()
        .single()

      // Send push notification only if user is NOT the owner
      // If owner adds item, no notification. If collaborator adds, notify owner and other collaborators
      if (data) {
        const { data: listData } = await supabase
          .from('lists')
          .select('name, owner_id')
          .eq('id', listId)
          .single()

        if (listData) {
          // Only send notification if the person adding is NOT the owner
          const isOwner = listData.owner_id === userData.user.id
          
          if (!isOwner) {
            const notification = formatListNotification(
              'added',
              userProfile?.name || 'Someone',
              item.name,
              listData.name
            )
            
            // Notify owner and all other collaborators (excluding current user)
            await notificationsService.notifyListCollaborators(
              listId,
              notification.title,
              notification.body,
              {
                type: 'item_added',
                listId,
                listName: listData.name,
                itemName: item.name,
                screen: `/list-detail?id=${listId}`
              }
            )
          }
        }
      }

      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  async updateItem(itemId: string, updates: Partial<ListItem>): Promise<{ error: any }> {
    const { error } = await supabase
      .from('list_items')
      .update(updates)
      .eq('id', itemId)

    return { error }
  }

  async toggleItemCompletion(itemId: string, completed: boolean): Promise<{ error: any }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { error: new Error('Not authenticated') }

      const { data: userProfile } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.user.id)
        .single()

      // Get item details for notification
      const { data: itemData } = await supabase
        .from('list_items')
        .select('name, list_id')
        .eq('id', itemId)
        .single()

      const updates: any = {
        completed,
      }

      if (completed) {
        updates.completed_by = userData.user.id
        updates.completed_by_name = userProfile?.name || 'Unknown'
        updates.completed_date = new Date().toISOString().split('T')[0]
      } else {
        updates.completed_by = null
        updates.completed_by_name = null
        updates.completed_date = null
      }

      const { error } = await supabase
        .from('list_items')
        .update(updates)
        .eq('id', itemId)

      // Send push notification to collaborators
      if (!error && itemData) {
        const { data: listData } = await supabase
          .from('lists')
          .select('name')
          .eq('id', itemData.list_id)
          .single()

        if (listData) {
          const notification = formatListNotification(
            completed ? 'completed' : 'uncompleted',
            userProfile?.name || 'Someone',
            itemData.name,
            listData.name
          )
          
          await notificationsService.notifyListCollaborators(
            itemData.list_id,
            notification.title,
            notification.body
          )
        }
      }

      return { error }
    } catch (error) {
      return { error }
    }
  }

  async deleteItem(itemId: string): Promise<{ error: any }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { error: new Error('Not authenticated') }

      // Get item details before deleting for notification
      const { data: itemData } = await supabase
        .from('list_items')
        .select('name, list_id, added_by')
        .eq('id', itemId)
        .single()

      if (!itemData) {
        return { error: new Error('Item not found') }
      }

      // Get list and user info for notification
      const { data: listData } = await supabase
        .from('lists')
        .select('name, owner_id')
        .eq('id', itemData.list_id)
        .single()

      const { data: userProfile } = await supabase
        .from('users')
        .select('name')
        .eq('id', userData.user.id)
        .single()

      // Delete the item
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId)

      // Send notification only if user deleting is NOT the owner
      // If owner deletes, no notification. If collaborator deletes, notify owner and other collaborators
      if (!error && listData) {
        const isOwner = listData.owner_id === userData.user.id
        
        if (!isOwner) {
          const notification = formatListNotification(
            'removed',
            userProfile?.name || 'Someone',
            itemData.name,
            listData.name
          )
          
          // Notify owner and all other collaborators (excluding current user)
          await notificationsService.notifyListCollaborators(
            itemData.list_id,
            notification.title,
            notification.body,
            {
              type: 'item_deleted',
              listId: itemData.list_id,
              listName: listData.name,
              itemName: itemData.name,
              screen: `/list-detail?id=${itemData.list_id}`
            }
          )
        }
      }

      return { error }
    } catch (error) {
      return { error }
    }
  }

  // ============= COLLABORATOR OPERATIONS =============

  async getListCollaborators(listId: string): Promise<{ data: Collaborator[] | null; error: any }> {
    try {
      // Get the list to find the owner
      const { data: listData } = await supabase
        .from('lists')
        .select('owner_id')
        .eq('id', listId)
        .single()

      if (!listData) {
        return { data: null, error: new Error('List not found') }
      }

      // Get all accepted collaborators
      // Specify the relationship explicitly: users!collaborators_user_id_fkey for the collaborator user
      const { data: collaborators, error } = await supabase
        .from('collaborators')
        .select(`
          *,
          user:users!collaborators_user_id_fkey (
            id,
            name,
            email,
            avatar_url
          ),
          added_by_user:users!collaborators_added_by_fkey (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('list_id', listId)
        .eq('accepted', true)

      if (error) {
        return { data: null, error }
      }

      // Get owner's profile
      const { data: ownerProfile } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('id', listData.owner_id)
        .single()

      // Combine owner and collaborators
      const allCollaborators: Collaborator[] = []

      // Add owner first
      if (ownerProfile) {
        allCollaborators.push({
          id: `owner-${ownerProfile.id}`,
          list_id: listId,
          user_id: ownerProfile.id,
          role: 'owner' as const,
          added_by: ownerProfile.id,
          added_at: new Date().toISOString(),
          accepted: true,
          user: ownerProfile,
        })
      }

      // Add other collaborators
      if (collaborators) {
        allCollaborators.push(...collaborators)
      }

      return { data: allCollaborators, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  async inviteCollaborator(listId: string, email: string, role: 'editor' | 'viewer'): Promise<{ error: any }> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { error: new Error('Not authenticated') }

      // Find user by email
      const { data: invitedUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError || !invitedUser) {
        return { error: new Error('User not found. They need to sign up first.') }
      }

      // Add as collaborator
      const { error } = await supabase
        .from('collaborators')
        .insert({
          list_id: listId,
          user_id: invitedUser.id,
          role,
          added_by: userData.user.id,
          accepted: false, // They need to accept the invitation
        })

      return { error }
    } catch (error) {
      return { error }
    }
  }

  async removeCollaborator(collaboratorId: string): Promise<{ error: any }> {
    try {
      // Handle owner ID format (owner-xxx) - owners can't be removed
      if (collaboratorId.startsWith('owner-')) {
        return { error: new Error('Cannot remove list owner') }
      }

      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', collaboratorId)

      return { error }
    } catch (error) {
      return { error }
    }
  }

  async acceptInvitation(collaboratorId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('collaborators')
      .update({ accepted: true })
      .eq('id', collaboratorId)

    return { error }
  }

  // ============= ACTIVITY FEED =============

  async getListActivity(listId: string, limit: number = 50): Promise<{ data: Activity[] | null; error: any }> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { data, error }
  }

  // ============= REALTIME SUBSCRIPTIONS =============

  subscribeToList(listId: string, callbacks: {
    onItemAdded?: (item: ListItem) => void
    onItemUpdated?: (item: ListItem) => void
    onItemDeleted?: (itemId: string) => void
    onCollaboratorAdded?: (collaborator: Collaborator) => void
    onActivityLogged?: (activity: Activity) => void
  }) {
    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          console.log(`📥 Real-time INSERT event received for list ${listId}:`, payload.new)
          if (callbacks.onItemAdded) {
            callbacks.onItemAdded(payload.new as ListItem)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          console.log(`📝 Real-time UPDATE event received for list ${listId}:`, payload.new)
          if (callbacks.onItemUpdated) {
            callbacks.onItemUpdated(payload.new as ListItem)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          console.log(`🗑️ Real-time DELETE event received for list ${listId}:`, payload.old)
          if (callbacks.onItemDeleted) {
            callbacks.onItemDeleted(payload.old.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (callbacks.onActivityLogged) {
            callbacks.onActivityLogged(payload.new as Activity)
          }
        }
      )
      .subscribe((status) => {
        // Check if subscription state exists (might have been deleted during intentional unsubscribe)
        const existingState = this.subscriptionStates.get(listId)
        if (!existingState) {
          // State was deleted, likely from intentional unsubscribe - ignore this callback
          return
        }
        
        const state = existingState
        const statusString = String(status)
        state.status = statusString
        
        if (statusString === 'SUBSCRIBED') {
          // Reset error count on successful connection
          state.errorCount = 0
          state.lastError = undefined
          this.subscriptionStates.set(listId, state)
          console.log(`✅ Real-time subscription CONNECTED for list: ${listId}`)
        } else if (statusString === 'CHANNEL_ERROR' || statusString === 'TIMED_OUT') {
          // Only count CHANNEL_ERROR and TIMED_OUT as errors, not CLOSED
          // CLOSED can happen from intentional unsubscribes
          state.errorCount++
          state.lastError = Date.now()
          this.subscriptionStates.set(listId, state)
          
          // Only log as error if it's a persistent issue (multiple errors)
          // Transient errors during initial connection are normal
          if (state.errorCount > 3) {
            console.error(`❌ Real-time subscription ERROR (persistent) for list: ${listId} (${state.errorCount} errors, status: ${statusString})`)
          } else {
            console.warn(`⚠️ Real-time subscription transient error for list: ${listId} (status: ${statusString}, will retry)`)
          }
        } else if (statusString === 'CLOSED') {
          // CLOSED status - only log if state still exists (unexpected closure)
          // If state was deleted, it was an intentional unsubscribe
          console.log(`🔌 Real-time subscription CLOSED for list: ${listId} (${existingState ? 'unexpected' : 'intentional'})`)
          // Don't increment error count for CLOSED - it's often intentional
        } else {
          // Reset error count for other statuses (like JOINING, JOINED, etc.)
          state.errorCount = 0
          this.subscriptionStates.set(listId, state)
          console.log(`🔄 Real-time subscription status for list ${listId}:`, statusString)
        }
      })

    this.subscriptions.set(listId, channel)
  }

  unsubscribeFromList(listId: string) {
    const channel = this.subscriptions.get(listId)
    if (channel) {
      // Delete subscription state FIRST to prevent CLOSED status from counting as error
      // This ensures intentional unsubscribes don't trigger error callbacks
      this.subscriptionStates.delete(listId)
      this.subscriptions.delete(listId)
      supabase.removeChannel(channel)
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.subscriptions.clear()
    // Clean up all subscription state tracking
    this.subscriptionStates.clear()
  }

  // ============= HELPER FUNCTIONS =============

  private async generateShareCode(): Promise<string> {
    let code = ''
    let exists = true

    while (exists) {
      code = 'SAVR-' + Math.random().toString(36).substring(2, 8).toUpperCase()

      const { data, error } = await supabase
        .from('lists')
        .select('id')
        .eq('share_code', code)
        .maybeSingle()

      if (error) {
        console.error('Error checking share code uniqueness:', error)
        // If there's an error, assume it doesn't exist and break
        exists = false
      } else {
        exists = !!data
      }
    }

    return code
  }

  private async getCollaboratingListIds(): Promise<string> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return ''

      const { data } = await supabase
        .from('collaborators')
        .select('list_id')
        .eq('user_id', userData.user.id)
        .eq('accepted', true)

      if (!data || data.length === 0) return ''

      return data.map(c => c.list_id).join(',')
    } catch {
      return ''
    }
  }
}

export const collaborativeListsService = new CollaborativeListsService()


