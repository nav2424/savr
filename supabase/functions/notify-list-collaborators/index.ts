/**
 * Supabase Edge Function: Notify List Collaborators
 *
 * Sends push notifications to all list collaborators (and owner),
 * excluding the user who triggered the event.
 *
 * Deploy:
 *   supabase functions deploy notify-list-collaborators
 *
 * Set secrets:
 *   supabase secrets set SUPABASE_URL=your-url
 *   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
 *   supabase secrets set SUPABASE_ANON_KEY=your-anon-key
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type NotifyRequest = {
  listId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

const LIST_UPDATE_TYPES = new Set([
  'list_update',
  'item_added',
  'item_deleted',
  'item_completed',
  'item_uncompleted',
  'item_updated',
])

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()
    return result.data?.status === 'ok'
  } catch (error) {
    console.error('Error sending push notification:', error)
    return false
  }
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { listId, title, body, data }: NotifyRequest = await req.json()

    if (!listId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY') ?? ''

    const authKey = anonKey || serviceRoleKey
    if (!supabaseUrl || !serviceRoleKey || !authKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization') ?? ''

    const authClient = createClient(supabaseUrl, authKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const actorId = authData.user.id
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: listData, error: listError } = await admin
      .from('lists')
      .select('owner_id')
      .eq('id', listId)
      .single()

    if (listError || !listData) {
      return new Response(JSON.stringify({ error: 'List not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: collaborators } = await admin
      .from('collaborators')
      .select('user_id')
      .eq('list_id', listId)
      .eq('accepted', true)

    const usersToNotify = new Set<string>()
    if (listData.owner_id && listData.owner_id !== actorId) {
      usersToNotify.add(listData.owner_id)
    }
    if (collaborators) {
      collaborators.forEach((c: { user_id: string }) => {
        if (c.user_id && c.user_id !== actorId) {
          usersToNotify.add(c.user_id)
        }
      })
    }

    if (usersToNotify.size === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userIds = Array.from(usersToNotify)
    const { data: userPrefs } = await admin
      .from('users')
      .select('id, preferences')
      .in('id', userIds)

    const eligibleUsers = new Set<string>()
    const notificationType = String(data?.type ?? 'list_update')
    const isListUpdate = LIST_UPDATE_TYPES.has(notificationType)

    userPrefs?.forEach((row: { id: string; preferences?: any }) => {
      const prefs = row.preferences?.notifications
      const pushEnabled = prefs?.pushNotifications !== false
      const listEnabled = !isListUpdate || prefs?.listUpdates !== false
      if (pushEnabled && listEnabled) {
        eligibleUsers.add(row.id)
      }
    })

    if (eligibleUsers.size === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', Array.from(eligibleUsers))

    let sent = 0
    for (const tokenRow of tokens ?? []) {
      if (!tokenRow?.token) continue
      const ok = await sendPushNotification(tokenRow.token, title, body, data)
      if (ok) sent++
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: sent,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Notify function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
