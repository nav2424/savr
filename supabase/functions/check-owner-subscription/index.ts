/**
 * Verifies an accepted family member may rely on the owner's RevenueCat subscription.
 * POST { ownerId: string } — caller JWT must be an accepted member of that owner's plan.
 *
 * Env: REVENUECAT_SECRET_API_KEY (Secret API key from RevenueCat dashboard, sk_...)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRO_ENTITLEMENT = 'pro'

function isEntitlementActive(ent: { expires_date?: string | null } | null | undefined): boolean {
  if (!ent) return false
  // RevenueCat returns null expires_date for some lifetime-style entitlements.
  if (!ent.expires_date) return true
  const d = new Date(ent.expires_date)
  return !Number.isNaN(d.getTime()) && d > new Date()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const rcSecret = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? Deno.env.get('REVENUECAT_API_SECRET_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { ownerId?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownerId = body.ownerId?.trim()
    if (!ownerId) {
      return new Response(JSON.stringify({ error: 'ownerId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: membership, error: memErr } = await admin
      .from('family_members')
      .select('id, family_plans!inner(owner_id)')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle()

    if (memErr || !membership) {
      return new Response(JSON.stringify({ active: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const row = membership as { family_plans?: { owner_id?: string } }
    const planOwner = row.family_plans?.owner_id
    if (planOwner !== ownerId) {
      return new Response(JSON.stringify({ active: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!rcSecret) {
      console.error('Missing REVENUECAT_SECRET_API_KEY')
      return new Response(JSON.stringify({ error: 'Subscription check unavailable', active: false }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rcUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(ownerId)}`
    const rcRes = await fetch(rcUrl, {
      headers: {
        Authorization: `Bearer ${rcSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!rcRes.ok) {
      const text = await rcRes.text()
      console.error('RevenueCat error', rcRes.status, text)
      return new Response(JSON.stringify({ active: false, error: 'RevenueCat request failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rcJson = (await rcRes.json()) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null }>
      }
    }

    const ent = rcJson.subscriber?.entitlements?.[PRO_ENTITLEMENT]
    const active = isEntitlementActive(ent ?? null)

    return new Response(JSON.stringify({ active }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: (e as Error).message, active: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
