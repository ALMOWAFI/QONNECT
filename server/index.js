import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrderRecord, saveOrderRecord, isSlugAvailable, readOrders, findDestinationBySlug } from './orderStore.js';

// Explicitly load .env from the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Webhook endpoint needs raw body for signature verification
// This MUST be before any other middleware that parses the body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
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
      console.log(`Order ${session.id} marked as PAID.`);
    }
  }
  res.json({ received: true });
});

// Regular middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

function buildShortOrderId(sessionId) {
  return sessionId.slice(-6).toUpperCase();
}

function summarizeItems(items = []) {
  return items.map((item, index) => {
    const selectedOptions = item.selectedOptions || [];
    const tier =
      selectedOptions.find((option) => option.name === 'Service Tier')?.value || 'basic';

    return {
      itemKey: item.itemKey || `${item.variantId}::${index}`,
      title: item.product.node.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.product.node.images?.edges?.[0]?.node?.url || null,
      selectedOptions,
      tier,
    };
  });
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadStripeSessionSnapshot(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      paymentStatus: session.payment_status || null,
      customerEmail:
        session.customer_details?.email || session.customer_email || null,
    };
  } catch (error) {
    console.error(`Failed to retrieve Stripe session ${sessionId}:`, error);
    return {
      paymentStatus: null,
      customerEmail: null,
    };
  }
}

async function buildOrderSummary(sessionId) {
  const record = await getOrderRecord(sessionId);
  if (!record) return null;

  const stripeSnapshot = await loadStripeSessionSnapshot(sessionId);

  return {
    sessionId: record.sessionId,
    shortOrderId: buildShortOrderId(record.sessionId),
    paymentStatus: stripeSnapshot.paymentStatus || record.paymentStatus,
    status: record.status || (stripeSnapshot.paymentStatus === 'paid' ? 'intake_required' : 'pending_payment'),
    customerEmail: stripeSnapshot.customerEmail || record.contactEmail || null,
    items: record.items,
    intake: record.intake || null,
  };
}

app.post('/api/create-checkout-session', async (req, res) => {
  const { items } = req.body;
  console.log(`🛒 Creating Checkout for ${items?.length} items...`);

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is missing. Check your environment variables.");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item) => ({
        price_data: {
          currency: item.price.currencyCode.toLowerCase(),
          product_data: {
            name: item.product.node.title,
            description: item.selectedOptions
              .map((option) => `${option.name}: ${option.value}`)
              .join(' / '),
            images: item.product.node.images.edges
              .map((edge) => edge.node.url)
              .filter(url => url && (url.startsWith('http') || url.startsWith('//'))),
          },
          unit_amount: Math.round(parseFloat(item.price.amount) * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        item_count: String(items.reduce((sum, item) => sum + item.quantity, 0)),
      },
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?cart=open`,
    });

    // Save order record immediately as "Pending"
    await saveOrderRecord({
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      items: summarizeItems(items),
      contactEmail: null,
      intake: null,
    });

    console.log(`✅ Stripe Session Created: ${session.id}`);
    res.json({ id: session.id });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:sessionId', async (req, res) => {
  const summary = await buildOrderSummary(req.params.sessionId);
  if (!summary) return res.status(404).json({ error: 'Order not found' });
  res.json(summary);
});

app.post('/api/orders/:sessionId/intake', async (req, res) => {
  const { sessionId } = req.params;
  const { contactEmail, entries } = req.body;
  const record = await getOrderRecord(sessionId);

  if (!record) return res.status(404).json({ error: 'Order not found' });

  // Simple validation
  const normalizedEntries = [];
  for (const entry of entries) {
    const mode = entry.mode || 'direct';
    const slug = mode === 'bridge' ? String(entry.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : null;
    
    if (mode === 'bridge' && !slug) {
      return res.status(400).json({ error: 'Bridge slug is required.' });
    }

    if (slug) {
      const available = await isSlugAvailable(slug, sessionId);
      if (!available) return res.status(400).json({ error: `Slug '${slug}' is taken.` });
    }

    normalizedEntries.push({
      ...entry,
      mode,
      slug,
      targetUrl: String(entry.targetUrl || '').trim(),
    });
  }

  const timestamp = new Date().toISOString();
  await saveOrderRecord({
    ...record,
    contactEmail,
    intake: {
      contactEmail,
      entries: normalizedEntries,
      submittedAt: record.intake?.submittedAt || timestamp,
      updatedAt: timestamp,
    },
  });

  const summary = await buildOrderSummary(sessionId);
  res.json(summary);
});

app.get('/api/admin/orders', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const clientPassword = req.headers['x-admin-password'];
  if (adminPassword && clientPassword !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/resolve-slug/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const destination = await findDestinationBySlug(slug);
    if (destination) res.json({ destination });
    else res.status(404).json({ error: 'Not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/claim-bridge', async (req, res) => {
  const { email } = req.body;
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${req.headers.origin}/admin` } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  const { verifyDatabase } = await import('./orderStore.js');
  await verifyDatabase();
  console.log(`🚀 QONNECT Engine live on port ${PORT}`);
});
