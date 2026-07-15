-- WS2 — AI Image Generation is now a Growth+ TIER feature, enforced by the
-- `aiImageGen` entitlement in ImageGenerationService.checkGates (tier checked
-- FIRST). The per-shop `ai_shop_settings.ai_images_enabled` flag is therefore no
-- longer an entitlement gate — it's just the admin OPT-OUT.
--
-- Its old default of FALSE (a "controlled rollout" artifact, migrations 134/000)
-- is now wrong: a brand-new Growth/Business shop that PAYS for image generation
-- would start with it off and hit "ask an admin to enable it" — a dead end. So
-- the default should be ON. An admin can still turn it OFF per shop; and Starter
-- shops are blocked by the tier gate regardless of this flag, so a global
-- default-on is safe (the flag is inert for below-tier shops).

-- 1. New shops now default to ON (provisioning inserts don't set this column, so
--    they inherit the default).
ALTER TABLE ai_shop_settings ALTER COLUMN ai_images_enabled SET DEFAULT true;

-- 2. Backfill existing shops to ON. The prior default-off was a rollout default,
--    not an intentional per-shop choice; any shop that wants it off can be toggled
--    off by an admin afterward. Entitled (Growth+) shops get it out of the box;
--    Starter shops stay blocked by the tier gate.
UPDATE ai_shop_settings SET ai_images_enabled = true WHERE ai_images_enabled = false;
