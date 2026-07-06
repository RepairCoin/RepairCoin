-- 205 — AI-initiated first contact (Part B). Per-campaign engagement mode governs whether the AI
-- reaches out FIRST when a lead is captured (distinct from ai_agent_enabled, which answers inbound
-- replies):
--   off   — no AI outreach (manual only; today's behaviour)
--   draft — AI drafts, a human sends (the existing draft button)
--   auto  — AI sends the first outreach automatically (new; behind ADS_AI_INITIATE_ENABLED)
-- Default 'off' so existing campaigns never auto-send until a shop opts in. Idempotent.
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS ai_outreach_mode TEXT NOT NULL DEFAULT 'off';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ad_campaigns' AND constraint_name = 'ad_campaigns_ai_outreach_mode_chk'
  ) THEN
    ALTER TABLE ad_campaigns
      ADD CONSTRAINT ad_campaigns_ai_outreach_mode_chk CHECK (ai_outreach_mode IN ('off','draft','auto'));
  END IF;
END $$;
