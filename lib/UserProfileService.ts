// SAVR User Profile Service - Propagates name updates across the app
import { supabase } from './supabase'
import { logger } from './Logger'

/**
 * Updates the user's display name everywhere it appears:
 * - public.users.name (canonical source)
 * - list_items.added_by_name (where added_by = userId)
 * - list_items.completed_by_name (where completed_by = userId)
 * - activities.user_name (where user_id = userId)
 *
 * Call this when the user updates their name in profile settings.
 */
export async function propagateUserName(userId: string, fullName: string): Promise<{ error?: Error }> {
  const trimmed = (fullName || '').trim()
  if (!trimmed) {
    return { error: new Error('Name cannot be empty') }
  }

  try {
    // 1. Update canonical source: public.users
    const { error: usersError } = await supabase
      .from('users')
      .update({ name: trimmed })
      .eq('id', userId)

    if (usersError) {
      logger.error('Failed to update users.name', { error: usersError, userId })
      return { error: usersError as Error }
    }

    // 2. Update denormalized copies in list_items (added_by_name)
    const { error: addedByError } = await supabase
      .from('list_items')
      .update({ added_by_name: trimmed })
      .eq('added_by', userId)

    if (addedByError) {
      logger.warn('Failed to update list_items.added_by_name', { error: addedByError, userId })
      // Non-fatal - continue
    }

    // 3. Update denormalized copies in list_items (completed_by_name)
    const { error: completedByError } = await supabase
      .from('list_items')
      .update({ completed_by_name: trimmed })
      .eq('completed_by', userId)

    if (completedByError) {
      logger.warn('Failed to update list_items.completed_by_name', { error: completedByError, userId })
      // Non-fatal - continue
    }

    // 4. Update denormalized copies in activities
    const { error: activitiesError } = await supabase
      .from('activities')
      .update({ user_name: trimmed })
      .eq('user_id', userId)

    if (activitiesError) {
      logger.warn('Failed to update activities.user_name', { error: activitiesError, userId })
      // Non-fatal - continue
    }

    logger.debug('Propagated user name update', { userId, name: trimmed })
    return {}
  } catch (err) {
    logger.error('propagateUserName failed', { error: err, userId })
    return { error: err instanceof Error ? err : new Error(String(err)) }
  }
}
