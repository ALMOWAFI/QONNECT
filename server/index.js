import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
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
  saveArtQrUrl,
  getArtQrUrl,
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
app.set('trust proxy', 1); // Trust Nginx reverse proxy for X-Forwarded-For
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const apiLimiter   = rateLimit({ windowMs: 60 * 1000, max: 60 });

app.use(express.static(path.join(__dirname, '../dist')));
// Persistent print assets — stored outside /dist so deploys don't wipe them
app.use('/print-assets', express.static(path.join(__dirname, '../print-assets')));

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
      brief:           item.brief || null,
    })),
    intake:          record.intake || null,
    printAssetUrl:   record.printAssetUrl || null,
    status,
    timeline,
    createdAt:       record.createdAt,
    updatedAt:       record.updatedAt,
  };
}

// Fire-and-forget email
async function sendOrderEmail(orderId, { emailTo, template, subject, sessionId }) {
  // Deduplicate: don't re-send the same email template for the same order
  const alreadySent = await hasEmailBeenSent(orderId, template);
  if (alreadySent) return;

  let providerId = null;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      let htmlContent = `<h1>Your QONNECT Order is Confirmed</h1><p>Order ID: ${sessionId.slice(-6).toUpperCase()}</p>`;
      
      if (template === 'intake-reminder') {
        const intakeUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/success?session_id=${sessionId}`;
        htmlContent += `<p>You successfully purchased a QONNECT garment. To initialize your digital bridge and move your item into production, please complete the configuration ritual:</p>
                        <a href="${intakeUrl}" style="display:inline-block;padding:12px 24px;background-color:#000;color:#fff;text-decoration:none;margin-top:20px;font-family:sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;">Configure Identity</a>`;
      }

      const { data, error } = await resend.emails.send({
        from: 'QONNECT <orders@qonnect.ai>', // Update this domain when fully verified in Resend
        to: emailTo,
        subject,
        html: htmlContent
      });

      if (error) {
        console.error('❌ Resend API Error:', error);
      } else {
        providerId = data?.id || 'resend_success';
        console.log(`✅ 📧 [${template}] sent to ${emailTo}`);
      }
    } catch (err) {
      console.error('❌ Failed to send email via Resend:', err.message);
    }
  } else {
    console.log(`📧 [Simulated Email: ${template}] → ${emailTo} (session: ${sessionId})`);
    console.log(`⚠️  Set RESEND_API_KEY to send real emails.`);
    providerId = 'simulated';
  }

  await logEmailSent(orderId, { emailTo, template, subject, providerId });
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
            ...(item.selectedOptions?.length
              ? { description: item.selectedOptions.map(o => `${o.name}: ${o.value}`).join(' / ') }
              : {}),
            images: item.product.node.images.edges
              .map(e => e.node.url)
              .filter(u => u?.startsWith('http')),
          },
          unit_amount: Math.round(parseFloat(item.price.amount) * 100),
        },
        quantity: item.quantity,
      })),
      mode:        'payment',
      success_url: `${req.headers.origin || process.env.PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.headers.origin || process.env.PUBLIC_URL}/?cart=open`,
    });

    // Respond immediately — never block checkout on a DB write
    res.json({ id: session.id, url: session.url });

    // Persist order record fire-and-forget (reconciled via webhook if this fails)
    const now = new Date().toISOString();
    saveOrderRecord({
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
        brief:           item.brief || null,
      })),
      contactEmail: null,
      intake:       null,
      status:       'pending_payment',
      paymentStatus:'unpaid',
    }).catch(err => console.error('❌ Order record save failed (non-fatal):', err.message));

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

        // Fire AI art QR generation async — does not block the response
        const tier = updatedRecord.items?.find(i => i.itemKey === entry.itemKey)?.tier
          || updatedRecord.items?.[0]?.tier
          || 'business';
        generateAndStoreArtQr(entry.slug, tier).catch(err =>
          console.error('AI QR background error:', err.message)
        );
      }
    }

    // Auto-composite print asset for every order with bridge mode entries
    // Fire-and-forget — does not block the intake response
    ;(async () => {
      try {
        const bridgeEntry = normalizedEntries.find(e => e.mode === 'bridge' && e.slug);
        if (!bridgeEntry) return; // direct-link orders have no slug to embed

        const { generateCompositeAsset } = await import('./compositor.js');
        const item      = updatedRecord.items?.[0] || {};
        const edition   = item.title || 'default';
        const assetPath = await generateCompositeAsset(sessionId, edition, bridgeEntry.slug);

        // Persist the path on the order row in Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('orders')
          .update({ print_asset_url: assetPath })
          .eq('stripe_session_id', sessionId);

        console.log(`🖨️  Print asset auto-generated for order ${sessionId}: ${assetPath}`);
      } catch (err) {
        console.error('❌ Auto-compositor error (non-fatal):', err.message);
      }
    })();

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
    } else if (result.destination === '#pending-build') {
      // Premium tier — page is still being built. Return a holding template.
      res.json({
        type: 'template',
        template: {
          type:    'pending-build',
          slug,
          message: 'This page is being crafted by our architects. Check back in 48 hours.',
        },
      });
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
// QR CODE GENERATION — on-demand, always points to qonnect.ai/b/:slug
// ---------------------------------------------------------------------------

const QR_BASE_URL = process.env.PUBLIC_URL || 'https://qonnect.ai';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H',   // High — survives hoodie wear/crease
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
};

// GET /api/qr/:slug.png  — PNG buffer (for downloading / embedding in img tags)
app.get('/api/qr/:slug.png', async (req, res) => {
  const slug  = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const size  = Math.min(parseInt(req.query.size) || 512, 2048);
  const dark  = req.query.dark === '1';

  if (!slug) return res.status(400).json({ error: 'Invalid slug.' });

  try {
    const url    = `${QR_BASE_URL}/b/${slug}`;
    const buffer = await QRCode.toBuffer(url, {
      ...QR_OPTIONS,
      width: size,
      color: dark
        ? { dark: '#ffffff', light: '#000000' }
        : QR_OPTIONS.color,
    });

    res.set({
      'Content-Type':        'image/png',
      'Cache-Control':       'public, max-age=86400',
      'Content-Disposition': `inline; filename="qonnect-${slug}.png"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error('❌ QR PNG error:', err.message);
    res.status(500).json({ error: 'QR generation failed.' });
  }
});

