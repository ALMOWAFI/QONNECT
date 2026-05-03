-- QONNECT DATABASE SCHEMA (Supabase/PostgreSQL)

-- 1. PROFILES
-- Handles both Admins and Customers
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. BRIDGES (The Identity Layer)
-- Maps the printed QR slug to the digital destination
CREATE TABLE bridges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  slug TEXT UNIQUE NOT NULL, -- e.g., 'ali-777'
  target_url TEXT, -- Where the hoodie points
  scan_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ORDERS (The Financial/Fulfillment Layer)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES profiles(id),
  bridge_id UUID REFERENCES bridges(id),
  stripe_session_id TEXT UNIQUE,
  shopify_order_id TEXT,
  edition TEXT NOT NULL, -- 'robotics', 'medicine', etc.
  tier TEXT NOT NULL, -- 'basic', 'standard', 'premium'
  status TEXT DEFAULT 'pending_payment' 
    CHECK (status IN ('pending_payment', 'intake_required', 'ready_to_print', 'printing', 'shipped', 'delivered')),
  print_asset_url TEXT, -- Link to S3/Storage high-res file
  shipping_address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ANALYTICS (Scan History)
CREATE TABLE scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  detected_browser TEXT,
  detected_os TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Simple Policy: Admins see everything, Customers see only their own data.
-- (Full implementation would require specific RLS policies)
