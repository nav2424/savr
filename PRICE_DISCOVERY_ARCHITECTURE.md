# 🏗️ Price Discovery System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         SAVR APP                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Scan       │  │    Price     │  │     Deals &          │ │
│  │   Receipt    │  │  Comparison  │  │     Alerts           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                 │                      │             │
└─────────┼─────────────────┼──────────────────────┼─────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              PRICE DISCOVERY SERVICE                            │
│                                                                 │
│  • searchProductPrices()                                        │
│  • comparePrice()                                               │
│  • getDealsNearby()                                             │
│  • createPriceAlert()                                           │
│  • importFromReceipt()                                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA SOURCES (ALL FREE!)                      │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   User     │  │    Open    │  │   Weekly   │  │  Barcode │ │
│  │  Receipts  │  │    Food    │  │   Flyers   │  │   Scan   │ │
│  │            │  │   Facts    │  │  (Scrape)  │  │  History │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │
│        │               │               │              │       │
└────────┼───────────────┼───────────────┼──────────────┼───────┘
         │               │               │              │
         ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │product_prices│  │store_locations│ │   weekly_flyers      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │price_alerts  │  │  scanned_    │  │     receipts         │ │
│  │              │  │  products    │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. **Receipt Scanning → Price Extraction**

```
User Scans Receipt
       │
       ▼
ReceiptsService.saveReceipt()
       │
       ├─ Upload image
       ├─ Extract OCR data
       └─ extractAndStorePrices() ← 🆕 NEW!
              │
              ├─ Detect country (CA/US)
              ├─ Normalize store name
              ├─ Extract item prices
              └─ Store in product_prices table
                     │
                     ▼
              Price data now available
              for comparison!
```

### 2. **Price Search Flow**

```
User Searches "milk"
       │
       ▼
priceDiscoveryService.searchProductPrices()
       │
       ├─ Query product_prices table
       ├─ Filter by country
       ├─ Filter by postal code (optional)
       ├─ Filter by store (optional)
       └─ Sort by price
              │
              ▼
       PriceComparisonCard
              │
              ├─ Show best price
              ├─ Compare stores
              ├─ Show savings
              └─ Enable price alerts
```

### 3. **Deals Discovery Flow**

```
User Opens Deals Tab
       │
       ▼
priceDiscoveryService.getDealsNearby()
       │
       ├─ Filter by postal code
       ├─ Filter is_on_sale = true
       ├─ Filter valid_to >= today
       └─ Sort by discount %
              │
              ▼
         DealsList
              │
              ├─ Show deal cards
              ├─ Display discounts
              └─ Store locations
```

### 4. **Open Food Facts Integration**

```
User Scans Barcode
       │
       ▼
priceDiscoveryService.importFromOpenFoodFacts(barcode)
       │
       ├─ Call API: https://world.openfoodfacts.org/api/...
       ├─ Get product info
       ├─ Extract: name, brand, category, image
       └─ Store in scanned_products
              │
              ▼
       Product info available
       (prices from receipts linked by name)
```

### 5. **Price Alerts Flow**

```
User Sets Alert: "Notify when milk < $4.99"
       │
       ▼
priceDiscoveryService.createPriceAlert()
       │
       └─ Insert into price_alerts table
              │
              ▼
       Cron Job (Backend)
              │
              └─ checkPriceAlerts()
                     │
                     ├─ Find matching products
                     ├─ Compare prices
                     └─ Send notification if match
```

---

## Component Architecture

### **Frontend (React Native)**

```
app/
├── price-comparison.tsx ← Example screen
├── (tabs)/
│   └── [integrate here] ← Add to navigation
│
components/
├── PriceComparisonCard.tsx ← Price display
└── [other components]

lib/
├── PriceDiscoveryService.ts ← Main service
├── ReceiptsService.ts ← Enhanced with price extraction
└── scrapers/
    └── FlyerScraperService.ts ← Web scraping (backend)
```

### **Backend (Optional - For Scrapers)**

```
Supabase Edge Functions / AWS Lambda / Cloud Run:

functions/
├── scrape-weekly-flyers/ ← Weekly cron job
│   ├── index.ts
│   └── FlyerScraperService.ts
│
├── check-price-alerts/ ← Daily cron job
│   └── index.ts
│
└── enrich-products/ ← Background job
    └── index.ts (Open Food Facts)
```

---

## Database Schema

### **product_prices** (Main Price Table)
```sql
┌────────────────┬──────────────┬─────────────────────┐
│ Column         │ Type         │ Purpose             │
├────────────────┼──────────────┼─────────────────────┤
│ product_name   │ TEXT         │ Product name        │
│ barcode        │ TEXT         │ UPC/EAN (optional)  │
│ price          │ DECIMAL      │ Current price       │
│ original_price │ DECIMAL      │ Pre-sale price      │
│ is_on_sale     │ BOOLEAN      │ Sale status         │
│ store_chain    │ TEXT         │ Store name          │
│ country        │ TEXT         │ CA or US            │
│ data_source    │ TEXT         │ Where it came from  │
│ valid_from/to  │ DATE         │ Price validity      │
└────────────────┴──────────────┴─────────────────────┘
```