// GET /api/qr/:slug.svg  — SVG string (crisp at any size, ideal for print suppliers)
app.get('/api/qr/:slug.svg', async (req, res) => {
  const slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const dark = req.query.dark === '1';

  if (!slug) return res.status(400).json({ error: 'Invalid slug.' });

  try {
    const url = `${QR_BASE_URL}/b/${slug}`;
    const svg = await QRCode.toString(url, {
      type: 'svg',
      ...QR_OPTIONS,
      color: dark
        ? { dark: '#ffffff', light: '#000000' }
        : QR_OPTIONS.color,
    });

    res.set({
      'Content-Type':        'image/svg+xml',
      'Cache-Control':       'public, max-age=86400',
      'Content-Disposition': `attachment; filename="qonnect-${slug}.svg"`,
    });
    res.send(svg);
  } catch (err) {
    console.error('❌ QR SVG error:', err.message);
    res.status(500).json({ error: 'QR generation failed.' });
  }
});

// ---------------------------------------------------------------------------
// AI ART QR — tier-aware, generated via Replicate, stored on bridge row
// ---------------------------------------------------------------------------

const TIER_PROMPTS = {
  tech: {
    prompt:          'circuit board traces, neural network nodes, neon cyan glowing lines, deep blue dark background, cyberpunk, high detail, intricate, sharp focus, 8k',
    negative_prompt: 'text, letters, words, watermark, ugly, blurry, low quality, pixelated, deformed',
  },
  medical: {
    prompt:          'organic cell structure cross-section, bioluminescent blue-green glow, clean white background, DNA double helix, precision scientific illustration, soft light, minimal, elegant',
    negative_prompt: 'text, letters, ugly, blurry, low quality, dark, horror, scary, deformed',
  },
  business: {
    prompt:          'luxury black fabric with fine gold thread weave, premium textile close-up, gold silk embroidery on dark velvet, elegant, minimal, high fashion, studio lighting',
    negative_prompt: 'text, letters, ugly, blurry, low quality, colorful, bright, cartoon',
  },
};

