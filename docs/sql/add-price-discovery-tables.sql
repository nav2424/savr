-- SAVR Price Discovery System
-- Tables for storing grocery prices, deals, and discounts from multiple sources

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Store Locations Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.store_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_chain TEXT NOT NULL, -- e.g., "Walmart", "Loblaws", "Target"
  store_name TEXT NOT NULL, -- Full name including location
  country TEXT NOT NULL CHECK (country IN ('CA', 'US')),
  province_state TEXT, -- Province (CA) or State (US)
  city TEXT,
  postal_code TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  store_id_external TEXT, -- External store identifier from flyers/APIs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for store locations
CREATE INDEX IF NOT EXISTS idx_store_locations_chain ON public.store_locations(store_chain);
CREATE INDEX IF NOT EXISTS idx_store_locations_country ON public.store_locations(country);
CREATE INDEX IF NOT EXISTS idx_store_locations_postal_code ON public.store_locations(postal_code);
CREATE INDEX IF NOT EXISTS idx_store_locations_location ON public.store_locations(latitude, longitude);

-- ============================================
-- Product Prices Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Product identification
  product_name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT, -- UPC/EAN if available
  category TEXT,
  
  -- Price information
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2), -- For sale items
  currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD')),
  unit TEXT, -- e.g., "each", "lb", "kg", "100g"
  unit_price DECIMAL(10, 2), -- Price per standardized unit
  
  -- Deal information
  is_on_sale BOOLEAN DEFAULT false,
  discount_percentage INTEGER,
  deal_description TEXT, -- e.g., "Buy 2 Get 1 Free", "50% off"
  valid_from DATE,
  valid_to DATE,
  
  -- Store information
  store_location_id UUID REFERENCES public.store_locations(id) ON DELETE CASCADE,
  store_chain TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('CA', 'US')),
  
  -- Data source tracking
  data_source TEXT NOT NULL, -- e.g., "flipp_scraper", "openfoodfacts", "user_receipt"
  source_url TEXT, -- URL of the flyer/source
  flyer_id TEXT, -- External flyer identifier
  
  -- Additional data
  product_data JSONB, -- Store full scraped/API data
  image_url TEXT,
  
  -- Timestamps
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for product prices
CREATE INDEX IF NOT EXISTS idx_product_prices_name ON public.product_prices(product_name);
CREATE INDEX IF NOT EXISTS idx_product_prices_barcode ON public.product_prices(barcode);
CREATE INDEX IF NOT EXISTS idx_product_prices_store_chain ON public.product_prices(store_chain);
CREATE INDEX IF NOT EXISTS idx_product_prices_country ON public.product_prices(country);
CREATE INDEX IF NOT EXISTS idx_product_prices_valid_dates ON public.product_prices(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_product_prices_on_sale ON public.product_prices(is_on_sale) WHERE is_on_sale = true;
CREATE INDEX IF NOT EXISTS idx_product_prices_data_source ON public.product_prices(data_source);
CREATE INDEX IF NOT EXISTS idx_product_prices_category ON public.product_prices(category);

-- ============================================
-- Weekly Flyers Table (for tracking scraping)
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_flyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_chain TEXT NOT NULL,
  store_location_id UUID REFERENCES public.store_locations(id) ON DELETE CASCADE,
  country TEXT NOT NULL CHECK (country IN ('CA', 'US')),
  
  -- Flyer metadata
  flyer_title TEXT,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  flyer_url TEXT,
  flyer_id_external TEXT, -- ID from source (e.g., Flipp)
  
  -- Scraping metadata
  data_source TEXT NOT NULL,
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  items_count INTEGER DEFAULT 0,
  
  -- Full flyer data
  flyer_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure we don't duplicate flyers
  UNIQUE(store_chain, flyer_id_external, valid_from)
);

