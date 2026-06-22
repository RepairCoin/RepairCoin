-- 171 — opt-in flag for Meta Advantage+ creative enhancements (exec Part 4). When true, the
-- ad creative is pushed with degrees_of_freedom_spec.standard_enhancements OPT_IN, so Meta may
-- generate delivery-time variations (image expansion, background gen, text variations) on top of
-- our approved creative. Default FALSE — never bypass our review gate; brand-safe by default.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS allow_meta_enhancements BOOLEAN NOT NULL DEFAULT false;
