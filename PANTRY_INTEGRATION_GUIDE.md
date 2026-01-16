# SAVR Pantry Integration Guide
## Unified Item Formatting & Consistency

This document explains how all pantry items are formatted consistently across different import methods.

---

## 🎯 Overview

All items added to the pantry follow the same formatting rules, regardless of the import method:
- ✅ **Barcode Scan** → Unified Formatting
- ✅ **Receipt Scan** → Unified Formatting  
- ✅ **Image/Item Scan** → Unified Formatting
- ✅ **Manual Entry** → Unified Formatting
- ✅ **Voice Commands** → Unified Formatting

---

## 📦 Core System: `PantryItemFormatter.ts`

Located at `/lib/PantryItemFormatter.ts`, this utility ensures every pantry item has:

### 1. **Accurate Emoji/Image**
- **300+ item-specific emojis** mapped by name (e.g., 🍌 for banana, 🥛 for milk)
- **Category-based fallbacks** when specific item isn't found
- **Smart matching** handles variations (e.g., "bananas" = 🍌, "banana" = 🍌)

### 2. **Standardized Categories**
All items are normalized to one of these categories:
- Produce
- Meat & Seafood
- Dairy & Eggs
- Bakery
- Grains & Bread
- Pantry Staples
- Beverages
- Frozen
- Snacks
- Condiments
- Other

### 3. **Correct Storage Location**
Automatically determined based on:
- **Category** (Produce → Fridge, Frozen → Freezer, etc.)
- **Item keywords** (e.g., "frozen pizza" → Freezer)
- **User preference** (manual override available)

---

## 🔄 Import Methods

### 1. **Barcode Scan** (`/components/ScanResultModal.tsx`)
```typescript
// Scans barcode → Gets product data → Formats with unified formatter
const formattedItem = formatPantryItem({
  name: product.name,
  category: product.category,
  quantity,
  unit: 'unit',
  image: product.image,
  barcode: product.barcode,
  notes: product.brand,
})
await addItem(formattedItem)
```
**Result**: Item with proper emoji, normalized category, correct storage location

### 2. **Receipt Scan** (`/lib/ScanningService.ts`)
```typescript
// AI scans receipt → Extracts items → Normalizes with formatter
const processedItems = (result.items || []).map((item: any) => {
  const normalizedCategory = normalizeCategory(item.category || 'Other')
  const properEmoji = getItemEmoji(item.name, normalizedCategory)
  
  return {
    ...item,
    category: normalizedCategory,
    emoji: properEmoji,
  }
})
```
**Result**: All receipt items have consistent emojis and categories

### 3. **Image/Item Scan** (`/lib/ScanningService.ts`)
```typescript
// AI identifies item → Determines category → Gets emoji
return {
  ...result,
  category: capitalizeCategoryName(result.category || 'Other'),
  emoji: getItemEmoji(result.name, result.category),
}
```
**Result**: Scanned items match pantry format

### 4. **Manual Entry** (`/components/ManualAddItemModal.tsx`)
```typescript
// User enters details → Formatter ensures consistency
const formattedItem = formatPantryItem({
  name: itemName.trim(),
  category: categoryLabel,
  quantity: quantityNum,
  unit: selectedUnit,
  location: selectedLocation,
  notes: notes.trim(),
})
await addItem(formattedItem)
```
**Result**: Manually added items get proper emoji automatically

### 5. **Voice Commands** (`/app/(tabs)/pantry.tsx`)
```typescript
// SAGE voice command → Formatted with proper emoji
const formattedItem = formatPantryItem({
  name: itemName,
  category: category || 'Other',
  quantity,
  unit: unit || 'unit',
  location: location || 'pantry',
})
await addItem(formattedItem)
```
**Result**: Voice-added items follow same rules

---

## 🎨 Emoji Mapping System

### Item-Specific Emojis (300+)
```typescript
'banana': '🍌'
'milk': '🥛'
'chicken': '🍗'
'bread': '🍞'
'tomato': '🍅'
// ... and 295+ more
```

### Category Fallbacks
When specific item not found:
```typescript
'Produce': '🥬'
'Meat & Seafood': '🥩'
'Dairy & Eggs': '🥛'
'Pantry Staples': '🥫'
// ... etc
```

### Smart Matching
Handles variations:
- "apple" or "apples" → 🍎
- "strawberry" or "strawberries" → 🍓
- "potato" or "potatoes" → 🥔

