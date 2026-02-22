# SAVR: Weaknesses and Improvements

A focused view of what’s still weak in the codebase and what should be strengthened. Complements [CODEBASE_AUDIT.md](./CODEBASE_AUDIT.md).

---

## 1. High priority

### 1.1 Very large files (maintainability and testing)

Six files are 1.8k–3.5k lines and are hard to change, review, and test:

| File | Lines | Risk |
|------|-------|------|
| `app/list-detail.tsx` | ~3,506 | Single screen owns list UI, share, collaborators, items, modals; one bug can break the whole flow. |
| `lib/ScanningService.ts` | ~3,374 | Barcode, receipt OCR, product lookup, and AI in one place; hard to unit-test and reason about. |
| `app/onboarding.tsx` | ~2,374 | All steps and logic in one component; changes to one step risk regressions elsewhere. |
| `components/SageAssistantV2.tsx` | ~2,213 | Chat UI, API calls, voice, and state in one file; hard to test and extend. |
| `app/scan.tsx` | ~1,932 | Camera, receipt flow, and result UI coupled; difficult to test or reuse. |
| `app/(tabs)/index.tsx` | ~1,867 | Dashboard, greeting, budget, and layout in one file. |

**Improvements:**

- **list-detail.tsx:** Extract into: `ListDetailHeader`, `ListDetailItemList`, `ListDetailModals`, and a hook like `useListDetailState(listId)`. Move share/collaborator logic into a hook or small service.
- **ScanningService.ts:** Split by domain: e.g. `BarcodeScanning`, `ReceiptOcr`, `ProductLookup`, and a thin `ScanningService` that coordinates them. Extract pure helpers (parsing, formatting) for unit tests.
- **onboarding.tsx:** One component per step (e.g. `OnboardingStepName`, `OnboardingStepAllergies`) plus a shared `OnboardingLayout` that owns progress and navigation.
- **SageAssistantV2.tsx:** Extract: message list component, input bar component, and a hook (e.g. `useSageChat`) for API/state. Keep the main component as composition only.
- **scan.tsx:** Extract: camera view, receipt flow, result summary. Use hooks for camera permission and scan state.
- **index.tsx (dashboard):** Extract: `DashboardGreeting`, `DashboardBudgetSummary`, and any other distinct sections into components; optional hook for data (e.g. `useDashboardData`).

Do this incrementally (one file or one extraction per PR) to avoid big-bang refactors.

### 1.2 Logging consistency

- **Logger** exists (`lib/Logger.ts`) and is used in ~16 files (AuthContext, ErrorBoundary, ConfigValidator, list-detail, scan, etc.).
- **Raw `console.*`** is used heavily: **~1,146** occurrences across **83** files (e.g. `ScanningService`, `BarcodeService`, `NotificationsService`, recipe services).

**Risks:** Noisy or inconsistent logs in production; harder to filter by level and to plug in Sentry/Bugsnag later.

**Improvements:**

- Standardize on `Logger` for app and lib: use `logger.debug`, `logger.info`, `logger.warn`, `logger.error` instead of `console.*`.
- Reserve `console.*` only for one-off dev debugging or remove; consider an ESLint rule to disallow `console.*` outside tests or a dedicated dev-only module.
- In `Logger.ts`, the production path still uses `console.error`; implement the existing TODO: integrate with Sentry/Bugsnag (or similar) so production errors are reported and optionally attached to user/session.

### 1.3 Disabled features (Paywall, Recipes)

- **Paywall / SubscriptionGate** and **Recipes** are commented out in `app/_layout.tsx` (“PAYWALL TEMPORARILY DISABLED”, “RECIPES TEMPORARILY DISABLED”).
- Re-enabling by uncommenting is error-prone: easy to miss wiring, env vars, or feature flags.

**Improvements:**

