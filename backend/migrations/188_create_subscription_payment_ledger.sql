-- Idempotency ledger for Stripe subscription invoice payments. Each successful
-- invoice is recorded exactly once (PK on stripe_invoice_id), guarding against
-- webhook re-delivery when incrementing shop_subscriptions.payments_made/total_paid.
CREATE TABLE IF NOT EXISTS subscription_payment_ledger (
  stripe_invoice_id      TEXT PRIMARY KEY,
  shop_subscription_id   INTEGER,
  shop_id                TEXT NOT NULL,
  stripe_subscription_id TEXT,
  amount_cents           INTEGER NOT NULL,
  billing_reason         TEXT,
  processed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_payment_ledger_shop_id
  ON subscription_payment_ledger (shop_id);
CREATE INDEX IF NOT EXISTS idx_sub_payment_ledger_subscription_id
  ON subscription_payment_ledger (shop_subscription_id);
