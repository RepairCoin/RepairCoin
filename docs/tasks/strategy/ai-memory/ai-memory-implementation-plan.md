# AI Memory — Implementation Plan

**Date:** 2026-06-22
**Scope doc:** `ai-memory-scope.md` (read first — D0–D7 + Q1–Q3 locked defaults).
**Blockers:** none. Independent of WS1/WS2 (Business-tier gate is deferred to Phase 6). Build behind
`ENABLE_AI_MEMORY` (default OFF) → zero regression when off.
**Status:** plan — no code written. Standing rule: do not commit unless told.

> Core principle (D0): memory stores the owner's **intent** (preferences / instructions / decisions /
> corrections), NEVER facts the DB already holds. Facts come from the existing DB-grounded tools.

---

## Integration surface (verified in code)

- Tools: `backend/src/domains/AIAgentDomain/services/orchestrator/registry.ts` registers `OrchestratorTool`s
  (`types.ts`: `execute(args, ctx{shopId, pool}) → {data, display?}`), merged with insights/marketing tools.
- Context/prompt: `AgentOrchestrator` → `ContextBuilder.build() → AgentContext` → `buildSystemPrompt(tone, ctx)`
  (cached system prompt). **Memory is READ here (inject into the prompt) and WRITTEN via a tool.**
- Cost: `SpendCapEnforcer` already meters per-shop AI spend ($10/$30/$75 allowance work, T3.x).
- Flag exposure to FE: reuse the `GET /api/config` + `frontend/src/contexts/AppConfigContext.tsx` pattern
  (from the blockchain DB-only work) — add `aiMemoryEnabled`.

---

## Phase 1 — Store + explicit capture + retrieval/injection (~M) — the core

**1.1 Migration** (`backend/migrations/NNN_create_ai_memories.sql` — verify next-free vs `schema_migrations`,
see [[feedback-check-migration-number-before-building]]):
- Table `ai_memories` per scope §4: `id uuid pk`, `shop_id text`, `scope text default 'shop'`,
  `kind text check in (preference|instruction|decision|correction)`, `customer_id text null`, `content text`,
  `tags text[]`, `source text check in (explicit|auto) default 'explicit'`, `pinned bool default false`,
  `source_conversation_id text null`, `confidence numeric null`, `last_referenced_at timestamptz null`,
  `created_at timestamptz default now()`, `deleted_at timestamptz null`.
- Indexes: `(shop_id, deleted_at)` btree + `tags` GIN.
- Apply to staging via `npx ts-node scripts/run-single-migration.ts` (record on deploy).

**1.2 Repository** `backend/src/repositories/AiMemoryRepository.ts` (extends `BaseRepository`):
- `create({shopId, kind, content, tags, source, pinned, sourceConversationId, confidence})`
- `search(shopId, {tags?, limit})` — keyword/tag match + recency order (top-K); bumps `last_referenced_at` on the returned rows
- `listForShop(shopId)` (settings UI), `softDelete(id, shopId)`, `update(id, shopId, {content,tags,pinned})`
- `purgeStale(staleDays)` — soft-delete `source='auto'` AND `pinned=false` AND `last_referenced_at` older than window
- snake_case ↔ camelCase mapRow.

**1.3 Service** `backend/src/domains/AIAgentDomain/services/AiMemoryService.ts`:
- `remember(shopId, {kind, content, tags?, source, conversationId?})` — validates it's intent not a fact (reject
  obvious DB-fact phrasings defensively; primary guard is the tool description + prompt), de-dupes near-identical content.
- `recall(shopId, {hint?, limit=K})` — returns the top-K memories for injection (default K from env).
- `forget(shopId, id)`, `list(shopId)`, `pin/unpin`.
- Flag check: all methods no-op / return empty when `ENABLE_AI_MEMORY` is off.

**1.4 Write path — `remember_this` orchestrator tool**
`backend/src/domains/AIAgentDomain/services/orchestrator/tools/rememberThis.ts` (mirror `proposePurchaseOrder`):
- `inputSchema`: `{ kind: enum, content: string, tags?: string[] }`.
- `description`: spell out "use ONLY for standing preferences/instructions/decisions/corrections the owner states
  ('from now on', 'always', 'never', 'when I say X I mean'). DO NOT store facts answerable from data (revenue,
  stock, bookings) — those come from tools."
- `execute` → `AiMemoryService.remember(ctx.shopId, …, source:'explicit')` → returns a small confirm `display`
  (kind `memory_saved`) so the UI shows "Got it — I'll remember that."
