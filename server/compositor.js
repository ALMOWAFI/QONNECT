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
 * QONNECT CINEMATIC ENGINE (v5.0)
 * ------------------------------
 * Optimized for "Technical Luxury" scannability and visual flow.
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png',
    baseWidth: 2400,
    qrSize: 420,  
    left: 405,    
    top: 740,     
    accent:  '#99c6ff', 
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 380,
    left: 550,    
    top: 640,     
    accent:  '#99fadc', 
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 360,
    left: 470,    
    top: 580,     
    accent:  '#D4C5B0', 
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 360,
    left: 470,
    top: 580,
    accent:  '#FFFFFF',
  }
};

/**
 * Custom SVG Generator for "Technical Luxury" QR Styling
 */
function generateTechnicalQrSvg(qrUrl, color, sizePx) {
  const qrData = QRCode.create(qrUrl, { errorCorrectionLevel: 'H' });
  const { modules } = qrData;
  const mSize = modules.size;
  const dotUnit = 10;
  const canvasDim = mSize * dotUnit;
  
  let svgPaths = '';
  for (let y = 0; y < mSize; y++) {
    for (let x = 0; x < mSize; x++) {
      if (modules.get(x, y)) {
        svgPaths += `<rect x="${x * dotUnit + 1}" y="${y * dotUnit + 1}" width="${dotUnit - 2}" height="${dotUnit - 2}" rx="2" fill="${color}"/>`;
      }
    }
  }

  return Buffer.from(
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${canvasDim} ${canvasDim}" xmlns="http://www.w3.org/2000/svg">
      ${svgPaths}
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

  console.log(`🏗️  Atelier Engine: Cinematic Overhaul for "${slug}" [${eKey.toUpperCase()}]`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) throw new Error(`Base image not found`);

    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate/Fetch the QR source
    let qrSource;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art');
      qrSource = Buffer.from(await response.arrayBuffer());
    } else {
      qrSource = generateTechnicalQrSvg(qrUrl, config.accent, sSize);
    }

    // 2. Create the "Cinematic Glow" layers
    const mainQr = await sharp(qrSource).resize(sSize, sSize).png().toBuffer();
    
    const glowHalo = await sharp(mainQr)
      .blur(Math.round(sSize * 0.02)) 
      .modulate({ brightness: 1.8 })
      .png()
      .toBuffer();

    // 3. Precision Masking
    const mask = Buffer.from(
      `<svg width="${sSize}" height="${sSize}">
        <circle cx="${sSize/2}" cy="${sSize/2}" r="${sSize/2}" fill="white"/>
      </svg>`
    );

    // 4. Final Atelier Merging
    const finalBuffer = await sharp(baseImagePath)
      .composite([
        {
          input: glowHalo,
          top: sTop,
          left: sLeft,
          blend: 'screen',
          opacity: 0.7
        },
        {
          input: mainQr,
          top: sTop,
          left: sLeft,
          blend: 'screen',
        }
      ])
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();

    // 5. Cloud Vault persistence
    const shortId = String(orderId).slice(-6).toUpperCase();
    const fileName = `CINEMATIC_ORDER-${shortId}_${eKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    console.log(`✅ Cinematic Asset Secured: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('❌ Atelier Engine Exception:', error.message);
    throw error;
  }
}
