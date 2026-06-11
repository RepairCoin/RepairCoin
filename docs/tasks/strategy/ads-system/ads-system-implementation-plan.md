# Implementation Plan — FixFlow Centralized Ads System

**Status:** Plan only — code not started. All decisions LOCKED (§1.1 captured + §1.2 Q6/Q8 finalized 2026-06-11) — Stage 0 is build-ready.
**Companion docs (read first):**
- `review-fixflow-ads-system-spec.md` — spec review + open questions + schema adjustments
- `ads-system-narrative-walkthrough.md` — end-to-end story; tells you who's doing what
- `risks-plan-b-zero-roi-and-safeguards.md` — worst-case scenario + safeguard contract terms

**Created:** 2026-05-28
**Base branch:** off latest `main`. Suggested branch prefix: `deo/ads-system-stage-<N>-<slug>`.

---

## 1. Decisions captured (8) + remaining exec input needed (2)

Most of what `review-fixflow-ads-system-spec.md` §6 framed as "open
questions" already have answers somewhere in the existing strategy
docs. They're captured below with their source so coding doesn't
re-relitigate them. **Q6** and **Q8** were the last two undecided;
as of 2026-06-11 they are LOCKED with the recommended defaults (§1.2)
— no exec input required. Stage 0 is unblocked.

### 1.1 Decisions already captured

| # | Decision | Source |
|---|---|---|
| Q1 | **Attribution is progressive, not single-mode.** Stage 1 uses manual admin entry. Stage 2 adds UTM tag attribution on landing pages. Stage 4 adds Meta lead-ad webhook attribution. Each lead carries an `attribution_method` field so downstream analytics know how confident the attribution is. | Spec's "manual-first" philosophy + this plan's Stage 0-4 progression. Not one answer — a phased one. |
| Q2 | **Lead becomes a `customers` row on first transition to `lead_status='booked'`.** Match by phone first (E.164-normalized), then email. Until booked, the lead lives only in `ad_leads`. | `review-fixflow-ads-system-spec.md` §3.2 |
| Q3 | **No standalone `ad_bookings` table.** Add `ad_lead_id` (nullable FK) to existing `service_orders`. Cancel / refund / no-show logic stays in `service_orders` where it already works. | `review-fixflow-ads-system-spec.md` §3.2 + §4 |
| Q4 | **The $500/mo subscription stays as the base.** Plans A / B / C are ad-management add-ons that ride on top, not replacements. Plan A adds $299/mo for dashboard access (shop pays Facebook directly). Plan B charges margin on managed spend. Plan C is performance-fee per booking. | `ads-system-narrative-walkthrough.md` Chapter 9 + "Where revenue comes from" table |
| Q5 | **ROI is computed-at-read, not stored.** `ad_performance_daily.roi` does not exist as a column; the API computes from current `total_spend` and `total_revenue` on every fetch. This auto-corrects when bookings cancel or get refunded after the fact. | `review-fixflow-ads-system-spec.md` §3.6 + §4 |
| Q7 | **Plan B is the default go-to-market.** Sales pitch, dashboard defaults, and pricing surface all lead with Plan B. Plan A is the option for shops that want to keep their existing Meta ad account; Plan C is the upsell for hesitant shops. | `ads-system-narrative-walkthrough.md` Chapter 2 (Sarah picks Plan B) + the entire walkthrough is built around Plan B mechanics |
| Q9 | **180-day retention** for unconverted leads (`lead_status NOT IN ('booked','paid','completed')` AND `created_at < NOW() - INTERVAL '180 days'` → hard-deleted nightly). Converted leads keep their row forever because they're linked to a `customers` row. | Industry standard; no doc-level objection |
| Q10 | **Shop owner is the sole assignee in v1.** No employee routing logic. v2 (post-launch) adds round-robin assignment as opt-in per shop. | `review-fixflow-ads-system-spec.md` §3.9 + §7.4 |

### 1.2 Decisions LOCKED (applied 2026-06-11 — no exec input needed)

These two weren't answered in the existing docs. Rather than block Stage 0
on an exec round-trip, they're locked with the recommended defaults below.
Both are cheap to reverse (Q6 is a read-layer choice with no migration; Q8
is one column), so they can be revisited before Stage 1 goes shop-facing if
anyone objects.

