# QONNECT

**Dynamic QR code hoodies that replace business cards.**

[qonnect.work](https://qonnect.work)

---

## The Problem

Business cards are wasteful, static, and forgettable. You hand them out at events, they end up in a drawer, and the moment your role or link changes the card is obsolete. Worse — nobody carries them consistently.

## The Solution

QONNECT prints a dynamic QR code on the back of a premium hoodie. Scan it, and it resolves to whatever URL the owner has set — LinkedIn today, a portfolio tomorrow, an event page next week. One hoodie, unlimited destinations, zero reprints. Wearable networking that is always with you and always current.

---

## How It Works

1. **Buy a hoodie** — choose your design from the storefront.
2. **Scan the QR code** on the back.
3. **Claim it** to your QONNECT account (magic-link email verification).
4. **Set your destination URL** — LinkedIn, portfolio, personal site, anything.
5. **Change it anytime** from the Members dashboard. The printed QR never changes; the destination does.

---

## Key Innovation — The Dynamic Bridge System

Every QR code physically printed on a hoodie encodes a permanent bridge URL:

```
https://qonnect.work/b/:slug
```

The server resolves the slug in real time and performs a 302 redirect to whatever destination the owner has configured. Because the QR itself only points to the bridge, the owner can swap destinations freely without touching the physical garment.

```
┌──────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  Scan QR on  │──────▶│  qonnect.work/b/ │──────▶│  Destination    │
│  hoodie back │       │  :slug (Bridge)   │       │  (user-defined) │
└──────────────┘       └──────────────────┘       └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Log scan event  │
                       │  (geo, device,   │
                       │   timestamp)     │
                       └──────────────────┘
```

The bridge URL is permanent. The destination is not. That is the entire trick.

---

## Features

- **Dynamic QR Redirect** — Change where your hoodie points to at any time, from anywhere.
- **Members Dashboard** — Manage your bridge destination, view profile, and control your hoodie identity.
- **Scan Analytics** — Every scan is logged with geolocation, device type, timestamp, and referrer. Deduplication prevents inflated counts. Full analytics dashboard per bridge.
- **Gift & Claim Flow** — Buy a hoodie as a gift. The recipient scans the QR, enters their email, and claims it to their own account via HMAC-signed verification. No account needed at purchase time.
- **AI Art QR Codes** — Generate artistic QR codes via Replicate that remain scannable while looking like designed artwork.
- **Optical Centering** — Gemini Vision AI analyzes hoodie mockup assets to compute precise QR placement, compensating for fabric folds and asymmetry.
- **Automated Fulfillment Pipeline** — Order placement, QR generation, mockup compositing, email notifications, and shipping updates are handled end-to-end.
- **Transactional Email** — Order confirmations, shipping notifications, intake reminders, and claim instructions via Resend.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand |
| **Backend** | Node.js, Express 5, Zod validation, Helmet, rate limiting |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Auth** | Supabase Auth — magic link (passwordless) |
| **Payments** | Stripe (checkout sessions, webhooks, payment processing) |
| **E-commerce** | Shopify Storefront API (headless product catalog) |
| **QR Generation** | `qrcode` (PNG/SVG server-side) + Replicate (AI art QR) |
| **Image Processing** | Sharp (QR-on-hoodie compositing) + Gemini Vision AI (optical centering) |
| **Email** | Resend (transactional) |
| **Deployment** | Docker → AWS App Runner |
| **Security** | HMAC-signed claim tokens, input validation (Zod), rate limiting, helmet headers |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                     │
│              React SPA  ·  Vite  ·  Tailwind                │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express API Server                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Stripe   │  │ Bridge   │  │ QR / Art  │  │ Admin &   │  │
│  │ Webhooks │  │ Resolver │  │ Pipeline  │  │ Fulfill.  │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
└────────┬──────────┬──────────────┬──────────────┬───────────┘
         │          │              │              │
         ▼          ▼              ▼              ▼
   ┌──────────┐ ┌────────┐  ┌──────────┐  ┌──────────┐
   │ Stripe   │ │Supabase│  │Replicate │  │  Resend  │
   │ API      │ │Postgres│  │ (AI QR)  │  │ (Email)  │
   └──────────┘ └────────┘  └──────────┘  └──────────┘
```

---

## Local Development

```sh
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD

# Start the dev server (frontend)
npm run dev

# Start the backend
npm run server
```

---

## Database Schema (Supabase)

| Table | Purpose |
| :--- | :--- |
| `profiles` | User accounts and preferences |
| `bridges` | QR slug → destination URL mappings |
| `orders` | Stripe order records and status |
| `scans` | Scan event log (geo, device, timestamp, bridge FK) |
| `shipments` | Fulfillment and shipping tracking |
| `order_emails` | Transactional email audit log |

All tables enforce Row-Level Security policies scoped to the authenticated user.

---

## Built in 3 Days

QONNECT was designed, built, and shipped by a single developer in three days — from concept through payment integration, QR pipeline, analytics dashboard, gift claiming flow, and production deployment on AWS.

---

**Live at [qonnect.work](https://qonnect.work)**
