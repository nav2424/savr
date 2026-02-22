# RevenueCat Integration – SAVR (React Native / Expo)

SAVR uses **React Native** with Expo, so RevenueCat is integrated via:

- **`react-native-purchases`** – SDK (purchases, customer info, offerings)
- **`react-native-purchases-ui`** – Paywall & Customer Center UI

There is **no Swift Package / SwiftUI** in this repo; the app is a single React Native codebase.

---

## 1. Installation (already done)

Dependencies in `package.json`:

- `react-native-purchases` (^9.5.4)
- `react-native-purchases-ui` (^9.5.4)

iOS uses CocoaPods (RevenueCat pulled in via the RN packages). No separate Swift Package add is required.

---

## 2. API key

Configured in **`config/revenuecat.ts`** (and overridable via env):

- **iOS**: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` or default `test_LMWkxBArtYIIIMzvukgpKQFWBEn`
- **Android**: `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- **Web (Expo Go)**: `EXPO_PUBLIC_REVENUECAT_WEB_API_KEY` (optional, for testing in Expo Go)

For production, use the **Public API keys** from RevenueCat Dashboard → Project → API Keys (iOS `appl_`, Android `goog_`, Web `rcb_`).

---

## 3. Entitlement: **Pro**

- Entitlement identifier in code and dashboard: **`Pro`**
- Defined in `config/revenuecat.ts` as `ENTITLEMENT_PRO` and used everywhere for access checks.

---

## 4. Products

| Product ID                 | Type   | Use in app        |
|----------------------------|--------|-------------------|
| `subscription_monthly_1`   | Monthly subscription | Monthly plan |
| `annual_subscription_1`    | Annual subscription  | Annual plan  |

These must exist in **App Store Connect** (iOS) and **Google Play Console** (Android) and be linked in RevenueCat.

---

## 5. RevenueCat Dashboard setup

### 5.1 App and API keys

1. Create / select project at [app.revenuecat.com](https://app.revenuecat.com).
2. Add your iOS and Android apps (bundle ID / package name).
3. Under **API Keys**, copy:
   - **Public iOS** (`appl_...`) → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` or `config/revenuecat.ts`
   - **Public Android** (`goog_...`) → `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - **Public Web** (`rcb_...`) → optional, for Expo Go

### 5.2 Entitlements

1. **Products** (or **Entitlements**) → create entitlement:
   - Identifier: **`Pro`**
   - Attach products: `subscription_monthly_1`, `annual_subscription_1`

### 5.3 Offerings

1. **Offerings** → create or edit **Default** offering.
2. Add packages:
   - **Monthly**: product `subscription_monthly_1`, package identifier e.g. `$rc_monthly`
   - **Annual**: product `annual_subscription_1`, package identifier e.g. `$rc_annual`
3. Set this offering as **Current**.

### 5.4 Paywalls (optional)

- **Paywalls** → create paywall and attach to Default offering if you use RevenueCat’s hosted paywall UI (`presentPaywall` / `Paywall` component).
- You can still use SAVR’s custom paywall screen; “Show RevenueCat Paywall” uses the RevenueCat-designed paywall when in a dev/production build.

### 5.5 Customer Center

- **Customer Center** → enable and configure (e.g. “Manage subscription”, “Restore”, support link).
- SAVR calls `presentCustomerCenter()` from the Subscription Management screen; the sheet is provided by RevenueCat when the native module is available (not in Expo Go).

---

## 6. Subscription logic in the app

### 6.1 Initialization and Pro check

- **`lib/SubscriptionContext.tsx`**:
  - Configures Purchases with the correct API key (iOS / Android / Web).
  - Fetches offerings and customer info.
  - Subscribes to **customer info updates** (`Purchases.addCustomerInfoUpdateListener`) so renewals/cancellations/restores are reflected without restarting the app.
  - **Pro** access: `info.entitlements.active['Pro']` (see `hasProEntitlement` and `ENTITLEMENT_PRO`).

### 6.2 Presenting the paywall

- **Custom paywall screen** (`app/paywall.tsx`): lists packages from `currentOffering`, supports monthly/annual, restore, and “Show RevenueCat Paywall”.
- **RevenueCat native paywall**:
  - `presentPaywall({ offering?, displayCloseButton?, fontFamily? })` – always shows paywall.
  - `presentPaywallIfNeeded()` – shows paywall only if the user does **not** have the **Pro** entitlement (required entitlement identifier: `Pro`).

Usage from context:

```ts
const { presentPaywall, presentPaywallIfNeeded } = useSubscription();

// Show paywall every time
const result = await presentPaywall({ displayCloseButton: true });

// Show only if user doesn’t have Pro
const result = await presentPaywallIfNeeded();
if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
  // grant access
}
```

`PAYWALL_RESULT`: `NOT_PRESENTED`, `ERROR`, `CANCELLED`, `PURCHASED`, `RESTORED`.

### 6.3 Customer Center

- **Subscription Management** screen calls `presentCustomerCenter({ callbacks })` for “Manage Subscription”.
- If the native module isn’t available (e.g. Expo Go), the app falls back to opening the store subscription URL (Apple / Google).

```ts
const { presentCustomerCenter, restorePurchases } = useSubscription();
await presentCustomerCenter({
  callbacks: {
    onRestoreCompleted: async () => await restorePurchases(),
  },
});
```

### 6.4 Customer info and purchases

- **Customer info**: `useSubscription().customerInfo` (and updates via listener).
- **Active Pro**: `customerInfo?.entitlements.active['Pro']` (expiration, product identifier, etc.).
- **Purchase**: `purchasePackage(pkg)` from context.
- **Restore**: `restorePurchases()` from context; after restore, customer info updates and `isSubscribed` is set from Pro entitlement.

---

## 7. Error handling

- **Configure**: invalid API key or network → log and set `isLoading = false`; app continues without subscription.
- **Purchase**: `userCancelled` → return `{ success: false, error: 'Purchase cancelled' }`; other errors → return message from SDK.
- **Restore**: no active subscription → `{ success: false, error: 'No active subscription found' }`; SDK errors → return message.
- **Present paywall / Customer Center**: in Expo Go or when native UI isn’t available, methods no-op or return `NOT_PRESENTED` and errors are caught and logged so the app doesn’t crash.

---

## 8. Best practices

- Use **one** entitlement (**Pro**) for all premium features; check `isSubscribed` or `customerInfo.entitlements.active['Pro']`.
- Rely on **customer info listener** for status changes; avoid one-off checks only at launch.
- Use **`presentPaywallIfNeeded`** when gating a feature (show paywall only if Pro is missing).
- Use **`presentCustomerCenter`** for manage/restore/support so users get the correct store experience.
- Don’t commit real production API keys; use env (e.g. EAS Secrets) and defaults only for test keys.

---

## 9. Product configuration summary

| Where              | What to set |
|--------------------|------------|
| App Store Connect  | In-App Purchase: subscription, IDs `subscription_monthly_1`, `annual_subscription_1` |
| Play Console      | Subscription products with same IDs |
| RevenueCat         | Entitlement **Pro**; products linked to apps; Default offering with monthly + annual packages |
| SAVR `config`     | `ENTITLEMENT_PRO = 'Pro'`, `SUBSCRIPTION_PRODUCTS.monthly` / `.annual` (for reference) |

---

## 10. References

- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [RevenueCat Expo](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [Displaying Paywalls](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls)
- [Customer Center](https://www.revenuecat.com/docs/tools/customer-center)
- [Sandbox testing](https://www.revenuecat.com/docs/test-and-launch/sandbox)
