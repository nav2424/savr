# 🚀 SMTP Quick Fix (5 Minutes)

## The Problem
Email verification emails aren't being sent when users sign up.

## The Solution
Configure SMTP in Supabase to send verification emails.

---

## ⚡ Fastest Setup: Resend (Recommended)

### 1. Get Resend API Key (2 minutes)
1. Go to https://resend.com
2. Sign up (free: 3,000 emails/month)
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `re_`)

### 2. Configure in Supabase (2 minutes)
1. Go to **Supabase Dashboard** → Your Project
2. **Settings** → **Auth** → **SMTP Settings**
3. Enable **"Custom SMTP"**
4. Enter:
   ```
   Host: smtp.resend.com
   Port: 465
   User: resend
   Password: [Your Resend API key]
   Sender: onboarding@resend.dev
   Name: SAVR
   ```
5. Click **Save**

### 3. Test (1 minute)
1. Sign up with a test email
2. Check inbox for verification email
3. ✅ Done!

---

## 🔄 Alternative: Gmail (Quick Testing)

### 1. Get Gmail App Password
1. Go to https://myaccount.google.com
2. **Security** → **2-Step Verification** (enable if needed)
3. **App passwords** → Create new
4. Copy 16-character password

### 2. Configure in Supabase
```
Host: smtp.gmail.com
Port: 587
User: your-email@gmail.com
Password: [16-char app password]
Sender: your-email@gmail.com
Name: SAVR
```

---

## ✅ Verify It Works

After setup:
1. Sign up with a new email
2. Check inbox (and spam folder)
3. Click verification link
4. Should redirect to app ✅

---

## 🆘 Still Not Working?

1. **Check Supabase Logs**: Settings → Logs → Auth Logs
2. **Verify SMTP Settings**: Double-check all fields
3. **Test SMTP Provider**: Try sending test email from provider dashboard
4. **See Full Guide**: `SMTP_SETUP_COMPLETE.md`

---

## 📋 Checklist

- [ ] SMTP provider account created
- [ ] API key/App Password obtained
- [ ] Supabase SMTP settings configured
- [ ] "Custom SMTP" enabled
- [ ] Test signup works
- [ ] Verification email received

---

**That's it!** Email verification should now work. 🎉

