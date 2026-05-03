-- =============================================================================
-- QONNECT MIGRATION v2
-- Apply to existing Supabase instance — safe to run on a live DB.
-- All statements use IF NOT EXISTS / IF EXISTS guards.
-- Run in the Supabase SQL editor or via psql.
-- =============================================================================


-- =============================================================================
-- STEP 1 — Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- =============================================================================
-- STEP 2 — Enhance profiles table
-- =============================================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS theme         TEXT DEFAULT 'business'
    CHECK (theme IN ('tech', 'medical', 'business')),
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS accent_color  TEXT,
  ADD COLUMN IF NOT EXISTS is_published  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_custom_domain_idx ON profiles (custom_domain);
CREATE        INDEX IF NOT EXISTS profiles_email_idx         ON profiles (email);


-- =============================================================================
-- STEP 3 — Enhance bridges table
-- The existing table has: id, owner_id, slug, target_url, scan_count, is_active, created_at, updated_at
-- We add: order_id, destination_type, mode, template_data
-- =============================================================================
ALTER TABLE bridges
  ADD COLUMN IF NOT EXISTS order_id         UUID,
  ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'other'
    CHECK (destination_type IN ('linkedin', 'portfolio', 'linktree', 'custom-page', 'other')),
  ADD COLUMN IF NOT EXISTS mode             TEXT DEFAULT 'bridge'
    CHECK (mode IN ('direct', 'bridge')),
  ADD COLUMN IF NOT EXISTS template_data    JSONB;

-- Ensure slug index exists (it may already as UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS bridges_slug_idx  ON bridges (slug);
CREATE        INDEX IF NOT EXISTS bridges_owner_idx  ON bridges (owner_id);
CREATE        INDEX IF NOT EXISTS bridges_order_idx  ON bridges (order_id);

-- Add FK to orders (deferred so we can create orders first if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bridges_order_id_fk'
  ) THEN
    ALTER TABLE bridges
      ADD CONSTRAINT bridges_order_id_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;


-- =============================================================================
-- STEP 4 — Enhance orders table
-- =============================================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'expired', 'refunded')),
  ADD COLUMN IF NOT EXISTS pod_provider   TEXT,
  ADD COLUMN IF NOT EXISTS pod_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS print_asset_url TEXT,
  ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;

-- Update status check constraint to include new states
-- (Postgres requires drop + re-add for CHECK constraints)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment', 'intake_required', 'ready_to_print',
    'printing', 'shipped', 'delivered', 'on_hold', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS orders_stripe_idx   ON orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS orders_email_idx    ON orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_status_idx   ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx  ON orders (created_at DESC);


-- =============================================================================
-- STEP 5 — Enhance scans table
-- Existing columns: id, bridge_id, detected_browser, detected_os, scanned_at
-- We add geo, device, referrer, dedup fields and rename old columns via aliases
-- =============================================================================
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS slug          TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash       TEXT,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS region        TEXT,
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS country_code  TEXT,
  ADD COLUMN IF NOT EXISTS device_type   TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  ADD COLUMN IF NOT EXISTS os            TEXT,
  ADD COLUMN IF NOT EXISTS browser       TEXT,
  ADD COLUMN IF NOT EXISTS referrer      TEXT,
  ADD COLUMN IF NOT EXISTS referrer_domain TEXT,
  ADD COLUMN IF NOT EXISTS is_unique     BOOLEAN DEFAULT FALSE;

-- Backfill slug from bridge for existing rows (best-effort)
UPDATE scans s
SET slug = b.slug
FROM bridges b
WHERE s.bridge_id = b.id AND s.slug IS NULL;

-- Backfill os/browser from old column names if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='detected_os') THEN
    UPDATE scans SET os = detected_os WHERE os IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='detected_browser') THEN
    UPDATE scans SET browser = detected_browser WHERE browser IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scans_bridge_idx   ON scans (bridge_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS scans_slug_idx     ON scans (slug, scanned_at DESC);
CREATE INDEX IF NOT EXISTS scans_country_idx  ON scans (country_code);
CREATE INDEX IF NOT EXISTS scans_unique_idx   ON scans (bridge_id, ip_hash, scanned_at DESC);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 6 — New table: order_emails
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_emails (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  email_to    TEXT NOT NULL,
  template    TEXT NOT NULL,
  subject     TEXT,
  provider_id TEXT,
  status      TEXT DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'bounced', 'opened')),
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_emails_order_idx    ON order_emails (order_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS order_emails_template_idx ON order_emails (order_id, template);
ALTER TABLE order_emails ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 7 — New table: shipments
-- =============================================================================
CREATE TABLE IF NOT EXISTS shipments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id          UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  pod_provider      TEXT,
  pod_shipment_id   TEXT,
  carrier           TEXT,
  tracking_number   TEXT,
  tracking_url      TEXT,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'exception')),
  estimated_delivery DATE,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipments_order_idx    ON shipments (order_id);
