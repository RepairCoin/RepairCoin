-- Homepage AI assistant (P1) — conversation logging.
--
-- The logs are not an afterthought here; they are the point. The corpus HIT RATE is what decides
-- whether a model fallback is worth building at all, and the list of unmatched questions is the
-- backlog for the corpus. Shipping P1 without this would mean shipping the feature and learning
-- nothing from it.
--
-- Unauthenticated by nature, so there is no user to attach a row to and PII must be kept out
-- deliberately rather than by accident. The question text is truncated and email/phone-shaped strings
-- are stripped before insert; an address the visitor consents to give us lives in `waitlist`, where
-- consent is explicit and it can be deleted on request.

CREATE TABLE IF NOT EXISTS homepage_ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Opaque id from a signed cookie. Not a person, and deliberately not joinable to anything.
  session_id      VARCHAR(64) NOT NULL,
  -- Hashed, never raw. Enough to spot one source hammering the endpoint, useless for identifying anyone.
  ip_hash         VARCHAR(64),
  message_count   INTEGER NOT NULL DEFAULT 0,
  email_captured  BOOLEAN NOT NULL DEFAULT FALSE,
  converted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_homepage_ai_conversations_session
  ON homepage_ai_conversations (session_id);

CREATE INDEX IF NOT EXISTS idx_homepage_ai_conversations_created
  ON homepage_ai_conversations (created_at DESC);

CREATE TABLE IF NOT EXISTS homepage_ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      VARCHAR(64) NOT NULL,
  question        TEXT NOT NULL,

  -- The economic story of the feature in one column.
  --   corpus   — answered from help-prospect, no model, no cost
  --   model    — the long-tail fallback (P3; nothing writes this yet)
  --   fallback — over budget, rate limited, or no article cleared the score floor
  --   refused  — off-topic; no model was called
  answered_by     VARCHAR(20) NOT NULL
                    CHECK (answered_by IN ('corpus', 'model', 'fallback', 'refused')),
  -- Which article answered, so a bad match can be traced to a file and fixed by editing markdown.
  matched_article VARCHAR(120),
  match_score     INTEGER,
  latency_ms      INTEGER,
  -- Null on every P1 row by definition; present once a model can answer.
  cost_usd        NUMERIC(10, 6),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homepage_ai_messages_session
  ON homepage_ai_messages (session_id, created_at);

-- The weekly review: what did we fail to answer? This index is the one that gets used in anger.
CREATE INDEX IF NOT EXISTS idx_homepage_ai_messages_unanswered
  ON homepage_ai_messages (created_at DESC)
  WHERE answered_by IN ('fallback', 'refused');

COMMENT ON TABLE homepage_ai_messages IS
  'One row per homepage AI question. answered_by = corpus vs fallback is the corpus hit rate, which decides whether a model fallback is worth building.';
