# App Store Review Reply Template

**Use this to reply in App Store Connect → Resolution Center**

---

## Guideline 2.1(a) – March 2026: “View Plans” + verification email

**Submission ID (example):** `50470f93-2832-4bc0-9231-5061c3871647`

### View Plans / subscription UI

We addressed cases where the subscription flow could appear unresponsive:

- Ensured RevenueCat initializes before loading offerings; **25s timeout** on offerings fetch so the UI does not wait indefinitely on poor networks.
- **Loading indicators** on “View Plans” and “Change plan” while the store sheet is preparing.
- **Alerts** if the paywall cannot be presented or loading fails, with actionable copy.
- Corrected entitlement identifier to **`pro`** (must match RevenueCat exactly) so purchases unlock reliably after review testing.

Please test **View Plans** on a **production/TestFlight build** with a valid network; the reviewer device must use a **Sandbox** Apple ID for purchases (Settings → App Store → Sandbox Account).

### Verification email

Verification messages are sent by **Supabase Auth**. If no email arrives:

1. Configure **SMTP** (or a supported auth email provider) in the Supabase project so signup confirmation can be delivered.
2. Ask reviewers to check **Spam/Junk** and use **Resend verification** on the in-app email verification screen.

The app now shows a **blocking alert** after sign-up explaining inbox/spam and resend, so the expected flow is explicit.

---

## Summary of Fixes (earlier template)

| Issue | Status | Action |
|-------|--------|--------|
| **3.1.2** Terms of Use (EULA) link | Metadata | Add link in App Store Connect |
| **5.1.1** Camera permission button | Fixed in code | Changed "Grant Permission" → "Continue" |
| **5.1.1(v)** Account deletion | Already implemented | Reply with location below |
| **2.1** In-App Purchases not found | Code + Reply | Added Subscription to More tab; provide steps |

---

## 1. Guideline 3.1.2 – Terms of Use (EULA)

**Action in App Store Connect:**
1. Go to **App Store Connect → Your App → App Information**
2. Add a functional **Terms of Use** link:
   - If using Apple's standard EULA: Add the link in the **App Description** field
   - If using custom EULA: Add it in **App Store Connect → Agreements, Tax, and Banking → EULA**

**Suggested App Description addition** (append to existing description):
```
Terms of Use: [your-terms-url]
Privacy Policy: [your-privacy-url]
```

---

## 2. Guideline 5.1.1 – Camera Permission Button

**Status:** Fixed in this release.

The camera permission pre-prompt button text has been changed from "Grant Permission" to "Continue" to align with Apple's guidance.

**Location:** Appears when the user first accesses the Scan feature (Scan tab or scan flow) and camera access has not yet been granted.

---

## 3. Guideline 5.1.1(v) – Account Deletion

**Status:** Already implemented.

**Where to find account deletion:**
1. Tap the **More** tab (rightmost tab)
2. Tap **Profile & Settings**
3. Scroll to the bottom to the **Account** section
4. Tap **Delete Account** (red button)
5. Confirm in the dialog

The account is permanently deleted; no customer service contact is required.

---

## 4. Guideline 2.1 – In-App Purchases (SAVR Monthly)

**Status:** Added "Subscription" to the More tab so reviewers can locate in-app purchases.

**Steps to locate SAVR Monthly and other subscription options:**

1. Open the app and sign in (or create a new account)
2. Tap the **More** tab (rightmost tab in the bottom navigation)
3. Tap **Subscription** (first item in the Settings list when paywall is enabled)
4. On the Subscription screen:
   - If not subscribed: Tap **Upgrade** to view SAVR Monthly and SAVR Annual subscription options
   - If subscribed: Subscription details (Monthly/Annual) are shown with management options

**Alternative path for new users:**
- New users (account created within the last 5 minutes) will see the paywall automatically after onboarding, which displays SAVR Monthly and SAVR Annual plans with a 3-day free trial.

**Sandbox testing:** In-app purchases are configured for the Apple Sandbox. Ensure the reviewer is signed into a Sandbox tester account under Settings → App Store → Sandbox Account.

---

## Suggested Reply (Copy to App Store Connect)

```
Thank you for your review feedback. We have addressed the issues as follows:

**Guideline 3.1.2 – Terms of Use (EULA):**
We have added a functional link to our Terms of Use in the App Description [or: in the EULA field in App Store Connect]. The Privacy Policy link is already in the Privacy Policy field.

**Guideline 5.1.1 – Camera Permission:**
We have updated the camera permission flow. The pre-prompt button now says "Continue" instead of "Grant Permission," in line with Apple's guidance. This appears when accessing the Scan feature (Scan tab) for the first time.

**Guideline 5.1.1(v) – Account Deletion:**
Account deletion is available in the app. To locate it:
1. Tap the More tab (rightmost tab)
2. Tap Profile & Settings
3. Scroll to the bottom to the Account section
4. Tap Delete Account (red button) and confirm

The account is permanently deleted with no customer service contact required.

**Guideline 2.1 – In-App Purchases:**
To locate SAVR Monthly and subscription options:
1. Tap the More tab (rightmost tab)
2. Tap Subscription (first item in the list)
3. Tap Upgrade to view SAVR Monthly and SAVR Annual subscription options

New users also see the paywall automatically after sign-up. In-app purchases are configured for the Apple Sandbox environment.

We have submitted an updated build with the camera permission and Subscription menu updates. Please let us know if you need any additional information.
```

---

## Pre-Submission Checklist

- [ ] Add Terms of Use link to App Store Connect (App Description or EULA field)
- [ ] Ensure EXPO_PUBLIC_ENABLE_PAYWALL=true for production/TestFlight build
- [ ] Build and upload new version with camera + Subscription changes
- [ ] Verify Paid Apps Agreement is accepted (App Store Connect → Agreements)
- [ ] Verify Sandbox testers can access subscriptions
