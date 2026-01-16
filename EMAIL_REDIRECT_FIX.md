# 🔗 Fix Email Verification Redirect (Localhost Issue)

## The Problem
When you click the email verification link, it redirects to `localhost` instead of opening the app.

## The Solution
Configure Supabase to use your app's deep link URL for email verification redirects.

---

## ✅ Step 1: Configure Redirect URL in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project

2. **Open URL Configuration**
   - Go to **Settings** → **Auth** → **URL Configuration**

3. **Add Redirect URL**
   - Find **"Redirect URLs"** section
   - Click **"Add URL"**
   - Enter: `savr://email-verification`
   - Click **Save**

4. **Also Add Site URL (if needed)**
   - Make sure **"Site URL"** is set (can be any valid URL, like `https://savr.app`)
   - This is required for Supabase to work properly

---

## ✅ Step 2: Verify Email Template

1. Go to **Authentication** → **Email Templates**
2. Click **"Confirm signup"** template
3. Make sure the template uses `{{ .ConfirmationURL }}` in the body
4. The `{{ .ConfirmationURL }}` will automatically use the redirect URL you configured

---

## ✅ Step 3: Test It

1. **Sign up with a test email**
2. **Check your inbox** for the verification email
3. **Click the verification link**
4. **The app should open** (not localhost) ✅

---

## 🔍 If Still Redirecting to Localhost

### Option A: Use a Web URL (Alternative)

If Supabase doesn't accept the custom scheme directly:

1. **Create a simple web redirect page** (hosted anywhere)
   - The page should redirect to `savr://email-verification`
   - Example: `https://yourdomain.com/verify` → redirects to `savr://email-verification`

2. **Use that web URL in Supabase**
   - Add `https://yourdomain.com/verify` to Redirect URLs
   - Update `emailRedirectTo` in code to use this URL

### Option B: Check Development vs Production

- **Development**: Use `exp://localhost:8081/--/email-verification`
- **Production**: Use `savr://email-verification`

The code automatically uses the correct URL based on environment.

---

## 📋 Checklist

- [ ] Added `savr://email-verification` to Supabase Redirect URLs
- [ ] Site URL is configured in Supabase
- [ ] Email template uses `{{ .ConfirmationURL }}`
- [ ] Tested signup and clicked verification link
- [ ] App opens (not localhost) ✅

---

## 🆘 Still Not Working?

1. **Check Supabase Logs**: Settings → Logs → Auth Logs
2. **Verify Redirect URL**: Make sure it's exactly `savr://email-verification` (no typos)
3. **Test Deep Link**: Try opening `savr://email-verification` manually in a browser/terminal
4. **Check App Scheme**: Verify `scheme: "savr"` in `app.config.js`

---

**That's it!** After configuring the redirect URL, email verification links should open your app instead of localhost. 🎉

