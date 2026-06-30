-- 189 — Ad lead activity log (lead follow-up tracking, Phase 1). A per-lead timeline of every
-- contact + status move (email / call / note / status_change). This is the source of truth for
-- "last contacted", response time, and the lead activity timeline — replacing the blind
-- mailto:/tel: links with trackable, logged follow-up.
-- See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md. Idempotent.
CREATE TABLE IF NOT EXISTS ad_lead_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES ad_leads(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('email','call','note','status_change')),
  channel       TEXT,                      -- e.g. 'resend' | 'mailto' | 'phone'
  subject       TEXT,
  body          TEXT,
  outcome       TEXT,                       -- call outcome: reached | no_answer | booked | not_interested
  actor_address TEXT,                       -- who did it (admin/shop wallet); null for system
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {messageId, status, opened, ...}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_lead_activities_lead ON ad_lead_activities (lead_id, created_at DESC);
