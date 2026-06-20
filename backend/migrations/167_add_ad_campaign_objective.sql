-- 167 — explicit, admin-selectable Meta objective per campaign. When NULL, the push falls
-- back to deriving it from the request goal (objectiveForGoal). Lets the DraftComposer offer
-- a "Website clicks / Awareness / Messages" picker instead of a hardcoded objective.
--   OUTCOME_TRAFFIC    = website clicks → landing page (default, no App Review)
--   OUTCOME_AWARENESS  = reach
--   OUTCOME_ENGAGEMENT = click-to-Messenger (needs pages_messaging + App Review; not enabled yet)

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT;
