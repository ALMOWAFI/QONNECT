/**
 * QONNECT Compositor
 *
 * Exports two functions per order:
 *
 *  generatePrintFile(orderId, edition, slug)
 *    → 3000×3000px standalone design at 300 DPI. Goes straight to the DTG supplier.
 *
 *  generateMockup(orderId, edition, slug)
 *    → QR composited into the hoodie artwork photo. Used for customer preview,
 *      admin panel, and order confirmation email.
 */

import sharp from 'sharp';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Edition configs ──────────────────────────────────────────────────────────

const PRINT_CONFIG = {
  robotics: { qrColor: '#C9A86C', textColor: '#C9A86C', tagline: 'SCAN TO BUILD THE FUTURE',       footer: 'QONNECT · ROBOTICS EDITION' },
  business: { qrColor: '#C8E6C9', textColor: '#C8E6C9', tagline: 'SCAN TO CREATE VALUE',            footer: 'QONNECT · BUSINESS EDITION' },
  medicine: { qrColor: '#BBDEFB', textColor: '#BBDEFB', tagline: 'SCAN TO HEAL · IMPACT · INSPIRE', footer: 'QONNECT · MEDICINE EDITION' },
  default:  { qrColor: '#FFFFFF', textColor: '#FFFFFF', tagline: 'SCAN TO CONNECT',                 footer: 'QONNECT' },
};

// cx/cy = center of QR placeholder circle in the hoodie photo (pixels)
// size  = diameter to fill
const MOCKUP_CONFIG = {
  robotics: { baseImage: 'mockup-robotics.png', cx: 578, cy: 905, size: 320, qrColor: '#C9A86C', blend: 'screen' },
  business: { baseImage: 'mockup-business.png', cx: 510, cy: 880, size: 300, qrColor: '#D4C5B0', blend: 'screen' },
  medicine: { baseImage: 'mockup-medicine.png', cx: 658, cy: 893, size: 270, qrColor: '#BBDEFB', blend: 'screen' },
  default:  { baseImage: 'mockup-business.png', cx: 510, cy: 880, size: 300, qrColor: '#FFFFFF',  blend: 'screen' },
};

function resolveEdition(edition) {
  const e = String(edition).toLowerCase();
  if (e.includes('robotics') || e.includes('tech'))  return 'robotics';
  if (e.includes('medicine') || e.includes('med'))   return 'medicine';
  if (e.includes('business') || e.includes('biz'))   return 'business';
  return 'default';
}

function buildQrUrl(slug) {
  const secret = process.env.QR_SECRET || 'qonnect-core-secret';
  const hash   = crypto.createHmac('sha256', secret).update(slug).digest('hex').slice(0, 8);
  return `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}?s=${hash}`;
}

async function uploadToStorage(buffer, fileName) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.storage
    .from('print-assets')
    .upload(fileName, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
  return publicUrl;
}

// ─── 1. Print file ────────────────────────────────────────────────────────────
// Standalone 3000×3000px design. Transparent-ish near-black background so
// the DTG supplier prints exactly what's here without guessing fill colour.

const PRINT_SIZE = 3000;
const QR_SIZE    = 1800;
const QR_LEFT    = (PRINT_SIZE - QR_SIZE) / 2;
const QR_TOP     = 400;

export async function generatePrintFile(orderId, edition, slug) {
  const key    = resolveEdition(edition);
  const config = PRINT_CONFIG[key];
  const qrUrl  = buildQrUrl(slug);

  console.log(`🖨️  Print file → ${key}/${slug}`);

  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: QR_SIZE, margin: 1, errorCorrectionLevel: 'H',
    color: { dark: config.qrColor, light: '#0a0a0a' },
  });

  const taglineY = QR_TOP + QR_SIZE + 110;
  const footerY  = PRINT_SIZE - 140;

  const textSvg = Buffer.from(`
    <svg width="${PRINT_SIZE}" height="${PRINT_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <text x="${PRINT_SIZE/2}" y="${taglineY}"
        font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="700"
        letter-spacing="14" fill="${config.textColor}" text-anchor="middle" opacity="0.85"
      >${config.tagline}</text>
      <text x="${PRINT_SIZE/2}" y="${footerY}"
        font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="400"
        letter-spacing="18" fill="${config.textColor}" text-anchor="middle" opacity="0.35"
      >${config.footer}</text>
      <text x="${PRINT_SIZE/2}" y="${footerY + 52}"
        font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400"
        letter-spacing="10" fill="${config.textColor}" text-anchor="middle" opacity="0.22"
      >qonnect.work/b/${slug}</text>
    </svg>`);

  const finalBuffer = await sharp({
    create: { width: PRINT_SIZE, height: PRINT_SIZE, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite([
      { input: qrBuffer, top: QR_TOP, left: QR_LEFT },
      { input: textSvg,  top: 0,      left: 0 },
    ])
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  const shortOrder = String(orderId).slice(-6).toUpperCase();
  const fileName   = `PRINT_ORDER-${shortOrder}_${key.toUpperCase()}_${Date.now()}.png`;
  const url        = await uploadToStorage(finalBuffer, fileName);
  console.log(`✅ Print file ready: ${fileName}`);
  return url;
}

// ─── 2. Mockup ────────────────────────────────────────────────────────────────
// Customer-facing preview: the QR placed into the hoodie artwork placeholder.
// Output is full-res mockup (same dimensions as the base photo).

export async function generateMockup(orderId, edition, slug) {
  const key    = resolveEdition(edition);
  const config = MOCKUP_CONFIG[key];
  const qrUrl  = buildQrUrl(slug);

  console.log(`🖼️  Mockup → ${key}/${slug}`);

  const baseImagePath = path.join(__dirname, config.baseImage);
  const { width: W, height: H } = await sharp(baseImagePath).metadata();

  // QR at placeholder size, colored modules on transparent background
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: config.size, margin: 0, errorCorrectionLevel: 'H',
    color: { dark: config.qrColor, light: '#00000000' },
  });

  // Resize QR cleanly
  const qrResized = await sharp(qrBuffer)
    .resize(config.size, config.size, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const left = Math.round(config.cx - config.size / 2);
  const top  = Math.round(config.cy - config.size / 2);

  const finalBuffer = await sharp(baseImagePath)
    .composite([{ input: qrResized, top, left, blend: config.blend }])
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();

  const shortOrder = String(orderId).slice(-6).toUpperCase();
  const fileName   = `MOCKUP_ORDER-${shortOrder}_${key.toUpperCase()}_${Date.now()}.png`;
  const url        = await uploadToStorage(finalBuffer, fileName);
  console.log(`✅ Mockup ready: ${fileName}`);
  return url;
}

// ─── Legacy alias (called from index.js webhook handler) ─────────────────────
export async function generateCompositeAsset(orderId, edition, slug) {
  const [printUrl, mockupUrl] = await Promise.all([
    generatePrintFile(orderId, edition, slug),
    generateMockup(orderId, edition, slug),
  ]);
  return { printUrl, mockupUrl };
}
