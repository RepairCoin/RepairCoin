-- Global SMS opt-out list (shared across ads, notifications, marketing). Keyed by E.164 phone.
-- An opt-out is legally global: when someone texts STOP, ALL platform SMS to that number must stop,
-- regardless of which domain sent it. START re-subscribes (opted_out=false) rather than deleting, so
-- the history is preserved. Every SMS sender checks this table before sending.
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  phone       TEXT PRIMARY KEY,                 -- E.164, e.g. +15551234567
  opted_out   BOOLEAN NOT NULL DEFAULT true,    -- true = suppressed; false = re-subscribed via START
  source      TEXT,                             -- 'stop_keyword' | 'admin' | 'import' | 'start_keyword'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
