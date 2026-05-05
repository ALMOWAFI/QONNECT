import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
    qrDark:  '#C9A86C', // Gold QR Code
    qrLight: '#00000000', // Transparent background
  },
  'medicine': {
    baseImage: '../src/assets/med-edition.png',
    baseWidth: 1200,
    qrSize: 125,
    left: 228,
    top: 422,
    qrDark:  '#bbdefb', // Blue QR Code
    qrLight: '#00000000', // Transparent background
  },
  'business': {
    baseImage: '../src/assets/hero-hoodie.png',
    baseWidth: 772,
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#c8e6c9', // Green QR Code
    qrLight: '#00000000', // Transparent background
  },
  'default': {
    baseImage: '../src/assets/hero-hoodie.png',
    baseWidth: 772,
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#c8e6c9',
    qrLight: '#00000000',
  }
};

/**
 * Generates a print-ready asset by compositing a QR code over the base edition design.
 * @param {string} orderId - The short order ID or session ID
 * @param {string} edition - The edition name (e.g., 'robotics', 'medicine')
 * @param {string} slug - The unique QONNECT slug for the QR code
 * @returns {Promise<string>} - The relative path to the generated image
 */
export async function generateCompositeAsset(orderId, edition, slug) {
  const editionKey = String(edition).toLowerCase().includes('robotics') ? 'robotics'
                   : String(edition).toLowerCase().includes('tech') ? 'robotics'
                   : String(edition).toLowerCase().includes('medicine') ? 'medicine'
                   : String(edition).toLowerCase().includes('business') ? 'business'
                   : 'default';

  const config = EDITION_CONFIG[editionKey];
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.work'}/b/${slug}`;

  console.log(`🖼️ Auto-Compositing ${editionKey} design for order ${orderId} (Slug: ${slug})`);

  try {
    const baseImagePath = path.join(__dirname, config.baseImage);
    if (!fs.existsSync(baseImagePath)) {
        throw new Error(`Base image not found at ${baseImagePath}`);
    }

    // 1. Get actual dimensions of the base image to support dynamic high-res upgrades
    const metadata = await sharp(baseImagePath).metadata();
    const scaleFactor = metadata.width / config.baseWidth;
    
    // Scale coordinates and size to match the actual image resolution
    const scaledQrSize = Math.round(config.qrSize * scaleFactor);
    const scaledLeft = Math.round(config.left * scaleFactor);
    const scaledTop = Math.round(config.top * scaleFactor);

    // 2. Fetch the Monster Labs AI Art QR Code if available
    let qrBuffer;
    const aiArtUrl = await getArtQrUrl(slug);

    if (aiArtUrl) {
      console.log(`🎨 Fetching AI Art QR from: ${aiArtUrl}`);
      const response = await fetch(aiArtUrl);
      if (!response.ok) throw new Error('Failed to fetch AI Art QR');
      const arrayBuffer = await response.arrayBuffer();
      
      // Resize the AI image to exactly match the scaledQrSize so it fits the hoodie design perfectly
      qrBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(scaledQrSize, scaledQrSize)
        .png()
        .toBuffer();
    } else {
      console.log(`⚠️ WARNING: AI Art QR not found for ${slug}, falling back to standard QR. The print will not have the artistic model applied.`);
      qrBuffer = await QRCode.toBuffer(qrUrl, {
        width: scaledQrSize,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark:  config.qrDark,
          light: config.qrLight,
        }
      });
    }

    // 3. Ensure the output directory exists
    const outDir = path.join(__dirname, '../print-assets');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const shortOrder = orderId.slice(-6).toUpperCase();
    const fileName = `ORDER-${shortOrder}_${editionKey.toUpperCase()}_PRINT-FILE.png`;
    const outPath = path.join(outDir, fileName);

    // 4. Composite the scaled QR onto the base image
    await sharp(baseImagePath)
      .composite([
        {
          input: qrBuffer,
          top: scaledTop,
          left: scaledLeft,
          blend: 'over'
        }
      ])
      .png({ quality: 100 })
      .toFile(outPath);

    console.log(`✅ Asset generated at scaled resolution (${metadata.width}px): ${fileName}`);
    return `/print-assets/${fileName}`;

  } catch (error) {
    console.error('❌ Auto-Compositor Failed:', error.message);
    throw error;
  }
}
