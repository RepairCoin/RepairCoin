-- 181 — per-campaign landing-page magnet config (Phase 2 of the landing conversion work). A JSONB
-- blob so shops can override the auto-composed defaults: hero headline/subhead, urgency text,
-- benefit bullets, CTA label, whether to show the rating, and an opt-in "Call now" button. Null =
-- pure auto-compose (Phase 1 behavior). Idempotent.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS landing_config JSONB;
