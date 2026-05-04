import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source images are web mockups (not print-ready):
//   hero-hoodie.png + tech-edition.png = 772x579px
//   med-edition.png                    = 1200x896px
//
// QR size is ~20% of image width so it fills the chest/pocket zone.
// left/top = top-left corner of the QR placement.
// To re-center after a size change: new_left = center_x - (qrSize / 2)
//
// When you get proper high-res print files, replace baseImage paths
// and scale coordinates: new_coord = old_coord * (new_width / old_width)
const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/tech-edition.png', // 772x579px — gold circle between hands
    qrSize: 95,
    left: 153,
    top: 228,
    qrDark:  '#000000',
    qrLight: '#C9A86C', // gold — matches the artwork
  },
  'medicine': {
    baseImage: '../src/assets/med-edition.png',  // 1200x896px — blue robot arm circle
    qrSize: 125,
    left: 228,
    top: 422,
    qrDark:  '#000000',
    qrLight: '#bbdefb', // electric blue — matches the artwork
  },
  'business': {
    baseImage: '../src/assets/hero-hoodie.png',  // 772x579px — green circle between hands
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#000000',
    qrLight: '#c8e6c9', // soft green — matches the artwork
  },
  'default': {
    baseImage: '../src/assets/hero-hoodie.png',
    qrSize: 90,
    left: 180,
    top: 227,
    qrDark:  '#000000',
    qrLight: '#c8e6c9',
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
  const qrUrl = `${process.env.PUBLIC_URL || 'https://qonnect.ai'}/b/${slug}`;

  console.log(`🖼️ Auto-Compositing ${editionKey} design for order ${orderId} (Slug: ${slug})`);

  try {
    // 1. Generate the QR Code as a PNG Buffer — styled per edition, dark on light for scanning
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: config.qrSize,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark:  config.qrDark,
        light: config.qrLight,
      }
    });

    // 2. Ensure the output directory exists (outside /dist — survives deploys)
    const outDir = path.join(__dirname, '../print-assets');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // 3. Define the exact filename the printer needs to see
    const shortOrder = orderId.slice(-6).toUpperCase();
    const fileName = `ORDER-${shortOrder}_${editionKey.toUpperCase()}_PRINT-FILE.png`;
    const outPath = path.join(outDir, fileName);
    const baseImagePath = path.join(__dirname, config.baseImage);

    if (!fs.existsSync(baseImagePath)) {
        throw new Error(`Base image not found at ${baseImagePath}`);
    }

    // 4. Composite the QR onto the base image
    await sharp(baseImagePath)
      .composite([
        {
          input: qrBuffer,
          top: config.top,
          left: config.left,
          blend: 'over'
        }
      ])
      .png({ quality: 100 })
      .toFile(outPath);

    console.log(`✅ Asset generated: ${fileName}`);
    return `/print-assets/${fileName}`;

  } catch (error) {
    console.error('❌ Auto-Compositor Failed:', error.message);
    throw error;
  }
}
