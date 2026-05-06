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
 * QONNECT ATELIER ENGINE (v8.0) - THE RECESSED LENS
 * ------------------------------------------------
 * Sophisticated hardware-inspired aesthetic.
 * Radial gradients + Depth filters + Max contrast.
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png',
    baseWidth: 2400,
    qrSize: 340,
    left: 430,   
    top: 680,     // Shifted up to center between palms
    accent: '#0066ff', 
    maskType: 'squircle',
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 300,
    left: 450,
    top: 560,     // Shifted up
    accent: '#00cc88', 
    maskType: 'squircle',
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,
    top: 500,     // Shifted up
    accent: '#a68b5a', 
    maskType: 'squircle',
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,
    top: 500,
    accent: '#000000',
    maskType: 'squircle',
  }
};

/**
 * Precision Squircle Lens Generator
 * High-Contrast Black Dots on a Wide Radial Gradient
 */
async function generateSquircleLensQr(qrUrl, accentColor, sizePx) {
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: sizePx * 2,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000',
      light: '#00000000'
    }
  });

  const background = Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lensGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.3" />
          <stop offset="85%" style="stop-color:#ffffff;stop-opacity:1" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${sizePx}" height="${sizePx}" rx="${sizePx * 0.2}" ry="${sizePx * 0.2}" fill="url(#lensGlow)"/>
    </svg>`
  );

  const dotsProcessed = await sharp(qrBuffer).resize(Math.round(sizePx * 0.85), Math.round(sizePx * 0.85)).png().toBuffer();

  return sharp(background)
    .composite([{ input: dotsProcessed, blend: 'over' }])
    .png()
    .toBuffer();
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

  console.log(`🏗️  Atelier Engine v9.0: Precision Squircle for "${slug}"`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    const baseImageBuffer = fs.readFileSync(baseImagePath);
    const metadata = await sharp(baseImageBuffer).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate Squircle Lens
    let finalQr;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      const response = await fetch(aiArtUrl);
      const arrayBuffer = await response.arrayBuffer();
      finalQr = await sharp(Buffer.from(arrayBuffer))
        .resize(sSize, sSize)
        .flatten({ background: '#ffffff' })
        .composite([{ 
          input: Buffer.from(`<svg width="${sSize}" height="${sSize}"><rect x="0" y="0" width="${sSize}" height="${sSize}" rx="${sSize * 0.2}" ry="${sSize * 0.2}" fill="white"/></svg>`), 
          blend: 'dest-in' 
        }])
        .toBuffer();
    } else {
      finalQr = await generateSquircleLensQr(qrUrl, config.accent, sSize);
    }

    // 2. Final Merging
    const finalBuffer = await sharp(baseImageBuffer)
      .composite([
        {
          input: finalQr,
          top: sTop,
          left: sLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100 })
      .toBuffer();

    // 3. Cloud Vault persistence
    const shortId = String(orderId).slice(-6).toUpperCase();
    const fileName = `ATELIER_V8_ORDER-${shortId}_${eKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    return publicUrl;

  } catch (error) {
    console.error('❌ Atelier v8.0 Failed:', error.message);
    throw error;
  }
}
