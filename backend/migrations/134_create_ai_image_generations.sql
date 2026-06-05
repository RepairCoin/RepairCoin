-- 134_create_ai_image_generations.sql
--
-- AI Image Generation — Phase 1 (shared image infrastructure).
-- See docs/tasks/strategy/ai-image-generation/implementation.md §4.
--
-- Two changes:
--   1. ai_image_generations — audit / system-of-record for every image call.
--      operation_type covers generate AND edit up front (Phase 6 edit reuses
--      this table; no future ALTER needed).
--   2. ai_images_enabled — per-shop kill switch on ai_shop_settings. Default
--      FALSE → dark launch; flip per shop to enable. Mirrors the Sales Agent's
--      ai_global_enabled / ai_sales_enabled gating.

CREATE TABLE IF NOT EXISTS ai_image_generations (
  id                 BIGSERIAL PRIMARY KEY,
  shop_id            VARCHAR(255) NOT NULL,
  operation_type     VARCHAR(16)  NOT NULL,          -- 'generate' | 'edit'
  vendor             VARCHAR(32)  NOT NULL,          -- 'openai' | 'stability'
  model              VARCHAR(64)  NOT NULL,          -- 'dall-e-3' | 'sd3.5-large'
  prompt             TEXT         NOT NULL,
  source_image_url   TEXT,                            -- edits only
  image_url          TEXT,                            -- persisted DO Spaces URL (NULL on failure)
  image_key          TEXT,                            -- DO Spaces key (for later delete)
  dimensions         VARCHAR(16),                     -- '1024x1024' etc.
  use_case           VARCHAR(32),                     -- 'marketing' | 'ad'
  cost_usd           NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms         INTEGER,
  moderation_flagged BOOLEAN       NOT NULL DEFAULT false,
  error_message      TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_image_gen_shop_created
  ON ai_image_generations (shop_id, created_at DESC);

COMMENT ON TABLE ai_image_generations IS
  'Audit/system-of-record for AI image generation + editing (shared image infra). operation_type=generate|edit; one row per call, success OR failure.';

-- Per-shop kill switch. Default FALSE = dark launch.
ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS ai_images_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_shop_settings.ai_images_enabled IS
  'Per-shop gate for AI image generation/editing. FALSE = disabled (default). Flip to enable a shop once brand kit + spend cap are set.';