| # | Decision | LOCKED ANSWER | Reasoning |
|---|---|---|---|
| Q6 | Does AI inference cost go into the shop's ROI denominator? | **NO — exclude from the shop-facing ROI; track it internally per campaign (mandatory).** | A shop's ROI must reflect the shop's costs (ad spend + plan fee), not FixFlow's cost of delivering the service. AI inference (~$0.02/convo) is FixFlow COGS, like hosting — *including* it would wrongly conflate FixFlow's margin with the shop's unit economics. So exclude it from Sarah's screen. BUT per-campaign AI cost tracking is MANDATORY (roll up `ai_conversation_audit` from Stage 3) and shown in the admin-only "true margin" panel — it's load-bearing for pricing Plan B (margin) and Plan C (per-booking). This is correct accounting, not hiding. |
| Q8 | Gate ad creative behind internal review, or trust the shop? | **REVIEWED in v1 (lightweight); hands-off self-serve later.** | In v1 the ADMIN creates campaigns + creatives (shops can't self-create — see Stage 1), so review is nearly free: the creator is already internal. Ship `ad_creatives.review_status` + `reviewed_by`/`reviewed_at` + a light approve step, NOT a heavy review-queue product. The real point is protecting FixFlow's SHARED Meta Business Manager account — a policy-violating creative can restrict the *whole platform's* ad account, not just one shop. The full review queue lands later, when shops can self-submit creatives. |

**Status:** LOCKED. Stage 0 schema is finalized. The only schema impact is
the `review_status`/`reviewed_by`/`reviewed_at` columns on `ad_creatives`
(Q8, added below); Q6 is a read-layer decision with no migration. Revisit
before Stage 1 ships shop-facing only if someone objects.

---

## 2. Reusable infrastructure (do NOT rebuild)

### 2.1 Existing platform infrastructure

- **`customers` table** — leads convert into rows here. Don't fork a
  parallel customer model.
- **`service_orders` table** — add `ad_lead_id` (nullable FK) for
  attribution. Cancel / refund / no-show / deposit logic already lives
  here; reuse it.
- **`conversations` + `messages`** — AI replies route through this
  (Stage 3). Lead → conversation → messages → AI tool calls.
- **`shops` + Stripe subscription wiring** — pricing decisions in Q4
  attach here, not to a new ads-specific billing layer.
- **`DomainRegistry` + `EventBus`** — new `AdsDomain` plugs into the
  existing DDD architecture. Cross-domain comms (e.g. `lead:converted`
  → `customer:tier_recalculated`) happen via `EventBus`, never direct
  domain imports.
- **`BaseRepository`** — pagination, transactions, health checks
  already standardized. `CampaignRepository extends BaseRepository`.
- **`AIAgentDomain` (existing)** — Stage 3 (AI agent connection) is
  ~80% built. Add lead-as-entrypoint wiring; do not rewrite the agent.

### 2.2 Existing AI Sales Agent surface (Stage 3 piggyback)

Per the spec-review §5 alignment, Stage 3 reuses these existing pieces
without modification:

| AI Sales Agent piece | Reused by Ads Stage 3 |
|---|---|
| `AgentOrchestrator` + Claude API client | Same — lead conversations route through it |
| `shop_services.ai_sales_enabled` + tone columns | Same — per-service AI config |
| Tool registry: `get_available_slots`, `create_booking`, `escalate_to_human` | Same set + `update_lead_status` (NEW, ads-specific) |
| Audit log: `ai_conversation_audit` | Same — every ad-lead conversation lands here |
| Prompt builder | Extend with an "ad lead" entrypoint tone variant |

Stage 3 ships in **2 weeks**, not 6, because of this reuse.

### 2.3 Existing Stripe subscription wiring

- $500/mo subscription already runs through `ShopDomain` → Stripe.
- Stage 0's pricing decision (Q4) either:
  - Adds a new product SKU (ads add-on at $X/mo on top of $500), OR
  - Replaces the $500 SKU with a new tier (e.g. $799 includes ads).
- DO NOT bypass the existing Stripe flow with a parallel charge path.

---

## 3. Phasing

Six stages. Stage 0 is foundation (no user-visible features). Stages
1-5 follow the spec's original phases with the review's adjustments.

> The phrase **"shop dashboard"** below means the existing
> shop-role frontend at `frontend/src/app/shop/`. **"Admin dashboard"**
> means `frontend/src/app/admin/`.

---

### Stage 0 — Foundation (1 week)

**Goal:** all schema, role-based access, and CRUD wiring in place so
Stages 1-5 are pure feature work.

**Deliverables**

- [ ] **Migrations:**
  - `industries` — reference table seeded with 8 starters (Repair,
    Landscaping, Gyms, Nail Salons, Barbershops, Lawyers, Plumbing,
    Electricians). Confirm list with exec.
  - `ad_campaigns` — adjusted per review §4:
    - `id`, `shop_id`, `industry_id`, `name`, `platform`,
      `target_radius_miles`, `target_units` (mi / km),
      `daily_budget_cents`, `status` (CHECK constraint:
      `'draft' | 'active' | 'paused' | 'archived'`),
      `started_at`, `paused_at`, `archived_at`,
      `notes`, `ai_agent_enabled` (bool),
      `created_by`, `created_at`, `updated_at`, `deleted_at`
  - `ad_creatives` — adjusted per review §4:
    - `id`, `campaign_id`, `creative_type` (CHECK:
      `'image' | 'video' | 'carousel'`),
      `language` (default `'en'`), `landing_url`,
      `landing_url_type` (CHECK:
      `'booking_page' | 'shop_profile' | 'lead_form'`),
      `headline`, `body`, `experiment_id` (nullable — reserved for
      Stage 5 A/B), `version` (int — bump on edit, history preserved),
      `review_status` (CHECK: `'pending' | 'approved' | 'rejected'`,
      default `'pending'` — **Q8 LOCKED:** creative is reviewed before
      launch in v1), `reviewed_by` (nullable FK), `reviewed_at`
      (nullable),
      `created_at`, `updated_at`, `deleted_at`
  - `ad_leads` — adjusted per review §4:
    - `id`, `campaign_id`, `creative_id` (nullable), `customer_id`
      (nullable FK — populated when lead converts to customer),
      `name`, `phone`, `email`, `messenger_id`, `whatsapp_id`,
      `lead_status` (CHECK: `'new' | 'contacted' | 'booked' | 'paid'
       | 'completed' | 'lost'`),
      `assigned_to_employee_id` (nullable FK), `first_response_at`,
      `consent_to_contact` (bool), `consent_version` (string),
      `attribution_method` (CHECK:
      `'manual' | 'utm' | 'click_id' | 'meta_webhook'`),
      `ip_address`, `user_agent`, `notes`, `lost_reason` (nullable),
      `created_at`, `updated_at`
  - **`service_orders` ALTER** — add `ad_lead_id` (UUID nullable FK
    to `ad_leads.id`). Indexed. Backwards-compatible — existing rows
    stay NULL.
  - `ad_performance_daily` — adjusted per review §4:
    - `id`, `campaign_id`, `date` (DATE), `timezone` (string,
      defaults to shop timezone), `spend_cents`, `impressions`,
      `clicks`, `leads_captured`, `conversations_started`,
      `messages_received`, `avg_first_response_minutes`,
      `bookings_created`, `revenue_cents`, `revenue_30d_cents`,
      `revenue_90d_cents` (nullable, lazy-filled),
      `created_at`, `updated_at`
    - **`roi` is NOT stored.** Computed-at-read in the API layer.
  - `ad_safeguards_state` — NEW table for Stage 1 safeguards:
    - `id`, `campaign_id`, `auto_pause_threshold_cents` (default
      40000 = $400 spent with zero leads),
      `auto_pause_no_bookings_cents` (default 80000 = $800 spent
      with zero bookings), `paused_by_safeguard_at`,
      `paused_reason` (string), `notes`

- [ ] **Domain skeleton:**
  - `backend/src/domains/AdsDomain/` following existing DDD pattern
  - `index.ts` implements `DomainModule`
  - `routes.ts` mounted at `/api/ads`
  - `controllers/`: `CampaignController`, `CreativeController`,
    `LeadController`, `PerformanceController`
  - `services/`: `CampaignService`, `LeadAttributionService`,
    `RoiCalculator`, `SafeguardEvaluator`
  - Repositories: `CampaignRepository`, `LeadRepository`,
    `PerformanceRepository`, `SafeguardRepository` — all extend
    `BaseRepository`

- [ ] **Permission middleware** for 4 roles:
  - `super_admin` — full access
  - `ads_manager` — CRUD campaigns + creatives + leads, no
    settings / pricing
  - `shop_owner` — read own campaigns + leads + performance; cannot
    create campaigns in v1 (admin-created only)
  - `employee` — read leads assigned to them, mark contacted

- [ ] **EventBus events** registered (no listeners yet):
  - `ads:campaign_created`, `ads:campaign_paused_by_safeguard`,
    `ads:lead_captured`, `ads:lead_converted_to_customer`,
    `ads:lead_booked`

- [ ] **Typecheck + basic CRUD smoke test** (Postman / curl) before
  moving to Stage 1.

**Acceptance:** all migrations run cleanly on staging; permission
middleware unit-tested for all 4 roles; CRUD endpoints respond.

---

### Stage 1 — Manual Tracking + Performance Dashboard (1-2 weeks)

**Goal:** Marcus (admin) can create campaigns and manually enter
daily metrics. Sarah (shop) sees her campaigns' performance.

**Deliverables**

- [ ] **Admin frontend** (`frontend/src/app/admin/ads/`):
  - Campaign list page (paginated, filterable by shop / status)
  - "New Campaign" form (shop, industry, name, platform,
    target city / radius, daily budget, creative)
  - "Daily Metric Entry" form (one row per campaign per day:
    spend, impressions, clicks, leads, bookings, revenue)
  - Per-campaign performance view: ROI computed at read, with
    Cost Per Lead, Cost Per Booking, lifetime spend, lifetime
    revenue. Sparkline of last 30 days.
  - All-shops summary view (admin only): total spend, total
    bookings, ROI across all campaigns.

- [ ] **Shop frontend** (`frontend/src/app/shop/ads/`):
  - "Your campaigns" page — read-only list of campaigns the admin
    has created for this shop
  - Per-campaign performance card (same metrics as admin view, but
    scoped to this shop only)
  - **Pre-flight quality check banner** (from risks doc §5):
    if shop's review score < 3.5 OR < 5 photos, show a warning
    that ads are unlikely to perform. Source review score from
    existing `shops.review_score` if present, else hide the banner.

- [ ] **ROI compute helper** (`RoiCalculator.computeForCampaign(
  campaignId)`) — pure read-side function. Sums spend + revenue;
  returns `{ roi, cpl, cpb, total_spend, total_revenue }`.

- [ ] **Safeguard evaluator nightly cron** (`SafeguardEvaluator`):
  - For each active campaign: compute days since `started_at`,
    cumulative spend, leads captured, bookings created.
  - If spend ≥ `auto_pause_threshold_cents` AND leads = 0 →
    set `status = 'paused'`, record `paused_by_safeguard_at`,
    fire `ads:campaign_paused_by_safeguard` event.
  - If spend ≥ `auto_pause_no_bookings_cents` AND bookings = 0 →
    same hard-pause path.
  - Per risks-doc §7 Plan B contract terms: $400 = soft alert,
    $800 = hard pause.

- [ ] **Email + push notification** when safeguard fires
  (reuse existing `NotificationDomain`).

**Acceptance:**
- Admin can create + enter daily metrics for a test campaign.
- Shop sees the same campaign's performance card.
- A campaign with $500 spend and 0 leads gets auto-paused on the
  next cron tick.
- ROI math matches the test-fixture campaign's expected values
  (verified by manual entry of known spend + revenue).

---

### Stage 2 — Lead Pipeline + Attribution (1-2 weeks)

**Goal:** Every lead is a row in the system with status pipeline,
attribution method, and shop notification.

**Deliverables**

- [ ] **Lead intake endpoints:**
  - `POST /api/ads/leads/manual` — admin creates a lead by hand
    (attribution_method = `'manual'`)
  - `POST /api/ads/leads/webform` — public endpoint for landing-page
    forms (UTM-attributed, attribution_method = `'utm'`)
  - Both go through `LeadAttributionService.attribute(rawLead)` which
    determines the campaign / creative based on the source data.

- [ ] **UTM landing-page wiring:**
  - Landing pages append `?utm_campaign={campaign_id}&utm_source=
    {platform}&utm_medium=ad&utm_content={creative_id}` automatically.
  - Form submissions read the UTM params from sessionStorage (set on
    page load) and post them with the lead.
  - Click-ID parameter (`fclid` for Facebook, `gclid` for Google) is
    captured if present; stored on `ad_leads` for later Meta API
    sync (Stage 4 use case).

- [ ] **Lead status pipeline UI:**
  - Admin dashboard: kanban-style board of leads (New / Contacted /
    Booked / Paid / Completed / Lost). Drag-and-drop or
    one-click status changes.
  - Per-lead detail drawer: name, contact, attribution, history
    of status changes, notes, assigned employee.
  - Shop dashboard: same board, scoped to their shop only.

- [ ] **Lead deduplication:**
  - On lead intake, check for existing `ad_leads` row with same
    `phone` (E.164 normalized) within 24h. If found → merge:
    bump `lead_count` on the original, do NOT create a new row.
  - Flag `is_duplicate = true` for analytics; counts excluded from
    "leads captured" in `ad_performance_daily`.

- [ ] **First-response SLA tracking:**
  - On lead create → `first_response_at = NULL`.
  - On first outbound message / status change to `'contacted'` →
    set `first_response_at = NOW()`.
  - Shop dashboard surfaces "Leads awaiting response" with
    age-of-lead in minutes.
  - Push notification on new lead (shop owner + admin).

- [ ] **Lead → customer link:**
  - On status change to `'booked'`, check if a `customers` row
    exists for the same phone/email. If yes → populate
    `ad_leads.customer_id`. If no → create a new `customers` row
    and link. Fire `ads:lead_converted_to_customer`.
  - Same logic on `'paid'` if `customer_id` was missed at `'booked'`.

- [ ] **Per-campaign performance roll-up:**
  - Nightly cron updates `ad_performance_daily` with
    leads_captured, conversations_started, bookings_created from
    the lead pipeline.
  - Revenue rolls up from `service_orders.paid_amount` where
    `ad_lead_id IS NOT NULL` and order date matches.

**Acceptance:**
- A test lead submitted via UTM URL gets attributed to the right
  campaign automatically.
- A duplicate phone submission within 24h does NOT create a second
  row.
- Lead → booking → revenue flows end-to-end into `ad_performance_daily`
  without manual entry.
- Push notification fires within 30s of a new lead landing.

---

### Stage 3 — AI Agent Connection (2-3 weeks)

**Goal:** AI agent answers leads automatically, books them, and
hands off to a human when it can't.

**Deliverables**

- [ ] **Lead → conversation entry point:**
  - On `ads:lead_captured` (from Stage 2), `AIAgentDomain` listens
    and starts a new `conversations` row scoped to the lead.
  - `conversations.entry_type = 'ad_lead'` (new enum value).
  - The conversation is linked to the lead via
    `conversations.ad_lead_id` (NEW nullable FK column).

- [ ] **AI agent tone variant:**
  - New `PromptTemplates.ad_lead` variant — direct, sales-forward,
    knows the customer arrived via an ad for service X.
  - Reuses the existing per-service `ai_custom_instructions`.

- [ ] **New tool: `update_lead_status`:**
  - Added to `AIAgentDomain` tool registry.
  - When AI books the lead → calls `update_lead_status('booked')`.
  - When AI hits a question it can't answer → calls
    `escalate_to_human()` AND `update_lead_status('contacted')`
    + a `human_handoff_reason` note.
  - All ai-driven status updates audited with `actor = 'ai_agent'`.

- [ ] **Conversation cost capture:**
  - Each AI response logs `tokens_in`, `tokens_out`, `cost_usd` to
    `ai_conversation_audit` (existing table).
  - **Q6 (LOCKED — exclude):** AI cost is NOT subtracted from the
    shop-facing ROI; `RoiCalculator` ignores it for the shop view.
    Cumulative AI cost per campaign IS rolled up from
    `ai_conversation_audit` and shown in the admin-only "true margin"
    panel — **mandatory**, since it's the input for pricing Plan B/C.

- [ ] **Per-shop AI budget cap (carry-over from AI Sales Agent
  strategy):**
  - When `ai_spend_this_month_usd >= ai_monthly_cap_usd * 0.7` →
    auto-throttle to Haiku (cheaper model).
  - When `>= cap` → AI replies "Let me get a team member" and
    escalates immediately.

- [ ] **Shop responsiveness tracking (Plan B contract term):**
  - When AI escalates → start a 24h timer.
  - If shop doesn't respond within 24h → mark `lead.shop_response_sla_missed = true`.
  - This flag is the disqualifier for the Stage 4 / 5 ROI refund
    trigger (risks doc §7 term 5).

**Acceptance:**
- A new ad lead triggers an AI conversation within 5s.
- AI can book the lead end-to-end (create_booking → update_lead_status
  → ad_performance_daily updates).
- Shop dashboard shows the conversation history with the lead.
- An AI cost row appears in `ai_conversation_audit` for every
  AI response on an ad-lead conversation.

---

### Stage 4 — Meta API Integration (3-4 weeks)

**Goal:** Stop typing daily metrics by hand. Stop forwarding leads
manually. Meta API does both.

**Deliverables**

- [ ] **Meta App + OAuth flow:**
  - FixFlow Meta App registered (one-time, dev team).
  - OAuth flow for shops to connect their Meta Business Manager
    account.
  - Tokens stored encrypted in `shops.meta_oauth_token` (new column)
    + `meta_oauth_refresh_token` + `meta_oauth_expires_at`.
  - Periodic refresh cron.

- [ ] **Meta Lead Ads webhook:**
  - Public endpoint `POST /api/ads/webhooks/meta/leads` registered
    with Meta as the lead form webhook URL.
  - Verifies Meta's `X-Hub-Signature-256` header against the app
    secret.
  - On verified lead → `LeadAttributionService.attribute(metaLead)`
    with `attribution_method = 'meta_webhook'`.
  - Lead is created with `meta_lead_id` (NEW nullable column on
    `ad_leads`) so future webhook updates from Meta can find it.

- [ ] **Meta Insights API daily sync:**
  - Cron pulls daily campaign-level insights from Meta Insights API.
  - Writes to `ad_performance_daily` with the actual `spend_cents`,
    `impressions`, `clicks` from Meta. Manual entries are NOT
    overwritten — instead, Meta data overrides the manual values
    silently and audits the diff in `ad_performance_daily_audit`
    (NEW table).

- [ ] **Conversions API (CAPI) — design but don't ship in v1:**
  - Schema reserves `meta_conversion_event_id` and
    `meta_conversion_sent_at` on `service_orders`.
  - Actual sending is a Stage 4.5 / Stage 5 task.

- [ ] **Per-shop Meta account health checks:**
  - Daily ping to Meta's API to verify token validity.
  - If token expired → email shop owner + admin; pause shop's
    campaigns until reconnected.

**Acceptance:**
- A shop connects their Meta account via OAuth on staging.
- A test Meta Lead Form submission shows up in our system within
  60 seconds with `attribution_method = 'meta_webhook'`.
- Yesterday's Meta campaign spend appears in `ad_performance_daily`
  the next morning without manual entry.

---

### Stage 5 — Multi-Industry Scaling (ongoing)

**Goal:** Same engine, different verticals. Onboard the first
non-repair shop.

**Deliverables**

- [ ] **Industry-specific service taxonomies:**
  - Each industry gets its own seed of `shop_services` defaults
    (Landscaping = `'mow_lawn' | 'trim_hedges' | 'leaf_cleanup'` etc.)
  - Schema doesn't change — just seed data.

- [ ] **Industry-specific AI personas:**
  - `PromptTemplates.{industry}_{tone}` variants seeded per industry.
  - Tested on at least 3 industries before declaring this scalable.

- [ ] **Per-industry analytics dashboard (admin only):**
  - Compare ROI / CPL / CPB across Repair vs Landscaping vs Gyms etc.
  - Surface which industries are crushing it (so sales team can
    double-down) and which aren't (so we can adjust pricing or
    pause acquisition).

