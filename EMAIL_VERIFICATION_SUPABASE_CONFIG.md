# Email Verification – Supabase URL Configuration

For sign-up and email verification to work correctly, the verification link in the email **must open the app** (not the website). If the link sends users to the SAVR landing page instead of the app, they have to sign in again and the flow feels broken.

## 1. Redirect URL must match exactly

The app sends this redirect URL when signing up and when resending the verification email:

- **Production default:** `savr://email-verification` (no path slashes)
- **Override:** Set `EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL` in EAS/env if you use a different URL

Supabase uses this URL as the link target in the verification email. If it is **not** in the Supabase allow list, Supabase falls back to **Site URL** (e.g. `https://www.savrgrocery.com/`), so users land on the website instead of the app.

## 2. Supabase Dashboard setup

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add **exactly**:
   - `savr://email-verification`
3. Optional: add `savr://**` to allow any path under the `savr` scheme.
4. **Do not** rely on Site URL for email verification. Site URL is the fallback when the requested redirect is not allowed; for verification we want the app deep link, not the website.
5. Save.

After this, sign-up and resend will use `savr://email-verification`, and the link in the email will open the app with the tokens so the user is signed in automatically (no second sign-in).

## 3. If the link still goes to the website

- Confirm **Redirect URLs** contains `savr://email-verification` (no typos, no extra slashes).
- Confirm the app is using the same URL (no env override that points to the website).
- In Supabase **Authentication** → **Email Templates**, ensure the confirmation template does not override the redirect URL and uses the variable Supabase provides for the confirmation link.

## 4. Verification emails not sending

If verification emails do not arrive:

- Configure **SMTP** in Supabase: **Project Settings** → **Auth** → **SMTP Settings** (or use Supabase’s default sender and check rate limits).
- See `SMTP_SETUP_COMPLETE.md` (or your SMTP docs) for your provider.
- Check **Authentication** → **Users** and **Logs** for delivery/errors.

## 5. Web fallback (optional)

If you want the same link to work when opened in a **browser** (e.g. on desktop):

1. Add a redirect URL like `https://www.savrgrocery.com/email-verified` in Supabase.
2. Build a page at that path that:
   - Reads the hash from the URL (e.g. `#access_token=...&refresh_token=...`).
   - Shows “Email verified. Open the SAVR app to continue.”
   - Redirects or links to `savr://email-verification` + the same hash so that on mobile the app opens and receives the tokens.

For app-only flows, using `savr://email-verification` in the app and in Supabase Redirect URLs is enough.