- Add a short **LAUNCH_CHECKLIST.md** (or section in existing docs): steps to re-enable Paywall and Recipes, env vars, and a smoke test for each.
- Prefer **feature flags or env-driven toggles** (e.g. `EXPO_PUBLIC_ENABLE_PAYWALL`, `EXPO_PUBLIC_ENABLE_RECIPES`) so the same code path always runs and you toggle behavior via config instead of commenting.

---

## 2. Medium priority

### 2.1 Config and env reading

- **Multiple sources:** `config.ts` uses its own `readEnv` (process.env + Constants.expoConfig/manifest). `ConfigValidator` and `lib/authDeepLink.ts` use `Constants.expoConfig?.extra` directly. `lib/api.ts` uses `(Constants.expoConfig?.extra as any)?.API_BASE`. `RecipeImageService` and others read from `process.env`, `Constants.expoConfig.extra`, and `Constants.manifest.extra`.
- **Risk:** Small behavioral divergence (e.g. redirect URL or API base) between auth, API client, and validators; harder to reason about “single source of truth.”

**Improvements:**

- Prefer a **single config layer**: e.g. `config.ts` (or a dedicated `lib/config.ts`) as the only place that reads env/Constants, and export helpers like `getEmailVerificationRedirectUrl()` that use that layer.
- Have Auth, API client, ConfigValidator, and any service that needs URL/API key use this layer so redirect URL and API base are defined in one place.

### 2.2 Type safety (`any` usage)

- **~347** uses of `: any` or `as any` across **82** files (e.g. notification `data`, list items, Supabase `invoke`, config casts).
- **Risk:** Weaker type checking and hidden bugs when shapes change.

**Improvements:**

- Replace `any` with proper types or generics where possible: e.g. notification payload type, list item type, Supabase function invoke payload/response.
- For Supabase, prefer generated types or shared interfaces for `data` and RPC responses.
- Tackle high-traffic areas first: `_layout.tsx` (e.g. `data.screen as any`), list-detail, ScanningService, and config/Constants.

### 2.3 Error handling in critical paths

- Many `catch` blocks only log (e.g. `console.error`) and do not rethrow or surface a user-facing message. Examples: `NotificationsService` (scheduling, send, push token), `CollaborativeListsService` (getUserLists logs and returns `{ data: null, error }` which is good), but callers are not always checked.
- **useListsUnified:** In the `user` branch, if `useCollaborativeLists()` throws, the catch falls back to local lists and only `console.warn`s. That can hide a real provider/config bug.

**Improvements:**

- In critical user flows (onboarding save, list load, scan, auth): ensure errors are either rethrown, returned as a typed error (e.g. `{ data: null, error }`), or translated into a user-visible message (toast/alert).
- In `useListsUnified`, consider logging with Logger and optionally reporting (e.g. Sentry) when collaborative lists fail, instead of silently falling back; or document that “exactly one of these two hooks runs” and avoid throwing from the hook so the pattern is predictable.

### 2.4 Conditional hooks (`useListsUnified`)

- The hook calls `useCollaborativeLists()` when `user` is set and `useLists()` otherwise. Hook *count* is consistent (always one of the two), so React’s rules are satisfied, but the pattern is fragile: adding another branch or hook can break the rules.
- **Risk:** Future changes could introduce conditional hook calls and cause runtime errors.

**Improvements:**

- **Option A:** Document clearly that “exactly one of these two hooks is called” and add a short comment or test that asserts hook count.
- **Option B (preferred long-term):** Refactor so both hooks are always called (e.g. both `useCollaborativeLists()` and `useLists()`), and the hook’s return value is derived from a selector based on `user` (e.g. `user ? collabResult : localResult`). That makes hook order obvious and stable.

### 2.5 E2E and integration testing

- Unit tests cover: auth deep link, UserPreferencesService, ReceiptOcrParser, allergen detection, Logger, errors, pantry categorization, asyncBatch.
- **Gaps:** No E2E or integration tests for: sign up → onboarding → email verification → open app; list-detail flows; scan flow.

