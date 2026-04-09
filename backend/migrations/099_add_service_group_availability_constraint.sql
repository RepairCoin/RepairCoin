-- Migration 099: Add unique constraint to service_group_availability
-- Required for ON CONFLICT (service_id, group_id) upsert in ServiceRepository.linkServiceToGroup()
-- Without this, linking a service to a group fails with:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- Add unique constraint on (service_id, group_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'service_group_availability'::regclass
    AND conname = 'unique_service_group_link'
  ) THEN
    ALTER TABLE service_group_availability
    ADD CONSTRAINT unique_service_group_link UNIQUE (service_id, group_id);
  END IF;
END $$;

-- Add index on group_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sga_group_id ON service_group_availability(group_id);

-- Add index on service_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sga_service_id ON service_group_availability(service_id);

-- Add index on active for filtering
CREATE INDEX IF NOT EXISTS idx_sga_active ON service_group_availability(active) WHERE active = true;
