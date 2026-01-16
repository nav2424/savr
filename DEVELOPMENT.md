# SAVR Development Guide

## 🚀 Quick Start

The SAVR app is now configured to work in **development mode** with mock data, so you can test all features without needing a backend server.

### Running the App

1. **Start the development server:**
   ```bash
   npm start
   ```

2. **Run on iOS Simulator:**
   ```bash
   npm run ios
   ```

3. **Run on Android Emulator:**
   ```bash
   npm run android
   ```

4. **Run on physical device:**
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal

## 🔧 Development Mode Features

When you see the **"🔧 Development Mode - Using Mock Data"** banner at the top, the app is using mock data instead of making real API calls. This means:

### ✅ What Works:
- **Grocery Lists**: Create lists, add items, check off items, delete items
- **Barcode Scanning**: Camera interface works (but won't add real items)
- **Receipt Scanning**: Photo picker works (but won't process real receipts)
- **Recipe Suggestions**: Generate mock recipes based on mock pantry
- **Settings**: All preferences and settings work
- **UI/UX**: All animations, navigation, and interactions work perfectly

### 📱 Mock Data Includes:
- **Sample Grocery List**: "Weekly Groceries" with Milk, Bread, Eggs
- **Sample Pantry**: Milk, Bread, Chicken from "Whole Foods"
- **Sample Recipes**: Chicken Stir Fry with ingredients and instructions
- **Family Settings**: Default household with 3 members

## 🔌 Backend Integration

When you're ready to connect to a real backend:

1. **Update API endpoint** in `app.config.js`:
   ```javascript
   extra: { 
     API_BASE: "https://your-backend-url.com" // Replace with your backend URL
   }
   ```

2. **The app will automatically switch** from mock data to real API calls

3. **Expected API endpoints** (see README.md for full documentation):
   - `GET /api/lists` - Get grocery lists
   - `POST /api/lists` - Create new list
   - `GET /api/pantry` - Get pantry items
   - `POST /api/receipts` - Upload receipt
   - And more...

## 🐛 Troubleshooting

### Network Errors
- **If you see "Network request failed"**: This is normal in development mode
- **The app will automatically use mock data** instead
- **No action needed** - just continue testing the UI

### Camera Issues
- **iOS Simulator**: Camera won't work, use a physical device
- **Android Emulator**: Enable camera in emulator settings
- **Physical Device**: Grant camera permissions when prompted

### Build Issues
- **Clear cache**: `expo start -c`
- **Reset Metro**: `npx react-native start --reset-cache`
- **Reinstall dependencies**: `rm -rf node_modules && npm install`

## 📱 Testing Features

### Grocery Lists Tab
- ✅ Create new lists
- ✅ Add items via text input
- ✅ Check off items
- ✅ Delete items
- ✅ Pull to refresh

### Scan Tab
- ✅ Camera permission handling
- ✅ Barcode scanning interface
- ✅ Pause/resume scanning
- ✅ Clear scan history

### Receipts Tab
- ✅ Photo picker from library
- ✅ Receipt image display
- ✅ Digital pantry view
- ✅ Processing status

### Recipes Tab
- ✅ Generate recipes button
- ✅ Recipe cards with details
- ✅ Dietary preference filtering
- ✅ Missing ingredients display

### Settings Tab
- ✅ Dietary preferences toggles
- ✅ Family information display
- ✅ Notification settings
- ✅ About section

## 🎨 Customization

### Colors
Edit the color scheme in any component's StyleSheet:
```javascript
const s = StyleSheet.create({
  primary: '#4ea1ff',    // Blue accent
  background: '#000000', // Black background
  surface: '#111111',    // Card background
  // ... more colors
})
```

### Mock Data
Update mock data in `lib/api.ts`:
```javascript
const MOCK_DATA = {
  lists: [
    // Add your own sample lists here
  ],
  pantry: [
    // Add your own sample pantry items here
  ]
}
```

## 🚀 Next Steps

1. **Test all features** with the current mock data
2. **Customize the UI** to your preferences
3. **Set up your backend** when ready
4. **Deploy to app stores** when complete

The app is fully functional and ready for development! 🎉
