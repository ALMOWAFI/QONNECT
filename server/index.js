import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrderRecord, saveOrderRecord } from './orderStore.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

  const normalizedEntries = entries.map((entry) => ({
    itemKey: entry.itemKey,
    targetUrl: String(entry.targetUrl || '').trim(),
    destinationType: String(entry.destinationType || 'other').trim(),
    brief: String(entry.brief || '').trim(),
  }));

  for (const item of record.items) {
    const entry = normalizedEntries.find((candidate) => candidate.itemKey === item.itemKey);

    if (!entry) {
      res.status(400).json({ error: `Missing intake details for ${item.title}.` });
      return;
    }

    if (!validateUrl(entry.targetUrl)) {
      res.status(400).json({ error: `Invalid destination URL for ${item.title}.` });
      return;
    }

    if (item.tier !== 'basic' && entry.brief.length < 20) {
      res.status(400).json({
        error: `${item.title} requires a more complete build brief for the selected tier.`,
      });
      return;
    }
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
