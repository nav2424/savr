-- Create scanned_products table for barcode scanning cache
CREATE TABLE IF NOT EXISTS scanned_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode TEXT UNIQUE NOT NULL,
  product_data JSONB NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on barcode for fast lookups
CREATE INDEX IF NOT EXISTS idx_scanned_products_barcode ON scanned_products(barcode);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_scanned_products_category ON scanned_products(category);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_scanned_products_name ON scanned_products(name);

-- Enable RLS (Row Level Security)
ALTER TABLE scanned_products ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (products are community-shared)
CREATE POLICY "Anyone can read scanned products"
  ON scanned_products
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert new products
CREATE POLICY "Authenticated users can insert scanned products"
  ON scanned_products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update products
CREATE POLICY "Authenticated users can update scanned products"
  ON scanned_products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scanned_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scanned_products_timestamp
  BEFORE UPDATE ON scanned_products
  FOR EACH ROW
  EXECUTE FUNCTION update_scanned_products_updated_at();

-- Create user_scanned_history table to track user's scanning activity
CREATE TABLE IF NOT EXISTS user_scanned_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_to_pantry BOOLEAN DEFAULT false
);

-- Create index on user_id for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_scanned_history_user_id ON user_scanned_history(user_id);

-- Create index on scanned_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_scanned_history_scanned_at ON user_scanned_history(scanned_at DESC);

-- Enable RLS
ALTER TABLE user_scanned_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own scan history
CREATE POLICY "Users can read their own scan history"
  ON user_scanned_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own scan history
CREATE POLICY "Users can insert their own scan history"
  ON user_scanned_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own scan history
CREATE POLICY "Users can update their own scan history"
  ON user_scanned_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own scan history
CREATE POLICY "Users can delete their own scan history"
  ON user_scanned_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