**Data Sources:**
- `user_receipt` - From scanned receipts
- `openfoodfacts` - From Open Food Facts API
- `flipp_scraper` - From Flipp
- `store_flyer` - From direct store scraping

### **Indexes for Fast Queries**
```sql
✓ product_name (for search)
✓ barcode (for lookup)
✓ store_chain (for filtering)
✓ country (for region)
✓ is_on_sale (for deals)
✓ valid_from/to (for current deals)
```

---

## API Integration Points

### **1. Open Food Facts** (FREE! 🎉)
```
Endpoint: https://world.openfoodfacts.org/api/v0/product/{barcode}.json
Cost: FREE
Rate Limit: None (be reasonable)
Auth: None required
Response: Product info, images, nutrition
```

### **2. Flipp** (FREE tier available)
```
Option A: JavaScript SDK
  - Sign up: https://corp.flipp.com/flipp-for-developers
  - Free tier: 100 requests/month
  - Embed flyers directly in app

Option B: Web Scraping
  - URL: https://flipp.com
  - Respect robots.txt
  - Rate limit: 1-2 req/sec
  - Cache: 7 days
```

### **3. Direct Store APIs** (Varies)
```
Loblaws: Check if API available
Walmart: May have partner API
Most stores: Flyer pages are public HTML
```

---

## Cost Analysis

### **Current Implementation: $0/month**

| Component | Cost | Notes |
|-----------|------|-------|
| Supabase (database) | $0 | Free tier (500MB) |
| Open Food Facts | $0 | 100% free, no limits |
| Receipt OCR | $0 | Already in app |
| Web scraping | $0 | Self-hosted |
| **Total** | **$0** | 🎉 |

### **If You Scale (1000+ users):**

| Component | Cost | Notes |
|-----------|------|-------|
| Supabase | $25/mo | Pro tier |
| Cloud Functions | $5-10/mo | For scrapers |
| Flipp Pro | $0-50/mo | If needed |
| **Total** | **$30-85/mo** | Still cheap! |

---

## Security & Privacy

### **Privacy Protection**
```
Receipt Data:
✓ Anonymized before storage
✓ No personal info in price DB
✓ Users control sharing

Price Data:
✓ Aggregated across users
✓ No user attribution
✓ Public pricing only
```

### **RLS Policies**
```sql
-- Price data is public (read-only)
product_prices: SELECT = true (anyone)

-- Alerts are private
price_alerts: SELECT = user_id = auth.uid()

-- Receipts are private
receipts: SELECT = user_id = auth.uid()
```

---

## Scaling Strategy

### **Phase 1: Bootstrap (0-100 users)**
```
✓ Open Food Facts for product info
✓ Receipt scanning for prices
✓ Basic price comparison
✓ Cost: $0
```

### **Phase 2: Growth (100-1000 users)**
```
✓ Add weekly flyer scraping
✓ Set up cron jobs
✓ Price alerts
✓ Cost: ~$30/month
```

### **Phase 3: Scale (1000+ users)**
```
✓ Partner with Flipp/others
✓ Crowdsourced price reporting
✓ Machine learning for price prediction
✓ Cost: $50-100/month
```

---

## Development Roadmap

### **Week 1: Foundation** ✅
- [x] Database schema
- [x] Core services
- [x] UI components
- [x] Receipt integration

### **Week 2: Polish**
- [ ] Add to main navigation
- [ ] Test with real receipts
- [ ] Improve price matching
- [ ] UI refinements

### **Week 3: Enhancement**
- [ ] Weekly flyer scraper
- [ ] Price alerts notifications
- [ ] Location-based filtering
- [ ] Price history charts

### **Week 4: Launch**
- [ ] Beta testing
- [ ] User feedback
- [ ] Performance optimization
- [ ] Public release

---

## Quick Reference

### **Key Files**
```
📄 Database:  docs/sql/add-price-discovery-tables.sql
🔧 Service:   lib/PriceDiscoveryService.ts
🎨 UI:        components/PriceComparisonCard.tsx
📱 Example:   app/price-comparison.tsx
📚 Guide:     PRICE_DISCOVERY_GUIDE.md
```

### **Key Functions**
```typescript
// Search prices
priceDiscoveryService.searchProductPrices(product, options)

// Get deals
priceDiscoveryService.getDealsNearby(postalCode, country)

// Compare prices
priceDiscoveryService.comparePrice(product, barcode, country)

// Set alert
priceDiscoveryService.createPriceAlert(userId, product, maxPrice)

// Import from receipt (automatic!)
receiptsService.saveReceipt() // Auto-extracts prices
```

---

## 🎉 Success Metrics

Track these to measure impact:

- **Data Coverage:** % of products with price data
- **User Engagement:** Price searches per user
- **Value Delivered:** Avg savings shown per user
- **Data Quality:** Price accuracy vs actual receipts
- **Growth:** Receipt scans per week (builds database)

---

## 🚀 You're All Set!

You now have a **complete, free price discovery system** that:

✅ Works from day 1 (Open Food Facts)  
✅ Scales with users (crowdsourced receipts)  
✅ Costs $0 to start  
✅ Shows real value to users  
✅ Builds competitive moat (proprietary price data)

**Next step:** Run the SQL migration and start testing! 🎯

