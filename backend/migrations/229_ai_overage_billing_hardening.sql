-- 229 — AI Usage Overage billing hardening (T3.2 prod-readiness).
--
-- Two additive, idempotent columns on the accrual ledger:
--   invoicing_at   — transient claim stamp for concurrency safety. Before charging, a runner atomically
--                    claims its pending rows by setting this; a concurrent runner (admin double-click or
--                    the monthly cron overlapping a manual run) then sees them as in-flight and skips
--                    them, so a shop can't be double-invoiced. A stale claim (>15 min) is reclaimable
--                    (covers a crashed run).
--   refunded_cents / refunded_at — ledger-side record of a refund/credit note against an overage invoice
--                    (Stripe credit_note.created webhook), so the ledger reflects reversals instead of
--                    staying 'paid' forever.
--
-- status stays free-form TEXT (no CHECK) — new values 'invoicing'/'uncollectible'/'refunded' are used by
-- the billing service + webhook without a constraint change.

ALTER TABLE ai_overage_charges
  ADD COLUMN IF NOT EXISTS invoicing_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_cents NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ;