CREATE INDEX IF NOT EXISTS shipments_tracking_idx ON shipments (tracking_number);
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 8 — Triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'bridges_updated_at') THEN
    CREATE TRIGGER bridges_updated_at
      BEFORE UPDATE ON bridges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_updated_at') THEN
    CREATE TRIGGER orders_updated_at
      BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'shipments_updated_at') THEN
    CREATE TRIGGER shipments_updated_at
      BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Auto-increment scan_count on bridges when a scan is inserted
CREATE OR REPLACE FUNCTION increment_scan_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bridges SET scan_count = scan_count + 1 WHERE id = NEW.bridge_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'scans_increment_count') THEN
    CREATE TRIGGER scans_increment_count
      AFTER INSERT ON scans FOR EACH ROW EXECUTE FUNCTION increment_scan_count();
  END IF;
END $$;


-- =============================================================================
-- STEP 9 — RLS Policies
-- =============================================================================

-- Profiles
DROP POLICY IF EXISTS "profiles: own row" ON profiles;
CREATE POLICY "profiles: own row"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Bridges: owners manage; public can read active bridges
DROP POLICY IF EXISTS "bridges: owner full access" ON bridges;
CREATE POLICY "bridges: owner full access"
  ON bridges FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "bridges: public read active" ON bridges;
CREATE POLICY "bridges: public read active"
  ON bridges FOR SELECT
  USING (is_active = TRUE);

-- Orders: customers see their own
DROP POLICY IF EXISTS "orders: own" ON orders;
CREATE POLICY "orders: own"
  ON orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Scans: bridge owners see analytics for their slugs
DROP POLICY IF EXISTS "scans: bridge owner" ON scans;
CREATE POLICY "scans: bridge owner"
  ON scans FOR SELECT
  USING (
    bridge_id IN (SELECT id FROM bridges WHERE owner_id = auth.uid())
  );

-- Order emails: customers see their own
DROP POLICY IF EXISTS "order_emails: own" ON order_emails;
CREATE POLICY "order_emails: own"
  ON order_emails FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Shipments: customers see their own
DROP POLICY IF EXISTS "shipments: own" ON shipments;
CREATE POLICY "shipments: own"
  ON shipments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );


-- =============================================================================
-- STEP 10 — Analytics Views
-- =============================================================================
CREATE OR REPLACE VIEW bridge_scan_summary AS
SELECT
  b.id                                                              AS bridge_id,
  b.slug,
  b.owner_id,
  b.scan_count                                                      AS total_scans,
  COUNT(s.id) FILTER (WHERE s.is_unique)                           AS unique_scans,
  COUNT(s.id) FILTER (WHERE s.scanned_at > NOW() - INTERVAL '7d')  AS scans_7d,
  COUNT(s.id) FILTER (WHERE s.scanned_at > NOW() - INTERVAL '30d') AS scans_30d,
  MAX(s.scanned_at)                                                 AS last_scanned_at,
  MODE() WITHIN GROUP (ORDER BY s.country_code)                     AS top_country,
  MODE() WITHIN GROUP (ORDER BY s.device_type)                      AS top_device,
  MODE() WITHIN GROUP (ORDER BY s.referrer_domain)                  AS top_referrer
FROM bridges b
LEFT JOIN scans s ON s.bridge_id = b.id
GROUP BY b.id, b.slug, b.owner_id, b.scan_count;

CREATE OR REPLACE VIEW order_pipeline AS
SELECT
  o.id,
  o.stripe_session_id,
  o.customer_email,
  o.payment_status,
  o.status,
  o.pod_provider,
  o.pod_order_id,
  o.created_at,
  o.updated_at,
  COUNT(b.id)                AS bridge_count,
  BOOL_AND(b.id IS NOT NULL) AS all_bridges_created,
  sh.status                  AS shipment_status,
  sh.tracking_number,
  sh.tracking_url,
  sh.estimated_delivery
FROM orders o
LEFT JOIN bridges  b  ON b.order_id = o.id
LEFT JOIN shipments sh ON sh.order_id = o.id
GROUP BY
  o.id, o.stripe_session_id, o.customer_email, o.payment_status, o.status,
  o.pod_provider, o.pod_order_id, o.created_at, o.updated_at,
  sh.status, sh.tracking_number, sh.tracking_url, sh.estimated_delivery
ORDER BY o.created_at DESC;
