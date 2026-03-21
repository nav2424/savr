/**
 * Owner sends a family invite. Creates pending row; optional Resend email.
 * POST { email: string }
 *
 * Env (optional): RESEND_API_KEY, RESEND_FROM=Savr <noreply@yourdomain.com>
 * FAMILY_INVITE_APP_URL — join link base (default savr://join-family). Use custom scheme so email taps open the app.
 *   Example: supabase secrets set FAMILY_INVITE_APP_URL=savr://join-family
 *   For a universal https link instead: https://yourdomain.com/join-family
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRO_ENTITLEMENT = 'pro'

function buildFamilyInviteLink(inviteCode: string): string {
  const raw = (Deno.env.get('FAMILY_INVITE_APP_URL') ?? 'savr://join-family').trim()
  const base = raw.replace(/\/+$/, '')
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}code=${encodeURIComponent(inviteCode)}`
}

function hasActiveFamilyEntitlement(ent: {
  expires_date?: string | null
  product_identifier?: string | null
} | null | undefined): boolean {
  if (!ent?.product_identifier) return false
  const product = ent.product_identifier.toLowerCase()
  const isFamily = product.includes('family') || product.includes('fam')
  if (!isFamily) return false
  if (!ent.expires_date) return false
  const exp = new Date(ent.expires_date)
  return !Number.isNaN(exp.getTime()) && exp > new Date()
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

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rcSecret =
      Deno.env.get('REVENUECAT_SECRET_API_KEY') ??
      Deno.env.get('REVENUECAT_API_SECRET_KEY') ??
      ''

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

    let body: { email?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawEmail = body.email?.trim().toLowerCase()
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (rawEmail === user.email?.trim().toLowerCase()) {
      return new Response(JSON.stringify({ error: 'You cannot invite your own email address.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!rcSecret) {
      return new Response(
        JSON.stringify({ error: 'Family plan validation is unavailable. Please try again shortly.' }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const rcRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        headers: {
          Authorization: `Bearer ${rcSecret}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!rcRes.ok) {
      const text = await rcRes.text()
      console.error('RevenueCat owner check failed', rcRes.status, text)
      return new Response(
        JSON.stringify({
          error: 'Could not validate your family subscription. Please try again.',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const rcJson = (await rcRes.json()) as {
      subscriber?: {
        entitlements?: Record<
          string,
          { expires_date?: string | null; product_identifier?: string | null }
        >
      }
    }
    const entitlement = rcJson.subscriber?.entitlements?.[PRO_ENTITLEMENT]
    if (!hasActiveFamilyEntitlement(entitlement)) {
      return new Response(
        JSON.stringify({
          error: 'Only active Savr family plan owners can send invites.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    let { data: plan, error: planErr } = await admin
      .from('family_plans')
      .select('id, max_seats')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (planErr) {
      console.error(planErr)
      return new Response(JSON.stringify({ error: planErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!plan) {
      const { data: created, error: insErr } = await admin
        .from('family_plans')
        .insert({ owner_id: user.id, max_seats: 5 })
        .select('id, max_seats')
        .single()

      if (insErr || !created) {
        return new Response(JSON.stringify({ error: insErr?.message ?? 'Could not create plan' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      plan = created
    }

    const { count, error: countErr } = await admin
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_plan_id', plan.id)
      .in('status', ['pending', 'accepted'])

    if (countErr) {
      return new Response(JSON.stringify({ error: countErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((count ?? 0) >= plan.max_seats) {
      return new Response(
        JSON.stringify({ error: `Family plan is full (${plan.max_seats}/${plan.max_seats} seats).` }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: invite, error: invErr } = await admin
      .from('family_members')
      .insert({
        family_plan_id: plan.id,
        invite_email: rawEmail,
        status: 'pending',
      })
      .select('id, invite_code')
      .single()

    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: invErr?.message ?? 'Invite failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') ?? 'Savr <onboarding@resend.dev>'
    const joinUrl = buildFamilyInviteLink(invite.invite_code)
    const isHttps = joinUrl.startsWith('https://') || joinUrl.startsWith('http://')

    let emailSent = false
    if (resendKey) {
      const openLabel = isHttps ? 'Open link to accept' : 'Open in Savr app'
      const secondaryLine = isHttps
        ? `<p>You can also open the Savr app and enter the invite code below.</p>`
        : `<p>If the button does not open the app, copy the code below and use <strong>More → Join family</strong> in Savr.</p>`

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [rawEmail],
          subject: "You've been invited to a Savr family plan",
          html: `<p>You've been invited to join a Savr family plan.</p>
<p><a href="${joinUrl}">${openLabel}</a></p>
${secondaryLine}
<p>Invite code: <strong>${invite.invite_code}</strong></p>`,
        }),
      })

      emailSent = r.ok
      if (!r.ok) {
        const t = await r.text()
        console.error('Resend failed', t)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inviteCode: invite.invite_code,
        emailSent,
        joinUrl,
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
