# EAS builds and `EXPO_PUBLIC_*` variables

Variables prefixed with **`EXPO_PUBLIC_`** are inlined into the JavaScript bundle at build time. They are **not** secrets—anyone can read them from the app binary (same as the RevenueCat iOS **public** API key, which is meant to ship in the client).

## Do not rely on EAS Secrets alone for `EXPO_PUBLIC_*`

[EAS environment variables / secrets](https://docs.expo.dev/build-reference/variables/) are appropriate for values that must **not** appear in the client. For anything that must be **in the bundle**, you need that value present when Metro bundles the app—typically via **`eas.json`** `build.<profile>.env` or an **`envFile`** referenced there.

## Recommended approaches

### 1. Inline in `eas.json` (simplest for production iOS)

In `eas.json`, under `build.production.env`, set:

```json
"EXPO_PUBLIC_ENABLE_PAYWALL": "true",
"EXPO_PUBLIC_RC_IOS_API_KEY": "appl_xxxxxxxx"
```

The RevenueCat **`appl_`** key is a **public** SDK key. Treat it like a bundle ID dependency, not a password.

Replace the empty `EXPO_PUBLIC_RC_IOS_API_KEY` value in this repo’s `eas.json` before shipping to the App Store, **or** use option 2 so the committed `eas.json` stays without the key.

### 2. Optional: `envFile` in `eas.json`

You can add `"envFile": ".env.production"` under `build.production` and copy `.env.production.example` → `.env.production`. **Do not commit this line** unless every build machine (including EAS cloud) has that file: **gitignored files are not uploaded**, so a missing `.env.production` on EAS can fail the build.

- **EAS cloud:** Prefer putting `EXPO_PUBLIC_RC_IOS_API_KEY` in `eas.json` `env`, or commit a filled `.env.production` in a **private** repo only.
- **Precedence:** Variables in `eas.json`’s `env` object override the same names from `envFile` when both are set.

## Do not gitignore `eas.json`

Expo projects should **commit** `eas.json`. Ignoring it breaks normal EAS workflows for teammates and CI. If you want keys off GitHub, keep **`EXPO_PUBLIC_RC_IOS_API_KEY` in gitignored `.env.production`** and do not put the real value in `eas.json` on the remote—use a private build pipeline that injects `env` at build time, or commit `.env.production` only in a private repo.

## See also

- `docs/PAYWALL_TROUBLESHOOTING.md`
- `ENV_TEMPLATE.txt`
