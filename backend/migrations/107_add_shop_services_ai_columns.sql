-- Migration: Add AI Sales Assistant configuration columns to shop_services
-- Persists the per-service AI Sales Assistant settings the shop owner configures
-- on the create/edit page (toggle, tone, upsell suggestion, booking assistance,
-- optional custom instructions). UI shipped in Phase 1; this migration unblocks
-- backend persistence (Phase 2). AI behavior itself ships in Phase 3 once
-- Anthropic Claude integration lands.
--
-- Defaults make existing services opt out — the feature is opt-in per-service.

-- Step 1: Add the columns
ALTER TABLE shop_services
  ADD COLUMN IF NOT EXISTS ai_sales_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_tone VARCHAR(20) DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS ai_suggest_upsells BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_booking_assistance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_custom_instructions TEXT;

-- Step 2: Enforce valid tone values at the DB level. All existing rows already
-- have ai_tone='professional' (from the DEFAULT above) which satisfies the
-- constraint, so no NOT VALID + VALIDATE dance needed here.
ALTER TABLE shop_services
  ADD CONSTRAINT chk_shop_services_ai_tone
  CHECK (ai_tone IN ('friendly', 'professional', 'urgent'));

-- Step 3: Document each column for future readers
COMMENT ON COLUMN shop_services.ai_sales_enabled IS
  'Whether the AI Sales Assistant is enabled for this service. Default false (opt-in per-service).';
COMMENT ON COLUMN shop_services.ai_tone IS
  'Tone for AI responses on this service. One of: friendly, professional, urgent.';
COMMENT ON COLUMN shop_services.ai_suggest_upsells IS
  'When true, the AI may mention related services from the same shop in conversation.';
COMMENT ON COLUMN shop_services.ai_booking_assistance IS
  'When true, the AI helps customers book appointments inline (vs. text-only Q&A).';
COMMENT ON COLUMN shop_services.ai_custom_instructions IS
  'Optional shop-authored instructions that customize AI behavior for this service (e.g., "always mention 30-day warranty"). Phase 2 stores this column but no UI exposes it yet.';
