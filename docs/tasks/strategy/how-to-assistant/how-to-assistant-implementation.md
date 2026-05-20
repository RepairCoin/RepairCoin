# Implementation Plan — "How-To" Assistant (in-dashboard product help AI)

**Status:** NOT STARTED — plan of record, no code written yet.
**Folder:** `docs/tasks/strategy/how-to-assistant/`
**Created:** 2026-05-19
**Scope doc:** [`how-to-assistant-scope.md`](./how-to-assistant-scope.md) — read
that first for the *why*. This doc is the *how* + the live progress checkpoint.

> **Crash-recovery note:** this doc is the single source of truth for where
> the build stands. Before stopping (or if a session crashes mid-task),
> update Section 1 (Progress) and tick the relevant checkboxes. A fresh
> session should be able to read this file and continue with no other
> context.

---

## 1. Progress checkpoint

| Phase | State | Notes |
|---|---|---|
| Phase 1 — Help corpus | ☑ done | README + 8 articles + loader format spec all in. Corpus is ready for Phase 2 to consume. |
| Phase 2 — Backend endpoint | ☑ done | All 5 tasks landed (loader, controller, system prompt, Claude+audit wiring, route). `POST /api/ai/help` is now live behind shop-role auth. HTTP-level smoke test pending the Phase 3 frontend or a manual curl pass. |
| Phase 3 — Frontend widget | ☑ done (browser verify pending) | All 4 tasks landed. Browser smoke test pending. |
| Phase 4 — Tests + polish | ◐ in progress | Backend tests (37) green. Manual QA + polish remain. |

**Last worked on:** 2026-05-20 — Phase 4.1 done. 3 new backend test
files (`HelpPromptBuilder.test.ts`, `HelpCorpusLoader.test.ts`,
`HelpAssistantController.test.ts`) — 37 tests, all green. Coverage:
prompt structural shape, corpus file-discovery + size budget,
validator (12 cases — alternation, caps, sessionId rules), handler
(7 cases — auth/validation/spend-skip/happy/cache/503/cached-flag).
Real out-of-domain decline behavior is covered by Phase 4.2 manual
QA, not unit-testable.
**Next action:** Phase 4.2 — manual QA. Open the panel in staging,
ask a real corpus question (e.g. "How do I create a service?"),
verify the answer cites the article filename; ask an out-of-domain
question ("Who booked today?") and verify the decline copy fires;
ask a follow-up to confirm multi-turn context is preserved.
**Open blockers:** none. Both pre-Phase-2 decisions confirmed by user
2026-05-20:
  1. ✓ Audit destination → **new `ai_help_messages` table** (Option A
     from Section 3.5). Migration lands as task 2.4a.
  2. ✓ Spend cap → **share the existing AI Sales Agent monthly budget**
     for v1. Revisit if help spend looks material after the first month.

States: ☐ not started · ◐ in progress · ☑ done.

---

## 2. Decisions carried in (from scope doc Section 8)

1. **Corpus home** → markdown in-repo (`docs/help/`). No DB table for v1.
2. **Audience** → shop owners only for v1. Admin is a fast-follow.
3. **Corpus owner** → "update the help article" is a Definition-of-Done item
   for any shop-facing UI PR; a named owner does periodic audits.
4. **Conversation shape** → multi-turn. Conversation held in client state;
   no DB session persistence for v1.
5. **Launcher** → a separate "Help / ?" launcher on the shop dashboard,
   distinct from the customer-facing chat.

Other locked-in choices (scope doc Section 5): answer **only** from the
corpus; decline out-of-domain politely; Haiku model; spend-capped;
audit-logged to `ai_agent_messages`.

---

## 3. Reusable infrastructure (do not rebuild)

- `AnthropicClient` — `backend/src/domains/AIAgentDomain/services/` — Claude calls.
- `SpendCapEnforcer` — spend-cap gate.
- `AuditLogger` + `ai_agent_messages` table — message audit trail.
- Prompt-caching patterns from `PromptTemplates` — cache the static corpus.
- Chat-bubble UI patterns from the existing messaging components.

