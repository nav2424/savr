# Receipt, Barcode & Allergy Scanning Troubleshooting

If scanning fails in your TestFlight/production build but works in dev, check the following.

## 1. Receipt Scanning Failing in Build

Receipt OCR requires the app to reach your **server** (which runs Google Cloud Vision). In a TestFlight build, `localhost` does not work—the device cannot reach your machine.

### Fix: Set Production API URL

1. **Deploy your server** to a publicly reachable URL (e.g. Railway, Render, Fly.io, your own VPS).
2. **Set `EXPO_PUBLIC_API_BASE`** in EAS build secrets to that URL:
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_BASE --value "https://your-server.railway.app" --scope project
   ```
3. **Rebuild** the app—env vars are baked in at build time.

### Server Requirements

- `GOOGLE_CLOUD_VISION_API_KEY` set in server `.env`
- `/api/ocr` endpoint returns `{ text: string }` for POST with `{ imageBase64: string }`
- CORS allows requests from your app (or use same-origin if proxied)

### Dev vs Production

| Environment | API_BASE | Works? |
|-------------|----------|--------|
| Expo Go / dev build on same machine | `http://localhost:3000` | ✅ |
| Dev build on physical device | `http://YOUR_LAN_IP:3000` | ✅ |
| TestFlight / production build | `https://your-server.com` | ✅ (if set) |
| TestFlight without EXPO_PUBLIC_API_BASE | `http://localhost:3000` | ❌ |

---

## 2. Barcode Scanning Failing

Barcode scanning uses:
- **expo-camera** for capture
- **Open Food Facts API** (public, no key) for product lookup
- **Your server** only for receipt OCR, not barcodes

### Common Causes

- **Camera permissions** – Ensure `NSCameraUsageDescription` is in `app.config.js` (already configured).
- **Network** – Barcode lookup hits `world.openfoodfacts.org`. If the device has no internet, lookup fails.
- **expo-camera** – In production builds, ensure you're using a build that includes native camera modules (not Expo Go for real devices).

---

## 3. Allergy Scanning / Detection

Allergy detection runs **after** a successful barcode scan. It uses:
- Open Food Facts product data (ingredients, allergens)
- Your `allergenEngine` for evidence-based detection

If barcode scanning fails, allergy check never runs. Fix barcode first.

---

## 4. Receipt Parsing Quality (Fees, Quantities)

If receipts scan but show wrong items (e.g. fees counted as items, wrong quantities):

- **Fees** – ECOFRAIS, CONSIGNE QC, and similar fees are now excluded from item lists.
- **Quantities** – Costco-style `12 @ 9,99` format is now parsed correctly (quantity 12, unit price 9.99).
- **Comma decimals** – Receipts using `9,99` instead of `9.99` are supported.

These fixes are in `lib/ReceiptOcrParser.ts`.
