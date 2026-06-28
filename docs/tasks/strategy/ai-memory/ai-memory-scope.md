# AI Memory — Engineering Scope

**Date:** 2026-06-22
**Owner track:** AI/Ads (unified assistant)
**Pricing tie-in:** "AI Memory & Automation" — Business ($599) tier on `pricing.jpeg`. NOTE that sheet line
bundles **Memory** (this doc) + **Automation/Custom Workflows** (separate — see `pricing-rollout-task-breakdown.md`
T7.2). This scope covers **Memory only** (T7.3 / WS7.3).
**Implementation plan:** `ai-memory-implementation-plan.md` (phase-by-phase build, grounded in the orchestrator code).
**Status:** Scope draft — no code written. Standing rule: do not commit unless told.

---

## 1. Problem

The unified assistant (`AIAgentDomain` → `UnifiedAssistantController` + `services/orchestrator/AgentOrchestrator`)
remembers only **within a single conversation thread**. `ContextBuilder` assembles per-request context and
`ConversationHistoryScrubber` trims the thread history, but nothing persists **across** sessions.

**Key reality — the assistant is already DB-grounded.** `ContextBuilder` + the tool registries pull live
business data (bookings, revenue, inventory, customers, services) straight from Postgres, so the AI **already
answers factual/objective questions well without memory** ("what was my revenue last week", "what's low on
stock"). Those facts live in tables — memory must NOT re-store them (it would only duplicate the DB and go stale
when the DB changes).

What the AI forgets across sessions is the stuff the **DB has no column for**: the owner's standing
**preferences, instructions, decisions, and corrections**. Today the assistant re-asks things it was already
told and ignores prior decisions, because that intent isn't persisted anywhere. The sheet sells "AI Memory" as a
Business-tier capability; today it does not exist.

## 2. Goal

A **persistent, cross-conversation layer for the owner's standing intent** — preferences, instructions,
decisions, and corrections — that the unified orchestrator reads into context each turn and writes back to, so
the assistant stops forgetting *how this shop wants it to behave*, without blowing the per-shop AI budget.

**The dividing line: DB grounding answers "what IS"; memory answers "how the owner wants the AI to behave +
what they've already decided."**
- **DB already covers (memory must NOT duplicate):** revenue, bookings, inventory, customers, services — any
  fact that lives in a table. The AI reads these live via tools; re-storing them as "memory" only causes
  redundancy + staleness.
- **Memory covers (no DB home):** "always pitch the premium oil change," "never suggest discounts," "when I say
  revenue I mean *net*," "we tried Black-Friday promos, they flopped — stop suggesting them," "route transmission
  jobs to Joe." These are owner intent, not data.

**What this is — vs. what it is NOT:** AI Memory = the assistant remembering the owner's **standing
preferences/decisions across sessions** (injected into context even in a brand-new, empty chat). It is **NOT**
(a) chat-history-in-the-panel — keeping past *messages* visible / switching threads — that's a separate UI
feature that already exists (the "Recent Chats" tab strip, per-device `localStorage`); and **NOT** (b) a re-store
of facts the DB already holds. Example: tell it once "never push discounts"; a week later, in a fresh chat with a
blank panel, ask for a promo idea → it proposes one that isn't discount-based, because your *instruction* was
stored — not because old messages are on screen, and not from any DB column.

**Non-goals (explicit):** re-storing DB-held facts (DB grounding already covers those); chat-history persistence /
visible-thread UI (already exists, different layer); the "Automation/Custom Workflows" half of the sheet line
(T7.2); changing wallet/auth; replacing the existing per-thread `conversations` history (memory sits *alongside* it).

---

## 3. Design decisions (recommended defaults — confirm/override)

- **D0 — What gets remembered. → Recommended: owner INTENT only (preferences/instructions/decisions/corrections),
  NOT facts the DB holds.** A memory must be something the database has no column for. If the model can answer it
  with a tool/DB read, it does NOT go in memory. *(Rationale: the assistant is already DB-grounded; storing facts
  duplicates the DB and goes stale. This decision is what keeps memory relevant alongside DB grounding.)*

- **D1 — Scope of memory. → Recommended: shop-level in v1; customer-level deferred.**
  Memory is keyed per `shop_id`. The assistant remembers the *business owner's intent* (preferences, standing
  instructions, prior decisions). Per-customer memory (history about an individual end-customer) is higher-volume
  + privacy-sensitive → phase 2. *(Rationale: shop-level is the highest-value, lowest-risk slice and matches the Business-tier buyer.)*

- **D2 — Storage / retrieval. → Recommended: a Postgres table + keyword/recency retrieval for v1; NOT a vector store.**
  A `ai_memories` table with simple tag/keyword + recency ranking covers v1. Add embeddings/semantic recall only
  if v1 retrieval proves too blunt. *(Rationale: avoids standing up a vector DB; reuses the existing pool; easy to
  inspect/debug. Keep the retrieval interface swappable so vectors can drop in later.)*

