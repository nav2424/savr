# SAVR Launch Checklist

Use this checklist when re-enabling **Paywall** and **Recipes** for launch. Feature flags control these at runtime so you can test with flags off and enable for production without code changes.

---

## Enabling paywall (1–2 days)

When you’re ready to turn the paywall on:

1. **Set the flag**  
   In EAS secrets or `.env`: `EXPO_PUBLIC_ENABLE_PAYWALL=true`. No code change needed; the app already uses `config.enablePaywall`.

2. **RevenueCat**  
   Confirm RevenueCat project, API keys, and products/entitlements are set. Test with a sandbox account. See `REVENUECAT_QUICK_START.md` if needed.

3. **Smoke test**  
   Build with the flag on → open app → confirm unsubscribed users see the paywall and a sandbox purchase grants access.

---

## Feature flags

| Flag | Default | Effect |
|------|--------|--------|
| `EXPO_PUBLIC_ENABLE_PAYWALL` | unset (off) | When set to `true` or `1`, wraps the app in `SubscriptionProvider` and `SubscriptionGate`. |
| `EXPO_PUBLIC_ENABLE_RECIPES` | unset (off) | When set to `true` or `1`, mounts `RecipesProvider` so recipe screens and context are available. |

Set in EAS secrets or in `.env` / EAS build env, e.g.:

- `EXPO_PUBLIC_ENABLE_PAYWALL=true`
- `EXPO_PUBLIC_ENABLE_RECIPES=true`

---

## Re-enable Paywall

1. **Set the flag**  
   In EAS (or `.env`): `EXPO_PUBLIC_ENABLE_PAYWALL=true`. No code change required; `_layout.tsx` reads `config.enablePaywall`.

2. **Verify RevenueCat**  
   - RevenueCat project and API keys are configured (see `lib/SubscriptionContext.tsx` and env: `EXPO_PUBLIC_REVENUECAT_*` if used).  
   - Products/entitlements are set up in RevenueCat dashboard.  
   - Test with a sandbox Apple/Google account.

3. **Smoke test**  
   - Build with flag on; open app.  
   - Unsubscribed user should see paywall where expected (e.g. after onboarding or on protected routes).  
   - Complete a test purchase in sandbox; confirm entitlement and that paywall is dismissed.

4. **Docs**  
   - See `SUBSCRIPTION_SETUP_COMPLETE.md` / `REVENUECAT_QUICK_START.md` for product and entitlement setup.

---

## Re-enable Recipes

1. **Set the flag**  
   In EAS (or `.env`): `EXPO_PUBLIC_ENABLE_RECIPES=true`. No code change required; `_layout.tsx` reads `config.enableRecipes`.

2. **Verify recipe surface**  
   - Recipe tabs/screens are uncommented or gated by `config.enableRecipes` where applicable (e.g. tab bar, nav).  
   - `RecipesContext` and any recipe API keys (e.g. OpenAI, image APIs) are configured.  
   - See `docs/WEAKNESSES_AND_IMPROVEMENTS.md` (§ Recipe surface area) for consolidating recipe services.

3. **Smoke test**  
   - Build with flag on; open app.  
   - Confirm Recipes tab/screen loads, list loads, and at least one recipe detail or generation path works.

4. **Optional**  
   - Add a single “recipe service” facade and document which services are on the hot path (see codebase audit).

---

## Before launch (general)

- [ ] Run `npm audit` and fix high/critical.
- [ ] Confirm Supabase URL config (e.g. redirect URLs) matches production (see `docs/EMAIL_VERIFICATION_SUPABASE_CONFIG.md`).
- [ ] E2E or manual test: sign up → onboard → verify email → open app (see `docs/SIGNUP_FLOW_TEST.md`).
- [ ] If using Sentry: ensure Logger/ErrorBoundary are wired and no PII is sent.

---

## Quick reference

- **Flags live in:** `config.ts` (`enablePaywall`, `enableRecipes`), injected via `app.config.js` `extra`.
- **Layout:** `app/_layout.tsx` uses these to wrap with `SubscriptionProvider`/`SubscriptionGate` and `RecipesProvider` when enabled.
