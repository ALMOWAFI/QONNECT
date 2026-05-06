import sharp from 'sharp';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getArtQrUrl } from './orderStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * QONNECT ATELIER ENGINE (v7.0) - THE INVERTED COIN
 * ------------------------------------------------
 * Focused on:
 *  1. Optical Centering (Lower Y-anchors)
 *  2. Subtractive High-Contrast (Scannability)
 *  3. Feathered Blending (Technical Luxury)
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png',
    baseWidth: 2400,
    qrSize: 320,  // Tighter size for better centering
    left: 440,    // (600 - 160)
    top: 800,     // Precision Lower Anchor
    accent: '#99c6ff', 
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,    // (600 - 140)
    top: 690,     // Precision Lower Anchor
    accent: '#99fadc', 
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 260,
    left: 470,    // (600 - 130)
    top: 630,     // Precision Lower Anchor
    accent: '#D4C5B0', 
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 260,
    left: 470,
    top: 630,
    accent: '#FFFFFF',
  }
};

/**
 * Inverted Technical QR Generator
 * Dots are TRANSPARENT (revealing hoodie)
 * Background is SOLID ACCENT COLOR (The "Coin")
 */
async function generateInvertedCoinQr(qrUrl, color, sizePx) {
  // Use higher scale for crisp subtraction
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: sizePx * 2,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000', // Black dots
      light: color   // Accent background
    }
  });

  return sharp(qrBuffer).resize(sizePx, sizePx).png().toBuffer();
}

/**
 * Core Compositor
 */
export async function generateCompositeAsset(orderId, edition, slug) {
  const eKey = String(edition).toLowerCase().includes('robotics') ? 'robotics'
             : String(edition).toLowerCase().includes('tech')     ? 'robotics'
             : String(edition).toLowerCase().includes('medicine') ? 'medicine'
             : String(edition).toLowerCase().includes('business') ? 'business'
             : 'default';

  const config = EDITION_CONFIG[eKey];
  
  const secret = process.env.QR_SECRET || 'qonnect-core-secret';
  const hash = crypto.createHmac('sha256', secret).update(slug).digest('hex').substring(0, 8);
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}?s=${hash}`;

  console.log(`🏗️  Atelier Engine v7.0: Generating Luxury Coin for "${slug}"`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    const baseImageBuffer = fs.readFileSync(baseImagePath);
    const metadata = await sharp(baseImageBuffer).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate High-Contrast Coin QR
    const qrBuffer = await generateInvertedCoinQr(qrUrl, config.accent, sSize);

    // 2. Feathered Circular Mask (Luxury Blending)
    const feather = Math.round(sSize * 0.1);
    const mask = Buffer.from(
      `<svg width="${sSize}" height="${sSize}">
        <filter id="f1">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${feather / 4}" />
        </filter>
        <circle cx="${sSize/2}" cy="${sSize/2}" r="${(sSize/2) - (feather/2)}" fill="white" filter="url(#f1)"/>
      </svg>`
    );

    const processedQr = await sharp(qrBuffer)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // 3. Composite into the portal
    const finalBuffer = await sharp(baseImageBuffer)
      .composite([
        {
          input: processedQr,
          top: sTop,
          left: sLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100 })
      .toBuffer();

    // 4. Cloud Security
    const shortId = String(orderId).slice(-6).toUpperCase();
    const fileName = `ATELIER_V7_ORDER-${shortId}_${eKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    return publicUrl;

  } catch (error) {
    console.error('❌ Atelier v7.0 Failed:', error.message);
    throw error;
  }
}
