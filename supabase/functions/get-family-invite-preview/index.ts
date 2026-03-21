/**
 * Preview family invite details for join screen trust copy.
 * POST { code: string }
 * Returns only: { ownerFirstName, planType }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRO_ENTITLEMENT = 'pro'

type InviteRow = {
  family_plans?: {
    owner_id?: string | null
    users?: { name?: string | null } | null
  } | null
}

function getFirstName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return 'a SAVR member'
  return trimmed.split(/\s+/)[0] || 'a SAVR member'
}

function getPlanTypeFromProduct(productIdentifier: string | null | undefined): string {
  const p = (productIdentifier ?? '').toLowerCase()
  if (p.includes('annual') && (p.includes('family') || p.includes('fam'))) {
    return 'Annual Family Plan'
  }
  if (p.includes('monthly') && (p.includes('family') || p.includes('fam'))) {
    return 'Monthly Family Plan'
  }
  return 'Family Plan'
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
    const rcSecret =
      Deno.env.get('REVENUECAT_SECRET_API_KEY') ??
      Deno.env.get('REVENUECAT_API_SECRET_KEY') ??
      ''

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { code?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const code = body.code?.trim()
    if (!code) {
      return new Response(JSON.stringify({ error: 'code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: invite, error: inviteError } = await admin
      .from('family_members')
      .select('family_plans!inner(owner_id, users(name))')
      .eq('invite_code', code)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownerId = (invite as InviteRow).family_plans?.owner_id ?? null
    const ownerName = (invite as InviteRow).family_plans?.users?.name ?? null
    const ownerFirstName = getFirstName(ownerName)

    let planType = 'Family Plan'
    if (ownerId && rcSecret) {
      const rcRes = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(ownerId)}`,
        {
          headers: {
            Authorization: `Bearer ${rcSecret}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (rcRes.ok) {
        const rcJson = (await rcRes.json()) as {
          subscriber?: {
            entitlements?: Record<string, { product_identifier?: string | null }>
          }
        }
        const productId =
          rcJson.subscriber?.entitlements?.[PRO_ENTITLEMENT]?.product_identifier
        planType = getPlanTypeFromProduct(productId)
      }
    }

    return new Response(
      JSON.stringify({
        ownerFirstName,
        planType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
