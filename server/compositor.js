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
    qrSize: 320,
    left: 440,
    top: 760,     // Shifted up from 800
    accent: '#0066ff', // Deeper blue for better contrast on white
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 280,
    left: 460,
    top: 650,     // Shifted up from 690
    accent: '#00cc88', // Deeper green
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 260,
    left: 470,
    top: 590,     // Shifted up from 630
    accent: '#a68b5a', // Deeper gold
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 260,
    left: 470,
    top: 590,
    accent: '#000000',
  }
};

/**
 * Technical Lens QR Generator (v7.1)
 * High-Contrast Accent Dots on White Background
 */
async function generateTechnicalLensQr(qrUrl, color, sizePx) {
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: sizePx * 2,
    margin: 6, // Increased quiet zone
    errorCorrectionLevel: 'H',
    color: {
      dark: color,    // Accent color dots
      light: '#ffffff' // Pure white background
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

  console.log(`🏗️  Atelier Engine v7.1: Precision Build for "${slug}"`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    const baseImageBuffer = fs.readFileSync(baseImagePath);
    const metadata = await sharp(baseImageBuffer).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate High-Contrast Lens QR
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      const response = await fetch(aiArtUrl);
      const arrayBuffer = await response.arrayBuffer();
      qrBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(sSize, sSize)
        .flatten({ background: '#ffffff' })
        .toBuffer();
    } else {
      qrBuffer = await generateTechnicalLensQr(qrUrl, config.accent, sSize);
    }

    // 2. Circular Mask with Minimal Feather (Razor Sharp Finders)
    const mask = Buffer.from(
      `<svg width="${sSize}" height="${sSize}">
        <circle cx="${sSize/2}" cy="${sSize/2}" r="${sSize/2}" fill="white"/>
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
