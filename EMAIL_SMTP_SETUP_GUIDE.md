# 📧 Email SMTP Setup Guide for SAVR

## Quick Start: Resend (Recommended)

### Step 1: Sign Up for Resend
1. Go to [https://resend.com](https://resend.com)
2. Sign up with your email (free tier: 3,000 emails/month)
3. Verify your email address

### Step 2: Get API Key
1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Name it "SAVR Production" (or similar)
4. Copy the API key (starts with `re_`)

### Step 3: Verify Domain (Optional but Recommended)
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `savr.app` or `getsavr.com`)
4. Add the DNS records they provide to your domain registrar
5. Wait for verification (usually a few minutes)

**For Testing:** You can use `onboarding@resend.dev` without domain verification

### Step 4: Configure in Supabase
1. Go to your Supabase Dashboard: [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Auth** → **SMTP Settings**
4. Enable **"Enable Custom SMTP"**
5. Fill in the following:

```
SMTP Host: smtp.resend.com
SMTP Port: 465 (or 587 for TLS)
SMTP User: resend
SMTP Password: [Your Resend API key - starts with re_]
Sender Email: onboarding@resend.dev (or your verified domain email)
Sender Name: SAVR
```

6. Click **Save**

### Step 5: Test
1. Try signing up a new account
2. Check your email inbox
3. You should receive the verification email from `onboarding@resend.dev` (or your custom domain)

---

## Alternative: Gmail (Quick Testing Only)

⚠️ **Not recommended for production** - Limited to 500 emails/day

### Step 1: Enable App Password
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Go to **Security** → **2-Step Verification** (enable if not already)
3. Go to **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Name it "SAVR Supabase"
6. Copy the 16-character password

### Step 2: Configure in Supabase
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: [The 16-character app password]
Sender Email: your-email@gmail.com
Sender Name: SAVR
```

---

## Alternative: SendGrid (Production)

### Step 1: Sign Up
1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)

### Step 2: Create API Key
1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it "SAVR SMTP"
4. Choose **"Full Access"** or **"Mail Send"** permission
5. Copy the API key

### Step 3: Verify Sender
1. Go to **Settings** → **Sender Authentication**
2. Verify a Single Sender (your email) or Domain
3. Follow the verification steps

### Step 4: Configure in Supabase
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API key]
Sender Email: [Your verified email]
Sender Name: SAVR
```

---

## Alternative: Mailgun (Production)

### Step 1: Sign Up
1. Go to [https://www.mailgun.com](https://www.mailgun.com)
2. Sign up (free tier: 5,000 emails/month for 3 months, then 1,000/month)

### Step 2: Get SMTP Credentials
1. Go to **Sending** → **Domain Settings**
2. Use sandbox domain for testing, or add your own domain
3. Go to **Sending** → **SMTP credentials**
4. Copy your SMTP username and password

### Step 3: Configure in Supabase
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: [Your Mailgun SMTP username]
SMTP Password: [Your Mailgun SMTP password]
Sender Email: [Your verified email or sandbox email]
Sender Name: SAVR
```

---

## Customizing Email Templates

After setting up SMTP, customize your email templates:

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Customize:
   - **Subject**: "Verify your SAVR account"
   - **Body**: Add your branding, colors, logo
   - **Redirect URL**: Your app's deep link or website

### Example Custom Template:
```
Subject: Verify your SAVR account

Hi there!

Click the link below to verify your email and start saving money with SAVR:

{{ .ConfirmationURL }}

If you didn't sign up for SAVR, you can safely ignore this email.

Thanks,
The SAVR Team
```

---

## Testing Your Setup

1. **Test Signup Flow:**
   - Sign up with a test email
   - Check if verification email arrives
   - Check spam folder if not in inbox

2. **Test Resend:**
   - Go to email verification screen
   - Click "Resend Verification Email"
   - Verify it arrives

3. **Check Email Headers:**
   - Open the received email
   - Check "From" field shows your configured sender
   - Verify it's not going to spam

---

## Troubleshooting

### Emails Not Arriving?
1. Check spam folder
2. Verify SMTP credentials are correct
3. Check Supabase logs: **Logs** → **Auth Logs**
4. Verify sender email is verified in your SMTP provider

### "Authentication Failed" Error?
- Double-check SMTP password/API key
- For Gmail: Make sure you're using App Password, not regular password
- For SendGrid: Make sure API key has "Mail Send" permission

### Emails Going to Spam?
- Verify your domain with SPF/DKIM records
- Use a custom domain instead of generic email
- Warm up your sending domain gradually

---

## Recommended Setup for Production

1. **Use Resend or SendGrid** (better deliverability than Gmail)
2. **Verify your own domain** (looks more professional)
3. **Customize email templates** (match your brand)
4. **Monitor email delivery** (check Supabase auth logs)

---

## Quick Reference: Supabase SMTP Settings Location

**Path:** Supabase Dashboard → Settings → Auth → SMTP Settings

**Required Fields:**
- ✅ Enable Custom SMTP (toggle)
- ✅ SMTP Host
- ✅ SMTP Port (usually 587 or 465)
- ✅ SMTP User
- ✅ SMTP Password
- ✅ Sender Email
- ✅ Sender Name

---

## Need Help?

If you're stuck, check:
- Supabase Auth Documentation: https://supabase.com/docs/guides/auth/auth-smtp
- Resend Documentation: https://resend.com/docs
- SendGrid Documentation: https://docs.sendgrid.com

