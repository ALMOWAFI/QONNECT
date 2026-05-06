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
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png',
    baseWidth: 2400,
    qrSize: 360,
    left: 415,   
    top: 735,    
    qrDark:  '#000000', 
    qrLight: '#ffffffeb', 
    maskType: 'circle',
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 320,
    left: 580, 
    top: 660,
    qrDark:  '#000000',
    qrLight: '#ffffffeb',
    maskType: 'circle',
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 300,
    left: 500,
    top: 610,
    qrDark:  '#000000',
    qrLight: '#ffffffeb',
    maskType: 'rounded',
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 300,
    left: 500,
    top: 610,
    qrDark:  '#000000',
    qrLight: '#ffffffeb',
    maskType: 'rounded',
  }
};

/**
 * Custom SVG Generator for "Liquid Node" QR Styling
 */
function generateLiquidQrSvg(qrUrl, color, bgColor, sizePx, maskType) {
  const qrData = QRCode.create(qrUrl, { errorCorrectionLevel: 'H' });
  const { modules } = qrData;
  const mSize = modules.size;
  const dotUnit = 10;
  const padding = mSize * 0.1; 
  const canvasDim = (mSize + (padding * 2)) * dotUnit;
  
  let svgDots = '';
  for (let y = 0; y < mSize; y++) {
    for (let x = 0; x < mSize; x++) {
      if (modules.get(x, y)) {
        svgDots += `<circle cx="${(x + padding) * dotUnit + dotUnit/2}" cy="${(y + padding) * dotUnit + dotUnit/2}" r="${dotUnit/2.1}" fill="${color}"/>`;
      }
    }
  }

  return Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${canvasDim} ${canvasDim}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${maskType === 'circle' ? '50%' : '20'}" fill="${bgColor}"/>
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
  
  const secret = process.env.QR_SECRET || 'qonnect-core-secret';
  const hash = crypto.createHmac('sha256', secret).update(slug).digest('hex').substring(0, 8);
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}?s=${hash}`;

  console.log(`🏗️  Atelier Engine: Calibrating asset for "${slug}" [${eKey.toUpperCase()}]`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) throw new Error(`Base image not found`);

    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const scaledQrSize = Math.round(config.qrSize * scaleFactor);
    const scaledLeft = Math.round(config.left * scaleFactor);
    const scaledTop = Math.round(config.top * scaleFactor);

    // 1. Fetch AI Art or Generate Liquid Vector Base
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      console.log(`🎨 Fetching SDXL Generative Layer...`);
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art');
      const arrayBuffer = await response.arrayBuffer();
      
      qrBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(scaledQrSize, scaledQrSize)
        .flatten({ background: '#ffffff' }) 
        .png()
        .toBuffer();
    } else {
      console.log(`🖋️  Generating High-Contrast Liquid QR...`);
      qrBuffer = generateLiquidQrSvg(qrUrl, config.qrDark, config.qrLight, scaledQrSize, config.maskType);
    }

    // 2. Precision Masking
    const radius = config.maskType === 'circle' ? scaledQrSize / 2 : Math.round(scaledQrSize * 0.1);
    const mask = Buffer.from(
      `<svg width="${scaledQrSize}" height="${scaledQrSize}">
        ${config.maskType === 'circle' 
          ? `<circle cx="${scaledQrSize/2}" cy="${scaledQrSize/2}" r="${scaledQrSize/2}" fill="white"/>`
          : `<rect x="0" y="0" width="${scaledQrSize}" height="${scaledQrSize}" rx="${radius}" ry="${radius}" fill="white"/>`
        }
      </svg>`
    );

    const processedQr = await sharp(qrBuffer)
      .resize(scaledQrSize, scaledQrSize, { kernel: 'lanczos3' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // 3. Final Placement
    const finalBuffer = await sharp(baseImagePath)
      .composite([
        {
          input: processedQr,
          top: scaledTop,
          left: scaledLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100 })
      .toBuffer();

    // 4. Cloud Vault persistence
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
