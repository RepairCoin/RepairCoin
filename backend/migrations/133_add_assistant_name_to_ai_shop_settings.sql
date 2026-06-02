-- 133_add_assistant_name_to_ai_shop_settings.sql
--
-- Phase 6 branding (Unified Assistant): a per-shop, shop-settable display name
-- for the assistant — the exec's "name it Adam / Cain / your pick".
--
-- NULL = unset → the UI shows the default "Assistant" and the orchestrator
-- injects no name into its prompt. Shop-editable via PUT /api/ai/settings
-- (a behavior/branding field, NOT an admin gate). 40-char cap.

ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS assistant_name VARCHAR(40);

COMMENT ON COLUMN ai_shop_settings.assistant_name IS
  'Owner-chosen display name for the unified assistant (Phase 6 branding). NULL = unset → UI shows "Assistant"; the orchestrator injects no name. Shop-editable via PUT /api/ai/settings.';
