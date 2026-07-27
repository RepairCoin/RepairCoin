-- 228 — AI Usage Overage: per-shop bill-shock cap (T3.2).
--
-- Slice 2.5 shipped a single platform-wide guardrail (env AI_OVERAGE_MONTHLY_CAP_USD). This makes the
-- cap per-shop so a shop can self-serve its own ceiling ("stop full-power AI at $50 of overage this
-- month") — the value the cap-reached banner's "raise your cap" CTA actually adjusts.
--
-- Semantics: NULL = inherit the platform default (AI_OVERAGE_MONTHLY_CAP_USD, default $100). A positive
-- value = that shop's ceiling on BILLABLE overage (Usage x3 dollars) before AI reverts to the lighter
-- model. Additive + idempotent; nothing changes for any shop until one sets a value.

ALTER TABLE ai_shop_settings
  ADD COLUMN IF NOT EXISTS overage_cap_usd NUMERIC(12,2);
