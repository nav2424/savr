# Launch This Week – What’s Left

Use this as your **minimal checklist** to ship SAVR this week. Items are ordered by priority.

---

## Must-do before store submission

### 1. Build & submit (Day 1)

- [ ] **EAS build (iOS)**  
  `eas build --platform ios --profile production`  
  Ensure EAS secrets or build env include any required vars (Supabase, OCR server URL if used in prod).

- [ ] **Submit to App Store Connect**  
  After build: `eas submit --platform ios` (or upload from EAS dashboard).  
  See `TESTFLIGHT_DEPLOYMENT_GUIDE.md` and `eas.json` (submit.production.ios.ascAppId).

- [ ] **Android (optional this week)**  
  If launching both: `eas build --platform android --profile production` then submit to Google Play.

### 2. Supabase production config (Day 1)

- [ ] **Redirect URL for email verification**  
  In Supabase Dashboard → Authentication → URL Configuration, add:  
  `savr://email-verification` (and your production web URL if you use web).  
  See `docs/EMAIL_VERIFICATION_SUPABASE_CONFIG.md`.

- [ ] **Shared pantry (if you use it)**  
  Run in Supabase SQL Editor (if not already):  
  1. `docs/sql/shared-pantry-schema.sql`  
  2. `docs/sql/shared-pantry-fix-rls-recursion.sql`  
  3. `docs/sql/shared-pantry-migrate.sql`  
  See `docs/SHARED_PANTRY_SETUP.md`.

### 3. Env / config for production build (Day 1)

- [ ] **Supabase**  
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in EAS secrets (or build env) for production.

- [ ] **Receipt OCR**  
  If receipt scanning hits your own server: set `EXPO_PUBLIC_API_BASE` (or `API_BASE`) to the production server URL in EAS.  
  If you use a different OCR endpoint, ensure that URL is in env and used in `ScanningService` / server.

- [ ] **Optional: Paywall**  
  To enable subscriptions: `EXPO_PUBLIC_ENABLE_PAYWALL=true` in EAS secrets.  
  RevenueCat keys: `EXPO_PUBLIC_REVENUECAT_*` in EAS.  
  See `docs/LAUNCH_CHECKLIST.md` and `REVENUECAT_QUICK_START.md`.

### 4. Legal minimum for stores (Day 2)

- [ ] **Privacy policy**  
  Hosted URL (required by App Store and Play). Must cover: account data, pantry/receipts, analytics (if any), and subscriptions if paywall is on.

- [ ] **Terms of service** (recommended)  
  Covers use of the app and, if applicable, subscriptions and trials.

- [ ] **Support / contact**  
  Working support email or contact URL in app and store listing.

### 5. App Store Connect listing (Day 2–3)

- [ ] **Required fields**  
  Name, subtitle, description, keywords, category (e.g. Food & Drink), age rating.

- [ ] **Screenshots**  
  At least one set for required device sizes (e.g. 6.7", 6.5", 5.5").

- [ ] **App icon**  
  No transparency; matches `assets/icon.png` / `app.config.js`.

- [ ] **Privacy policy URL**  
  In App Information (and in app if you show it in settings).

- [ ] **Subscription (if paywall on)**  
  Subscription group and products configured; disclosure text and pricing in the listing.

### 6. Smoke test before submit (Day 3)

- [ ] **Sign up**  
  New account → onboarding → email verification link → open app (deep link works).

- [ ] **Core flows**  
  Add pantry item, scan receipt (if server is up), view budget, shared pantry join with code.

- [ ] **Paywall (if enabled)**  
  See paywall where expected; sandbox purchase → access; restore purchases.

See `docs/SIGNUP_FLOW_TEST.md` for sign-up/verification.

---

## Nice-to-do (can be right after launch)

- **Error reporting**  
  Wire Logger/ErrorBoundary to Sentry (or similar) so production errors are reported.  
  See `docs/WEAKNESSES_AND_IMPROVEMENTS.md` (§ Production error reporting).

- **Recipes**  
  Currently off. To enable: `EXPO_PUBLIC_ENABLE_RECIPES=true` and verify recipe services/API keys.  
  See `docs/LAUNCH_CHECKLIST.md` (§ Re-enable Recipes).

- **npm audit**  
  Run `npm audit` and fix high/critical before or soon after launch.

- **Google Play**  
  If you only do iOS this week, Android can follow next week.

---

## Quick reference

| Doc | Use |
|-----|-----|
| `docs/LAUNCH_CHECKLIST.md` | Paywall & recipes flags, before-launch list |
| `LAUNCH_READINESS_CHECKLIST.md` | Full account setup, legal, assets, marketing |
| `TESTFLIGHT_DEPLOYMENT_GUIDE.md` | EAS build + TestFlight |
| `docs/EMAIL_VERIFICATION_SUPABASE_CONFIG.md` | Supabase redirect URL |
| `docs/SIGNUP_FLOW_TEST.md` | Sign-up + verification test |
| `docs/SHARED_PANTRY_SETUP.md` | Shared pantry SQL + behavior |
| `ENV_TEMPLATE.txt` | Env vars to set |

---

## One-line “launch this week” list

1. Set Supabase redirect URL and run shared-pantry SQL if needed.  
2. Set EAS secrets (Supabase, API_BASE, optional paywall/RevenueCat).  
3. Build: `eas build --platform ios --profile production`.  
4. Submit: `eas submit --platform ios`.  
5. Publish privacy policy (and terms) and add URL in App Store Connect.  
6. Fill store listing (name, description, screenshots, icon, category).  
7. Smoke test sign-up, pantry, receipt, and paywall (if on).  
8. Submit for review.
