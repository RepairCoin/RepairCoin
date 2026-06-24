-- 180 — two-way Meta ⇄ app config sync, Phase 3 (targeting + objective reflect).
-- Stores the live ad set's targeting spec verbatim as read-only fidelity. We reflect the objective
-- and a best-effort radius (km→mi) into our typed columns for display, but rich targeting
-- (interests, demographics, custom audiences) can't be losslessly round-tripped through our model,
-- so we keep the raw JSON here and NEVER reverse-push it (D4). Idempotent.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS meta_targeting_raw JSONB;
