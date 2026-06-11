-- 141_campaign_rewards.sql
--
-- Campaign Rewards — Phase 0 (foundation).
-- See docs/tasks/strategy/campaign-rewards/.
--
-- Lets a marketing campaign carry a real reward (RCN flat/variable, or a
-- coupon) that the system fulfills on send or when the customer returns —
-- instead of campaigns being message-only. These columns are additive and
-- default to a no-reward campaign, so every existing campaign is unaffected.

-- Reward configuration on the campaign.
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS reward_type         TEXT NOT NULL DEFAULT 'none',  -- none | rcn | coupon
  ADD COLUMN IF NOT EXISTS reward_mode         TEXT,                          -- flat | by_tier | by_spend (rcn)
  ADD COLUMN IF NOT EXISTS reward_rcn_amount   NUMERIC(12,2),                 -- flat amount per recipient
  ADD COLUMN IF NOT EXISTS reward_rcn_by_tier  JSONB,                         -- {"BRONZE":x,"SILVER":y,"GOLD":z}
  ADD COLUMN IF NOT EXISTS reward_spend_bands  JSONB,                         -- [{"minSpend":0,"rcn":10},...]
  ADD COLUMN IF NOT EXISTS fulfillment_trigger TEXT NOT NULL DEFAULT 'on_send', -- on_send | on_return
  ADD COLUMN IF NOT EXISTS return_window_days  INT;                           -- on_return validity window

COMMENT ON COLUMN marketing_campaigns.reward_type IS
  'Reward attached to the campaign: none | rcn | coupon. Default none = message-only (unchanged behavior).';
COMMENT ON COLUMN marketing_campaigns.fulfillment_trigger IS
  'When the reward lands: on_send (immediately) | on_return (when the customer next completes an order).';

-- Per-recipient reward ledger (the idempotency anchor for fulfillment + retries).
ALTER TABLE marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS reward_kind        TEXT,                           -- rcn | coupon
  ADD COLUMN IF NOT EXISTS reward_amount      NUMERIC(12,2),                  -- RCN issued / coupon value
  ADD COLUMN IF NOT EXISTS reward_status      TEXT,                           -- pending|issued|redeemed|skipped|failed|expired
  ADD COLUMN IF NOT EXISTS reward_promo_code  TEXT,                           -- per-recipient coupon code
  ADD COLUMN IF NOT EXISTS reward_tx_hash     TEXT,                           -- on-chain mint tx
  ADD COLUMN IF NOT EXISTS reward_issued_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_expires_at  TIMESTAMPTZ,                     -- on_return / coupon expiry
  ADD COLUMN IF NOT EXISTS reward_error       TEXT;

COMMENT ON COLUMN marketing_campaign_recipients.reward_status IS
  'Per-recipient reward state. The UNIQUE(campaign_id, customer_address) row prevents double-fulfillment across send retries and redemption events.';

-- Fast lookup for the redeem-on-return handler: find a customer's pending reward.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_reward_lookup
  ON marketing_campaign_recipients (customer_address, reward_status);