- [ ] **A/B testing scaffolding (carry-over from review §7.4):**
  - `ad_creatives.experiment_id` reserved in Stage 0 — now wire it
    up.
  - New `ad_experiments` table: `id`, `name`, `started_at`, `ended_at`,
    `winner_creative_id` (nullable), `notes`.
  - Reporting: split CPL / conversion by `experiment_id`.

- [ ] **Cohort attribution:**
  - `ad_performance_daily.revenue_30d_cents` / `revenue_90d_cents`
    columns are filled by a lag-aware cron — for each campaign-day
    row, sum any revenue from leads attributed to that day's
    campaign over the trailing 30 / 90 days.

**Acceptance:**
- First non-repair shop (e.g. a landscaping shop) is onboarded and
  runs through Stages 1-3 end-to-end.
- Per-industry analytics view shows separate ROI per industry.
- One live A/B test runs through the system with the winner declared
  via the `winner_creative_id` field.

---

## 4. File layout (after Stages 0-3 land)

```
backend/src/domains/AdsDomain/
├── index.ts                      ← DomainModule impl
├── routes.ts                     ← mounted at /api/ads
├── controllers/
│   ├── CampaignController.ts
│   ├── CreativeController.ts
│   ├── LeadController.ts
│   └── PerformanceController.ts
├── services/
│   ├── CampaignService.ts
│   ├── LeadAttributionService.ts
│   ├── RoiCalculator.ts
│   └── SafeguardEvaluator.ts
└── repositories/
    ├── CampaignRepository.ts
    ├── LeadRepository.ts
    ├── PerformanceRepository.ts
    └── SafeguardRepository.ts

backend/src/domains/AIAgentDomain/
└── tools/
    └── updateLeadStatus.ts       ← NEW Stage 3 tool

backend/migrations/
├── NNN_create_ads_tables.sql                  (Stage 0)
├── NNN+1_add_ad_lead_id_to_service_orders.sql (Stage 0)
├── NNN+2_create_ads_safeguards_state.sql      (Stage 0)
├── NNN+3_add_conversations_ad_lead_id.sql     (Stage 3)
├── NNN+4_add_meta_oauth_to_shops.sql          (Stage 4)
└── NNN+5_create_ad_experiments.sql            (Stage 5)

frontend/src/app/admin/ads/
├── page.tsx                      ← campaign list
├── new/page.tsx                  ← create campaign
├── [campaignId]/page.tsx         ← campaign detail
├── leads/page.tsx                ← lead kanban
└── analytics/page.tsx            ← all-shops + per-industry rollup

frontend/src/app/shop/ads/
├── page.tsx                      ← own campaigns list
├── [campaignId]/page.tsx         ← own campaign perf
└── leads/page.tsx                ← own leads kanban
```

