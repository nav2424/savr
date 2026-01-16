# 🚨 Critical: Not Receiving Verification Emails

## Step-by-Step Troubleshooting

Follow these steps in order to diagnose why emails aren't arriving:

---

## ✅ Step 1: Check Supabase Auth Logs (Most Important)

1. **Go to Supabase Dashboard**
   - Navigate to **Logs** → **Auth Logs**
   - Look for your recent signup attempts
   - Check for specific error messages

2. **What to Look For:**
   - ✅ "Email sent successfully" → Email was sent, check spam/inbox
   - ❌ "Error sending confirmation email" → SMTP issue
   - ❌ "450" errors → Domain/authentication issue
   - ❌ "500" errors → Server/connection issue

3. **Copy the exact error message** - This tells us what's wrong!

---

## ✅ Step 2: Verify SMTP Configuration

1. **Go to Supabase Dashboard**
   - **Settings** → **Auth** → **SMTP Settings**

2. **Check Each Field:**
   - ✅ "Enable Custom SMTP" is **ON** (green/enabled)
   - ✅ SMTP Host: `smtp.resend.com`
   - ✅ SMTP Port: `465` (or `587`)
   - ✅ SMTP User: `resend`
   - ✅ SMTP Password: Your Resend API key (starts with `re_`)
   - ✅ Sender Email: `noreply@savrgrocery.com` (or your verified domain email)
   - ✅ Sender Name: `SAVR`

3. **Click Save** (even if unchanged, this refreshes the connection)

---

## ✅ Step 3: Verify Resend Domain Status

1. **Go to Resend Dashboard**
   - https://resend.com/domains
   - Find `savrgrocery.com`

2. **Check Status:**
   - ✅ **"Verified"** → Domain is ready
   - ⚠️ **"Pending"** → DNS records not propagated yet (wait 5-30 minutes)
   - ❌ **"Not Verified"** → DNS records missing or incorrect

3. **If Status is "Pending":**
   - Check DNS propagation: https://dnschecker.org
   - Enter: `savrgrocery.com`
   - Check if TXT records are visible globally
   - Can take up to 48 hours (usually 5-30 minutes)

---

## ✅ Step 4: Check Resend Sending Logs

1. **Go to Resend Dashboard**
   - https://resend.com/emails
   - Or go to **Sending** → **Logs**

2. **Check Recent Emails:**
   - Do you see any emails being sent?
   - What's the status? (Delivered, Bounced, Failed)
   - Check the timestamp - are emails being sent at all?

3. **If No Emails in Logs:**
   - Supabase isn't connecting to Resend
   - Check SMTP credentials in Supabase
   - Verify API key is active in Resend

---

## ✅ Step 5: Check Spam Folder

1. **Check Spam/Junk Folder**
   - Verification emails often go to spam
   - Look for emails from `noreply@savrgrocery.com`
   - Or from `onboarding@resend.dev` if using that

2. **Mark as Not Spam**
   - If found in spam, mark as "Not Spam"
   - Add sender to contacts/whitelist

---

## ✅ Step 6: Test Email Delivery

### Option A: Test from Resend Dashboard
1. Go to Resend Dashboard → **Emails** → **Send Test Email**
2. Send to your email address
3. If this works, Resend is fine - issue is with Supabase config
4. If this fails, issue is with Resend account/domain

### Option B: Check Resend API Key
1. Go to Resend → **API Keys**
2. Verify your API key is:
   - ✅ Active (not revoked)
   - ✅ Has "Send" permissions
   - ✅ Matches what's in Supabase

---

## ✅ Step 7: Verify Email Template

1. **Go to Supabase Dashboard**
   - **Authentication** → **Email Templates**
   - Click **"Confirm signup"** template

2. **Check:**
   - ✅ Template exists
   - ✅ Contains `{{ .ConfirmationURL }}` variable
   - ✅ Subject line is set
   - ✅ Click **Save** (even if unchanged)

---

## 🔧 Common Issues & Fixes

### Issue 1: Domain Not Verified
**Symptoms:** Error "450 domain is not verified"

**Fix:**
1. Go to Resend → Domains
2. Verify domain shows "Verified" status
3. If "Pending", wait for DNS propagation
4. Check DNS records are correct

---

