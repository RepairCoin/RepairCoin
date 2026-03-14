-- Migration: Fix service_duration_config.service_id type mismatch
-- Date: 2026-03-14
-- Bug: Time slots fail with "Failed to get service duration" because
--   service_duration_config.service_id is UUID but shop_services.service_id
--   is VARCHAR with format 'srv_<uuid>'. Migration 074 converted to UUID
--   and wiped all rows that had 'srv_' prefix.
-- Fix: Convert service_id back to VARCHAR(255) to match shop_services.service_id

-- Step 1: Drop the unique constraint on service_id if it exists
ALTER TABLE service_duration_config
DROP CONSTRAINT IF EXISTS service_duration_config_service_id_key;

-- Step 2: Drop any foreign key constraint if it exists
ALTER TABLE service_duration_config
DROP CONSTRAINT IF EXISTS service_duration_config_service_id_fkey;

-- Step 3: Convert service_id from UUID back to VARCHAR(255)
ALTER TABLE service_duration_config
ALTER COLUMN service_id TYPE VARCHAR(255) USING service_id::text;

-- Step 4: Re-add unique constraint
ALTER TABLE service_duration_config
ADD CONSTRAINT service_duration_config_service_id_key UNIQUE (service_id);

-- Step 5: Recreate the index
DROP INDEX IF EXISTS idx_service_duration_service;
CREATE INDEX idx_service_duration_service ON service_duration_config(service_id);
