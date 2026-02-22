

# Supabase Edge Functions - SAVR Price Discovery

## Overview

This directory contains Supabase Edge Functions:

- **delete-account**: Permanently deletes the authenticated user's account (App Store requirement)
- **scrape-weekly-flyers**: Scrapes grocery flyers weekly and stores deals in the database

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project**:
   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   ```

3. **Set up environment variables**:
   ```bash
   supabase secrets set SUPABASE_URL=https://your-project.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Deploying Functions

### Deploy Delete Account (App Store requirement)

```bash
supabase functions deploy delete-account
```

The function uses the user's JWT (auto-included by the client) and the service role key. Ensure `public.users` has `ON DELETE CASCADE` from `auth.users` (see `docs/sql/account-deletion-cascade.sql`).

### Deploy Weekly Flyer Scraper

```bash
# Deploy function
supabase functions deploy scrape-weekly-flyers

# Test it manually
curl -X POST https://your-project.supabase.co/functions/v1/scrape-weekly-flyers \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"country": "CA", "testMode": true}'
```

### Schedule as Cron Job

Run automatically every Sunday at 6 AM:

```bash
supabase functions schedule scrape-weekly-flyers --cron "0 6 * * 0"
```

**Cron schedule examples:**
- `"0 6 * * 0"` - Every Sunday at 6 AM
- `"0 0 * * 1"` - Every Monday at midnight
- `"0 12 * * *"` - Every day at noon
- `"0 */6 * * *"` - Every 6 hours

## Testing Functions

### Test from Command Line

```bash
# Test Canadian flyers
supabase functions invoke scrape-weekly-flyers \
  --data '{"country":"CA","testMode":true}'

# Test US flyers
supabase functions invoke scrape-weekly-flyers \
  --data '{"country":"US","testMode":true}'
```

### Test from Your App

```typescript
import { supabase } from './lib/supabase';

const { data, error } = await supabase.functions.invoke('scrape-weekly-flyers', {
  body: { country: 'CA', testMode: false }
});

console.log('Scraper result:', data);
```

## Monitoring

### View Function Logs

```bash
# Real-time logs
supabase functions logs scrape-weekly-flyers --tail

# Last 100 log entries
supabase functions logs scrape-weekly-flyers --limit 100
```

### Check Cron Status

```bash
# List all scheduled functions
supabase functions list --scheduled
```

## Production Best Practices

### 1. Error Handling

Add error notifications (email, Slack, etc.):

```typescript
// In your edge function
if (!result.success) {
  await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
    method: 'POST',
    body: JSON.stringify({
      text: `⚠️ Flyer scraper failed: ${result.errors.join(', ')}`
    })
  });
}
```

### 2. Rate Limiting

Respect website rate limits:

```typescript
// Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const store of stores) {
  await scrapeStore(store);
  await delay(2000); // Wait 2 seconds between stores
}
```

### 3. Deduplication

Avoid storing duplicate deals:

```typescript
// Check if deal already exists
const { data: existing } = await supabase
  .from('product_prices')
  .select('id')
  .eq('product_name', deal.productName)
  .eq('store_chain', deal.storeChain)
  .eq('valid_from', deal.validFrom)
  .single();

if (!existing) {
  // Store new deal
  await supabase.from('product_prices').insert(deal);
}
```

### 4. Monitoring & Alerts

Track scraper performance:

```typescript
// Log metrics
const metrics = {
  timestamp: new Date().toISOString(),
  itemsScraped: result.itemsScraped,
  duration: Date.now() - startTime,
  success: result.success
};

await supabase.from('scraper_metrics').insert(metrics);
```

## Cost Optimization

### Function Invocations

Supabase Edge Functions pricing:
- **Free tier**: 500,000 invocations/month
- **Pro tier**: 2,000,000 invocations/month included
- **Additional**: $2 per 1,000,000 invocations

**Weekly scraper cost:**
- Runs once per week = 4-5 times/month
- Cost: **FREE** (well within free tier)

### Optimization Tips

1. **Batch operations**: Process multiple stores in one invocation
2. **Cache data**: Store results to avoid re-scraping
3. **Incremental updates**: Only fetch new/changed data
4. **Compression**: Compress large payloads

## Troubleshooting

### Function Not Running

```bash
# Check if function is deployed
supabase functions list

# Check cron schedule
supabase functions schedule list

# View recent logs
supabase functions logs scrape-weekly-flyers
```

### Permission Errors

Make sure you've set the service role key:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Timeout Issues

Edge functions have a 60-second timeout. For long-running scrapes:

1. Split into smaller chunks
2. Use async processing
3. Consider using Supabase Database Functions instead

## Upgrading to Production Scraping

### Option 1: Flipp SDK

```typescript
// If Flipp offers an API/SDK
const flippDeals = await fetch('https://api.flipp.com/deals', {
  headers: { 'Authorization': `Bearer ${FLIPP_API_KEY}` }
});
```

### Option 2: Web Scraping

```typescript
// Using Cheerio or similar
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

const html = await fetch('https://www.loblaws.ca/flyer').then(r => r.text());
const doc = new DOMParser().parseFromString(html, 'text/html');

const deals = Array.from(doc.querySelectorAll('.deal-item')).map(item => ({
  productName: item.querySelector('.product-name')?.textContent,
  price: parseFloat(item.querySelector('.price')?.textContent || '0'),
  // ... extract more fields
}));
```

### Option 3: API Integration

Partner with stores or use official APIs when available.

## Next Steps

1. ✅ Deploy the function
2. ✅ Set up cron schedule
3. ✅ Test with real data
4. 🔄 Replace mock scraper with actual implementation
5. 📊 Add monitoring and alerts
6. 🚀 Scale to more stores

## Support

- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **Deno Deploy**: https://deno.com/deploy/docs
- **Edge Runtime**: https://edge-runtime.vercel.app/

---

**Happy scraping!** 🎉

