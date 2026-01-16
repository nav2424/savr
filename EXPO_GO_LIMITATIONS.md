# Expo Go Limitations & How to Fix

## ⚠️ Current Error

```
ERROR [Invariant Violation: Your JavaScript code tried to access a native module that doesn't exist.
If you're trying to use a module that is not supported in Expo Go, you need to create a development build of your app.
```

## 🔍 What's Happening

The error is caused by **PushNotificationIOS** which is a native iOS module that:
- ❌ Not supported in Expo Go
- ✅ Works in development builds
- ✅ Works in production builds

This is a **known Expo Go limitation**, not a bug in your app.

## ✅ Solution: Create a Development Build

### Option 1: EAS Build (Recommended)

**Already configured in your `eas.json`!**

```bash
# Install EAS CLI globally (if not already installed)
npm install -g eas-cli

# Login to your Expo account
eas login

# Build for iOS simulator (free, fast)
eas build --profile development --platform ios

# Or build for iOS device
eas build --profile development:device --platform ios

# Or build for Android
eas build --profile development --platform android
```

**After build completes:**
1. Download the build file
2. Install on your device/simulator
3. Run: `npx expo start --dev-client`
4. App will work with ALL features!

### Option 2: Local Development Build

```bash
# Install expo-dev-client
npx expo install expo-dev-client

# iOS (requires Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android
```

## 📱 What Works in Expo Go vs Dev Build

### ✅ Works in Expo Go:
- UI components
- Navigation
- State management
- Most Expo packages
- Basic functionality

### ❌ Requires Dev Build:
- Push notifications (iOS)
- Native modules
- Custom native code
- Some device APIs

## 🚀 Recommended Next Steps

**For Development:**
```bash
# 1. Create iOS simulator build (fastest)
eas build --profile development --platform ios

# 2. Run with dev client
npx expo start --dev-client

# 3. Open app on simulator
# All features including notifications will work!
```

**For Testing:**
```bash
# Create preview build for device
eas build --profile preview --platform ios

# Share with testers
# Full production-like experience
```

## 🎯 Why This Happens

Expo Go is a **sandbox app** that includes common Expo modules. However:
- Some native iOS/Android modules aren't included
- PushNotificationIOS is iOS-specific and native
- Expo Go can't dynamically load these modules

**Development builds** are custom builds of your app that include:
- ✅ All native modules you need
- ✅ Custom configurations
- ✅ Full feature support
- ✅ Still with fast refresh and dev tools

## 💡 Quick Fix for Now

If you want to **temporarily** continue with Expo Go, you can:

1. Comment out notification initialization
2. Use the app without push notifications
3. Test other features

But for the **full experience**, a development build is required.

## 📚 Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo Go vs Dev Client](https://docs.expo.dev/workflow/expo-go/)

The good news: Your `eas.json` is already configured! Just run the build command above. 🚀

