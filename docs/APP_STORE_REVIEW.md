# App Store Review — demo account with expired subscription (Guideline 2.1)

Apple wants **two different things** in practice:

1. **App login** — email + password for *your* app (Supabase / SAVR account).  
2. **Expired *Apple* subscription** — the **Sandbox Apple ID** they use at the iOS payment sheet should be in a state where any prior **sandbox subscription has expired**, so they can go through **purchase / restore** like a lapsed subscriber.

You put the **app** credentials in **App Store Connect → App Review Information**. You explain the **Sandbox Apple ID** in the same notes (Apple’s own tester account for IAP).

---

## Step 1 — Create a dedicated SAVR (Supabase) user

1. Sign up in the app (or Supabase Dashboard → Authentication) with something like:  
   `savr.app.review@YOURDOMAIN.com`  
2. Complete **email verification** for that address.  
3. Set a strong password you’ll paste into App Review (e.g. 12+ chars, mixed case + number).  
4. In Supabase **SQL Editor**, ensure this user is **not** grandfathered (adjust email if needed):

```sql
update public.users
set grandfathered_lifetime_premium = false
where id = (select id from auth.users where email = 'savr.app.review@YOURDOMAIN.com');
```

5. **Trial vs paywall:** Your app gives **4 days** of access from **auth `created_at`**.  
   - If Apple must see a **blocking** paywall, use an account created **more than 4 days ago**, **or** create the account early and submit after the trial window.  
   - Either way, they can always open **More → Subscription → View Plans** for the purchase UI—say that explicitly in the notes.

---

## Step 2 — Sandbox Apple ID + “expired” subscription

Sandbox subscriptions **expire quickly** (Apple compresses duration). Typical pattern:

1. In **App Store Connect → Users and Access → Sandbox → Testers**, create a **Sandbox Apple ID** (separate from production Apple ID).  
2. On a **TestFlight** build, sign in to the app with your **SAVR** review email/password.  
3. Go to **View Plans** (or your paywall), start a purchase, and sign in with the **Sandbox** Apple ID when iOS asks.  
4. **Complete a sandbox purchase** once.  
5. **Wait** until that sandbox sub lapses (often **~5–15 minutes** for a “monthly”-style product—see [Apple sandbox renewal times](https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox)).  
6. That Sandbox Apple ID is now in an **“expired subscription”** state for testing **purchase / restore** again.

Put in review notes: *“For IAP, sign in with the Sandbox Apple ID below when StoreKit prompts; we’ve let an initial sandbox subscription expire so renewals can be tested.”*

---

## Step 3 — What to paste in App Store Connect

**Path:** App Store Connect → **My Apps** → *SAVR* → **App Information** → scroll to **App Review Information**.

| Field | What to enter |
|--------|----------------|
| **Sign-in required?** | Yes |
| **User name** | The **SAVR / Supabase** review email, e.g. `savr.app.review@YOURDOMAIN.com` |
| **Password** | That account’s password |
| **Notes** | Use the template below + your Sandbox Apple ID **email** (password is **not** stored in ASC for sandbox—reviewers use sandbox login on device when purchasing) |

### Notes template (copy and edit)

```
APP LOGIN (SAVR)
- Email: savr.app.review@YOURDOMAIN.com
- Password: [same as User name field above]

Use the latest TestFlight build. In-app purchases do not work in Expo Go.

To reach subscriptions: sign in → More tab → Subscription / View Plans (or the welcome subscription screen if shown).

IAP: When Apple prompts for an Apple ID at purchase, use our Sandbox Apple ID:
- Sandbox email: [sandbox.tester@yourdomain.com]

We completed a sandbox subscription on this Sandbox account and allowed it to expire (per sandbox accelerated renewal), so purchase and restore can be tested as an expired subscriber.

RevenueCat + App Store Connect product IDs are aligned for bundle ID com.arnavsaluja.savr. Paid Applications Agreement is active.
```

---

## If “View Plans” still errors in review

Products must load in **TestFlight** (correct bundle ID, ASC agreements, RevenueCat ↔ ASC product IDs). See: https://rev.cat/why-are-offerings-empty  

---

## Guideline 4 — Verify Email screen

The verification screen uses keyboard avoidance, scrolling, **Hide keyboard**, and an iOS **Done** accessory on the numeric keyboard so controls stay reachable on large iPhones.