### Issue 2: Wrong Sender Email
**Symptoms:** Error "450 can only send to your own email"

**Fix:**
1. If using `onboarding@resend.dev`, you can only send to your verified Resend account email
2. For production, use verified domain email: `noreply@savrgrocery.com`
3. Make sure domain is verified first

---

### Issue 3: SMTP Authentication Failed
**Symptoms:** Error "535 Authentication failed"

**Fix:**
1. Verify API key is correct (starts with `re_`)
2. Make sure you're using API key, not account password
3. Regenerate API key if needed
4. Update Supabase with new key

---

### Issue 4: Emails Sent But Not Arriving
**Symptoms:** Resend logs show "Delivered" but no email in inbox

**Fix:**
1. Check spam folder
2. Check email filters/rules
3. Try different email address
4. Check if email provider is blocking emails
5. Verify sender email reputation

---

### Issue 5: Connection Timeout
**Symptoms:** Error "Connection timeout" or "Connection refused"

**Fix:**
1. Try port `587` instead of `465` (or vice versa)
2. Check firewall/network settings
3. Verify SMTP host: `smtp.resend.com` (not `smtp.resend.com` with typo)

---

## 📋 Diagnostic Checklist

Run through this checklist:

- [ ] Checked Supabase Auth Logs for specific error
- [ ] "Enable Custom SMTP" is ON in Supabase
- [ ] SMTP Host is exactly: `smtp.resend.com`
- [ ] SMTP Port is: `465` or `587`
- [ ] SMTP User is exactly: `resend`
- [ ] SMTP Password is Resend API key (starts with `re_`)
- [ ] Sender Email is from verified domain: `noreply@savrgrocery.com`
- [ ] Domain shows "Verified" in Resend dashboard
- [ ] Checked Resend sending logs for email attempts
- [ ] Checked spam folder
- [ ] Email template exists with `{{ .ConfirmationURL }}`
- [ ] Tried test email from Resend dashboard
- [ ] API key is active in Resend

---

## 🆘 Quick Fixes to Try

### Fix 1: Refresh SMTP Settings
1. Supabase → Settings → Auth → SMTP Settings
2. Turn "Custom SMTP" **OFF**
3. Save
4. Turn "Custom SMTP" **ON**
5. Re-enter all credentials
6. Save
7. Wait 2-3 minutes
8. Try signup again

### Fix 2: Regenerate API Key
1. Resend → API Keys
2. Create new API key
3. Update Supabase with new key
4. Save
5. Test signup

### Fix 3: Try Different Port
1. If using 465, try 587
2. If using 587, try 465
3. Save and test

### Fix 4: Use Test Email Address
1. Try signing up with your verified Resend account email
2. If that works, domain verification is the issue
3. If that doesn't work, SMTP config is the issue

---

## 📊 What to Share for Help

If still not working, share:

1. **Exact error from Supabase Auth Logs:**
   - Go to Logs → Auth Logs
   - Copy the full error message from recent signup

2. **Resend Domain Status:**
   - What does it show? (Verified/Pending/Not Verified)

3. **Resend Sending Logs:**
   - Do you see any emails being sent?
   - What's the status?

4. **SMTP Settings (hide sensitive info):**
   - Host, Port, User (can share)
   - Sender Email (can share)
   - Don't share API key/password

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ No errors in Supabase Auth Logs
- ✅ Emails appear in Resend sending logs
- ✅ Status shows "Delivered" in Resend
- ✅ Verification email arrives in inbox (or spam)
- ✅ Users can verify and access the app

---

## 🎯 Most Likely Causes

Based on common issues:

1. **Domain not verified** (most common)
   - Check Resend → Domains
   - Verify status is "Verified"

2. **Wrong sender email**
   - Using unverified domain email
   - Should be: `noreply@savrgrocery.com` (from verified domain)

3. **SMTP credentials incorrect**
   - Wrong API key
   - Extra spaces in password
   - Wrong SMTP user

4. **Emails going to spam**
   - Check spam folder
   - Domain reputation issue

---

## 💡 Next Steps

1. **Check Supabase Auth Logs first** - This will tell you the exact problem
2. **Verify domain is "Verified" in Resend**
3. **Check Resend sending logs** - See if emails are being sent
4. **Try test email from Resend dashboard**

Share what you find and I can help fix the specific issue!


