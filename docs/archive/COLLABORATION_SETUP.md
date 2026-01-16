# SAVR Collaborative Lists - Complete Setup Guide

## 🚀 Overview

This guide will help you set up the full collaboration system with:
- ✅ Real-time list syncing
- ✅ User authentication
- ✅ Invite system
- ✅ Activity feed
- ✅ Permissions (owner/editor/viewer)
- ✅ Push notifications

---

## 📋 Step 1: Create Supabase Project (5 minutes)

### 1.1 Sign Up for Supabase
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up with GitHub or email (it's free!)
3. Create a new project:
   - **Name**: savr-mobile
   - **Database Password**: (Choose a strong password and save it)
   - **Region**: Choose closest to you
   - Wait 2 minutes for project to initialize

### 1.2 Get API Credentials
1. Go to **Project Settings** (gear icon)
2. Click **API** in sidebar
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 1.3 Add to Your `.env` File
```bash
# Add these lines to your .env file:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 🗄️ Step 2: Set Up Database (3 minutes)

### 2.1 Run the Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy ALL contents from `supabase-schema.sql`
4. Paste into the editor
5. Click **Run** (bottom right)
6. Wait for "Success" message

This creates:
- ✅ `users` table
- ✅ `lists` table
- ✅ `list_items` table
- ✅ `collaborators` table
- ✅ `activities` table
- ✅ All permissions (RLS policies)
- ✅ Real-time subscriptions
- ✅ Automatic activity logging

### 2.2 Verify Tables Created
1. Go to **Table Editor** in sidebar
2. You should see 5 new tables:
   - `users`
   - `lists`
   - `list_items`
   - `collaborators`
   - `activities`

---

## 🔐 Step 3: Configure Authentication (2 minutes)

### 3.1 Enable Email Auth
1. Go to **Authentication** > **Providers**
2. Enable **Email**
3. Configure:
   - ✅ Enable email confirmations
   - ✅ Disable email change confirmations (for easier testing)
   - ✅ Click **Save**

### 3.2 (Optional) Enable Social Auth
You can also enable:
- Google Sign-In
- Apple Sign-In
- Phone (SMS) Auth

For now, email is enough!

---

## 🔔 Step 4: Set Up Push Notifications (Optional - 10 minutes)

### 4.1 Install Expo Notifications
```bash
npx expo install expo-notifications expo-device expo-constants
```

### 4.2 Configure Expo Push Notifications
1. In Supabase, create a new table for push tokens:

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

2. Enable Row Level Security:

```sql
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens" ON push_tokens
  FOR ALL USING (user_id = auth.uid());
```

### 4.3 Test Notifications
We'll set up push notifications to alert users when:
- Someone adds an item to a shared list
- Someone completes an item
- Someone invites them to collaborate

---

## 🧪 Step 5: Test the Setup

### 5.1 Restart Your App
```bash
# Kill the current Expo server (Ctrl+C)
npx expo start --clear
```

### 5.2 Test Flow
1. **Sign Up** - Create a new account
2. **Create List** - Make a grocery list
3. **Get Share Code** - View the list's share code
4. **Sign Up Another Account** (different email on another device/browser)
5. **Join List** - Use the share code
6. **Add Items** - Both users can add items
7. **Real-time Sync** - See items appear instantly!

---

## 🎯 Features You'll Get

### **Real-Time Collaboration**
```
User A adds "Bananas"
→ User B sees it instantly (no refresh needed)

User B completes "Milk"
→ User A sees checkmark in real-time

User C joins the list
→ Everyone sees new collaborator
```

### **Smart Permissions**
```
Owner:
  ✅ Add/edit/delete items
  ✅ Invite collaborators
  ✅ Delete the list
  ✅ Change list settings

Editor:
  ✅ Add/edit/delete items
  ✅ Complete items
  ❌ Can't delete list
  ❌ Can't remove collaborators

Viewer:
  ✅ View items
  ✅ See updates
  ❌ Can't edit anything
```

### **Activity Feed**
```
10:45 AM - John added Bananas
10:42 AM - Sarah completed Milk
10:38 AM - You added Chicken breast
10:35 AM - Mike joined the list
```

### **Share System**
```
Each list gets unique code: SAVR-ABC123
Share code with anyone
They enter code → instant access
```

---

## 📱 App Flow After Setup

### **First Time User:**
1. Open SAVR
2. See Welcome screen
3. Tap "Get Started"
4. Sign up with email
5. Verify email
6. Sign in
7. Access all features

### **Existing User:**
1. Open SAVR
2. Auto sign-in (session persisted)
3. See all lists (owned + collaborated)
4. Real-time updates working

### **Collaboration Flow:**
1. User A creates "Weekly Groceries"
2. Taps share button
3. Gets code: `SAVR-XYZ789`
4. Shares via text/email
5. User B opens SAVR
6. Taps "Join List"
7. Enters code
8. Boom! Both can edit together

---

## 🔧 Troubleshooting

### "Supabase client not configured"
→ Check `.env` has correct URL and key

### "User not found"
→ They need to sign up first before being invited

### "Permission denied"
→ Check RLS policies are enabled

### "Real-time not working"
→ Verify realtime is enabled in Supabase settings

---

## 🎉 Next Steps

After completing the setup:
1. ✅ Test sign up/sign in
2. ✅ Create a list
3. ✅ Invite a friend (or use 2nd device)
4. ✅ Watch real-time sync in action!

---

## 💡 Pro Tips

**For Development:**
- Use different emails for testing (yourname+test1@gmail.com, yourname+test2@gmail.com)
- Check Supabase dashboard to see data in real-time
- Use Table Editor to manually verify data

**For Production:**
- Enable email confirmations
- Add rate limiting
- Set up custom email templates
- Configure proper push notification certificates

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Expo Notifications](https://docs.expo.dev/push-notifications/overview/)

---

**Ready to build world-class collaborative grocery lists! 🚀✨**