-- Indexes for weekly flyers
CREATE INDEX IF NOT EXISTS idx_weekly_flyers_chain ON public.weekly_flyers(store_chain);
CREATE INDEX IF NOT EXISTS idx_weekly_flyers_country ON public.weekly_flyers(country);
CREATE INDEX IF NOT EXISTS idx_weekly_flyers_dates ON public.weekly_flyers(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_weekly_flyers_external_id ON public.weekly_flyers(flyer_id_external);

-- ============================================
-- User Price Alerts Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Alert criteria
  product_name TEXT NOT NULL,
  barcode TEXT, -- Optional: alert for specific product
  max_price DECIMAL(10, 2), -- Alert when price is below this
  store_chains TEXT[], -- Array of preferred store chains
  
  -- Alert status
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for price alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON public.price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts(is_active) WHERE is_active = true;

-- ============================================
-- Enable Row Level Security
-- ============================================

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_flyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - Store Locations (Public Read)
-- ============================================

DROP POLICY IF EXISTS "Anyone can read store locations" ON public.store_locations;
CREATE POLICY "Anyone can read store locations"
  ON public.store_locations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service can insert store locations" ON public.store_locations;
CREATE POLICY "Service can insert store locations"
  ON public.store_locations
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update store locations" ON public.store_locations;
CREATE POLICY "Service can update store locations"
  ON public.store_locations
  FOR UPDATE
  USING (true);

-- ============================================
-- RLS Policies - Product Prices (Public Read)
-- ============================================

DROP POLICY IF EXISTS "Anyone can read product prices" ON public.product_prices;
CREATE POLICY "Anyone can read product prices"
  ON public.product_prices
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert prices" ON public.product_prices;
CREATE POLICY "Authenticated users can insert prices"
  ON public.product_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update prices" ON public.product_prices;
CREATE POLICY "Authenticated users can update prices"
  ON public.product_prices
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- RLS Policies - Weekly Flyers (Public Read)
-- ============================================

DROP POLICY IF EXISTS "Anyone can read weekly flyers" ON public.weekly_flyers;
CREATE POLICY "Anyone can read weekly flyers"
  ON public.weekly_flyers
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert flyers" ON public.weekly_flyers;
CREATE POLICY "Authenticated users can insert flyers"
  ON public.weekly_flyers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update flyers" ON public.weekly_flyers;
CREATE POLICY "Authenticated users can update flyers"
  ON public.weekly_flyers
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- RLS Policies - Price Alerts (User-specific)
-- ============================================

DROP POLICY IF EXISTS "Users can read own price alerts" ON public.price_alerts;
CREATE POLICY "Users can read own price alerts"
  ON public.price_alerts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own price alerts" ON public.price_alerts;
CREATE POLICY "Users can insert own price alerts"
  ON public.price_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own price alerts" ON public.price_alerts;
CREATE POLICY "Users can update own price alerts"
  ON public.price_alerts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own price alerts" ON public.price_alerts;
CREATE POLICY "Users can delete own price alerts"
  ON public.price_alerts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Triggers for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_store_locations_timestamp ON public.store_locations;
CREATE TRIGGER update_store_locations_timestamp
  BEFORE UPDATE ON public.store_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_product_prices_timestamp ON public.product_prices;
CREATE TRIGGER update_product_prices_timestamp
  BEFORE UPDATE ON public.product_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_weekly_flyers_timestamp ON public.weekly_flyers;
CREATE TRIGGER update_weekly_flyers_timestamp
  BEFORE UPDATE ON public.weekly_flyers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_price_alerts_timestamp ON public.price_alerts;
CREATE TRIGGER update_price_alerts_timestamp
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to find prices near a location (using postal code or lat/lng)
DROP FUNCTION IF EXISTS find_prices_near_location(TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT);
CREATE OR REPLACE FUNCTION find_prices_near_location(
  search_postal_code TEXT DEFAULT NULL,
  search_lat DECIMAL DEFAULT NULL,
  search_lng DECIMAL DEFAULT NULL,
  search_radius_km DECIMAL DEFAULT 10,
  search_country TEXT DEFAULT 'CA'
)
RETURNS TABLE (
  price_id UUID,
  product_name TEXT,
  price DECIMAL,
  store_chain TEXT,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id as price_id,
    pp.product_name,
    pp.price,
    pp.store_chain,
    CASE 
      WHEN search_lat IS NOT NULL AND search_lng IS NOT NULL THEN
        -- Calculate distance using Haversine formula (approximate)
        6371 * acos(
          cos(radians(search_lat)) * 
          cos(radians(sl.latitude)) * 
          cos(radians(sl.longitude) - radians(search_lng)) + 
          sin(radians(search_lat)) * 
          sin(radians(sl.latitude))
        )
      ELSE 0
    END as distance_km
  FROM public.product_prices pp
  LEFT JOIN public.store_locations sl ON pp.store_location_id = sl.id
  WHERE pp.country = search_country
    AND (
      search_postal_code IS NULL 
      OR sl.postal_code LIKE search_postal_code || '%'
    )
    AND (
      search_lat IS NULL 
      OR search_lng IS NULL
      OR (
        6371 * acos(
          cos(radians(search_lat)) * 
          cos(radians(sl.latitude)) * 
          cos(radians(sl.longitude) - radians(search_lng)) + 
          sin(radians(search_lat)) * 
          sin(radians(sl.latitude))
        ) <= search_radius_km
      )
    )
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SUCCESS! Price Discovery tables are ready
-- ============================================

-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Deploy the PriceDiscoveryService to start scraping
-- 3. Integrate price display in your app

