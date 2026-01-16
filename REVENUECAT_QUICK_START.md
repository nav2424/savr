# 🚀 RevenueCat Quick Start Guide

## ✅ Already Done

Your RevenueCat SDK is **fully configured** and ready to use! The integration is complete in your codebase.

---

## 🔑 Step 1: Add Your API Keys

Create a `.env` file in your project root:

```bash
# RevenueCat API Keys (get from https://app.revenuecat.com)
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_YOUR_KEY_HERE
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_YOUR_KEY_HERE
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=rcb_YOUR_KEY_HERE
```

**Where to find your keys:**
1. Go to https://app.revenuecat.com
2. Navigate to: **Project Settings → API Keys**
3. Copy each key:
   - iOS: starts with `appl_`
   - Android: starts with `goog_`
   - Web: starts with `rcb_`

---

## 📦 Step 2: Configure Products in RevenueCat

In your RevenueCat dashboard, make sure you have:

1. **Entitlement**: `premium`
2. **Products**:
   - `savr_premium_monthly` ($4.99/month)
   - `savr_premium_yearly` ($39.99/year)
3. **Offering**: Set as "Current Offering" with both products

---

## 🧪 Step 3: Test Your App

### Quick Test (Expo Go):
```bash
npx expo start
```
**Note**: Requires Web API key for subscriptions to work

### Full Test (iOS Simulator - Recommended):
```bash
# First time setup
npm install -g eas-cli
eas login
eas init

# Build for simulator
eas build --platform ios --profile ios-simulator

# Start dev server
npx expo start
```

---

## 🎯 How It Works

### Your app automatically:
- ✅ Initializes RevenueCat on launch
- ✅ Checks subscription status
- ✅ Shows paywall to non-subscribers
- ✅ Handles purchases and restores
- ✅ Grants premium access to subscribers

### Check subscription in any component:
```typescript
import { useSubscription } from '../lib/SubscriptionContext';

function MyComponent() {
  const { isSubscribed, isLoading } = useSubscription();
  
  if (isLoading) return <Loading />;
  if (!isSubscribed) return <PaywallScreen />;
  
  return <PremiumFeature />;
}
```

---

## 📱 Testing Purchases

### iOS Sandbox Testing:
1. **Settings → App Store → Sandbox Account**
2. Sign out of your real Apple ID
3. Use a sandbox test account (create in App Store Connect)
4. Make test purchases in your app

### Android Testing:
1. Add test accounts in Google Play Console
2. Use these accounts to test purchases
3. All test purchases are free

---

## 🔍 Verify Setup

Your integration includes:

| Feature | Status | Location |
|---------|--------|----------|
| SDK Initialization | ✅ | `lib/SubscriptionContext.tsx` |
| Paywall Screen | ✅ | `app/paywall.tsx` |
| Subscription Checking | ✅ | `useSubscription()` hook |
| Purchase Flow | ✅ | `purchasePackage()` |
| Restore Purchases | ✅ | `restorePurchases()` |
| EAS Configuration | ✅ | `eas.json` |

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid API Key" | Check `.env` file has correct `EXPO_PUBLIC_` prefix |
| No offerings available | Configure products in RevenueCat dashboard |
| Expo Go subscriptions not working | Add Web API key to `.env` |
| Can't restore purchases | Sign in with same Apple ID/Google account |

---

## 📚 Next Steps

1. ✅ Add API keys to `.env` file
2. ✅ Configure products in RevenueCat dashboard  
3. ✅ Build app with `eas build`
4. ✅ Test purchases with sandbox accounts
5. ✅ Deploy to production when ready

**Need more details?** See `REVENUECAT_SETUP_COMPLETE.md`

---

## 🎉 You're Ready!

Your app is configured with:
- 3-day free trial
- Monthly ($4.99) and Yearly ($39.99) plans
- Automatic subscription management
- Beautiful paywall UI

Just add your API keys and start testing! 🚀

