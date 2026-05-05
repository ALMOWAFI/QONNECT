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
app.set('trust proxy', 1); // Trust Nginx reverse proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

const adminLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 100,
  validate: { xForwardedForHeader: false } // Disable the warning that's filling the logs
});
const apiLimiter   = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 60,
  validate: { xForwardedForHeader: false }
});

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

// ---------------------------------------------------------------------------
// EMAIL TEMPLATES
// ---------------------------------------------------------------------------
function buildEmailHtml({ title, body, ctaText, ctaUrl, orderId, footerNote }) {
  const base = process.env.PUBLIC_URL || 'https://qonnect.work';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:0 0 32px 0;border-bottom:1px solid #222;">
          <p style="margin:0;font-family:sans-serif;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#666;">QONNECT</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 0;">
          <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:300;color:#f0ece0;letter-spacing:-0.02em;line-height:1.3;">${title}</h1>
          ${orderId ? `<p style="margin:0 0 28px 0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#555;">Order #${orderId}</p>` : ''}
          <div style="font-size:14px;line-height:1.7;color:#888;font-family:Georgia,serif;">${body}</div>
          ${ctaText && ctaUrl ? `
          <table cellpadding="0" cellspacing="0" style="margin-top:32px;">
            <tr><td>
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background:#f0ece0;color:#0a0a0a;text-decoration:none;font-family:sans-serif;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">${ctaText}</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0 0 0;border-top:1px solid #1a1a1a;">
          ${footerNote ? `<p style="margin:0 0 12px 0;font-size:11px;color:#444;font-family:Georgia,serif;font-style:italic;">${footerNote}</p>` : ''}
          <p style="margin:0;font-size:10px;color:#333;letter-spacing:0.2em;">
            <a href="${base}" style="color:#555;text-decoration:none;">qonnect.work</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getEmailTemplate(template, { sessionId, trackingUrl, trackingNumber, carrier }) {
  const base     = process.env.PUBLIC_URL || 'https://qonnect.work';
  const orderId  = sessionId?.slice(-6).toUpperCase();
  const intakeUrl = `${base}/success?session_id=${sessionId}`;

  const templates = {
    'intake-reminder': {
      subject: 'Your QONNECT order is confirmed — one step left',
      html: buildEmailHtml({
        title: 'Order confirmed. One step to go.',
        orderId,
        body: `<p>Your garment is reserved. Before it enters production, you need to configure your digital identity — the URL your QR code will unlock.</p>
               <p>This takes 2 minutes. Once complete, your hoodie moves to the print queue.</p>`,
        ctaText: 'Configure Identity',
        ctaUrl: intakeUrl,
        footerNote: 'If you did not place this order, you can safely ignore this email.',
      }),
    },
    'shipped': {
      subject: 'Your QONNECT order has shipped',
      html: buildEmailHtml({
        title: 'Your hoodie is on its way.',
        orderId,
        body: `<p>Your QONNECT garment has left the atelier and is in transit.</p>
               ${carrier ? `<p style="margin-top:16px;"><strong style="color:#f0ece0;">Carrier:</strong> ${carrier}</p>` : ''}
               ${trackingNumber ? `<p><strong style="color:#f0ece0;">Tracking:</strong> ${trackingNumber}</p>` : ''}`,
        ctaText: trackingUrl ? 'Track Shipment' : null,
        ctaUrl: trackingUrl || null,
        footerNote: 'Once it arrives, scan the QR code on the garment to activate your bridge.',
      }),
    },
    'page-live': {
      subject: 'Your QONNECT page is live',
      html: buildEmailHtml({
        title: 'Your identity page is live.',
        orderId,
        body: `<p>Our architects have finished building your custom page. Scan the QR on your hoodie — it now resolves to your live identity.</p>
               <p>You can update your destination URL at any time from your dashboard.</p>`,
        ctaText: 'View Dashboard',
        ctaUrl: `${base}/members`,
        footerNote: null,
      }),
    },
  };

  return templates[template] || templates['intake-reminder'];
}

// Fire-and-forget email
async function sendOrderEmail(orderId, { emailTo, template, subject, sessionId, trackingUrl, trackingNumber, carrier }) {
  const alreadySent = await hasEmailBeenSent(orderId, template);
  if (alreadySent) return;

  let providerId = null;
  const { subject: tplSubject, html } = getEmailTemplate(template, { sessionId, trackingUrl, trackingNumber, carrier });
  const finalSubject = subject || tplSubject;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Resend requires verified domains. Fallback to onboarding@resend.dev for testing.
      const fromDomain = process.env.RESEND_DOMAIN || 'onboarding@resend.dev';
      const fromEmail = fromDomain.includes('@') ? fromDomain : `QONNECT <orders@${fromDomain}>`;

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: emailTo,
        subject: finalSubject,
        html,
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
    console.log(`📧 [Simulated: ${template}] → ${emailTo} (no RESEND_API_KEY set)`);
    providerId = 'simulated';
  }

  await logEmailSent(orderId, { emailTo, template, subject: finalSubject, providerId });
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
    targetUrl:       z.string().url().optional().or(z.literal('')),
    slug:            z.string().optional().nullable(),
    destinationType: z.string().optional().default('other'),
    brief:           z.string().optional().nullable(),
    links:           z.array(z.object({
      title: z.string(),
      url:   z.string().url()
    })).optional(),
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
        const { error: dbError } = await supabase
          .from('orders')
          .update({ print_asset_url: assetPath })
          .eq('stripe_session_id', sessionId);
        if (dbError) console.error('❌ Failed to save print_asset_url to DB:', dbError.message);

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

// Monster Labs ControlNet — prompts tuned per edition for maximum visual impact.
// The model embeds the QR pattern into a photorealistic scene.
// controlnet_conditioning_scale: 1.9 = good scan reliability + strong artistic blend.
const EDITION_PROMPTS = {
  tech: {
    prompt:          'cyberpunk tokyo alley at night, neon signs reflecting on wet asphalt, electric blue and violet light, rain, cinematic, ultra photorealistic, 8k',
    negative_prompt: 'text, letters, words, watermark, ugly, blurry, low quality, deformed, cartoon, anime, painting',
  },
  medical: {
    prompt:          'bioluminescent deep ocean scene, glowing blue jellyfish, ethereal underwater light shafts, dark water, photorealistic, 8k, ultra detailed, serene',
    negative_prompt: 'text, letters, words, watermark, ugly, blurry, low quality, deformed, horror, dark, gory',
  },
  business: {
    prompt:          'luxury art deco marble corridor, gold leaf ceiling, dramatic shadow geometry, warm amber light, editorial fashion location, 8k, cinematic, architectural photography',
    negative_prompt: 'text, letters, words, watermark, ugly, blurry, low quality, deformed, cartoon, colorful, neon',
  },
};

// Verification helper for AI QR Codes
async function verifyQrCode(imageUrl, expectedUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const jsQR = (await import('jsqr')).default;
    const clampedArray = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
    const code = jsQR(clampedArray, info.width, info.height);
    
    if (code) {
      console.log(`✅ Scan verification passed. Decoded: ${code.data}`);
      return true;
    }
    console.log('❌ Scan verification failed: QR could not be found or read.');
    return false;
  } catch (err) {
    console.error('❌ Error verifying QR:', err.message);
    return false;
  }
}

// Fire-and-forget: generate AI art QR via Monster Labs ControlNet (andreasjansson/qrcode on Replicate)
async function generateAndStoreArtQr(slug, tier = 'business', maxRetries = 3) {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log(`⚠️  REPLICATE_API_TOKEN not set — skipping AI QR for "${slug}"`);
    return;
  }

  // Map tier/edition name to prompt key
  const promptKey = String(tier).toLowerCase().includes('tech') || String(tier).toLowerCase().includes('robotics') ? 'tech'
                  : String(tier).toLowerCase().includes('med') ? 'medical'
                  : 'business';

  const { prompt, negative_prompt } = EDITION_PROMPTS[promptKey];
  const qrUrl = `${QR_BASE_URL}/b/${slug}`;

  console.log(`🎨 Generating Monster Labs art QR for "${slug}" (edition: ${promptKey}) …`);

  try {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`⏳ Attempt ${attempt}/${maxRetries}...`);
      const output = await replicate.run('andreasjansson/qrcode', {
        input: {
          prompt,
          negative_prompt,
          qr_code_content:               qrUrl,
          controlnet_conditioning_scale: 1.9,
          guidance_scale:                7.5,
          num_inference_steps:           40,
          width:                         768,
          height:                        768,
          border:                        1,
          qrcode_background:             'gray',
          seed:                          Math.floor(Math.random() * 2147483647),
        },
      });

      // output is an array of file URLs from Replicate
      const resultUrl = Array.isArray(output) ? output[0] : output;
      if (!resultUrl) throw new Error('Replicate returned no output.');

      const isValid = await verifyQrCode(resultUrl, qrUrl);
      if (isValid) {
        await saveArtQrUrl(slug, String(resultUrl));
        console.log(`✅ Monster Labs art QR for "${slug}" stored: ${resultUrl}`);
        return;
      } else if (attempt === maxRetries) {
        console.log(`⚠️ Max retries reached for "${slug}". Saving last attempt despite validation failure.`);
        await saveArtQrUrl(slug, String(resultUrl));
      }
    }
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

    const entry = intake.entries[0];
    const slug  = entry?.mode === 'bridge' ? entry?.slug : null;

    if (!slug) {
      return res.status(400).json({ error: 'This order uses direct-link mode — no bridge slug to embed in the QR.' });
    }

    const { generateCompositeAsset } = await import('./compositor.js');
    const item    = record.items?.[0] || {};
    const edition = item.title || 'default';

    const assetPath = await generateCompositeAsset(req.params.sessionId, edition, slug);

    // Persist the print asset URL — both in Supabase and in the local record store
    await saveOrderRecord({ ...record, printAssetUrl: assetPath });
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: dbError } = await supabase.from('orders').update({ print_asset_url: assetPath }).eq('stripe_session_id', req.params.sessionId);
    if (dbError) console.error('❌ Failed to save print_asset_url to DB:', dbError.message);

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

// POST /api/members/bridges/:slug/regenerate-art — trigger AI QR regeneration
app.post('/api/members/bridges/:slug/regenerate-art', apiLimiter, async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify ownership and get tier
    const { data: bridge } = await supabase
      .from('bridges')
      .select('id, owner_id, orders!bridges_order_id_fk(customer_email, items)')
      .eq('slug', req.params.slug)
      .single();

    if (!bridge) return res.status(404).json({ error: 'Bridge not found.' });

    const isOwner  = bridge.owner_id === user.id;
    const isCustomer = bridge.orders?.customer_email === user.email;
    if (!isOwner && !isCustomer) return res.status(403).json({ error: 'Not your bridge.' });

    // Reset current QR art to null to indicate processing
    await supabase.from('bridges').update({ qr_art_url: null }).eq('slug', req.params.slug);

    const tier = bridge.orders?.items?.[0]?.tier || 'business';
    
    // Fire and forget
    generateAndStoreArtQr(req.params.slug, tier).catch(console.error);

    res.json({ success: true, message: 'Regeneration started.' });
  } catch (err) {
    console.error('❌ Bridge regenerate error:', err.message);
    res.status(500).json({ error: 'Could not start regeneration.' });
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
        const shippedRecord = { ...dbOrder, status: 'shipped' };
        await saveOrderRecord(shippedRecord);
        console.log(`📦 Order ${order.external_id} shipped.`);

        // Notify customer
        const email = shippedRecord.contactEmail;
        if (email) {
          sendOrderEmail(shippedRecord._dbId || order.external_id, {
            emailTo:       email,
            template:      'shipped',
            sessionId:     order.external_id,
            trackingUrl:   order.tracking_url,
            trackingNumber:order.tracking_number,
            carrier:       order.carrier,
          }).catch(console.error);
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('❌ POD webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// ---------------------------------------------------------------------------
// ADMIN — Premium bridge destination update
// Used when a custom-built page is ready and needs to replace #pending-build
// ---------------------------------------------------------------------------
app.patch('/api/admin/bridges/:slug/destination', adminLimiter, async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { targetUrl, notifyCustomer } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required.' });
  try { new URL(targetUrl); } catch { return res.status(400).json({ error: 'Invalid URL.' }); }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Update the bridge destination
    const { error } = await supabase
      .from('bridges')
      .update({ target_url: targetUrl, updated_at: new Date().toISOString() })
      .eq('slug', req.params.slug);
    if (error) throw error;

    console.log(`✅ Bridge "${req.params.slug}" destination set to ${targetUrl}`);

    // Optionally notify customer
    if (notifyCustomer) {
      const { data: bridge } = await supabase
        .from('bridges')
        .select('orders!bridges_order_id_fk(stripe_session_id, customer_email, id)')
        .eq('slug', req.params.slug)
        .single();

      const order = bridge?.orders;
      if (order?.customer_email) {
        sendOrderEmail(order.id || order.stripe_session_id, {
          emailTo:   order.customer_email,
          template:  'page-live',
          sessionId: order.stripe_session_id,
        }).catch(console.error);
      }
    }

    res.json({ success: true, slug: req.params.slug, targetUrl });
  } catch (err) {
    console.error('❌ Bridge destination update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// ADMIN — Manual supplier notification
// Sends print file link + order details to a supplier email address
// ---------------------------------------------------------------------------
app.post('/api/admin/orders/:sessionId/notify-supplier', adminLimiter, async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { supplierEmail } = req.body;
  if (!supplierEmail) return res.status(400).json({ error: 'supplierEmail is required.' });

  try {
    const record  = await getOrderRecord(req.params.sessionId);
    if (!record) return res.status(404).json({ error: 'Order not found.' });

    const intake  = record.intake?.entries?.[0];
    const item    = record.items?.[0] || {};
    const shortId = req.params.sessionId.slice(-6).toUpperCase();
    const base    = process.env.PUBLIC_URL || 'https://qonnect.work';
    const printUrl = record.printAssetUrl ? `${base}${record.printAssetUrl}` : null;

    const detailRows = [
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Order ID</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;font-weight:600;">#${shortId}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Customer</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;">${record.contactEmail || '—'}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Edition</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;">${item.title || '—'}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Tier</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;text-transform:uppercase;">${item.tier || '—'}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Mode</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;text-transform:uppercase;">${intake?.mode || '—'}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#888;font-size:13px;">QR Slug</td><td style="padding:6px 0;color:#f0ece0;font-size:13px;">${intake?.mode === 'bridge' ? `${base}/b/${intake.slug}` : 'Direct URL (no slug)'}</td></tr>`,
    ].join('');

    const html = buildEmailHtml({
      title: `Print order #${shortId} — QONNECT`,
      orderId: null,
      body: `<p>Please find the print specifications for QONNECT order <strong style="color:#f0ece0;">#${shortId}</strong> below.</p>
             <table style="width:100%;border-collapse:collapse;margin:24px 0;">${detailRows}</table>
             ${printUrl ? `<p>The print-ready composite file is attached below. Please use this file for garment production.</p>` : '<p style="color:#c0392b;">⚠️ Print file not yet generated — check admin dashboard.</p>'}`,
      ctaText: printUrl ? 'Download Print File' : null,
      ctaUrl: printUrl,
      footerNote: `Reference: ${req.params.sessionId}`,
    });

    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const fromDomain = process.env.RESEND_DOMAIN || 'onboarding@resend.dev';
      const fromEmail = fromDomain.includes('@') ? fromDomain : `QONNECT Production <orders@${fromDomain}>`;

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: supplierEmail,
        subject: `QONNECT Print Order #${shortId} — ${item.title || 'Garment'}`,
        html,
      });
      if (error) throw new Error(error.message);
      console.log(`✅ Supplier notified: ${supplierEmail} for order #${shortId}`);
    } else {
      console.log(`📧 [Simulated supplier email] → ${supplierEmail} for order #${shortId}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Supplier notify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// MEMBERS — All orders by email (including direct-link orders with no bridge)
// ---------------------------------------------------------------------------
app.get('/api/members/orders', apiLimiter, async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('orders')
      .select('stripe_session_id, status, payment_status, items, customer_email, intake_data, print_asset_url, created_at')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json((data || []).map(row => ({
      sessionId:     row.stripe_session_id,
      shortOrderId:  row.stripe_session_id?.slice(-6).toUpperCase(),
      status:        row.status,
      paymentStatus: row.payment_status,
      items:         row.items || [],
      intake:        row.intake_data || null,
      printAssetUrl: row.print_asset_url || null,
      createdAt:     row.created_at,
    })));
  } catch (err) {
    console.error('❌ Members orders error:', err.message);
    res.status(500).json({ error: 'Could not load your orders.' });
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
// SOCIAL CRAWLERS / OPENGRAPH (Task 4)
// ---------------------------------------------------------------------------
app.get('/b/:slug', async (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isBot = /bot|crawler|spider|linkedin|twitter|facebook|whatsapp|skype|telegram|imessage/i.test(ua);
  
  if (isBot) {
    const { slug } = req.params;
    try {
      const dest = await findDestinationBySlug(slug);
      if (!dest) return next(); // Not found, let React handle 404
      
      let title = `Digital Bridge: ${slug}`;
      if (dest.type === 'template' && dest.brief) {
          const firstLine = dest.brief.split('\n')[0].trim();
          if (firstLine && firstLine.length < 60) title = `${firstLine}'s QONNECT Bridge`;
      }
      
      const aiQr = await getArtQrUrl(slug);
      const base = process.env.PUBLIC_URL || 'https://qonnect.ai';
      const imageUrl = aiQr || `${base}/api/qr/${slug}.png?size=1024`;
      
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="Scan to connect. Bridging the physical and digital world.">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${base}/b/${slug}">
  <meta property="og:type" content="profile">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:image" content="${imageUrl}">
</head>
<body></body>
</html>`;
      return res.send(html);
    } catch (err) {
      console.error('OG Tag error:', err);
    }
  }
  next();
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
