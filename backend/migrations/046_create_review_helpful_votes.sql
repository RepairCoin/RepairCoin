-- Migration: Create review_helpful_votes table
-- Date: 2025-12-15
-- Description: Track unique helpful votes per user per review (one vote per account)

-- Create review_helpful_votes table
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id SERIAL PRIMARY KEY,
  review_id UUID NOT NULL,
  voter_address VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key constraint
  CONSTRAINT fk_review FOREIGN KEY (review_id) REFERENCES service_reviews(review_id) ON DELETE CASCADE,

  -- Unique constraint: one vote per user per review
  CONSTRAINT unique_voter_review UNIQUE (review_id, voter_address)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_helpful_votes_review ON review_helpful_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_helpful_votes_voter ON review_helpful_votes(voter_address);

-- Add comments
COMMENT ON TABLE review_helpful_votes IS 'Tracks which users voted a review as helpful (unique per account)';
COMMENT ON COLUMN review_helpful_votes.review_id IS 'Reference to the review being voted on';
COMMENT ON COLUMN review_helpful_votes.voter_address IS 'Wallet address of the user who voted';
COMMENT ON COLUMN review_helpful_votes.created_at IS 'When the vote was cast';

-- Create function to sync helpful_count with votes table
CREATE OR REPLACE FUNCTION sync_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update helpful_count in service_reviews based on actual votes
  UPDATE service_reviews
  SET helpful_count = (
    SELECT COUNT(*)
    FROM review_helpful_votes
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
  )
  WHERE review_id = COALESCE(NEW.review_id, OLD.review_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync helpful_count
DROP TRIGGER IF EXISTS trigger_sync_helpful_count ON review_helpful_votes;
CREATE TRIGGER trigger_sync_helpful_count
  AFTER INSERT OR DELETE ON review_helpful_votes
  FOR EACH ROW
  EXECUTE FUNCTION sync_review_helpful_count();
