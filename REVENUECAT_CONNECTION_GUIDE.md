# 🔌 RevenueCat SDK Connection - Step by Step Guide

## ✅ SDK is Already Installed!

I've already installed the RevenueCat SDK. Now you just need to connect it with your API keys.

---

## 📝 Step 1: Create RevenueCat Account (5 minutes)

### **1.1 Sign Up:**
1. Go to: **https://app.revenuecat.com/signup**
2. Sign up with your email
3. Verify email
4. Log in

### **1.2 Create Project:**
1. Click **"Create New Project"**
2. Project name: **SAVR**
3. Select **"iOS & Android"**
4. Click **"Create"**

### **1.3 Get API Keys:**

**For iOS:**
1. In RevenueCat dashboard
2. Click **"SAVR"** project
3. Go to: **API Keys** (left sidebar)
4. Find: **Apple App Store**
5. Copy the key: `appl_xxxxxxxxxxxxxxxx`

**For Android:**
1. Same dashboard
2. Go to: **API Keys**
3. Find: **Google Play Store**
4. Copy the key: `goog_xxxxxxxxxxxxxxxx`

**Screenshot locations:**
- Left sidebar → API Keys
- You'll see both iOS and Android keys listed

---

## 📝 Step 2: Add API Keys to Your App (2 minutes)

### **2.1 Create .env File:**

In your project root (`/Users/arnavsaluja/savr-mobile`), create a file named `.env`:

```bash
# Copy ENV_TEMPLATE.txt or create new file
touch .env
```

### **2.2 Add Keys to .env:**

```bash
# SAVR Environment Variables

# Supabase (you probably already have these)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI (you probably already have this)
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-key-here

# RevenueCat (ADD THESE!)
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_YOUR_ACTUAL_KEY_FROM_STEP_1
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_YOUR_ACTUAL_KEY_FROM_STEP_1
```

**Replace:**
- `appl_YOUR_ACTUAL_KEY_FROM_STEP_1` with your iOS key
- `goog_YOUR_ACTUAL_KEY_FROM_STEP_1` with your Android key

### **2.3 Verify .env is Ignored:**

Check that `.gitignore` includes `.env` (so you don't commit API keys):

```bash
# Check if .env is in .gitignore
grep ".env" .gitignore
```

If not there, add it:
```bash
echo ".env" >> .gitignore
```

---

## 📝 Step 3: Configure App Bundle ID in RevenueCat (2 minutes)

### **3.1 Add iOS App:**

In RevenueCat dashboard:

1. Go to: **Project Settings** → **Apps**
2. Click **"+ Add App"**
3. Select: **Apple App Store**
4. App Name: **SAVR iOS**
5. Bundle ID: **`com.arnavsaluja.savr`** ← Your bundle ID
6. Click **"Save"**

### **3.2 Add Android App:**

Same process:

1. Click **"+ Add App"** again
2. Select: **Google Play Store**
3. App Name: **SAVR Android**
4. Package name: **`com.arnavsaluja.savr`** ← Your bundle ID
5. Click **"Save"**

---

## 📝 Step 4: Test Connection (5 minutes)

### **4.1 Run Your App:**

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

### **4.2 Check Logs:**

When the app starts, you should see in console:

```
✅ RevenueCat SDK initialized
[Purchases] - DEBUG: Configuring Purchases SDK
[Purchases] - DEBUG: SDK Version 9.5.4
[Purchases] - DEBUG: Initial App User ID: $RCAnonymousID:xxxxx
```

If you see this, **it's connected!** ✅

### **4.3 Common Issues:**

**"Invalid API key" error:**
- Check you copied the full key (starts with `appl_` or `goog_`)
- Check no extra spaces in .env
- Check env variable name is exactly `EXPO_PUBLIC_REVENUECAT_IOS_KEY`

**"No offerings found":**
- This is OK for now! You haven't created products yet
- App will still initialize

---

## 📝 Step 5: Create Products (You'll do this later)

**This is separate from SDK connection. Do this when ready to test payments.**

See: `PAYMENT_SETUP_GUIDE.md` for full product setup.

---

## ✅ Quick Verification Checklist

- [ ] RevenueCat account created
- [ ] Project "SAVR" created in RevenueCat
- [ ] iOS API key copied (starts with `appl_`)
- [ ] Android API key copied (starts with `goog_`)
- [ ] `.env` file created in project root
- [ ] API keys added to `.env`
- [ ] Bundle ID `com.arnavsaluja.savr` added to RevenueCat (iOS)
- [ ] Package name `com.arnavsaluja.savr` added to RevenueCat (Android)
- [ ] App runs without errors
- [ ] Console shows "RevenueCat SDK initialized"

---

## 🎯 Test Connection Right Now

### **Quick Test:**

1. **Create RevenueCat account** (if not already)
2. **Get your API keys**
3. **Create .env file with keys**
4. **Run app:**
   ```bash
   npx expo start
   ```
5. **Check console for:** "RevenueCat SDK initialized"

**If you see that message = Connected successfully!** ✅

---

## 📁 File Locations

### **Configuration Files:**
```
.env                          ← ADD YOUR API KEYS HERE
config/revenuecat.ts         ← Reads from .env
lib/SubscriptionContext.tsx  ← Uses config
```

### **Current Setup:**
- ✅ SDK installed (`react-native-purchases`)
- ✅ iOS pods installed
- ✅ Code ready to use keys
- ⏳ **You need to:** Add your API keys to `.env`

---

## 🚨 Important Notes

### **API Keys are Sensitive:**
- **NEVER** commit to git
- **NEVER** share publicly
- **ALWAYS** use .env file
- ✅ .env should be in .gitignore

### **Testing vs Production:**
- RevenueCat gives you same keys for both
- Sandbox vs production determined by Apple/Google account
- No need for separate test keys

---

## 💡 Pro Tip: Verify Setup

### **Test that environment variables work:**

```bash
# Run this in terminal to check if .env is loaded
npx expo start

# In app, add temporary console log in SubscriptionContext.tsx:
console.log('iOS Key:', REVENUECAT_API_KEYS.ios.substring(0, 10) + '...')
```

Should show: `iOS Key: appl_xxxxx...`

If it shows: `iOS Key: appl_YOUR_I...` → .env not loaded properly

---

## 🎯 What Happens After Connection

Once connected, RevenueCat will:

1. ✅ **Initialize** on app launch
2. ✅ **Identify users** automatically
3. ✅ **Sync subscriptions** from Apple/Google
4. ✅ **Track trials** automatically
5. ✅ **Provide offerings** (when you create products)
6. ✅ **Handle purchases** seamlessly
7. ✅ **Validate receipts** server-side

---

## 📞 Need Help?

### **Can't find API keys?**
→ RevenueCat dashboard → API Keys (left sidebar)

### **App not recognizing .env?**
→ Restart metro bundler (`npx expo start --clear`)

### **Still having issues?**
→ Check `PAYMENT_SETUP_GUIDE.md` for troubleshooting

---

## ✅ Next Steps After Connection

Once SDK is connected:

1. **Create products** in App Store Connect
2. **Create products** in Google Play Console  
3. **Link products** in RevenueCat
4. **Test purchases** in sandbox
5. **Launch!** 🚀

---

**Current Status:**
- SDK: ✅ Installed
- Code: ✅ Ready
- Keys: ⏳ Need to add to .env

**Your Next Action:**
1. Go to app.revenuecat.com
2. Create account
3. Get API keys
4. Add to .env
5. Run app to verify!

Takes 10 minutes total! 🚀

