# 📱 Adding Apps to RevenueCat - Detailed Guide

## Step 3: Add iOS App to RevenueCat

### **Visual Walkthrough:**

#### **3.1 Navigate to Apps Section:**

1. **Log in** to RevenueCat dashboard: https://app.revenuecat.com
2. Make sure you're in the **"SAVR"** project (check top left)
3. Look at the **left sidebar**
4. Click **"Apps"** (should be near the top)

**What you'll see:**
- Page title: "Apps"
- Button: "+ Add app" or "+ New app"
- Empty list (if this is your first time)

---

#### **3.2 Click "+ Add App" Button:**

- Located at top right of the Apps page
- Big blue button
- Says "+ Add app" or "+ New"

**Click it!**

---

#### **3.3 Fill in iOS App Details:**

A modal/form will appear:

**Platform:**
- Select: **"Apple App Store"** (iOS icon)
- NOT "Apple Mac App Store"

**App Name:**
- Enter: **SAVR iOS** (or just "SAVR")
- This is just for your reference in RevenueCat

**Bundle ID / App:**
- Enter: **`com.arnavsaluja.savr`**
- ⚠️ **MUST BE EXACT** - no spaces, no typos!
- This is case-sensitive

**Shared Secret (Optional for now):**
- Leave blank initially
- You'll add this later from App Store Connect

**App-Specific Shared Secret:**
- Leave unchecked for now

---

#### **3.4 Save:**

- Click **"Add"** or **"Save"** button
- Should see: "App added successfully"
- Your iOS app now appears in the list

---

## Step 4: Add Android App to RevenueCat

Same process, slightly different:

#### **4.1 Click "+ Add App" Again:**

From the Apps page, click the same button.

---

#### **4.2 Fill in Android App Details:**

**Platform:**
- Select: **"Google Play Store"** (Android icon)

**App Name:**
- Enter: **SAVR Android** (or just "SAVR")

**Package Name:**
- Enter: **`com.arnavsaluja.savr`**
- ⚠️ **MUST BE EXACT** - no spaces, no typos!

**Service Account JSON:**
- Leave blank for now
- You'll upload this later from Google Play Console

---

#### **4.3 Save:**

- Click **"Add"** or **"Save"**
- Both apps should now be in your list:
  - ✅ SAVR iOS (com.arnavsaluja.savr)
  - ✅ SAVR Android (com.arnavsaluja.savr)

---

## ✅ Verification

### **Check Your Apps List:**

You should see:

```
Apps
────────────────────────────────────
📱 SAVR iOS
   Apple App Store
   com.arnavsaluja.savr
   
🤖 SAVR Android
   Google Play Store
   com.arnavsaluja.savr
────────────────────────────────────
```

---

## 🎯 What This Does

Adding your apps to RevenueCat tells it:
- ✅ Which apps to track
- ✅ Where to validate receipts
- ✅ How to identify your users
- ✅ Which platform each user is on

**The API keys + Bundle IDs link your app to RevenueCat!**

---

## 🐛 Troubleshooting

### **"Bundle ID already in use"**
→ You may have already added it (check your Apps list)
→ Or someone else is using that ID (unlikely with your personal domain)

### **"Invalid Bundle ID format"**
→ Check for typos: `com.arnavsaluja.savr`
→ No spaces, no special characters except dots

### **Can't find "Apps" in sidebar**
→ Make sure you're logged in
→ Check you're in the right project (top left dropdown)
→ Try refreshing the page

### **"Add App" button disabled**
→ You might be on free trial with limits
→ Or already added maximum apps (unlikely)

---

## 📸 What It Looks Like

### **RevenueCat Dashboard Layout:**

```
┌─────────────────────────────────────────────────┐
│ 🔵 RevenueCat    [SAVR ▼]         👤 Your Name │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌──────────┐                                   │
│ │ Overview │  ← You might be here              │
│ │ Apps     │  ← CLICK HERE                     │
│ │ Products │                                    │
│ │ Offerings│                                    │
│ │ Customers│                                    │
│ │ Charts   │                                    │
│ │ API Keys │                                    │
│ └──────────┘                                   │
│                                                 │
│          Apps                  [+ Add app]     │
│          ────────────────────────────────      │
│                                                 │
│          (Your apps will appear here)          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## ✅ Success!

When done correctly:
- ✅ Two apps in your list
- ✅ Correct bundle IDs
- ✅ iOS and Android both added
- ✅ Ready for next steps

---

## 🎯 After This Step

**Next you'll need to:**
1. ✅ Add API keys to `.env` (Step 5)
2. ✅ Test connection (Step 6)
3. ⏳ Create products in App Store Connect
4. ⏳ Link products in RevenueCat

**But for now, just focus on adding the apps!**

---

## 📞 Still Stuck?

**Common mistakes:**
- Wrong Bundle ID (check app.config.js: line 30 & 42)
- Not in the right project (check dropdown top left)
- Not in "Apps" section (check left sidebar)

**The Bundle ID is:** `com.arnavsaluja.savr`

**Copy that EXACTLY when adding your apps!**

---

Let me know when you've added both apps and I'll help you with the next step! 🚀

