-- 253: draft vs published (Custom Workflows A4).
--
-- Today a rule goes LIVE the moment it is saved: is_active defaults to true and the engine only checks
-- is_active. Harmless when the only action was a message; not harmless now. A shop owner can pick the
-- "Post-repair follow-up" template, press Save, and immediately begin issuing 25 RCN on every completed
-- booking — having never pressed anything called "activate". Draft makes publishing a deliberate act.
--
-- DEFAULT 'published' on purpose: every existing rule IS live and must stay live, and AI Campaigns keeps
-- its current behaviour. Only the Automation surface creates drafts, which it does explicitly.
--
-- The load-bearing half is in the engine queries, not here: getActiveScheduleRules / getActiveEventRules
-- must require status='published'. A draft that still fires would be worse than having no draft state at
-- all — it would read as "not live yet" while quietly sending.

ALTER TABLE shop_auto_messages
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';

-- The engine filters on this on every tick, alongside is_active.
CREATE INDEX IF NOT EXISTS idx_auto_messages_status
  ON shop_auto_messages (status)
  WHERE status = 'published';

COMMENT ON COLUMN shop_auto_messages.status IS
  'draft = never runs, still being composed. published = eligible to run (subject to is_active).';
