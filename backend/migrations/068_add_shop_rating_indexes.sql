-- Migration 068: Add indexes to improve shop rating query performance
-- Created: 2026-02-19
-- Purpose: Fix 30-second timeout in GET /api/shops endpoint

-- Add index on service_reviews.service_id for faster JOIN with shop_services
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id
ON service_reviews(service_id);

-- Add index on shop_services.shop_id for faster GROUP BY aggregation
CREATE INDEX IF NOT EXISTS idx_shop_services_shop_id
ON shop_services(shop_id);

-- Add composite index for active and verified shops (common WHERE clause)
CREATE INDEX IF NOT EXISTS idx_shops_active_verified
ON shops(active, verified)
WHERE active = true AND verified = true;

-- Add index on service_reviews for better aggregate performance
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating
ON service_reviews(service_id, rating)
WHERE rating IS NOT NULL;

-- Analyze tables to update statistics
ANALYZE service_reviews;
ANALYZE shop_services;
ANALYZE shops;
