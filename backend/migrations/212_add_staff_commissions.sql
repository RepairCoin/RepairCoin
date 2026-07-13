-- 212 — Staff commissions, slice 1: schema only.
--
-- Lets a shop owner opt into paying team members a percentage of each service order
-- they complete. Track-and-report only: RepairCoin accrues what is owed, the shop pays
-- it out through their existing payroll. No wallet or Stripe involvement.
--
-- Purely additive and idempotent. Nothing changes for any existing shop until an owner
-- flips commissions_enabled, which defaults to false.

-- 1) Shop-level opt-in and default rate.
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS commissions_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE shops ADD CONSTRAINT chk_shop_default_commission_percent
    CHECK (default_commission_percent >= 0 AND default_commission_percent <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Per-member override. NULL = inherit the shop default.
ALTER TABLE shop_team_members
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);

DO $$ BEGIN
  ALTER TABLE shop_team_members ADD CONSTRAINT chk_member_commission_percent
    CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Who performed the service. Set at completion; NULL for every historical order, which
--    is why no commissions are backfilled. Members are soft-deleted (status='removed'),
--    so SET NULL only fires if a row is ever hard-deleted.
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS completed_by_member_id UUID REFERENCES shop_team_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_completed_by
  ON service_orders (completed_by_member_id) WHERE completed_by_member_id IS NOT NULL;

-- 4) The ledger. One row per completed order that accrued commission.
--
--    base_amount and rate_percent are snapshotted at accrual time so that changing a
--    member's rate later never rewrites what they already earned.
--
--    UNIQUE (order_id) makes accrual idempotent: a retried or double-clicked completion
--    cannot pay the same order twice.
--
--    member_id has no ON DELETE action on purpose — payout history must survive.
CREATE TABLE IF NOT EXISTS staff_commissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  order_id     VARCHAR(50)  NOT NULL REFERENCES service_orders(order_id) ON DELETE CASCADE,
  member_id    UUID         NOT NULL REFERENCES shop_team_members(id),
  base_amount  NUMERIC(10,2) NOT NULL,
  rate_percent NUMERIC(5,2)  NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'accrued',
  paid_at      TIMESTAMP,
  paid_by      VARCHAR(42),
  payout_note  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_staff_commission_order UNIQUE (order_id),
  CONSTRAINT chk_staff_commission_status CHECK (status IN ('accrued','paid','voided')),
  CONSTRAINT chk_staff_commission_rate   CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CONSTRAINT chk_staff_commission_amount CHECK (amount >= 0 AND base_amount >= 0)
);

-- Reporting: per-member totals over a date range, filtered by payout status.
CREATE INDEX IF NOT EXISTS idx_staff_commissions_shop_status
  ON staff_commissions (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_shop_created
  ON staff_commissions (shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_member
  ON staff_commissions (member_id);
