-- Migration: Add status column to conversations table
-- Purpose: Allow marking conversations as 'open' or 'resolved'

-- Add the status column
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';

-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;

-- Add check constraint for valid status values
ALTER TABLE conversations
ADD CONSTRAINT conversations_status_check
CHECK (status IN ('open', 'resolved'));

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- Update existing rows to have 'open' status (in case default didn't apply)
UPDATE conversations SET status = 'open' WHERE status IS NULL;
