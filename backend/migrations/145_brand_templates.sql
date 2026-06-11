-- 145_brand_templates.sql
--
-- Branding Studio Phase 4 — typography + on-demand brand templates.
--   * heading_font / body_font on shop_brand_kits: the curated Google-Font pairing
--     (derived from marketing_style) shown in the style guide + used for previews.
--   * brand_template_assets: one row per generated template image (social post /
--     story / poster). The PNG itself lives in DO Spaces; we store the URL + meta.
-- Additive; existing kits/image-gen unaffected. See docs/tasks/strategy/branding-studio/.

ALTER TABLE shop_brand_kits
  ADD COLUMN IF NOT EXISTS heading_font TEXT,
  ADD COLUMN IF NOT EXISTS body_font    TEXT;

COMMENT ON COLUMN shop_brand_kits.heading_font IS 'Branding Studio: curated heading font (e.g. "Space Grotesk").';
COMMENT ON COLUMN shop_brand_kits.body_font IS 'Branding Studio: curated body font (e.g. "Inter").';

CREATE TABLE IF NOT EXISTS brand_template_assets (
  id            BIGSERIAL PRIMARY KEY,
  shop_id       TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  -- 'social_post' (1:1) | 'social_story' (9:16) | 'poster' (landscape)
  kind          TEXT NOT NULL,
  -- which layout variant (e.g. 'promo', 'grand_opening', 'new_service')
  template_key  TEXT NOT NULL DEFAULT 'default',
  url           TEXT NOT NULL,
  size          TEXT,                 -- gpt-image-1 size, e.g. '1024x1024'
  cost_usd      NUMERIC(10,6) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_template_assets_shop
  ON brand_template_assets (shop_id, created_at DESC);
