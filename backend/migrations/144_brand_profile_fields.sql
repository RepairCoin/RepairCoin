-- 144_brand_profile_fields.sql
--
-- Branding Studio (onboarding AI) — Phase 2/3. The wizard's "AI Brand Analysis",
-- "Choose Marketing Style", and "Profile Ready" steps collect a richer brand
-- profile than the original kit (colors+tone+logo). Persist those so the profile
-- survives a reload and the AI can use it. All additive + nullable; existing kits
-- and image-gen are unaffected. See docs/tasks/strategy/branding-studio/.

ALTER TABLE shop_brand_kits
  ADD COLUMN IF NOT EXISTS marketing_style    TEXT,  -- e.g. "Modern & Tech"
  ADD COLUMN IF NOT EXISTS brand_voice        TEXT,  -- e.g. "Professional but Friendly"
  ADD COLUMN IF NOT EXISTS headline           TEXT,  -- e.g. "Fast Repairs. Trusted Service."
  ADD COLUMN IF NOT EXISTS brand_personality  TEXT,  -- e.g. "Professional • Friendly • Trustworthy"
  ADD COLUMN IF NOT EXISTS industry_style     TEXT;  -- e.g. "Repair & Service Business"

COMMENT ON COLUMN shop_brand_kits.marketing_style IS 'Branding Studio: the marketing style the shop picked (Professional & Corporate / Modern & Tech / Friendly & Local / Premium & Luxury).';
COMMENT ON COLUMN shop_brand_kits.brand_voice IS 'Branding Studio: brand voice descriptor shown on the Profile-Ready step.';
COMMENT ON COLUMN shop_brand_kits.headline IS 'Branding Studio: tagline/headline for campaigns.';
COMMENT ON COLUMN shop_brand_kits.brand_personality IS 'Branding Studio: AI-detected personality traits (dot-separated).';
COMMENT ON COLUMN shop_brand_kits.industry_style IS 'Branding Studio: AI-detected industry style.';
