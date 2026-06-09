-- 137_add_campaign_rewards_enabled.sql
--
-- Campaign Rewards — Phase 0. Per-shop admin kill switch, mirroring
-- ai_images_enabled (migration 134). Default OFF for a controlled rollout:
-- a shop can't attach or fulfill a campaign reward until an admin enables it
-- in the AI settings tab. See docs/tasks/strategy/campaign-rewards/.

ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS campaign_rewards_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ai_shop_settings.campaign_rewards_enabled IS
  'Admin gate: when true, this shop may attach RCN/coupon rewards to marketing campaigns and have them fulfilled. Default false.';
