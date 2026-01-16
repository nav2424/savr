# 🛒 Live Activities Setup Guide - Complete Implementation

## ✅ What's Been Created

### 1. **TypeScript Bridge** (`lib/LiveActivityManager.ts`)
- TypeScript interface for controlling Live Activities from React Native
- Methods: `startShoppingActivity()`, `updateActivity()`, `endActivity()`, `isSupported()`

### 2. **Native iOS Module** (`ios/SAVR/LiveActivityModule.swift`)
- Swift bridge connecting React Native to ActivityKit
- Handles starting, updating, and ending Live Activities

### 3. **Objective-C Bridge** (`ios/SAVR/LiveActivityModule.m`)
- Objective-C bridge for React Native module registration

### 4. **Live Activity Data Model** (`ios/SAVR/ShoppingListAttributes.swift`)
- Defines the structure of shopping list data
- Supports dynamic content updates

### 5. **Live Activity UI** (`ios/SAVR/ShoppingListLiveActivity.swift`)
- Beautiful SwiftUI interface for Lock Screen
- Dynamic Island support for iPhone 14 Pro+
- Shows progress, recently checked items, and unchecked items

### 6. **Integration** (`app/list-detail.tsx`)
- Automatically starts Live Activity when shopping mode begins
- Updates Live Activity when items are checked/unchecked
- Ends Live Activity when shopping is complete

---

## 🚀 Setup Steps

### Step 1: Add Files to Xcode Project

1. **Open Xcode:**
   ```bash
   open ios/SAVR.xcworkspace
   ```

