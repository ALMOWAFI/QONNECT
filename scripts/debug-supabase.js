import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listRealTables() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // This query bypasses the standard 'from()' wrapper to see what's actually there
  const { data, error } = await supabase.rpc('get_tables_info'); 

  // If RPC fails (likely), try a direct fetch on a table that definitely doesn't exist to see the error format
  const { error: error2 } = await supabase.from('definitely_real_table_check').select('*');
  console.log('Error for non-existent table:', error2?.message);

  const { data: data3, error: error3 } = await supabase.from('orders').select('*').limit(1);
  if (error3) {
    console.log('Error for "orders" table:', error3.message);
  } else {
    console.log('Successfully fetched from "orders":', data3);
  }
}

listRealTables();
