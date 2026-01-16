# 🚀 Paywall Enablement Guide - Pre-Launch

## Current Status: ⚠️ DISABLED (For Testing)

The paywall is currently **disabled** for testing. All users have full app access without subscription requirements.

---

## 📋 Pre-Launch Checklist

Before enabling the paywall, ensure:

- [ ] RevenueCat API keys are configured in `.env`
- [ ] Subscription products are set up in App Store Connect / Google Play Console
- [ ] Test accounts have been created and tested
- [ ] Email verification flow is working correctly
- [ ] Onboarding flow saves all user data properly
- [ ] Paywall screen displays correctly
- [ ] Subscription management screen is accessible

---

## 🔧 Step-by-Step: Enable Paywall Before Launch

### Step 1: Enable Subscription Provider & Gate

**File: `app/_layout.tsx`**

**1.1 Uncomment imports (lines 7-9):**
```typescript
import { SubscriptionProvider } from "../lib/SubscriptionContext"
import { SubscriptionGate } from "../components/SubscriptionGate"
```

**1.2 Uncomment SubscriptionProvider wrapper (lines 117-122):**
```typescript
<SubscriptionProvider>
  <ProvidersWrapper>
    <RootLayoutContent />
  </ProvidersWrapper>
</SubscriptionProvider>
```

**1.3 Uncomment SubscriptionGate wrapper (lines 51-65):**
```typescript
<SubscriptionGate>
  <StatusBar 
    style={isDark ? "light" : "dark"} 
    backgroundColor={colors.background} 
  />
  <Stack 
    screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: colors.background }
    }} 
  />
</SubscriptionGate>
```

### Step 2: Enable Subscription Menu Item

**File: `app/(tabs)/more.tsx`**

**2.1 Add subscription to SETTINGS_ITEMS array (around line 38):**
```typescript
{
  id: 'subscription',
  title: 'Subscription',
  icon: '💎',
  description: 'Manage your premium plan',
  route: '/subscription-management',
},
```

**2.2 Add subscription case in handleItemPress (around line 132):**
```typescript
case 'subscription':
  router.push('/subscription-management')
  break
```

**2.3 If using clean theme, uncomment subscription button (around line 342-357)**

### Step 3: Update Email Verification Flow

**File: `app/email-verification.tsx`** ✅ Already includes paywall route

The email verification screen already navigates to `/(tabs)` after verification, which will be protected by SubscriptionGate.

### Step 4: Update Onboarding Flow

**File: `app/onboarding.tsx`**

**4.1 Update navigation after onboarding (line 169):**
```typescript
// After email verification, user will see paywall if not subscribed
router.replace('/email-verification')
```

This is already correct - onboarding → email verification → (if verified) → paywall (if new user) → tabs

### Step 5: Remove "DISABLED" Comments (Optional)

Search for and remove or update these comments:
- `app/_layout.tsx` - "PAYWALL TEMPORARILY DISABLED FOR TESTING"
- `app/auth.tsx` - Any paywall disabled comments
- `app/onboarding.tsx` - Any paywall disabled comments

---

## 🔄 User Flow After Paywall Enablement

### New User Journey:
1. **Sign Up** → Creates account
2. **Onboarding** → Saves preferences (location, household, allergies, budget)
3. **Email Verification** → Must verify email
4. **Paywall** → Must subscribe (3-day free trial)
5. **Main App** → Full access to tabs

### Existing User Journey:
1. **Sign In** → Authenticates
2. **Check Subscription** → If subscribed → Main App
3. **If Not Subscribed** → Paywall → Subscribe → Main App

---

## ✅ Testing Checklist

After enabling the paywall, test:

### 1. New User Flow
- [ ] Sign up with new email
- [ ] Complete onboarding
- [ ] Verify email
- [ ] See paywall screen
- [ ] Can purchase subscription
- [ ] Can start 3-day free trial
- [ ] After purchase → Access to main app

### 2. Existing User Flow
- [ ] Sign in with existing account
- [ ] If subscribed → Direct access to app
- [ ] If not subscribed → See paywall
- [ ] Can restore purchases

### 3. Subscription Management
- [ ] Access subscription screen from More tab
- [ ] Can view current subscription status
- [ ] Can cancel subscription
- [ ] Can restore purchases

### 4. Edge Cases
- [ ] Email verification required before paywall
- [ ] Paywall timeout handling (5 seconds)
- [ ] RevenueCat connection errors
- [ ] Network failures during purchase

---

## 🔐 RevenueCat Configuration

Ensure these are set up:

### Environment Variables (`.env`):
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=your_ios_key
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=your_android_key
```

### App Store Connect:
- [ ] Subscription products created
- [ ] Pricing configured
- [ ] Free trial period set (3 days)

### Google Play Console:
- [ ] Subscription products created
- [ ] Pricing configured
- [ ] Free trial period set (3 days)

---

## 📱 Subscription Details

**Current Pricing:**
- **Monthly:** $4.99/month
- **Annual:** $39.99/year (save ~$20)
- **Free Trial:** 3 days

**Features Included:**
- ✅ Unlimited Receipts
- ✅ Smart Pantry
- ✅ Budget Tracking
- ✅ Shopping Lists (Collaborative)
- ✅ Price Tracking (Coming Soon)
- ✅ Insights & Analytics
- ✅ Smart Notifications

---

## 🐛 Troubleshooting

### Paywall Not Showing
- Check RevenueCat API keys in `.env`
- Verify SubscriptionProvider is enabled
- Check console for RevenueCat errors
- Ensure user is authenticated and email verified

### Purchase Not Working
- Verify products are configured in App Store/Play Console
- Check RevenueCat dashboard for product IDs
- Test with sandbox accounts
- Check network connectivity

### Subscription Not Detected
- Verify RevenueCat webhook is configured
- Check Supabase `subscriptions` table
- Ensure user ID matches between systems

---

## 📝 Files to Modify

**Required Changes:**
1. ✅ `app/_layout.tsx` - Enable SubscriptionProvider & SubscriptionGate
2. ✅ `app/(tabs)/more.tsx` - Add subscription menu item
3. ✅ `components/SubscriptionGate.tsx` - Already includes email-verification route

**Already Configured:**
- ✅ `app/paywall.tsx` - Paywall screen ready
- ✅ `app/subscription-management.tsx` - Subscription management ready
- ✅ `lib/SubscriptionContext.tsx` - Subscription logic ready
- ✅ `app/email-verification.tsx` - Email verification ready

---

## 🎯 Quick Enable Script

If you want to quickly enable everything, search for these patterns and uncomment:

1. Search: `// PAYWALL TEMPORARILY DISABLED`
2. Search: `// import { SubscriptionProvider }`
3. Search: `// import { SubscriptionGate }`
4. Search: `// <SubscriptionProvider>`
5. Search: `// <SubscriptionGate>`

---

## ⚠️ Important Notes

1. **Email Verification First:** Users must verify email before seeing paywall
2. **New Users Only:** Only new signups (created < 5 minutes ago) see paywall
3. **Existing Users:** Existing users bypass paywall in dev mode (Expo Go)
4. **Production:** In production builds, all unsubscribed users see paywall

---

## 🚀 Ready to Launch?

Once you've:
- ✅ Enabled all paywall components
- ✅ Tested the full user flow
- ✅ Verified RevenueCat integration
- ✅ Confirmed subscription products are live

**You're ready to launch!** 🎉

---

**Last Updated:** Pre-Launch Preparation
**Status:** Paywall Ready - Awaiting Enablement
