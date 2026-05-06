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
    top: 740,     // Final Recalibrated Y
    accent: '#0066ff', 
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 300,
    left: 450,
    top: 630,
    accent: '#00cc88', 
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,
    top: 570,
    accent: '#a68b5a', 
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,
    top: 570,
    accent: '#000000',
  }
};

/**
 * Recessed Hardware Lens Generator
 * High-Contrast Black Dots on a Radial Gradient Glow
 */
async function generateRecessedLensQr(qrUrl, accentColor, sizePx) {
  // Generate the high-res dots first
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: sizePx * 2,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000', // Pure black dots for 100% scanning
      light: '#00000000' // Transparent background
    }
  });

  // Create the "Luxury Hardware" Background SVG
  const background = Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lensGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:0.4" />
          <stop offset="70%" style="stop-color:#ffffff;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1" />
        </radialGradient>
        <filter id="innerShadow">
          <feComponentTransfer in="SourceAlpha">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feGaussianBlur stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feFlood flood-color="black" flood-opacity="0.3" result="color" />
          <feComposite in2="offsetblur" operator="in" />
          <feComposite in2="SourceAlpha" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="${sizePx/2}" cy="${sizePx/2}" r="${sizePx/2}" fill="url(#lensGlow)" filter="url(#innerShadow)"/>
    </svg>`
  );

  const dotsProcessed = await sharp(qrBuffer).resize(Math.round(sizePx * 0.9), Math.round(sizePx * 0.9)).png().toBuffer();

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

  console.log(`🏗️  Atelier Engine v8.0: Constructing Recessed Lens for "${slug}"`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    const baseImageBuffer = fs.readFileSync(baseImagePath);
    const metadata = await sharp(baseImageBuffer).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate Luxury Lens
    let finalQr;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      const response = await fetch(aiArtUrl);
      const arrayBuffer = await response.arrayBuffer();
      finalQr = await sharp(Buffer.from(arrayBuffer))
        .resize(sSize, sSize)
        .flatten({ background: '#ffffff' }) // AI Art always on white for safety
        .composite([{ 
          input: Buffer.from(`<svg width="${sSize}" height="${sSize}"><circle cx="${sSize/2}" cy="${sSize/2}" r="${sSize/2}" fill="white"/></svg>`), 
          blend: 'dest-in' 
        }])
        .toBuffer();
    } else {
      finalQr = await generateRecessedLensQr(qrUrl, config.accent, sSize);
    }

    // 2. Composite with standard blending for maximum quality
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
