# 🔍 Troubleshooting: Domain Verified But Still Getting Errors

## If You've Verified Your Domain But Still Getting Errors

Even after verifying your domain, you might still see errors. Here's how to fix it:

---

## ✅ Step 1: Verify Domain Status in Resend

1. **Go to Resend Dashboard**
   - Navigate to https://resend.com/domains
   - Find `savrgrocery.com` in the list

2. **Check Status**
   - Should show **"Verified"** ✅ (not "Pending" or "Not Verified")
   - If it says "Pending", wait a bit longer (can take up to 48 hours)
   - If it says "Not Verified", check DNS records

3. **If Status is "Pending":**
   - DNS records might not have propagated yet
   - Check DNS propagation: https://dnschecker.org
   - Enter your domain and check if TXT records are visible
   - Can take 5 minutes to 48 hours (usually much faster)

---

## ✅ Step 2: Verify Supabase Sender Email

1. **Go to Supabase Dashboard**
   - Settings → Auth → SMTP Settings

2. **Check Sender Email**
   - Must be: `noreply@savrgrocery.com` (or any email from your verified domain)
   - **NOT** `onboarding@resend.dev`
   - **NOT** `noreply@savrgrocery.com` if domain isn't verified

3. **Verify Format**
   - No typos in domain name
   - Correct format: `something@savrgrocery.com`
   - Common options:
     - `noreply@savrgrocery.com`
     - `hello@savrgrocery.com`
     - `no-reply@savrgrocery.com`

4. **Save Settings**
   - Click **Save** (even if it looks correct)
   - Refresh the page and verify it's still saved

---

## ✅ Step 3: Check DNS Records Are Correct

1. **Go to Resend Dashboard**
   - Domains → Click on `savrgrocery.com`
   - View the DNS records that should be added

2. **Verify in Your Domain Registrar**
   - Go to your DNS management (where you manage savrgrocery.com)
   - Check that all records are added:
     - SPF record (TXT)
     - DKIM record(s) (TXT)
     - DMARC record (TXT - optional)

3. **Check DNS Propagation**
   - Go to https://dnschecker.org
   - Enter your domain
   - Check if TXT records are visible globally
   - If not visible, wait for propagation

---

## ✅ Step 4: Test SMTP Connection

1. **In Supabase Dashboard**
   - Settings → Auth → SMTP Settings
   - Look for a "Test Connection" button (if available)
   - Or try sending a test email

2. **Check Supabase Logs**
   - Go to **Logs** → **Auth Logs**
   - Look for recent signup attempts
   - Check for specific error messages

---

## 🔧 Common Issues & Fixes

### Issue 1: Domain Shows "Pending" Forever

**Possible Causes:**
- DNS records not added correctly
- DNS propagation not complete
- Wrong DNS records

**Fix:**
1. Double-check DNS records in your registrar match Resend exactly
2. Verify no typos in record values
3. Wait up to 48 hours for propagation
4. Check DNS propagation at https://dnschecker.org

---

### Issue 2: Domain Shows "Verified" But Still Getting Errors

**Possible Causes:**
- Supabase sender email not updated
- Cached settings
- Wrong sender email format

**Fix:**
1. Verify sender email in Supabase is `noreply@savrgrocery.com`
2. Disable and re-enable "Custom SMTP" in Supabase
3. Re-enter all SMTP settings
4. Save and wait a few minutes
5. Try signup again

---

### Issue 3: Sender Email Updated But Still Using Old Email

**Possible Causes:**
- Settings not saved
- Cache issue
- Multiple Supabase projects

**Fix:**
1. Go to Supabase → Settings → Auth → SMTP Settings
2. Verify sender email is correct
3. Click **Save** again
4. Refresh page
5. Verify it's still correct
6. Try a new signup

---

### Issue 4: DNS Records Added But Not Verified

**Possible Causes:**
- Records not propagated yet
- Wrong record values
- Records in wrong location

**Fix:**
1. Check DNS records match Resend exactly (no typos)
2. Verify records are in root domain (@) not subdomain
3. Wait for DNS propagation (check at dnschecker.org)
4. In Resend, click "Verify" or "Refresh" button

---

## 🔍 Diagnostic Checklist

- [ ] Domain shows "Verified" in Resend dashboard (not "Pending")
- [ ] DNS records are added correctly in domain registrar
- [ ] DNS records have propagated (check dnschecker.org)
- [ ] Supabase sender email is `noreply@savrgrocery.com` (or from verified domain)
- [ ] Supabase sender email is NOT `onboarding@resend.dev`
- [ ] "Custom SMTP" is enabled in Supabase
- [ ] All SMTP settings are saved in Supabase
- [ ] Tried refreshing Supabase settings page
- [ ] Checked Supabase Auth Logs for specific errors
- [ ] Waited a few minutes after updating settings

---

## 🚀 Quick Fixes to Try

### Fix 1: Refresh Supabase Settings
1. Disable "Custom SMTP" in Supabase
2. Save
3. Enable "Custom SMTP" again
4. Re-enter sender email: `noreply@savrgrocery.com`
5. Save
6. Wait 2-3 minutes
7. Try signup again

### Fix 2: Verify Domain Status
1. Go to Resend → Domains
2. Check if `savrgrocery.com` shows "Verified"
3. If "Pending", wait longer or check DNS records
4. If "Not Verified", re-add DNS records

### Fix 3: Double-Check Sender Email
1. Supabase → Settings → Auth → SMTP Settings
2. Verify sender email is exactly: `noreply@savrgrocery.com`
3. No typos, no extra spaces
4. Save again

### Fix 4: Check DNS Propagation
1. Go to https://dnschecker.org
2. Enter: `savrgrocery.com`
3. Select "TXT" record type
4. Check if Resend's TXT records are visible
5. If not visible, wait for propagation

---

## 📋 What to Check Right Now

1. **Resend Dashboard:**
   - Go to https://resend.com/domains
   - What status does `savrgrocery.com` show?
   - If "Verified" ✅, proceed to step 2
   - If "Pending", wait or check DNS

2. **Supabase Settings:**
   - Settings → Auth → SMTP Settings
   - What is the "Sender Email" field?
   - Should be: `noreply@savrgrocery.com`
   - Is "Custom SMTP" enabled?

3. **Try Signup:**
   - Try signing up with a test email
   - Check Supabase Auth Logs
   - What's the exact error message?

---

## 🆘 Still Not Working?

If domain is verified and sender email is correct but still getting errors:

1. **Share the exact error from Supabase Auth Logs**
   - Go to Logs → Auth Logs
   - Find the most recent signup attempt
   - Copy the full error message

2. **Verify Domain Status Screenshot**
   - Take a screenshot of Resend domains page
   - Show that domain is "Verified"

3. **Check Supabase SMTP Settings**
   - Verify all fields are correct
   - Take a screenshot (hide sensitive info)

4. **Try Different Sender Email**
   - Try: `hello@savrgrocery.com` instead of `noreply@savrgrocery.com`
   - Sometimes one format works better than another

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Domain shows "Verified" in Resend
- ✅ Supabase sender email is from your verified domain
- ✅ Signups complete without errors
- ✅ Verification emails arrive in inbox
- ✅ No errors in Supabase Auth Logs

---

## 💡 Pro Tips

1. **Wait After Changes:** After updating Supabase settings, wait 2-3 minutes before testing
2. **DNS Propagation:** Can take up to 48 hours (usually much faster, 5-30 minutes)
3. **Clear Cache:** Try in incognito/private browser window
4. **Check Logs:** Always check Supabase Auth Logs for specific errors

