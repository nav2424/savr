# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
SAVR is a React Native (Expo SDK 54) grocery savings and pantry management mobile app with a Node.js/Express proxy server (`server/`). The cloud-hosted Supabase backend requires no local setup.

### Services
| Service | Port | Command |
|---|---|---|
| **Expo app (web)** | 8081 | `CI=1 npx expo start --web --port 8081` (from repo root) |
| **SAGE proxy server** | 3000 | `node server/index.js` (from repo root) |

### Running tests
- `npm test` — runs all Jest test suites (18 suites, ~281 tests). Use `npm test -- --forceExit` if the process hangs.

### Lint / type-check
- `npx tsc --noEmit` — TypeScript type-checking. The codebase has ~1200 pre-existing type errors; this is expected.

### Key gotchas
- **Web support requires `react-native-web`**: run `npx expo install react-native-web` if it's missing from `node_modules`.
- **Expo `--non-interactive` flag is not supported**: use `CI=1` env var instead for non-interactive mode.
- **Environment variables** (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLOUD_VISION_API_KEY`) must be present in the shell environment. The app reads from `process.env` at startup via `app.config.js`; no `.env` file is needed if secrets are injected.
- **Server `dotenv`**: the proxy server uses `dotenv` but won't override env vars already set in the shell.
- The proxy server will log a warning about missing `GOOGLE_CLOUD_VISION_API_KEY` at startup if the key is not set, but the server still starts and serves AI chat requests.

### Standard commands reference
See `README.md` for full setup/run instructions and `package.json` for available npm scripts (`start`, `dev`, `web`, `test`, etc.).
