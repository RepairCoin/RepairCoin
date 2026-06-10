-- 143_brand_onboarding.sql
--
-- Branding Studio (onboarding AI) — Phase 1. First-run gate: when a shop has
-- completed (or skipped) the Branding Studio wizard we stamp this, so the wizard
-- only auto-opens on first dashboard load and not every login. Additive; existing
-- brand kits / image-gen unaffected. See docs/tasks/strategy/branding-studio/.

ALTER TABLE shop_brand_kits
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN shop_brand_kits.onboarding_completed_at IS
  'When the shop finished or skipped the Branding Studio onboarding wizard. NULL = not done (auto-open the wizard on first dashboard load).';
