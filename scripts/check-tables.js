import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listTables() {
  console.log(`Checking schema for: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Query to list all tables in the public schema
  const { data, error } = await supabase
    .rpc('get_tables'); // This might fail if the RPC doesn't exist, so we try a direct query

  if (error) {
    // Fallback: Try to query common tables to see which ones fail
    const tableNames = ['profiles', 'orders', 'bridges', 'scans'];
    console.log('--- Table Status ---');
    
    for (const name of tableNames) {
      const { error: tableError } = await supabase.from(name).select('*', { count: 'exact', head: true }).limit(1);
      if (tableError) {
        console.log(`❌ ${name}: Missing or Access Denied (${tableError.message})`);
      } else {
        console.log(`✅ ${name}: Found`);
      }
    }
  } else {
    console.log('Found tables:', data);
  }
}

listTables();
