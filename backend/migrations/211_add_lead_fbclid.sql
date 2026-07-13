-- Facebook click id (fbclid) on ad leads. Facebook auto-appends fbclid to outbound ad-click
-- URLs (the way Google appends gclid). Capturing it lets us attribute landing-page leads to
-- Facebook instead of the generic "Web form" bucket. Mirrors migration 173's gclid column.
ALTER TABLE ad_leads ADD COLUMN IF NOT EXISTS fbclid TEXT;
