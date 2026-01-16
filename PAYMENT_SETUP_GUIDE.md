# 💳 Payment Integration Setup Guide

## 🎯 Your Model: Premium Only App

**Pricing:**
- 💳 Monthly: $4.99/month
- 💎 Yearly: $39.99/year (33% off)

**No free tier** - Users must subscribe to use the app

---

## 📦 Step 1: Install RevenueCat

### **Install Dependencies:**

```bash
# Install RevenueCat
npm install react-native-purchases

# For iOS
cd ios && pod install && cd ..
```

### **Configure RevenueCat:**

1. **Sign up:** [app.revenuecat.com](https://app.revenuecat.com)
2. **Create project:** "SAVR"
3. **Get API keys:**
   - iOS: Apple App Store
   - Android: Google Play Store

---

## 🍎 Step 2: Set Up Apple App Store

### **In App Store Connect:**

1. **Go to:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Select:** Your app
3. **Click:** Features → In-App Purchases
4. **Create Products:**

#### **Product 1: Monthly Subscription**
```
Product ID: savr_premium_monthly
Type: Auto-Renewable Subscription
Subscription Group: SAVR Premium
Price: $4.99
Duration: 1 month
```

#### **Product 2: Annual Subscription**
```
Product ID: savr_premium_yearly
Type: Auto-Renewable Subscription
Subscription Group: SAVR Premium
Price: $39.99
Duration: 1 year
```

### **Configure Subscription Group:**
- Name: "SAVR Premium"
- Add both products to same group
- Set upgrade/downgrade rules

---

## 🤖 Step 3: Set Up Google Play Console

### **In Google Play Console:**

1. **Go to:** [play.google.com/console](https://play.google.com/console)
2. **Select:** Your app
3. **Monetization → Products → Subscriptions**
4. **Create Products:**

#### **Product 1: Monthly Subscription**
```
Product ID: savr_premium_monthly
Name: SAVR Premium Monthly
Price: $4.99
Billing Period: 1 month
```

#### **Product 2: Annual Subscription**
```
Product ID: savr_premium_yearly
Name: SAVR Premium Annual
Price: $39.99
Billing Period: 1 year
```

---

## 🔧 Step 4: Configure RevenueCat

### **In RevenueCat Dashboard:**

1. **Project Settings:**
   - Add Apple App Store API key
   - Add Google Play service account

2. **Create Products:**
   - Link iOS products (savr_premium_monthly, savr_premium_yearly)
   - Link Android products (savr_premium_monthly, savr_premium_yearly)

3. **Create Entitlement:**
   - Name: "premium"
   - Attach both products

4. **Create Offering:**
   - Identifier: "default"
   - Add both packages:
     - Monthly ($4.99)
     - Annual ($39.99)

---

## 🔑 Step 5: Add API Keys to Your App

### **Create config file:**

```typescript
// config/revenuecat.ts
export const REVENUECAT_CONFIG = {
  ios: 'appl_YOUR_IOS_KEY_HERE',
  android: 'goog_YOUR_ANDROID_KEY_HERE',
};

// Product IDs
export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'savr_premium_monthly',
  yearly: 'savr_premium_yearly',
};
```

### **Add to .env:**

```bash
REVENUECAT_IOS_KEY=appl_YOUR_IOS_KEY
REVENUECAT_ANDROID_KEY=goog_YOUR_ANDROID_KEY
```

---

## ✅ Step 6: Test Sandbox Purchases

### **iOS Testing:**
1. Create sandbox tester in App Store Connect
2. Sign out of App Store on device
3. Test purchase (will prompt for sandbox account)

### **Android Testing:**
1. Add license testers in Google Play Console
2. Download app from internal testing track
3. Test purchase

---

## 📊 Step 7: Configure Webhooks (Optional)

### **In RevenueCat:**
1. Go to Integrations
2. Add Supabase webhook
3. Track subscription events in your database

---

## 🚨 Important Notes

### **Apple App Store:**
- 30% commission (you get $3.49 from $4.99)
- Review required before going live
- Test with sandbox accounts first

### **Google Play:**
- 15% commission for first $1M (you get $4.24)
- Faster review process
- Test with internal testing track

### **RevenueCat Pricing:**
- Free up to $2,500/month revenue
- 1% + $0.01 per transaction after that
- Worth it for the time saved

---

## 🎯 Revenue Projections

### **100 subscribers:**
- Monthly: $349/month revenue (after Apple cut)
- Yearly: $2,794/year revenue (after Apple cut)

### **1,000 subscribers:**
- Monthly: $3,490/month revenue
- Yearly: $27,940/year revenue

### **10,000 subscribers:**
- Monthly: $34,900/month revenue
- Yearly: $279,400/year revenue

**Most users choose annual (60-70%) due to savings**

---

## 📱 Step 8: Update App Store Listings

### **App Store Connect:**
- Update description: "Premium grocery management app"
- Add pricing: "Subscription required"
- Screenshots showing premium features
- Clear value proposition

### **Google Play:**
- Same updates
- Add pricing section
- Show subscription options

---

## 🔐 Privacy & Compliance

### **Required Disclosures:**
- Privacy policy (subscription data)
- Terms of service (auto-renewal)
- Contact info for support
- Cancellation policy

### **GDPR/Privacy:**
- RevenueCat handles user data
- Add to privacy policy
- Allow data export/deletion

---

## 📋 Pre-Launch Checklist

- [ ] RevenueCat account created
- [ ] iOS products created in App Store Connect
- [ ] Android products created in Google Play
- [ ] Products linked in RevenueCat
- [ ] API keys added to app
- [ ] Entitlement created ("premium")
- [ ] Offering created ("default")
- [ ] Paywall UI built
- [ ] Subscription validation working
- [ ] Restore purchases working
- [ ] Sandbox testing completed (iOS)
- [ ] Internal testing completed (Android)
- [ ] Privacy policy updated
- [ ] Terms of service created
- [ ] App Store listings updated

---

## 🆘 Troubleshooting

### **"Products not loading"**
→ Check API keys, product IDs match exactly

### **"Purchase fails"**
→ Test with sandbox/test accounts, not real account

### **"Subscription not recognized"**
→ Check entitlement configuration in RevenueCat

### **"Can't restore purchases"**
→ Ensure user signed in with same Apple/Google account

---

## 📚 Resources

- **RevenueCat Docs:** https://docs.revenuecat.com
- **Apple In-App Purchase:** https://developer.apple.com/in-app-purchase
- **Google Play Billing:** https://developer.android.com/google/play/billing

---

**Next:** Implement the code and build the paywall UI! 🚀

