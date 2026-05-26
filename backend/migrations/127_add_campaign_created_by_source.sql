-- Migration: Add created_by_source column to marketing_campaigns
-- Description: Distinguishes AI-drafted campaigns from manually-built campaigns
--   so we can scope event-bus side-effects (e.g., the AI-thread confirmation
--   message in CampaignSentConfirmationHandler) only to AI-originated sends.
--   Phase 1 of the AI Marketing Campaigns workstream — sets up the data
--   so Phase 2 (AI orchestration) can write AI-drafted campaigns and the
--   confirmation handler in Phase 4 can branch on origin.

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS created_by_source VARCHAR(20) NOT NULL DEFAULT 'manual';

-- Backfill is a no-op — existing rows take the 'manual' default.

-- Index to make "all AI drafts today" queries fast (used by the
-- "50 drafts/day" guard in Phase 2's MarketingChatController).
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_source_created
  ON marketing_campaigns (shop_id, created_by_source, created_at DESC);

COMMENT ON COLUMN marketing_campaigns.created_by_source IS
  'Origin of the campaign: ''manual'' (shop built it in the existing UI) or ''ai_agent'' (drafted by the AI marketing assistant). Used to scope AI-thread confirmation messages to AI-originated sends only.';
