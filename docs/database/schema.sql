-- =============================================================================
-- QONNECT DATABASE SCHEMA v2
-- Supabase / PostgreSQL
-- =============================================================================
-- Tables: profiles, bridges, orders, scans, order_emails, shipments
-- Includes: RLS, indexes, triggers, helper functions
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy slug search


-- =============================================================================
-- 1. PROFILES
-- Linked to auth.users. Covers both customers and admins.
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  full_name        TEXT,
  role             TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),

  -- Identity card customization (shown on /b/:slug template pages)
  display_name     TEXT,
  bio              TEXT,
  theme            TEXT DEFAULT 'business' CHECK (theme IN ('tech', 'medical', 'business')),
  avatar_url       TEXT,
  accent_color     TEXT,                          -- hex override, e.g. '#22c55e'
  is_published     BOOLEAN DEFAULT TRUE,          -- can hide profile without deleting
  custom_domain    TEXT UNIQUE,                   -- e.g. 'ali.qonnect.co'

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx       ON profiles (email);
CREATE INDEX IF NOT EXISTS profiles_custom_domain_idx ON profiles (custom_domain);


-- =============================================================================
-- 2. BRIDGES
-- One row per QR slug. The authoritative source for all slug lookups.
-- No more slugs buried in intake_data JSONB.
-- =============================================================================
CREATE TABLE IF NOT EXISTS bridges (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,          -- e.g. 'ali-777'

  -- Ownership (null until customer claims their account)
  owner_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Order link (set when intake is submitted)
  order_id         UUID,                          -- references orders(id) — added after orders table

  -- Destination
  target_url       TEXT NOT NULL,                 -- the raw URL provided by customer
  destination_type TEXT DEFAULT 'other'
    CHECK (destination_type IN (
      'linkedin', 'portfolio', 'linktree', 'custom-page', 'other'
    )),
  mode             TEXT DEFAULT 'bridge'
    CHECK (mode IN ('direct', 'bridge')),

  -- For custom-page / template destinations
  template_data    JSONB,                         -- { edition, brief, ... }

  -- State
  is_active        BOOLEAN DEFAULT TRUE,
  scan_count       INTEGER DEFAULT 0,             -- denormalized for fast reads

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bridges_slug_idx  ON bridges (slug);
CREATE        INDEX IF NOT EXISTS bridges_owner_idx  ON bridges (owner_id);
CREATE        INDEX IF NOT EXISTS bridges_order_idx  ON bridges (order_id);


-- =============================================================================
-- 3. ORDERS
-- Financial and fulfillment state. One order = one Stripe checkout session.
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id   TEXT UNIQUE NOT NULL,

  -- Customer
  customer_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email      TEXT,

  -- Items stored as JSONB array (title, tier, price, variantTitle, quantity, imageUrl, selectedOptions)
  items               JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Intake blob (kept for backward compat; bridge rows are the source of truth for slugs)
  intake_data         JSONB,

  -- Payment
  payment_status      TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'expired', 'refunded')),

  -- Fulfillment
  status              TEXT DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'intake_required', 'ready_to_print',
      'printing', 'shipped', 'delivered', 'on_hold', 'cancelled'
    )),

  -- Print-on-demand supplier
  pod_provider        TEXT,                       -- 'printful' | 'gelato' | 'custom'
  pod_order_id        TEXT,                       -- supplier's order reference
  print_asset_url     TEXT,                       -- S3/Cloudflare URL for print-ready PDF

  -- Shopify (if re-integrated)
  shopify_order_id    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Back-fill the FK now that both tables exist
ALTER TABLE bridges
  ADD CONSTRAINT bridges_order_id_fk
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS orders_stripe_idx      ON orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx    ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_email_idx       ON orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_status_idx      ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx     ON orders (created_at DESC);


