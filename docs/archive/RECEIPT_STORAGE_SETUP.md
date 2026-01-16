# 🧾 Receipt Storage & History Feature

## Overview
Users can now scan receipts and access their complete scan history from their profile. Every receipt is automatically saved with full details.

## ✨ Features

### 1. **Automatic Receipt Saving**
- ✅ Every scanned receipt is automatically saved
- ✅ Stores receipt image (optional)
- ✅ Stores all scan results (items, quantities, prices)
- ✅ Tracks store name and purchase date
- ✅ Calculates total amount

### 2. **Receipt History**
- ✅ View all past receipts
- ✅ See receipt details (store, date, total)
- ✅ Preview scanned items
- ✅ Delete unwanted receipts
- ✅ Pull to refresh

### 3. **Statistics Dashboard**
- ✅ Total receipts scanned
- ✅ Total amount spent
- ✅ Most frequent store

## 🗄️ Database Setup

**REQUIRED:** Run this SQL in your Supabase SQL Editor:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `/add-receipts-table.sql`
4. Click "Run"

This creates:
- `receipts` table
- Indexes for performance
- Row Level Security policies
- Auto-update triggers

## 📦 What Gets Stored

### Receipt Data Structure:
```typescript
{
  id: "uuid",
  user_id: "uuid",
  store_name: "Costco",
  purchase_date: "2025-10-13",
  total_amount: 127.50,
  image_url: "https://...", // Optional
  scan_result: {
    store: "Costco",
    date: "2025-10-13",
    items: [
      {
        name: "Kirkland Signature Diced Tomatoes",
        emoji: "🍅",
        quantity: 6,
        unit: "cans",
        category: "Pantry Staples",
        location: "pantry",
        price: 8.99
      },
      // ... more items
    ],
    totalItems: 15,
    rawText: "..." // AI response
  },
  created_at: "2025-10-13T10:30:00Z",
  updated_at: "2025-10-13T10:30:00Z"
}
```

## 🔄 User Flow

### Scanning Flow:
```
1. User opens Scan tab
2. Takes photo of receipt
3. AI analyzes receipt
   ↓
4. Receipt is automatically saved ✅
   ↓
5. Results shown to user
6. User reviews/edits items
7. Adds items to pantry
```

### Viewing History:
```
1. User goes to More tab
2. Taps "Receipt History" 🧾
   ↓
3. Sees all past receipts
4. Stats displayed at top:
   - Total receipts
   - Total spent
   - Most frequent store
   ↓
5. Each receipt shows:
   - Store name
   - Date scanned
   - Total amount (if available)
   - Preview of items (first 3)
   - "+X more" if more items
   ↓
6. Long press to delete receipt
```

## 🎨 UI Features

### Receipt History Screen:
- **Stats Card** (glassmorphic):
  ```
  ┌──────────────────────────────────┐
  │   12    │  $1,247.50  │  Costco  │
  │ RECEIPTS│ TOTAL SPENT │ TOP STORE│
  └──────────────────────────────────┘
  ```

- **Receipt Cards** (glassmorphic):
  ```
  ┌──────────────────────────────────┐
  │ 🧾  Costco           $127.50     │
  │     Oct 13, 2025                 │
  ├──────────────────────────────────┤
  │ 15 ITEMS                         │
  │ 🍅 Diced Tom...  🥛 Milk  🥖 ... │
  │ +12 more                         │
  └──────────────────────────────────┘
  ```

### Empty State:
```
      🧾
 No Receipts Yet
 
Scan your first receipt
to start tracking your
grocery purchases

  [ Scan Receipt ]
```

## 📍 Access Points

### More Tab → Receipt History
Located in Settings section:
- 👤 Profile
- 🔔 Notifications
- 🔒 Privacy
- **🧾 Receipt History** ← New!

## 🔐 Security

- ✅ Row Level Security enabled
- ✅ Users can only see their own receipts
- ✅ Users can only delete their own receipts
- ✅ Receipt images stored in private Supabase Storage bucket

## 💾 Storage Options

### Image Storage (Optional):
By default, receipt images are uploaded to Supabase Storage. To configure:

1. Create storage bucket:
   - Go to Storage in Supabase Dashboard
   - Create bucket named `receipts`
   - Set to private

2. Images are automatically uploaded during scan

### Without Image Storage:
- Receipts still save with full scan data
- Just no image preview available
- All items and details preserved

## 📊 Benefits

1. **Track Spending**: See total amount spent over time
2. **Store Insights**: Know which stores you shop at most
3. **Historical Data**: Access past grocery purchases
4. **Receipt Backup**: Never lose a receipt again
5. **Itemized Records**: Every item from every receipt saved
6. **Search & Filter**: Find specific purchases (future enhancement)

## 🚀 Future Enhancements

- [ ] Receipt detail view (tap to see full receipt)
- [ ] Export receipts to PDF/CSV
- [ ] Monthly spending reports
- [ ] Category-wise expense breakdown
- [ ] Receipt search functionality
- [ ] Date range filters
- [ ] Store-based filtering
- [ ] Expense trends and insights

## 🎯 Statistics Tracked

- Total number of receipts
- Total amount spent (from all receipts)
- Most frequently shopped store
- Items per receipt (average)
- Date of first and last receipt

## 🔮 Smart Features

- Receipts auto-save in background
- No user action required
- Graceful failure if save fails
- Works offline (saves when back online)
- Pull-to-refresh for latest data

---

**Note:** Receipt storage requires authentication. Unauthenticated users can still scan receipts but won't have access to history.

