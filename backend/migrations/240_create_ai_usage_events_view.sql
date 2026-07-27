-- 240_create_ai_usage_events_view.sql
--
-- AI Usage Tracking, Phase 1 — the single source of truth for AI spend.
--
-- WHY: AI cost was fragmented across 10 per-feature tables, and two consumers each read the wrong
-- subset of them:
--   1. SpendController.getAdminCostSummary read ai_agent_messages ONLY -> the admin dashboard
--      reported ~30% of real spend ($2.96 of $9.78 MTD on 2026-07-24).
--   2. The spend cap read ai_shop_settings.current_month_spend_usd, a hand-incremented counter that
--      drifts low on any missed increment or mid-month reset ($1.78 of under-enforcement MTD).
--
-- This migration adds (a) a ledger for the surfaces that had nowhere to log, and (b) a view that
-- unions every cost source into one shape. Both consumers then read the view, and drift becomes
-- structurally impossible: the counter can't disagree with the audit because it IS the audit.
--
-- No write-path changes to existing tables — this is additive.

-- ---------------------------------------------------------------------------
-- 1. ai_misc_usage — ledger for AI surfaces with no per-feature cost table.
-- ---------------------------------------------------------------------------
-- Three surfaces charged the spend counter but wrote no audit row anywhere:
-- BrandKitController (logo/vision colour extraction), FaqSuggestionController (FAQ suggestions),
-- and VoiceSpeakController (OpenAI TTS). Without this table, deriving spend from the view would
-- read $0 for them and under-enforce the cap in a NEW way. One shared table rather than three:
-- these surfaces are low-volume and need no per-feature reporting of their own, just correct
-- attribution. `feature` keeps them separable if that changes.
CREATE TABLE IF NOT EXISTS ai_misc_usage (
  id            BIGSERIAL PRIMARY KEY,
  shop_id       VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  feature       VARCHAR(48)  NOT NULL,          -- 'brand_kit' | 'faq_suggestion' | 'voice_tts'
  vendor        VARCHAR(32)  NOT NULL,          -- 'anthropic' | 'openai'
  model         VARCHAR(64),
  input_tokens  INTEGER      NOT NULL DEFAULT 0,
  output_tokens INTEGER      NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms    INTEGER,
  metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_misc_usage_shop_created
  ON ai_misc_usage (shop_id, created_at DESC);

COMMENT ON TABLE ai_misc_usage IS
  'Cost ledger for AI surfaces that have no per-feature audit table of their own (brand-kit vision, FAQ suggestions, voice TTS). Exists so ai_usage_events can account for 100% of AI spend — without it these surfaces charge the spend cap but are invisible to the audit.';
COMMENT ON COLUMN ai_misc_usage.feature IS
  'Which surface produced the cost. Kept free-form (not an enum) so a new low-volume surface can log here without a migration.';
COMMENT ON COLUMN ai_misc_usage.metadata IS
  'Surface-specific detail (e.g. {charCount} for TTS, {serviceId} for FAQ suggestions). Not read by the view.';

-- ---------------------------------------------------------------------------
-- 2. ai_usage_events — every AI cost event in the platform, one shape.
-- ---------------------------------------------------------------------------
-- Normalized columns:
--   shop_id           attribution target
--   feature           which surface spent the money
--   vendor            'anthropic' | 'openai' | 'stability' — for invoice reconciliation
--   model             NULL where the source doesn't record one (e.g. whisper is implied)
--   input/output_tokens  0 where the source is not token-billed (images, transcription, TTS)
--   cost_usd          ALWAYS usd — the two ads tables are cents-denominated and divided here
--   billable_to_shop  D3: false for ads-attributed spend, which bills to the ads budget, not the
--                     shop's AI allowance. The spend CAP filters on this; the admin COGS panel
--                     does not. Two consumers, same view, different filters.
--   is_error          the call failed. Cost is still real (tokens were burned) so it stays in the
--                     view; consumers that want success-only filter it out.
--   created_at        TIMESTAMPTZ throughout. Sources are mixed TIMESTAMP/TIMESTAMPTZ, so every
--                     leg casts explicitly — otherwise month bucketing skews at boundaries.
--
-- PERF — why the ads legs cast shop_id to VARCHAR(255):
-- `ad_campaigns.shop_id` is TEXT while the other nine sources are VARCHAR(255). Left alone, the
-- UNION coerces the whole column and Postgres can no longer push a `WHERE shop_id = $1` qual down
-- into the individual legs — it filters ABOVE the Append instead, so every leg scans all of its
-- current-month rows for every shop (measured: 345 rows discarded to return 99). Casting the two
-- ads legs makes all eleven natively VARCHAR(255), the qual pushes down, and each leg uses its
-- idx_*_shop_created index. The cast lands on the two legs that are constant-folded away anyway
-- (billable_to_shop = false), so it costs nothing.
--
-- Dropped rather than replaced because CREATE OR REPLACE VIEW cannot change a column's type.
DROP VIEW IF EXISTS ai_usage_events;

CREATE VIEW ai_usage_events AS

  -- Customer-facing AI chat (AI Sales Agent)
  SELECT shop_id, 'agent'::text AS feature, 'anthropic'::text AS vendor, model,
         input_tokens, output_tokens, cost_usd,
         true AS billable_to_shop, (error_message IS NOT NULL) AS is_error,
         created_at::timestamptz AS created_at
    FROM ai_agent_messages

  -- Unified Assistant / orchestrator — the live shop-owner AI surface
  UNION ALL
  SELECT shop_id, 'orchestrate', 'anthropic', model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_orchestrate_messages

  -- Business-Data Insights (incl. anomaly + recommendation phrasing)
  UNION ALL
  SELECT shop_id, 'insights', 'anthropic', model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_insights_messages

  -- AI Marketing Assistant
  UNION ALL
  SELECT shop_id, 'marketing', 'anthropic', model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_marketing_messages

  -- How-To Assistant
  UNION ALL
  SELECT shop_id, 'help', 'anthropic', model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_help_messages

  -- Voice: Whisper STT. No model column on the source; whisper-1 is the only model used.
  UNION ALL
  SELECT shop_id, 'voice_stt', 'openai', 'whisper-1',
         0, 0, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_voice_transcriptions

  -- Voice: cross-domain router classification. Cost lives in router_cost_usd, not cost_usd —
  -- which is why an earlier pass concluded this table had no cost column at all.
  UNION ALL
  SELECT shop_id, 'voice_router', 'anthropic', NULL,
         router_input_tokens, router_output_tokens, router_cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_dispatch_audit

  -- Image generation + editing. use_case='ads' bills to the ads budget, not the shop's AI
  -- allowance (matches ImageGenerationService's `if (useCase !== 'ads') recordSpend(...)`), so
  -- those rows are billable_to_shop=false rather than excluded — the admin COGS panel still needs
  -- to see them.
  UNION ALL
  SELECT shop_id, 'image', vendor, model,
         0, 0, cost_usd,
         (COALESCE(use_case, '') <> 'ads'), (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_image_generations

  -- Ads: creative generation. Cents-denominated; keyed on campaign_id so shop attribution comes
  -- from ad_campaigns. Stays in the ads per-campaign True-Margin view too — same table, two lenses.
  UNION ALL
  SELECT c.shop_id::varchar(255), 'ads_creative', 'anthropic', a.model,
         0, 0, (a.cost_cents / 100.0)::numeric(10,6),
         false, false, a.created_at::timestamptz
    FROM ad_ai_costs a
    JOIN ad_campaigns c ON c.id = a.campaign_id

  -- Ads: lead auto-reply AI. Same cents scale, one more join hop to reach the shop.
  UNION ALL
  SELECT c.shop_id::varchar(255), 'ads_lead', 'anthropic', NULL,
         0, 0, (m.ai_cost_cents / 100.0)::numeric(10,6),
         false, false, m.created_at::timestamptz
    FROM ad_lead_messages m
    JOIN ad_leads l     ON l.id = m.lead_id
    JOIN ad_campaigns c ON c.id = l.campaign_id
   WHERE m.ai_cost_cents > 0

  -- Surfaces with no per-feature table (see ai_misc_usage above)
  UNION ALL
  SELECT shop_id, feature, vendor, model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_misc_usage;

COMMENT ON VIEW ai_usage_events IS
  'Single source of truth for AI spend: every per-feature cost table unioned into one shape (shop_id, feature, vendor, model, tokens, cost_usd, billable_to_shop, is_error, created_at). Read by BOTH the spend cap (filtered to billable_to_shop) and the admin cost summary (unfiltered). Costs are always USD — the ads tables are cents-denominated and converted here. Adding a new AI surface means adding a leg here, or logging to ai_misc_usage.';
