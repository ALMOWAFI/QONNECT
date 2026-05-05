import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  SUPABASE credentials missing. DB calls will be no-ops.');
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// =============================================================================
// HELPERS
// =============================================================================

function mapDbRowToRecord(row) {
  return {
    sessionId:    row.stripe_session_id,
    items:        row.items || [],
    contactEmail: row.customer_email,
    intake:       row.intake_data,
    status:       row.status       || 'pending_payment',
    paymentStatus:row.payment_status || 'unpaid',
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    podProvider:  row.pod_provider  || null,
    podOrderId:   row.pod_order_id  || null,
    printAssetUrl:row.print_asset_url || null,
  };
}

export function computeStatusSummary(record) {
  const payment =
    record.paymentStatus === 'paid'    ? 'paid'    :
    record.paymentStatus === 'failed'  ? 'failed'  :
    record.paymentStatus === 'expired' ? 'expired' : 'pending';

  const intake = record.intake ? 'submitted' : 'pending';

  let production = 'awaiting_payment';
  if (payment !== 'paid') {
    production = 'awaiting_payment';
  } else if (!record.intake) {
    production = 'awaiting_intake';
  } else if (record.status === 'delivered') {
    production = 'fulfilled';
  } else if (record.status === 'shipped' || record.status === 'printing') {
    production = 'ready_for_supplier';
  } else if (record.status === 'on_hold') {
    production = 'on_hold';
  } else if (record.status === 'ready_to_print') {
    production = 'ready_for_supplier';
  } else {
    production = 'ready_for_qr';
  }

  let overall = 'draft';
  if (payment === 'failed')                                    overall = 'needs_attention';
  else if (production === 'on_hold')                           overall = 'needs_attention';
  else if (production === 'fulfilled')                         overall = 'fulfilled';
  else if (['ready_for_qr', 'ready_for_supplier'].includes(production)) overall = 'in_preparation';
  else if (production === 'awaiting_intake')                   overall = 'awaiting_intake';

  return { payment, intake, production, overall };
}