// Fire-and-forget: generate AI art QR via Replicate and store result
async function generateAndStoreArtQr(slug, tier = 'business') {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log(`⚠️  REPLICATE_API_TOKEN not set — skipping AI QR for "${slug}"`);
    return;
  }

  const { prompt, negative_prompt } = TIER_PROMPTS[tier] || TIER_PROMPTS.business;
  const qrUrl = `${QR_BASE_URL}/b/${slug}`;

  console.log(`🎨 Generating AI QR for slug "${slug}" (tier: ${tier}) …`);

  try {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    // lucataco/illusion-diffusion-hq — latest version
    const output = await replicate.run('lucataco/illusion-diffusion-hq', {
      input: {
        prompt,
        negative_prompt,
        qr_code_content:              qrUrl,
        guidance_scale:               7.5,
        controlnet_conditioning_scale: 1.5,
        num_inference_steps:          40,
        width:                        768,
        height:                       768,
        qrcode_background:            'white',
        seed:                         Math.floor(Math.random() * 2147483647),
      },
    });

    // output is an array of file URLs from Replicate
    const resultUrl = Array.isArray(output) ? output[0] : output;
    if (!resultUrl) throw new Error('Replicate returned no output.');

    await saveArtQrUrl(slug, String(resultUrl));
    console.log(`✅ AI QR for "${slug}" stored: ${resultUrl}`);
  } catch (err) {
    console.error(`❌ AI QR generation failed for "${slug}":`, err.message);
  }
}

// GET /api/qr/:slug/art — returns { status, url } — used by Members dashboard to poll
app.get('/api/qr/:slug/art', apiLimiter, async (req, res) => {
  const slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return res.status(400).json({ error: 'Invalid slug.' });

  try {
    const url = await getArtQrUrl(slug);
    if (url) {
      res.json({ status: 'ready', url });
    } else if (!process.env.REPLICATE_API_TOKEN) {
      res.json({ status: 'unavailable' });
    } else {
      res.json({ status: 'pending' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch art QR status.' });
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

app.post('/api/admin/orders/:sessionId/generate-asset', adminLimiter, async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const record = await getOrderRecord(req.params.sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });

    const intake = record.intake;
    if (!intake?.entries?.length) {
      return res.status(400).json({ error: 'Intake not submitted yet — no slug to generate QR from.' });
    }

    const { generateCompositeAsset } = await import('./compositor.js');
    const item    = record.items?.[0] || {};
    const edition = item.title || 'default';
    const slug    = intake.entries[0]?.slug || intake.entries[0]?.targetUrl || 'unknown';

    const assetPath = await generateCompositeAsset(req.params.sessionId, edition, slug);

    // Persist the print asset URL on the order record
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('orders').update({ print_asset_url: assetPath }).eq('stripe_session_id', req.params.sessionId);

    res.json({ success: true, assetPath });
  } catch (err) {
    console.error('❌ generate-asset error:', err.message);
    res.status(500).json({ error: err.message || 'Compositor failed.' });
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

    // Step 1: find order IDs where customer_email matches (PostgREST can't
    // filter on joined tables inside .or(), so we do this as a separate query)
    const { data: userOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', user.email);

    const orderIds = (userOrders || []).map(o => o.id);

    // Step 2: fetch bridges by owner_id OR by order_id in the user's orders
    const orFilter = orderIds.length
      ? `owner_id.eq.${user.id},order_id.in.(${orderIds.join(',')})`
      : `owner_id.eq.${user.id}`;

    const { data: bridges, error } = await supabase
      .from('bridges')
      .select(`
        id, slug, target_url, destination_type, mode, template_data,
        is_active, scan_count, created_at, updated_at,
        orders!bridges_order_id_fk (
          stripe_session_id, status, payment_status, items, customer_email
        )
      `)
      .or(orFilter)
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
      options: { emailRedirectTo: `${req.headers.origin || process.env.PUBLIC_URL}/members` }
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
