# 🛒 Live Activities for Shopping Lists - Setup Guide

## ✅ What's Been Created

### 1. **React Native Bridge** (`lib/LiveActivityManager.ts`)
- TypeScript interface for controlling Live Activities from React Native
- Methods: `startShoppingActivity()`, `updateActivity()`, `endActivity()`

### 2. **Native iOS Module** (`ios/SAVR/LiveActivityModule.swift`)
- Swift bridge connecting React Native to ActivityKit
- Handles starting, updating, and ending Live Activities

### 3. **Live Activity Data Model** (`ios/SAVR/ShoppingListAttributes.swift`)
- Defines the structure of shopping list data
- Supports up to 10 items in the Live Activity

### 4. **Live Activity UI** (`ios/SAVR/ShoppingListLiveActivity.swift`)
- Beautiful SwiftUI interface for Lock Screen
- Shows progress, recently checked items, and unchecked items
- Dynamic Island support for iPhone 14 Pro+

---

## 🚀 Final Setup Steps

### Step 1: Add Files to Xcode Project

1. **Open Xcode:**
   ```bash
   open ios/SAVR.xcworkspace
   ```

2. **Add Swift files to project:**
   - Right-click on "SAVR" folder in Xcode
   - Select "Add Files to SAVR..."
   - Add these files:
     - `LiveActivityModule.swift`
     - `LiveActivityModule.m`
     - `ShoppingListAttributes.swift`
     - `ShoppingListLiveActivity.swift`
   - ✅ Check "Copy items if needed"
   - ✅ Check "Add to targets: SAVR"

3. **Update Swift Bridging Header:**
   - Find `SAVR-Bridging-Header.h`
   - It should already exist from Expo
   - No changes needed (Expo auto-configures it)

### Step 2: Enable Live Activities in Xcode

1. **Select SAVR target** in Xcode
2. **Go to "Signing & Capabilities"**
3. **Click "+ Capability"**
4. **Add "Push Notifications"** (required for Live Activities)
5. **Build Settings** → Search for "Supports Live Activities"
   - Set to **YES**

---

## 📱 How to Use

### In Your React Native Code:

```typescript
import { liveActivityManager } from '../lib/LiveActivityManager'

// Start shopping mode
const handleStartShopping = async () => {
  const activityId = await liveActivityManager.startShoppingActivity({
    listId: list.id,
    listName: list.name,
    items: list.items.map(item => ({
      id: item.id,
      name: item.name,
      completed: item.completed,
      quantity: item.quantity
    })),
    totalItems: list.itemCount,
    completedItems: list.completedCount
  })
  
  // Save activityId to update later
  setCurrentActivityId(activityId)
}

// Update when items are checked
const handleItemChecked = async (itemId: string) => {
  // Update your local state first
  toggleItemCompletion(list.id, itemId)
  
  // Then update Live Activity
  if (currentActivityId) {
    await liveActivityManager.updateActivity(currentActivityId, {
      listId: list.id,
      listName: list.name,
      items: updatedItems,
      totalItems: list.itemCount,
      completedItems: list.completedCount + 1
    })
  }
}

// End shopping mode
const handleEndShopping = async () => {
  if (currentActivityId) {
    await liveActivityManager.endActivity(currentActivityId)
    setCurrentActivityId(null)
  }
}
```

---

## 🎨 Live Activity UI Features

### Lock Screen View:
- **Header**: List name + progress percentage
- **Progress Bar**: Visual completion indicator
- **Recently Checked**: Last 2 checked items (strikethrough)
- **Still Need**: Next 5 unchecked items
- **Overflow**: "+X more in app..." if >5 items

### Dynamic Island (iPhone 14 Pro+):
- **Compact**: Cart icon + "3/12" count
- **Expanded**: Shows top 3 items + progress bar
- **Minimal**: Cart icon only

---

## 🔧 Troubleshooting

### Build Errors:
1. **"ActivityKit not found"**
   - Make sure iOS Deployment Target is 16.1+ in Xcode
   - Project Settings → SAVR → Deployment Info → Minimum Deployments → 16.1

2. **"Module not found"**
   - Clean build: `cd ios && pod install && cd ..`
   - Rebuild: `npx expo run:ios --device`

3. **Live Activity doesn't appear:**
   - Check Settings → Face ID & Passcode → Allow when locked → Live Activities
   - Make sure device is running iOS 16.1+

---

## ✨ Next Steps

Once your build finishes:

1. ✅ **Test in app**: Tap "Start Shopping" on any list
2. ✅ **Lock your phone**: Live Activity should appear
3. ✅ **Check items in app**: Live Activity updates in real-time
4. ✅ **All items checked**: Live Activity auto-dismisses

---

## 📚 iOS Capabilities Required

Add to `app.config.js`:
```javascript
ios: {
  supportsTablet: true,
  infoPlist: {
    // ... existing permissions
    NSSupportsLiveActivities: true
  }
}
```

---

**Status**: ✅ Live Activities code is ready! Once your build finishes installing, we just need to:
1. Add the Swift files to Xcode project
2. Enable capabilities
3. Rebuild once
4. Test! 🎉

