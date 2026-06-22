# AI Memory — Engineering Scope

**Date:** 2026-06-22
**Owner track:** AI/Ads (unified assistant)
**Pricing tie-in:** "AI Memory & Automation" — Business ($599) tier on `pricing.jpeg`. NOTE that sheet line
bundles **Memory** (this doc) + **Automation/Custom Workflows** (separate — see `pricing-rollout-task-breakdown.md`
T7.2). This scope covers **Memory only** (T7.3 / WS7.3).
**Status:** Scope draft — no code written. Standing rule: do not commit unless told.

---

## 1. Problem

The unified assistant (`AIAgentDomain` → `UnifiedAssistantController` + `services/orchestrator/AgentOrchestrator`)
remembers only **within a single conversation thread**. `ContextBuilder` assembles per-request context and
`ConversationHistoryScrubber` trims the thread history, but nothing persists **across** sessions. Every new
conversation starts cold — the assistant re-asks things it was already told, forgets shop preferences, and can't
reference past decisions or customer history. The sheet sells "AI Memory" as a Business-tier capability; today it
does not exist.

## 2. Goal

A **persistent, cross-conversation memory layer** the unified orchestrator reads into context each turn and
writes back to — so the assistant carries durable knowledge about the shop (and optionally its customers) between
sessions, without blowing the per-shop AI budget.

**Non-goals (explicit):** the "Automation/Custom Workflows" half of the sheet line (T7.2); changing wallet/auth;
replacing the existing per-thread `conversations` history (memory sits *alongside* it, not instead of it).

---

## 3. Design decisions (recommended defaults — confirm/override)

- **D1 — Scope of memory. → Recommended: shop-level in v1; customer-level deferred.**
  Memory is keyed per `shop_id`. The assistant remembers the *business* (preferences, recurring context, prior
  decisions). Per-customer memory (history about an individual end-customer) is higher-volume + privacy-sensitive
  → phase 2. *(Rationale: shop-level is the highest-value, lowest-risk slice and matches the Business-tier buyer.)*

- **D2 — Storage / retrieval. → Recommended: a Postgres table + keyword/recency retrieval for v1; NOT a vector store.**
  A `ai_memories` table with simple tag/keyword + recency ranking covers v1. Add embeddings/semantic recall only
  if v1 retrieval proves too blunt. *(Rationale: avoids standing up a vector DB; reuses the existing pool; easy to
  inspect/debug. Keep the retrieval interface swappable so vectors can drop in later.)*

- **D3 — Capture policy. → Recommended: explicit + lightweight auto-extract, both gated.**
  (a) **Explicit:** a `remember_this` orchestrator tool the model calls when the user says "remember…/from now on…".
  (b) **Auto-extract:** at end of a conversation, a cheap **Haiku** pass extracts ≤N salient durable facts. Auto
  starts **OFF** behind a sub-flag until quality is validated, so we don't pollute memory. *(Rationale: explicit is
  safe + cheap and ships first; auto-extract is the magic but needs a quality gate.)*

- **D4 — Injection / cost bounding. → Recommended: top-K (default 5–8) most-relevant memories, hard token cap.**
  `ContextBuilder` pulls only the top-K relevant memories per turn (by tag match + recency), capped at a fixed
  token budget. Memory injection counts against the shop's AI allowance ($10/$30/$75) → bounding is mandatory.
  *(Ties directly to T3.1/T3.3 cost work. Never inject the full memory set.)*

- **D5 — Surface ownership. → Recommended: shared layer owned by the orchestrator, readable by other AI surfaces.**
  Build it as an `AiMemoryService` (read/write/search) that the unified orchestrator owns but voice dispatch, ads
  `LeadAutoAnswerService`, and marketing chat can also read. *(Rationale: one source of truth; avoid bolting memory
  onto a single controller and re-implementing it per surface.)*

- **D6 — Lifecycle / privacy / control. → Recommended: shop-visible, editable, soft-delete, retention cap.**
  Shop owners can **view / edit / forget** their memories (a Memory settings panel). Soft-delete + a retention
  window (e.g. stale, never-referenced memories age out). Customer-level memory (phase 2) inherits data-deletion
  rules. *(Rationale: "the AI knows things about me" must be inspectable + revocable — trust + compliance.)*

- **D7 — Tier gating. → Recommended: gate to Business via the WS2 entitlement matrix; build now, gate later.**
  Memory is a Business-tier feature, but the *build* is independent of WS1/WS2. Ship it behind a feature flag
  (`ENABLE_AI_MEMORY`, default OFF) now; wire the Business gate when WS2 lands. *(Rationale: no need to block on tiering.)*

---

## 4. Proposed data model (v1)

`ai_memories` (migration NNN — verify next-free against `schema_migrations`; see
[[feedback-check-migration-number-before-building]]):
- `id` (uuid) · `shop_id` (text → shops) · `scope` ('shop' | 'customer'; v1 always 'shop')
- `customer_id` (nullable, phase 2) · `content` (text — the fact) · `tags` (text[] for keyword retrieval)
- `source` ('explicit' | 'auto') · `source_conversation_id` (nullable) · `confidence` (numeric, auto-extract)
- `last_referenced_at` (for recency ranking + aging) · `created_at` · `deleted_at` (soft delete)
- Index on `(shop_id, deleted_at)` + a tag GIN index.

## 5. Implementation phases

- **Phase 0 — Scope sign-off** (this doc; confirm D1–D7).
- **Phase 1 — Store + explicit capture + retrieval/injection** (~M): migration, `AiMemoryService`
  (write/search/forget), `remember_this` orchestrator tool, top-K injection in `ContextBuilder` with token cap,
  flag `ENABLE_AI_MEMORY`. Unit tests on retrieval ranking + token bound.
- **Phase 2 — Shop Memory settings UI** (~S–M): view/edit/forget panel; surfaces what the AI remembers.
- **Phase 3 — Auto-extract** (~M): end-of-conversation Haiku extraction behind a sub-flag + quality eval before default-on.
- **Phase 4 — Customer-level memory** (~L, deferred): per-customer scope + data-deletion integration.
- **Phase 5 — Shared reads** (~S): expose memory reads to voice / ads auto-answer / marketing chat.
- **Phase 6 — Business-tier gate** (~S): wire into the WS2 entitlement matrix (after WS2 lands).

**Total v1 (Phases 1–2): ~M–L.** Full vision (through Phase 4): ~L+.

## 6. Cost & risk notes

- Injection cost is the main ongoing cost — bounded by D4 (top-K + token cap). Auto-extract (Phase 3) adds a
  per-conversation Haiku call — cheap but real; meter it via `ad_ai_costs`-style logging / the shop allowance.
- Quality risk: bad auto-extracted memories degrade every future answer → Phase 3 stays OFF until eval passes.
- Privacy risk: customer-level memory (Phase 2+) must honor data-deletion; that's why shop-level ships first.

## 7. Open questions for product

- Should shop owners be able to **pre-seed** memory (e.g. "always mention our weekend hours")? (Likely yes — folds into the settings UI.)
- Retention window length + whether never-referenced memories auto-expire.
- Customer-level memory: in scope for Business at all, or shop-level only for the foreseeable future?

## 8. Verification

- Phase 1: unit tests on retrieval ranking + token-cap bound; a live "tell it a fact → new conversation → it
  recalls" walkthrough; confirm injection respects the allowance meter.
- Flag OFF = zero behavior change (no regression to the current unified assistant).