export function buildTimeline(record) {
  const events = [];

  if (record.createdAt) {
    events.push({
      type: 'order_created',
      label: 'Order initiated',
      description: 'Checkout session created. Awaiting payment confirmation from Stripe.',
      at: record.createdAt,
    });
  }

  if (record.paymentStatus === 'paid') {
    events.push({
      type: 'payment_confirmed',
      label: 'Payment confirmed',
      description: 'Stripe confirmed the charge. Order unlocked for fulfillment pipeline.',
      at: record.updatedAt || record.createdAt,
    });
  }

  if (record.intake?.submittedAt) {
    events.push({
      type: 'intake_submitted',
      label: 'Identity secured',
      description: 'Destination link and build brief attached to this garment. QR generation queued.',
      at: record.intake.submittedAt,
    });
  }

  if (record.status === 'ready_to_print' && record.intake?.updatedAt) {
    events.push({
      type: 'ready_for_supplier',
      label: 'Artwork composed',
      description: 'QR code generated and artwork composed. Handoff to print supplier imminent.',
      at: record.intake.updatedAt,
    });
  }

  if (record.status === 'shipped') {
    events.push({
      type: 'shipped',
      label: 'Order shipped',
      description: 'Garment dispatched by print supplier. Check your email for tracking details.',
      at: record.updatedAt || record.createdAt,
    });
  }

  if (record.status === 'delivered') {
    events.push({
      type: 'delivered',
      label: 'Delivered',
      description: 'Your QONNECT garment has been delivered. Scan the QR code to activate your bridge.',
      at: record.updatedAt || record.createdAt,
    });
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

function detectEdition(items = []) {
  const title = (items?.[0]?.title || '').toLowerCase();
  if (title.includes('robot') || title.includes('tech') || title.includes('engineer')) return 'tech';
  if (title.includes('med') || title.includes('health') || title.includes('clinic')) return 'medical';
  return 'business';
}

function parseUserAgent(ua = '') {
  const lower = ua.toLowerCase();

  let device_type = 'desktop';
  if (/mobile|android.*mobile|iphone|ipod/.test(lower)) device_type = 'mobile';
  else if (/tablet|ipad|android(?!.*mobile)/.test(lower)) device_type = 'tablet';

  let os = 'Unknown';
  if (/iphone|ipad|ipod/.test(lower)) os = 'iOS';
  else if (/android/.test(lower)) os = 'Android';
  else if (/windows/.test(lower)) os = 'Windows';
  else if (/macintosh|mac os x/.test(lower)) os = 'macOS';
  else if (/linux/.test(lower)) os = 'Linux';

  let browser = 'Unknown';
  if (/edg\//.test(lower)) browser = 'Edge';
  else if (/opr\/|opera/.test(lower)) browser = 'Opera';
  else if (/chrome\//.test(lower)) browser = 'Chrome';
  else if (/safari\//.test(lower) && !/chrome/.test(lower)) browser = 'Safari';
  else if (/firefox\//.test(lower)) browser = 'Firefox';

  return { device_type, os, browser };
}

function hashIp(ip = '') {
  return createHash('sha256').update(ip + (process.env.IP_SALT || 'qonnect')).digest('hex');
}

function extractReferrerDomain(referrer = '') {
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// =============================================================================
// DATABASE VERIFY
// =============================================================================

export async function verifyDatabase() {
  if (!supabase) return;
  console.log('🏛️  Verifying database schema...');
  const tables = ['profiles', 'bridges', 'orders', 'scans', 'order_emails', 'shipments'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error?.code === '42P01') {
      console.warn(`⚠️  Table "${table}" not found. Run migration_v2.sql.`);
    }
  }
}

// =============================================================================
// ORDERS
// =============================================================================

export async function getOrderRecord(sessionId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('stripe_session_id, items, customer_email, intake_data, status, payment_status, pod_provider, pod_order_id, print_asset_url, created_at, updated_at')
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !data) return null;
  return mapDbRowToRecord(data);
}

export async function saveOrderRecord(record) {
  if (!supabase) return record;

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', record.sessionId)
    .single();

  const dbRow = {
    stripe_session_id: record.sessionId,
    customer_email:    record.contactEmail,
    items:             record.items || [],
    intake_data:       record.intake,
    status:            record.status       || 'pending_payment',
    payment_status:    record.paymentStatus || 'unpaid',
    pod_provider:      record.podProvider  || null,
    pod_order_id:      record.podOrderId   || null,
    print_asset_url:   record.printAssetUrl || null,
    updated_at:        new Date().toISOString(),
  };

  let savedId = existing?.id;
  let error;

  if (existing) {
    const { error: e } = await supabase.from('orders').update(dbRow).eq('id', existing.id);
    error = e;
  } else {
    const { data: inserted, error: e } = await supabase
      .from('orders')
      .insert([{ ...dbRow, created_at: record.createdAt || new Date().toISOString() }])
      .select('id')
      .single();
    error = e;
    savedId = inserted?.id;
  }

  if (error) console.error('❌ Supabase saveOrderRecord:', error.message);
  return { ...record, _dbId: savedId };
}

// =============================================================================
// BRIDGES — normalized slug table
// =============================================================================

export async function writeBridge(entry, orderId) {
  if (!supabase) return;

  const row = {
    slug:             entry.slug,
    order_id:         orderId || null,
    target_url:       entry.targetUrl,
    destination_type: entry.destinationType || 'other',
    mode:             entry.mode || 'bridge',
    template_data:    entry.destinationType === 'custom-page' || entry.destinationType === 'linktree'
      ? { brief: entry.brief || '', edition: null, links: entry.links || [] }
      : null,
    is_active:        true,
  };

  const { error } = await supabase
    .from('bridges')
    .upsert(row, { onConflict: 'slug', ignoreDuplicates: false });

  if (error) console.error('❌ Supabase writeBridge:', error.message);
}

// Save full template data for a premium custom-page bridge
export async function updateBridgeTemplate(slug, { name, title, bio, edition, links }) {
  if (!supabase) return;
  const brief = [name, title, bio].filter(Boolean).join('\n');
  const { error } = await supabase
    .from('bridges')
    .update({
      destination_type: 'custom-page',
      target_url:       '#template',
      template_data:    { brief, edition, links: links || [], name, title, bio },
      updated_at:       new Date().toISOString(),
    })
    .eq('slug', slug);
  if (error) throw new Error(error.message);
}

// Store the AI-generated art QR URL back onto the bridge row
export async function saveArtQrUrl(slug, url) {
  if (!supabase) return;
  const { error } = await supabase
    .from('bridges')
    .update({ qr_art_url: url, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) console.error('❌ saveArtQrUrl:', error.message);
}

// Return the art QR URL for a slug (null if not yet generated)
export async function getArtQrUrl(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('bridges')
    .select('qr_art_url')
    .eq('slug', slug)
    .maybeSingle();
  return data?.qr_art_url || null;
}

export async function isSlugAvailable(slug, currentSessionId) {
  if (!supabase) return true;

  // Direct lookup on the indexed bridges.slug column — fast, no JSONB scan
  const { data, error } = await supabase
    .from('bridges')
    .select('order_id, orders!bridges_order_id_fk(stripe_session_id)')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return true;                               // not found → available

  // Taken by same session → allow update
  const owner = data.orders?.stripe_session_id;
  return owner === currentSessionId;
}

export async function findDestinationBySlug(slug) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('bridges')
    .select('slug, target_url, destination_type, mode, template_data, is_active, order_id, orders!bridges_order_id_fk(items, customer_email)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  if (data.destination_type === 'unclaimed') {
    return { type: 'claim', slug: data.slug };
  }

  if (data.destination_type === 'custom-page' || data.destination_type === 'linktree') {
    const items = data.orders?.items || [];
    return {
      type: 'template',
      slug:            data.slug,
      targetUrl:       data.target_url,
      brief:           data.template_data?.brief || '',
      links:           data.template_data?.links || [],
      destinationType: data.destination_type,
      edition:         data.template_data?.edition || detectEdition(items),
      contactEmail:    data.orders?.customer_email || null,
    };
  }

  return { type: 'redirect', destination: data.target_url };
}

// =============================================================================
// SCANS — analytics logging
// =============================================================================

export async function logScan(slug, req) {
  if (!supabase) return;

  // Look up bridge_id
  const { data: bridge } = await supabase
    .from('bridges')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!bridge) return;

  const ip  = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ua  = req.headers['user-agent'] || '';
  const ref = (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 500);

  const ipHash   = hashIp(ip);
  const { device_type, os, browser } = parseUserAgent(ua);
  const referrer_domain = extractReferrerDomain(ref);

  // Determine uniqueness: first scan from this ip_hash for this bridge in last 24h
  const { count } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('bridge_id', bridge.id)
    .eq('ip_hash', ipHash)
    .gte('scanned_at', new Date(Date.now() - 86_400_000).toISOString());

  const is_unique = count === 0;

  await supabase.from('scans').insert([{
    bridge_id:      bridge.id,
    slug,
    ip_hash:        ipHash,
    device_type,
    os,
    browser,
    referrer:       ref || null,
    referrer_domain: referrer_domain || null,
    is_unique,
    // city/country filled in server/index.js if geo lookup is configured
  }]);
}

// =============================================================================
// SCAN ANALYTICS — for member dashboard
// =============================================================================

export async function getScanSummary(slug) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('bridge_scan_summary')
    .select('*')
    .eq('slug', slug)
    .single();

  return data || null;
}

export async function getScanHistory(slug, days = 30) {
  if (!supabase) return [];

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from('scans')
    .select('scanned_at, device_type, country_code, referrer_domain, is_unique')
    .eq('slug', slug)
    .gte('scanned_at', since)
    .order('scanned_at', { ascending: false })
    .limit(500);

  return data || [];
}

// =============================================================================
// ORDER EMAILS — dedup + audit log
// =============================================================================

export async function hasEmailBeenSent(orderId, template) {
  if (!supabase) return false;

  const { count } = await supabase
    .from('order_emails')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('template', template);

  return (count || 0) > 0;
}

export async function logEmailSent(orderId, { emailTo, template, subject, providerId }) {
  if (!supabase) return;

  await supabase.from('order_emails').insert([{
    order_id:    orderId,
    email_to:    emailTo,
    template,
    subject:     subject || null,
    provider_id: providerId || null,
    status:      'sent',
  }]);
}

// =============================================================================
// ADMIN
// =============================================================================

export async function readOrders() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('stripe_session_id, items, customer_email, intake_data, status, payment_status, pod_provider, pod_order_id, print_asset_url, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) { console.error('❌ readOrders:', error.message); return []; }
  return data.map(mapDbRowToRecord);
}

export async function updateOrderStatus(sessionId, status) {
  if (!supabase) return;

  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_session_id', sessionId);

  if (error) console.error('❌ updateOrderStatus:', error.message);
}

export async function attachPodOrder(sessionId, { podProvider, podOrderId }) {
  if (!supabase) return;

  const { error } = await supabase
    .from('orders')
    .update({
      pod_provider: podProvider,
      pod_order_id: podOrderId,
      status:       'printing',
      updated_at:   new Date().toISOString(),
    })
    .eq('stripe_session_id', sessionId);

  if (error) console.error('❌ attachPodOrder:', error.message);
}

export async function upsertShipment(orderId, shipmentData) {
  if (!supabase) return;

  const { error } = await supabase
    .from('shipments')
    .upsert({
      order_id:          orderId,
      pod_provider:      shipmentData.podProvider,
      pod_shipment_id:   shipmentData.podShipmentId,
      carrier:           shipmentData.carrier,
      tracking_number:   shipmentData.trackingNumber,
      tracking_url:      shipmentData.trackingUrl,
      status:            shipmentData.status || 'in_transit',
      estimated_delivery:shipmentData.estimatedDelivery || null,
      shipped_at:        shipmentData.shippedAt || new Date().toISOString(),
    }, { onConflict: 'order_id' });

  if (error) console.error('❌ upsertShipment:', error.message);
}
