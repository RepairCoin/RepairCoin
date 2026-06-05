# Unified Assistant — flagship spike (build notes)

**Status:** ✅ built + PROVEN end-to-end 2026-06-01. SPIKE — not production;
validates the thesis in `../voice-ai-dispatcher/unified-assistant-vision.md`.

## Result (2026-06-01, `npm run ai:spike-demo` vs peanut on :3002)

ONE conversation reached BOTH domains with no panel switch — thesis proven:
- Turn 1 "How did we do this month?" → `revenue_summary, repeat_customer_analysis, top_customers` (honest about peanut's zero this-month data — no fabrication).
- Turn 2 "Win back the quiet customers" → AI self-corrected: 90-day lapsed empty → **re-ran `lookup_audience_count` at 30 days on its own**, found 3/4, then `propose_campaign_draft`. Cross-domain Info→Recommendation→Action in one turn, draft-only guardrail respected ("review + add offer + tap Send").
- Turn 3 "draft for all my customers" → `lookup_audience_count → propose_campaign_draft` (4 customers, "We Miss You").

Confirms the scope-delta's "~70% already exists / mostly wiring" claim: the
orchestrator is the Insights loop + a merged tool array + dispatch routing —
no new tool logic.

**Prompt tuned + verified 2026-06-01.** The first run had turn 2 redundantly
re-pulling revenue/top/repeat before the lookup (6 tools, ~21s). Added a REUSE
rule to `ORCHESTRATE_SYSTEM_PROMPT` ("don't re-call a tool for a metric/range/
segment already in the thread; on a 'fix it' turn go straight to
lookup_audience_count + propose_campaign_draft"). Re-run confirmed: **turn 2
dropped 6 tools → 3** (`lookup_audience_count ×2, propose_campaign_draft`) — the
3 redundant insights calls gone, no regression (cross-domain + draft still
pass). The 2× lookup is legitimate (the AI's empty-90-day-window self-correction).
Note: turn-3 behavior is nondeterministic (run 1 drafted for all customers; run 2
correctly asked for the offer before drafting, per the no-invented-figures
guardrail) — for a scripted demo/video, bake the offer into the request. Latency
per turn 8–19s — same downstream-Sonnet profile as the existing panels.

## What it proves

ONE conversation that does Information → Recommendation → Action across domains
without the owner picking a panel:
- Turn 1 "How did we do this month?" → insights tools (revenue/top/repeat)
- Turn 2 "Win back the quiet customers" → marketing tools (lookup + draft)

## What was built (reuses existing machinery — ~no new logic)

- **`backend/src/domains/AIAgentDomain/controllers/UnifiedAssistantController.ts`**
  — the orchestrator. Copies the `InsightsController` agent loop verbatim; the
  only change is the tool array is a **merged, curated cross-domain set**
  (`revenue_summary`, `top_customers`, `repeat_customer_analysis`,
  `lookup_audience_count`, `propose_campaign_draft`) drawn from BOTH the
  insights and marketing registries, and `dispatchUnified()` routes each
  `tool_use` to whichever registry owns it (`getInsightsToolByName ??
  getMarketingToolByName`, then `dispatchTool` / `dispatchMarketingTool`).
  Draft-only — `propose_campaign_send` is intentionally NOT exposed (the draft
  card is the human-in-the-loop confirm). Inline unified system prompt. Spend
  flows through the shared `SpendCapEnforcer`. No new audit table / migration.
- **`backend/src/domains/AIAgentDomain/routes.ts`** — `POST /api/ai/orchestrate`
  (authMiddleware, requireRole(['shop'])). Reuses `parseInsightsRequest`.
- **`docs/tasks/strategy/unified-assistant/spike-demo.ts`** — drives the 2-turn
  demo and asserts turn 2 actually drafted. `npm run ai:spike-demo`.

## Key integration facts (from the codebase, for future work)

- Insights + marketing tools BOTH implement `ClaudeTool` + `execute(args,
  {shopId, pool})` → a single merged `ClaudeTool[]` and one `{shopId, pool}`
  context work for both. Dispatch results are structurally identical
  (`{ok, tool, args, result?{data,display}, error?, latencyMs}`).
- `AnthropicClient.complete({systemPrompt, messages, model, maxTokens, tools,
  toolChoice})` → `{text, toolUses[], usage, costUsd, latencyMs, model}`.
- The reusable agent loop lives in `InsightsController` / `MarketingChatController`
  (NOT `AgentOrchestrator`, which is the customer-facing Sales Agent and makes a
  single non-iterating call).

## Phase 1 progress (2026-06-01, branch `deo/unified-assistant-phase-1-orchestrator`)

Exec approved G1 (Q1 reversal) + G2 (autonomy = confirm-before-execute on all
financial/outward actions). Generalized the spike:
- Full insights + marketing registry exposed (`getOrchestratorTools`),
  `propose_campaign_send` withheld (G2 — send lands in Phase 4 with a confirm).
- Registry-agnostic system prompt (describes tool *groups*, broadened the
  never-execute rule to sends/POs/refunds).
- Model selection: Sonnet default, Haiku at ≥70% budget (`useCheaperModel`).
- Typecheck clean; verified end-to-end against the full registry — thesis holds
  (cross-domain in one conversation, drafted, grounded, no wandering into
  irrelevant tools).

**KNOWN ISSUE — redundant re-pull regressed at full-registry scale.** The
no-redundant-pull prompt tune held at 5 tools but broke at ~18: turn 2 re-pulled
the turn-1 insights tools (revenue/bookings/top_services) before the
lookup+draft, for a pure win-back request (6 tools, 22s vs tuned 3 tools/19s).
**Correctness is fine** (grounded, draft correct, guardrail respected) — it's a
latency/cost wart. Prompt-only control is nondeterministic across toolset sizes,
so this is logged as a **Phase-1 hardening item** to tune against REAL shop data
with a multi-run eval set (not one-shot tweaks on zero-data peanut). Candidate
fixes: stronger prompt rule (cheap, unreliable) and/or dispatch-level dedupe of
identical tool+args already answered in the conversation (cuts DB load, not the
model round-trip).

**Phase 1 still to do:** dedicated `ai_orchestrate_messages` audit table +
logger; then the re-pull hardening above. Persistence deferred to Phase 2 (D2).

## If the demo fails / next steps

- Re-run: `cd backend && npm run dev` (boots on :3002), then
  `VOICE_QA_API_BASE=http://localhost:3002 npm run ai:spike-demo`.
- If turn 2 doesn't draft: check the system-prompt rules and whether
  `lookup_audience_count` resolved a non-zero segment for `peanut` (needs lapsed
  customers in the data).
- This is the de-risking spike. Full v2 still gates on exec sign-off (Q1
  reversal + autonomy line) per the scope-delta §7.
