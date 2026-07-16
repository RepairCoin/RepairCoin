-- 222 — Agency Program: client invite links.
--
-- An agency generates an invite token; the client opens the link and completes the STANDARD
-- shop signup with their own wallet. On successful registration the new shop is linked to the
-- inviting agency (agency_id + agency_clients row). This keeps client onboarding identical to
-- normal shop signup — the client owns their wallet — while auto-attaching them to the agency.
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS agency_invites (
  token            VARCHAR(100) PRIMARY KEY,
  agency_id        VARCHAR(100) NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  label            VARCHAR(255),              -- optional note for the agency (client name/email)
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  used_by_shop_id  VARCHAR(100),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at      TIMESTAMP WITH TIME ZONE,
  CONSTRAINT chk_agency_invite_status CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_agency_invites_agency ON agency_invites (agency_id, status);
