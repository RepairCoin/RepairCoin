-- 215 — Remove shop approval on signup: auto-activate existing pending shops.
--
-- Shops now register as verified/active immediately (no admin-approval step). This backfills
-- shops that were left in the old "pending" state (verified=false) so nobody is stranded once
-- the approval queue is gone.
--
-- Only touches shops that were awaiting approval: verified=false AND not suspended. Suspended
-- shops (suspended_at set) and admin-deactivated shops are left exactly as they are.
--
-- Idempotent: re-running changes nothing once no pending shops remain.

UPDATE shops
   SET verified = true,
       active = true,
       updated_at = CURRENT_TIMESTAMP
 WHERE verified = false
   AND suspended_at IS NULL;
