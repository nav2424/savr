# Starting the OCR Server

## Quick Start

The OCR server must be running for receipt scanning to work. Follow these steps:

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Set Environment Variables

Create `server/.env` file:

```bash
# Required for Google Cloud Vision OCR
GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here

# Optional: Server port (defaults to 3000)
PORT=3000
```

### 3. Start the Server

```bash
cd server
npm start
```

You should see:
```
SAGE proxy running on http://localhost:3000
```

### 4. Verify Server is Running

The server should be accessible at:
- `http://localhost:3000` (for Android emulator / simulator)
- `http://192.168.x.x:3000` (for iOS simulator or **dev build on physical device**—use your machine’s LAN IP)

**Dev build on a physical device:** Receipt scanning uses OCR (fast) when it can reach the server. If the app only tries `localhost`, it will fall back to the LLM (slower). To keep OCR fast, set in your app `.env`:  
`EXPO_PUBLIC_API_BASE=http://YOUR_LAN_IP:3000` (e.g. `http://192.168.1.100:3000`). The app also tries the Metro host from `linkingUri` when you open it from Expo dev tools.

### 5. Test OCR Endpoint

```bash
# Test with curl (replace with actual base64)
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "base64_string_here"}'
```

## Troubleshooting

### "Network request failed" Error

**Cause:** Server is not running or not accessible

**Solution:**
1. Check if server is running: `lsof -ti:3000`
2. Start the server: `cd server && npm start`
3. For iOS simulator, ensure you're using LAN IP (not localhost)
4. Check firewall settings

### "Cannot find native module 'ExpoImageManipulator'"

**Cause:** `expo-image-manipulator` requires a dev client build, not available in Expo Go

**Solution:**
- This is expected in Expo Go - preprocessing is skipped automatically
- OCR will still work with original images
- For preprocessing, build a dev client: `npx expo prebuild` and `npx expo run:ios`

### Server Not Accessible from iOS Simulator

**Solution:**
1. Find your Mac's LAN IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Use that IP in the app (e.g., `http://192.168.1.100:3000`)
3. Or set `EXPO_PUBLIC_API_BASE=http://192.168.1.100:3000` in your `.env`

## Notes

- The server falls back to Tesseract.js if Google Vision is not configured
- OCR works without preprocessing (preprocessing is optional)
- Server must be running for OCR to work (otherwise falls back to LLM-only mode)
- Receipt images from camera or library use `file://` or `content://` URIs; the app converts them to base64 via `expo-file-system` before sending to the server (avoids `fetch(file://)` issues on React Native)