-- =============================================================================
-- 4. SCANS
-- One row per QR scan event. Privacy-safe: IPs are hashed, not stored raw.
-- =============================================================================
CREATE TABLE IF NOT EXISTS scans (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_id        UUID REFERENCES bridges(id) ON DELETE CASCADE NOT NULL,
  slug             TEXT NOT NULL,                 -- denormalized for fast analytics queries

  -- Privacy-safe identity (for dedup)
  ip_hash          TEXT,                          -- SHA-256 of IP — never store raw IP

  -- Geo (resolved server-side from IP before hashing)
  city             TEXT,
  region           TEXT,
  country          TEXT,
  country_code     TEXT,                          -- ISO 3166-1 alpha-2, e.g. 'SA'

  -- Device
  device_type      TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  os               TEXT,                          -- 'iOS', 'Android', 'Windows', 'macOS', etc.
  browser          TEXT,                          -- 'Chrome', 'Safari', 'Firefox', etc.

  -- Traffic source
  referrer         TEXT,                          -- full referrer URL (truncated to 500 chars)
  referrer_domain  TEXT,                          -- just the domain, e.g. 'linkedin.com'

  -- Dedup flag (first scan from this ip_hash for this bridge in 24h window)
  is_unique        BOOLEAN DEFAULT FALSE,

  scanned_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scans_bridge_idx       ON scans (bridge_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS scans_slug_idx         ON scans (slug, scanned_at DESC);
CREATE INDEX IF NOT EXISTS scans_country_idx      ON scans (country_code);
CREATE INDEX IF NOT EXISTS scans_unique_idx       ON scans (bridge_id, ip_hash, scanned_at DESC);


-- =============================================================================
-- 5. ORDER EMAILS
-- Tracks every outbound email so we can deduplicate reminders and audit sends.
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  email_to         TEXT NOT NULL,
  template         TEXT NOT NULL,                 -- 'payment-confirmed' | 'intake-reminder' | 'shipped' | etc.
  subject          TEXT,
  provider_id      TEXT,                          -- Resend / SendGrid message ID
  status           TEXT DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'bounced', 'opened')),
  sent_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_emails_order_idx     ON order_emails (order_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS order_emails_template_idx  ON order_emails (order_id, template);


-- =============================================================================
-- 6. SHIPMENTS
-- Tracks print-on-demand fulfillment and carrier tracking.
-- =============================================================================
CREATE TABLE IF NOT EXISTS shipments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  pod_provider     TEXT,
  pod_shipment_id  TEXT,
  carrier          TEXT,                          -- 'DHL', 'FedEx', 'SMSA', etc.
  tracking_number  TEXT,
  tracking_url     TEXT,
  status           TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'exception')),
  estimated_delivery DATE,
  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipments_order_idx   ON shipments (order_id);
CREATE INDEX IF NOT EXISTS shipments_tracking_idx ON shipments (tracking_number);


-- =============================================================================
-- TRIGGERS — auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER bridges_updated_at
  BEFORE UPDATE ON bridges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- TRIGGER — increment bridges.scan_count on each scan insert
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_scan_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bridges SET scan_count = scan_count + 1 WHERE id = NEW.bridge_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER scans_increment_count
  AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION increment_scan_count();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments    ENABLE ROW LEVEL SECURITY;

-- Profiles: users see and edit only their own row
CREATE POLICY "profiles: own row"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Bridges: owners see their own; public can read active bridges (for QR resolution)
CREATE POLICY "bridges: owner full access"
  ON bridges FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "bridges: public read active"
  ON bridges FOR SELECT
  USING (is_active = TRUE);

-- Orders: customers see only their own
CREATE POLICY "orders: own"
  ON orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Scans: owners see scans for their bridges
CREATE POLICY "scans: bridge owner"
  ON scans FOR SELECT
  USING (
    bridge_id IN (
      SELECT id FROM bridges WHERE owner_id = auth.uid()
    )
  );

-- Order emails: customer sees their own
CREATE POLICY "order_emails: own"
  ON order_emails FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Shipments: customer sees their own
CREATE POLICY "shipments: own"
  ON shipments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Service role bypasses all RLS (backend uses service role key)


-- =============================================================================
-- ANALYTICS HELPER VIEWS
-- =============================================================================

-- Scan summary per bridge (used by member dashboard)
CREATE OR REPLACE VIEW bridge_scan_summary AS
SELECT
  b.id            AS bridge_id,
  b.slug,
  b.owner_id,
  b.scan_count                                           AS total_scans,
  COUNT(s.id) FILTER (WHERE s.is_unique)                 AS unique_scans,
  COUNT(s.id) FILTER (WHERE s.scanned_at > NOW() - INTERVAL '7 days')  AS scans_7d,
  COUNT(s.id) FILTER (WHERE s.scanned_at > NOW() - INTERVAL '30 days') AS scans_30d,
  MAX(s.scanned_at)                                      AS last_scanned_at,
  MODE() WITHIN GROUP (ORDER BY s.country_code)          AS top_country,
  MODE() WITHIN GROUP (ORDER BY s.device_type)           AS top_device
FROM bridges b
LEFT JOIN scans s ON s.bridge_id = b.id
GROUP BY b.id, b.slug, b.owner_id, b.scan_count;

-- Order pipeline view (used by admin dashboard)
CREATE OR REPLACE VIEW order_pipeline AS
SELECT
  o.id,
  o.stripe_session_id,
  o.customer_email,
  o.payment_status,
  o.status,
  o.created_at,
  o.updated_at,
  COUNT(b.id)                                     AS bridge_count,
  BOOL_AND(b.id IS NOT NULL)                      AS all_bridges_created,
  sh.status                                       AS shipment_status,
  sh.tracking_number,
  sh.tracking_url
FROM orders o
LEFT JOIN bridges b  ON b.order_id = o.id
LEFT JOIN shipments sh ON sh.order_id = o.id
GROUP BY o.id, o.stripe_session_id, o.customer_email, o.payment_status,
         o.status, o.created_at, o.updated_at, sh.status, sh.tracking_number, sh.tracking_url
ORDER BY o.created_at DESC;
