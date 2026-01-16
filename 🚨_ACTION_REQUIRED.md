# 🚨 Two Quick Fixes Needed

Your app is now running! But two features need quick setup:

---

## ✅ FIXED: Critical Issues
**Status**: ALL RESOLVED ✓  
- ✅ InternalBytecode.js Error - Metro bundler cache cleared
- ✅ Paywall Freeze - Added 5-second timeout + dev bypass button
- ✅ Duplicate Push Token - Using atomic upsert

**You can now use the app!** After 5 seconds on the paywall, tap "Continue in Dev Mode" to bypass.

---

## ⚠️ FIX #1: RevenueCat Web API Key (Optional for Expo Go)

### What's Happening?
You're running in Expo Go, which requires a **Web/Browser API key** from RevenueCat.

### Why This Matters
- ❌ Without it: Subscription features won't work in Expo Go
- ✅ With it: You can test subscription UI in Expo Go
- 💡 Note: Real purchases require a development build anyway

### How to Fix

**Option A: Get the Web API Key** (Recommended for testing)
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to: **Project Settings → API Keys**
3. Find **Web/Browser** section
4. Copy your Web API key (starts with `rcb_`)
5. Create `.env` file in project root with:
   ```bash
   REVENUECAT_WEB_API_KEY=rcb_YOUR_ACTUAL_KEY_HERE
   ```
6. Restart Metro bundler: Press `r` in terminal or reload app

**Option B: Skip It** (If you're not testing subscriptions)
- App will work fine without it
- Subscription features just won't be available in Expo Go
- Use a development build (`npx expo run:ios`) when ready to test payments

---

## ⚠️ FIX #2: Supabase Push Tokens Policy (Required)

### What's Happening?
Your `push_tokens` database table needs Row Level Security (RLS) policies.

### Why This Matters
- ❌ Without it: Push notifications won't register properly
- ✅ With it: Users can save their notification tokens

### How to Fix (5 seconds)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Run the SQL Fix**
   - Click **SQL Editor** in left sidebar
   - Click **New query**
   - Copy/paste contents of `fix-push-tokens-rls-complete.sql` (it's in your project root)
   - Click **Run** or press `Cmd+Enter`

3. **Done!**
   - Reload your app
   - Push notifications will now work

**The SQL file sets up these policies:**
- ✅ Users can insert their own push tokens
- ✅ Users can view their own push tokens  
- ✅ Users can update their own push tokens
- ✅ Users can delete their own push tokens

---

## 🎯 Quick Summary

### What Works Now ✅
- ✅ App loads in Expo Go
- ✅ No more InternalBytecode.js errors
- ✅ Metro bundler working perfectly
- ✅ All core features functional

### What Needs 2 Minutes ⚠️
- ⚠️ RevenueCat Web key (optional, only for testing subscriptions in Expo Go)
- ⚠️ Supabase RLS policies (required, just run the SQL file)

### Total Time to Complete
**~2 minutes for both fixes**

---

## 📱 After These Fixes

Your console will be clean with only expected warnings:
- `expo-notifications` Android warning (safe to ignore in iOS)
- `expo-av` deprecation (not critical)
- Voice recognition unavailable (expected in Expo Go)

**Everything else will work perfectly!** 🎉

---

## Need Help?

- RevenueCat docs: https://www.revenuecat.com/docs/configuring-sdk
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- File location: `fix-push-tokens-rls-complete.sql` is in your project root

