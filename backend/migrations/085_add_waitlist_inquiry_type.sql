-- Add inquiry_type column to waitlist table
-- Distinguishes between "Join Waitlist" and "Get Free Demo" inquiries

ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS inquiry_type VARCHAR(20) DEFAULT 'waitlist';

ALTER TABLE waitlist
ADD CONSTRAINT chk_waitlist_inquiry_type CHECK (inquiry_type IN ('waitlist', 'demo'));

-- Index for filtering by inquiry type
CREATE INDEX IF NOT EXISTS idx_waitlist_inquiry_type ON waitlist (inquiry_type);
