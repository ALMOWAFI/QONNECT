import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Checking orders table again...');
  const { data, error, status } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    console.log('Status Code:', status);
    console.log('Hint:', error.hint);
  } else {
    console.log('Success! Data:', data);
  }
}

checkSchema();
