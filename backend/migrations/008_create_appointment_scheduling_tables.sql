-- Migration: Create appointment scheduling tables
-- Date: 2025-12-05
-- Description: Add tables for shop availability, time slots, and appointment scheduling

-- =====================================================
-- 1. Shop Availability Table (Operating Hours)
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_availability (
  availability_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  is_open BOOLEAN DEFAULT true,
  open_time TIME, -- e.g., '09:00:00'
  close_time TIME, -- e.g., '18:00:00'
  break_start_time TIME, -- Optional lunch break
  break_end_time TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, day_of_week)
);

CREATE INDEX idx_shop_availability_shop ON shop_availability(shop_id);
CREATE INDEX idx_shop_availability_day ON shop_availability(day_of_week);

-- =====================================================
-- 2. Shop Time Slot Configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_time_slot_config (
  config_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id VARCHAR(255) NOT NULL UNIQUE REFERENCES shops(shop_id) ON DELETE CASCADE,
  slot_duration_minutes INTEGER DEFAULT 60, -- Default 1 hour slots
  buffer_time_minutes INTEGER DEFAULT 15, -- 15 min buffer between appointments
  max_concurrent_bookings INTEGER DEFAULT 1, -- How many appointments at same time
  booking_advance_days INTEGER DEFAULT 30, -- Can book up to 30 days in advance
  min_booking_hours INTEGER DEFAULT 2, -- Must book at least 2 hours in advance
  allow_weekend_booking BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_time_slot_config_shop ON shop_time_slot_config(shop_id);

-- =====================================================
-- 3. Service Duration Override (per service)
-- =====================================================
CREATE TABLE IF NOT EXISTS service_duration_config (
  duration_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id VARCHAR(36) NOT NULL REFERENCES shop_services(service_id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id)
);

CREATE INDEX idx_service_duration_service ON service_duration_config(service_id);

-- =====================================================
-- 4. Shop Date Overrides (Holidays, Special Days)
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_date_overrides (
  override_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT true,
  custom_open_time TIME,
  custom_close_time TIME,
  reason VARCHAR(255), -- e.g., "Holiday - Christmas"
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, override_date)
);

CREATE INDEX idx_date_overrides_shop ON shop_date_overrides(shop_id);
CREATE INDEX idx_date_overrides_date ON shop_date_overrides(override_date);

-- =====================================================
-- 5. Update service_orders table to add time slot
-- =====================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS booking_time_slot TIME,
  ADD COLUMN IF NOT EXISTS booking_end_time TIME;

CREATE INDEX IF NOT EXISTS idx_service_orders_booking_time ON service_orders(booking_date, booking_time_slot);

-- =====================================================
-- 6. Create view for shop calendar
-- =====================================================
CREATE OR REPLACE VIEW shop_calendar_view AS
SELECT
  o.order_id,
  o.shop_id,
  o.service_id,
  s.service_name,
  o.customer_address,
  c.name as customer_name,
  o.booking_date,
  o.booking_time_slot,
  o.booking_end_time,
  o.status,
  o.total_amount,
  o.notes,
  o.created_at
FROM service_orders o
JOIN shop_services s ON o.service_id = s.service_id
LEFT JOIN customers c ON o.customer_address = c.wallet_address
WHERE o.booking_date IS NOT NULL
  AND o.status NOT IN ('cancelled', 'refunded')
ORDER BY o.booking_date, o.booking_time_slot;

-- =====================================================
-- Insert default availability for existing shops (Mon-Fri 9-5)
-- =====================================================
INSERT INTO shop_availability (shop_id, day_of_week, is_open, open_time, close_time)
SELECT
  shop_id,
  day,
  CASE WHEN day BETWEEN 1 AND 5 THEN true ELSE false END, -- Mon-Fri open
  CASE WHEN day BETWEEN 1 AND 5 THEN '09:00:00'::TIME ELSE NULL END,
  CASE WHEN day BETWEEN 1 AND 5 THEN '17:00:00'::TIME ELSE NULL END
FROM shops
CROSS JOIN generate_series(0, 6) as day
ON CONFLICT (shop_id, day_of_week) DO NOTHING;

-- =====================================================
-- Insert default time slot config for existing shops
-- =====================================================
INSERT INTO shop_time_slot_config (shop_id)
SELECT shop_id FROM shops
ON CONFLICT (shop_id) DO NOTHING;

COMMENT ON TABLE shop_availability IS 'Shop operating hours by day of week';
COMMENT ON TABLE shop_time_slot_config IS 'Shop time slot booking configuration';
COMMENT ON TABLE service_duration_config IS 'Custom duration per service (overrides default)';
COMMENT ON TABLE shop_date_overrides IS 'Holiday and special date overrides';
