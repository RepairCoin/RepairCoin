-- Migration: Create service_orders table
-- Date: 2025-11-17
-- Description: Creates table for tracking service bookings and payments

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create service_orders table
CREATE TABLE IF NOT EXISTS service_orders (
  order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL,
  customer_address VARCHAR(255) NOT NULL,
  shop_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  booking_date TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES shop_services(service_id) ON DELETE RESTRICT,
  CONSTRAINT fk_shop FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE RESTRICT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_service_orders_service_id ON service_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_address);
CREATE INDEX IF NOT EXISTS idx_service_orders_shop_id ON service_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_stripe_payment ON service_orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at DESC);

-- Add comments
COMMENT ON TABLE service_orders IS 'Customer bookings and payment records for shop services';
COMMENT ON COLUMN service_orders.order_id IS 'Unique identifier for the order';
COMMENT ON COLUMN service_orders.service_id IS 'Reference to the booked service';
COMMENT ON COLUMN service_orders.customer_address IS 'Wallet address of the customer';
COMMENT ON COLUMN service_orders.shop_id IS 'Reference to the shop providing the service';
COMMENT ON COLUMN service_orders.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking payment';
COMMENT ON COLUMN service_orders.status IS 'Order status: pending, paid, completed, cancelled, refunded';
COMMENT ON COLUMN service_orders.total_amount IS 'Total order amount in USD';
COMMENT ON COLUMN service_orders.booking_date IS 'When the service is scheduled (optional)';
COMMENT ON COLUMN service_orders.completed_at IS 'When the service was completed';
