-- 178 — opt-in flag for Meta Advantage+ creative enhancements (exec Part 4). RENUMBERED from 171
-- to avoid a tree collision with main's 171_create_fraud_findings.sql (two files at version 171).
-- Staging state (verified 2026-06-23): schema_migrations 171 = create_fraud_findings (Zeff's, via
-- db:migrate); our allow_meta_enhancements column was applied OUT-OF-BAND via run-single-migration
-- (no schema_migrations row). So NO schema_migrations surgery is needed — a normal db:migrate
-- deploy skips 171 (already recorded) and runs this 178 idempotently (column already exists).
-- Prod has no prior 171, so it applies fraud_findings(171) + this(178) cleanly. When true, the
-- ad creative is pushed with degrees_of_freedom_spec.standard_enhancements OPT_IN, so Meta may
-- generate delivery-time variations (image expansion, background gen, text variations) on top of
-- our approved creative. Default FALSE — never bypass our review gate; brand-safe by default.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS allow_meta_enhancements BOOLEAN NOT NULL DEFAULT false;
