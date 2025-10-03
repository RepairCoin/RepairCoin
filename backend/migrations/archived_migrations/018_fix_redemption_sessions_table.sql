-- Migration: Fix redemption_sessions table structure
-- The existing table has an id column that conflicts with our code expectations

-- First, drop the existing table if it exists (with CASCADE to remove constraints)
DROP TABLE IF EXISTS redemption_sessions CASCADE;

-- Create the table with the correct structure (no separate id column)
CREATE TABLE redemption_sessions (
  session_id VARCHAR(255) NOT NULL PRIMARY KEY,
  customer_address VARCHAR(42) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  max_amount NUMERIC(20,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  qr_code TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_customer ON redemption_sessions (customer_address);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_shop ON redemption_sessions (shop_id);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_status ON redemption_sessions (status);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_expires ON redemption_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_active ON redemption_sessions (customer_address, status) 
WHERE status IN ('pending', 'approved');