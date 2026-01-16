# 🔔 SAVR Push Notifications - Setup Guide

## ✅ **What's Been Built:**

Push notifications are now fully integrated! Users will receive notifications when:
- ✅ Someone adds an item to a shared list
- ✅ Someone completes an item
- ✅ Someone uncompletes an item
- ✅ Someone invites them to collaborate

---

## 📋 **Setup Steps:**

### **Step 1: Add Push Tokens Table to Database**

Run this SQL in Supabase SQL Editor (or re-run the updated `supabase-schema.sql`):

```sql
-- Push Tokens table (for push notifications)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tokens" ON public.push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tokens" ON public.push_tokens
  FOR DELETE USING (user_id = auth.uid());
```

### **Step 2: Test on Physical Device**

**⚠️ IMPORTANT:** Push notifications only work on:
- ✅ Physical devices (iPhone/Android)
- ✅ Development builds or production builds
- ❌ NOT in Expo Go
- ❌ NOT in iOS Simulator

**To test:**
1. Build a development build: `eas build --profile development --platform ios`
2. Install on your iPhone
3. Open the app
4. Sign in
5. App automatically requests notification permission
6. Create/join a shared list
7. Have a friend add an item
8. You'll receive a push notification! 🔔

---

## 🎯 **How It Works:**

### **Automatic Registration:**
```
User signs in
  ↓
AuthContext loads profile
  ↓
Automatically registers for push notifications
  ↓
Saves push token to database
  ↓
Ready to receive notifications!
```

### **Notification Flow:**
```
User A adds "Bananas" to "Weekly Groceries"
  ↓
CollaborativeListsService.addItem() called
  ↓
Item saved to database
  ↓
NotificationsService.notifyListCollaborators() called
  ↓
Gets all collaborators' push tokens
  ↓
Sends via Expo Push Service
  ↓
User B receives notification:
  "Weekly Groceries"
  "Sarah added Bananas"
```

---

## 📱 **Notification Examples:**

### **Item Added:**
```
Title: "Weekly Groceries"
Body: "Sarah added Bananas"
```

### **Item Completed:**
```
Title: "Weekly Groceries"
Body: "Mike completed Milk ✓"
```

### **Item Removed:**
```
Title: "Dinner Party"
Body: "You removed Chicken breast"
```

---

## 🎨 **Notification Behavior:**

### **App in Foreground:**
- ✅ Shows banner at top
- ✅ Plays sound
- ✅ Updates badge
- ✅ Shows in notification list

### **App in Background:**
- ✅ Shows lock screen notification
- ✅ Plays sound & vibration
- ✅ Updates app badge
- ✅ Tap to open app

### **App Closed:**
- ✅ Same as background
- ✅ Tapping opens app directly to the list

---

## ⚙️ **Configuration:**

### **Notification Settings (Optional):**

You can customize in `NotificationsService.ts`:

**Sound:**
```typescript
sound: 'default' // or custom sound file
```

**Priority:**
```typescript
priority: 'high' // or 'normal', 'low'
```

**Badge:**
```typescript
shouldSetBadge: true // Shows number on app icon
```

**Vibration (Android):**
```typescript
vibrationPattern: [0, 250, 250, 250] // milliseconds
```

---

## 🧪 **Testing Push Notifications:**

### **Test Flow:**
1. Install development build on 2 devices
2. Device A: Sign in as user1@example.com
3. Device B: Sign in as user2@example.com
4. Device A: Create list → Get share code
5. Device B: Join list with share code
6. Device A: Add item "Bananas"
7. Device B: Receives notification! 🔔
8. Device B: Complete "Bananas"
9. Device A: Receives notification! 🔔

---

## 🔧 **Troubleshooting:**

### "Notifications not working"
→ Must be on physical device with development/production build

### "Permission denied"
→ Check iOS Settings > SAVR > Notifications

### "Token not saved"
→ Check Supabase Table Editor > push_tokens

### "No project ID"
→ Make sure EAS project is configured in app.config.js

---

## 📊 **Notification Types:**

```typescript
'added_item'       → "X added Y"
'completed_item'   → "X completed Y ✓"
'uncompleted_item' → "X uncompleted Y"
'removed_item'     → "X removed Y"
'added_collaborator' → "X invited you to Y"
```

---

## 🚀 **Current Status:**

**✅ Implemented:**
- Push notification registration
- Token storage in database
- Auto-registration on sign in
- Notifications on item add
- Notifications on item complete/uncomplete
- Expo push service integration
- iOS & Android support

**⏳ Needs Development Build:**
- Push tokens only work in development/production builds
- Run: `eas build --profile development --platform ios`

---

## 💡 **Next Steps:**

1. **Re-run Schema** (if you haven't added push_tokens table yet)
   ```sql
   -- Run the updated supabase-schema.sql
   ```

2. **Build Development Build**
   ```bash
   eas build --profile development --platform ios
   ```

3. **Install on Device**
   - Download and install the .ipa
   - Sign in
   - Grant notification permission
   - Test with a friend!

---

**Push notifications are ready! Users will love getting instant alerts about list changes!** 🔔✨