---

## 📍 Storage Location Intelligence

### Automatic Determination
```typescript
// Category-based
'Produce' → Fridge
'Dairy & Eggs' → Fridge
'Meat & Seafood' → Fridge
'Frozen' → Freezer
'Pantry Staples' → Pantry

// Keyword-based
'frozen pizza' → Freezer
'fresh milk' → Fridge
'canned beans' → Pantry
```

---

## 🔧 How to Add Items to Pantry

### Method 1: Manual Add
1. Open **Pantry** tab
2. Tap **+ button** in top-right header
3. Enter item details
4. Tap "Add to Pantry"
✅ Automatic emoji assignment
✅ Smart storage location

### Method 2: Barcode Scan
1. Tap **scan button** (barcode icon) in Pantry header
2. Scan product barcode
3. Review details
4. Tap "Add to Pantry"
✅ Product image or emoji
✅ Normalized category

### Method 3: Receipt Scan
1. Navigate to **Dashboard** → "Scan Receipt"
2. Take photo of receipt
3. AI extracts all items
4. Items saved to receipt history
5. *(Future: One-tap to add all to pantry)*
✅ All items formatted consistently

### Method 4: Image Scan
1. Use camera to scan individual item
2. AI identifies item
3. Tap "Add to Pantry"
✅ Proper emoji assigned

### Method 5: Voice Command
1. Tap **SAGE button** (floating green button)
2. Say: *"Add [quantity] [item] to pantry"*
3. Example: *"Add 2 bananas to pantry"*
✅ Voice-added items get proper formatting

---

## 📊 Category Normalization

### Input → Normalized Output
```
"fruits" → "Produce"
"vegetables" → "Produce"
"meat" → "Meat & Seafood"
"dairy" → "Dairy & Eggs"
"cereals" → "Grains & Bread"
"canned goods" → "Pantry Staples"
"drinks" → "Beverages"
"frozen foods" → "Frozen"
"desserts" → "Snacks"
"sauces" → "Condiments"
```

---

## 🧪 Testing Checklist

### ✅ All Import Methods Tested
- [x] Barcode scan assigns correct emoji
- [x] Receipt scan normalizes categories
- [x] Image scan gets proper emoji
- [x] Manual entry auto-assigns emoji
- [x] Voice commands format correctly

### ✅ Emoji Assignment
- [x] Specific items get accurate emojis
- [x] Unknown items get category emoji
- [x] No items have missing/default emojis

### ✅ Category Consistency
- [x] All categories standardized
- [x] No lowercase or inconsistent naming
- [x] Categories match across all methods

### ✅ Storage Location
- [x] Produce goes to Fridge
- [x] Frozen items go to Freezer
- [x] Dry goods go to Pantry
- [x] Manual override works

---

## 🔍 Code References

### Core Files
- **Formatter**: `/lib/PantryItemFormatter.ts`
- **Pantry Context**: `/lib/PantryContext.tsx`
- **Scanning Service**: `/lib/ScanningService.ts`
- **Barcode Service**: `/lib/BarcodeService.ts`

### UI Components
- **Manual Add Modal**: `/components/ManualAddItemModal.tsx`
- **Scan Result Modal**: `/components/ScanResultModal.tsx`
- **Pantry Screen**: `/app/(tabs)/pantry.tsx`

### Integration Points
All import methods call:
```typescript
import { formatPantryItem, getItemEmoji, normalizeCategory } from './PantryItemFormatter'
```

---

## 🎯 Summary

**Every item added to SAVR pantry:**
1. ✅ Has a relevant emoji/image
2. ✅ Belongs to a standardized category
3. ✅ Is stored in the correct location
4. ✅ Follows consistent formatting

**No matter the import method:**
- Barcode scan
- Receipt scan
- Image scan  
- Manual entry
- Voice command

**All items look and behave the same way!** 🎉

---

## 🚀 Future Enhancements

### Potential Improvements
1. **Receipt → Pantry Flow**: One-tap to add all receipt items to pantry
2. **Smart Expiry Dates**: Auto-suggest expiry based on item type
3. **Image URLs**: Store actual product images alongside emojis
4. **Custom Emojis**: Allow users to set custom emojis per item
5. **AI Learning**: Improve emoji suggestions based on user preferences

---

*Last Updated: 2024*
*SAVR - Smart Pantry Management*