---

## 5. Cost calibration

| Item | Estimate | Source |
|---|---|---|
| AI conversation cost per ad lead | ~$0.02 (avg 12-turn convo on Sonnet 4.6) | AI Sales Agent strategy |
| Meta API call cost | $0 (free, rate-limited) | Meta dev docs |
| Stage 4 OAuth + webhook hosting overhead | Negligible (~1 req/sec/shop peak) | — |
| **AI cost passthrough to ROI (Q6 decision)** | If included → ROI dips ~3-5% on average | Estimate |

After Stage 1 ships, capture from `ad_performance_daily` and
`ai_conversation_audit`:

| Metric | Target | Notes |
|---|---|---|
| Cost Per Lead (Plan B campaigns) | < $8 in repair industry | Industry benchmark |
| Cost Per Booking | < $40 | Industry benchmark |
| AI conversation completion rate | > 65% | "AI booked it without human" — the moat |
| Shop response SLA hit rate | > 80% | Plan B refund-trigger denominator |
| Auto-pause false-positive rate | < 5% | If higher → thresholds too tight |

---

## 6. Test plan

- [ ] **Unit tests** — `RoiCalculator`, `LeadAttributionService`,
  `SafeguardEvaluator` (all pure math / decision logic — high test
  value, low test cost).
