-- 170 — the shop's Meta Pixel id (on its own ad account), captured at account selection.
-- The public ad landing page loads this pixel and fires PageView + a "Lead" event on form
-- submit, so conversions attribute back to the shop's ad account (no App Review needed) and
-- the campaign can later optimize for leads instead of raw clicks.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
