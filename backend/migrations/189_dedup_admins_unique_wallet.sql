-- 189 — De-duplicate admin records and enforce one admin row per wallet.
--
-- Duplicate admin rows (same wallet_address, created over time) caused a JOIN
-- fan-out in the sessions query (one session → N rows with the same id →
-- "duplicate React key" crash) and could skew admin counts/lookups. This
-- migration removes the duplicates (keeping the OLDEST row per wallet — the
-- original, real-name record) and adds a case-insensitive unique index so
-- duplicates can't be created again.
--
-- Safe + idempotent: no FK references the admins table; the DELETE is a no-op
-- once deduped, and the index uses IF NOT EXISTS.

-- 1) Remove duplicates, keeping the oldest row per wallet (case-insensitive).
DELETE FROM admins a
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(wallet_address)
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM admins
) d
WHERE a.id = d.id AND d.rn > 1;

-- 2) Prevent future duplicates: one admin per wallet (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uq_admins_wallet_lower
  ON admins (LOWER(wallet_address));
