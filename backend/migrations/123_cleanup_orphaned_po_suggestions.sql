-- Migration 123: Clean up orphaned PO suggestions
-- Description: Handle approved PO suggestions that don't have an associated purchase order
--              due to the transaction bug that was fixed

-- Reset orphaned approved suggestions back to pending status
-- These are suggestions that were approved but no PO was created
UPDATE purchase_order_suggestions
SET 
  status = 'pending',
  approved_at = NULL,
  approved_by = NULL,
  -- Extend expiry by 7 days from now
  expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
WHERE status = 'approved'
  AND purchase_order_id IS NULL
  AND approved_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'; -- Only reset those approved more than 1 hour ago

-- Log the cleanup
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset % orphaned approved PO suggestions back to pending status', reset_count;
END $$;
