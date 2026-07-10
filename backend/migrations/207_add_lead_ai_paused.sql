-- 207 — Take-over / pause-AI (Part B redesign, P3). When a shop takes over a conversation, the AI
-- stops auto-answering that lead's inbound replies so the human can handle it without the AI talking
-- over them. Resume clears it. Default false (AI handles by default). Idempotent.
ALTER TABLE ad_leads
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN NOT NULL DEFAULT false;
