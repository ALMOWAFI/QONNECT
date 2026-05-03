import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { getOrderRecord, saveOrderRecord, isSlugAvailable, readOrders, findDestinationBySlug } from './orderStore.js';

// --- INITIALIZATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// --- ENVIRONMENT GUARD ---
const REQUIRED_VARS = [
  'STRIPE_SECRET_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_PASSWORD'
];

const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing Environment Variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// --- SECURITY & MIDDLEWARE ---
app.use(helmet({ contentSecurityPolicy: false })); // Basic secure headers
app.use(cors()); // Enable CORS

// Rate Limiting to prevent brute-force on the Admin Dashboard
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many login attempts. Please try again later.' }
});

// Serving built frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// --- STRIPE WEBHOOK (RAW BODY) ---
// This must stay before app.use(express.json())
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET is missing. Webhook verification skipped.');
  }

  let event;
  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for testing without a secret
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const record = await getOrderRecord(session.id);
    if (record) {
      await saveOrderRecord({
        ...record,
        status: 'intake_required',
        paymentStatus: 'paid',
        contactEmail: session.customer_details?.email || record.contactEmail
      });
      console.log(`✅ Order ${session.id} marked as PAID.`);
    }
  }
  res.json({ received: true });
});

// JSON Body Parser for all other routes
app.use(express.json());

// --- CORE API ---

app.post('/api/create-checkout-session', async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty.' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item) => ({
        price_data: {
          currency: item.price.currencyCode.toLowerCase(),
          product_data: {
            name: item.product.node.title,
            description: item.selectedOptions.map(o => `${o.name}: ${o.value}`).join(' / '),
            images: item.product.node.images.edges
              .map((edge) => edge.node.url)
              .filter(url => url && (url.startsWith('http') || url.startsWith('//'))),
          },
          unit_amount: Math.round(parseFloat(item.price.amount) * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?cart=open`,
    });

    await saveOrderRecord({
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      items: items.map((item, i) => ({
        itemKey: item.itemKey || `${item.variantId}::${i}`,
        title: item.product.node.title,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        price: item.price,
        tier: item.selectedOptions.find(o => o.name === 'Service Tier')?.value || 'basic'
      })),
      contactEmail: null,
      intake: null,
      status: 'pending_payment',
      paymentStatus: 'unpaid'
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('❌ Stripe Session Error:', error.message);
    res.status(500).json({ error: 'Payment service temporarily unavailable.' });
  }
});

app.get('/api/orders/:sessionId', async (req, res) => {
  try {
    const record = await getOrderRecord(req.params.sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });
    
    res.json({
      ...record,
      shortOrderId: record.sessionId.slice(-6).toUpperCase()
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- INTAKE RITUAL VALIDATION (ZOD) ---
const intakeSchema = z.object({
  contactEmail: z.string().email(),
  entries: z.array(z.object({
    itemKey: z.string(),
    mode: z.enum(['direct', 'bridge']),
    targetUrl: z.string().url(),
    slug: z.string().optional().nullable(),
    brief: z.string().optional().nullable()
  }))
});

app.post('/api/orders/:sessionId/intake', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const record = await getOrderRecord(sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });

    // Validate request body
    const validated = intakeSchema.parse(req.body);

    const normalizedEntries = [];
    for (const entry of validated.entries) {
      const slug = entry.mode === 'bridge' ? String(entry.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : null;
      
      if (entry.mode === 'bridge') {
        if (!slug) return res.status(400).json({ error: 'Bridge slug is required for Option 02.' });
        const available = await isSlugAvailable(slug, sessionId);
        if (!available) return res.status(400).json({ error: `Slug '${slug}' is taken.` });
      }

      normalizedEntries.push({ ...entry, slug });
    }

    const timestamp = new Date().toISOString();
    await saveOrderRecord({
      ...record,
      contactEmail: validated.contactEmail,
      intake: {
        contactEmail: validated.contactEmail,
        entries: normalizedEntries,
        submittedAt: record.intake?.submittedAt || timestamp,
        updatedAt: timestamp,
      },
      status: 'ready_to_print' // Now it is ready for the supplier!
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data format.' });
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN API ---
app.get('/api/admin/orders', adminLimiter, async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const clientPassword = req.headers['x-admin-password'];

  if (adminPassword && clientPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

app.get('/api/resolve-slug/:slug', async (req, res) => {
  try {
    const destination = await findDestinationBySlug(req.params.slug);
    if (destination) res.json({ destination });
    else res.status(404).json({ error: 'Identity not found.' });
  } catch (error) {
    res.status(500).json({ error: 'Redirection failed.' });
  }
});

app.post('/api/auth/claim-bridge', async (req, res) => {
  const { email } = req.body;
  const { createClient } = await import('@supabase/supabase-js');
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Supabase credentials missing in server/index.js');
    return res.status(500).json({ error: 'Server misconfigured: Missing Supabase keys.' });
  }

  const supabase = createClient(url, key);

  try {
    console.log(`📡 Triggering Magic Link for: ${email}`);
    const { error } = await supabase.auth.signInWithOtp({ 
      email, 
      options: { 
        emailRedirectTo: `${req.headers.origin}/members` 
      } 
    });

    if (error) {
      console.error('❌ Supabase Auth Error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`✅ Magic Link sent successfully to: ${email}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Fatal Server Auth Error:', error.message);
    res.status(500).json({ error: 'Authentication service unavailable.' });
  }
});

// --- CATCH-ALL ---
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- START ENGINE ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  const { verifyDatabase } = await import('./orderStore.js');
  await verifyDatabase();
  console.log(`🚀 QONNECT Backend Hardened. Ready on port ${PORT}`);
});
