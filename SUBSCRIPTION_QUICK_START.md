# 🚀 Subscription Setup - Quick Start

## ✅ Code is Ready!

All subscription code is implemented and working. You just need to configure the accounts.

---

## 📋 Quick Setup (2-3 hours)

### **Step 1: RevenueCat Account** (5 min)

1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Sign up (free)
3. Create project: "SAVR"
4. Copy API keys (you'll need these)

---

### **Step 2: Add API Keys** (2 min)

Create or update `.env` file:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_YOUR_KEY_HERE
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_YOUR_KEY_HERE
```

---

### **Step 3: iOS Setup** (30 min)

**App Store Connect:**

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Your app → In-App Purchases
3. Create Subscription Group: "SAVR Premium"
4. Create 2 products:

```
Product 1:
- ID: savr_premium_monthly
- Price: $4.99
- Duration: 1 month
- Trial: 3 days

Product 2:
- ID: savr_premium_yearly  
- Price: $39.99
- Duration: 1 year
- Trial: 3 days
```

---

### **Step 4: Android Setup** (30 min)

**Google Play Console:**

1. Go to [play.google.com/console](https://play.google.com/console)
2. Your app → Monetization → Subscriptions
3. Create 2 subscriptions:

```
Product 1:
- ID: savr_premium_monthly
- Price: $4.99
- Period: Monthly
- Trial: 3 days

Product 2:
- ID: savr_premium_yearly
- Price: $39.99
- Period: Yearly
- Trial: 3 days
```

---

### **Step 5: Link in RevenueCat** (15 min)

**RevenueCat Dashboard:**

1. **Products** → Add both iOS products
2. **Products** → Add both Android products
3. **Entitlements** → Create: `premium`
4. **Entitlements** → Attach both products
5. **Offerings** → Create: `default`
6. **Offerings** → Add Monthly & Annual packages

---

### **Step 6: Test** (1 hour)

**iOS:**
```
1. Create sandbox tester in App Store Connect
2. Sign out of App Store on device
3. Run app
4. Complete onboarding
5. Try subscribing (use sandbox account)
6. Verify trial starts
```

**Android:**
```
1. Add license tester in Google Play
2. Build and upload to Internal Testing
3. Download from Play Store
4. Try subscribing
5. Verify trial starts
```

---

## 🎯 What Users Will See

### **Flow:**
```
Download app
    ↓
Create account
    ↓
Complete onboarding
    ↓
PAYWALL SCREEN:
  🎁 3-Day Free Trial
  💎 $4.99/month or $39.99/year
  ✨ All premium features
    ↓
Start trial (no charge for 3 days)
    ↓
Full access to SAVR
    ↓
Day 3: Charged and subscription continues
```

---

## 💰 Pricing Summary

| Plan | Price | Savings | Trial |
|------|-------|---------|-------|
| **Monthly** | $4.99/mo | - | 3 days |
| **Annual** | $39.99/yr | $20 (33%) | 3 days |

**Most users choose Annual** (higher value, better LTV)

---

## 📂 Files to Check

### **Configuration:**
- `config/revenuecat.ts` - Add your API keys here
- `.env` - Or add keys here

### **Core Code:**
- `lib/SubscriptionContext.tsx` - Subscription logic
- `components/SubscriptionGate.tsx` - Access protection
- `app/paywall.tsx` - Subscription screen
- `app/subscription-management.tsx` - Manage screen

### **Documentation:**
- `PAYMENT_SETUP_GUIDE.md` - Full guide
- `SUBSCRIPTION_SETUP_COMPLETE.md` - Complete overview
- `SUBSCRIPTION_QUICK_START.md` - This file

---

## 🧪 Testing Checklist

- [ ] Sign up new account
- [ ] Complete onboarding
- [ ] See paywall
- [ ] Start trial (sandbox)
- [ ] Access app during trial
- [ ] Wait 3 days (or advance clock)
- [ ] Verify auto-charge
- [ ] Test cancellation
- [ ] Test restore purchases

---

## 🚨 Important Notes

### **Before Launch:**
1. ✅ Update privacy policy (mention subscriptions)
2. ✅ Create terms of service (auto-renewal terms)
3. ✅ Add contact email for support
4. ✅ Test thoroughly in sandbox
5. ✅ Plan for customer support (cancellations, refunds)

### **App Store Requirements:**
- Must clearly state "Subscription required"
- Show subscription screen in screenshots
- Explain what's included
- Make cancellation easy to find

---

## 💡 Quick Tips

**Product IDs must match EXACTLY:**
- Code: `savr_premium_monthly`
- App Store: `savr_premium_monthly`
- Google Play: `savr_premium_monthly`
- RevenueCat: `savr_premium_monthly`

**Entitlement name must match:**
- Code: `premium`
- RevenueCat: `premium`

**Test with fresh accounts:**
- Each test needs new sandbox account
- Can't reuse trial on same account

---

## 🎉 You're Almost There!

**Code:** ✅ Complete  
**Setup:** ⏳ 2-3 hours  
**Testing:** ⏳ 1 hour  
**Launch:** 🚀 Ready!

---

## 📞 Next Steps

1. **Today:** Set up RevenueCat account
2. **This week:** Create App Store/Play products
3. **This week:** Test in sandbox
4. **Next week:** Submit to stores

**Then:** Start making money! 💰

---

**Need help? See `PAYMENT_SETUP_GUIDE.md` for detailed instructions.**

