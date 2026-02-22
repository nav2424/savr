// Load .env files (root first, then server/ as fallback for EXPO_PUBLIC_*)
function loadEnv(filePath) {
  try {
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      const envFile = fs.readFileSync(filePath, 'utf8');
      envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  } catch (e) { /* optional */ }
}
const path = require('path');
loadEnv(path.join(__dirname, '.env'));
loadEnv(path.join(__dirname, 'server', '.env'));

export default {
  expo: {
    name: "SAVR",
    slug: "savr-mobile",
    scheme: "savr",
    version: "1.0.1",
    orientation: "portrait",
    extra: { 
      API_BASE: process.env.EXPO_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:3000", // Update this to your backend URL
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      // Pass through environment variables so they are available in dev client/TestFlight
      EXPO_PUBLIC_OPENROUTER_API_KEY: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
      EXPO_PUBLIC_UNSPLASH_ACCESS_KEY: process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY,
      UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL: process.env.EXPO_PUBLIC_EMAIL_VERIFICATION_REDIRECT_URL,
      EXPO_PUBLIC_ENABLE_PAYWALL: process.env.EXPO_PUBLIC_ENABLE_PAYWALL,
      EXPO_PUBLIC_ENABLE_RECIPES: process.env.EXPO_PUBLIC_ENABLE_RECIPES,
      EXPO_PUBLIC_RC_IOS_API_KEY: process.env.EXPO_PUBLIC_RC_IOS_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      EXPO_PUBLIC_RC_ANDROID_API_KEY: process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
      EXPO_PUBLIC_REVENUECAT_WEB_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY,
      EXPO_PUBLIC_REVENUECAT_OFFERING_ID: process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID,
      eas: {
        projectId: "ec017836-d4f4-4efe-9bc5-28bcf8bcf520"
      }
    },
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: { 
      image: "./assets/splash.png", 
      resizeMode: "contain", 
      backgroundColor: "#000000" 
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: "SAVR needs camera access to scan grocery barcodes and receipts.",
        NSPhotoLibraryUsageDescription: "SAVR needs photo library access to upload receipt images.",
        NSMicrophoneUsageDescription: "SAVR needs microphone access for voice commands with SAGE AI assistant.",
        NSSpeechRecognitionUsageDescription: "SAVR uses speech recognition to process voice commands for the SAGE AI assistant, allowing you to interact with the app hands-free.",
        ITSAppUsesNonExemptEncryption: false,
        // Responsive design settings
        UIUserInterfaceStyle: "Dark",
        UIStatusBarStyle: "UIStatusBarStyleLightContent"
      },
      bundleIdentifier: "com.arnavsaluja.savr"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ],
      package: "com.arnavsaluja.savr"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-camera",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ffffff",
          defaultChannel: "default"
        }
      ]
    ]
  }
}
