import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// QR sizes are set for HIGH-RESOLUTION print files (300 DPI target).
// Current values assume the web mockup dimensions (772x579px).
// When high-res master files arrive from the designer, update baseImage
// paths and scale all coordinates proportionally.
//
// Rule of thumb: at 300 DPI, 1 inch = 300px. A 1" QR = 300px, 2" = 600px.
// The current mockup images are ~772px wide at ~96 DPI (≈8 inches).
// We're treating qrSize as the pixel size within the source image dimensions.
const EDITION_CONFIG = {
  'robotics': {
    baseImage: '../src/assets/tech-edition.png',
    qrSize: 600, // ~2 inches at 300 DPI — safe minimum for scanning on fabric
    left: 265,   // X coordinate (pixels from left) — centered on placeholder
    top: 168,    // Y coordinate (pixels from top)
  },
  'medicine': {
    baseImage: '../src/assets/med-edition.png',
    qrSize: 600,
    left: 415,
    top: 270,
  },
  'business': {
    baseImage: '../src/assets/hero-hoodie.png',
    qrSize: 600,
    left: 265,
    top: 168,
  },
  'default': {
    baseImage: '../src/assets/hero-hoodie.png',
    qrSize: 600,
    left: 265,
    top: 168,
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
    // 1. Generate the QR Code as a transparent PNG Buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: config.qrSize,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#ffffff',     // White QR blocks
        light: '#00000000'   // 100% Transparent background
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
