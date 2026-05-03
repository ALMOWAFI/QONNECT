import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSupabase() {
  console.log(`Testing Supabase connection for: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Attempt to read from the orders table (even if empty)
    const { data, error } = await supabase
      .from('orders')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        console.error('Error: The "orders" table does not exist yet. Please run the SQL from docs/database/schema.sql in your Supabase SQL Editor.');
      } else {
        console.error('Supabase Error:', error.message);
      }
      return;
    }

    console.log('SUCCESS! Successfully connected to Supabase.');
    console.log('Current order count:', data?.length || 0);
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testSupabase();
