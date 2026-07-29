-- 249: which product surface owns a rule (Custom Workflows D7).
--
-- AI Campaigns (Advanced) and Custom Workflows are two pricing bullets sharing ONE engine and ONE
-- table. Without a discriminator both screens list each other's rules and the split is cosmetic —
-- a shop owner opening "Automation" would see marketing campaigns, and vice versa.
--
-- It cannot be derived. Not from action_type (a workflow may legitimately send a message: "on no-show
-- → text the customer"), and not from trigger_type (campaigns are event-triggered too). The only
-- honest answer is to record which surface created it.
--
-- Existing rows default to 'campaign', which is factually correct: the only surface that has ever
-- existed is Marketing → AI Campaigns.
--
-- IMPORTANT: this filters the UI lists ONLY. The scheduler must keep running every rule regardless of
-- surface — an automation that stopped firing because of which screen created it would be absurd.
-- See AutoMessageRepository: getByShopId filters, getActiveScheduleRules/getActiveEventRules do not.

ALTER TABLE shop_auto_messages
  ADD COLUMN IF NOT EXISTS surface VARCHAR(16) NOT NULL DEFAULT 'campaign';

-- The lists are per shop + surface.
CREATE INDEX IF NOT EXISTS idx_auto_messages_shop_surface
  ON shop_auto_messages (shop_id, surface);

COMMENT ON COLUMN shop_auto_messages.surface IS
  'Which product surface owns this rule: campaign (AI Campaigns Advanced) or workflow (Custom Workflows). Filters the UI lists only — the scheduler runs both.';
