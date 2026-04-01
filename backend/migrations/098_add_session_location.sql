-- Migration: Add location column to refresh_tokens for session geo-IP lookup
-- Caches the location at login time so it doesn't need re-lookup

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS location VARCHAR(100);
