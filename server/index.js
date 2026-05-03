import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import {
  getOrderRecord,
  saveOrderRecord,
  isSlugAvailable,
  readOrders,
  findDestinationBySlug,
  computeStatusSummary,
  buildTimeline,
  writeBridge,
  logScan,
  getScanSummary,
  getScanHistory,
  hasEmailBeenSent,
  logEmailSent,
  upsertShipment,
  updateOrderStatus,
} from './orderStore.js';

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const REQUIRED_VARS = ['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_PASSWORD'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app    = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// SECURITY & MIDDLEWARE
// ---------------------------------------------------------------------------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const apiLimiter   = rateLimit({ windowMs: 60 * 1000, max: 60 });

app.use(express.static(path.join(__dirname, '../dist')));

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function buildOrderResponse(record) {
  const status   = computeStatusSummary(record);
  const timeline = buildTimeline(record);

  return {
    sessionId:     record.sessionId,
    shortOrderId:  record.sessionId.slice(-6).toUpperCase(),
    paymentStatus: record.paymentStatus,
    customerEmail: record.contactEmail,
    items: (record.items || []).map((item, i) => ({
      itemKey:         item.itemKey || `item-${i}`,
      title:           item.title,
      variantTitle:    item.variantTitle || '',
      quantity:        item.quantity || 1,
      price:           item.price || { amount: '0', currencyCode: 'USD' },
      imageUrl:        item.imageUrl || null,
      selectedOptions: item.selectedOptions || [],
      tier:            item.tier || 'basic',
    })),
    intake:        record.intake || null,
    status,
    timeline,
    createdAt:     record.createdAt,
    updatedAt:     record.updatedAt,
  };
}

// Fire-and-forget email (stub — wire to Resend/SendGrid when ready)
async function sendOrderEmail(orderId, { emailTo, template, subject, sessionId }) {
  // Deduplicate: don't re-send the same email template for the same order
  const alreadySent = await hasEmailBeenSent(orderId, template);
  if (alreadySent) return;

  // TODO: replace with actual email provider (Resend recommended for Supabase stacks)
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const { id } = await resend.emails.send({ from: 'QONNECT <orders@qonnect.ai>', to: emailTo, subject, ... });

  console.log(`📧 [${template}] → ${emailTo} (session: ${sessionId})`);
  await logEmailSent(orderId, { emailTo, template, subject, providerId: null });
}

// ---------------------------------------------------------------------------
// STRIPE WEBHOOK  (must be before express.json())
// ---------------------------------------------------------------------------
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig            = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET missing — skipping signature verification.');
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error(`❌ Webhook signature error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // -- Payment confirmed --
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const record  = await getOrderRecord(session.id);

    if (record) {
      const updated = {
        ...record,
        status:       'intake_required',
        paymentStatus:'paid',
        contactEmail: session.customer_details?.email || record.contactEmail,
        updatedAt:    new Date().toISOString(),
      };
      const saved = await saveOrderRecord(updated);
      console.log(`✅ Order ${session.id} marked PAID.`);

      // Trigger intake-request email (fire and forget)
      if (session.customer_details?.email) {
        sendOrderEmail(saved._dbId || session.id, {
          emailTo:   session.customer_details.email,
          template:  'intake-reminder',
          subject:   'Your QONNECT order is confirmed — one step left',
          sessionId: session.id,
        }).catch(console.error);
      }
    } else {
      console.warn(`⚠️  Webhook: order ${session.id} not found in DB.`);
    }
  }

  // -- Session expired without payment --
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const record  = await getOrderRecord(session.id);
    if (record) {
      await saveOrderRecord({ ...record, paymentStatus: 'expired', status: 'pending_payment' });
      console.log(`⌛ Order ${session.id} expired.`);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------
app.post('/api/create-checkout-session', apiLimiter, async (req, res) => {
  const { items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Cart is empty.' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: item.price.currencyCode.toLowerCase(),
          product_data: {
            name: item.product.node.title,
            description: item.selectedOptions.map(o => `${o.name}: ${o.value}`).join(' / '),
            images: item.product.node.images.edges
              .map(e => e.node.url)
              .filter(u => u?.startsWith('http')),
          },
          unit_amount: Math.round(parseFloat(item.price.amount) * 100),
        },
        quantity: item.quantity,
      })),
      mode:        'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.headers.origin}/?cart=open`,
    });

    const now = new Date().toISOString();
    await saveOrderRecord({
      sessionId:    session.id,
      createdAt:    now,
      updatedAt:    now,
      items: items.map((item, i) => ({
        itemKey:         item.itemKey || `${item.variantId}::${i}`,
        title:           item.product.node.title,
        variantTitle:    item.variantTitle || '',
        quantity:        item.quantity,
        price:           item.price,
        imageUrl:        item.product.node.images?.edges?.[0]?.node?.url || null,
        selectedOptions: item.selectedOptions || [],
        tier:            item.selectedOptions?.find(o => o.name === 'Service Tier')?.value?.toLowerCase() || 'basic',
      })),
      contactEmail: null,
      intake:       null,
      status:       'pending_payment',
      paymentStatus:'unpaid',
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('❌ Stripe Session Error:', err.message);
    res.status(500).json({ error: 'Payment service temporarily unavailable.' });
  }
});