- [ ] **Integration test** — Full Stage 2 flow on a test shop:
  manual lead → status pipeline → booking → revenue lands in
  `ad_performance_daily` → ROI computes correctly.
- [ ] **Regression test (Stage 3)** — Existing AI Sales Agent flows
  (non-ad customer conversations) still work after the
  `update_lead_status` tool gets added. Tool-selection drift on
  existing entrypoints would be a regression.
- [ ] **Meta webhook signature test (Stage 4)** — Forged signature
  must be rejected; valid signature must accept.
- [ ] **Safeguard edge cases:**
  - Campaign with $399 spent and 0 leads → NOT paused
  - Campaign with $401 spent and 0 leads → soft-pause + email
  - Campaign with $801 spent and 0 bookings → hard-pause + email
  - Campaign with $401 spent and 1 lead → NOT paused (saved by the
    1 lead)
- [ ] **Lead dedupe edge cases:**
  - Same phone, different name within 24h → merge
  - Same phone, 25h apart → new row (intentional)
  - Same email, different phone within 24h → currently NEW row
    (phone-only dedupe in v1; document the limitation)

---

## 7. Rollout strategy

- **Stage 0:** ships to staging only; no user-visible surface. Soak
  for 3 days; verify migrations + permissions on real shop data.
- **Stage 1:** ships to production behind a feature flag
  (`ADS_DASHBOARD_ENABLED`). Admin team uses it first for ~2 weeks
  on a single pilot shop before enabling for any other shop.
