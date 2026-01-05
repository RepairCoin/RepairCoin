-- Migration: Create appointment reschedule requests table
-- Date: 2025-12-31
-- Description: Add table to track customer requests to change appointment date/time with shop approval workflow

-- =====================================================
-- 1. Appointment Reschedule Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
  request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(255) NOT NULL REFERENCES service_orders(order_id) ON DELETE CASCADE,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  customer_address VARCHAR(255) NOT NULL,

  -- Original appointment details
  original_date DATE NOT NULL,
  original_time_slot TIME NOT NULL,
  original_end_time TIME,

  -- Requested new appointment details
  requested_date DATE NOT NULL,
  requested_time_slot TIME NOT NULL,
  requested_end_time TIME,

  -- Request details
  customer_reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  -- Shop response
  shop_response_reason TEXT,
  responded_at TIMESTAMP,
  responded_by VARCHAR(255), -- shop wallet address who approved/rejected

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Auto-expire after X hours if no response

  -- Constraints
  CONSTRAINT valid_reschedule_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX idx_reschedule_shop_status ON appointment_reschedule_requests(shop_id, status);
CREATE INDEX idx_reschedule_order ON appointment_reschedule_requests(order_id);
CREATE INDEX idx_reschedule_customer ON appointment_reschedule_requests(customer_address);
CREATE INDEX idx_reschedule_expires ON appointment_reschedule_requests(expires_at) WHERE status = 'pending';
CREATE INDEX idx_reschedule_created ON appointment_reschedule_requests(created_at DESC);

-- =====================================================
-- 2. Add reschedule tracking columns to service_orders
-- =====================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS has_pending_reschedule BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_service_orders_pending_reschedule ON service_orders(has_pending_reschedule) WHERE has_pending_reschedule = TRUE;

-- =====================================================
-- 3. Add shop reschedule policy configuration
-- =====================================================
ALTER TABLE shop_time_slot_config
  ADD COLUMN IF NOT EXISTS allow_reschedule BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_reschedules_per_order INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reschedule_min_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS reschedule_expiration_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS auto_approve_reschedule BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_reschedule_reason BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 4. Create view for pending reschedule requests
-- =====================================================
CREATE OR REPLACE VIEW pending_reschedule_requests_view AS
SELECT
  r.request_id,
  r.order_id,
  r.shop_id,
  r.customer_address,
  c.name as customer_name,
  c.email as customer_email,
  o.service_id,
  s.service_name,
  r.original_date,
  r.original_time_slot,
  r.original_end_time,
  r.requested_date,
  r.requested_time_slot,
  r.requested_end_time,
  r.customer_reason,
  r.status,
  r.created_at,
  r.expires_at,
  EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 3600 as hours_until_expiry
FROM appointment_reschedule_requests r
JOIN service_orders o ON r.order_id = o.order_id
JOIN shop_services s ON o.service_id = s.service_id
LEFT JOIN customers c ON r.customer_address = c.wallet_address
WHERE r.status = 'pending'
ORDER BY r.created_at ASC;

-- =====================================================
-- 5. Function to auto-expire old requests
-- =====================================================
CREATE OR REPLACE FUNCTION expire_old_reschedule_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE appointment_reschedule_requests
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Trigger to update service_orders.has_pending_reschedule
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_reschedule_status()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT (new request)
  IF TG_OP = 'INSERT' THEN
    UPDATE service_orders
    SET has_pending_reschedule = TRUE
    WHERE order_id = NEW.order_id;
    RETURN NEW;
  END IF;

  -- On UPDATE (status change)
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    -- Check if there are any other pending requests for this order
    IF NOT EXISTS (
      SELECT 1 FROM appointment_reschedule_requests
      WHERE order_id = NEW.order_id
        AND status = 'pending'
        AND request_id != NEW.request_id
    ) THEN
      UPDATE service_orders
      SET has_pending_reschedule = FALSE
      WHERE order_id = NEW.order_id;
    END IF;

    -- If approved, update the booking details
    IF NEW.status = 'approved' THEN
      UPDATE service_orders
      SET
        booking_date = NEW.requested_date,
        booking_time_slot = NEW.requested_time_slot,
        booking_end_time = NEW.requested_end_time,
        reschedule_count = reschedule_count + 1,
        last_rescheduled_at = NOW()
      WHERE order_id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_reschedule_status ON appointment_reschedule_requests;
CREATE TRIGGER trigger_update_order_reschedule_status
  AFTER INSERT OR UPDATE ON appointment_reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_order_reschedule_status();

-- =====================================================
-- 7. Comments
-- =====================================================
COMMENT ON TABLE appointment_reschedule_requests IS 'Customer requests to change appointment date/time requiring shop approval';
COMMENT ON COLUMN appointment_reschedule_requests.status IS 'Request status: pending, approved, rejected, expired, cancelled';
COMMENT ON COLUMN appointment_reschedule_requests.expires_at IS 'Request expires if shop does not respond by this time';
COMMENT ON COLUMN shop_time_slot_config.auto_approve_reschedule IS 'If true, automatically approve reschedule if requested slot is available';
COMMENT ON FUNCTION expire_old_reschedule_requests() IS 'Call periodically to expire old pending requests';
