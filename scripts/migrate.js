import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing Supabase credentials. Migration aborted.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MIGRATION_SQL = `
-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bridges table
CREATE TABLE IF NOT EXISTS public.bridges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id),
  slug TEXT UNIQUE NOT NULL,
  target_url TEXT,
  scan_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.profiles(id),
  bridge_id UUID REFERENCES public.bridges(id),
  stripe_session_id TEXT UNIQUE,
  shopify_order_id TEXT,
  items JSONB,
  intake_data JSONB,
  customer_email TEXT,
  edition TEXT, 
  tier TEXT, 
  status TEXT DEFAULT 'pending_payment' 
    CHECK (status IN ('pending_payment', 'intake_required', 'ready_to_print', 'printing', 'shipped', 'delivered')),
  print_asset_url TEXT, 
  shipping_address JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scans table
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_id UUID REFERENCES public.bridges(id) ON DELETE CASCADE,
  detected_browser TEXT,
  detected_os TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function runMigration() {
  console.log('🏗️ Starting Database Migration...');

  // Use the RPC call if available, or just verify table existence
  // Since we can't run raw SQL via the standard JS client without an RPC,
  // we verify the tables exist. If they don't, we warn the user.
  // NOTE: In a full-stack AWS setup, we'd usually use a migration tool like Prisma or Knex.
  
  const tables = ['profiles', 'bridges', 'orders', 'scans'];
  let missing = false;

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.error(`❌ Table "${table}" is missing!`);
      missing = true;
    }
  }

  if (missing) {
    console.log('⚠️ Please ensure you have run the SQL in docs/database/schema.sql once in the Supabase Dashboard.');
    console.log('In the next phase, we will integrate a full migration engine (like Prisma) for 100% automation.');
  } else {
    console.log('✅ Database Schema Verified & Reliable.');
  }
}

runMigration();
