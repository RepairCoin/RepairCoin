-- 241_ai_usage_events_management_labels.sql
--
-- Re-groups ai_usage_events by USER-FACING PRODUCT SURFACE, so the admin AI Usage dashboard reads
-- the way management understands the product rather than the way the tables are laid out. Two
-- changes, both on the feature label only — no cost, attribution, or enforcement math moves.
--
-- 1. Fold the interactive Business-Insights panel INTO the assistant line. Both are "ask the AI a
--    business question"; they were only ever separate because they went through different
--    controllers. Live data confirms the panel is all but retired — 42 calls in 60 days vs 1045 for
--    the background phraser, last interactive use 2026-07-17. Its cost now lands under 'assistant'
--    alongside the orchestrator.
--
-- 2. Split the background anomaly phraser out as its own 'ai_recommendation' feature. It is not an
--    "insights" surface anyone opens — it is the engine behind the AI Recommendations section, and
--    lumping it under "Business insights" made a daily automated job look like a user feature.
--
-- The split key is session_id: AnomalyPhraser stamps 'anomaly-<id>'; the interactive panel sends a
-- client-generated UUID. Confirmed on staging that these are the ONLY two shapes in the table.
--
-- 'orchestrate' -> 'assistant' and 'insights' -> ('assistant' | 'ai_recommendation'). The frontend
-- FEATURE_LABELS maps 'assistant' -> "AI Assistant" and 'ai_recommendation' -> "AI Recommendation".
--
-- CREATE OR REPLACE (not DROP): the column shape is unchanged, only two label expressions move, so
-- replace-in-place is safe and needs no dependency juggling.

CREATE OR REPLACE VIEW ai_usage_events AS

  -- Customer-facing AI chat (AI Sales Agent)
  SELECT shop_id, 'agent'::text AS feature, 'anthropic'::text AS vendor, model,
         input_tokens, output_tokens, cost_usd,
         true AS billable_to_shop, (error_message IS NOT NULL) AS is_error,
         created_at::timestamptz AS created_at
    FROM ai_agent_messages

  -- AI Assistant (orchestrator) — the live shop-owner "talk to my business" surface
  UNION ALL
  SELECT shop_id, 'assistant', 'anthropic', model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_orchestrate_messages

  -- Business-Data Insights table feeds TWO product surfaces, split by session_id:
  --   anomaly-<id>  -> the AI Recommendations engine (background; phrases detected anomalies)
  --   <uuid>        -> the interactive Insights panel, which is "ask the AI a business question" and
  --                    folds into the AI Assistant line (the panel is effectively retired).
  UNION ALL
  SELECT shop_id,
         CASE WHEN session_id LIKE 'anomaly-%' THEN 'ai_recommendation' ELSE 'assistant' END,
         'anthropic', model,
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

  -- Surfaces with no per-feature table (see ai_misc_usage)
  UNION ALL
  SELECT shop_id, feature, vendor, model,
         input_tokens, output_tokens, cost_usd,
         true, (error_message IS NOT NULL), created_at::timestamptz
    FROM ai_misc_usage;

COMMENT ON VIEW ai_usage_events IS
  'Single source of truth for AI spend: every per-feature cost table unioned into one shape (shop_id, feature, vendor, model, tokens, cost_usd, billable_to_shop, is_error, created_at). The feature label is the user-facing product surface, not the source table: the AI Assistant line combines the orchestrator and the (retired) interactive insights panel, and the AI Recommendations engine is split out from the same insights table by session_id. Read by the spend cap (filtered to billable_to_shop, non-error) and the admin cost summary (unfiltered). Costs are always USD.';
