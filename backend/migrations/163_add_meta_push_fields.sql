-- 163_add_meta_push_fields.sql
--
-- Ads System Stage-4 PUSH (automated campaign creation). When the admin builds a request,
-- FixFlow creates the real objects on the shop's Meta ad account; these columns store the
-- returned ids so we can edit/activate/sync them. `meta_campaign_id` already exists (mig 148).
--   * meta_adset_id / meta_ad_id / meta_creative_id — the created Meta objects
--   * meta_lead_form_id — the Page leadgen form (leads arrive via the existing webhook)
--   * meta_status — last-known Meta status (PAUSED|ACTIVE|…); drives the Go-live gate (Option B)
--   * meta_last_synced_at — last insights sync (Phase 3)
-- See docs/tasks/strategy/ads-system/ads-marketing-api-push-implementation-plan.md.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS meta_adset_id       TEXT,
  ADD COLUMN IF NOT EXISTS meta_ad_id          TEXT,
  ADD COLUMN IF NOT EXISTS meta_creative_id    TEXT,
  ADD COLUMN IF NOT EXISTS meta_lead_form_id   TEXT,
  ADD COLUMN IF NOT EXISTS meta_status         TEXT,
  ADD COLUMN IF NOT EXISTS meta_last_synced_at TIMESTAMPTZ;