No vector DB / RAG — the corpus is prompt-stuffed (cached), same as the AI
Sales Agent.

---

## 3.5 Investigation findings (2026-05-20)

Pre-implementation audit of the assumptions in this plan, run before
starting Phase 1:

**Confirmed present and reusable (no change to plan):**
- `AnthropicClient.complete({systemPrompt, messages, model, maxTokens})`
  at `backend/src/domains/AIAgentDomain/services/AnthropicClient.ts` —
  retries + cost computation already wired.
- `SpendCapEnforcer.canSpend(shopId)` + `recordSpend(shopId, costUsd)` —
  singleton export at `services/SpendCapEnforcer.ts`. Per-shop budget
  lives in `ai_shop_settings.monthly_budget_usd`.
- `AuditLogger.log(entry)` — `services/AuditLogger.ts`. Singleton
  `auditLogger` exported. But see ⚠ below on the audit-table shape.
- `PromptTemplates` already uses Anthropic prompt-cache patterns. Same
  caching shape applies to the corpus block.
- shadcn `Sheet` available at `frontend/src/components/ui/sheet.tsx` —
  use for the slide-over chat panel.
- `DashboardLayout.tsx` has an existing `fixed right-4 z-[1001]` action
  cluster (cart/chat/bell). The Help "?" launcher slots in there.
- `docs/tasks/test/qa-reference-manual.md` exists — solid seed material
  for the starter corpus articles.

**Planning gap surfaced — needs resolution before Phase 2.4:**

⚠ **The `ai_agent_messages` table cannot be used as-is.** The table was
designed for customer-AI chat and has hard `NOT NULL` constraints on:
  - `conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(...)`
  - `customer_address VARCHAR(255) NOT NULL`

The how-to assistant is shop-owner-facing — no conversation row, no
customer address. Three options:

| Option | Verdict |
|---|---|
| **A. New `ai_help_messages` table** (recommended) | Clean separation; carries only the columns the help assistant has (shop_id, session_id, payloads, tokens, cost, latency). One small migration, no risk to existing AI Sales Agent audit. |
| B. Make `conversation_id` + `customer_address` nullable on the existing table | Invasive — touches a load-bearing table used by all AI Sales Agent flows; risks breaking downstream queries that assume NOT NULL. |
| C. Synthetic IDs (e.g., `help_<shopId>_<ts>` for conversation_id, shop owner wallet for customer_address) | Hacky; the conversation_id FK would still fail unless we also insert synthetic `conversations` rows. Worst option. |

→ **Recommended path: Option A.** Add a new migration creating
`ai_help_messages` with `shop_id`, `session_id`, the same payload + token
+ cost + latency columns. Phase 2.4 logs to it.

**Spend cap question — share vs separate:**

`SpendCapEnforcer` is per-shop, monthly USD budget. The AI Sales Agent
already consumes it. Two paths for the how-to assistant:

| Path | Verdict |
|---|---|
| **Share the existing cap** (recommended for v1) | No new column on `ai_shop_settings`. Help spend rolls into the same monthly bucket as sales agent. If help-driven cost balloons, carve out later. |
| Separate `monthly_help_budget_usd` column | More precise but premature — we don't know the cost profile yet. |

→ **Recommended path: share for v1.** Revisit if help spend looks
material in the cost audit after the first month.

---

## 4. Phase 1 — Help corpus (content)

**Goal:** a curated set of short markdown how-to articles the assistant
answers strictly from. This is the long pole — partly writing, not just code.

- [x] **1.1** Create `docs/help/` with a short `README.md` explaining the
  corpus contract (one topic per file, kept current with the UI, owner +
  DoD rule from decision 3).
  - **Done 2026-05-20** — `docs/help/README.md` written. Codifies the
    5-point corpus contract (one topic per file, articles stay current
    via PR DoD + quarterly audit, terse scannable style, no out-of-scope
    answers, no business-data references). Also defines a consistent
    article template (`# Title` / one-line summary / *When to do this* /
    *Steps* with bold UI labels / *Common pitfalls* / *See also*) so the
    assistant's grounding shape is predictable. Engineer-facing section
    explains how the loader (Phase 2.1) will consume the corpus.
