# Sign-Up Flow – Manual Test (Start to Finish)

Run this on a **device or simulator** with the app installed (Expo Go or dev build). Use a **real email** you can access so you can tap the verification link.

---

## 1. Start fresh

- If you’re already signed in, sign out (More → Sign out).
- Or use a new email you’ve never used in the app.

---

## 2. Welcome → Sign up

- Open the app. You should see the **welcome** screen.
- Tap **Sign up** (or equivalent).
- On the **auth** screen:
  - Enter **name** (e.g. "Test User").
  - Enter **email** (real address you can open on this device).
  - Enter **password** (e.g. 6+ characters).
  - Confirm password.
- Tap **Sign up**.
- **Expected:** Brief loading, then navigate to **onboarding** (no error toast/alert).

---

## 3. Onboarding

- Go through all onboarding steps:
  - Welcome → Continue.
  - **Location:** Pick a country → Continue.
  - **Household:** Pick household size, optionally allergies → Continue.
  - **Budget:** Pick or enter monthly budget → Continue.
  - **Complete:** Tap **Get started**.
- **Expected:** Navigate to **email verification** screen (or directly to tabs if email is already verified in your Supabase setup).

---

## 4. Email verification screen

- You should see “Verify your email” and the email you used.
- **Expected:** No “Email not found” or SMTP error.
- Open your **email** (on the same device, or another device and then open the app again).
- Find the **SAVR verification email**.
- **Expected:** Link in the email looks like `savr://email-verification#...` or a Supabase confirmation URL that redirects to that.

---

## 5. Tap the verification link

- Tap the verification link in the email.
- **Expected (ideal):** The **app** opens (not the browser/website) and you land **inside the app, signed in** (dashboard/tabs). You should **not** be asked to sign in again.
- If the **browser** opens instead: you’re on the wrong redirect (e.g. website). Check Supabase URL config: Redirect URL should be `savr://email-verification` for app-first flow.

---

## 6. After “signed in” – Dashboard

- On the **dashboard** (home):
  - **Expected:** Greeting uses your **name** (e.g. “Good morning, Test!”).
  - **Expected:** Budget / preferences from onboarding appear (e.g. budget, allergies) once loaded.
- Open **More** (or profile/settings).
- **Expected:** Your name/email and any onboarding info are shown and saved.

---

## 7. Resend (optional)

- Sign out, sign up again with another email, or from the **email verification** screen:
- Tap **Resend verification email**.
- **Expected:** Toast “Verification email sent. Check inbox and spam.” (or similar). No crash; cooldown (e.g. 30s) before resend again.

---

## Quick checklist

| Step                    | What to do              | Pass if                                      |
|-------------------------|--------------------------|----------------------------------------------|
| 1. Welcome              | Open app                 | Welcome screen shows                         |
| 2. Sign up              | Name, email, password    | Navigate to onboarding                       |
| 3. Onboarding           | Complete all steps       | Navigate to email verification (or tabs)     |
| 4. Verification screen  | See screen + email       | Email received, link present                 |
| 5. Tap link             | Tap link in email        | App opens, user signed in (no re-sign-in)    |
| 6. Dashboard            | Check home + profile     | Name and onboarding data visible             |
| 7. Resend               | Tap Resend               | Toast + no error                             |

---

## If something fails

- **Link opens website instead of app:** Supabase → Auth → URL Configuration → Redirect URLs must include `savr://email-verification` (and app must send that same URL). See `EMAIL_VERIFICATION_SUPABASE_CONFIG.md`.
- **“Email not configured” / no email:** Configure SMTP in Supabase (or check Email templates / rate limits).
- **Have to sign in again after tapping link:** App isn’t getting the tokens. Ensure link opens the **app** (savr://...) and that `createSessionFromUrl` runs on that URL (initial URL + Linking listener). Check console logs for “Session created from email verification link”.
- **Name/preferences missing on dashboard:** Pending onboarding may not be applied yet. Check that `applyPendingOnboardingData` runs after sign-in and that dashboard refreshes preferences (e.g. after a short delay or on focus).
