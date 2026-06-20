-- 165 — persist the AI-generated push creative on ad_creatives so it lands in the
-- admin review (Creatives panel) as 'pending' and gates go-live until approved.
-- image_url        = the stored DO-Spaces image the Meta creative was built from
-- meta_creative_id = the Meta ad-creative this row represents (identifies the "pushed" creative)
-- generation_prompt = the image prompt used (so a regenerate can show/seed it)

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS meta_creative_id TEXT,
  ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

-- Fast lookup of a campaign's pushed creative (the AI creative on the Meta ad).
CREATE INDEX IF NOT EXISTS idx_ad_creatives_meta_creative
  ON ad_creatives (campaign_id)
  WHERE meta_creative_id IS NOT NULL AND deleted_at IS NULL;
