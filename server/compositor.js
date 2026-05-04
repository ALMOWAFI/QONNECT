import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// These coordinates are estimations based on the 772x579 web mockups.
// When you get the 300-DPI high-res master files from the designer,
// update the baseImage paths and these top/left/qrSize coordinates.
const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/tech-edition.png',
    qrSize: 120, // Size of the QR code in pixels
    left: 326,   // X coordinate (pixels from left)
    top: 229,    // Y coordinate (pixels from top)
  },
  'medicine': {
    baseImage: '../src/assets/med-edition.png',
    qrSize: 186,
    left: 507,
    top: 355,
  },
  'business': {
    baseImage: '../src/assets/hero-hoodie.png',
    qrSize: 120,
    left: 326,
    top: 229,
  },
  'default': {
    baseImage: '../src/assets/hero-hoodie.png',
    qrSize: 120,
    left: 326,
    top: 229,
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
  const qrUrl = `https://qonnect.ai/b/${slug}`;

  console.log(`🖼️ Auto-Compositing ${editionKey} design for order ${orderId} (Slug: ${slug})`);

  try {
    // 1. Generate the QR Code as a transparent PNG Buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: config.qrSize,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#ffffff',     // White QR blocks
        light: '#00000000'   // 100% Transparent background
      }
    });

    // 2. Ensure the output directory exists
    const outDir = path.join(__dirname, '../dist/print-assets');
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
