-- 149_create_ad_experiments.sql
--
-- Ads System Stage 5 — A/B testing. An experiment groups creatives of a campaign;
-- ad_creatives.experiment_id (reserved in Stage 0) links a creative to one. The
-- report splits CPL/conversion by experiment. See docs/tasks/strategy/ads-system/.

CREATE TABLE IF NOT EXISTS ad_experiments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ended')),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  winner_creative_id UUID REFERENCES ad_creatives(id),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_experiments_campaign ON ad_experiments (campaign_id);
