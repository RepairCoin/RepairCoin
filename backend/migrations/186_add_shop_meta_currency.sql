-- 186 — the connected Meta ad account's currency (ISO code, e.g. USD / PHP), captured at
-- account selection. Used to display the SHOP's ad money (budget / spend / revenue / CPL / CPB)
-- in the account's own currency instead of assuming USD. FixFlow's own fees stay in USD.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS meta_currency TEXT;
