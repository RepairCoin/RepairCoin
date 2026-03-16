-- Re-apply migration 085 in case it was recorded but never executed
-- This is safe to run multiple times due to IF NOT EXISTS / DO blocks

ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS inquiry_type VARCHAR(20) DEFAULT 'waitlist';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_waitlist_inquiry_type'
  ) THEN
    ALTER TABLE waitlist ADD CONSTRAINT chk_waitlist_inquiry_type CHECK (inquiry_type IN ('waitlist', 'demo'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waitlist_inquiry_type ON waitlist (inquiry_type);