2. **Add Swift files to project:**
   - In Xcode, right-click on "SAVR" folder (blue icon)
   - Select "Add Files to SAVR..."
   - Navigate to `ios/SAVR/` and add these files:
     - `LiveActivityModule.swift`
     - `LiveActivityModule.m`
     - `ShoppingListAttributes.swift`
     - `ShoppingListLiveActivity.swift`
   - ✅ Check "Copy items if needed" (if files aren't already in the folder)
   - ✅ Check "Add to targets: SAVR"

3. **Verify files are added:**
   - Check that all 4 files appear in Xcode's Project Navigator
   - Files should be under the "SAVR" group

### Step 2: Update Info.plist

1. **Open `ios/SAVR/Info.plist`**
2. **Add Live Activities support:**
   - Add key: `NSSupportsLiveActivities`
   - Type: Boolean
   - Value: `YES`

Or add this XML to Info.plist:
```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

### Step 3: Update Entitlements

1. **Open `ios/SAVR/SAVR.entitlements`**
2. **Add ActivityKit entitlement:**
   ```xml
   <key>com.apple.developer.ActivityKit</key>
   <true/>
   ```

### Step 4: Configure Build Settings

1. **In Xcode, select SAVR target**
2. **Go to "Build Settings"**
3. **Search for "Supports Live Activities"**
4. **Set to YES** (or add if missing)

### Step 5: Set Minimum iOS Version

1. **In Xcode, select SAVR target**
2. **Go to "General" tab**
3. **Set "Minimum Deployments" to iOS 16.1** (required for Live Activities)

### Step 6: Link ActivityKit Framework

1. **In Xcode, select SAVR target**
2. **Go to "Build Phases"**
3. **Expand "Link Binary With Libraries"**
4. **Click "+" and add:**
   - `ActivityKit.framework`
   - `WidgetKit.framework`

### Step 7: Update Swift Bridging Header

The bridging header should already exist. Verify `ios/SAVR/SAVR-Bridging-Header.h` exists. If not, create it with:
```objc
#import <React/RCTBridgeModule.h>
```

### Step 8: Register Widget Extension (Optional but Recommended)

For the Live Activity to appear, you may need to create a Widget Extension:

1. **In Xcode, File → New → Target**
2. **Select "Widget Extension"**
3. **Name it "SAVRWidget"**
4. **Uncheck "Include Configuration Intent"**
5. **In the Widget Extension, add:**
   ```swift
   import WidgetKit
   
   @main
   struct SAVRWidgetBundle: WidgetBundle {
       var body: some Widget {
           ShoppingListLiveActivity()
       }
   }
   ```

**Note:** For Expo projects, you may need to use a development build. Live Activities require native code and won't work in Expo Go.

---

## 📱 How It Works

### When User Starts Shopping:

1. User taps "Start Shopping" button
2. `handleStartShopping()` is called
3. Live Activity is started via `liveActivityManager.startShoppingActivity()`
4. Activity appears on Lock Screen and Dynamic Island (iPhone 14 Pro+)

### When User Checks Items:

1. User taps checkbox on any item
2. `handleCheckboxToggle()` is called
3. Item completion is toggled
4. Live Activity is updated via `liveActivityManager.updateActivity()`
5. Lock Screen and Dynamic Island update in real-time

### When Shopping Completes:

1. All items are checked
2. `handleEndShopping()` is called automatically
3. Live Activity is ended via `liveActivityManager.endActivity()`
4. Activity disappears from Lock Screen

---

## 🎨 Live Activity UI Features

### Lock Screen View:
- **Header**: List name + progress percentage
- **Progress Bar**: Visual completion indicator
- **Recently Checked**: Last 2 checked items (with checkmark)
- **Still Need**: Next 5 unchecked items
- **Footer**: Item count (e.g., "3 of 12 items")

### Dynamic Island (iPhone 14 Pro+):
- **Compact Leading**: Cart icon
- **Compact Trailing**: "3/12" count
- **Expanded**: Shows list name, progress bar, and top 3 unchecked items
- **Minimal**: Cart icon only (when multiple activities)

---

## 🧪 Testing

### Test on Physical Device:
1. Build and run on a physical iPhone (iOS 16.1+)
2. Live Activities don't work in Simulator
3. Go to a shopping list
4. Tap "Start Shopping"
5. Lock your phone
6. You should see the Live Activity on the Lock Screen
7. Unlock and check items
8. Lock again - you should see updates

### Test Dynamic Island (iPhone 14 Pro+):
1. Start shopping mode
2. The Dynamic Island should show the cart icon
3. Tap the Dynamic Island to expand
4. You should see the shopping list details

---

## 🔧 Troubleshooting

### "LiveActivityModule not available"
- **Solution**: Make sure all Swift files are added to Xcode project
- Clean build: `cd ios && xcodebuild clean && cd ..`
- Rebuild: `npx expo run:ios --device`

### "ActivityKit not found"
- **Solution**: Make sure iOS Deployment Target is 16.1+ in Xcode
- Project Settings → SAVR → Deployment Info → Minimum Deployments → 16.1

### "Live Activities are not enabled"
- **Solution**: Check Settings → Face ID & Passcode → Allow when locked → Live Activities
- User must enable Live Activities in iOS Settings

### Live Activity doesn't appear:
- **Solution**: 
  1. Make sure you're testing on a physical device (not simulator)
  2. Check that Live Activities are enabled in iOS Settings
  3. Verify the widget extension is registered (if using one)
  4. Check Xcode console for errors

### Build errors with Swift files:
- **Solution**: 
  1. Make sure Swift Bridging Header exists
  2. Verify all files are added to the correct target
  3. Clean build folder: Product → Clean Build Folder
  4. Rebuild project

---

## 📝 Notes

- **Expo Go**: Live Activities require native code and won't work in Expo Go. Use a development build.
- **Simulator**: Live Activities don't work in iOS Simulator. Test on a physical device.
- **iOS Version**: Requires iOS 16.1 or later.
- **Device Support**: Dynamic Island requires iPhone 14 Pro or later. Lock Screen Live Activities work on all devices with iOS 16.1+.

---

## ✅ Verification Checklist

- [ ] All 4 Swift/Objective-C files added to Xcode project
- [ ] Files added to SAVR target
- [ ] Info.plist has `NSSupportsLiveActivities` = YES
- [ ] Entitlements file has ActivityKit entitlement
- [ ] Build Settings has "Supports Live Activities" = YES
- [ ] Minimum iOS version is 16.1+
- [ ] ActivityKit and WidgetKit frameworks linked
- [ ] Tested on physical device (iOS 16.1+)
- [ ] Live Activity appears on Lock Screen
- [ ] Updates work when checking items
- [ ] Activity ends when shopping completes

---

## 🎉 Success!

Once setup is complete, users will see their shopping list on the Lock Screen and Dynamic Island (iPhone 14 Pro+) while shopping, with real-time updates as they check off items!



