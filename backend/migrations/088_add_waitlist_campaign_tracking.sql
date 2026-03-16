-- Migration 088: Add campaign tracking to waitlist
-- Adds source/UTM tracking columns and page views table

-- Add source column to waitlist table
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct';

-- Add UTM tracking columns
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);

-- Create waitlist_page_views table for visit tracking
CREATE TABLE IF NOT EXISTS waitlist_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL DEFAULT 'direct',
  utm_campaign VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_source VARCHAR(255),
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_page_views_source ON waitlist_page_views(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_page_views_created_at ON waitlist_page_views(created_at DESC);