- [x] **1.2** Draft the starter articles (seed from
  `docs/tasks/test/qa-reference-manual.md` + the live UI):
  - [x] `create-a-service.md` — verified against live `ServiceForm.tsx`.
  - [x] `set-appointment-hours.md` — verified against
    `ServiceAvailabilitySettings.tsx` (Shop Operating Hours, Buffer
    Time, Max Concurrent Bookings, Break Time labels).
  - [x] `issue-a-reward.md` — verified against `IssueRewardsTab.tsx`
    ("Customer Name or Wallet Address" field, "Cannot Issue to Your
    Own Wallet" guard, tier bonuses).
  - [x] `configure-the-ai-sales-agent.md` — references the AI
    Assistant tab (recently shipped) and the Auto Sales & Booking
    section's master toggle / Tone (Friendly/Professional/Urgent) /
    Suggest upsells / Enable booking assistance / See How the AI
    Replies preview.
  - [x] `manage-faqs.md` — references the FAQ editor's "Suggest
    questions with AI" + "Add source material" + the price/duration
    data-drift pitfall.
  - [x] `read-your-no-show-policy.md` — verified against
    `NoShowPolicySettings.tsx` (Enable No-Show Tracking, Penalty Tiers
    with Caution / Deposit / Suspended thresholds + advance booking
    hours).
  - [x] `purchase-rcn.md` — verified against `SubscriptionManagement.tsx`
    references to $0.10 RCN + tiered pricing on RCG holdings.
  - [x] `subscription-and-billing.md` — verified against
    `SubscriptionManagement.tsx` ($500/month subscription, 10K+ RCG
    alternative path, Stripe checkout).
  - **Done 2026-05-20** — 8 articles written, each ~250–350 words,
    following the README template exactly (Title-as-question / one-line
    summary / *When to do this* / *Steps* with bold UI labels /
    *Common pitfalls* / *See also*). All eight cross-link via See
    also where they share a workflow.
- [x] **1.3** Define the corpus-loader format — how files are concatenated
  into the cached system-prompt block (filename → title, body, a stable
  delimiter the model can cite).
  - **Done 2026-05-20** — locked spec lives in
    `docs/help/README.md` under "Loader contract (locked spec — Phase
    1.3)". Covers: file discovery (every `*.md` except `README.md`),
    alphabetical read order for cache stability, exact concatenation
    format (`--- ARTICLE: <filename> ---` separator with one blank
    line padding), loader return shape (`getCorpusBlock(): string` +
    optional `getCorpusStats()` for startup logs), Anthropic
    `cache_control: { type: "ephemeral" }` placement (controller's
    job, not loader's), no-hot-reload refresh model, citation contract
    that ties the separator format to how Claude references sources
    in answers, size budget (warn > 15K tokens, refuse > 50K), error
    handling (refuse to start on missing directory or empty corpus;
    skip-and-log on individual bad files). Phase 2.1 implementer
    follows this spec verbatim.

**Acceptance:** corpus loads into a single prompt block well under the
cache-friendly size; each article is accurate against the current UI.

---

## 5. Phase 2 — Backend: help-assistant endpoint

**Goal:** `POST /api/ai/help` — multi-turn, grounded, capped, audited.

- [x] **2.1** Corpus loader service (e.g.
  `services/HelpCorpusLoader.ts`) — reads `docs/help/*.md` at startup,
  builds the cached corpus block. Reload on boot only (no hot-reload v1).
  - **Done 2026-05-20** —
    `backend/src/domains/AIAgentDomain/services/HelpCorpusLoader.ts`
    follows the locked spec verbatim. `HelpCorpusLoader` class with
    pure `buildFromDir` builder + lazy singleton accessor
    `getDefaultHelpCorpusLoader()`. Lazy (not eager) so importing the
    AIAgentDomain doesn't crash tests/scripts when `docs/help/` isn't
    present. Path defaults to repo-root `docs/help/` from
    `backend/(src|dist)/domains/AIAgentDomain/services/`; overridable
    via `HELP_CORPUS_DIR` env var. Enforces refuse-on-missing-dir,
    refuse-on-empty-corpus, skip-and-log per-file failures, hard-fail
    at >50K approx tokens, warn at >15K. Smoke-tested via
    `scripts/smoke-test-help-corpus-loader.ts`: 8 articles loaded
    alphabetically, ~17.9KB / ~4,445 tokens, separator audit passes.
- [x] **2.2** `HelpAssistantController.ts` in
  `backend/src/domains/AIAgentDomain/controllers/` — handler for
  `POST /api/ai/help`. Request carries `{ messages: [...] }` (prior turns
  for multi-turn). Validate shape; cap message count + length.
  - **Done 2026-05-20** — factory `makeHelpAssistantController(deps)` +
    lazy `getDefaults()` + exported `askHelp(req, res)` mirrors the
    other domain controllers. Pure `parseHelpRequest(body)` exported
    for unit tests. Validation enforces: array required + non-empty,
    ≤ MAX_MESSAGES (20), each `content` 1..MAX_CONTENT_CHARS (4000
    chars), role ∈ {user, assistant}, **strict alternation starting
    with user**, last message must be `user`. Handler does 401 / 400 /
    501 — 501 is intentional placeholder until 2.3 + 2.4 land; honest
    signal beats a misregistered route returning empty success. `tsc`
    clean.
- [x] **2.3** System prompt: corpus block + hard guardrails (answer ONLY
  from the corpus; if uncovered → "I don't have a guide for that — here's
  how to reach support"; decline business-data / non-product questions).
  - **Done 2026-05-20** — pure builder `buildHelpSystemPrompt(corpusBlock)`
    in `backend/src/domains/AIAgentDomain/services/HelpPromptBuilder.ts`.
    8 hard rules: (1) answer ONLY from corpus; (2) inline citation
    `*(from \`<filename>\`)*`; (3) verbatim UI labels in **bold**;
    (4) exact `SUPPORT_FALLBACK_COPY` decline when uncovered;
    (5) decline business-data / non-product / action-on-behalf
    questions; (6) short replies (2–4 sentences default); (7)
    ask-clarifying-question when ambiguous (don't guess);
    (8) shop-owner audience — no log-in / identity asks. Prompt is
    fully stable across calls = 2.4 can mark it
    `cache_control: { type: "ephemeral" }` for high cache hits.
    `SUPPORT_FALLBACK_COPY` exported for Phase 4.1 tests.
- [x] **2.4** Wire `AnthropicClient` (Haiku), `SpendCapEnforcer` (shared
  with AI Sales Agent per Section 3.5), `AuditLogger` →
  **`ai_help_messages`** (new table — Section 3.5 explains why
  `ai_agent_messages` can't be reused). Requires a new migration adding
  the table before this task; track as **2.4a**: write migration; **2.4b**:
  apply to DO + register in `schema_migrations`; **2.4c**: extend
  `AuditLogger` (or add a sibling `HelpAuditLogger`) to insert into the
  new table. Open: decide single-vs-sibling logger during 2.4c.
  - **Resolved 2026-05-20: sibling logger** (`HelpAuditLogger.ts`).
    Reused-vs-sibling decision: sibling is cleaner — the audit row
    shape diverges (no conversation_id, no customer_address, has
    session_id instead). All three sub-tasks landed.
  - [x] **2.4a** — `backend/migrations/121_create_ai_help_messages.sql`
    written 2026-05-20. Columns: `id` UUID PK, `shop_id` FK, `session_id`
    (client-generated, not FK), `request_payload`/`response_payload`
    JSONB, `model`, token counts + `cached_input_tokens` for Anthropic
    prompt cache accounting, `cost_usd`, `latency_ms`, `error_message`,
    `created_at`. Idempotent. Two indexes: `(shop_id, created_at DESC)`
    + `(session_id, created_at)`.
  - [x] **2.4b** Apply migration 121 to DO Postgres + insert into
    `schema_migrations`.
    - **Done 2026-05-20** — applied via
      `npx ts-node scripts/run-single-migration.ts migrations/121_create_ai_help_messages.sql`
      then `scripts/record-and-verify-migration-121.ts` inserted the
      tracking row and verified all 13 columns + both indexes + the
      shop FK exist on DO.
  - [x] **2.4c** Wire `AnthropicClient` (Haiku), `SpendCapEnforcer`,
    sibling `HelpAuditLogger` into `HelpAssistantController`; replace
    the 501 stub with the real Claude call.
    - **Done 2026-05-20** — wrote
      `backend/src/domains/AIAgentDomain/services/HelpAuditLogger.ts`
      (sibling to `AuditLogger`, inserts into `ai_help_messages`,
      non-throwing). Updated
      `HelpAssistantController.ts`:
      - Request shape now `{ sessionId, messages }`; `parseHelpRequest`
        validates `sessionId` (non-empty, ≤ MAX_SESSION_ID_CHARS=64).
      - Pipeline: validate → `spendCap.canSpend()` (429 if budget
        exhausted, shared with AI Sales Agent per scope decision) →
        load corpus → `buildHelpSystemPrompt(corpusBlock)` → Anthropic
        `complete()` with `cache: true` on the stable system block →
        `auditLogger.log()` ALWAYS (success and failure) → 503 if
        Claude failed → `spendCap.recordSpend()` → 200 with
        `{ reply, model, cached, latencyMs }`.
      - Always uses `claude-haiku-4-5-20251001` per cost design.
      - `AnthropicClient` constructed lazily on first request so the
        `ANTHROPIC_API_KEY`-missing throw doesn't surface at import
        time during unrelated tests/migrations.
      - `tsc` clean.
- [x] **2.5** Register route in `AIAgentDomain/routes.ts`, shop-role guarded.
  - **Done 2026-05-20** — `router.post('/help', authMiddleware,
    requireRole(['shop']), askHelp)` mirrors the existing `/settings`
    and `/metrics` route shapes. Header doc comment + `/health`
    endpoint list updated to advertise the new endpoint. The route is
    reachable but HTTP-level smoke test deferred until the Phase 3
    frontend calls it or the user requests a curl pass.

**Acceptance:** `tsc` clean; manual curl returns a grounded answer; an
out-of-domain question is declined; spend cap blocks when exhausted.

---

## 6. Phase 3 — Frontend: in-dashboard help widget

**Goal:** a persistent "Help / ?" launcher → slide-over chat panel on the
shop dashboard.

- [x] **3.1** API service (e.g. `frontend/src/services/api/aiHelp.ts`) —
  `askHelp(messages)` → `POST /api/ai/help`.
  - **Done 2026-05-20** — `frontend/src/services/api/aiHelp.ts`
    exports `HelpMessageRole` (`'user' | 'assistant'`), `HelpMessage`,
    `HelpResponse` (`{ reply, model, cached, latencyMs }`),
    `HELP_LIMITS` (mirrors backend caps: 20 msgs, 4000 chars/msg, 64
    chars sessionId), and `askHelp(sessionId, messages)` calling
    `apiClient.post('/ai/help', {sessionId, messages})`. Doc comments
    flag the expected HTTP error codes (401/400/429/503) so the panel
    can render them cleanly. `tsc` clean.
- [x] **3.2** Help launcher button — persistent "?" on the shop dashboard
  shell. Check shadcn for the slide-over (Sheet) + components first.
  - **Done 2026-05-20** — shadcn `Sheet` (confirmed at
    `frontend/src/components/ui/sheet.tsx`) wrapped a round yellow
    `HelpCircle` button mirroring the existing `MessageIcon` /
    `CartIcon` styling. Component lives at
    `frontend/src/components/shop/help/HelpAssistantLauncher.tsx`.
    Mounted in `DashboardLayout.tsx` after `NotificationBell`, gated
    on `userRole === 'shop'` (customers + admins don't see it). Sheet
    overrides default styling: `bg-[#101010]` dark background +
    `sm:max-w-md` for a wider panel suited to chat. SheetContent body
    is a placeholder for Phase 3.3 to replace with the chat UI.
- [x] **3.3** Slide-over chat panel — multi-turn UI, conversation held in
  component state, loading + error states, "Ask how to use RepairCoin".
  - **Done 2026-05-20** — `HelpAssistantPanel.tsx` mounted inside the
    launcher's SheetContent. Owns `sessionId` (minted once via
    `crypto.randomUUID()` per mount), `messages`, `input`, `loading`,
    `error`. Pre-flights against `HELP_LIMITS` (20 messages, 4000
    chars/msg). HTTP-error mapping: 401 / 400 / 429 / 503 each get a
    tailored copy; the user's message stays visible on failure so a
    retry doesn't lose context. Yellow user bubbles right-aligned;
    dark assistant bubbles left-aligned with `whitespace-pre-wrap`.
    Typing indicator (Loader2 + "Thinking…") + auto-scroll to latest.
    Empty state shows a sample question to nudge first-time users.
    Disclaimer below input: "Answers come from the help articles
    only. The AI doesn't access your shop data."
- [x] **3.4** A small set of suggested starter questions.
  - **Done 2026-05-20** — `STARTER_QUESTIONS` array of 4 strings, each
    mapping to a corpus article: "How do I create a service?", "How
    do I set my appointment hours?", "How do I issue a reward to a
    customer?", "How does the subscription work?". Rendered as
    clickable chips in the empty state (dark bg, yellow-on-hover
    border, full-width vertical stack). Clicking a chip submits
    immediately via the shared `submitText(text)` helper that the
    refactored panel now exposes — same validation + error path as
    typed input. No intermediate "edit before sending" step (Option B
    for v1; cleaner first impression).

**Acceptance:** open panel → ask a how-to question → grounded answer; a
follow-up keeps context; error state is graceful.

---

## 7. Phase 4 — Tests + polish

- [x] **4.1** Backend tests: guardrail behavior (out-of-domain declined,
  no-answer fallback), spend-cap skip path. `tsc` + jest.
  - **Done 2026-05-20** — 3 test files, 37 tests, all green:
    - `HelpPromptBuilder.test.ts` (10) — structural checks: corpus
      block included verbatim, exact `SUPPORT_FALLBACK_COPY`, rules
      ordered above articles, citation hint present, business-data /
      action-on-behalf / ambiguity-clarification rules present,
      separator referenced, audience = shop owners.
    - `HelpCorpusLoader.test.ts` (8) — file discovery (only `.md`),
      `README.md` excluded, alphabetical order, separator format,
      throws on missing dir / empty corpus / hard-limit overrun,
      accurate stats.
    - `HelpAssistantController.test.ts` (19) — 12 validator cases
      (alternation, length caps, sessionId rules, role enum, last-
      must-be-user) + 7 handler cases (401 no shopId, 400 bad body,
      **429 spend-cap skip with no Claude call**, happy path with
      audit + recordSpend, `cache: true` on system prompt, 503 +
      audit-on-failure with `costUsd: 0`, `cached: true` flag mapping).
    *(Real out-of-domain decline + no-answer behavior require live
    Claude — covered by Phase 4.2 manual QA, not unit-testable.)*
- [ ] **4.2** Manual QA on a batch of real how-to questions across the
  starter topics.
- [ ] **4.3** Polish (optional): plain-text "Settings → AI Assistant"-style
  references; real deep-links are a later follow-up.

---

## 8. Out of scope for v1 (do not build)

- Admin audience / admin corpus — fast-follow.
- DB-backed editable `help_articles` table + editor UI.
- Business-data insights (#2 — its own doc).
- Vector DB / RAG retrieval.
- The assistant taking actions on the user's behalf.
- Real dashboard deep-links (plain-text references only for v1).

---

## 9. Rough effort

Engineering (endpoint + widget + tests) ≈ **3–4 developer-days**. The help
corpus is the real cost — initial pass ~1–2 days of focused writing, plus an
ongoing maintenance commitment (corpus must track UI changes).
