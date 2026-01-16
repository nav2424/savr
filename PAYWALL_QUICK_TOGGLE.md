# 🔄 Paywall Quick Toggle Guide

## Current Status: ✅ DISABLED

The paywall is currently **disabled** for testing. All users have full app access.

---

## To Re-Enable Paywall (3 Simple Steps)

### 1️⃣ Edit `app/_layout.tsx`

Find and uncomment these 3 sections:

```typescript
// Line 7-9: Uncomment imports
import { SubscriptionProvider } from "../lib/SubscriptionContext"
import { SubscriptionGate } from "../components/SubscriptionGate"

// Line 46-61: Uncomment SubscriptionGate wrapper
<SubscriptionGate>
  <StatusBar ... />
  <Stack ... />
</SubscriptionGate>

// Line 100-105: Uncomment SubscriptionProvider wrapper
<SubscriptionProvider>
  <ProvidersWrapper>
    <RootLayoutContent />
  </ProvidersWrapper>
</SubscriptionProvider>
```

### 2️⃣ Edit `app/(tabs)/more.tsx`

```typescript
// Line 37-38: Uncomment subscription menu item
{ id: 'subscription', title: 'Subscription', icon: '💎', description: 'Manage your premium plan' },

// Line 132-134: Uncomment subscription route
case 'subscription':
  router.push('/subscription-management')
  break

// Line 342-357: Uncomment clean theme subscription button (entire Pressable block)
```

### 3️⃣ Remove "DISABLED" Comments

- `app/auth.tsx` - Line 69
- `app/onboarding.tsx` - Line 203

---

## To Disable Paywall Again

Reverse the steps above by commenting out the same sections.

---

## Files Changed

✅ **Modified (Paywall Disabled):**
- `app/_layout.tsx` - Main layout
- `app/(tabs)/more.tsx` - Settings screen
- `app/auth.tsx` - Auth flow
- `app/onboarding.tsx` - Onboarding flow

⚠️ **Intact (Ready to Use):**
- `app/paywall.tsx` - Paywall screen
- `app/subscription-management.tsx` - Subscription screen
- `components/SubscriptionGate.tsx` - Gate component
- `lib/SubscriptionContext.tsx` - Subscription logic
- `config/revenuecat.ts` - RevenueCat config

---

## Test Before Launch

When re-enabling:

1. ✅ Test new user signup → Should see paywall
2. ✅ Test existing user login → Should skip paywall if subscribed  
3. ✅ Test subscription management screen
4. ✅ Test purchase flow
5. ✅ Verify RevenueCat connection

---

**Quick Tip:** Search for "PAYWALL TEMPORARILY DISABLED" in the codebase to find all modified locations.

