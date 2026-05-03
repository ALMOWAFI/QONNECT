import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrderRecord, saveOrderRecord, isSlugAvailable, readOrders, findDestinationBySlug } from './orderStore.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.static(path.join(__dirname, '../dist')));

// Webhook endpoint needs raw body for signature verification
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

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { saveOrderRecord, getOrderRecord } = await import('./orderStore.js');
    
    const record = await getOrderRecord(session.id);
    if (record) {
      await saveOrderRecord({
        ...record,
        status: 'intake_required', // Payment is done, now we wait for user to give URL
        paymentStatus: 'paid',
        contactEmail: session.customer_details?.email || record.contactEmail
      });
      console.log(`Order ${session.id} marked as PAID.`);
    }
  }

  res.json({ received: true });
});

app.use(express.json()); // Put JSON back for subsequent routes

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
    paymentStatus: stripeSnapshot.paymentStatus,
    customerEmail: stripeSnapshot.customerEmail || record.contactEmail || null,
    items: record.items,
    intake: record.intake || null,
  };
}

app.post('/api/create-checkout-session', async (req, res) => {
  const { items } = req.body;

  try {
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
            images: item.product.node.images.edges.map((edge) => edge.node.url),
          },
          unit_amount: Math.round(parseFloat(item.price.amount) * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        item_count: String(items.reduce((sum, item) => sum + item.quantity, 0)),
        tiers: [...new Set(
          items.map(
            (item) =>
              item.selectedOptions.find((option) => option.name === 'Service Tier')?.value ||
              'basic'
          )
        )].join(','),
      },
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?cart=open`,
    });

    await saveOrderRecord({
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      items: summarizeItems(items),
      contactEmail: null,
      intake: null,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:sessionId', async (req, res) => {
  const summary = await buildOrderSummary(req.params.sessionId);

  if (!summary) {
    res.status(404).json({ error: 'Order not found for this checkout session.' });
    return;
  }

  res.json(summary);
});

app.post('/api/orders/:sessionId/intake', async (req, res) => {
  const { sessionId } = req.params;
  const { contactEmail, entries } = req.body;
  const record = await getOrderRecord(sessionId);

  if (!record) {
    res.status(404).json({ error: 'Order not found for this checkout session.' });
    return;
  }

  if (!contactEmail || !String(contactEmail).includes('@')) {
    res.status(400).json({ error: 'A valid contact email is required.' });
    return;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'At least one intake entry is required.' });
    return;
  }

  const normalizedEntries = [];
  for (const entry of entries) {
    const mode = entry.mode || 'direct';
    const slug = mode === 'bridge' ? String(entry.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : null;
    
    if (mode === 'bridge') {
      if (!slug) {
        res.status(400).json({ error: `A unique slug is required for the QONNECT Bridge on one of your items.` });
        return;
      }
      const available = await isSlugAvailable(slug, sessionId);
      if (!available) {
        res.status(400).json({ error: `The bridge slug '${slug}' is already claimed by another member of the tribe.` });
        return;
      }
    }

    const item = record.items.find((i) => i.itemKey === entry.itemKey);
    if (!item) {
      res.status(400).json({ error: `Invalid item reference in intake.` });
      return;
    }

    if (!validateUrl(entry.targetUrl)) {
      res.status(400).json({ error: `Invalid destination URL for ${item.title}.` });
      return;
    }

    if (item.tier !== 'basic' && (!entry.brief || entry.brief.length < 20)) {
      res.status(400).json({
        error: `${item.title} requires a more complete build brief for the selected tier.`,
      });
      return;
    }

    normalizedEntries.push({
      itemKey: entry.itemKey,
      mode,
      targetUrl: String(entry.targetUrl || '').trim(),
      destinationType: String(entry.destinationType || 'other').trim(),
      brief: String(entry.brief || '').trim(),
      slug: slug,
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

// Admin API
app.get('/api/admin/orders', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const clientPassword = req.headers['x-admin-password'];

  if (adminPassword && clientPassword !== adminPassword) {
    res.status(401).json({ error: 'Unauthorized access to the Command Center.' });
    return;
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
    if (destination) {
      res.json({ destination });
    } else {
      res.status(404).json({ error: 'Bridge not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
