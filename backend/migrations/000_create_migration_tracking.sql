-- Migration: 000_create_migration_tracking.sql
-- Author: System
-- Date: 2025-09-04
-- Description: Create schema migrations tracking table

-- This is the foundational migration that creates the tracking system
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert this migration record if not exists
INSERT INTO schema_migrations (version, name) 
VALUES (0, 'create_migration_tracking')
ON CONFLICT (version) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);