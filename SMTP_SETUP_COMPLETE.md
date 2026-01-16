# 📧 Complete SMTP Email Verification Setup Guide

## 🎯 Goal
Get email verification working so users receive verification emails when they sign up.

---

## ✅ Quick Setup (5 minutes)

### Step 1: Choose an Email Provider

**Recommended: Resend** (Easiest, 3,000 emails/month free)
- Sign up: https://resend.com
- Get API key (starts with `re_`)
- Use `onboarding@resend.dev` for testing (no domain verification needed)

**Alternative: Gmail** (Quick testing, 500 emails/day limit)
- Requires App Password (not regular password)
- See full setup below

---

### Step 2: Configure in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project

2. **Open SMTP Settings**
   - Click **Settings** (gear icon) → **Auth** → **SMTP Settings**

3. **Enable Custom SMTP**
   - Toggle **"Enable Custom SMTP"** to **ON**

4. **Enter SMTP Credentials**

   **For Resend:**
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 465 (or 587)
   SMTP User: resend
   SMTP Password: re_xxxxxxxxxxxxx (your Resend API key)
   Sender Email: onboarding@resend.dev
   Sender Name: SAVR
   ```

   **For Gmail:**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: xxxx xxxx xxxx xxxx (16-char App Password)
   Sender Email: your-email@gmail.com
   Sender Name: SAVR
   ```

5. **Click Save**

---

### Step 3: Verify Email Template

1. Go to **Authentication** → **Email Templates**
2. Click **"Confirm signup"** template
3. Make sure it includes:
   - Subject line (e.g., "Verify your SAVR account")
   - Body with `{{ .ConfirmationURL }}` variable
4. Click **Save**

**Example Template:**
```
Subject: Verify your SAVR account

Hi there!

Click the link below to verify your email:

{{ .ConfirmationURL }}

If you didn't sign up for SAVR, you can safely ignore this email.

Thanks,
The SAVR Team
```

---

### Step 4: Test It

1. **Sign up with a test email**
2. **Check your inbox** (and spam folder)
3. **Click the verification link**
4. **You should be redirected to the app**

---

## 🔍 Troubleshooting

### Emails Not Arriving?

1. **Check Supabase Logs**
   - Go to **Logs** → **Auth Logs**
   - Look for SMTP errors

2. **Verify SMTP Settings**
   - Double-check all fields (no typos)
   - Make sure "Enable Custom SMTP" is ON
   - Verify API key/password is correct

3. **Check Spam Folder**
   - Verification emails sometimes go to spam

4. **Test SMTP Connection**
   - Try sending a test email from your SMTP provider's dashboard
   - If that fails, SMTP credentials are wrong

### Common Errors

**"Authentication Failed"**
- Wrong SMTP password/API key
- For Gmail: Make sure you're using App Password, not regular password
- For Resend: Make sure API key starts with `re_`

**"Connection Timeout"**
- Wrong SMTP host or port
- Try port 587 instead of 465 (or vice versa)
- Check firewall/network settings

**"Sender Not Verified"**
- For Resend: Use `onboarding@resend.dev` for testing
- For Gmail: Use the same email you created the app password for
- Verify sender email in your SMTP provider dashboard

---

## 📋 Setup Checklist

- [ ] Signed up for email provider (Resend/Gmail/SendGrid)
- [ ] Got API key or App Password
- [ ] Enabled "Custom SMTP" in Supabase
- [ ] Entered all SMTP credentials correctly
- [ ] Saved SMTP settings
- [ ] Verified email template exists with `{{ .ConfirmationURL }}`
- [ ] Tested signup and received verification email
- [ ] Clicked verification link and was redirected to app

---

## 🚀 Production Recommendations

1. **Use Resend or SendGrid** (better deliverability than Gmail)
2. **Verify your own domain** (looks more professional)
3. **Customize email templates** (match your brand)
4. **Monitor email delivery** (check Supabase logs regularly)

---

## 📚 Additional Resources

- **Supabase SMTP Docs**: https://supabase.com/docs/guides/auth/auth-smtp
- **Resend Docs**: https://resend.com/docs
- **Gmail App Passwords**: https://support.google.com/accounts/answer/185833

---

## ✅ Success Indicators

You'll know SMTP is working when:
- ✅ Signup completes without email errors
- ✅ Verification email arrives in inbox
- ✅ "Resend Email" button works
- ✅ No errors in Supabase Auth Logs
- ✅ Users can verify and access the app

