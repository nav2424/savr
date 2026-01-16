# 🔍 SMTP Diagnostic Checklist

## If SMTP is Configured But Still Failing

Even if you've entered SMTP settings in Supabase, there are common issues that can cause failures:

---

## ✅ Step 1: Verify SMTP Settings Are Actually Saved

1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **SMTP Settings**
2. Check:
   - ✅ "Enable Custom SMTP" toggle is **ON** (green/enabled)
   - ✅ All fields are filled in
   - ✅ No extra spaces in passwords/keys
   - ✅ Click **Save** again (even if already saved)

**Common Issue:** Settings not actually saved or toggle not enabled.

---

## ✅ Step 2: Check Supabase Auth Logs

1. Go to **Logs** → **Auth Logs** in Supabase Dashboard
2. Look for your recent signup attempt
3. Check for specific error messages:
   - "Authentication failed" → Wrong password/credentials
   - "Connection timeout" → Wrong host/port or network issue
   - "Sender not verified" → Sender email not authorized
   - "Rate limit exceeded" → Too many emails sent

**This will tell you the exact problem!**

---

## ✅ Step 3: Verify SMTP Credentials

### For Mailgun:
1. Go to Mailgun Dashboard → **Sending** → **Domain Settings**
2. Select your domain
3. Go to **SMTP credentials** tab
4. Verify:
   - ✅ You're using **SMTP password** (NOT API key)
   - ✅ SMTP username is correct
   - ✅ Host is `smtp.mailgun.org`
   - ✅ Port is `587` or `465`

### For Resend:
1. Go to Resend Dashboard → **API Keys**
2. Verify:
   - ✅ API key starts with `re_`
   - ✅ Key is active (not revoked)
   - ✅ Using `smtp.resend.com` as host
   - ✅ Port is `465`

### For Gmail:
1. Verify:
   - ✅ Using **App Password** (16 characters, not regular password)
   - ✅ 2-Step Verification is enabled
   - ✅ Port is `587`

---

## ✅ Step 4: Test SMTP Connection

### Option A: Test from Mailgun/Resend Dashboard
1. Go to your email provider's dashboard
2. Try sending a test email
3. If this fails, the issue is with your email provider account, not Supabase

### Option B: Check Email Provider Status
- **Mailgun:** https://status.mailgun.com
- **Resend:** https://status.resend.com
- **SendGrid:** https://status.sendgrid.com

---

## ✅ Step 5: Verify Email Template

1. Go to **Authentication** → **Email Templates** in Supabase
2. Click **"Confirm signup"** template
3. Verify:
   - ✅ Template exists
   - ✅ Contains `{{ .ConfirmationURL }}` variable
   - ✅ Subject line is set
   - ✅ Click **Save** (even if unchanged)

**Common Issue:** Missing or broken email template.

---

## ✅ Step 6: Check Sender Email

### For Mailgun (Sandbox):
- ✅ Must use `postmaster@sandbox12345.mailgun.org` format
- ✅ Recipient must be in "Authorized Recipients" list
- ✅ Go to **Sending** → **Authorized Recipients** and add your test email

### For Mailgun (Verified Domain):
- ✅ Use email from your verified domain
- ✅ Domain must be fully verified in Mailgun

### For Resend:
- ✅ Can use `onboarding@resend.dev` for testing
- ✅ Or use email from verified domain

---

## ✅ Step 7: Check for Common Mistakes

### Mistake 1: Using API Key Instead of SMTP Password
- **Mailgun:** API keys are different from SMTP passwords
- **Resend:** API key IS the SMTP password (this is correct)
- **Solution:** Use SMTP credentials, not API keys (except Resend)

### Mistake 2: Wrong Port
- Try **587** (TLS) - most common
- If that doesn't work, try **465** (SSL)
- **NOT** port 25 or 2525

### Mistake 3: Extra Spaces in Password
- Copy password carefully
- No leading/trailing spaces
- Try typing it manually if copy-paste doesn't work

### Mistake 4: Wrong Host
- **Mailgun:** `smtp.mailgun.org` (not `smtp.mailgun.com`)
- **Resend:** `smtp.resend.com`
- **Gmail:** `smtp.gmail.com`

---

## ✅ Step 8: Check Network/Firewall

If you're behind a corporate firewall:
- SMTP ports (587, 465) might be blocked
- Try from a different network
- Or use a VPN

---

## 🔧 Quick Fixes to Try

### Fix 1: Regenerate SMTP Credentials
1. In your email provider dashboard, regenerate SMTP password
2. Update in Supabase
3. Save and test

### Fix 2: Try Different Port
- If using 587, try 465
- If using 465, try 587

### Fix 3: Disable and Re-enable SMTP
1. In Supabase, turn "Custom SMTP" **OFF**
2. Save
3. Turn it **ON** again
4. Re-enter all credentials
5. Save and test

### Fix 4: Test with Different Provider
- Try Resend (easiest setup)
- If Resend works, issue is with Mailgun configuration
- If Resend also fails, issue is with Supabase settings

---

## 📋 Diagnostic Checklist

- [ ] "Enable Custom SMTP" is ON in Supabase
- [ ] All SMTP fields are filled correctly
- [ ] No extra spaces in password/credentials
- [ ] Using correct SMTP password (not API key, except Resend)
- [ ] Correct host (smtp.mailgun.org, smtp.resend.com, etc.)
- [ ] Correct port (587 or 465)
- [ ] Sender email is verified/authorized
- [ ] Email template exists with {{ .ConfirmationURL }}
- [ ] Checked Supabase Auth Logs for specific error
- [ ] Tested SMTP from provider dashboard
- [ ] Email provider status is operational
- [ ] Tried regenerating SMTP credentials
- [ ] Tried different port (587 ↔ 465)

---

## 🆘 Still Not Working?

If you've checked everything:

1. **Share the exact error from Supabase Auth Logs**
   - Go to Logs → Auth Logs
   - Copy the full error message
   - This will tell us exactly what's wrong

2. **Try Resend as a test**
   - Sign up at resend.com (5 minutes)
   - Configure in Supabase
   - If this works, the issue is with Mailgun setup
   - If this also fails, the issue is elsewhere

3. **Check Supabase Status**
   - https://status.supabase.com
   - See if there are any known issues

---

## 💡 Most Common Issues

1. **"Authentication failed"** → Wrong password (using API key instead of SMTP password)
2. **"Connection timeout"** → Wrong host/port or firewall blocking
3. **"Sender not verified"** → Sender email not authorized (especially Mailgun sandbox)
4. **"Template error"** → Email template missing or broken
5. **Settings not saved** → Toggle not enabled or fields not saved

---

## ✅ Success Indicators

You'll know SMTP is working when:
- ✅ No errors in Supabase Auth Logs
- ✅ Test email sends from provider dashboard
- ✅ Signup completes successfully
- ✅ Verification email arrives in inbox