- **Stage 2:** same feature flag; admin team manually attributes a
  handful of real leads to verify the pipeline end-to-end before
  exposing the lead board to the pilot shop.
- **Stage 3:** new feature flag `ADS_AI_AGENT_ENABLED`. Off by
  default per shop; admin enables per pilot. Soak for 2 weeks on the
  pilot shop before second shop.
- **Stage 4:** new flag `ADS_META_INTEGRATION_ENABLED`. Off by
  default. Per-shop Meta OAuth opt-in. No global rollout until 3+
  shops have run through Meta-attributed campaigns successfully.
- **Stage 5:** non-repair industries are gated by admin allowlist
  until each industry's AI persona has been validated on at least
  one real shop.

**No big-bang launch.** Every stage proves the architecture on a
pilot shop before it expands.

---

## 8. Risks (from spec review §8 + new ones surfaced during planning)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Attribution accuracy too rough → ROI doesn't match shop's perception | High | High | Q1 locked in §1; transparent `attribution_method` field per lead |
| Parallel `ad_leads` vs `customers` tables drift | High | Medium | `customer_id` link enforced on `lead_status='booked'`; nightly audit job flags any booked lead without a `customer_id` |
| Meta API takes 3-4 weeks but business pushes for faster Stage 4 | Medium | High | Manual entry (Stage 1) is good enough for first 6 months; Stage 4 is acceleration, not unblocking |
| AI inference cost on ad-driven convos exceeds estimates | Medium | Low-Medium | Per-shop budget cap with Haiku fallback (Stage 3) |
| Compliance — Meta rejects integration due to missing consent fields | Medium | High | `consent_to_contact` + `consent_version` on `ad_leads` from Stage 0; lead forms use Meta's templates in Stage 4 |
| Pricing confusion (Q4 unresolved) → shop churn | Medium | High | Block Stage 1 frontend exposure until Q4 decided |
| Refund-driven ROI drift not handled → finance disagrees | High | Medium | Q5 = computed-at-read (default); audit table for retro corrections |
| Slow shop response wastes paid leads | High | High | Stage 2 SLA tracking + push notifications + Stage 3 AI auto-respond as safety net |
| Auto-pause too aggressive → kills viable campaigns early | Medium | Medium | Thresholds configurable per campaign; admin override; audit trail of all safeguard pauses |
| Lead dedupe too aggressive → real leads merged | Medium | Medium | Phone-only dedupe; 24h window only; flag in dashboard so admin can split if needed |

