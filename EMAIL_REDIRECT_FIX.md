# Email Verification Redirect Fix

## Problem

Verification links in signup emails were sending users to `localhost` or an app deep link that opened in a browser with no useful page. Users should land on a **web page** that says: **"Your email has been verified. Please return to the app."** and offers an "Open in app" option.

## What Was Done

1. **`app/email-verified.tsx`**  
   New route that shows:
   - "Your email has been verified."
   - "Please return to the app."
   - "Open in app" button that deep-links to the SAVR app (and passes the hash so the app can restore the session if needed).

2. **Production redirect URL**  
   When `EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL` is set, signup and "Resend verification email" use it as the redirect URL. That URL must point to your **deployed web app** at `/email-verified` (e.g. `https://yourapp.com/email-verified`).

3. **Config and env**  
   - `app.config.js` passes `EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL` into `extra` so the app can read it at runtime.
   - `ENV_TEMPLATE.txt` documents the variable.

## Setup (Production)

1. **Deploy the app for web**  
   Deploy the Expo app as a website (e.g. Vercel, Netlify, or Expo’s web build) so that `/email-verified` is a real URL (e.g. `https://yourapp.com/email-verified`).

2. **Set the env variable**  
   In your build/deploy environment, set:
   ```bash
   EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL=https://yourapp.com/email-verified
   ```
   Use your actual web base URL; the path must be `/email-verified` to match the new route.

3. **Allow the URL in Supabase**  
   In **Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL**: your main app URL (e.g. `https://yourapp.com`).
   - **Redirect URLs**: add exactly:
     ```
     https://yourapp.com/email-verified
     ```
   (and any other redirect URLs you need, e.g. `savr:///email-verification` for deep link).

4. **Rebuild**  
   Rebuild the app (and redeploy web) so the new env and route are used. New signups will get verification emails that point to your web `/email-verified` page.

## Local / No env set

If `EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL` is **not** set, the app keeps using the app deep link (`savr:///email-verification` or `Linking.createURL('/email-verification')`). In that case, clicking the link in email may open the app directly (if the OS supports it) or still open a browser; for a consistent “verified” message, set the env and use the web `/email-verified` page as above.
