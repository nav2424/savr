# SAGE Voice Assistant - Troubleshooting

## Network Request Failed Error

If you're seeing `Network request failed` errors when using SAGE, this is because **OpenAI API calls don't work directly in Expo Go** due to network restrictions.

### Solutions:

#### Option 1: Create a Development Build (Recommended)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create a development build
eas build --profile development --platform ios

# Or for Android
eas build --profile development --platform android
```

Then install the development build on your device and SAGE will work perfectly!

#### Option 2: Use a Backend Proxy (For Production)
Create a simple backend server that proxies OpenAI API calls:

```javascript
// backend/server.js
const express = require('express');
const app = express();

app.post('/api/chat', async (req, res) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.json();
  res.json(data);
});

app.listen(3000);
```

Then update `lib/openai.ts` to call your backend instead.

#### Option 3: Test with Mock Responses (For UI Development)
If you just want to test the UI, you can temporarily mock the API responses in `lib/openai.ts`.

### Why This Happens

Expo Go is a sandbox environment that restricts certain network calls for security. OpenAI's API requires:
- CORS headers
- Direct HTTPS connections
- Audio file uploads (multipart/form-data)

These work fine in:
✅ Development builds
✅ Production builds
✅ Backend proxies

But not in:
❌ Expo Go

### Current Status

- ✅ UI works perfectly
- ✅ Voice recording works
- ✅ Audio playback works
- ❌ OpenAI API calls fail in Expo Go
- ✅ Will work in development/production builds

### Quick Fix for Testing

Add this to `.env`:
```
EXPO_PUBLIC_OPENAI_API_KEY=your-key-here
```

Then run:
```bash
eas build --profile development --platform ios
```

Install the build and SAGE will be fully functional! 🚀

