# Manual test: New user onboarding start to finish

Use this to verify onboarding data (allergies, budget, household, name) persists to the dashboard.

## Prerequisites

- App running on simulator or device: `npx expo start` then press `i` (iOS) or `a` (Android), or open in Expo Go.
- Supabase project with Auth and `users.preferences` column (see `docs/sql/add-user-preferences-column.sql` if needed).

## Steps

1. **Start fresh**
   - If already signed in: More → Sign out.
   - Or use a new email you’ve never used in the app.

2. **Welcome**
   - Open the app. You should see the welcome screen.
   - Tap **Sign up**.

3. **Sign up**
   - Enter name (e.g. "Test User").
   - Enter email (real address you can access).
   - Enter password (6+ characters).
   - Tap **Sign up**.
   - You should land on **Onboarding** (not an error).

4. **Onboarding**
   - **Location:** Pick a country (e.g. United States) → Continue.
   - **Household:** Pick household size (e.g. 3) → Continue.
   - **Allergies:** Add at least one allergy (e.g. Peanuts, Dairy) → Continue.
   - **Budget:** Enter monthly budget (e.g. 600) → Continue.
   - **Complete:** Tap **Get started**.

5. **After onboarding**
   - You should go to **Email verification** (or directly to the app if email is already verified).
   - If you see **Email verification:** open the verification email and tap the link (or wait and use **Resend** if needed).
   - After verification (or if already verified), you should land on the **Home** tab (dashboard).

6. **Verify on dashboard**
   - **Greeting** uses your name (e.g. "Good morning, Test!").
   - **Budget** shows the monthly budget you set (e.g. $600).
   - **Allergy Shield** (if you added allergies) shows your allergies (e.g. Peanuts, Dairy).
   - **More / Profile** (if available) shows your preferences.

7. **Optional: leave and return**
   - Close the app completely and reopen (or sign out and sign back in).
   - Dashboard should still show the same name, budget, and allergies.

## Automated tests

The same flow is covered by tests:

- **Unit / merge:** `lib/__tests__/onboardingPreferences.test.ts`
- **E2E flow:** `lib/__tests__/onboardingFlow.e2e.test.ts`

Run:

```bash
npm test -- --testPathPattern="onboardingPreferences|onboardingFlow"
```

## If something fails

- **Onboarding data not on dashboard:** Check Supabase Auth logs and `users` table; ensure `users.preferences` column exists and RLS allows update for the signed-in user.
- **Stuck on email verification:** Ensure redirect URL in Supabase includes `savr://email-verification` (or your app scheme). See `EMAIL_VERIFICATION_SUPABASE_CONFIG.md`.