// ---------------------------------------------------------------------------
// ORDER FETCH
// ---------------------------------------------------------------------------
app.get('/api/orders/:sessionId', apiLimiter, async (req, res) => {
  try {
    const record = await getOrderRecord(req.params.sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });
    res.json(buildOrderResponse(record));
  } catch (err) {
    console.error('❌ Order fetch:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---------------------------------------------------------------------------
// INTAKE
// ---------------------------------------------------------------------------
const intakeSchema = z.object({
  contactEmail: z.string().email(),
  entries: z.array(z.object({
    itemKey:         z.string(),
    mode:            z.enum(['direct', 'bridge']),
    targetUrl:       z.string().url(),
    slug:            z.string().optional().nullable(),
    destinationType: z.string().optional().default('other'),
    brief:           z.string().optional().nullable(),
  })),
});

app.post('/api/orders/:sessionId/intake', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const record = await getOrderRecord(sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });

    const validated = intakeSchema.parse(req.body);

    const normalizedEntries = [];
    for (const entry of validated.entries) {
      const slug = entry.mode === 'bridge'
        ? String(entry.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
        : null;

      if (entry.mode === 'bridge') {
        if (!slug) return res.status(400).json({ error: 'Bridge slug is required.' });
        const available = await isSlugAvailable(slug, sessionId);
        if (!available) return res.status(400).json({ error: `Slug '${slug}' is already taken.` });
      }

      normalizedEntries.push({ ...entry, slug });
    }

    const timestamp = new Date().toISOString();
    const updatedRecord = {
      ...record,
      contactEmail: validated.contactEmail,
      intake: {
        contactEmail: validated.contactEmail,
        entries:      normalizedEntries,
        submittedAt:  record.intake?.submittedAt || timestamp,
        updatedAt:    timestamp,
      },
      status:    'ready_to_print',
      updatedAt: timestamp,
    };

    const saved = await saveOrderRecord(updatedRecord);

    // Write each bridge entry to the normalized bridges table
    for (const entry of normalizedEntries) {
      if (entry.mode === 'bridge' && entry.slug) {
        await writeBridge(entry, saved._dbId || null);
      }
    }

    res.json(buildOrderResponse(updatedRecord));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data format.', details: err.errors });
    }
    console.error('❌ Intake error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// SLUG AVAILABILITY CHECK
// ---------------------------------------------------------------------------
app.get('/api/slugs/:slug/available', apiLimiter, async (req, res) => {
  const { slug } = req.params;
  const { sessionId } = req.query;

  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (clean.length < 3)  return res.json({ available: false, reason: 'Too short (min 3 chars).' });
  if (clean.length > 40) return res.json({ available: false, reason: 'Too long (max 40 chars).' });

  try {
    const available = await isSlugAvailable(clean, sessionId || null);
    res.json({ available, slug: clean });
  } catch {
    res.status(500).json({ error: 'Could not check slug availability.' });
  }
});

// ---------------------------------------------------------------------------
// SLUG RESOLUTION — Bridge page calls this
// ---------------------------------------------------------------------------
app.get('/api/resolve-slug/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await findDestinationBySlug(slug);

    if (!result) return res.status(404).json({ error: 'Identity not found.' });

    // Log the scan fire-and-forget — never block the redirect
    logScan(slug, req).catch(err => console.error('Scan log error:', err.message));

    if (result.type === 'template') {
      res.json({ type: 'template', template: result });
    } else {
      res.json({ type: 'redirect', destination: result.destination });
    }
  } catch (err) {
    console.error('❌ Slug resolve:', err.message);
    res.status(500).json({ error: 'Redirection failed.' });
  }
});

// ---------------------------------------------------------------------------
// ANALYTICS — member dashboard
// ---------------------------------------------------------------------------
app.get('/api/analytics/:slug/summary', apiLimiter, async (req, res) => {
  try {
    const summary = await getScanSummary(req.params.slug);
    if (!summary) return res.status(404).json({ error: 'No data found for this slug.' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

app.get('/api/analytics/:slug/history', apiLimiter, async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  try {
    const history = await getScanHistory(req.params.slug, days);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan history.' });
  }
});

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
app.get('/api/admin/orders', adminLimiter, async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  try {
    const orders = await readOrders();
    res.json(orders.map(buildOrderResponse));
  } catch {
    res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

app.patch('/api/admin/orders/:sessionId/status', adminLimiter, async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const { status } = req.body;
  const valid = ['ready_to_print', 'printing', 'shipped', 'delivered', 'on_hold', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  try {
    await updateOrderStatus(req.params.sessionId, status);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Status update failed.' });
  }
});

// ---------------------------------------------------------------------------
// MEMBERS API
// All routes here require a valid Supabase JWT in Authorization: Bearer <token>
// ---------------------------------------------------------------------------

async function requireAuth(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) { res.status(401).json({ error: 'Unauthorized.' }); return null; }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) { res.status(401).json({ error: 'Invalid or expired session.' }); return null; }
  return user;
}

// GET /api/members/bridges — all bridges for the logged-in user with analytics
app.get('/api/members/bridges', apiLimiter, async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Fetch bridges owned by this user OR linked to orders with their email
    const { data: bridges, error } = await supabase
      .from('bridges')
      .select(`
        id, slug, target_url, destination_type, mode, template_data,
        is_active, scan_count, created_at, updated_at,
        orders!bridges_order_id_fk (
          stripe_session_id, status, payment_status, items, customer_email
        )
      `)
      .or(`owner_id.eq.${user.id},orders.customer_email.eq.${user.email}`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich each bridge with analytics from the view
    const enriched = await Promise.all((bridges || []).map(async (bridge) => {
      const { data: analytics } = await supabase
        .from('bridge_scan_summary')
        .select('total_scans, unique_scans, scans_7d, scans_30d, last_scanned_at, top_country, top_device')
        .eq('slug', bridge.slug)
        .single();

      return {
        slug:            bridge.slug,
        targetUrl:       bridge.target_url,
        destinationType: bridge.destination_type,
        mode:            bridge.mode,
        isActive:        bridge.is_active,
        createdAt:       bridge.created_at,
        order: bridge.orders ? {
          sessionId:     bridge.orders.stripe_session_id,
          status:        bridge.orders.status,
          paymentStatus: bridge.orders.payment_status,
          items:         bridge.orders.items || [],
        } : null,
        analytics: analytics || {
          total_scans: bridge.scan_count || 0,
          unique_scans: 0,
          scans_7d: 0,
          scans_30d: 0,
          last_scanned_at: null,
          top_country: null,
          top_device: null,
        },
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('❌ Members bridges error:', err.message);
    res.status(500).json({ error: 'Could not load your bridges.' });
  }
});

// PATCH /api/members/bridges/:slug — update destination URL
app.patch('/api/members/bridges/:slug', apiLimiter, async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required.' });

  try {
    new URL(targetUrl); // validate URL
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify this bridge belongs to this user (via owner_id or order email)
    const { data: bridge } = await supabase
      .from('bridges')
      .select('id, owner_id, orders!bridges_order_id_fk(customer_email)')
      .eq('slug', req.params.slug)
      .single();

    if (!bridge) return res.status(404).json({ error: 'Bridge not found.' });

    const isOwner  = bridge.owner_id === user.id;
    const isCustomer = bridge.orders?.customer_email === user.email;
    if (!isOwner && !isCustomer) return res.status(403).json({ error: 'Not your bridge.' });

    const { error } = await supabase
      .from('bridges')
      .update({ target_url: targetUrl, updated_at: new Date().toISOString() })
      .eq('slug', req.params.slug);

    if (error) throw error;
    res.json({ success: true, slug: req.params.slug, targetUrl });
  } catch (err) {
    console.error('❌ Bridge update error:', err.message);
    res.status(500).json({ error: 'Could not update bridge.' });
  }
});

// Webhook from print-on-demand supplier (Printful / Gelato)
app.post('/api/pod-webhook', async (req, res) => {
  // TODO: Validate HMAC signature from POD provider
  const { event, order } = req.body;

  try {
    if (event === 'order_shipped' && order) {
      const dbOrder = await getOrderRecord(order.external_id); // external_id = stripe session id
      if (dbOrder) {
        await upsertShipment(dbOrder._dbId || order.external_id, {
          podProvider:     'printful',
          podShipmentId:   order.shipment_id,
          carrier:         order.carrier,
          trackingNumber:  order.tracking_number,
          trackingUrl:     order.tracking_url,
          status:          'in_transit',
          estimatedDelivery: order.estimated_delivery,
          shippedAt:       new Date().toISOString(),
        });
        await saveOrderRecord({ ...dbOrder, status: 'shipped' });
        console.log(`📦 Order ${order.external_id} shipped.`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('❌ POD webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// ---------------------------------------------------------------------------
// MAGIC LINK AUTH
// ---------------------------------------------------------------------------
app.post('/api/auth/claim-bridge', apiLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${req.headers.origin}/members` }
    });

    if (error) {
      console.error('❌ Magic link error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✅ Magic link sent to ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Auth fatal:', err.message);
    res.status(500).json({ error: 'Authentication service unavailable.' });
  }
});

// ---------------------------------------------------------------------------
// CATCH-ALL
// ---------------------------------------------------------------------------
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ---------------------------------------------------------------------------
// START
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  const { verifyDatabase } = await import('./orderStore.js');
  await verifyDatabase();
  console.log(`🚀 QONNECT server ready on port ${PORT}`);
});
