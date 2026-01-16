/**
 * Supabase Edge Function: Check Price Alerts
 * 
 * Checks user price alerts and sends notifications when prices drop below thresholds.
 * Run as a scheduled cron job (daily).
 * 
 * Deploy:
 *   supabase functions deploy check-price-alerts
 * 
 * Schedule as cron:
 *   supabase functions schedule check-price-alerts --cron "0 8 * * *"
 *   (Runs every day at 8 AM)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface PriceAlert {
  id: string;
  user_id: string;
  product_name: string;
  barcode?: string;
  max_price: number;
  store_chains?: string[];
  is_active: boolean;
  last_triggered_at?: string;
}

interface PriceMatch {
  alert: PriceAlert;
  matchingPrices: any[];
}

interface NotificationResult {
  success: boolean;
  alertsChecked: number;
  notificationsSent: number;
  errors: string[];
}

/**
 * Send push notification to user
 */
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
): Promise<boolean> {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return result.data?.status === 'ok';
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Get user's push tokens
 */
async function getUserPushTokens(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }

  return (data || []).map((row: any) => row.token);
}

/**
 * Find matching prices for an alert
 */
async function findMatchingPrices(
  supabase: any,
  alert: PriceAlert
): Promise<any[]> {
  let query = supabase
    .from('product_prices')
    .select('*')
    .lte('price', alert.max_price);

  // Filter by product name or barcode
  if (alert.barcode) {
    query = query.eq('barcode', alert.barcode);
  } else {
    query = query.ilike('product_name', `%${alert.product_name}%`);
  }

  // Filter by store chains if specified
  if (alert.store_chains && alert.store_chains.length > 0) {
    query = query.in('store_chain', alert.store_chains);
  }

  // Only active deals
  query = query.or('valid_to.gte.now(),valid_to.is.null');

  const { data, error } = await query.limit(5);

  if (error) {
    console.error('Error finding matching prices:', error);
    return [];
  }

  return data || [];
}

/**
 * Process a single price alert
 */
async function processAlert(
  supabase: any,
  alert: PriceAlert
): Promise<{ notified: boolean; matches: number }> {
  try {
    // Find matching prices
    const matches = await findMatchingPrices(supabase, alert);

    if (matches.length === 0) {
      return { notified: false, matches: 0 };
    }

    // Get best price
    const bestPrice = matches.reduce((min, p) => 
      p.price < min.price ? p : min
    , matches[0]);

    // Get user's push tokens
    const pushTokens = await getUserPushTokens(supabase, alert.user_id);

    if (pushTokens.length === 0) {
      console.log(`No push tokens for user ${alert.user_id}`);
      return { notified: false, matches: matches.length };
    }

    // Send notification to each device
    let notificationsSent = 0;
    
    for (const token of pushTokens) {
      const success = await sendPushNotification(
        token,
        `🏷️ Price Alert: ${alert.product_name}`,
        `Now $${bestPrice.price.toFixed(2)} at ${bestPrice.store_chain} (Your alert: $${alert.max_price.toFixed(2)})`,
        {
          type: 'price_alert',
          alertId: alert.id,
          productName: alert.product_name,
          price: bestPrice.price,
          storeChain: bestPrice.store_chain,
        }
      );

      if (success) notificationsSent++;
    }

    // Update alert's last_triggered_at
    await supabase
      .from('price_alerts')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', alert.id);

    console.log(`✅ Alert ${alert.id}: Sent ${notificationsSent} notification(s)`);

    return { notified: true, matches: matches.length };
  } catch (error) {
    console.error(`Error processing alert ${alert.id}:`, error);
    return { notified: false, matches: 0 };
  }
}

/**
 * Main function: Check all active price alerts
 */
async function checkAllAlerts(): Promise<NotificationResult> {
  const result: NotificationResult = {
    success: false,
    alertsChecked: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active price alerts
    const { data: alerts, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }

    if (!alerts || alerts.length === 0) {
      console.log('No active price alerts to check');
      result.success = true;
      return result;
    }

    console.log(`Checking ${alerts.length} active price alerts...`);

    // Process each alert
    for (const alert of alerts) {
      result.alertsChecked++;
      
      const { notified } = await processAlert(supabase, alert);
      
      if (notified) {
        result.notificationsSent++;
      }
    }

    result.success = true;
    console.log(`✅ Checked ${result.alertsChecked} alerts, sent ${result.notificationsSent} notifications`);

  } catch (error) {
    console.error('Error checking alerts:', error);
    result.errors.push((error as Error).message);
  }

  return result;
}

/**
 * Edge Function handler
 */
serve(async (req) => {
  try {
    console.log('='.repeat(50));
    console.log('Price Alerts Checker Started');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(50));

    // Run alert checker
    const result = await checkAllAlerts();

    // Log result
    console.log('\nChecker Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Alerts Checked: ${result.alertsChecked}`);
    console.log(`Notifications Sent: ${result.notificationsSent}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(', ')}`);
    }
    console.log('='.repeat(50));

    // Return response
    return new Response(
      JSON.stringify({
        success: result.success,
        alertsChecked: result.alertsChecked,
        notificationsSent: result.notificationsSent,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500,
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * DEPLOYMENT INSTRUCTIONS:
 * 
 * 1. Deploy function:
 *    supabase functions deploy check-price-alerts
 * 
 * 2. Set environment variables (if not already set):
 *    supabase secrets set SUPABASE_URL=your-url
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
 * 
 * 3. Schedule as cron job (runs every day at 8 AM):
 *    supabase functions schedule check-price-alerts --cron "0 8 * * *"
 * 
 * 4. Test manually:
 *    curl -X POST https://your-project.supabase.co/functions/v1/check-price-alerts \
 *      -H "Authorization: Bearer YOUR_ANON_KEY" \
 *      -H "Content-Type: application/json"
 * 
 * NOTIFICATION CHANNELS:
 * 
 * This function currently uses Expo Push Notifications (free!).
 * You can also add:
 * 
 * 1. Email notifications (using Resend, SendGrid, etc.)
 * 2. SMS notifications (using Twilio, etc.)
 * 3. In-app notifications
 * 4. Webhook to your app
 * 
 * PRODUCTION IMPROVEMENTS:
 * 
 * 1. Rate limiting:
 *    - Limit notifications per user per day
 *    - Don't spam users with alerts
 * 
 * 2. Smart scheduling:
 *    - Respect user's timezone
 *    - Send at preferred times
 * 
 * 3. Aggregation:
 *    - Group multiple alerts into one notification
 *    - "3 items on your watchlist are on sale!"
 * 
 * 4. Analytics:
 *    - Track notification open rates
 *    - A/B test notification copy
 *    - Optimize send times
 */

