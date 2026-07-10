-- 175 — AI Memory: the unified assistant's durable store of the shop owner's
-- STANDING INTENT (preferences / instructions / decisions / corrections) carried
-- across conversations. This is NOT facts the DB already holds (those come from
-- the assistant's data tools) and NOT chat history. Read into the orchestrator
-- system prompt (top-K) and written via the `remember_this` tool. Gated by
-- ENABLE_AI_MEMORY (default off). See docs/tasks/strategy/ai-memory/.

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'shop',            -- 'shop' (v1) | 'customer' (phase 4)
  kind TEXT NOT NULL CHECK (kind IN ('preference','instruction','decision','correction')),
  customer_id TEXT,                              -- phase 4 (customer-scoped memory)
  content TEXT NOT NULL,                         -- the owner intent, e.g. "Never suggest discounts."
  tags TEXT[] NOT NULL DEFAULT '{}',             -- keyword retrieval
  source TEXT NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit','auto')),
  pinned BOOLEAN NOT NULL DEFAULT false,         -- owner-stated/standing → exempt from aging
  source_conversation_id TEXT,
  confidence NUMERIC,                            -- auto-extract only (phase 3)
  last_referenced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_shop ON ai_memories (shop_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_ai_memories_tags ON ai_memories USING GIN (tags);
