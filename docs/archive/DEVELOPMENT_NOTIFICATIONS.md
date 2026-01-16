# Push Notifications Development Guide

## Current Status
Your app is configured for push notifications, but they won't work in Expo Go due to SDK 53+ limitations. The app has been updated to handle this gracefully without errors.

## Quick Fix for Development

### Option 1: Use Development Build (Recommended)
1. Install EAS CLI:
   ```bash
   npm install -g @expo/eas-cli
   ```

2. Initialize EAS project:
   ```bash
   npx eas init
   ```

3. Create development build:
   ```bash
   npx eas build --profile development --platform ios
   # or for Android:
   npx eas build --profile development --platform android
   ```

4. Install the development build on your device instead of using Expo Go.

### Option 2: Disable Notifications for Development
If you want to continue using Expo Go for now, the app will work fine without push notifications. The notification code has been updated to gracefully handle the missing projectId.

### Option 3: Mock Notifications
The app already has local notification scheduling that works without push tokens - these will still work for expiry reminders.

## Configuration Files Updated

- `app.config.js`: Added expo-notifications plugin (removed invalid projectId placeholder)
- `app/(tabs)/index.tsx`: Added comprehensive error handling for missing/invalid projectId
- `components/OnboardingFlow.tsx`: Fixed SafeAreaView deprecation warning

## Next Steps

1. **For immediate development**: The app will work fine in Expo Go without push notifications
2. **For production**: Set up EAS project and use development builds
3. **Update projectId**: Replace "your-project-id-here" in app.config.js with your actual EAS project ID

## Testing Local Notifications

Local notifications (for expiry reminders) should still work in Expo Go. Test by:
1. Adding items with expiry dates to your pantry
2. Setting dates to expire soon
3. Checking if local notifications appear

