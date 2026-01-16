// Load .env file if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  // .env file loading is optional
}

export default {
  expo: {
    name: "SAVR",
    slug: "savr-mobile",
    scheme: "savr",
    version: "1.0.1",
    orientation: "portrait",
    extra: { 
      API_BASE: "http://localhost:3000", // Update this to your backend URL
      // Pass through environment variables so they are available in dev client/TestFlight
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      EXPO_PUBLIC_OPENROUTER_API_KEY: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
      EXPO_PUBLIC_UNSPLASH_ACCESS_KEY: process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY,
      UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
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
