# SAVR Codebase Audit

High-level assessment of structure, patterns, and recommendations (as of this audit).

---

## 1. What’s Working Well

### Structure
- **Clear separation:** `app/` (screens, file-based routing), `lib/` (services, context, utils), `components/`, `config/`, `design-system/`.
- **Expo Router** for navigation; **Supabase** as backend with typed client and shared DB types in `lib/supabase.ts`.
- **Central config** in `config.ts` (env via `readEnv`), plus **ConfigValidator** for required vars on startup.

### Auth & Critical Paths
- **Auth flow** is coherent: AuthContext, `authDeepLink` (redirect URL + session-from-URL), pending onboarding stash, apply-on-sign-in.
- **Single canonical redirect** (`getEmailVerificationRedirectUrl()`) used for sign-up and resend; session-from-URL so “tap link → open app → signed in” works when redirect is `savr://email-verification`.

### Reliability & Observability
- **Typed errors** in `lib/errors.ts` (AppError, ValidationError, APIError, DatabaseError, etc.) and **Logger** with levels; **ErrorBoundary** at root.
- **Tests** for important logic: auth deep link, UserPreferencesService, ReceiptOcrParser, allergen detection, Logger, etc.

### UI & Design
- **Design system** (DesignSystem.ts, PremiumComponents, LiquidGlassCard) and **SimpleThemeContext** for theming.
- **ToastContext** for non-blocking feedback; **ToastHost** for display.

### State & Data
- **Contexts** are scoped (Auth, Pantry, Lists, CollaborativeLists, Receipts, etc.); **useListsUnified** abstracts auth vs local lists.
- **Real-time** where it matters (e.g. collaborative lists subscriptions, dashboard preferences).

---

## 2. Concerns & Risks

### Very Large Files
Several files are 1.5k–3.5k+ lines and will be hard to maintain and test:

| File | Lines | Suggestion |
|------|-------|------------|
| `app/list-detail.tsx` | ~3,500 | Split into subcomponents (list header, item list, modals) and custom hooks (list state, share, collaborators). |
| `lib/ScanningService.ts` | ~3,400 | Split by domain (barcode, receipt OCR, product lookup) or extract helpers. |
| `app/onboarding.tsx` | ~2,400 | One component per step + shared layout; step content in separate files. |
| `components/SageAssistantV2.tsx` | ~2,200 | Extract panels, message list, input bar, and API/state into hooks. |
| `app/scan.tsx` | ~1,900 | Separate camera view, receipt flow, and result UI into components/hooks. |
| `app/(tabs)/index.tsx` | ~1,900 | Extract dashboard sections and greeting/budget logic into components and hooks. |

Refactors can be incremental (e.g. extract one section at a time).

### Logging Consistency
- **Logger** exists and is used in places (AuthContext, ErrorBoundary, ConfigValidator, etc.).
- **Raw `console.*`** is still heavy: ~90 in `app/`, ~930 in `lib/` (e.g. ScanningService, RecipeImageService, BarcodeService).
- **Risk:** Noisy or inconsistent logs in production; harder to filter and monitor.
- **Recommendation:** Use Logger (e.g. `logger.debug`, `logger.info`, `logger.error`) for app and lib; reserve `console.*` for one-off dev or remove. Optionally add a small ESLint rule to discourage `console.*` outside tests.

### Conditional Hook Usage
- **useListsUnified** calls `useCollaborativeLists()` when `user` is set and `useLists()` otherwise. Hook *count* is consistent (always one of the two), so React’s rules are satisfied, but the pattern is easy to break if someone adds another branch or hook.
- **Recommendation:** Either document that “exactly one of these two hooks runs” or refactor to always call both hooks and pick the right result (e.g. with a selector) so hook order is obvious.

### Temporarily Disabled Features
- **Paywall / SubscriptionGate** and **Recipes** are commented out in `_layout.tsx` and elsewhere (“RECIPES TEMPORARILY DISABLED”, “PAYWALL TEMPORARILY DISABLED”).
- **Risk:** Re-enabling at launch without a checklist can miss wiring or config.
- **Recommendation:** Keep a short **LAUNCH_CHECKLIST.md** (re-enable Paywall, Recipes, run E2E, etc.). Prefer feature flags or env-driven toggles over commenting so the same code path is always used.

### Duplication
- **Config reading** appears in `config.ts`, `ConfigValidator`, and `authDeepLink` (Constants.expoConfig.extra). Small divergence is possible.
- **Recommendation:** Prefer a single `readEnv` / config layer and have Auth and others use it (e.g. redirect URL from config or a shared `getEmailVerificationRedirectUrl()` that uses config).

### SQL and Scripts in Repo
- **SQL** (e.g. `add-preferences-column.sql`, `fix-*.sql`) and **test scripts** (`test-*.js`) live in project root alongside app code.
- **Recommendation:** Move SQL to `docs/sql/` or `supabase/migrations/`; move one-off test scripts to `scripts/` or delete if obsolete. Reduces noise and keeps app root focused.

### Recipe / AI Surface Area
- Many **recipe-related services** (AIRecipeGenerator, DynamicRecipeAIService, IntelligentRecipeService, RecipeFeedService, etc.); some are behind “RECIPES DISABLED”.
- **Recommendation:** When re-enabling recipes, map which services are on the hot path and which are legacy or optional; consider a single “recipe service” facade to avoid dead code and unclear entry points.

---

## 3. Security & Config

- **Supabase** uses anon key + RLS; client is created lazily from `config`; no hardcoded secrets in the sampled files.
- **ConfigValidator** ensures required env (Supabase URL/anon key) before app runs.
- **Recommendation:** Keep API keys and secrets in env / EAS secrets; avoid committing `.env` (use `.env.example` or `ENV_TEMPLATE` only).

---

## 4. Testing

- **Unit tests** cover: auth deep link, UserPreferencesService, ReceiptOcrParser, allergen detection, Logger, errors, pantry categorization, asyncBatch.
- **Gaps:** No E2E or integration tests for “sign up → onboard → verify email → open app”; no tests for list-detail or scan flows.
- **Recommendation:** Keep adding unit tests for new services and critical helpers; add a small set of E2E tests (e.g. Detox or Maestro) for sign-up and one happy path (e.g. add item to list).

---

## 5. Dependencies

- **Expo SDK 54**, React 19, React Native 0.81; **Supabase** JS client; **RevenueCat** (subscriptions).
- **Recommendation:** Run `npm audit` and fix high/critical; lock key dependencies to minor/patch where stability matters.

---

## 6. Summary

| Area | Verdict | Priority |
|------|--------|----------|
| Structure & routing | Solid | — |
| Auth & sign-up flow | Coherent; redirect and session-from-URL in good shape | — |
| Config & errors | Good (config, validator, typed errors, Logger) | — |
| Large files | Hard to maintain | High (incremental split) |
| Logging | Logger underused; lots of console.* | Medium |
| Disabled features | Need clear re-enable path | Medium (checklist / flags) |
| Hooks (useListsUnified) | Correct but fragile pattern | Low (document or refactor) |
| SQL / scripts in root | Noisy | Low (move/cleanup) |
| Tests | Good unit coverage; no E2E | Medium (add E2E for critical path) |

Overall the app is in good shape for a pre-launch codebase: auth and sign-up flow are in place, config and errors are structured, and test coverage exists for important logic. The main improvements are splitting the largest screens/services, standardizing on Logger, and clarifying how to re-enable and test Paywall and Recipes at launch.
