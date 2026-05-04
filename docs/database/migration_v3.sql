-- =============================================================================
-- QONNECT — Migration v3: AI Art QR support
-- Run once on your Supabase project (SQL Editor → Run)
-- Safe to re-run (IF NOT EXISTS guards throughout)
-- =============================================================================

-- Add qr_art_url column to bridges table
-- Stores the Replicate-generated AI art QR image URL once ready
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bridges' AND column_name = 'qr_art_url'
  ) THEN
    ALTER TABLE bridges ADD COLUMN qr_art_url TEXT DEFAULT NULL;
    COMMENT ON COLUMN bridges.qr_art_url IS 'URL of the AI-generated art QR image (via Replicate illusion-diffusion). NULL while pending.';
  END IF;
END $$;
