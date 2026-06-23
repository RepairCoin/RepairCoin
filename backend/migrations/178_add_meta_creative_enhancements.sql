-- 178 — opt-in flag for Meta Advantage+ creative enhancements (exec Part 4). RENUMBERED from 171
-- to avoid colliding with main's 171_create_fraud_findings.sql (the runner keys on the integer
-- version PK → a duplicate number silently skips one file). Staging already recorded the old 171,
-- so the deploy must DELETE schema_migrations WHERE version=171 (main's 171 then applies; this
-- ALTER re-applies idempotently as 178). When true, the
-- ad creative is pushed with degrees_of_freedom_spec.standard_enhancements OPT_IN, so Meta may
-- generate delivery-time variations (image expansion, background gen, text variations) on top of
-- our approved creative. Default FALSE — never bypass our review gate; brand-safe by default.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS allow_meta_enhancements BOOLEAN NOT NULL DEFAULT false;
