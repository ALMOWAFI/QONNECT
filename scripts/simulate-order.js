import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function simulateOrder() {
  console.log(`🚀 Simulating test order for: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const testSessionId = `test_session_${Math.floor(Math.random() * 10000)}`;
  
  const testOrder = {
    stripe_session_id: testSessionId,
    customer_email: "test-tribe-member@qonnect.ai",
    edition: "Robotics",
    tier: "Premium",
    status: "intake_required",
    items: [
      {
        title: "QONNECT Hoodie: Robotics Edition",
        variantTitle: "Large / Black",
        quantity: 1,
        price: { amount: "150.00", currencyCode: "USD" },
        tier: "premium"
      }
    ],
    intake_data: null, // User hasn't finished ritual yet
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([testOrder])
      .select();

    if (error) {
      console.error('❌ Simulation Failed:', error.message);
      return;
    }

    console.log('✅ SUCCESS! Test order inserted.');
    console.log('--- TEST DATA ---');
    console.log(`Order ID (Session): ${testSessionId}`);
    console.log(`Email: ${testOrder.customer_email}`);
    console.log('-----------------');
    console.log('Check your Supabase dashboard now. You should see 1 row in the "orders" table.');
  } catch (err) {
    console.error('Simulation Error:', err.message);
  }
}

simulateOrder();
