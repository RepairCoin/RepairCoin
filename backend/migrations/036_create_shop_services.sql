-- Migration: Create shop_services table
-- Date: 2025-11-17
-- Description: Creates table for shops to list their services

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shop_services table
CREATE TABLE IF NOT EXISTS shop_services (
  service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id VARCHAR(255) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  price_usd DECIMAL(10, 2) NOT NULL CHECK (price_usd >= 0),
  duration_minutes INTEGER CHECK (duration_minutes > 0),
  category VARCHAR(100),
  image_url VARCHAR(500),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shop_services_shop_id ON shop_services(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_services_category ON shop_services(category);
CREATE INDEX IF NOT EXISTS idx_shop_services_active ON shop_services(active);
CREATE INDEX IF NOT EXISTS idx_shop_services_created_at ON shop_services(created_at DESC);

-- Add comments
COMMENT ON TABLE shop_services IS 'Services offered by shops in the marketplace';
COMMENT ON COLUMN shop_services.service_id IS 'Unique identifier for the service';
COMMENT ON COLUMN shop_services.shop_id IS 'Reference to the shop offering this service';
COMMENT ON COLUMN shop_services.price_usd IS 'Service price in USD';
COMMENT ON COLUMN shop_services.duration_minutes IS 'Estimated service duration in minutes';
COMMENT ON COLUMN shop_services.category IS 'Service category (e.g., oil_change, brake_repair, tire_rotation)';
COMMENT ON COLUMN shop_services.active IS 'Whether the service is currently available for booking';
