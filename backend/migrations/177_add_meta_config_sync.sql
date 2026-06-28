-- 177 — two-way Meta ⇄ app config sync (Phase 1). Records when a campaign's config was last
-- pulled back FROM Meta (budget/status reconcile), distinct from meta_last_synced_at (insights
-- spend sync). Gated by ADS_META_CONFIG_SYNC. See ads-meta-two-way-sync-implementation-plan.md.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS meta_synced_config_at TIMESTAMPTZ;
