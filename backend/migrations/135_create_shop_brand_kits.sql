-- 135_create_shop_brand_kits.sql
--
-- AI Image Generation — Phase 3 (brand kit, G2 Option A).
-- See docs/tasks/strategy/ai-image-generation/implementation.md §4 / §7 Phase 3.
--
-- Per-shop brand kit: colors + tone injected into image-generation prompts so
-- output looks ON-BRAND (BrandKitService.buildBrandedPrompt, already shipped in
-- Phase 1 reading defensively). The actual logo is composited deterministically
-- in Phase 7 (not injected into the prompt). One row per shop.

CREATE TABLE IF NOT EXISTS shop_brand_kits (
  shop_id             VARCHAR(255) PRIMARY KEY,
  logo_url            TEXT,
  primary_color_hex   VARCHAR(7),                  -- '#FFCC00'
  secondary_color_hex VARCHAR(7),
  tone_notes          VARCHAR(500),                -- 1-2 sentence brand voice
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE shop_brand_kits IS
  'Per-shop brand kit for AI image generation (colors + tone in prompt; logo composited in Phase 7). Shop-editable via PUT /api/ai/brand-kit.';