**Improvements:**

- Add a small set of E2E tests (e.g. Detox or Maestro) for: (1) sign up → onboard → verify email → land in app, and (2) one happy path such as “add item to list” or “open list and see items.”
- Consider integration tests for critical services (e.g. AuthContext + Supabase, or list load + collaborative context) with a test Supabase project or mocks.

### 2.6 Production error reporting

- **Logger** has a TODO: “Integrate with Sentry, Bugsnag, or similar” for production. Currently production still logs errors to `console.error`.
- **ErrorBoundary** logs to Logger but does not send to an external service.

**Improvements:**

- Integrate Sentry (or similar) with Logger and/or ErrorBoundary so production errors and unhandled rejections are reported with context (e.g. user id, screen, build).
- Ensure no PII or secrets are sent; use env/build-time config to enable/disable reporting.

---

## 3. Lower priority

### 3.1 SQL and scripts in repo root

- SQL files (e.g. `add-preferences-column.sql`, `fix-*.sql`) and test scripts (`test-*.js`) live in the project root.
- **Improvement:** Move SQL to `docs/sql/` or `supabase/migrations/`, and one-off/test scripts to `scripts/` or remove if obsolete. Keeps the root focused on app and config.

### 3.2 Recipe surface area

- Many recipe-related services (AIRecipeGenerator, DynamicRecipeAIService, IntelligentRecipeService, RecipeFeedService, etc.); some are behind “RECIPES DISABLED.”
- **Improvement:** When re-enabling recipes, map which services are on the hot path and which are legacy; consider a single “recipe service” facade to reduce dead code and clarify entry points.

### 3.3 Duplicate provider trees in `_layout.tsx`

- `ProvidersWrapper` has two near-identical trees (authenticated vs unauthenticated) that only differ by `CollaborativeListsProvider` vs `ListsProvider`. The rest (Toast, Pantry, Receipts, commented Recipes) is duplicated.
- **Improvement:** Factor a shared inner tree (e.g. `<ToastProvider><PantryProvider><ReceiptsProvider>{children}</ReceiptsProvider></PantryProvider></ToastProvider>`) and wrap it with either `CollaborativeListsProvider` or `ListsProvider` based on `user`. Reduces duplication and mistakes when adding/removing providers.

---

## 4. Summary table

| Area | Weakness | Action |
|------|----------|--------|
| **Large files** | 6 files 1.8k–3.5k lines; hard to maintain and test | Split incrementally into components/hooks/services |
| **Logging** | ~1,146 `console.*` vs ~153 Logger usages | Standardize on Logger; add ESLint; wire production to Sentry |
| **Disabled features** | Paywall/Recipes commented out; re-enable is ad hoc | LAUNCH_CHECKLIST.md + feature flags or env toggles |
| **Config** | Multiple read paths (config.ts, Constants, process.env) | Single config layer; redirect URL and API base from it |
| **Types** | ~347 `any` usages across 82 files | Replace with proper types in high-traffic code first |
| **Errors** | Many catch blocks only log; some flows don’t surface errors | Return/surface errors in critical paths; consider reporting |
| **useListsUnified** | Conditional hooks; easy to break | Document or refactor to always call both hooks and select |
| **E2E** | No E2E for sign-up or list/scan flows | Add Detox/Maestro for sign-up + one list/scan path |
| **Production errors** | Logger/ErrorBoundary not connected to Sentry | Integrate Sentry (or similar) for production |
| **Repo hygiene** | SQL/test scripts in root | Move to docs/sql, scripts/, or supabase/migrations |
| **Recipe code** | Many recipe services; unclear entry points | When re-enabling, consolidate behind a facade |
| **Provider tree** | Duplicated layout in _layout.tsx | Extract shared inner tree; switch only list provider |

Focusing on **large files**, **logging**, and **disabled-feature process** will give the biggest maintainability and launch safety gains; then **config**, **types**, and **error handling** for robustness and clarity.
