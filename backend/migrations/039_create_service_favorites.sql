-- Migration: Create service_favorites table
-- Date: 2025-11-26
-- Description: Allows customers to bookmark/favorite services for later viewing

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create service_favorites table
CREATE TABLE IF NOT EXISTS service_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_address VARCHAR(255) NOT NULL,
  service_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES shop_services(service_id) ON DELETE CASCADE,
  CONSTRAINT fk_customer FOREIGN KEY (customer_address) REFERENCES customers(address) ON DELETE CASCADE,

  -- Prevent duplicate favorites
  CONSTRAINT unique_favorite UNIQUE (customer_address, service_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_favorites_customer ON service_favorites(customer_address);
CREATE INDEX IF NOT EXISTS idx_favorites_service ON service_favorites(service_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON service_favorites(created_at DESC);

-- Add comments
COMMENT ON TABLE service_favorites IS 'Customer bookmarked/favorited services';
COMMENT ON COLUMN service_favorites.customer_address IS 'Wallet address of customer who favorited';
COMMENT ON COLUMN service_favorites.service_id IS 'Reference to favorited service';
COMMENT ON COLUMN service_favorites.created_at IS 'When service was favorited';
