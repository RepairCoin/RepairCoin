-- 146_create_ads_tables.sql
--
-- Ads System Stage 0 — foundation tables. Additive; no existing table is touched
-- here (the service_orders ALTER is 147). UUID PKs (gen_random_uuid). shop_id TEXT
-- FK shops(shop_id); customer_id TEXT FK customers(address). ROI is NOT stored
-- (computed-at-read). See docs/tasks/strategy/ads-system/stage-0-scope.md.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid (no-op if present)

-- Reference: industries (seeded). slug used in code; name shown in UI.
CREATE TABLE IF NOT EXISTS industries (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO industries (slug, name) VALUES
  ('repair','Repair'), ('landscaping','Landscaping'), ('gyms','Gyms'),
  ('nail_salons','Nail Salons'), ('barbershops','Barbershops'),
  ('lawyers','Lawyers'), ('plumbing','Plumbing'), ('electricians','Electricians')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  industry_id          INT  REFERENCES industries(id),
  name                 TEXT NOT NULL,
  platform             TEXT NOT NULL DEFAULT 'meta',
  target_radius_miles  NUMERIC(6,2),
  target_units         TEXT NOT NULL DEFAULT 'mi' CHECK (target_units IN ('mi','km')),
  daily_budget_cents   INT  NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','active','paused','archived')),
  ai_agent_enabled     BOOLEAN NOT NULL DEFAULT false,
  notes                TEXT,
  started_at           TIMESTAMPTZ,
  paused_at            TIMESTAMPTZ,
  archived_at          TIMESTAMPTZ,
  created_by           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_shop   ON ad_campaigns (shop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns (status)  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ad_creatives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  creative_type     TEXT NOT NULL CHECK (creative_type IN ('image','video','carousel')),
  language          TEXT NOT NULL DEFAULT 'en',
  landing_url       TEXT,
  landing_url_type  TEXT CHECK (landing_url_type IN ('booking_page','shop_profile','lead_form')),
  headline          TEXT,
  body              TEXT,
  experiment_id     UUID,                                   -- reserved (Stage 5 A/B)
  version           INT  NOT NULL DEFAULT 1,
  -- Q8 LOCKED: creatives are reviewed before launch in v1.
  review_status     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign ON ad_creatives (campaign_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ad_leads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  creative_id             UUID REFERENCES ad_creatives(id),
  customer_id             TEXT REFERENCES customers(address),
  name                    TEXT,
  phone                   TEXT,
  email                   TEXT,
  messenger_id            TEXT,
  whatsapp_id             TEXT,
  lead_status             TEXT NOT NULL DEFAULT 'new'
                            CHECK (lead_status IN ('new','contacted','booked','paid','completed','lost')),
  assigned_to_employee_id TEXT,                             -- nullable; no employee role in v1 (Q10)
  first_response_at       TIMESTAMPTZ,
  consent_to_contact      BOOLEAN NOT NULL DEFAULT false,
  consent_version         TEXT,
  attribution_method      TEXT NOT NULL DEFAULT 'manual'
                            CHECK (attribution_method IN ('manual','utm','click_id','meta_webhook')),
  is_duplicate            BOOLEAN NOT NULL DEFAULT false,
  ip_address              TEXT,
  user_agent              TEXT,
  notes                   TEXT,
  lost_reason             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_leads_campaign ON ad_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_leads_status   ON ad_leads (lead_status);
CREATE INDEX IF NOT EXISTS idx_ad_leads_phone    ON ad_leads (phone);

CREATE TABLE IF NOT EXISTS ad_performance_daily (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  date                       DATE NOT NULL,
  timezone                   TEXT NOT NULL DEFAULT 'America/New_York',
  spend_cents                INT  NOT NULL DEFAULT 0,
  impressions                INT  NOT NULL DEFAULT 0,
  clicks                     INT  NOT NULL DEFAULT 0,
  leads_captured             INT  NOT NULL DEFAULT 0,
  conversations_started      INT  NOT NULL DEFAULT 0,
  messages_received          INT  NOT NULL DEFAULT 0,
  avg_first_response_minutes NUMERIC(8,2),
  bookings_created           INT  NOT NULL DEFAULT 0,
  revenue_cents              INT  NOT NULL DEFAULT 0,
  revenue_30d_cents          INT,
  revenue_90d_cents          INT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);

CREATE TABLE IF NOT EXISTS ad_safeguards_state (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                   UUID NOT NULL UNIQUE REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  auto_pause_threshold_cents    INT NOT NULL DEFAULT 40000,  -- $400 spent, 0 leads
  auto_pause_no_bookings_cents  INT NOT NULL DEFAULT 80000,  -- $800 spent, 0 bookings
  paused_by_safeguard_at        TIMESTAMPTZ,
  paused_reason                 TEXT,
  notes                         TEXT
);
