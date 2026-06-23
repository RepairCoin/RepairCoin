-- ============================================================================
-- Production RCG tier backfill
-- ============================================================================
-- Context: seed data set every shop's rcg_tier to uppercase 'STANDARD'
-- regardless of its actual rcg_balance. Backend code expects LOWERCASE tiers
-- ('none'/'standard'/'premium'/'elite') and derives benefits + RCN pricing from
-- them, so the wrong label breaks pricing/benefits/analytics.
--
-- This was already fixed on STAGING (59 shops). Run on PRODUCTION after the
-- read-only diagnostic confirms the same issue.
--
-- HOW TO RUN (production):
--   psql "<PROD_DATABASE_URL>" -f backend/scripts/prod_tier_backfill.sql
--   (or paste into the DigitalOcean DB console)
--
-- SAFETY: only touches rcg_tier (the label). Does NOT change operational_status,
-- so no shop's access/qualification changes.
-- ============================================================================

-- STEP 1 — READ-ONLY DIAGNOSTIC (run first; confirms scope, changes nothing)
-- Shows shops whose stored tier differs from what their balance implies.
SELECT
  shop_id,
  rcg_tier                                   AS current_tier,
  rcg_balance,
  operational_status,
  CASE
    WHEN rcg_balance >= 200000 THEN 'elite'
    WHEN rcg_balance >= 50000  THEN 'premium'
    WHEN rcg_balance >= 10000  THEN 'standard'
    ELSE 'none'
  END                                        AS correct_tier
FROM shops
WHERE rcg_tier IS DISTINCT FROM (
  CASE
    WHEN rcg_balance >= 200000 THEN 'elite'
    WHEN rcg_balance >= 50000  THEN 'premium'
    WHEN rcg_balance >= 10000  THEN 'standard'
    ELSE 'none'
  END)
ORDER BY rcg_balance DESC NULLS LAST;

-- STEP 2 — BACKFILL (run only after reviewing STEP 1 output)
-- Recomputes rcg_tier from rcg_balance for every mismatched shop.
-- Uncomment to apply:
--
-- UPDATE shops SET
--   rcg_tier = CASE
--     WHEN rcg_balance >= 200000 THEN 'elite'
--     WHEN rcg_balance >= 50000  THEN 'premium'
--     WHEN rcg_balance >= 10000  THEN 'standard'
--     ELSE 'none' END,
--   tier_updated_at = NOW()
-- WHERE rcg_tier IS DISTINCT FROM (CASE
--     WHEN rcg_balance >= 200000 THEN 'elite'
--     WHEN rcg_balance >= 50000  THEN 'premium'
--     WHEN rcg_balance >= 10000  THEN 'standard'
--     ELSE 'none' END);

-- STEP 3 — VERIFY (run after the backfill)
-- SELECT rcg_tier, COUNT(*) FROM shops GROUP BY rcg_tier ORDER BY COUNT(*) DESC;
