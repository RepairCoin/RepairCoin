-- 208 — Escalation (Part B redesign, P3). When an inbound reply shows booking intent (or the AI is
-- uncertain), the conversation is escalated: it forces the 'needs_human' state (even if the AI
-- answered) and fires a high-urgency "ready to book" notification, so a person closes the hot lead.
-- Null = not escalated; cleared when a human replies. Idempotent.
ALTER TABLE ad_leads
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP NULL;
