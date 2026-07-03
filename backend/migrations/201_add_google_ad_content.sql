-- 201 — Google Search composer. Store the RSA copy + keywords locally so the dashboard can display
-- and edit them (they otherwise live only on Google), plus the RSA ad resource id (RSA ads are
-- immutable, so a copy edit = create-new + remove-old). Idempotent.
-- See docs/tasks/strategy/ads-system/ads-google-composer-scope.md.
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_ad_content JSONB;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS google_ad_id TEXT;
