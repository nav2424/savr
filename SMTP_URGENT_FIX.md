# 🚨 URGENT: Fix Email Verification to Enable Signups

## The Problem
Signups are failing with "Error sending confirmation email" because SMTP is not configured in Supabase.

## Why This Matters
If Supabase is configured to **require email confirmation**, it will **block account creation** when it can't send verification emails. This means users cannot sign up at all.

---

## ⚡ Quick Fix (5 Minutes)

### Step 1: Get Resend API Key
1. Go to https://resend.com
2. Sign up (free: 3,000 emails/month)
3. **API Keys** → **Create API Key**
4. Copy the key (starts with `re_`)

### Step 2: Configure in Supabase
1. Go to **Supabase Dashboard** → Your Project
2. **Settings** → **Auth** → **SMTP Settings**
3. **Enable "Custom SMTP"**
4. Enter:
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 465
   SMTP User: resend
   SMTP Password: [Your Resend API key]
   Sender Email: onboarding@resend.dev
   Sender Name: SAVR
   ```
5. **Click Save**

### Step 3: Check Auth Settings (Important!)
1. Go to **Authentication** → **Providers** → **Email**
2. Check **"Enable email confirmations"**
3. If it's set to **"Required"**, users MUST verify email before accessing the app
4. If you want to allow signups without email verification (for testing), you can:
   - Set to **"Optional"** (users can sign in without verifying)
   - Or disable email confirmations temporarily

### Step 4: Test
1. Try signing up with a test email
2. Check inbox for verification email
3. Click verification link
4. ✅ Should work now!

---

## 🔍 If Still Not Working

### Check Supabase Logs
1. Go to **Logs** → **Auth Logs**
2. Look for SMTP errors
3. Common errors:
   - "Authentication failed" → Wrong password/API key
   - "Connection timeout" → Wrong host/port
   - "Sender not verified" → Wrong sender email

### Verify SMTP Settings
- Double-check all fields (no typos)
- Make sure "Enable Custom SMTP" is **ON**
- Test API key is valid (try logging into Resend dashboard)

### Alternative: Temporarily Disable Email Confirmation
If you need to test signups immediately:
1. Go to **Authentication** → **Providers** → **Email**
2. **Disable** "Enable email confirmations"
3. Users can now sign up without email verification
4. **⚠️ Re-enable after configuring SMTP for production!**

---

## 📋 Complete Checklist

- [ ] Resend account created
- [ ] API key obtained
- [ ] SMTP configured in Supabase
- [ ] "Custom SMTP" enabled
- [ ] Email template verified (has `{{ .ConfirmationURL }}`)
- [ ] Test signup works
- [ ] Verification email received
- [ ] Email confirmation settings checked

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Signup completes without errors
- ✅ Verification email arrives in inbox
- ✅ Users can verify and access the app
- ✅ No errors in Supabase Auth Logs

---

**See `SMTP_SETUP_COMPLETE.md` for detailed instructions.**

