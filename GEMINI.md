# QONNECT Project Mandates

This file documents the core strategic decisions and vision-alignment rules for the QONNECT platform. All contributors (including AI agents) must adhere to these principles.

## 🌉 The Digital Bridge Vision
QONNECT bridges the physical and digital worlds.
- **Rule 1:** We support both **Direct URLs** (e.g., LinkedIn, Portfolio) and **QONNECT Redirects**.
- **Rule 2:** The customer chooses the destination. For Basic tiers, direct links are standard. For Standard/Premium, we offer the "Dynamic Bridge" slug (`qonnect.ai/b/:slug`) as a value-add.
- **Rule 3:** Quality is non-negotiable. Whether direct or redirect, the QR code must be high-resolution and perfectly composited.

## 🌑 Aesthetic Guidelines (Void Black / Sand)
- **Palette:** Avoid pure black (`#000`). Use `oklch(8% 0 0)` for background depth.
- **Contrast:** Typography should feel technical yet luxury (Cormorant Garamond + Inter).
- **Tactility:** All interactive elements must have a scale-down effect (`active:scale-[0.98]`) to provide physical feedback.

## 💼 Business Logic (Order-by-Order)
- **Zero Inventory:** We generate assets and fulfillment requests only after a Stripe payment and Intake completion.
- **Asset Integrity:** The link between a `Stripe Session`, a `Supabase Order`, and a `Bridge Slug` is sacred. Never allow an order to reach the supplier without a validated QR asset.

## 🛠 Technical Architecture
- **Headless:** Shopify handles the product catalog; Stripe handles the payment fee tiers.
- **Full-Stack:** The platform runs as a Node.js Express server to handle secure API calls and static serving.
- **Persistence:** Move from JSON files to Supabase/PostgreSQL for production-grade reliability.
