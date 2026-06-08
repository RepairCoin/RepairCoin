-- Migration 136: Add customer reply to service reviews
-- Allows the original reviewer to post a single counter-reply after the shop responds

ALTER TABLE service_reviews
  ADD COLUMN IF NOT EXISTS customer_reply TEXT,
  ADD COLUMN IF NOT EXISTS customer_reply_at TIMESTAMPTZ;
