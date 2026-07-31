-- 246: retire a standing rule when the owner replaces it.
--
-- Observed on staging 2026-07-28: the owner said "never use emojis", then later "actually, do use
-- emojis — they perform better". BOTH were stored, both pinned, both live, and both injected into
-- every later prompt. The newer memory described itself as overriding the older one, but that is just
-- text — nothing retired the old rule, and recall ranks by keyword overlap then pinned then recency,
-- so which of two contradictory rules wins was effectively undefined.
--
-- superseded_at marks a rule the owner has replaced. Superseded rows are excluded from recall (so the
-- contradiction stops immediately), unpinned (so they lose their aging exemption), and swept by
-- purgeStale once past the stale window — they age out naturally rather than being hard-deleted, and
-- stay recoverable in the meantime. superseded_by records which memory replaced it.

ALTER TABLE ai_memories
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID;

-- listActive filters on this alongside deleted_at on every recall, so keep it cheap.
CREATE INDEX IF NOT EXISTS idx_ai_memories_active
  ON ai_memories (shop_id)
  WHERE deleted_at IS NULL AND superseded_at IS NULL;

COMMENT ON COLUMN ai_memories.superseded_at IS
  'Set when the owner replaced this standing rule. Excluded from recall, unpinned, and aged out by purgeStale.';
COMMENT ON COLUMN ai_memories.superseded_by IS
  'The ai_memories.id that replaced this rule.';