- Register in `registry.ts` (`ORCHESTRATOR_TOOLS`). Add the `memory_saved` display kind to `types.ts`.
- Optional companion `forget_memory` tool (or leave forget to the settings UI in Phase 2).

**1.5 Read path — inject into context**
- In `ContextBuilder.build()`: when the flag is on, call `AiMemoryService.recall(shopId, {hint})` and attach
  `memories` to `AgentContext`. `hint` = the user's latest message (for tag match).
- In `buildSystemPrompt(tone, ctx)`: render a bounded "Owner preferences & standing instructions" block from
  `ctx.memories` (only if non-empty). **Hard token cap** (D4) — top-K (env `AI_MEMORY_TOP_K=6`) + truncate.
- Because the system prompt is cached, ensure the memory block is part of the cached segment only if stable;
  otherwise place it in the non-cached context segment to avoid cache thrash. (Decision at build time.)

**1.6 Cost** — memory injection rides existing `SpendCapEnforcer` accounting (it's just prompt tokens). No new
ledger needed for Phase 1. Keep K small; log injected memory token size for observability.

**1.7 Flag** — backend `ENABLE_AI_MEMORY` (default false) read in `AiMemoryService` + a public surfacing on
`GET /api/config` (`aiMemoryEnabled`).

**1.8 Tests** `backend/tests/services/AiMemory.test.ts`:
- repository search ranking (tag match + recency), `purgeStale` only touches auto+unpinned+stale,
- service no-ops when flag off,
- prompt builder respects the top-K + token cap,
- a "fact-like" input is rejected/flagged by the guard.

**Phase 1 gate:** backend `tsc --noEmit` 0; new tests green; flag OFF = identical behavior to today.

---

## Phase 2 — Shop "Memory" settings UI (~S–M)

- Backend: `GET/POST/PATCH/DELETE /api/ai/memories` (shop-auth) → `AiMemoryService` list/create/update/forget.
- Frontend: a "What the AI remembers" panel (use shadcn components per repo rule) — list memories grouped by
  `kind`, add (pre-seed, Q1 → `pinned=true`), edit, forget. Surface only when `aiMemoryEnabled`.
- FE client in `frontend/src/services/api/` + a settings tab/section in the shop dashboard.
- Gate: backend tsc 0; FE tsc baseline **290** (0 net new).

---

## Phase 3 — Auto-extract (DEPRIORITIZED, ~M) — optional

- End-of-turn/-conversation cheap **Haiku** pass that extracts ONLY intent (never facts), behind sub-flag
  `AI_MEMORY_AUTOEXTRACT` (default OFF). Writes `source='auto'`, `confidence`, `pinned=false`.
- Requires a quality eval (sample real conversations, measure precision) before default-on. May be skipped
  entirely given DB grounding. Cost metered via the shop allowance.

---

## Phase 4 — Customer-level memory (~L, deferred)

- `scope='customer'` + `customer_id`; retrieval keyed by the customer in context. **Privacy review first**
  (data-deletion integration — honor existing customer data-deletion). Not part of the Business-tier promise yet.

## Phase 5 — Shared reads (~S)

- Expose `AiMemoryService.recall()` to voice dispatch, ads `LeadAutoAnswerService`, marketing chat so they
  share the same owner-intent context. Read-only for those surfaces.

## Phase 6 — Business-tier gate (~S, after WS2)

- Wire `ai_memory` into the WS2 entitlement matrix (Business). Until WS2 lands, the env flag is the gate.
- Nightly `purgeStale(AI_MEMORY_STALE_DAYS=180)` folded into an existing scheduler tick (Q2).

---

## Env summary

- `ENABLE_AI_MEMORY` (default false) — master flag.
- `AI_MEMORY_TOP_K` (default 6) — max memories injected per turn.
- `AI_MEMORY_STALE_DAYS` (default 180) — auto+unpinned aging window.
- `AI_MEMORY_AUTOEXTRACT` (default false) — Phase 3 sub-flag.

## Build order / effort

Phase 1 (core, ~M) → Phase 2 (settings UI, ~S–M) = **v1 (~M)**. Phases 3–6 incremental. Recommend shipping
Phases 1+2 behind the flag, dogfood on one staging shop (peanut), then decide on Phase 3.

## Verification (every phase)

- Backend `tsc --noEmit` 0; targeted tests green.
- FE `tsc --noEmit` baseline **290** (0 net new).
- Flag OFF = zero behavior change (no regression to the current unified assistant).
- Live walkthrough: state a standing instruction ("never suggest discounts") → new empty chat → instruction
  honored; confirm a DB-answerable fact is NOT written to memory.
