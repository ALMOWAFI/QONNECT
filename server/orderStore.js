import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to local data (Not recommended for production).');
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function verifyDatabase() {
  if (!supabase) return;
  console.log('🏛️ Verifying Database integrity...');
  const tables = ['profiles', 'bridges', 'orders', 'scans'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.warn(`⚠️ Warning: Table "${table}" not found. Ensure SQL schema is applied.`);
    }
  }
}

export async function getOrderRecord(sessionId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*, bridges(*)')
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !data) return null;

  // Map database structure back to the app's expected JSON structure
  return {
    sessionId: data.stripe_session_id,
    items: data.items, // Assuming items are stored in a JSONB column or similar
    contactEmail: data.customer_email,
    intake: data.intake_data, // Using a JSONB column for the intake blob
  };
}

export async function saveOrderRecord(record) {
  if (!supabase) return record;

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', record.sessionId)
    .single();

  const dbRecord = {
    stripe_session_id: record.sessionId,
    customer_email: record.contactEmail,
    items: record.items,
    intake_data: record.intake,
    status: record.status || 'pending_payment',
    payment_status: record.paymentStatus || 'unpaid',
    updated_at: new Date().toISOString(),
  };

  let error;
  if (existing) {
    const { error: updateError } = await supabase
      .from('orders')
      .update(dbRecord)
      .eq('id', existing.id);
    error = updateError;
  } else {
    const { error: insertError } = await supabase
      .from('orders')
      .insert([{ ...dbRecord, created_at: record.createdAt || new Date().toISOString() }]);
    error = insertError;
  }

  if (error) console.error('Supabase Save Error:', error);
  return record;
}

export async function readOrders() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase Read Error:', error);
    return [];
  }

  return data.map(d => ({
    sessionId: d.stripe_session_id,
    items: d.items,
    contactEmail: d.customer_email,
    intake: d.intake_data,
    createdAt: d.created_at
  }));
}

export async function isSlugAvailable(slug, currentSessionId) {
  if (!supabase) return true;

  // Search through the intake_data JSONB for the slug
  const { data, error } = await supabase
    .from('orders')
    .select('stripe_session_id')
    .contains('intake_data', { entries: [{ slug }] });

  if (error) return true;
  
  // If slug found in another session, it's taken
  const takenByOther = data.some(d => d.stripe_session_id !== currentSessionId);
  return !takenByOther;
}

export async function findDestinationBySlug(slug) {
  if (!supabase) return null;

  // Search through the intake_data JSONB for the slug
  const { data, error } = await supabase
    .from('orders')
    .select('intake_data')
    .contains('intake_data', { entries: [{ slug }] })
    .single();

  if (error || !data) return null;

  const entry = data.intake_data?.entries?.find(e => e.slug === slug);
  return entry?.targetUrl || null;
}
