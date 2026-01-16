# 📊 Price Database Monitoring Guide

## 🎯 How to Monitor Your Silent Price Collection

You have **3 ways** to monitor your price database growth:

---

## 1. 📱 Admin Monitoring Screen (Easiest!)

### **How to Access:**
1. Open SAVR app
2. Go to **More** tab
3. **Tap the "SAVR" title 5 times** (or "More" title if using default theme)
4. Alert will appear: "Admin Access"
5. Tap **"Open Monitor"**

### **What You'll See:**
- ✅ Total prices collected
- ✅ Unique products tracked
- ✅ Store breakdown
- ✅ Country breakdown
- ✅ 7-day growth chart
- ✅ Recent additions
- ✅ Launch readiness progress bars

### **Features:**
- 🔄 Pull to refresh
- 📤 Export data to console
- 📈 Real-time stats
- 🎯 Progress toward launch goals

**Perfect for:** Quick daily/weekly checks

---

## 2. 🗄️ SQL Queries in Supabase (Most Detailed)

### **Access Supabase SQL Editor:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor**
4. Run these queries ⬇️

---

### **Quick Stats Queries:**

#### **Total Prices Collected**
```sql
SELECT COUNT(*) as total_prices
FROM product_prices;
```

#### **Unique Products**
```sql
SELECT COUNT(DISTINCT product_name) as unique_products
FROM product_prices;
```

#### **Today's Additions**
```sql
SELECT COUNT(*) as today_additions
FROM product_prices
WHERE created_at >= CURRENT_DATE;
```

#### **This Week's Growth**
```sql
SELECT COUNT(*) as week_additions
FROM product_prices
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

---

### **Breakdown Queries:**

#### **Prices by Store**
```sql
SELECT 
  store_chain,
  COUNT(*) as price_count,
  COUNT(DISTINCT product_name) as unique_products
FROM product_prices
GROUP BY store_chain
ORDER BY price_count DESC;
```

#### **Prices by Country**
```sql
SELECT 
  country,
  COUNT(*) as price_count,
  COUNT(DISTINCT product_name) as unique_products
FROM product_prices
GROUP BY country;
```

#### **Prices by Data Source**
```sql
SELECT 
  data_source,
  COUNT(*) as price_count
FROM product_prices
GROUP BY data_source
ORDER BY price_count DESC;
```

#### **Top 20 Most Tracked Products**
```sql
SELECT 
  product_name,
  COUNT(*) as price_count,
  MIN(price) as lowest_price,
  MAX(price) as highest_price,
  AVG(price)::NUMERIC(10,2) as avg_price
FROM product_prices
GROUP BY product_name
ORDER BY price_count DESC
LIMIT 20;
```

---

### **Growth & Trend Queries:**

#### **Daily Growth (Last 30 Days)**
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as prices_added
FROM product_prices
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### **Monthly Summary**
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_prices,
  COUNT(DISTINCT product_name) as unique_products,
  COUNT(DISTINCT store_chain) as stores
FROM product_prices
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

#### **Growth Rate (Week over Week)**
```sql
WITH weekly_stats AS (
  SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as week_count
  FROM product_prices
  GROUP BY DATE_TRUNC('week', created_at)
)
SELECT 
  week,
  week_count,
  LAG(week_count) OVER (ORDER BY week) as prev_week,
  week_count - LAG(week_count) OVER (ORDER BY week) as growth,
  ROUND(
    (week_count::FLOAT / NULLIF(LAG(week_count) OVER (ORDER BY week), 0) - 1) * 100, 
    2
  ) as growth_percent
FROM weekly_stats
ORDER BY week DESC
LIMIT 10;
```

---

### **Quality & Coverage Queries:**

#### **Price Distribution by Range**
```sql
SELECT 
  CASE 
    WHEN price < 1 THEN '$0-1'
    WHEN price < 5 THEN '$1-5'
    WHEN price < 10 THEN '$5-10'
    WHEN price < 20 THEN '$10-20'
    WHEN price < 50 THEN '$20-50'
    ELSE '$50+'
  END as price_range,
  COUNT(*) as count
FROM product_prices
GROUP BY price_range
ORDER BY price_range;
```

#### **Data Completeness**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(barcode) as with_barcode,
  COUNT(brand) as with_brand,
  COUNT(category) as with_category,
  ROUND(COUNT(barcode)::FLOAT / COUNT(*) * 100, 2) as barcode_coverage_pct,
  ROUND(COUNT(brand)::FLOAT / COUNT(*) * 100, 2) as brand_coverage_pct
FROM product_prices;
```

#### **Recent Activity (Last 10 Prices)**
```sql
SELECT 
  product_name,
  price,
  store_chain,
  country,
  created_at
FROM product_prices
ORDER BY created_at DESC
LIMIT 10;
```

---

### **Launch Readiness Queries:**

#### **Check if Ready for Launch**
```sql
SELECT 
  COUNT(*) as total_prices,
  COUNT(DISTINCT product_name) as unique_products,
  COUNT(DISTINCT store_chain) as stores,
  CASE 
    WHEN COUNT(*) >= 200000 THEN '🎉 READY TO LAUNCH!'
    WHEN COUNT(*) >= 100000 THEN '⚠️ MINIMUM MET - Consider waiting for 200K'
    WHEN COUNT(*) >= 50000 THEN '📈 Getting close! 50%+ there'
    ELSE '🔄 Keep collecting data'
  END as status
FROM product_prices;
```

