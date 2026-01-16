# 🔧 SMTP Email Troubleshooting Guide

## Error: "Error sending confirmation email"

If you're seeing this error during signup, here's how to fix it:

---

## ✅ Quick Checklist

1. **SMTP is Enabled?**
   - Go to Supabase Dashboard → Settings → Auth → SMTP Settings
   - Make sure "Enable Custom SMTP" is **ON**

2. **SMTP Credentials Correct?**
   - Double-check all fields are filled correctly
   - No extra spaces or typos
   - API key/password copied completely

3. **Email Template Exists?**
   - Go to Authentication → Email Templates
   - Make sure "Confirm signup" template exists and has `{{ .ConfirmationURL }}`

4. **SMTP Service Working?**
   - Check your SMTP provider's status page
   - Verify your account isn't suspended

---

## 🔍 Step-by-Step Debugging

### Step 1: Verify SMTP Settings in Supabase

1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **SMTP Settings**
2. Verify these fields are correct:

**For Resend:**
```
SMTP Host: smtp.resend.com
SMTP Port: 465 (or 587)
SMTP User: resend
SMTP Password: re_xxxxxxxxxxxxx (your API key)
Sender Email: onboarding@resend.dev (or your verified domain)
Sender Name: SAVR
```

**For Gmail:**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: xxxx xxxx xxxx xxxx (16-char app password)
Sender Email: your-email@gmail.com
Sender Name: SAVR
```

3. Click **Save** (even if nothing changed, this refreshes the connection)

### Step 2: Test SMTP Connection

1. In Supabase Dashboard, go to **Settings** → **Auth** → **SMTP Settings**
2. Look for a "Test Connection" button (if available)
3. Or try sending a test email from your SMTP provider's dashboard

### Step 3: Check Email Template

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Make sure it includes:
   - Subject line
   - Body with `{{ .ConfirmationURL }}` variable
4. Click **Save**

### Step 4: Check Supabase Logs

1. Go to **Logs** → **Auth Logs** in Supabase Dashboard
2. Look for recent signup attempts
3. Check for SMTP-related errors

### Step 5: Verify SMTP Provider Settings

**For Resend:**
- Go to [resend.com/dashboard](https://resend.com/dashboard)
- Check **API Keys** - make sure key is active
- Check **Domains** - if using custom domain, verify it's verified
- Check **Logs** - see if emails are being sent

**For Gmail:**
- Make sure 2-Step Verification is enabled
- Verify you're using an **App Password**, not your regular password
- Check Google Account security settings

**For SendGrid:**
- Go to SendGrid dashboard
- Check **Settings** → **API Keys** - verify key has "Mail Send" permission
- Check **Settings** → **Sender Authentication** - verify sender is verified

---

## 🛠️ Common Issues & Fixes

### Issue 1: "Authentication Failed"
**Cause:** Wrong SMTP password/API key

**Fix:**
- Double-check the password/API key
- For Gmail: Make sure it's an App Password, not regular password
- For Resend: Make sure API key starts with `re_`
- Regenerate the key if needed

### Issue 2: "Connection Timeout"
**Cause:** Wrong SMTP host or port

**Fix:**
- Verify SMTP host is correct (no typos)
- Try port 587 instead of 465 (or vice versa)
- Check if your network/firewall is blocking the connection

### Issue 3: "Sender Not Verified"
**Cause:** Email address not verified with SMTP provider

**Fix:**
- For Resend: Use `onboarding@resend.dev` for testing, or verify your domain
- For Gmail: Use the same email you created the app password for
- For SendGrid: Verify sender in SendGrid dashboard

### Issue 4: "Rate Limit Exceeded"
**Cause:** Too many emails sent

**Fix:**
- Check your SMTP provider's rate limits
- Wait a few minutes and try again
- Upgrade your plan if needed

### Issue 5: "Template Error"
**Cause:** Email template is missing or has errors

**Fix:**
- Go to Authentication → Email Templates
- Make sure "Confirm signup" template exists
- Verify it includes `{{ .ConfirmationURL }}`
- Save the template

---

## 🧪 Testing Your Setup

### Test 1: Manual Signup
1. Try signing up with a test email
2. Check if error still appears
3. Check Supabase Auth Logs for details

### Test 2: Check Email Delivery
1. Sign up with your own email
2. Check inbox (and spam folder)
3. If email arrives, SMTP is working!

### Test 3: Resend Email
1. Go to email verification screen
2. Click "Resend Verification Email"
3. Check if it works (this tests SMTP separately)

---

## 📋 SMTP Provider Status Pages

Check if your provider is having issues:

- **Resend:** [status.resend.com](https://status.resend.com)
- **SendGrid:** [status.sendgrid.com](https://status.sendgrid.com)
- **Mailgun:** [status.mailgun.com](https://status.mailgun.com)
- **Gmail:** [downdetector.com/status/gmail](https://downdetector.com/status/gmail)

---

## 🔄 Alternative: Use Supabase Default Email (Temporary)

If SMTP isn't working and you need to test:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. **Disable** "Enable Custom SMTP"
3. Save
4. Try signup again

**Note:** This uses Supabase's default email service (limited, not for production)

---

## 💡 Best Practices

1. **Always verify your domain** for production (better deliverability)
2. **Test SMTP before going live** (sign up test accounts)
3. **Monitor email delivery** (check Supabase logs regularly)
4. **Use a dedicated email service** (Resend/SendGrid) instead of Gmail for production
5. **Customize email templates** to match your brand

---

## 🆘 Still Not Working?

If you've tried everything:

1. **Double-check all SMTP settings** (one typo breaks everything)
2. **Try a different SMTP provider** (Resend is easiest)
3. **Check Supabase documentation:** [supabase.com/docs/guides/auth/auth-smtp](https://supabase.com/docs/guides/auth/auth-smtp)
4. **Contact Supabase support** with your project details and error logs

---

## ✅ Success Indicators

You'll know SMTP is working when:
- ✅ Signup completes without email errors
- ✅ Verification email arrives in inbox
- ✅ "Resend Email" button works
- ✅ No errors in Supabase Auth Logs