---

## 9. Effort summary

- Stage 0 — Foundation: **1 week**
- Stage 1 — Manual Tracking: **1-2 weeks**
- Stage 2 — Lead Pipeline: **1-2 weeks**
- Stage 3 — AI Agent Connection: **2-3 weeks** (assumes AI Sales
  Agent strategy phases 1-3 have shipped; +1-2 weeks if not)
- Stage 4 — Meta API: **3-4 weeks**
- Stage 5 — Multi-Industry: **ongoing**

**Total to v1 (Stages 0-3):** ~6-8 weeks of focused work, one
backend + one frontend engineer.

**Total to Stage 4 (Meta integration):** ~10-12 weeks.

**Stage 5 is open-ended** — depends on commercial team's
prioritization of which industry to onboard next.

---

## 10. Next step

1. ~~Send the §1.2 recommendations to the exec for Q6 and Q8.~~
   **DONE — Q6/Q8 LOCKED with the recommended defaults (§1.2),
   2026-06-11. No exec round-trip needed.**
2. Hold a 30-min planning meeting to walk through Stages 0-2
   with the engineering team. Confirm reuse of `service_orders` +
   `conversations` + AI agent infrastructure.
3. Cut branch `deo/ads-system-stage-0-foundation` from `main`.
   **Migrations start at 146** (145 is the current max) — and per
   project practice, re-check the next-free number across ALL
   branches/remotes at cut time, since the runner keys on the integer
   version and a duplicate number silently skips one file's SQL.
4. Start Stage 0 — migrations first, then domain skeleton, then
   permissions.

**Stage 0 is fully unblocked** — every decision (the 8 in §1.1 + Q6/Q8
in §1.2) is locked. The engineering team doesn't need to re-debate any
of them.
