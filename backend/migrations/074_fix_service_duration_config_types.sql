-- Migration: Fix service_duration_config column widths and FK constraint
-- Date: 2024-12-22
-- Description: Fix VARCHAR(36) columns that are too narrow for service IDs (srv_UUID format = 41 chars)
-- Bug: BUG-017 - Service duration update fails with 500 Internal Server Error
-- Root cause: service_id column was VARCHAR(36) but actual IDs are 41+ characters

-- =====================================================
-- Step 1: Drop the foreign key constraint if it exists
-- =====================================================
ALTER TABLE service_duration_config
DROP CONSTRAINT IF EXISTS service_duration_config_service_id_fkey;

-- =====================================================
-- Step 2: Change column types to match shop_services (UUID)
-- shop_services.service_id is UUID, so we need to convert
-- =====================================================
-- First, widen duration_id to accommodate UUID strings
ALTER TABLE service_duration_config
ALTER COLUMN duration_id TYPE VARCHAR(255);

-- Convert service_id from VARCHAR to UUID
-- Clean up any invalid data first
DELETE FROM service_duration_config
WHERE service_id IS NULL OR service_id = ''
   OR service_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Now convert to UUID
ALTER TABLE service_duration_config
ALTER COLUMN service_id TYPE UUID USING service_id::uuid;

-- =====================================================
-- Step 3: Clean up any orphaned records before adding FK constraint
-- =====================================================
DELETE FROM service_duration_config sdc
WHERE NOT EXISTS (
  SELECT 1 FROM shop_services ss
  WHERE ss.service_id = sdc.service_id
);

-- =====================================================
-- Step 4: Add the foreign key constraint
-- =====================================================
ALTER TABLE service_duration_config
ADD CONSTRAINT service_duration_config_service_id_fkey
FOREIGN KEY (service_id) REFERENCES shop_services(service_id) ON DELETE CASCADE;

-- =====================================================
-- Step 5: Add comment
-- =====================================================
COMMENT ON TABLE service_duration_config IS 'Custom duration per service - Column widths fixed in migration 050';
