# 🏷️ SAVR Price Discovery System - Setup Guide

## Overview

Your SAVR app now has a **free, scalable price discovery system** that works from day 1 - even with zero users! This system combines multiple data sources to show users real-time grocery prices and deals.

## 🎯 Features

✅ **Multi-source price data:**
- User-scanned receipts (automatic extraction)
- Open Food Facts API (100% free)
- Web scrapers for weekly flyers (Flipp, Reebee, store sites)

✅ **Smart price comparison:**
- Compare prices across stores
- Find best deals near user location
- Track price history
- Set price alerts

✅ **Works immediately:**
- Open Food Facts provides product data from day 1
- Your users' receipt scans build a price database automatically
- No API costs or subscriptions needed

---

## 📦 What's Included

### Database Tables (SQL)
- `store_locations` - Store information and locations
- `product_prices` - Price data from all sources
- `weekly_flyers` - Flyer tracking and metadata
- `price_alerts` - User price notifications

### Services
- `PriceDiscoveryService.ts` - Main service for price operations
- `FlyerScraperService.ts` - Web scraping for flyers (backend)
- Enhanced `ReceiptsService.ts` - Auto-extracts prices from receipts

### UI Components
- `PriceComparisonCard.tsx` - Show price comparisons
- `DealsList.tsx` - Display deals and discounts

---

## 🚀 Setup Steps

### Step 1: Set Up Database

Run the SQL migration in your Supabase dashboard:

```bash
# In Supabase SQL Editor, run:
/docs/sql/add-price-discovery-tables.sql
```

This creates all necessary tables with proper RLS policies.

### Step 2: Test with Existing Receipts

The system is **already integrated** with your receipt scanning! Every time a user scans a receipt, prices are automatically extracted and stored.

To test:
1. Scan a receipt in your app
2. Check the `product_prices` table in Supabase
3. You should see price entries appear automatically

### Step 3: Add Price Comparison to Your UI

Example usage in a screen:

```typescript
import { priceDiscoveryService } from '../lib/PriceDiscoveryService';
import { PriceComparisonCard, DealsList } from '../components/PriceComparisonCard';

// In your component:
const [prices, setPrices] = useState<PriceData[]>([]);

// Search for product prices
useEffect(() => {
  const searchPrices = async () => {
    const results = await priceDiscoveryService.searchProductPrices(
      'milk',
      { country: 'CA', maxResults: 10 }
    );
    setPrices(results);
  };
  
  searchPrices();
}, []);

// Display price comparison
<PriceComparisonCard
  productName="Milk 2L"
  prices={prices}
  onStorePress={(price) => {
    // Handle store selection
    console.log('Selected store:', price.storeChain);
  }}
/>
```

### Step 4: Get Free Product Data (Open Food Facts)

Open Food Facts is **100% free** and requires no API key:

```typescript
// Look up product by barcode
const product = await priceDiscoveryService.importFromOpenFoodFacts('123456789');

// Product info is now in your database!
```

### Step 5: Show Nearby Deals

```typescript
const [deals, setDeals] = useState<PriceData[]>([]);

useEffect(() => {
  const fetchDeals = async () => {
    // Get deals near postal code
    const nearbyDeals = await priceDiscoveryService.getDealsNearby(
      'M5V', // Toronto postal code
      'CA',
      'Dairy' // Optional category filter
    );
    setDeals(nearbyDeals);
  };
  
  fetchDeals();
}, []);

// Display deals
<DealsList
  deals={deals}
  onDealPress={(deal) => {
    // Show deal details
  }}
/>
```

---

## 💰 Free Data Sources (Zero Cost!)

### 1. **Open Food Facts** (Recommended - Start Here!)
- ✅ **100% FREE** - No API key needed
- ✅ **2.8M+ products** worldwide
- ✅ **Product info:** Name, brand, category, nutrition, images
- ✅ **Some price data** (user-contributed)

**How to use:**
```typescript
// No setup required! Just call:
const product = await priceDiscoveryService.importFromOpenFoodFacts('barcode');
```

**API Endpoint:**
```
https://world.openfoodfacts.org/api/v0/product/{barcode}.json
```

### 2. **User Receipt Data** (Already Implemented!)
- ✅ **FREE** - Uses your existing receipt scanning
- ✅ **Automatic** - No extra work needed
- ✅ **Crowdsourced** - Builds database as users scan

**How it works:**
1. User scans receipt
2. Items & prices extracted automatically
3. Stored in `product_prices` table
4. Available for price comparison

### 3. **Web Scraping** (Free but Requires Backend)

⚠️ **Important:** Web scraping should run as a **backend service**, not in the React Native app.

#### Option A: Flipp.com (Easiest)
- Aggregates flyers from 2000+ stores
- Canada + USA coverage
- **Free tier:** 100 requests/month
- **SDK available:** https://docs.flipp.com

#### Option B: Direct Store Scrapers
Canadian stores:
- Loblaws: `https://www.loblaws.ca/flyer`
- Metro: `https://www.metro.ca/en/flyer`
- Sobeys: `https://www.sobeys.com/en/flyer/`
- Walmart CA: `https://www.walmart.ca/flyer`

