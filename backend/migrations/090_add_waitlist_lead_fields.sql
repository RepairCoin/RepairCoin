-- Add business category and city fields to waitlist for lead quality tracking
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS business_category VARCHAR(50);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Index for filtering by business category
CREATE INDEX IF NOT EXISTS idx_waitlist_business_category ON waitlist(business_category);
