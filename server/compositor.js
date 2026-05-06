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
 * QONNECT BULLETPROOF ENGINE (v6.0)
 * --------------------------------
 * Maximum Scannability & Precision Centering.
 */

const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/dmts.png',
    baseWidth: 2400,
    qrSize: 420, 
    left: 390,   // (600 - 420/2 = 390) -> Perfectly centered in 1200px left frame
    top: 660,    
  },
  'medicine': {
    baseImage: '../src/assets/b7e9.png',
    baseWidth: 2390,
    qrSize: 380,
    left: 410,   // (600 - 190)
    top: 640,    
  },
  'business': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 360,
    left: 420,   // (600 - 180)
    top: 580,    
  },
  'default': {
    baseImage: '../src/assets/8d7s.png',
    baseWidth: 2390,
    qrSize: 360,
    left: 420,
    top: 580,
  }
};

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

  console.log(`🏗️  Atelier Engine: Bulletproof v6.0 for "${slug}" [${eKey.toUpperCase()}]`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) throw new Error(`Base image not found`);

    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const sSize = Math.round(config.qrSize * scaleFactor);
    const sLeft = Math.round(config.left * scaleFactor);
    const sTop  = Math.round(config.top * scaleFactor);

    // 1. Generate/Fetch the QR source (High-Contrast Black on White for 100% scan rate)
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl && aiArtUrl !== 'FAILED') {
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art');
      const arrayBuffer = await response.arrayBuffer();
      
      qrBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(sSize, sSize)
        .flatten({ background: '#ffffff' }) // Ensure white backing for AI art
        .png()
        .toBuffer();
    } else {
      // Bulletproof standard QR with 4-module quiet zone
      qrBuffer = await QRCode.toBuffer(qrUrl, {
        width: sSize,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffffff' }
      });
    }

    // 2. High-Precision Masking (Circular for a "Lens" look)
    const mask = Buffer.from(
      `<svg width="${sSize}" height="${sSize}">
        <circle cx="${sSize/2}" cy="${sSize/2}" r="${sSize/2}" fill="white"/>
      </svg>`
    );

    const processedQr = await sharp(qrBuffer)
      .resize(sSize, sSize)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // 3. Final Placement with standard 'over' blending for maximum contrast
    const finalBuffer = await sharp(baseImagePath)
      .composite([
        {
          input: processedQr,
          top: sTop,
          left: sLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();

    // 4. Cloud Vault persistence
    const shortId = String(orderId).slice(-6).toUpperCase();
    const fileName = `BULLETPROOF_ORDER-${shortId}_${eKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    console.log(`✅ Bulletproof Asset Secured: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('❌ Atelier Engine Exception:', error.message);
    throw error;
  }
}
