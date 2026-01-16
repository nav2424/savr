# 🔧 Fix: Resend Domain Not Verified

## The Problem

You're trying to send emails from `savrgrocery.com` but this domain is not verified in Resend.

**Error:** `450 The savrgrocery.com domain is not verified. Please, add and verify your domain on https://resend.com/domains`

---

## ⚡ Quick Fix (2 Options)

### Option 1: Use Resend Default Email (Immediate - Testing)

**Use this for immediate testing** - no domain verification needed!

1. **Go to Supabase Dashboard**
   - Settings → Auth → SMTP Settings

2. **Change Sender Email to:**
   ```
   Sender Email: onboarding@resend.dev
   ```
   (Instead of your custom domain email)

3. **Save and test**
   - Signups should work immediately
   - Emails will come from `onboarding@resend.dev`

**Note:** This works for testing, but for production you should verify your domain.

---

### Option 2: Verify Your Domain in Resend (Production)

**Do this for production** - looks more professional!

1. **Go to Resend Dashboard**
   - Navigate to https://resend.com/domains
   - Or go to **Domains** in the left sidebar

2. **Add Your Domain**
   - Click **Add Domain**
   - Enter: `savrgrocery.com`
   - Click **Add**

3. **Add DNS Records**
   - Resend will show you DNS records to add
   - You need to add these to your domain registrar:
     - **SPF record** (TXT)
     - **DKIM records** (TXT)
     - **DMARC record** (TXT - optional but recommended)

4. **Add Records to Your Domain**
   - Go to your domain registrar (where you bought savrgrocery.com)
   - Go to DNS settings
   - Add the records Resend provides
   - Save

5. **Wait for Verification**
   - Resend will verify automatically (usually 5-30 minutes)
   - Check Resend dashboard - status will change to "Verified"

6. **Update Supabase**
   - Once verified, you can use emails from your domain:
   ```
   Sender Email: noreply@savrgrocery.com
   ```
   (Or any email from your verified domain)

---

## 📋 Step-by-Step: Verify Domain in Resend

### Step 1: Add Domain in Resend

1. Go to https://resend.com/domains
2. Click **"Add Domain"** button
3. Enter: `savrgrocery.com`
4. Click **"Add"**

### Step 2: Get DNS Records

Resend will show you records like:

```
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all

Type: TXT
Name: resend._domainkey
Value: [long DKIM key]

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none;
```

### Step 3: Add to Your Domain Registrar

1. **Log into your domain registrar**
   - Where you bought savrgrocery.com (GoDaddy, Namecheap, Cloudflare, etc.)

2. **Go to DNS Settings**
   - Usually under "DNS Management" or "DNS Records"

3. **Add Each Record**
   - Add the SPF record
   - Add the DKIM record(s)
   - Add DMARC record (optional but recommended)

4. **Save Changes**

### Step 4: Wait for Verification

1. Go back to Resend dashboard
2. Check domain status
3. It will show "Pending" then change to "Verified"
4. Usually takes 5-30 minutes

### Step 5: Update Supabase

Once verified:
1. Go to Supabase → Settings → Auth → SMTP Settings
2. Update Sender Email to use your domain:
   ```
   Sender Email: noreply@savrgrocery.com
   ```
3. Save

---

## 🎯 Recommended Approach

### For Immediate Testing:
**Use `onboarding@resend.dev`** - works right away, no setup needed

### For Production:
**Verify your domain** - looks professional, better deliverability

---

## ✅ Quick Fix Right Now

**To get signups working immediately:**

1. Supabase Dashboard → Settings → Auth → SMTP Settings
2. Change **Sender Email** from your custom domain to:
   ```
   onboarding@resend.dev
   ```
3. Click **Save**
4. Test signup - should work now! ✅

**Then later, verify your domain for production use.**

---

## 🔍 How to Check Domain Status

1. Go to https://resend.com/domains
2. Find `savrgrocery.com` in the list
3. Status will show:
   - **"Not Added"** - Domain not added yet
   - **"Pending"** - DNS records added, waiting for verification
   - **"Verified"** - ✅ Ready to use!

---

## 🆘 Common Issues

### "Domain already exists"
- Domain might be added to another Resend account
- Check if you have multiple Resend accounts
- Or domain was previously added

### "DNS records not found"
- Records might not have propagated yet
- Wait 10-30 minutes after adding
- Check DNS propagation: https://dnschecker.org

### "Verification taking too long"
- DNS propagation can take up to 48 hours (usually much faster)
- Double-check records are added correctly
- Make sure no typos in DNS records

---

## 📚 Related Guides

- **`BEST_EMAIL_PLATFORM.md`** - Why Resend is recommended
- **`SMTP_SETUP_COMPLETE.md`** - Full SMTP setup guide
- **Resend Docs:** https://resend.com/docs

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Domain shows "Verified" in Resend dashboard
- ✅ Signups complete without errors
- ✅ Emails arrive from your custom domain
- ✅ No errors in Supabase Auth Logs

