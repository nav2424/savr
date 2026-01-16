# 📧 Complete Resend SMTP Configuration

## All SMTP Settings for Supabase

Use these exact values to configure Resend in Supabase:

---

## ✅ Complete Configuration

### For Supabase Dashboard → Settings → Auth → SMTP Settings

```
Enable Custom SMTP: ON (toggle enabled)

SMTP Host: smtp.resend.com
SMTP Port: 465
SMTP User: resend
SMTP Password: [Your Resend API Key - starts with re_]
Sender Email: noreply@savrgrocery.com
Sender Name: SAVR
```

---

## 🔑 Step-by-Step: Get Your Resend API Key

1. **Go to Resend Dashboard**
   - https://resend.com
   - Log in to your account

2. **Navigate to API Keys**
   - Click **API Keys** in the left sidebar
   - Or go to: https://resend.com/api-keys

3. **Create or Copy API Key**
   - If you don't have one: Click **"Create API Key"**
   - Name it: "SAVR Supabase SMTP"
   - Copy the key (starts with `re_`)
   - **Important:** Copy it immediately - you can't see it again!

4. **Use This as SMTP Password**
   - The API key IS your SMTP password
   - Paste it in the "SMTP Password" field in Supabase

---

## 📋 Exact Values to Enter

### SMTP Host
```
smtp.resend.com
```

### SMTP Port
```
465
```
(Alternative: `587` if 465 doesn't work)

### SMTP User
```
resend
```
(Always "resend" - this is the same for everyone)

### SMTP Password
```
[Your Resend API Key]
```
- Starts with `re_`
- Get from: https://resend.com/api-keys
- This is your API key, not a separate password

### Sender Email
```
noreply@savrgrocery.com
```
(Or any email from your verified domain)

### Sender Name
```
SAVR
```
(Or whatever you want to appear as the sender name)

---

## 🔍 Where to Find Each Value

| Setting | Where to Find | Example |
|---------|---------------|---------|
| **SMTP Host** | Always: `smtp.resend.com` | `smtp.resend.com` |
| **SMTP Port** | Always: `465` or `587` | `465` |
| **SMTP User** | Always: `resend` | `resend` |
| **SMTP Password** | Resend Dashboard → API Keys | `re_AbCdEf123...` |
| **Sender Email** | Your verified domain | `noreply@savrgrocery.com` |
| **Sender Name** | Your choice | `SAVR` |

---

## ✅ Complete Example Configuration

Here's what your Supabase SMTP settings should look like:

```
┌─────────────────────────────────────────┐
│ Enable Custom SMTP: [ON]               │
│                                         │
│ SMTP Host: smtp.resend.com             │
│ SMTP Port: 465                          │
│ SMTP User: resend                       │
│ SMTP Password: re_AbCdEf123GhIjKl456...│
│ Sender Email: noreply@savrgrocery.com  │
│ Sender Name: SAVR                       │
└─────────────────────────────────────────┘
```

---

## 🔐 Security Notes

1. **API Key is Secret**
   - Never share your API key
   - Don't commit it to git
   - If exposed, regenerate it immediately

2. **Regenerate if Needed**
   - If you lose your key or it's compromised
   - Go to Resend → API Keys
   - Delete old key, create new one
   - Update Supabase with new key

---

## 🚨 Common Mistakes

### ❌ Wrong SMTP User
- ❌ `your-email@gmail.com`
- ❌ `your-resend-email@resend.com`
- ✅ `resend` (always this)

### ❌ Wrong SMTP Password
- ❌ Your Resend account password
- ❌ Your email password
- ✅ Your Resend API key (starts with `re_`)

### ❌ Wrong Host
- ❌ `smtp.resend.com` (typo)
- ❌ `resend.com`
- ✅ `smtp.resend.com` (exact)

### ❌ Wrong Port
- ❌ `25` (not supported)
- ❌ `2525` (not supported)
- ✅ `465` (SSL) or `587` (TLS)

---

## 📝 Quick Copy-Paste Template

Copy this and fill in your API key:

```
Host: smtp.resend.com
Port: 465
User: resend
Password: [PASTE YOUR API KEY HERE]
Sender: noreply@savrgrocery.com
Name: SAVR
```

---

## 🔄 Alternative Port (If 465 Doesn't Work)

If port 465 doesn't work, try:

```
SMTP Port: 587
```

Both ports work, but 465 (SSL) is more common.

---

## ✅ Verification Checklist

Before testing, verify:

- [ ] "Enable Custom SMTP" is ON (green/enabled)
- [ ] SMTP Host is exactly: `smtp.resend.com`
- [ ] SMTP Port is: `465` (or `587`)
- [ ] SMTP User is exactly: `resend`
- [ ] SMTP Password is your API key (starts with `re_`)
- [ ] Sender Email is from your verified domain: `noreply@savrgrocery.com`
- [ ] Sender Name is set: `SAVR`
- [ ] All fields saved
- [ ] Domain is verified in Resend

---

## 🧪 Test Configuration

After entering all settings:

1. **Click Save** in Supabase
2. **Wait 1-2 minutes** for settings to propagate
3. **Try a signup** with a test email
4. **Check Supabase Auth Logs** for any errors
5. **Check inbox** for verification email

---

## 🆘 If It Still Doesn't Work

1. **Verify API Key is Active**
   - Go to Resend → API Keys
   - Make sure key is not revoked/deleted

2. **Check Domain Status**
   - Go to Resend → Domains
   - Make sure `savrgrocery.com` shows "Verified"

3. **Try Different Port**
   - If using 465, try 587
   - If using 587, try 465

4. **Regenerate API Key**
   - Create new API key in Resend
   - Update Supabase with new key

5. **Check Supabase Logs**
   - Logs → Auth Logs
   - Look for specific error messages

---

## 📚 Related Resources

- **Resend API Keys:** https://resend.com/api-keys
- **Resend Domains:** https://resend.com/domains
- **Resend Docs:** https://resend.com/docs
- **Supabase SMTP Docs:** https://supabase.com/docs/guides/auth/auth-smtp

---

## ✅ Success!

Once configured correctly, you should see:
- ✅ No errors in Supabase Auth Logs
- ✅ Signups complete successfully
- ✅ Verification emails arrive in inbox
- ✅ Emails come from `noreply@savrgrocery.com`

