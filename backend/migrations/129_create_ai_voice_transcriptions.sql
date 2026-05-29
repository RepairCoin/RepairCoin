-- 129_create_ai_voice_transcriptions.sql
--
-- Audit log for the Voice AI Dispatcher Phase 1 — OpenAI Whisper STT.
-- See docs/tasks/strategy/voice-ai-dispatcher/implementation.md §4 Phase 1.
--
-- Shape mirrors ai_marketing_messages (128) and ai_insights_messages (122) —
-- same shop-scoped, session-grouped audit pattern. Separate table because
-- voice transcription is a distinct cost stream (OpenAI billing, not
-- Anthropic) and isolating it keeps per-vendor cost attribution clean.
--
-- session_id is client-generated VARCHAR(255) to match the convention used
-- by ai_marketing_messages + ai_insights_messages — frontend mints one per
-- voice-pill open and reuses across multi-turn flows.
--
-- transcript and error_message are both NULLable: a failed Whisper call
-- writes the row with transcript=NULL + error_message="<reason>" so cost
-- and latency are still captured even when the API call failed. A
-- successful call sets transcript and leaves error_message NULL.
--
-- duration_ms is taken from the frontend (the value the browser's
-- MediaRecorder reports). It's the SOURCE for the pre-call spend-cap
-- check and the post-call cost calculation. audio_size_bytes is a sanity
-- field for debugging suspiciously large uploads.

CREATE TABLE IF NOT EXISTS ai_voice_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  duration_ms INTEGER NOT NULL,
  audio_size_bytes INTEGER NOT NULL,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  transcript TEXT,
  latency_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_voice_transcriptions_shop_created
  ON ai_voice_transcriptions(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_voice_transcriptions_session_created
  ON ai_voice_transcriptions(session_id, created_at);

COMMENT ON TABLE ai_voice_transcriptions IS
  'Audit log of every OpenAI Whisper STT call from the Voice AI Dispatcher (Phase 1). Separate from ai_marketing_messages / ai_insights_messages / ai_help_messages so per-vendor cost attribution (OpenAI vs Anthropic) stays clean.';

COMMENT ON COLUMN ai_voice_transcriptions.session_id IS
  'Client-generated id grouping multi-turn voice rows from one voice-pill / inline-mic session. Not a FK.';

COMMENT ON COLUMN ai_voice_transcriptions.duration_ms IS
  'Audio duration as reported by the frontend MediaRecorder. Used for spend-cap pre-check and cost calculation (cost_usd = duration_ms / 60000 * 0.006).';

COMMENT ON COLUMN ai_voice_transcriptions.audio_size_bytes IS
  'Sanity field for debugging suspiciously large uploads. The endpoint hard-caps uploads at 5 MB via multer; values above ~5_000_000 should never appear.';

COMMENT ON COLUMN ai_voice_transcriptions.transcript IS
  'NULL when the Whisper call errored (error_message captures the reason). Set when the call succeeded.';

COMMENT ON COLUMN ai_voice_transcriptions.error_message IS
  'Failure reason when transcript IS NULL. Sanitized — never includes API keys or sensitive headers.';
