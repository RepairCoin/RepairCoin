# AI Sales Agent — Phase 3: Claude Integration Implementation Plan

**Created:** 2026-05-05
**Status:** 🟢 In progress — **9 of 13 tasks complete** + Task 10 awaiting merge
**Last updated:** 2026-05-07 (Task 10 — booking suggestion buttons with real availability — pushed)
**Effort:** ~3 weeks engineering (~12-15 working days)
**Blocker:** None (was Anthropic API key — now resolved)
**Strategy doc:** `ai-sales-agent-integration-strategy.md` (architecture, model selection, cost model, safety)
**Parent doc:** `ai-sales-agent-implementation-plan.md` (Phases 1, 2, 2.5 — all complete)
**Procurement doc:** `anthropic-api-procurement.md` (exec-facing setup steps)

---

## Progress snapshot (2026-05-06)

| # | Task | Status | Branch | Notes |
|---|---|---|---|---|
| 1 | Foundation: SDK + AIAgentDomain skeleton | ✅ Merged to main (PR #295) | `deo/phase-3-task-1` (merged) | `/api/ai/health` reachable on staging + prod |
| 2 | Migration 110: ai_agent_messages + ai_shop_settings | ✅ Merged to main (PR #296) | `deo/phase-3-task-2` (merged) | Applied to staging; 42 shops backfilled |
| 3 | AnthropicClient wrapper + types + tests | ✅ Merged | `deo/phase-3-task-3` (merged) | 15 unit tests passing, real-API smoke validated |
| 4 | ContextBuilder + PromptTemplates | ✅ Merged + on staging | `deo/phase-3-task-4` (merged) | 43 unit tests passing |
| 5 | AgentOrchestrator + AuditLogger + safety guards | ✅ Merged to main | `deo/phase-3-task-5` (merged) | 49 unit tests passing. Staging deploy auto-rolled-back due to DB connection exhaustion — needs manual redeploy |
| 6 | POST /api/ai/preview endpoint | ✅ Merged to main + on staging | `deo/phase-3-task-6` (merged) | 19 unit tests passing. Real-API smoke validated all 3 acceptance criteria on staging (happy path + cache + 403 ownership) |
| 7 | Frontend: swap aiPreviewMocks → live API | ✅ Merged + visually verified on staging | `deo/phase-3-task-7` (merged) | Live preview rendered correctly for peanut shop's "Newly Baker" service with $99 + 30 min context |
| 8 | Hook into MessageService.sendMessage | ✅ Merged + verified end-to-end on staging | `deo/phase-3-task-8` (merged) + 2 fix branches: `deo/phase-3-task-8-fix` (metadata.serviceId fallback + shopId ownership check) and `deo/phase-3-task-8-fix-2` (ContextBuilder messageText field + orchestrator empty-content filter) | 141 unit tests passing. Smoke validated: 3 successful AI replies on conv_1773038873896 (~$0.004 each, ~3s latency). Personalization, multi-turn, escalation, AI disclosure, honest-on-uncertainty all working. See "Task 8 fix" + "Task 8 second fix" sections below |
| 9 | Customer-facing AI UI: badges + disclosure | ✅ Merged + deployed | `deo/phase-3-task-9` (merged) | Violet AI badges live on staging — chat bubble label, service detail modal, marketplace card |
| 10 | Booking suggestion buttons (Flavor B) | ⏳ Pushed, awaiting PR | `deo/phase-3-task-10` | Picked Option B (real availability injection). New `AvailabilityFetcher` + `BookingSuggestionParser` backend; `BookingSuggestionCard` frontend; checkout pre-fill via `?suggestedSlotIso=`. 158 tests passing |
| 11 | Order completion confirmation hook | Not started | — | ~0.5 day |
| 12 | Spend cap monitoring + admin visibility | Not started | — | ~0.5 day. **Bonus:** also fix the `current_month_spend_usd` rollover bug found during Task 8 smoke — audit log shows $0.012 spent across 3 calls but `ai_shop_settings.current_month_spend_usd` still reads $0.00. Likely interaction with NULL `current_month_started_at` from migration 110 backfill |
| 13 | Production rollout to pilot shops | Not started | — | Final task |

**What works today (post-merge of Tasks 1-8):**
- `/api/ai/health` returns live metadata on staging + prod
- `ai_agent_messages` and `ai_shop_settings` tables on staging (42 shops backfilled, `ai_global_enabled=false` default — opt-in)
- `conversations.service_id` column added (migration 111) — binds threads to a service for the AI hook
- `POST /api/ai/preview` — shop-side live preview, Haiku 4.5, 1-hour cache, full auth/ownership gating
- Shop dashboard "See How the AI Replies" calls the live API (Task 7) — preview shows real Claude reply for the shop's own service
- **Customer messages on AI-enabled services trigger live AI replies** (Task 8) — peanut's "Newly Baker" verified end-to-end with multi-turn conversation, personalization (uses customer name), service context ($99 + 30 min), graceful escalation when data is missing
- Audit log writes one row per Claude call (`ai_agent_messages`) — 4 rows on staging, 3 successful + 1 captured the bug fixed in fix-2
- Spend recording fires per call (one known issue: `current_month_spend_usd` rollover not incrementing — flagged for Task 12)

**What does NOT work yet (Tasks 9+):**
- No customer-facing visual disclosure that a message was AI-generated (Task 9 — UI badges)
- No inline booking suggestion buttons in the chat thread (Task 10 — Flavor B)
- No automatic confirmation message when an order completes (Task 11)
- No admin spend dashboard / per-shop cost visibility (Task 12)
- Not yet rolled out to non-test shops (Task 13)

**Cost burned so far on Phase 3:** ~$0.013 (1 spike + wrapper smoke + preview smoke + 3 Task 8 customer-facing replies). Credit balance: ~$19.99 of $20.00. Plenty of runway.

**Resumption point next session:** start Task 9 (customer-facing AI badges + disclosure UI). Branch off latest `main`. Frontend-heavy task — adds a "🤖 AI assistant" badge above messages where `metadata.generated_by === 'ai_agent'` (already populated by AgentOrchestrator on every AI reply since Task 5), plus an "AI-assisted" badge near the service title in the marketplace + service detail pages.

---

## Goal

Make the AI Sales Assistant section actually do something. Replace mocked previews with live Claude calls, hook into customer messaging so AI auto-replies on services where `ai_sales_enabled=true`, ship the foundation for audit logging, per-shop budget caps, and basic safety controls.

**MVP scope: button-based booking (Flavor B).** AI surfaces inline booking suggestion cards in the chat; customer taps the card to confirm via the existing booking flow. **No direct tool-call booking** — that's Phase 4.

---

## Prerequisites

| Item | Status | Notes |
|---|---|---|
| Phase 1 (page-based UI + visual AI section) | ✅ Done 2026-04-30 / 2026-05-01 | Shipped to prod |
| Phase 2 (DB columns + persisted toggles) | ✅ **Shipped to prod 2026-05-05** | Migration 108 verified clean on prod; 5 AI columns active on `shop_services` |
| Phase 2.5 (exec copy iteration) | ✅ Done 2026-05-01 | "Auto Sales & Booking" label, narrative mocks |
| Anthropic API key | ✅ Obtained 2026-05-05 | Keys regenerated by operator after owner couldn't recover originals |
| Anthropic Console org + workspace setup | ✅ **Verified 2026-05-05** | See "Anthropic Console verification — completed 2026-05-05" section below |
| Account tier promotion (Tier 2+ for production rate limits) | 🟡 Tier 1 (auto-promotes naturally) | Tier 1 sufficient for engineering spike. Tier 2 unlocks once $5+ spent + 7-day age — will happen organically during Tasks 1-5. Tier 2-3 needed before customer rollout. |

**Hard prerequisite for prod rollout** (NOT for engineering work to start): Phase 2 prod deploy + Production workspace API key + spend caps. Engineering work itself can start against the staging environment with the Development workspace key.

### Anthropic Console verification — completed 2026-05-05

Verified via screenshots from the operator:

| Component | State | Notes |
|---|---|---|
| Organization | ✅ Exists | Auto-named "Dev RepairCoin-2's Individual Org" — functional. Optional cosmetic rename to "RepairCoin" / "FixFlow" deferred (not blocking). Org ID: `5fa5ad47-1f31-4749-bf8f-99be22250631`. Billing address on file. |
| Workspaces | ✅ All 3 environment workspaces exist | Created 2026-05-03: `Production`, `Staging`, `Development`. Plus a default `Default` (0 keys, ignore) and `Claude Code` (legacy, IDE tool — unrelated to Phase 3). |
| Payment method | ✅ Link by Stripe | Card on file. |
| Initial credit | ✅ $20.00 balance | Credit grant May 2 2026, expires May 3 2027 ($21.32 invoice). Sufficient for Tasks 1-5 (foundation work — thousands of test calls). |
| API keys per environment | ✅ All 3 environments have keys | `Engineer Dev - Deo` → Development. `FixFlow Backend - Staging` → Staging. `FixFlow Backend - Production` → Production. All created 2026-05-03. |
| Spend cap | ✅ $100/month org-level | Set on the Limits page. Per-workspace caps not exposed at Tier 1; revisit when Tier 2+ unlocks. |

**Engineer handoff:** the `Engineer Dev - Deo` key (`sk-ant-api03-3ja...agAA`) is the one to drop into `backend/.env` as `ANTHROPIC_API_KEY=` for Task 1. Staging and Production keys are held back for Tasks 6+ and Task 13 respectively.

### Console follow-ups (non-blocking, do during Phase 3 soak)

These are operator-side polish items that don't block engineering but should land before the prod rollout (Task 13):

| Item | Where | When to do | Why |
|---|---|---|---|
| Add 70% spend-threshold email notification | Console → Limits → Email notification (right column) | Anytime in Week 1 of Phase 3 | Get warned at ~$70 spent before the $100 hard cap kicks in. Currently no notification configured. ~2 min to add. |
| Enable Auto-Reload on credit balance | Console → Billing → next to "Auto reload is disabled" | After ~2 weeks of Phase 3 work, when spend pattern is predictable | Prevents API interruptions when credit runs out mid-deploy. Currently disabled. Set a refill threshold (e.g., $10 remaining → reload $50). |
| (Optional) Rename org to "RepairCoin" or "FixFlow" | Console → Organization settings → Organization name | Anytime, purely cosmetic | Cleaner invoice / customer-facing reference. Current name is the sign-up auto-default. |
| (Optional, later) Switch from Individual Org → Team plan | Anthropic sales | When team grows beyond 1 admin | Currently Individual Org with 1 member. Team plan would let multiple engineers share workspaces with proper RBAC. Not needed for the foreseeable future. |

---

## Architecture

Follows the existing DDD pattern. Lifted directly from `ai-sales-agent-integration-strategy.md` — restated here for actionable reference:

### New domain: `AIAgentDomain`

```
backend/src/domains/AIAgentDomain/
├── index.ts              # DomainModule registration
├── routes.ts             # Express routes (mounted at /api/ai)
├── controllers/
│   ├── AgentController.ts        # Customer-facing message endpoint
│   ├── PreviewController.ts      # Shop-side "see how AI replies"
│   └── AdminAgentController.ts   # Cost / audit dashboard (Phase 4)
├── services/
│   ├── AnthropicClient.ts        # SDK wrapper, retry/backoff, prompt caching
│   ├── AgentOrchestrator.ts      # Main flow: build context → call Claude → handle response
│   ├── ContextBuilder.ts         # Assembles service + customer + conversation context
│   ├── PromptTemplates.ts        # System prompts per tone (Friendly / Professional / Urgent)
│   ├── EscalationDetector.ts     # Light text-pattern matching for "talk to human"
│   ├── SpendCapEnforcer.ts       # Per-shop monthly cap + Haiku auto-throttle at 70%
│   └── AuditLogger.ts            # Writes every request/response to ai_agent_messages
└── constants.ts          # Token/cost/limit constants
```

### Database additions (migration 109 — confirm next available number first)

**`ai_agent_messages`** — audit log of every Claude call:

```sql
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  service_id VARCHAR(100) REFERENCES shop_services(service_id) ON DELETE SET NULL,
  shop_id VARCHAR(100) NOT NULL REFERENCES shops(shop_id),
  customer_address VARCHAR(42) NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  model VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tool_calls JSONB DEFAULT '[]'::jsonb,  -- empty in MVP, populated when Phase 4 ships tool use
  latency_ms INTEGER,
  escalated_to_human BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_agent_messages_shop_created ON ai_agent_messages(shop_id, created_at DESC);
CREATE INDEX idx_ai_agent_messages_conversation ON ai_agent_messages(conversation_id, created_at DESC);
CREATE INDEX idx_ai_agent_messages_customer ON ai_agent_messages(customer_address, created_at DESC);
```

**`ai_shop_settings`** — per-shop overrides:

```sql
CREATE TABLE IF NOT EXISTS ai_shop_settings (
  shop_id VARCHAR(100) PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  ai_global_enabled BOOLEAN NOT NULL DEFAULT true,  -- master kill-switch per shop
  monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  current_month_spend_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  current_month_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  escalation_threshold INTEGER NOT NULL DEFAULT 5,  -- always handoff after N AI replies
  business_hours_only_ai BOOLEAN NOT NULL DEFAULT false,
  blacklist_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Existing `shop_services.ai_*` columns from migration 108 (Phase 2) provide per-service config. Per-shop config layers on top.

### Conversation flow (text-only, no tool calls in MVP)

1. Customer sends a message in an existing `conversations` thread tied to a `service_id`
2. `MessageService` inserts the customer message
3. **Hook fires:** if `service.ai_sales_enabled=true` AND `ai_shop_settings.ai_global_enabled=true` AND under monthly budget AND not escalated → enqueue AI reply job
4. `AgentOrchestrator.handleCustomerMessage(messageId)`:
   - `ContextBuilder.build(customerAddress, serviceId, conversationId)` returns:
     - Service info (description, price, duration, category, custom instructions)
     - Last 20 conversation messages
     - Customer profile (tier, recent bookings, RCN balance)
     - Sibling services (if `ai_suggest_upsells=true`)
     - Shop hours
   - `PromptTemplates.systemPrompt(tone, context)` builds the cached system prompt
   - `EscalationDetector.shouldEscalate(message, history)` — if true, skip AI, notify shop
   - `SpendCapEnforcer.modelChoice(shopId)` returns `'sonnet-4-6'` or `'haiku-4-5'` based on spend
   - `AnthropicClient.complete(systemPrompt, conversationHistory, model)` → returns reply text
   - Reply inserted into `messages` with `sender_type='shop'`, `metadata: { generated_by: 'ai_agent', model, tone }`
   - `AuditLogger.log(...)` writes to `ai_agent_messages`
5. Customer sees the reply with an AI badge in the existing messaging UI

### What's deferred to Phase 4

- Direct tool-call booking (`create_booking` tool — AI auto-creates booking without customer button-tap)
- Full escalation tool with reason capture + SLA tracking
- Quality scoring (thumbs up/down per AI message)
- A/B testing (AI on vs AI off conversion lift)
- Per-shop fine-tuning / few-shot prompting from `quick_replies`
- Multi-modal input (voice/photo)
- pgvector for cross-shop service search

---

## Task list

### Task 1 — Foundation: Anthropic SDK + AIAgentDomain skeleton ✅ DONE (2026-05-05)

**Goal:** add the dependency, create empty domain shell, register with `DomainRegistry`. No functional change yet.

**Status:** Shipped on branch `deo/phase-3-task-1`, commit `3d1f9616`. Pending PR + merge to main.

**Steps:**
1. ✅ Add to `backend/package.json`: `"@anthropic-ai/sdk": "^0.93.0"`
2. ⏭ ~~Add env vars to `backend/.env.example`~~ — **SKIPPED**: file does not exist in this repo. Env vars are documented inline in `AIAgentDomain/index.ts` JSDoc instead. Future enhancement: introduce `.env.example` if the team adopts that convention.
3. ✅ Create `backend/src/domains/AIAgentDomain/index.ts` implementing `DomainModule`:
   - `name = 'ai'` ← **deviation: changed from `'ai-agent'`**
   - Empty router with one health-check endpoint (`GET /api/ai/health`) for sanity verification
4. ✅ Register in `backend/src/app.ts`: `domainRegistry.register(new AIAgentDomain())` after InventoryDomain
5. ✅ Add `ANTHROPIC_API_KEY` validation to `StartupValidationService.validateEnvironmentConfig()` — error in production, warn-only in dev/staging

**Deviations from plan:**

- **No `mountPath` field in DomainModule.** The plan called for `mountPath = '/api/ai'` as a separate field, but the existing `DomainModule` interface doesn't have one. Routes are mounted at `/api/${domain.name}` by `DomainRegistry.getRoutes()` in `app.ts:454-458`. To match the strategy doc's `/api/ai` mount path, **set `name = 'ai'`** (instead of `'ai-agent'` as the plan suggested). Folder kept as `AIAgentDomain/` for descriptiveness.
- **Production-vs-non-production split for env validation.** The plan said "error on startup if missing in production env" — implemented as: production raises an `issues` entry (causes `isValid=false`), non-production raises a `recommendations` entry (warn-only, server still starts). This matches how `JWT_SECRET` is validated in the same method.
- **No `.env.example` file in repo.** Documented env vars in `AIAgentDomain/index.ts` JSDoc rather than introducing a new file convention.

**Acceptance verified:**
- ✅ TypeScript: 0 errors
- ✅ Server boots clean (`npm run dev`); startup logs show `Domain registered: ai`, `✅ Domain initialized: ai`, `Domain route registered: /api/ai`
- ✅ `GET /api/ai/health` returns the skeleton metadata JSON
- ✅ Spike script (`scripts/_spike-anthropic.ts`, deleted after run) verified end-to-end Sonnet 4.6 call: 16 input tokens, 10 output tokens, 2.6s latency, ~$0.0003 cost

**Rollback:** `git revert 3d1f9616`. No DB or runtime side effects.

**Files changed:**
- `backend/package.json` (+1 dep)
- `backend/package-lock.json` (auto-update)
- `backend/src/app.ts` (+2 lines: import + register)
- `backend/src/services/StartupValidationService.ts` (+15 lines: env validation block)
- `backend/src/domains/AIAgentDomain/index.ts` (NEW, 30 lines)
- `backend/src/domains/AIAgentDomain/routes.ts` (NEW, 23 lines)

### Task 2 — Migration 110: `ai_agent_messages` + `ai_shop_settings` ✅ DONE (2026-05-05)

**Goal:** add the two tables. Idempotent SQL with `IF NOT EXISTS`.

**Status:** Applied to staging via one-shot Node script (auto-runner precedent from migration 108). Migration file shipped on branch `deo/phase-3-task-2`. Pending PR + merge to main.

**Migration number:** **110** (not 109 — collision with `109_create_inventory_tables.sql` from the inventory feature that landed on main between Phase 3 plan creation and Task 2 execution)

**Steps:**
1. ✅ Created `backend/migrations/110_create_ai_agent_tables.sql` with the SQL from the Architecture section above
2. ✅ Backfill row included: `INSERT INTO ai_shop_settings (shop_id) SELECT shop_id FROM shops ON CONFLICT (shop_id) DO NOTHING;`
3. ✅ Applied on staging via one-shot ts-node script (transaction-wrapped, manual schema_migrations row insert)

**Deviations from plan:**

- **Migration number bumped 109 → 110** due to collision with the inventory feature's migration that landed first.
- **`ai_global_enabled` default flipped from `true` to `false`.** Safer (opt-in), consistent with `shop_services.ai_sales_enabled` from Phase 2 (also defaults false), and removes the need for Task 13's "UPDATE all shops to false on prod" step. This is now baked into the schema default.
- **`service_id` is a soft reference (no FK), VARCHAR(255) not UUID.** Pre-existing schema drift on `shop_services`: migration 036 declares `service_id` as `UUID PRIMARY KEY`, but the live tables on staging have it as `VARCHAR` with NO PK constraint. PostgreSQL refused the FK because there's no unique constraint to reference. Workaround: store as `VARCHAR(255)` with a partial index for query performance. A follow-up migration can re-introduce the FK once the shop_services drift is fixed (separate concern, out of scope for Phase 3).
- **`conversation_id` and `customer_address` types corrected** to match the live messaging schema (`VARCHAR(255)` not UUID/VARCHAR(42) as the plan originally specified).

**Acceptance verified on staging:**
- ✅ Both tables created (`ai_agent_messages`, `ai_shop_settings`)
- ✅ All 42 existing shops backfilled into `ai_shop_settings` (1:1 with shops table)
- ✅ All defaults correct: `ai_global_enabled=false`, `monthly_budget_usd=20.00`, `escalation_threshold=5`
- ✅ Indexes created (4 on `ai_agent_messages`, 1 partial on `ai_shop_settings.ai_global_enabled WHERE true`)
- ✅ `schema_migrations` row recorded (version=110, name=`create_ai_agent_tables`)

**Files changed:**
- `backend/migrations/110_create_ai_agent_tables.sql` (NEW, ~110 lines including comments)

**Rollback:** `DROP TABLE ai_agent_messages CASCADE; DROP TABLE ai_shop_settings CASCADE; DELETE FROM schema_migrations WHERE version = 110;` Both tables are empty (no production data) so no loss. Better: leave tables in place, ignore in code if Phase 3 needs to be paused.

**Follow-up note for future tasks:** the Task 13 step "Set `ai_global_enabled=false` for ALL shops by default in prod" (the cautious-rollout SQL UPDATE) is no longer needed — the schema default handles it. Update Task 13 verification accordingly.

### Task 3 — `AnthropicClient` + retry/backoff + prompt caching ✅ DONE (2026-05-05)

**Goal:** A typed wrapper around the SDK that handles retry, error normalization, and prompt caching. Single source of truth for Claude calls.

**Status:** Shipped on branch `deo/phase-3-task-3`. Pending PR + merge to main.

**Steps:**
1. ✅ Created `backend/src/domains/AIAgentDomain/services/AnthropicClient.ts`
2. ✅ `complete(options: AnthropicCallOptions): Promise<ClaudeResponse>` — single-options-bag signature (cleaner than positional args from the plan)
   - 3 retries on 429/5xx with exponential backoff (1s → 2s → 4s)
   - 4xx (except 429) surfaces immediately without retry
   - `cache_control: { type: 'ephemeral' }` attached when block.cache=true
3. ✅ Types in `backend/src/domains/AIAgentDomain/types.ts`: `ChatMessage`, `PromptCacheable`, `ClaudeResponse`, `ClaudeModel`, `ResponseUsage`, `AnthropicCallOptions`
4. ✅ Cost calculator: `static calculateCost(usage, model)` — USD per call broken down by input + output + cache_write + cache_read rates per Anthropic 2026-05 pricing
5. ✅ 15 unit tests in `backend/tests/ai-agent/AnthropicClient.test.ts` — cover cost calculation across models, retry behavior on 429/5xx, immediate-fail on 400/401, max-retry exhaustion, prompt-cache header attachment, instantiation guards

**Acceptance verified:**
- ✅ `tsc --noEmit` — 0 errors
- ✅ All 15 unit tests pass (covers cost math, retry, error mapping, cache headers, missing-key guard)
- ✅ Real-API smoke test against staging via temp script: two calls to Claude Sonnet 4.6 returned valid responses, latency 2-4s, cost ~$0.0003/call. Smoke test deleted post-validation.

**Deviations from plan:**

- **Single-options-bag signature** instead of positional args: `complete(options: AnthropicCallOptions)`. Cleaner extensibility (adding `temperature` later doesn't break callers). Same semantics, just nicer DX.
- **Static `calculateCost`** instead of an instance method — no per-call state needed; same call works for live cost calc and historical recomputation.
- **`getPricing()` static accessor added** — exposes the pricing table read-only for tests + spend-cap pre-checks. Not in the plan but trivial and useful.

**Pricing table noted in code:** verified against Anthropic's 2026-05-05 pricing page. If pricing changes, update `PRICING_USD_PER_MTOK` constant in `AnthropicClient.ts`. Historical `ai_agent_messages.cost_usd` rows aren't recalculated — they store what was charged at request time, which is correct.

**Files changed:**
- `backend/src/domains/AIAgentDomain/types.ts` (NEW, ~80 lines)
- `backend/src/domains/AIAgentDomain/services/AnthropicClient.ts` (NEW, ~190 lines)
- `backend/tests/ai-agent/AnthropicClient.test.ts` (NEW, ~250 lines, 15 tests)

**Rollback:** delete the new files. No production callers yet (only Tasks 4-5 will use this; not yet built).

### Task 4 — `ContextBuilder` + `PromptTemplates` ✅ DONE (2026-05-06)

**Status:** Shipped on branch `deo/phase-3-task-4` (stacked on `deo/phase-3-task-3`). Pending PR + merge to main.

**Acceptance verified:**
- ✅ `ContextBuilder.build` returns a complete `AgentContext` (5 fields: service, customer, shop, conversationHistory, siblingServices) for a known service+customer
- ✅ All three template functions produce valid, non-empty prompts (>500 chars each)
- ✅ Universal rules baked into all three tones (AI disclosure, no-invent-prices, human-handoff trigger)
- ✅ Tone-specific cues in each template (friendly = casual/emojis; professional = formal/factual; urgent = time-pressure with explicit "never fabricate scarcity" guard)
- ✅ 12 unit tests passing for ContextBuilder (mocked repositories — no DB hits)
- ✅ 31 unit tests passing for PromptTemplates
- ✅ TypeScript: 0 errors
- ✅ Repository instances injected via constructor (clean test mocking pattern)

**Deviations from plan:**

- **Constructor-injected repositories.** Plan implied module-level singletons; chose constructor injection so tests pass mocks directly. Default constructor parameters mean callers don't have to wire instances explicitly (`new ContextBuilder()` works fine).
- **`AgentContext` type expanded** to include sub-types (`AgentServiceContext`, `AgentCustomerContext`, `AgentShopContext`, `AgentMessageContext`, `AgentSiblingService`). Cleaner than passing raw repository row shapes through to `PromptTemplates`. Defined in `types.ts` next to the AnthropicClient types from Task 3.
- **`activeOnly` instead of `active`** for the siblings query — matches the actual `getServicesByShop` signature on `ServiceRepository`.
- **Hours summary returns null in MVP** — building a structured-hours summarizer is its own feature; Phase 3 templates handle the absence gracefully ("hours not on file — if asked, say you'll have someone confirm"). Phase 4 can wire in a real summarizer once shop hours storage shape is finalized.
- **`buildSystemPrompt` dispatcher added** — convenience function that routes by tone string and falls back to professional if unknown. Not in the plan but helpful for `AgentOrchestrator` (Task 5).

**Files changed:**
- `backend/src/domains/AIAgentDomain/types.ts` (+~85 lines for AgentContext + sub-types + AITone)
- `backend/src/domains/AIAgentDomain/services/ContextBuilder.ts` (NEW, ~210 lines)
- `backend/src/domains/AIAgentDomain/services/PromptTemplates.ts` (NEW, ~180 lines)
- `backend/tests/ai-agent/ContextBuilder.test.ts` (NEW, ~190 lines, 12 tests)
- `backend/tests/ai-agent/PromptTemplates.test.ts` (NEW, ~250 lines, 31 tests)

**Rollback:** delete the new files. No production callers yet (Task 5 will be the first consumer).



**Goal:** assemble the per-request context, pick the right system prompt, output a structured `(systemPrompt, conversationHistory)` pair ready for Claude.

**Steps:**

**`ContextBuilder.ts`:**
1. `build(params: { customerAddress, serviceId, conversationId, includeUpsells }): Promise<AgentContext>`
2. Pulls in parallel:
   - Service info from `shop_services` (description, price, duration, category, ai_custom_instructions)
   - Customer profile from `customers` (tier, recent_bookings_summary, current_rcn_balance)
   - Last 20 messages from `messages` for the conversation
   - Shop info from `shops` (name, hours, category)
   - If `includeUpsells`: up to 5 sibling services from same shop with `ai_sales_enabled=true`
3. Returns a typed `AgentContext` object

**`PromptTemplates.ts`:**
1. Three template functions: `friendlyPrompt(ctx)`, `professionalPrompt(ctx)`, `urgentPrompt(ctx)` — each returns a structured system prompt string
2. Templates per the strategy doc skeleton (style rules, factual constraints, escalation rules)
3. Hard rule baked into every prompt: *"Always disclose you are an AI assistant on the first reply. Never invent prices, hours, or policies not in the context. If asked something not in your context, say you'll get a human to follow up."*

**Acceptance:**
- `ContextBuilder.build` returns a complete object for a known staging service + customer
- All three template functions produce valid, non-empty system prompts
- Prompt structure matches strategy doc skeleton

**Rollback:** delete files. No production callers yet.

### Task 5 — `AgentOrchestrator` + `AuditLogger` + safety guards ✅ DONE (2026-05-06)

**Status:** Shipped on branch `deo/phase-3-task-5`. Pending PR + merge to main.

**Acceptance verified:**
- ✅ `AgentOrchestrator.handleCustomerMessage(input)` returns a `HandleCustomerMessageResult` discriminated union (5 outcomes: ai_replied / skipped / escalated / failed / [no_shop_settings inside skipped])
- ✅ Skip paths covered: `service_ai_disabled`, `shop_ai_disabled`, `no_shop_settings`, `spend_cap_exceeded`
- ✅ Escalation path covered (writes audit row with `escalated_to_human=true`, no AI reply posted)
- ✅ Happy path posts AI reply via `MessageRepository.createMessage` with `metadata.generated_by='ai_agent'` + tone + cost + latency, then writes audit row, then increments spend
- ✅ Claude call failure logs error to `ai_agent_messages` and returns `failed` outcome (no reply posted)
- ✅ Model selection: Sonnet by default, switches to Haiku when SpendCapEnforcer says spend ≥ 70% of budget
- ✅ Customer message appended only if not already last in conversation history (avoids duplicates from Task 8 hook race conditions)
- ✅ All 4 supporting services have unit tests:
  - **EscalationDetector**: 26 tests (phrase matches, word-boundary keyword matches, "stop" at-start matching, reply-count threshold, false-positive guards, happy-path no-escalation)
  - **SpendCapEnforcer**: 11 tests (canSpend below/at/above threshold, recordSpend, error swallowing)
  - **AgentOrchestrator**: 12 tests (happy path, all skip reasons, escalation, Claude failure, model selection, message handling)
  - 49 new unit tests total, all passing
- ✅ TypeScript: 0 errors

**Deviations from plan:**

- **Discriminated-union result type** instead of `Promise<void>`. Lets Task 8's caller decide what to do based on outcome (post warning to shop, escalate notification, etc.) without re-reading DB state. Cleaner integration surface.
- **No eager singleton export.** The plan had `agentOrchestrator` as a module-level instance, but `new AnthropicClient()` requires `ANTHROPIC_API_KEY` at construction time — this breaks tests and any non-AI code paths importing the file. Task 8's hook will instantiate `new AgentOrchestrator()` when needed.
- **Customer message append guard.** If the last message in conversation history is already from `user`, we don't re-append `customerMessageText` (avoids duplication if the message was committed before the hook fires). Task 8's hook timing determines which case happens; orchestrator handles both cleanly.
- **`canSpend` doubles as month-rollover trigger.** No cron job — the next AI call after a calendar-month boundary triggers the rollover. Trade-off: shops with zero traffic in a new month show stale `current_month_spend_usd` until traffic resumes. Acceptable for MVP; documented in `SpendCapEnforcer` source.
- **Constructor-injected dependencies.** Eight collaborators (pool, 4 repos, 4 services) all constructor-injected with sensible defaults. Tests pass mocks; production passes nothing and gets the defaults. Same pattern as `ContextBuilder` from Task 4.

**Files changed:**
- `backend/src/domains/AIAgentDomain/types.ts` (+~85 lines: HandleCustomerMessage*, AIAgentMessageInsert, SpendCheckResult, EscalationDecision)
- `backend/src/domains/AIAgentDomain/services/AuditLogger.ts` (NEW, ~70 lines)
- `backend/src/domains/AIAgentDomain/services/SpendCapEnforcer.ts` (NEW, ~115 lines)
- `backend/src/domains/AIAgentDomain/services/EscalationDetector.ts` (NEW, ~135 lines)
- `backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts` (NEW, ~280 lines)
- `backend/tests/ai-agent/EscalationDetector.test.ts` (NEW, ~140 lines, 26 tests)
- `backend/tests/ai-agent/SpendCapEnforcer.test.ts` (NEW, ~115 lines, 11 tests)
- `backend/tests/ai-agent/AgentOrchestrator.test.ts` (NEW, ~250 lines, 12 tests)

**Staging integration smoke deferred:** the end-to-end test against real staging hit DB connection-pool exhaustion (DO Postgres ~25 conn cap, local backend dev server holding some, jest tests holding more). Unit tests cover the dispatch logic comprehensively; the real-API integration validation will happen naturally at Task 6 (`/api/ai/preview` endpoint smoke) when there's only one client connecting. If it fails there, we'll catch it.

**Rollback:** delete the new files. No production callers yet (Task 8 wires the orchestrator to MessageService).



**Goal:** the main flow — entry point that takes a customer message, builds context, calls Claude, logs the result.

**Steps:**

**`AgentOrchestrator.ts`:**
1. `handleCustomerMessage(messageId: string): Promise<void>`
2. Pipeline:
   - Load message + conversation + service + customer
   - Check `ai_sales_enabled` on the service
   - Check `ai_shop_settings.ai_global_enabled` for the shop
   - Check `SpendCapEnforcer.canSpend(shopId)` — if over cap, skip and notify shop owner via existing notification system
   - Run `EscalationDetector.shouldEscalate(message, history)` — if true, skip AI and route to human
   - `ContextBuilder.build(...)` → `PromptTemplates[tone](ctx)` → `AnthropicClient.complete(...)`
   - On success: insert reply into `messages` with `metadata: { generated_by: 'ai_agent', model, tone }`, call `AuditLogger.log(...)`, increment `ai_shop_settings.current_month_spend_usd`
   - On failure: log to `ai_agent_messages` with `error_message`, do NOT post a reply, optionally notify shop owner

**`AuditLogger.ts`:**
1. `log(entry: AIAgentMessageInsert): Promise<void>` — single insert into `ai_agent_messages`
2. Cheap, fire-and-forget on success; awaited on error so the failure is recorded

**`SpendCapEnforcer.ts`:**
1. `canSpend(shopId): Promise<{ allowed: boolean; useCheaperModel: boolean }>`
2. Read `ai_shop_settings`, compare `current_month_spend_usd` to `monthly_budget_usd`
3. Auto-rollover: if `current_month_started_at` is in a previous calendar month, reset `current_month_spend_usd=0` and update timestamp before checking
4. Return `useCheaperModel: true` when spend ≥ 70% of budget (model auto-throttles to Haiku to extend the budget runway)

**`EscalationDetector.ts`:**
1. `shouldEscalate(message: string, history: ChatMessage[]): boolean`
2. Simple heuristics for MVP:
   - Customer typed "human", "agent", "real person", "stop" → true
   - Last 5 customer messages all flagged as confused (TODO heuristic) → true
   - Customer has been chatting more than `ai_shop_settings.escalation_threshold` AI replies → true
3. Phase 4 will replace this with a Claude-driven classifier

**Acceptance:**
- A test script invokes `handleCustomerMessage(testMessageId)` and produces a valid AI reply on staging
- Reply lands in `messages` table with correct metadata
- Audit row lands in `ai_agent_messages` with non-null cost
- Spend cap blocks correctly when `current_month_spend_usd ≥ monthly_budget_usd`
- Escalation triggers correctly on "I need a human"

**Rollback:** delete files. The hook in MessageService (Task 7) hasn't shipped yet, so no live traffic flows here.

### Task 6 — `POST /api/ai/preview` endpoint (shop dashboard live preview) (~0.5 day) — **DONE 2026-05-06**

**Goal:** replace the hardcoded `aiPreviewMocks.ts` strings with real Claude calls. This is the cheapest user-visible win — shop owners can see what the AI will actually say for their service before turning it on.

**Steps:**
1. Create `PreviewController.ts` with handler for `POST /api/ai/preview`
2. Request body: `{ serviceId, sampleQuestion?, tone? }`
3. Default `sampleQuestion` to `"Hi! How much does this cost and when can I book?"`
4. Use `tone` from body if provided, else read from `shop_services.ai_tone`
5. Build minimal context (no customer profile — synthesize a "sample customer" with tier=BRONZE, no history)
6. Call `AnthropicClient.complete(...)` with **Haiku 4.5** (speed + low cost for previews)
7. Return `{ reply: string, model, latencyMs, costUsd }`
8. Cache previews per `(serviceId, tone)` for 1 hour (Redis or in-memory) — prevents shop owners from burning budget hitting refresh
9. Auth: shop must own the service, OR be admin
10. Mount route in `routes.ts`

**Acceptance:**
- Endpoint returns a real Claude reply for any staging service
- Cached responses on second call within 1 hour
- Auth blocks shop A from previewing shop B's services

**Rollback:** unmount the route. Frontend still has the mock-based fallback (Task 7 hasn't swapped yet).

**Implementation log (2026-05-06, branch `deo/phase-3-task-6`):**
- `backend/src/domains/AIAgentDomain/controllers/PreviewController.ts` — `makePreviewAIReply(deps)` factory returning an Express handler. Tests inject mocked `serviceRepo` + `anthropicClient`; production path uses fresh defaults via the named `previewAIReply` wrapper.
- `backend/src/domains/AIAgentDomain/routes.ts` — mounted `POST /api/ai/preview` behind `authMiddleware + requireRole(['shop', 'admin'])`. Per-service ownership check happens inside the controller.
- Always uses Haiku 4.5 (`claude-haiku-4-5-20251001`), `maxTokens=250`, system prompt cached via prompt-cache control.
- 1-hour in-memory `Map<string, CacheEntry>` keyed by `${serviceId}:${tone}`. Custom `sampleQuestion` bypasses cache to bound key explosion — only the default question hits cache.
- Synthetic `AgentContext`: customer is `{ address: "0xPREVIEW", name: "Sample Customer", tier: "BRONZE", rcnBalance: 0 }`, no conversation history, no sibling services. No real customer data leaks into preview UI.
- Tone resolution priority: `body.tone` (if valid) → `service.aiTone` → `'professional'`. Invalid tones fall through to the next level.
- Shop name + category fetched via direct `pool.query` against `shops` table (one-off lookup, doesn't justify a repository method).
- Errors: 429 from Anthropic surfaces as 429 to client with rate-limit message; everything else → 500 with generic error.
- Test file `backend/tests/ai-agent/PreviewController.test.ts` — 19 tests covering validation, auth, cache hit/miss, tone resolution, model+token options, error handling. All passing.
- `_clearPreviewCacheForTests()` exposed as a test-only escape hatch.

**Deviation from plan:**
- Step 6 says Haiku 4.5; plan was internally consistent. Implemented as written.
- Used factory pattern (`makePreviewAIReply(deps)`) instead of bare async handler so unit tests can inject mocks without monkey-patching modules. Production gets a singleton-lazy `previewAIReply` wrapper exported by name.

**Real-API smoke (2026-05-06) — all 3 acceptance criteria passed:**
- ✅ Happy path: HTTP 200, 2062ms Claude latency, $0.0009 cost, Haiku 4.5, cached:false. Reply correctly disclosed as AI, included service name + $99 price, admitted unknown hours instead of fabricating.
- ✅ Cache hit on second call: HTTP 200, cached:true, 1185ms (no Anthropic call).
- ✅ 403 ownership rejection: peanut shop correctly blocked from previewing zwift-tech's service.

**Staging deploy unblocking (2026-05-06):** Tasks 5 and 6 deploys both initially auto-rolled-back with PG error 53300 ("remaining connection slots are reserved for SUPERUSER"). Root cause: DO managed Postgres dev tier was at 22-connection limit (the config default) and accumulated orphan connections from prior failed deploys, leaving 0 slots free for new container startup validation. Resolution: bumped `max_connections` from 22 → 50 via DO Postgres Advanced configurations, which forced a managed restart, killed all orphans, and gave permanent headroom. After restart, Task 6 deploy succeeded on retry. Going forward, any deploy that fails with 53300 should be diagnosed with `backend/scripts/check-pg-connections.ts`. Long-term: consider upgrading staging DB off the dev tier when Phase 3 traffic ramps up.

### Task 7 — Frontend: swap `aiPreviewMocks.ts` to live API (~0.5 day) — **DONE 2026-05-06**

**Goal:** The "See How the AI Replies" preview in `AISalesAssistantSection.tsx` calls the new endpoint instead of reading from the static array.

**Steps:**
1. In `frontend/src/services/api/services.ts`, add `getAiPreview(serviceId, tone): Promise<AIPreviewResponse>`
2. In `AISalesAssistantSection.tsx`, replace the `AI_PREVIEW_MOCKS[tone]` lookup with a `useQuery` (TanStack) call to `getAiPreview`
3. Loading state: skeleton in the preview area
4. Error state: fallback to the existing mock (graceful degradation if backend is down)
5. Cache key: `[serviceId, tone]` — react-query handles client-side caching (1 hour stale time)
6. Update the disclosure note from "AI replies activate in a future update" to "Live preview — actual reply when AI is enabled"

**Acceptance:**
- Toggling tone segmented control fires a fresh API call (or hits cache)
- Loading state visible during the call
- Real Claude replies appear in the preview area
- Disabling AI section still works (preview hidden)

**Rollback:** `git revert` — frontend goes back to mock-based preview, backend endpoint can stay live.

**Implementation log (2026-05-06, branch `deo/phase-3-task-7`):**
- `frontend/src/services/api/services.ts` — added `getAiPreview(serviceId, tone, sampleQuestion?)` returning `AIPreviewResponse` + the type itself. Follows the same axios + envelope-unwrap pattern as the rest of the file (auth flows via httpOnly cookie + `withCredentials: true`).
- `frontend/src/components/shop/service/AISalesAssistantSection.tsx`:
  - Added optional `serviceId?: string` prop
  - Added `useEffect` that fetches when `(previewOpen && enabled && serviceId)` change. Skips fetch when section is closed, AI is off, or no serviceId
  - Component-local `Map<string, AIPreviewResponse>` cache keyed by `${serviceId}:${tone}` so toggling tones doesn't refetch what we already have
  - Three render states: `loading` (skeleton bubble) → `live reply` (green-tinted bubble + sample question label + model/latency footer) → `fallback` (renders the original 4-message mock arc, used when no serviceId yet OR API failed)
  - Updated bottom disclosure: "Live preview — this is the actual reply Claude generates for your service" (when serviceId present) vs "Save the service first to see a live AI reply preview" (new-service flow)
- `frontend/src/app/(authenticated)/shop/services/[serviceId]/edit/page.tsx` — passes `serviceId={serviceId}` to AISalesAssistantSection. The new-service page intentionally omits the prop (service not created yet) and the component falls back to mocks.

**Deviations from plan:**
- Plan step 2 says use TanStack Query (`useQuery`). The repo doesn't have react-query installed — only axios + Zustand. Implemented with a `useEffect` + a local `Map` ref instead. Same effect (cache + dedupe + cancellation), no new dependency.
- Plan implies the live API returns the same 4-message arc shape as `AI_PREVIEW_MOCKS`. It actually returns one reply (Claude's response to a single sample question). Component shows the sample question + the AI's single reply, which more honestly reflects what the AI does in production. The 4-message mock arc is preserved as the fallback (no serviceId / API error).
- No real-browser smoke test in this PR — needs the user to test on staging once frontend is deployed (CORS + cookie-domain rules prevent local frontend from authenticating against staging API).

### Task 8 — Hook into `MessageService.sendMessage` (customer-facing AI replies) (~1 day) — **DONE 2026-05-06**

**Goal:** the actual AI behavior — when a customer sends a message in a conversation tied to a service with `ai_sales_enabled=true`, the AI auto-replies.

**Steps:**
1. Identify the right hook in `MessageService.sendMessage` (probably after the customer message is persisted)
2. Conditionally fire `AgentOrchestrator.handleCustomerMessage(messageId)`:
   - Only if `sender_type='customer'`
   - Only if conversation has a `service_id` AND `shop_services.ai_sales_enabled=true`
   - Skip on encrypted messages (per migration 097 — encrypted threads are explicitly customer-to-human)
3. Run async (don't block the customer's message-send response)
4. AI reply persists as a regular message; customer sees it via existing real-time channel

**Acceptance:**
- Customer sends a message on a service with `ai_sales_enabled=true` → AI reply appears within 5-10s
- Customer sends a message on a service with `ai_sales_enabled=false` → no AI reply
- Encrypted threads skip AI entirely

**Rollback:** comment out the hook call. Existing message flow works unchanged.

**Implementation log (2026-05-06, branch `deo/phase-3-task-8`):**

- **Schema change** (Option A — chosen by user over per-message metadata, heuristic, or per-shop fallback):
  - Migration `111_add_service_id_to_conversations.sql` — `ALTER TABLE conversations ADD COLUMN service_id VARCHAR(255)` + partial index `idx_conversations_service_id WHERE service_id IS NOT NULL`. NULL on legacy conversations. Soft reference (no FK) to mirror migration 110's stance on `shop_services.service_id` schema drift.
- **Repository**:
  - `MessageRepository.Conversation` type gains optional `serviceId`.
  - `getOrCreateConversation(customerAddress, shopId, serviceId?)` — on creation, persists service_id. On existing conversation, updates service_id only when caller provides a different value (customer's most recent service intent wins; plain replies preserve prior context).
- **MessageService**:
  - `SendMessageRequest.serviceId?` threaded to repo on `getOrCreateConversation`.
  - `fireAiAutoReply()` private method: fires after the customer-message-to-shop WS broadcast, in `setImmediate(async ...)` so the HTTP response doesn't wait. Calls `AgentOrchestrator.handleCustomerMessage(...)`. On `outcome === 'ai_replied'`, broadcasts `message:new` WS event to the customer so the AI reply lands in real-time through the existing WS channel (no frontend changes needed for delivery).
  - **Lazy module-level orchestrator** with try/catch on first construction. If `ANTHROPIC_API_KEY` is missing (dev/test env), logs a warning once and disables AI auto-replies for the rest of the process — never throws into the customer's message-send path. `_resetOrchestratorForTests` exposed for unit tests.
  - Hook gating: customer-only senders, non-encrypted messages, `conversation.serviceId` must be present, `created` flag must be true (skip on idempotent retries).
- **MessageController**: extracts `serviceId` from request body and forwards to MessageService.
- **Frontend** (minimal):
  - `services/api/messaging.ts` — `SendMessageRequest.serviceId?` added.
  - `ServiceDetailsModal.tsx` — passes `serviceId: service.serviceId` as a top-level field when customer initiates a conversation from a service detail page. Other call sites (ShopProfileClient, BookingDetailsPanel, messageOutbox retry queue) intentionally don't pass it — those are not service-context messages.

**Tests**:
- `backend/tests/ai-agent/MessageServiceAIHook.test.ts` — 11 unit tests covering: hook fires on customer messages with serviceId; skips for shop senders; skips for encrypted; skips when no serviceId; skips on duplicate retry; doesn't block sendMessage when orchestrator is slow; doesn't throw when orchestrator rejects; broadcasts WS only on `ai_replied` outcome (not skipped/escalated/failed).
- Full ai-agent suite: 137 tests across 8 files, all passing. No regressions on existing messaging tests.

**Deviations from plan:**
- Plan implied conversations already had `service_id`. They didn't — schema only had `(customer_address, shop_id)` from migration 079. User chose Option A: add a nullable column and bind on first service-context message. That added a migration + small frontend change to the originally-scoped backend-only Task 8.
- The existing `getOrCreateConversation` enforces one conversation per (customer, shop) pair. Bound `service_id` updates to most-recent on subsequent service-context messages — keeps the AI context fresh without proliferating threads.
- AgentOrchestrator already persists the AI reply via its own `messageRepo.createMessage` step. Hook's responsibility is just the WS broadcast on success — kept the orchestrator decoupled from the messaging WS layer.

**Smoke test pending**: needs staging deploy (migration 111 must run) + a peanut-shop service with `ai_sales_enabled=true` and `ai_shop_settings.ai_global_enabled=true`. Today both flags are off by design (opt-in safety) — flipping them on is a separate operator step before testing.

---

#### Task 8 fix (2026-05-06, branch `deo/phase-3-task-8-fix`)

First smoke attempt failed with no AI reply. Diagnosis via `backend/scripts/diagnose-task8-failure.ts`:

1. **Conversation pre-dated Task 8** — `conv_1773038873896_65vkbcp5f` was created 2026-03-08, before Task 8 shipped. service_id was NULL.
2. **Frontend deploy lag** — the customer's first message (a `service_link` from `ServiceDetailsModal.tsx`) had `serviceId` only inside `metadata`, not at the top-level body field that the new `MessageController` reads. Vercel hadn't yet redeployed the frontend with the Task 8 commit that added top-level `serviceId`.
3. **Kill switches still off** — `ai_shop_settings.ai_global_enabled = false` and `shop_services.ai_sales_enabled = false` for the test service, by design.

Even after frontend deploys, only NEW conversations would get bound — and any pre-existing conversation would silently fail to trigger AI on follow-up messages until a service-link send re-triggered the bind. Fix makes the hook deploy-order-independent:

- **`MessageController.sendMessage`** — reads `serviceId` from `req.body.serviceId` if a non-empty string, otherwise falls back to `req.body.metadata?.serviceId`. The existing `ServiceDetailsModal` already populates `metadata.serviceId` for service-link messages, so the hook works without waiting on frontend deploys (or for retry-queue messages that may have been serialized before the Task 8 frontend change).
- **`AgentOrchestrator.handleCustomerMessage`** — added a service-shop ownership check (step 1.5): if `service.shopId !== input.shopId`, return `outcome: skipped, reason: "service_shop_mismatch"`. Defends against a spoofed `metadata.serviceId` pointing at a different shop's service (which would otherwise cause the AI to generate a reply with the wrong service's context, billed to the conversation's shop). New `SkipReason` variant in types.
- **Test added**: `AgentOrchestrator.test.ts` — "skips with service_shop_mismatch when service belongs to a different shop". Full ai-agent suite: 138 tests across 8 files, all passing.

After this fix deploys, the kill-switch UPDATEs (`ai_global_enabled=true` for peanut, `ai_sales_enabled=true` for "Newly Baker") plus a fresh customer message via `ServiceDetailsModal` should trigger an AI reply. The pre-existing test conversation will get its `service_id` bound automatically on the next service-link send — no manual SQL backfill needed.

---

#### Task 8 second fix (2026-05-06, branch `deo/phase-3-task-8-fix-2`)

After fix #1 deployed and kill-switches were flipped, the AI hook fired end-to-end but Anthropic returned `400 invalid_request_error: "messages.2: user messages must have non-empty content"`. The audit log captured the error and `current_month_spend_usd` stayed at $0 because no tokens were billed.

**Root cause:** `ContextBuilder.toMessageContext` was reading `row.content` to populate the AgentMessageContext body, but the `Message` type from `MessageRepository` exposes the body as `messageText` (camelCase) — not `content`. So every conversation history message got mapped to `content: ""`. Anthropic rejects user messages with empty content, so a single empty user turn in history bricked the entire conversation. This bug had been latent since Task 4 — the live preview endpoint never hit it because the preview always builds with empty conversationHistory.

**Fix:**
- `ContextBuilder.toMessageContext` — read `row.messageText ?? row.message_text ?? row.content ?? ""`. Canonical Message shape first; raw pg row shape second; legacy `content` field third.
- `AgentOrchestrator.handleCustomerMessage` — defensive filter on the messages array sent to Claude. Skip turns whose content is empty after trimming. Handles attachment-only messages, system messages, encrypted ciphertext, and the original ContextBuilder bug all in one place. If anything else ever produces an empty turn, Claude won't get bricked.

**Tests:**
- `ContextBuilder.test.ts` — "reads messageText (canonical Message shape) when content field absent" + "reads message_text (raw pg row shape) as a second fallback". Regression guards for the bug.
- `AgentOrchestrator.test.ts` — "filters empty-content history turns before sending to Claude". Verifies the orchestrator's belt-and-suspenders filter.
- Full ai-agent suite: 141 tests across 8 files, all passing (was 138 — +3).

### Task 9 — Customer-facing AI message UI: disclosure badge + service AI label (~1 day) — **DONE 2026-05-07**

**Goal:** customers see which messages are AI-generated and which services use AI.

**Steps:**

**Frontend changes:**
1. Customer chat thread component — render a small "🤖 AI assistant" badge above messages where `metadata.generated_by === 'ai_agent'`
2. Customer-facing service detail page — small "AI-assisted" badge near the service title if `ai_sales_enabled=true` (plus a tooltip explaining what that means)
3. Service marketplace card — similar badge (consistent visual)

**Acceptance:**
- AI messages visually distinct from human shop messages
- Service cards show the AI badge correctly
- Disclosure tooltip readable on mobile + desktop

**Rollback:** revert the UI changes. Backend AI replies still work, just not visually flagged. Acceptable degradation.

**Implementation log (2026-05-07, branch `deo/phase-3-task-9`):**

Two new shared components plus three edit sites:

- **`frontend/src/components/shared/AIAssistantBadge.tsx`** — pill-shaped "AI" / "AI-assisted" badge with violet/lavender theme to differentiate from the yellow shop theme. Two variants: `compact` (10px text, fits inline on a marketplace card) and `default` (12px text, longer label, fits next to a service title in the detail modal). Tooltip via native `title` attribute (works on mobile via long-press, no Radix/shadcn dependency required since the project doesn't ship one).
- **`frontend/src/components/messaging/AIMessageLabel.tsx`** — small "🤖 AI assistant" label rendered directly above an AI-generated message bubble. Same violet theme, more muted so it reads as informational. Tooltip explains the shop owner can still see and reply to the conversation.

Three edit sites:
- **`ConversationThread.tsx`** — renders `<AIMessageLabel />` above the bubble when `!isOwnMessage && message.metadata?.generated_by === 'ai_agent'`. Bubble border tint also flips to violet when AI-generated, so the visual distinction works even at-a-glance without reading the label.
- **`ServiceDetailsModal.tsx`** — renders `<AIAssistantBadge variant="default" />` next to the service title when `service.aiSalesEnabled`. Wrapped the title + badge in a flex row so the badge wraps gracefully on narrow viewports.
- **`ServiceCard.tsx`** — renders `<AIAssistantBadge variant="compact" />` inline with the existing category badge on each marketplace card. Same `aiSalesEnabled` gate.

**Data flow note:** `metadata.generated_by === 'ai_agent'` is set by `AgentOrchestrator` on every AI reply (since Task 5). The frontend message transform at `useConversationMessages.ts:27` preserves `metadata` end-to-end, so no backend changes were needed for Task 9. Similarly, `ShopServiceWithShopInfo.aiSalesEnabled` was already in the API surface from Phase 2 (migration 108).

**Tests:** ESLint clean on both new files; pre-existing typecheck/lint warnings in `ServiceCard`, `ServiceDetailsModal`, `ConversationThread` (e.g. `<img>` instead of `<Image>`, unused vars in pre-existing code) are unrelated to Task 9 changes.

**Smoke test pending:** needs Vercel frontend redeploy. Once live, verify:
- Customer's existing AI-replied messages on conv_1773038873896 show the violet "AI assistant" label + violet bubble border
- "Newly Baker" detail modal shows the "AI-assisted" badge next to the service title (since `ai_sales_enabled = true`)
- Other peanut services (with `ai_sales_enabled = false`) do NOT show the badge — confirms the gate works
- Tooltip text shows on hover (desktop) and long-press (mobile)

### Task 10 — Booking suggestion buttons (Flavor B inline cards) (~1.5 days) — **DONE 2026-05-07**

**Goal:** when AI mentions a slot or pricing, surface an inline "Book this" card. Customer taps → existing booking UI opens pre-filled. AI does NOT call any tool — it includes structured suggestion data in the response that the frontend renders.

**Steps:**

**Backend:**
1. Update `PromptTemplates` to instruct Claude to ALWAYS use a JSON-structured suggestion when discussing booking:
   ```
   When suggesting a booking, end your reply with a fenced JSON block:
   ```booking_suggestion
   { "slot_iso": "2026-05-08T14:30:00+08:00", "service_id": "srv_...", "deposit_usd": 0 }
   ```
   ```
2. Parse the response in `AgentOrchestrator` — extract any `booking_suggestion` blocks
3. Strip the JSON block from the reply text the customer sees
4. Persist the suggestion in `messages.metadata.booking_suggestions: [...]`

**Frontend:**
1. In the customer chat thread, when a message has `metadata.booking_suggestions`, render below the message text: a card with the slot, service name, deposit, and a "Tap to book" button
2. Tap → navigate to the existing booking flow with `?service=X&slot=Y&deposit=Z` query params (existing booking UI accepts pre-fill — verify, may need a small change)

**Acceptance:**
- AI message containing a booking suggestion renders the card correctly
- Tapping the card navigates to the booking flow with fields pre-filled
- Customer can complete booking via existing flow

**Rollback:** the JSON-block parser tolerates AI replies without suggestions (already does). Reverting the prompt template change just stops AI from including booking suggestions; replies still flow.

**Implementation log (2026-05-07, branch `deo/phase-3-task-10`):**

User picked **Option B** (real availability injected into the prompt) over the lighter "service-only card" alternative — better UX, more work. Roughly 1 day actual delivery.

**Backend (5 files):**
- **`AvailabilityFetcher.ts`** (new) — wraps `AppointmentService.getAvailableTimeSlots` (existing, used by the customer booking page). Fetches up to 8 bookable slots across the next 3 days in parallel, formats with timezone-aware ISO + human-readable label. Errors swallowed → returns `[]` so a transient DB hiccup never breaks the AI reply.
- **`ContextBuilder`** — gates the availability fetch on `service.aiBookingAssistance === true`. New required `availabilitySlots` field on `AgentContext`. Saves the per-day DB roundtrips on services that won't surface a card anyway.
- **`PromptTemplates.buildBookingBlock`** — emits the slot list + the `booking_suggestion` JSON-block instruction when slots exist. Anti-hallucination guardrail: AI must copy `slot_iso` verbatim from the listed set; never invent slots. Gracefully omits the entire block when no slots are bookable in the lookahead window.
- **`BookingSuggestionParser.ts`** (new) — extracts every fenced `\`\`\`booking_suggestion ... \`\`\`` block from a Claude reply. Validates: JSON parse + `service_id` matches expected + `slot_iso` is in the validated set + optional `deposit_usd` is a non-negative number. Strips ALL matched blocks (valid + invalid) so customers never see raw JSON. Logs warnings on validation failures.
- **`AgentOrchestrator`** — runs the parser between Claude's reply and the message-row insert. The customer-facing `messageText` is the cleaned text; valid suggestions land on `messages.metadata.booking_suggestions[]`. Defensive `?? []` on `availabilitySlots` so older callers (or pre-Task-10 mocks) don't trip a runtime error. New `SkipReason` left untouched (existing `service_shop_mismatch` from fix-1 already covers the spoof case).

**Frontend (4 files):**
- **`BookingSuggestionCard.tsx`** (new) — violet-themed tappable card (matches Task 9's AI badge palette). Calendar icon + "Tap to book" label + slot human label + service name + price/deposit footer. Tapping navigates to `/service/{serviceId}?suggestedSlotIso=ISO`.
- **`ConversationThread.tsx`** — renders one `BookingSuggestionCard` per item in `message.metadata.booking_suggestions[]`, beneath the AI bubble.
- **`ServiceCheckoutClient.tsx`** — reads `?suggestedSlotIso=` query param, parses it into a Date + `HH:MM` string, auto-opens `ServiceCheckoutModal` with both pre-filled when an authenticated customer arrives at the route. Skips auto-open for non-customers.
- **`ServiceCheckoutModal.tsx`** — accepts new optional props `initialBookingDate` + `initialBookingTimeSlot`. The existing date/time picker validates against real availability — if the pre-filled slot has just become unavailable, the customer just picks another with no harm done.

**Tests (4 new in 2 files):**
- `BookingSuggestionParser.test.ts` — 13 tests: happy path (extract + strip + label), malformed JSON dropped, wrong service_id dropped, hallucinated slot_iso dropped, invalid deposit dropped, multiple blocks (valid + invalid mix), missing slotLabelsByIso fallback.
- `PromptTemplates.test.ts` — 4 new tests: no booking block when no availability, slot list rendered verbatim, fenced block + anti-hallucination text present, applies to all 3 tones consistently.
- Full ai-agent suite: **158 tests across 9 files, all passing** (was 141, +17 for Task 10).

**Smoke test pending Vercel deploy + a peanut-shop service with `aiBookingAssistance=true` set:**
1. Operator: enable `shop_services.ai_booking_assistance = true` for "Newly Baker" (currently false even though `ai_sales_enabled = true`)
2. Customer messages "Newly Baker" → AI reply mentions a real slot ("How does Thursday at 2:30 PM sound?") + a violet "Tap to book" card appears beneath
3. Tap card → `/service/srv_b294a818.../?suggestedSlotIso=...` → checkout modal auto-opens with date + time pre-filled
4. Verify: AI does NOT suggest fabricated slots if shop has no openings (block omitted, reply still flows naturally)

---

#### Task 10 fix (2026-05-07, branch `deo/phase-3-task-10-fix`)

First Task 10 smoke landed AI replies but **no booking-card rendered**. Diagnosis via `backend/scripts/diagnose-task10-failure.ts`:

- ✅ Hook fired correctly (audit row, healthy token counts, no errors)
- ✅ Slot list reaching the prompt (input tokens jumped from ~1000 → ~1900, +887 for the booking block)
- ❌ `messages.metadata.booking_suggestions` empty on every AI reply
- ❌ AI reply text said "We currently have availability on Thursday, May 7 across multiple time slots. Would you like to book one?" — generic, no specific slot picked, no JSON block emitted

**Root cause:** the original prompt was too conservative: *"ONLY emit the block when you are recommending a specific slot. If you're still answering questions or the customer hasn't expressed booking intent, DO NOT include a block."* Claude was interpreting "Can I book Thursday afternoon? what time is available?" as a **question**, not booking intent — so it listed slots and waited for the customer to choose.

**Fix:**
- **`PromptTemplates.buildBookingBlock`** — rewrote the WHEN-to-emit guidance to push **proactive** behavior. Customer asks "what's available?" / "when can I come in?" / mentions a day → AI proposes ONE specific slot from the list and emits the block. Don't list every slot and ask the customer to pick — pick the top recommendation and offer it. Pricing/general questions still skip the block.
- **`BookingSuggestionParser`** — added a `droppedReasons: DropReason[]` field to the parser result + a `DropReason` discriminated union (`malformed_json | missing_service_id | wrong_service_id | missing_slot_iso | hallucinated_slot_iso | invalid_deposit`). Surfaces *why* a block was rejected so we can debug from DB.
- **`AgentOrchestrator`** — persists the dropped reasons on `messages.metadata.booking_suggestion_dropped[]` when non-empty. Diagnostic visibility without log access — easy to tell "AI tried but parser rejected" vs "AI never tried" by looking at the message row.

**Tests:**
- `BookingSuggestionParser.test.ts` — 6 new tests for each `DropReason` variant + happy-path `droppedReasons` empty.
- `PromptTemplates.test.ts` — 1 new test verifying the prompt now contains "proactive" / "propose ONE specific slot" guidance + "what's available" example trigger.
- Full suite now: **164 ai-agent tests across 9 files**.

### Task 11 — Order completion event hook (AI confirmation reply) (~0.5 day)

**Goal:** when a booking completes (existing `service.order_completed` event), if the customer originally chatted with the AI for that service, the AI sends a confirmation message in the same thread.

**Steps:**
1. Subscribe `AgentOrchestrator` to `service.order_completed` event (existing event from Phase 2 service marketplace work)
2. Look up the conversation for that customer + service
3. If conversation exists AND has prior AI messages → send a short confirmation message ("Thanks for booking! See you Thursday at 2:30 PM. Let us know if anything changes.")
4. Use `AnthropicClient.complete(...)` with Haiku for cost
5. Persist + audit log as usual

**Acceptance:**
- Booking completed via marketplace → AI confirmation message lands in the chat
- Skipped if customer never chatted with AI for that service (no conversation, or no AI messages in history)

**Rollback:** unsubscribe. Existing booking flow unchanged.

### Task 12 — Spend cap monitoring + admin visibility (~0.5 day)

**Goal:** shop owners can see their AI spend; admins can see platform-wide cost.

**Steps:**

**Shop side:**
1. Add `GET /api/ai/spend` endpoint — returns `{ currentMonthSpendUsd, monthlyBudgetUsd, percentUsed, monthStartedAt }` for the requesting shop
2. Frontend: small spend indicator on the shop dashboard's AI Sales Assistant tab/section

**Admin side:**
1. Add `GET /api/admin/ai/cost-summary` — aggregate spend across all shops, top spenders, error rate
2. Frontend: admin panel section (Phase 4 build-out, MVP just exposes the endpoint)

**Acceptance:**
- Shop sees their own spend
- Admin sees aggregate
- Auth enforced (shop only sees own; admin sees all)

**Rollback:** unmount endpoints. Spend tracking continues internally; just no dashboard.

### Task 13 — Production rollout + verification (~0.5 day)

**Goal:** ship to prod with explicit rollout controls.

**Steps:**
1. Verify Phase 2 prod deploy is complete (migration 108 + Phase 2 backend/frontend code) — must precede this
2. Apply migration 109 to prod
3. Set `ANTHROPIC_API_KEY` (Production workspace key) in DO prod env vars
4. Set `ai_global_enabled=false` for ALL shops by default in prod (cautious rollout):
   ```sql
   UPDATE ai_shop_settings SET ai_global_enabled = false;
   ```
5. Deploy backend + frontend
6. Pick **3-5 pilot shops** willing to test live AI; toggle `ai_global_enabled=true` for them only via admin endpoint or direct SQL
7. Monitor for 24-48 hours: error rate, cost per shop, customer feedback
8. Gradually expand rollout based on signals

**Acceptance:**
- Pilot shops have working AI
- All other shops have AI silently disabled (regardless of per-service `ai_sales_enabled` setting)
- No 500s in logs from AI calls
- Spend tracking matches actual Anthropic Console usage

**Rollback:** kill switch — `UPDATE ai_shop_settings SET ai_global_enabled = false;`. Stops all AI globally without code changes. Investigate, fix, re-enable selectively.

---

## Total effort

| Task | Effort |
|---|---|
| 1. Foundation: SDK + skeleton | ~4 hr |
| 2. Migration 109 | ~1 hr |
| 3. AnthropicClient | ~1 day |
| 4. ContextBuilder + PromptTemplates | ~1.5 days |
| 5. AgentOrchestrator + AuditLogger + SpendCap + Escalation | ~1 day |
| 6. POST /api/ai/preview endpoint | ~0.5 day |
| 7. Frontend: swap aiPreviewMocks → live API | ~0.5 day |
| 8. Hook into MessageService.sendMessage | ~1 day |
| 9. Customer-facing AI UI badges | ~1 day |
| 10. Booking suggestion buttons | ~1.5 days |
| 11. Order completion confirmation hook | ~0.5 day |
| 12. Spend monitoring | ~0.5 day |
| 13. Prod rollout | ~0.5 day |
| **Total** | **~12-13 working days (~3 weeks)** |
| Soak before broad rollout | 1 week (overlapping) |

---

## Suggested execution order

**Week 1 — Foundation:**
- Day 1-2: Tasks 1, 2, 3 (deps + skeleton + migration + AnthropicClient)
- Day 3-4: Task 4 (ContextBuilder + PromptTemplates)
- Day 5: Task 5 (AgentOrchestrator + safety guards)

**Week 2 — Live preview + customer-facing:**
- Day 6: Task 6 + 7 (preview endpoint + frontend swap) — first user-visible win, ship to staging
- Day 7-8: Task 8 (MessageService hook) — customer-facing AI replies on staging
- Day 9-10: Task 9 (UI badges)

**Week 3 — Booking + ops:**
- Day 11-12: Task 10 (booking suggestions)
- Day 13: Task 11 + 12 (order completion hook + spend monitoring)
- Day 14: Task 13 (prod rollout — pilot shops only)
- Day 15+: Soak, monitor, expand rollout

---

## Testing strategy

### Unit tests
- `AnthropicClient` retry/backoff, error mapping, cost math (mock the SDK)
- `ContextBuilder` produces complete context for various service types
- `PromptTemplates` produce valid, non-empty prompts for each tone
- `SpendCapEnforcer` correctly auto-rolls month and throttles to Haiku
- `EscalationDetector` heuristics

### Integration tests
- End-to-end: send a customer message via `MessageService` → AI reply appears in `messages` table
- Spend cap: simulate usage to 100% of budget → next call skipped
- Escalation: customer types "human" → no AI reply, shop notified
- Encrypted thread: AI silently skipped

### Manual QA on staging
- Test customer registers, chats with AI on a service → realistic conversation
- Shop owner sees live preview update when changing tone in dashboard
- Booking suggestion card → tap → booking flow pre-filled
- Order completion → AI confirmation appears

### Cost validation
- Run 10 sample conversations on staging
- Compare actual cost (from Anthropic Console) to logged cost in `ai_agent_messages.cost_usd`
- Tolerance: ±5% (rounding + caching variance)

---

## Rollback strategy

### Levels of rollback (least to most invasive)

| Level | Action | When |
|---|---|---|
| 1 — Per-shop kill | `UPDATE ai_shop_settings SET ai_global_enabled = false WHERE shop_id = '...';` | One shop has issues |
| 2 — Platform kill | `UPDATE ai_shop_settings SET ai_global_enabled = false;` | Platform-wide AI issue, fix forward |
| 3 — Disable hook | Comment out `AgentOrchestrator.handleCustomerMessage(...)` call in `MessageService` and redeploy | Domain code itself is broken |
| 4 — Full revert | `git revert` the Phase 3 commits | Catastrophic; very unlikely after Level 1-3 |

The kill switch (Level 2) means we can stop all customer-facing AI behavior with a single SQL statement, no code change needed. Phase 3 is built around this so a bad deploy never blocks customer messaging.

---

## Out of scope (Phase 4+)

- Direct AI tool-call booking (Flavor A — AI auto-creates booking without customer button)
- Full escalation tool with structured reason capture + SLA tracking
- Quality scoring (thumbs up/down per AI message; aggregate per-shop and per-tone)
- A/B testing infrastructure (route 10% of conversations to "AI off" baseline)
- Per-shop fine-tuning / few-shot prompting from `quick_replies` history
- Voice / photo / multimodal input
- pgvector for cross-shop service search
- Streaming responses (token-by-token typing in chat)
- Customer-initiated "switch to human" button in chat (the escalation detector handles automatic detection; manual button is a Phase 4 enhancement)
- Per-service A/B testing of tone variants
- Scheduled message bursts (proactive outreach via existing `auto_messages` infra)

---

## Decisions to lock before starting

- [ ] **Anthropic SDK version** — confirm `@anthropic-ai/sdk` version at install time. Latest stable as of API key procurement.
- [ ] **Default models** — confirm Sonnet 4.6 + Haiku 4.5 as defaults. Strategy doc suggests these; verify they match what's actually exposed in your Anthropic Console workspace.
- [ ] **Default monthly budget per shop** — strategy doc says $20. Confirm or change.
- [ ] **Auto-throttle threshold** — strategy doc says 70% of budget triggers Haiku-only. Confirm.
- [ ] **Pilot shops list** — pick 3-5 shops for initial rollout. Need their consent + monitoring during the soak window.
- [ ] **Disclosure copy** — exact text for "🤖 AI assistant" badge + tooltip. Default: "This message was generated by FixFlow's AI assistant on behalf of [Shop Name]." Adjust to brand voice.
- [ ] **Booking suggestion JSON contract** — confirm the structured format Claude should emit. Sample given in Task 10; review for missing fields (e.g., service variant ID, customer-facing slot label).

---

## Connection to Phase 4

Once Phase 3 ships and stabilizes (~2 weeks of soak), Phase 4 builds on the foundation:

- Direct tool-call booking (Flavor A) — `AnthropicClient` already supports `tools` parameter; just need to define `create_booking` schema + handler
- Quality scoring — adds 2 columns to `ai_agent_messages`, frontend thumbs-up/down on AI messages
- A/B testing — splits conversations into AI-on / AI-off cohorts, tracks conversion lift
- Per-shop fine-tuning via `quick_replies` mining (no actual model fine-tuning; few-shot prompting)
- Admin analytics dashboard — fully built-out version of Task 12's endpoint
- Streaming responses — adds streaming support to `AnthropicClient`, frontend renders token-by-token

None of Phase 4 requires schema changes beyond what Phase 3 ships. The architecture is built to grow.

---

## Cost orientation (from strategy doc + procurement doc)

| Scenario | Estimated cost |
|---|---|
| Single conversation (5 turns, Sonnet, with caching) | ~$0.018 |
| Single conversation (Haiku, with caching) | ~$0.0035 |
| 100-shop pilot, 100 conversations/shop/month, Sonnet-default | ~$180/month |
| Full rollout (1000 shops × 100 convos), Sonnet-default | ~$1,800/month |
| Full rollout, Haiku-only (worst-case throttled) | ~$350/month |

Per-shop default budget of $20/month covers ~1100 Sonnet conversations or ~5700 Haiku conversations. Auto-throttle to Haiku at 70% extends runway materially.

---

## Suggested next action

Start with **Task 1 (Foundation)**. It's the smallest, surface-area-only change — adds the SDK dependency, creates the empty domain shell. Once that's merged + deployed to staging, every subsequent task has a clean substrate to build on.

If you want to do any pre-work in parallel:
- Verify Anthropic Console workspace setup (procurement doc Step 2)
- Push Phase 2 to prod (~10 min, removes a Phase 3 prerequisite)
- Pick the 3-5 pilot shops for rollout (Task 13 prerequisite)
