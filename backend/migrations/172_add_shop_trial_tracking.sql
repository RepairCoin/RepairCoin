-- Free trial is DB-only (no Stripe until conversion). This flag enforces one trial
-- per shop: it is stamped when a trial starts and never cleared, so eligibility is
-- simply `trial_used_at IS NULL`.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;
