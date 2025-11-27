-- Migration: Create service_reviews table
-- Date: 2025-11-26
-- Description: Allows customers to rate and review services after completion

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create service_reviews table
CREATE TABLE IF NOT EXISTS service_reviews (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id VARCHAR(50) NOT NULL,
  order_id VARCHAR(50) NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  images TEXT[], -- Optional review photos
  helpful_count INTEGER DEFAULT 0,
  shop_response TEXT,
  shop_response_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES shop_services(service_id) ON DELETE CASCADE,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES service_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE,

  -- Only one review per order
  CONSTRAINT unique_order_review UNIQUE (order_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_service ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON service_reviews(customer_address);
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON service_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON service_reviews(created_at DESC);

-- Add aggregate rating columns to shop_services
ALTER TABLE shop_services
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Create index on average rating for sorting
CREATE INDEX IF NOT EXISTS idx_services_rating ON shop_services(average_rating DESC);

-- Add comments
COMMENT ON TABLE service_reviews IS 'Customer reviews and ratings for completed services';
COMMENT ON COLUMN service_reviews.review_id IS 'Unique identifier for review';
COMMENT ON COLUMN service_reviews.service_id IS 'Reference to reviewed service';
COMMENT ON COLUMN service_reviews.order_id IS 'Reference to completed order (ensures customer used the service)';
COMMENT ON COLUMN service_reviews.customer_address IS 'Wallet address of reviewer';
COMMENT ON COLUMN service_reviews.shop_id IS 'Shop that provided the service';
COMMENT ON COLUMN service_reviews.rating IS 'Star rating from 1 to 5';
COMMENT ON COLUMN service_reviews.comment IS 'Written review text';
COMMENT ON COLUMN service_reviews.images IS 'Optional array of image URLs for review photos';
COMMENT ON COLUMN service_reviews.helpful_count IS 'Number of users who found review helpful';
COMMENT ON COLUMN service_reviews.shop_response IS 'Shop owner response to review';
COMMENT ON COLUMN service_reviews.shop_response_at IS 'When shop responded';

-- Create function to update service rating aggregates
CREATE OR REPLACE FUNCTION update_service_rating_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  -- Update average_rating and review_count for the service
  UPDATE shop_services
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    ),
    review_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    )
  WHERE service_id = COALESCE(NEW.service_id, OLD.service_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update aggregates
DROP TRIGGER IF EXISTS trigger_update_service_rating ON service_reviews;
CREATE TRIGGER trigger_update_service_rating
  AFTER INSERT OR UPDATE OR DELETE ON service_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_service_rating_aggregate();
