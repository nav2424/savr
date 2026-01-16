# 🔧 Mailgun SMTP Configuration Fix

## Common Mailgun Configuration Issues

### Issue 1: Wrong SMTP Credentials Location

**Problem:** Using the wrong credentials from Mailgun dashboard.

**Solution:**
1. Go to Mailgun Dashboard → **Sending** → **Domain Settings**
2. For testing: Use your **Sandbox Domain** (e.g., `sandbox12345.mailgun.org`)
3. For production: Use your **Verified Domain**
4. Go to **Sending** → **SMTP credentials** (NOT API keys)
5. Copy the **SMTP username** and **SMTP password** (these are different from API keys!)

---

### Issue 2: Wrong SMTP Host/Port

**Problem:** Using incorrect SMTP server details.

**Correct Configuration:**
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587 (for TLS) or 465 (for SSL)
SMTP User: [Your SMTP username from Mailgun]
SMTP Password: [Your SMTP password from Mailgun]
Sender Email: [Your verified email or sandbox email]
Sender Name: SAVR
```

**Important:**
- Use port **587** for TLS (recommended)
- Use port **465** for SSL (alternative)
- **NOT** port 25 or 2525

---

### Issue 3: Sender Email Not Verified

**Problem:** Using an email that isn't verified with Mailgun.

**For Testing (Sandbox):**
- Use your sandbox email: `postmaster@sandbox12345.mailgun.org`
- Or any email in format: `anything@sandbox12345.mailgun.org`
- Sandbox only sends to **authorized recipients** (add them in Mailgun dashboard)

**For Production:**
- Verify your domain in Mailgun
- Use emails from your verified domain (e.g., `noreply@yourdomain.com`)

**How to Add Authorized Recipients (Sandbox):**
1. Go to Mailgun Dashboard → **Sending** → **Authorized Recipients**
2. Click **Add Recipient**
3. Enter the email address you want to test with
4. Click the verification link in the email Mailgun sends
5. Now you can send to that email

---

### Issue 4: Using API Key Instead of SMTP Password

**Problem:** Copying the API key instead of SMTP password.

**Solution:**
- **SMTP User:** This is your SMTP username (usually something like `postmaster@sandbox12345.mailgun.org`)
- **SMTP Password:** This is your SMTP password (NOT your API key!)
- Go to **Sending** → **SMTP credentials** to find the correct password

---

## ✅ Step-by-Step Mailgun Setup

### Step 1: Get Mailgun SMTP Credentials

1. **Log into Mailgun Dashboard**
   - Go to https://app.mailgun.com
   - Sign in to your account

2. **Navigate to SMTP Settings**
   - Click **Sending** in the left sidebar
   - Click **Domain Settings**
   - Select your domain (sandbox for testing, or verified domain for production)

3. **Get SMTP Credentials**
   - Click **SMTP credentials** tab
   - You'll see:
     - **SMTP hostname:** `smtp.mailgun.org`
     - **Port:** `587` (TLS) or `465` (SSL)
     - **Username:** (e.g., `postmaster@sandbox12345.mailgun.org`)
     - **Password:** (click "Show" to reveal)

4. **Copy These Values**

---

### Step 2: Configure in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click **Settings** (gear icon) → **Auth** → **SMTP Settings**

2. **Enable Custom SMTP**
   - Toggle **"Enable Custom SMTP"** to **ON**

3. **Enter Mailgun Credentials**
   ```
   SMTP Host: smtp.mailgun.org
   SMTP Port: 587
   SMTP User: [Your SMTP username from Mailgun]
   SMTP Password: [Your SMTP password from Mailgun]
   Sender Email: [Your sandbox email or verified email]
   Sender Name: SAVR
   ```

4. **Important Notes:**
   - Use the **SMTP username** (not your Mailgun login email)
   - Use the **SMTP password** (not your API key)
   - For sandbox: Use `postmaster@sandbox12345.mailgun.org` as sender
   - For production: Use an email from your verified domain

5. **Click Save**

---

### Step 3: Add Authorized Recipients (Sandbox Only)

If using Mailgun sandbox domain:

1. Go to **Sending** → **Authorized Recipients**
2. Click **Add Recipient**
3. Enter the email you want to test with
4. Check your email and click the verification link
5. Now Mailgun can send to that email

**Note:** Sandbox domains can ONLY send to authorized recipients!

---

### Step 4: Test Configuration

1. **Try signing up** with an authorized email (if using sandbox)
2. **Check Supabase Logs:**
   - Go to **Logs** → **Auth Logs**
   - Look for SMTP errors
3. **Check Mailgun Logs:**
   - Go to **Sending** → **Logs**
   - See if emails are being sent
   - Check for delivery errors

---

## 🔍 Troubleshooting Mailgun Issues

### Error: "Authentication Failed"

**Causes:**
- Wrong SMTP password (using API key instead)
- Wrong SMTP username
- Credentials copied incorrectly (extra spaces)

**Fix:**
1. Go to Mailgun → **Sending** → **SMTP credentials**
2. Click "Show" to reveal password
3. Copy password exactly (no spaces)
4. Make sure you're using SMTP password, NOT API key
5. Verify SMTP username is correct

---

### Error: "Connection Timeout"

**Causes:**
- Wrong SMTP host
- Wrong port
- Firewall blocking connection

**Fix:**
1. Verify host is exactly: `smtp.mailgun.org`
2. Try port **587** (TLS) - most common
3. If 587 doesn't work, try **465** (SSL)
4. Check firewall/network settings

---

### Error: "Sender Not Verified" or "Unauthorized"

**Causes:**
- Using unverified email as sender
- Sandbox domain trying to send to unauthorized recipient

**Fix:**
1. **For Sandbox:**
   - Use `postmaster@sandbox12345.mailgun.org` as sender
   - Add recipient to authorized recipients list
   - Verify recipient email

2. **For Production:**
   - Verify your domain in Mailgun
   - Use email from verified domain as sender

---

### Error: "Rate Limit Exceeded"

**Causes:**
- Free tier: 5,000 emails/month (first 3 months), then 1,000/month
- Sending too many emails

**Fix:**
1. Check Mailgun dashboard for usage
2. Wait for rate limit to reset
3. Upgrade plan if needed

---

### Emails Not Arriving

**Check:**
1. **Supabase Logs:** Settings → Logs → Auth Logs
2. **Mailgun Logs:** Sending → Logs
3. **Spam Folder:** Check recipient's spam folder
4. **Authorized Recipients:** If using sandbox, make sure recipient is authorized

---

## 📋 Mailgun Configuration Checklist

- [ ] Logged into Mailgun dashboard
- [ ] Navigated to Sending → Domain Settings
- [ ] Selected correct domain (sandbox or verified)
- [ ] Opened SMTP credentials tab
- [ ] Copied SMTP username (not login email)
- [ ] Copied SMTP password (not API key)
- [ ] Enabled "Custom SMTP" in Supabase
- [ ] Entered correct SMTP host: `smtp.mailgun.org`
- [ ] Entered correct port: `587` or `465`
- [ ] Entered SMTP username correctly
- [ ] Entered SMTP password correctly (no extra spaces)
- [ ] Set sender email (sandbox or verified domain email)
- [ ] Added authorized recipients (if using sandbox)
- [ ] Saved configuration in Supabase
- [ ] Tested signup
- [ ] Checked Supabase Auth Logs
- [ ] Checked Mailgun sending logs

---

## 🎯 Quick Reference: Mailgun SMTP Settings

```
Host: smtp.mailgun.org
Port: 587 (TLS) or 465 (SSL)
User: postmaster@sandbox12345.mailgun.org (or your SMTP username)
Password: [Your SMTP password from Mailgun dashboard]
Sender: postmaster@sandbox12345.mailgun.org (sandbox) or your-verified-email@yourdomain.com (production)
```

---

## 🆘 Still Not Working?

1. **Double-check credentials:**
   - Go to Mailgun → Sending → SMTP credentials
   - Verify username and password are correct
   - Make sure you're using SMTP password, not API key

2. **Test in Mailgun dashboard:**
   - Try sending a test email from Mailgun dashboard
   - If that fails, issue is with Mailgun account, not Supabase

3. **Check Supabase logs:**
   - Settings → Logs → Auth Logs
   - Look for specific error messages

4. **Verify domain status:**
   - Sandbox: Should work immediately
   - Verified domain: Make sure domain is fully verified

5. **Try different port:**
   - If 587 doesn't work, try 465
   - If 465 doesn't work, try 587

---

## ✅ Success Indicators

You'll know Mailgun is working when:
- ✅ No SMTP errors in Supabase Auth Logs
- ✅ Emails appear in Mailgun sending logs
- ✅ Verification emails arrive in inbox
- ✅ Users can verify and access the app