US stores:
- Walmart: `https://www.walmart.com/weekly-ads`
- Target: `https://www.target.com/circle/offers`
- Kroger: `https://www.kroger.com/savings/weekly-ad`

**Legal compliance:**
1. Check `robots.txt` before scraping
2. Respect rate limits (1-2 req/sec max)
3. Cache aggressively (flyers update weekly)
4. Flyers are public marketing material ✅

---

## 🔧 Advanced Features

### Price Alerts

Let users set price alerts:

```typescript
await priceDiscoveryService.createPriceAlert(
  userId,
  'Milk 2L',
  4.99, // Alert when below $4.99
  undefined, // Barcode (optional)
  ['Loblaws', 'Metro'] // Specific stores (optional)
);

// Check alerts (run as cron job)
await priceDiscoveryService.checkPriceAlerts();
```

### Price History

Track price trends over time:

```typescript
const history = await priceDiscoveryService.getPriceHistory(
  'Milk 2L',
  undefined, // Barcode
  'Loblaws', // Store
  30 // Days back
);

// Chart price trends in your UI
```

### Location-Based Prices

Find prices near user location:

```typescript
const nearbyPrices = await priceDiscoveryService.searchProductPrices(
  'bread',
  {
    country: 'CA',
    postalCode: 'M5V', // User's postal code
    onSaleOnly: true
  }
);
```

---

## 🌐 Backend Setup (Optional - For Scrapers)

Web scrapers should run as **backend services** to avoid App Store issues and improve performance.

### Option 1: Supabase Edge Functions (Recommended)

```typescript
// supabase/functions/scrape-flyers/index.ts
import { flyerScraperService } from './FlyerScraperService.ts';

Deno.serve(async (req) => {
  const { postalCode, country } = await req.json();
  
  const deals = await flyerScraperService.scrapeAllSources(
    postalCode,
    country
  );
  
  return new Response(JSON.stringify(deals), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Deploy:
```bash
supabase functions deploy scrape-flyers
```

Schedule as cron job:
```bash
# Run weekly on Sundays at 6 AM
supabase functions schedule scrape-flyers --cron "0 6 * * 0"
```

### Option 2: AWS Lambda / Vercel Functions

Similar setup - deploy `FlyerScraperService.ts` as a serverless function.

### Option 3: Self-hosted Script

```bash
# Run locally or on a server
node scripts/scrape-weekly-flyers.js
```

---

## 📊 Example Workflow

### For Day 1 (No Users Yet)

1. ✅ **Use Open Food Facts:**
   - Provides product info for any barcode
   - No cost, no API key

2. ✅ **Set up weekly flyer scraper:**
   - Scrape Flipp or direct store sites
   - Run as cron job every Sunday
   - Populates deals for the week

3. ✅ **Show deals to users:**
   - Display weekly specials
   - Price comparison (when data available)

### As Users Grow

1. ✅ **Receipt scanning builds database:**
   - Every receipt adds price data
   - Crowdsourced, community prices

2. ✅ **Price comparisons improve:**
   - More data = better comparisons
   - Real user purchase prices

3. ✅ **Location-specific pricing:**
   - Store-specific prices
   - Postal code matching

---

## 🎯 Quick Start Checklist

- [ ] Run SQL migration in Supabase
- [ ] Test receipt price extraction (already works!)
- [ ] Add `PriceComparisonCard` to a screen
- [ ] Integrate Open Food Facts for product data
- [ ] (Optional) Set up flyer scraper as backend service
- [ ] (Optional) Add price alerts feature

---

## 💡 Pro Tips

1. **Start simple:**
   - Use Open Food Facts for product info
   - Let receipt scanning build your price database
   - Add scrapers later when you need more data

2. **Cache aggressively:**
   - Flyers update weekly (cache 7 days)
   - Product info rarely changes (cache 30 days)
   - Reduce API calls and improve speed

3. **Show value early:**
   - Even with limited data, show what you have
   - "Last seen at $X.XX on [date]" is valuable
   - Users will contribute more receipts to see better data

4. **Privacy first:**
   - Receipt data is anonymized
   - No personal info in price database
   - Users control what they share

---

## 🐛 Troubleshooting

### "No prices found"
- Check if `product_prices` table has data
- Try searching by exact product name
- Verify country filter (CA vs US)

### "Receipt prices not extracting"
- Check console logs in `ReceiptsService`
- Verify receipt items have valid price data
- Test with known store names

### "Open Food Facts returns null"
- Barcode might not exist in their database
- Try a common product (e.g., Coca-Cola UPC)
- Check network connectivity

---

## 📚 Resources

- **Open Food Facts:** https://world.openfoodfacts.org/data
- **Flipp SDK:** https://docs.flipp.com
- **Price Scraping Ethics:** https://benbernardblog.com/web-scraping-and-crawling-are-perfectly-legal-right/

---

## 🚀 Next Steps

1. **Run the SQL migration**
2. **Scan a receipt and check the database**
3. **Add price comparison to a screen**
4. **Test Open Food Facts integration**
5. **Consider adding flyer scraper for weekly deals**

You now have a **free, scalable price discovery system** that works from day 1! 🎉

No API costs. No subscriptions. Just free, community-driven data that gets better as your app grows.

