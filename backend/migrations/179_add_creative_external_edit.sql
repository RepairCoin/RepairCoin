-- 179 — two-way Meta ⇄ app config sync, Phase 2 (creative reflect + flag).
-- When the live ad's creative is swapped/edited directly in Ads Manager, the nightly/on-demand
-- reconcile pulls the new creative spec back into ad_creatives AND raises this flag so the
-- dashboard can show "Edited in Ads Manager — not reviewed by FixFlow". We NEVER auto-approve an
-- externally-edited creative (D3): the flag surfaces the review-gate bypass instead of silently
-- trusting it. Cleared when the creative is re-edited locally, regenerated, or re-reviewed by an
-- admin. Idempotent.

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS externally_edited BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS externally_edited_at TIMESTAMPTZ;