- **D3 — Capture policy. → Recommended: explicit/owner-supplied is the PRIMARY path; auto-extract is low-priority.**
  (a) **Explicit (v1 core):** a `remember_this` orchestrator tool the model calls when the user states a standing
  preference/instruction/decision ("from now on…", "always…", "never…", "when I say X I mean…"), plus the
  pre-seed settings UI (Q1). This is where the value is, and it's safe + cheap.
  (b) **Auto-extract (DEPRIORITIZED):** an end-of-conversation Haiku pass *could* infer durable intent, but given
  DB grounding most "facts" it would catch are already in the DB (redundant/stale) — so it must extract **only
  preferences/decisions, never facts**, and stays **OFF** behind a sub-flag until a quality eval proves it adds
  signal. *(Rationale: with the DB already covering facts, owner-supplied intent is the high-signal slice; don't
  let auto-extraction recreate the database as stale memory.)*

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
- `kind` ('preference' | 'instruction' | 'decision' | 'correction') — what KIND of intent (not a fact category)
- `customer_id` (nullable, phase 2) · `content` (text — the owner intent, e.g. "never suggest discounts") ·
  `tags` (text[] for keyword retrieval)
- `source` ('explicit' | 'auto') · `pinned` (bool — owner-added/standing, exempt from aging) ·
  `source_conversation_id` (nullable) · `confidence` (numeric, auto-extract only)
- `last_referenced_at` (for recency ranking + aging) · `created_at` · `deleted_at` (soft delete)
- Index on `(shop_id, deleted_at)` + a tag GIN index.
- **Rule:** no `kind` for "fact" — facts are answered from the DB via tools, never stored here.

## 5. Implementation phases

- **Phase 0 — Scope sign-off** (this doc; confirm D0–D7).
- **Phase 1 — Store + explicit capture + retrieval/injection** (~M): migration, `AiMemoryService`
  (write/search/forget), `remember_this` orchestrator tool (preferences/instructions/decisions/corrections only),
  top-K injection in `ContextBuilder` with token cap, flag `ENABLE_AI_MEMORY`. Unit tests on retrieval ranking +
  token bound. **The orchestrator prompt must say: store owner INTENT, never DB-answerable facts.**
- **Phase 2 — Shop Memory settings UI** (~S–M): view/edit/forget/pre-seed panel; surfaces what the AI remembers.
- **Phase 3 — Auto-extract (DEPRIORITIZED)** (~M): end-of-conversation Haiku extraction of *intent only*, behind
  a sub-flag + quality eval before default-on. Lower priority given DB grounding — may be skipped entirely.
- **Phase 4 — Customer-level memory** (~L, deferred): per-customer scope + data-deletion integration.
- **Phase 5 — Shared reads** (~S): expose memory reads to voice / ads auto-answer / marketing chat.
- **Phase 6 — Business-tier gate** (~S): wire into the WS2 entitlement matrix (after WS2 lands).

**Total v1 (Phases 1–2): ~M.** Full vision (through Phase 4): ~L+. (v1 is lighter than a general fact-memory —
explicit owner intent is a small, well-bounded surface.)

## 6. Cost & risk notes

- **Redundancy/staleness risk (the main reason to scope tight):** storing facts the DB already holds wastes
  tokens AND drifts out of date when the DB changes. D0 forbids it — facts come from tools, memory holds only intent.
- Injection cost is the main ongoing cost — bounded by D4 (top-K + token cap). Auto-extract (Phase 3) adds a
  per-conversation Haiku call — cheap but real; meter it via `ad_ai_costs`-style logging / the shop allowance.
- Quality risk: bad auto-extracted memories degrade every future answer → Phase 3 stays OFF until eval passes.
- Privacy risk: customer-level memory (Phase 4) must honor data-deletion; that's why shop-level ships first.

## 7. Open questions for product (with recommendations)

- **Q1 — Pre-seeded memory.** Should shop owners be able to manually add "always remember…" facts
  (e.g. "always mention our weekend hours")?
  - **Recommended: Yes, ship in v1.** It's the same write path as the explicit `remember_this` tool, just
    triggered from the Memory settings UI (Phase 2) instead of chat. High value (owner controls the AI's standing
    context), low cost, and it makes the feature feel useful on day one before auto-extract exists. Mark
    owner-added facts `source='explicit'` and **pin** them (never aged out by retention).

- **Q2 — Retention window + auto-expiry.** How long do memories live; do never-referenced ones expire?
  - **Recommended: age out auto-extracted memories after ~180 days with zero references; keep explicit/pinned
    forever.** Use `last_referenced_at` — if an `source='auto'` memory is never pulled into context within the
    window, soft-delete it (it was probably noise). Explicit + pre-seeded (Q1) facts are exempt. Make the window
    an env constant (`AI_MEMORY_STALE_DAYS=180`) so it's tunable without a deploy. Run the sweep in the existing
    nightly scheduler. *(Rationale: keeps the store lean + retrieval sharp without losing owner intent.)*

- **Q3 — Customer-level memory.** In scope for Business at all, or shop-level only for the foreseeable future?
  - **Recommended: shop-level only for v1; treat customer-level as a separate, explicitly-gated Phase 4 with a
    privacy review first.** Per-customer memory is higher-volume, must honor data-deletion, and carries the most
    privacy risk for the least incremental "wow" over shop-level. Don't commit it to the Business tier promise
    yet — validate shop-level demand, then scope customer-level with Legal in the loop. *(Rationale: ship the
    high-value/low-risk slice; don't let the riskiest scope gate the launch.)*

## 8. Verification

- Phase 1: unit tests on retrieval ranking + token-cap bound; a live "tell it a standing instruction (e.g.
  'never suggest discounts') → new conversation → it honors the instruction" walkthrough; confirm injection
  respects the allowance meter; confirm a DB-answerable fact is NOT written to memory.
- Flag OFF = zero behavior change (no regression to the current unified assistant).
