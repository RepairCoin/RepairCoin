-- Migration: Add tags field to shop_services table
-- Description: Add support for searchable tags on services (up to 5 tags per service)
-- Date: 2025-11-20

-- Add tags column as TEXT[] (PostgreSQL array type)
ALTER TABLE shop_services
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add GIN index for faster tag searches
CREATE INDEX IF NOT EXISTS idx_shop_services_tags ON shop_services USING GIN (tags);

-- Add comment
COMMENT ON COLUMN shop_services.tags IS 'Searchable tags for service discovery (e.g., iPhone, Screen, Battery)';
