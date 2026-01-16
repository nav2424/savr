# 🥗 SAVR Pantry - Real Data Setup Guide

The pantry feature has been fully refactored to use **real data from Supabase** instead of mock data. This guide will help you set it up.

---

## ✅ What Was Changed

### 1. **Database Schema Created**
- Created `pantry-schema.sql` with the complete database schema for pantry items
- Includes proper RLS (Row Level Security) policies
- Users can only see and manage their own pantry items
- Real-time subscriptions enabled for live updates

### 2. **PantryContext Refactored**
- **Before**: Stored items only in memory (lost on app restart)
- **After**: Full Supabase integration with real-time updates
- Features:
  - ✅ Load items from database
  - ✅ Add/update/delete items
  - ✅ Real-time synchronization across devices
  - ✅ Automatic user association
  - ✅ Helper functions (getExpiringItems, getItemsByLocation, etc.)

### 3. **Pantry Screen Updated**
- **Before**: Used hardcoded `PANTRY_CATEGORIES` mock data
- **After**: Dynamically fetches and displays real data from context
- Features:
  - ✅ Live data from Supabase
  - ✅ Search functionality
  - ✅ Filter by location (fridge, freezer, pantry) and expiring soon
  - ✅ Pull-to-refresh
  - ✅ Loading and error states
  - ✅ Empty state with helpful prompts
  - ✅ Add items to shopping lists
  - ✅ Quantity management (increase/decrease/remove)
  - ✅ Voice commands via SAGE assistant
  - ✅ Item details modal with purchase history
  - ✅ Expiry date tracking with color-coded warnings

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Open your **Supabase Dashboard**: https://app.supabase.com
2. Navigate to your project
3. Go to **SQL Editor**
4. Open the file `pantry-schema.sql` from your project
5. Copy and paste the SQL code into the SQL Editor
6. Click **Run** to execute the migration

This will create:
- `pantry_items` table
- Proper indexes for performance
- RLS policies for security
- Triggers for automatic timestamp updates

### Step 2: Enable Realtime (Optional but Recommended)

To get live updates across devices:

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Find the `supabase_realtime` publication
3. Click **Edit**
4. Add the `pantry_items` table to the publication
5. Save changes

Alternatively, run this SQL command:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
```

### Step 3: Test the Pantry

1. Make sure you're logged in with a user account
2. Navigate to the **Pantry** tab
3. You should see an empty state (since you have no items yet)
4. Try adding items using:
   - **Voice Commands**: "Add 3 apples to my pantry"
   - **Scanning**: Use the scan feature to add items from receipts
   - **Manual Entry**: (You can add a manual entry UI later)

---

## 📊 Database Schema Overview

### Table: `pantry_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users table |
| `name` | TEXT | Item name (e.g., "Apples") |
| `icon` | TEXT | Emoji icon (e.g., "🍎") |
| `category` | TEXT | Category (e.g., "produce") |
| `quantity` | DECIMAL | Current quantity |
| `unit` | TEXT | Unit of measurement (e.g., "pieces", "lbs") |
| `location` | TEXT | Storage location: 'fridge', 'freezer', or 'pantry' |
| `expiry_date` | DATE | Expiration date (optional) |
| `purchase_date` | DATE | Purchase date (optional) |
| `price` | DECIMAL | Purchase price (optional) |
| `store` | TEXT | Store name (optional) |
| `notes` | TEXT | Additional notes (optional) |
| `barcode` | TEXT | Product barcode (optional) |
| `brand` | TEXT | Brand name (optional) |
| `image_url` | TEXT | Product image URL (optional) |
| `created_at` | TIMESTAMP | Auto-generated |
| `updated_at` | TIMESTAMP | Auto-updated |

---

## 🎯 Features Implemented

### Core Functionality
- ✅ **Real Database Storage**: All pantry items stored in Supabase
- ✅ **User Isolation**: Users only see their own items (RLS enforced)
- ✅ **Real-time Sync**: Changes sync across devices instantly
- ✅ **Search**: Search items by name or category
- ✅ **Filters**: Filter by location or expiring items
- ✅ **Quantity Management**: Increase/decrease with visual feedback
- ✅ **Expiry Tracking**: Color-coded expiry warnings (red, orange, gray)

### UI Features
- ✅ **Pull-to-Refresh**: Swipe down to reload items
- ✅ **Loading States**: Skeleton screens while loading
- ✅ **Error Handling**: Graceful error messages with retry
- ✅ **Empty State**: Helpful prompts when pantry is empty
- ✅ **Item Details Modal**: View complete item information
- ✅ **Delete Confirmation**: Prevent accidental deletions

### Integration Features
- ✅ **Voice Commands**: Add/remove items via SAGE assistant
- ✅ **Add to Lists**: Send pantry items to shopping lists
- ✅ **Scan Integration**: Ready for receipt/barcode scanning

---

## 🔧 Future Enhancements (Optional)

Here are some ideas for additional features:

1. **Manual Add Item Modal**
   - Add a "+" button to manually create pantry items
   - Form with fields for name, quantity, location, expiry date, etc.

2. **Barcode Scanning**
   - Scan product barcodes to auto-fill item details
   - Integration with product databases (OpenFoodFacts API)

3. **Recipe Suggestions**
   - Suggest recipes based on current pantry items
   - Show which ingredients are missing

4. **Shopping List Auto-Add**
   - When item quantity reaches 0, offer to add to shopping list
   - Smart reordering based on usage patterns

5. **Nutrition Tracking**
   - Track nutritional information for pantry items
   - Calculate meal nutrition from pantry items used

6. **Expiry Notifications**
   - Push notifications for items expiring soon
   - Weekly summary of expiring items

7. **Price Tracking**
   - Track price history from different stores
   - Show best prices and savings

8. **Categories Management**
   - Custom category creation
   - Category icons and colors

---

## 🐛 Troubleshooting

### Items Not Loading
1. Check that you're logged in
2. Verify database migration was successful
3. Check Supabase logs for errors
4. Ensure RLS policies are enabled

### Real-time Not Working
1. Enable realtime in Supabase dashboard
2. Check that the table is added to `supabase_realtime` publication
3. Verify network connectivity

### Can't Add Items
1. Verify user is authenticated
2. Check RLS policies allow INSERT for authenticated users
3. Check console logs for specific errors

---

## 📝 API Reference

### PantryContext Methods

```typescript
// Get all pantry items
const { items } = usePantry()

// Add a new item
await addItem({
  name: 'Apples',
  icon: '🍎',
  category: 'produce',
  quantity: 5,
  unit: 'pieces',
  location: 'fridge',
  expiry_date: '2024-05-01',
  store: 'Whole Foods',
  price: 4.99
})

// Update quantity
await updateQuantity(itemId, newQuantity)

// Remove item
await removeItem(itemId)

// Update any field
await updateItem(itemId, { 
  quantity: 10, 
  notes: 'Updated notes' 
})

// Find item by name
const item = findItemByName('apple')

// Consume items (reduces quantity)
await consumeItem('apples', 2)

// Get items by location
const fridgeItems = getItemsByLocation('fridge')

// Get expiring items (default: 3 days)
const expiring = getExpiringItems(7) // 7 days threshold

// Manually refresh
await refreshItems()
```

---

## 🎉 Success!

Your pantry is now fully functional with **real data** stored in Supabase! 

The mock data has been completely removed, and everything is now:
- ✅ Persisted to the database
- ✅ Synced across devices
- ✅ Secured with RLS policies
- ✅ Ready for production use

Start adding items and enjoy your fully functional pantry management system! 🥗

