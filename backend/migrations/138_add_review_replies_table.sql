CREATE TABLE IF NOT EXISTS review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  author_address TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'shop')),
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);
