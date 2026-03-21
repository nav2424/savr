# RevenueCat Paywall Troubleshooting

If the paywall isn't connecting or showing correctly, verify each step below.

## 1. RevenueCat Dashboard

- [ ] **Project** → **Apps** → iOS app added with bundle ID `com.arnavsaluja.savr`
- [ ] **Project** → **API Keys** → Using the correct iOS key (starts with `appl_`)
- [ ] **Products** → Products created and linked to your App Store Connect in-app purchases
- [ ] **Entitlements** → Entitlement `pro` exists and is linked to your products
- [ ] **Offerings** → At least one offering (e.g. `default`) with packages (`$rc_monthly`, `$rc_annual`)
- [ ] **Offerings** → One offering is set as **Current Offering**
- [ ] **Paywalls** (Paywalls V2) → A paywall is created and **attached to your offering**

## 2. App Store Connect

- [ ] In-app purchases (subscriptions) created and **Approved**
- [ ] Bundle ID matches: `com.arnavsaluja.savr`
- [ ] Paid Applications agreement signed
- [ ] Bank/tax info complete

## 3. RevenueCat ↔ App Store Connect

- [ ] **RevenueCat** → Project Settings → App Store Connect API key or Shared Secret configured (for server-side receipt validation)

## 4. EAS Build (`EXPO_PUBLIC_*` in bundle)

`EXPO_PUBLIC_*` values are **baked into the client** at build time. They are **not** suitable as “hidden” EAS Secrets if they never reach the Metro bundle—use **`eas.json` → `build.production.env`** and/or **`envFile`** (see `docs/EAS_EXPO_PUBLIC_ENV.md`).

- [ ] `EXPO_PUBLIC_RC_IOS_API_KEY` = your iOS **public** key (`appl_…`) — safe to put in `eas.json` or `.env.production` (same as shipping in the IPA)
- [ ] `EXPO_PUBLIC_ENABLE_PAYWALL` = `"true"` (already set for `production` in `eas.json` in this repo)
- [ ] `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` = your offering ID (e.g. `"default"`) — must match the identifier in RevenueCat

## 5. Offering ID

If your offering in RevenueCat is named something other than `default` (e.g. `sale1`, `premium`), set it in `eas.json`:

```json
"EXPO_PUBLIC_REVENUECAT_OFFERING_ID": "your_offering_id"
```

## 6. Paywalls V2 (Hosted Paywall)

The app uses `RevenueCatUI.presentPaywall()`. For your custom design to show:

- [ ] In RevenueCat → **Paywalls** → Create a paywall
- [ ] Attach it to your offering
- [ ] If no paywall is attached, RevenueCat shows a default fallback paywall

## 7. TestFlight / Sandbox

- [ ] Use a **Sandbox** Apple ID for testing (Settings → App Store → Sandbox Account)
- [ ] Builds must be fresh (env vars are baked in at build time)