#### **Store Coverage Analysis**
```sql
SELECT 
  store_chain,
  COUNT(*) as price_count,
  COUNT(DISTINCT product_name) as product_count,
  CASE 
    WHEN COUNT(DISTINCT product_name) >= 100 THEN 'Good'
    WHEN COUNT(DISTINCT product_name) >= 50 THEN 'Fair'
    ELSE 'Needs More Data'
  END as coverage
FROM product_prices
GROUP BY store_chain
ORDER BY price_count DESC;
```

---

## 3. 📧 Weekly Email Reports (Advanced - Optional)

You can set up automated email reports using Supabase Edge Functions:

### **Create Email Report Function:**

```typescript
// supabase/functions/weekly-price-report/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get stats
  const { count } = await supabase
    .from('product_prices')
    .select('*', { count: 'exact', head: true });

  // Send email (use Resend, SendGrid, etc.)
  const report = `
    Weekly Price Database Report
    
    Total Prices: ${count}
    Week's Growth: [calculate]
    Launch Status: [check readiness]
  `;

  // Send via email service
  // await sendEmail(report);

  return new Response(JSON.stringify({ success: true }));
});
```

**Schedule weekly:**
```bash
supabase functions deploy weekly-price-report
supabase functions schedule weekly-price-report --cron "0 9 * * 1"
```

---

## 📊 Recommended Monitoring Schedule

### **Daily (1 minute):**
- ✅ Use admin screen
- ✅ Quick check: Total prices
- ✅ See recent additions

### **Weekly (5 minutes):**
- ✅ Use admin screen + SQL
- ✅ Check growth rate
- ✅ Review store coverage
- ✅ Monitor quality metrics

### **Monthly (15 minutes):**
- ✅ Run all SQL queries
- ✅ Export data for analysis
- ✅ Review launch readiness
- ✅ Identify gaps in coverage

---

## 🎯 Key Metrics to Track

### **Volume Metrics:**
- [ ] Total prices: ________
- [ ] Unique products: ________
- [ ] Stores covered: ________
- [ ] Countries: ________

### **Growth Metrics:**
- [ ] Weekly growth rate: _____%
- [ ] Daily average: ________ prices/day
- [ ] Projected 3-month total: ________

### **Quality Metrics:**
- [ ] Barcode coverage: _____%
- [ ] Brand coverage: _____%
- [ ] Category coverage: _____%
- [ ] Store diversity: ________ stores

### **Launch Readiness:**
- [ ] Minimum (100K): ___% complete
- [ ] Recommended (200K): ___% complete
- [ ] Target date: ________

---

## 🚨 Alerts to Set

### **When to Alert Yourself:**

1. **🎉 Milestone Reached:**
   - 10,000 prices
   - 50,000 prices
   - 100,000 prices (launch ready!)
   - 200,000 prices (ideal launch)

2. **📉 Growth Slowing:**
   - Less than 500 prices/week
   - Zero growth for 3+ days
   - Declining trend

3. **🏪 Coverage Gaps:**
   - Major store has <50 products
   - Country imbalance (>90% one country)
   - Single store dominates (>80%)

4. **⚠️ Data Quality Issues:**
   - Barcode coverage <30%
   - Many duplicate products
   - Price anomalies (e.g., milk at $100)

---

## 📈 Launch Decision Framework

### **Minimum Requirements:**
- ✅ 100,000+ prices
- ✅ 3,000+ unique products
- ✅ 5+ major stores
- ✅ Both CA and US coverage

### **Recommended for Best Launch:**
- ✅ 200,000+ prices
- ✅ 5,000+ unique products
- ✅ 10+ stores
- ✅ Geographic diversity

### **When to Launch:**
```
IF total_prices >= 100,000 
AND unique_products >= 3,000 
AND stores >= 5
THEN ready for soft launch

IF total_prices >= 200,000 
AND unique_products >= 5,000
THEN ready for public launch
```

---

## 🔧 Quick Troubleshooting

### **Issue: No new prices appearing**
```sql
-- Check if receipts are being scanned
SELECT COUNT(*) FROM receipts 
WHERE created_at >= CURRENT_DATE;

-- If 0, users aren't scanning receipts
-- If >0, check if extraction is working
```

### **Issue: Only one store showing up**
```sql
-- Check store diversity
SELECT store_chain, COUNT(*) 
FROM product_prices 
GROUP BY store_chain;

-- If dominated by one store, need more diverse receipts
```

### **Issue: Slow growth**
```sql
-- Check weekly trend
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as additions
FROM product_prices
GROUP BY week
ORDER BY week DESC
LIMIT 4;

-- If declining, users may not be scanning receipts
```

---

## ✅ Monitoring Checklist

### **Weekly Checklist:**
- [ ] Check total prices (admin screen)
- [ ] Review growth rate (SQL)
- [ ] Check store coverage (SQL)
- [ ] Look at recent additions (admin screen)
- [ ] Monitor quality metrics (SQL)

### **Monthly Checklist:**
- [ ] Export full stats
- [ ] Analyze trends
- [ ] Update launch projection
- [ ] Identify data gaps
- [ ] Plan improvements

---

## 🎯 Summary

**3 Monitoring Methods:**
1. 📱 **Admin Screen** - Quick daily checks (tap SAVR title 5x)
2. 🗄️ **SQL Queries** - Detailed weekly analysis
3. 📧 **Email Reports** - Optional automation

**Key Metrics:**
- Total prices (aim for 200K)
- Unique products (aim for 5K)
- Growth rate (track weekly)
- Store coverage (5-10 stores)

**Launch When:**
- ✅ 100K+ prices (minimum)
- ✅ 200K+ prices (recommended)

---

**Happy monitoring!** 📊🚀

Your silent price database is growing. Check it regularly and launch when ready!

