import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { getArtQrUrl } from './orderStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source images are web mockups (not print-ready):
//   hero-hoodie.png + tech-edition.png = 772x579px
//   med-edition.png                    = 1200x896px
//
// The scaling logic mathematically adjusts the QR code size and position
// based on the actual dimensions of the provided baseImage, allowing
// seamless upgrading to 4000px+ 300DPI print files.
const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/tech-edition.png',
    baseWidth: 772,
    qrSize: 95,
    left: 153,
    top: 228,
    qrDark:  '#C9A86C',
    qrLight: '#00000000',
    maskType: 'circle',
  },
  'medicine': {
    baseImage: '../src/assets/med-edition.png',
    baseWidth: 1200,
    qrSize: 125,
    left: 228,
    top: 422,
    qrDark:  '#bbdefb',
    qrLight: '#00000000',
    maskType: 'circle',
  },
  'business': {
    baseImage: '../src/assets/hero-hoodie.png',
    baseWidth: 772,
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#c8e6c9',
    qrLight: '#00000000',
    maskType: 'rounded',
  },
  'default': {
    baseImage: '../src/assets/hero-hoodie.png',
    baseWidth: 772,
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#c8e6c9',
    qrLight: '#00000000',
    maskType: 'rounded',
  }
};

/**
 * Generates a print-ready asset by compositing a QR code over the base edition design.
 */
export async function generateCompositeAsset(orderId, edition, slug) {
  const editionKey = String(edition).toLowerCase().includes('robotics') ? 'robotics'
                   : String(edition).toLowerCase().includes('tech') ? 'robotics'
                   : String(edition).toLowerCase().includes('medicine') ? 'medicine'
                   : String(edition).toLowerCase().includes('business') ? 'business'
                   : 'default';

  const config = EDITION_CONFIG[editionKey];
  
  const secret = process.env.QR_SECRET || 'qonnect-core-secret';
  const hash = crypto.createHmac('sha256', secret).update(slug).digest('hex').substring(0, 8);
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}?s=${hash}`;

  console.log(`🖼️  Auto-Compositing (High-Fidelity) ${editionKey} design for order ${orderId}`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) throw new Error(`Base image not found`);

    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    const scaledQrSize = Math.round(config.qrSize * scaleFactor);
    const scaledLeft = Math.round(config.left * scaleFactor);
    const scaledTop = Math.round(config.top * scaleFactor);

    // 1. Generate/Fetch the QR source
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl) {
      console.log(`🎨 Fetching AI Art QR...`);
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art QR');
      const arrayBuffer = await response.arrayBuffer();
      qrBuffer = Buffer.from(arrayBuffer);
    } else {
      qrBuffer = await QRCode.toBuffer(qrUrl, {
        width: scaledQrSize * 2, // Double res for high-fidelity resizing
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: config.qrDark, light: config.qrLight }
      });
    }

    // 2. Create the Mask (Circle or Rounded)
    const radius = config.maskType === 'circle' ? scaledQrSize / 2 : Math.round(scaledQrSize * 0.08);
    const mask = Buffer.from(
      `<svg width="${scaledQrSize}" height="${scaledQrSize}">
        ${config.maskType === 'circle' 
          ? `<circle cx="${scaledQrSize/2}" cy="${scaledQrSize/2}" r="${scaledQrSize/2}" fill="white"/>`
          : `<rect x="0" y="0" width="${scaledQrSize}" height="${scaledQrSize}" rx="${radius}" ry="${radius}" fill="white"/>`
        }
      </svg>`
    );

    // 3. Process the QR: Resize, Mask, and Add a subtle "Print Texture"
    const processedQr = await sharp(qrBuffer)
      .resize(scaledQrSize, scaledQrSize, { kernel: 'lanczos3' })
      .composite([{ input: mask, blend: 'dest-in' }])
      // Add very subtle noise to simulate fabric ink absorption
      .modulate({ brightness: 1.02, saturation: 1.1 })
      .png()
      .toBuffer();

    // 4. Final Composite
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

    // 5. Cloud Upload
    const shortOrder = orderId.slice(-6).toUpperCase();
    const fileName = `HI-RES_ORDER-${shortOrder}_${editionKey.toUpperCase()}_${Date.now()}.png`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: uploadError } = await supabase.storage
      .from('print-assets')
      .upload(fileName, finalBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('print-assets').getPublicUrl(fileName);
    return publicUrl;

  } catch (error) {
    console.error('❌ High-Fidelity Compositor Failed:', error.message);
    throw error;
  }
}
