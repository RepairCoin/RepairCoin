-- Add assigned_to field for routing leads to team members
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100);
