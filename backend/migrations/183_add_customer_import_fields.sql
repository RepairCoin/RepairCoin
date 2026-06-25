-- 183 — customer import/migration fields (Phase 1). Lets a shop migrate customers from another POS
-- (Square first) wallet-lessly: origin tagging, source-system id (for re-import dedup + traceability),
-- marketing consent (suppress non-subscribers — CAN-SPAM/CASL/GDPR), and spend/visit history for
-- VIP + win-back segmentation. All descriptive — never used for RCN balances. Idempotent.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS import_source          TEXT,                    -- 'square' | 'csv' | ...
  ADD COLUMN IF NOT EXISTS external_ref           TEXT,                    -- source system's customer id
  ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN,                -- from "Email Subscription Status"
  ADD COLUMN IF NOT EXISTS lifetime_spend_usd     NUMERIC(12,2),           -- USD spent at the prior POS (NOT RCN)
  ADD COLUMN IF NOT EXISTS first_visit_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_visit_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_count            INTEGER;

-- Find imported rows by their source-system id quickly (re-import dedup / lookup).
CREATE INDEX IF NOT EXISTS idx_customers_external_ref ON customers (import_source, external_ref)
  WHERE external_ref IS NOT NULL;
