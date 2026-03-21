# Family plans (Supabase + RevenueCat)

Family members get **premium access** when they are **accepted** on a `family_members` row and the **owner** still has an active RevenueCat **`pro`** entitlement (verified server-side).

## 1. Database

Apply the migration:

```bash
supabase db push
# or run SQL from supabase/migrations/20260320120000_family_plans.sql in the SQL editor
```

## 2. Edge functions

Set secrets in Supabase (Dashboard → Edge Functions → Secrets or `supabase secrets set`):

| Secret | Purpose |
|--------|---------|
| `REVENUECAT_SECRET_API_KEY` | RevenueCat **secret** API key (`sk_...`) — **not** the `appl_` public key |
| `RESEND_API_KEY` | Optional; if set, invite emails send via Resend |
| `RESEND_FROM` | Optional; e.g. `Savr <noreply@yourdomain.com>` |
| `FAMILY_INVITE_APP_URL` | Optional; join link **without** `code` (default `savr://join-family`). Prefer the app scheme so the email opens Savr directly. Example: `supabase secrets set FAMILY_INVITE_APP_URL=savr://join-family`. Use an `https://…` URL only if you host a web page that forwards into the app. |

Deploy:

```bash
supabase functions deploy check-owner-subscription
supabase functions deploy accept-family-invite
supabase functions deploy send-family-invite
supabase functions deploy get-family-invite-preview
```

## 3. App behavior

- **`hasPremiumAccess`** (`SubscriptionContext`) = direct **`pro`** OR family (via `check-owner-subscription`).
- **`SubscriptionGate`** uses **`hasPremiumAccess`** (plus trial).
- **More → Manage family**: only when **`hasFamilyPlanSubscription`** (active family SKU on the purchaser account).
- **`/join-family`**: enter code or open `savr://join-family?code=...`.

## 4. RevenueCat

- Owner must use the same **app user id** as Supabase `auth.users.id` (already aligned if you use `Purchases.logIn(user.id)`).
- Entitlement id must be **`pro`** (matches `lib/revenuecat.ts` and the edge function).

## 5. Optional: premium checks elsewhere

For any screen that still reads RevenueCat only, prefer **`useSubscription().hasPremiumAccess`** or **`hasProAccess()`** from `lib/family.ts` for a one-off async check.
