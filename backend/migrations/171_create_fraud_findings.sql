-- 171 — Fraud & Abuse Detection (Admin AI #1, Phase 0).
-- Stores findings emitted by the nightly FraudScanService: suspicious reward
-- issuance/redemption/review patterns, scored 0-100, for admin review.
-- See docs/FRAUD_DETECTION_SPEC.md.

CREATE TABLE IF NOT EXISTS fraud_findings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key           TEXT NOT NULL,            -- e.g. 'concentrated_issuance'
  severity           INTEGER NOT NULL,         -- 0-100
  status             TEXT NOT NULL DEFAULT 'open',  -- open | investigating | confirmed | dismissed
  subject_type       TEXT NOT NULL,            -- 'shop' | 'customer' | 'pair'
  shop_id            VARCHAR(100),
  customer_address   VARCHAR(42),
  window_start       TIMESTAMP,
  window_end         TIMESTAMP,
  metrics            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- raw numbers behind the finding
  explanation        TEXT,                     -- human-readable "why" (templated; AI-phrased in Phase 4)
  recommended_action TEXT,                     -- 'investigate' | 'freeze' | 'dismiss'
  created_at         TIMESTAMP DEFAULT NOW(),
  reviewed_by        VARCHAR(42),              -- admin address
  reviewed_at        TIMESTAMP,
  resolution_note    TEXT
);

CREATE INDEX IF NOT EXISTS idx_fraud_findings_status   ON fraud_findings(status);
CREATE INDEX IF NOT EXISTS idx_fraud_findings_severity ON fraud_findings(severity DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_findings_shop     ON fraud_findings(shop_id);

-- Dedupe: one finding per (rule, subject, window-start). Re-running a scan over
-- the same window/subject updates the existing row instead of inserting a dup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fraud_finding_dedupe
  ON fraud_findings(
    rule_key,
    subject_type,
    COALESCE(shop_id, ''),
    COALESCE(customer_address, ''),
    COALESCE(window_start, '1970-01-01'::timestamp)
  );
