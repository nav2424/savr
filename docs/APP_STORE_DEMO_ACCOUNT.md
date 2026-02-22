# App Store Demo / Test Account

Use this guide to create a **test/demo user** that App Store reviewers (and you) can use to sign in without creating an account. Apple requires demo credentials when your app has sign-in.

---

## 1. Create the demo user in Supabase

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your SAVR project.
2. Go to **Authentication** → **Users**.
3. Click **"Add user"** → **"Create new user"**.
4. Fill in:
   - **Email:** `appstore-demo@savr.app` (or any valid email you control; use a real inbox if you want to test verification).
   - **Password:** Choose a strong, memorable password (e.g. `SavrDemo2025!`). You’ll give this to App Store Connect.
   - **Auto Confirm User:** turn **ON** so the account works immediately without email verification.
5. Click **Create user**.

**Suggested credentials (you can change these):**

| Field    | Value                  |
|----------|------------------------|
| Email    | `appstore-demo@savr.app` |
| Password | `SavrDemo2025!`        |

Use the **exact** email and password when filling App Store Connect and when testing sign-in.

---

## 2. Enter credentials in App Store Connect

When submitting your app for review:

1. Go to **[App Store Connect](https://appstoreconnect.apple.com)** → your app.
2. Open **App Information** (or the version you’re submitting).
3. Scroll to **App Review Information**.
4. If your app requires sign-in:
   - Enable **"Sign-in required"** (or equivalent).
   - In **Demo account** (or **Username** / **Password**), enter:
     - **Username:** the demo **email** (e.g. `appstore-demo@savr.app`).
     - **Password:** the demo **password** (e.g. `SavrDemo2025!`).
5. Save.

Reviewers will use these credentials to sign in and test the app.

---

## 3. Optional: add demo user via SQL (advanced)

If you prefer to create the user via Supabase SQL (e.g. in a migration), use the Auth API from a backend or the Dashboard SQL editor. Supabase does not support inserting into `auth.users` directly from SQL in a supported way; the recommended method is **Dashboard → Authentication → Add user** as in step 1.

To create a user programmatically you’d use the [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser) (service role) from a secure backend—not from the client app.

---

## 4. Verify before submission

- [ ] Demo user exists in Supabase (Authentication → Users).
- [ ] **Auto Confirm User** was enabled so the account doesn’t require email verification.
- [ ] You can sign in in the app with the demo email and password (Sign out first, then use **Sign in**).
- [ ] Demo email and password are entered in App Store Connect under App Review Information.

---

## 5. Security notes

- Use a **dedicated** demo account (e.g. `appstore-demo@savr.app`), not a personal or admin account.
- Use a **strong password** even for demo; only Apple reviewers and your team need it.
- If you rotate the password, update it in Supabase and in App Store Connect before the next submission.
- You can delete or disable this user after launch if you no longer need it; create a new one when you submit again.
