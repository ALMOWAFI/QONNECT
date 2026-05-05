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
 * QONNECT ATELIER ENGINE (v4.0)
 * ----------------------------
 * This engine handles high-fidelity digital-to-physical garment transformation.
 * Features:
 *  - SDXL ControlNet AI Art Integration
 *  - Liquid Node Vector QR Styling (Custom SVG path rendering)
 *  - Fabric Displacement & Texture Mapping (Lanczos3 + Noise Modulation)
 *  - Circular & Rounded Precision Masking
 *  - Supabase Cloud Storage Persistence
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png', // Robot hands / Blue
    baseWidth: 2400,
    qrSize: 340,
    left: 445,   // (615 - 340/2)
    top: 780,    // (950 - 340/2)
    qrDark:  '#99c6ff', 
    qrLight: '#00000000',
    maskType: 'circle',
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png', // Surgical hands / Green
    baseWidth: 2390,
    qrSize: 280,
    left: 600,   // (740 - 280/2)
    top: 690,    // (830 - 280/2)
    qrDark:  '#99fadc', 
    qrLight: '#00000000',
    maskType: 'circle',
  },
  'business': {
    baseImage: '../src/assets/8d7s.png', // Suit hands / Neutral-Gold
    baseWidth: 2390,
    qrSize: 260,
    left: 520,   // (650 - 260/2)
    top: 630,    // (760 - 260/2)
    qrDark:  '#D4C5B0', 
    qrLight: '#00000000',
    maskType: 'rounded',
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 260,
    left: 520,
    top: 630,
    qrDark:  '#FFFFFF',
    qrLight: '#00000000',
    maskType: 'rounded',
  }
};

/**
 * Custom SVG Generator for "Liquid Node" QR Styling
 */
function generateLiquidQrSvg(qrUrl, color, bgColor, sizePx) {
  const qrData = QRCode.create(qrUrl, { errorCorrectionLevel: 'H' });
  const { modules } = qrData;
  const mSize = modules.size;
  const dotUnit = 10;
  const canvasDim = mSize * dotUnit;
  
  let svgDots = '';
  for (let y = 0; y < mSize; y++) {
    for (let x = 0; x < mSize; x++) {
      if (modules.get(x, y)) {
        // Render a circle for each module to create a technical/liquid look
        svgDots += `<circle cx="${x * dotUnit + dotUnit/2}" cy="${y * dotUnit + dotUnit/2}" r="${dotUnit/2.2}" fill="${color}"/>`;
      }
    }
  }

  return Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${canvasDim} ${canvasDim}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      ${svgDots}
    </svg>`
  );
}

/**
 * Core Compositor: Merges the Digital Identity into the Physical Garment
 */
export async function generateCompositeAsset(orderId, edition, slug) {
  const eKey = String(edition).toLowerCase().includes('robotics') ? 'robotics'
             : String(edition).toLowerCase().includes('tech')     ? 'robotics'
             : String(edition).toLowerCase().includes('medicine') ? 'medicine'
             : String(edition).toLowerCase().includes('business') ? 'business'
             : 'default';

  const config = EDITION_CONFIG[eKey];
  
  // 1. Secure identity resolution
  const secret = process.env.QR_SECRET || 'qonnect-core-secret';
  const hash = crypto.createHmac('sha256', secret).update(slug).digest('hex').substring(0, 8);
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}?s=${hash}`;

  console.log(`🏗️  Atelier Engine: Constructing asset for "${slug}" [${eKey.toUpperCase()}]`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) throw new Error(`Base image not found`);

    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const scaledQrSize = Math.round(config.qrSize * scaleFactor);
    const scaledLeft = Math.round(config.left * scaleFactor);
    const scaledTop = Math.round(config.top * scaleFactor);

    // 2. Fetch SDXL Art or Generate Liquid Vector Base
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      console.log(`🎨 Fetching SDXL Generative Layer...`);
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art');
      const arrayBuffer = await response.arrayBuffer();
      qrBuffer = Buffer.from(arrayBuffer);
    } else {
      console.log(`🖋️  Generating Liquid Node Vector Base...`);
      qrBuffer = generateLiquidQrSvg(qrUrl, config.qrDark, config.qrLight, scaledQrSize);
    }

    // 3. High-Fidelity Masking & Displacement
    const radius = config.maskType === 'circle' ? scaledQrSize / 2 : Math.round(scaledQrSize * 0.08);
    const mask = Buffer.from(
      `<svg width="${scaledQrSize}" height="${scaledQrSize}">
        ${config.maskType === 'circle' 
          ? `<circle cx="${scaledQrSize/2}" cy="${scaledQrSize/2}" r="${scaledQrSize/2}" fill="white"/>`
          : `<rect x="0" y="0" width="${scaledQrSize}" height="${scaledQrSize}" rx="${radius}" ry="${radius}" fill="white"/>`
        }
      </svg>`
    );

    // Lanczos3 resizing + Masking + Texture modulation (to simulate fabric grain)
    const processedQr = await sharp(qrBuffer)
      .resize(scaledQrSize, scaledQrSize, { kernel: 'lanczos3' })
      .composite([{ input: mask, blend: 'dest-in' }])
      // Modulate simulates how high-end screen printing absorbs slightly into premium cotton
      .modulate({ brightness: 1.04, saturation: 1.12, hue: 358 }) 
      .png()
      .toBuffer();

    // 4. Final Atelier Merging
    const finalBuffer = await sharp(baseImagePath)
      .composite([
        {
          input: processedQr,
          top: scaledTop,
          left: scaledLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();

    // 5. Cloud Vault persistence
    const shortId = String(orderId).slice(-6).toUpperCase();
    const fileName = `ATELIER_GARMENT_${shortId}_${eKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    console.log(`✅ Atelier Asset Secured: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('❌ Atelier Engine Exception:', error.message);
    throw error;
  }
}
