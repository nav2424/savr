# AGENTS.md

## Cursor Cloud specific instructions

### Overview

SAVR is a React Native + Expo (SDK 54) mobile app for smart grocery/recipe management. It has two npm projects:

- **Root** (`/workspace`) — Expo/React Native app (`savr-mobile`)
- **`server/`** — Express.js proxy server for OCR and LLM proxying (`savr-proxy-server`)

Backend is cloud-hosted Supabase (no local DB needed). The `.npmrc` sets `legacy-peer-deps=true`.

### Running the app

- **Web mode** (for Cloud VM without iOS/Android simulator): `npx expo start --web --port 8081`
- **Proxy server**: `cd server && node index.js` (runs on port 3000)
- Web mode requires `react-native-web`, `react-dom`, and `@expo/metro-runtime` — install via `npx expo install react-native-web react-dom @expo/metro-runtime` if missing.

### Tests

- `npm test` runs Jest with `jest-expo` preset (18 suites, ~281 tests)
- No ESLint or lint script is configured in this project.

### Environment variables

See `ENV_TEMPLATE.txt` for the full list. Key variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The app reads `.env` from root and `server/.env` via `app.config.js`. Without Supabase credentials the app still loads (welcome/onboarding screens work), but authentication and data features require valid Supabase keys.

### Gotchas

- The Expo web dev server first bundle takes ~11s; subsequent reloads are fast.
- The proxy server logs a warning if `GOOGLE_CLOUD_VISION_API_KEY` is not set, but still starts (OCR will fail; other endpoints work).
- Account creation through the onboarding flow requires Supabase email verification before accessing main app tabs. In development, you can disable email confirmation in Supabase Dashboard > Auth > Providers > Email.
