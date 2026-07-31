# AI Memory — Auto-Extract (Phase 3) Implementation Plan

**Date:** 2026-07-27
**Scope:** `ai-memory-scope.md` (D0–D7) · **Base plan:** `ai-memory-implementation-plan.md` (Phase 3).
**Status (2026-07-28): AX-1 – AX-5 all BUILT. `AI_MEMORY_AUTOEXTRACT` stays OFF — AX-5 is DEFERRED,
not failed: staging holds only 6 directive-signal turns (2 of them our own June QA strings), so the
0.85 precision bar cannot be measured on real data. See `ai-memory-autoextract-eval.md` for the corpus
numbers and the re-run trigger (~40+ directive turns across ≥5 shops).** The eval did earn its keep —
it caught the extractor promoting a one-off image correction ("make sure you take off the logo") into a
permanent rule that contradicted an earlier saved preference. Fixed two ways: the harness now passes
`assistantReply` (production always did; the eval didn't), and the extractor prompt now distinguishes a
fix to the artifact in front of it from standing intent. Post-fix that turn yields zero candidates.
Backend build clean; 18/18 memory + extractor tests.
- `AiMemoryExtractor.ts` — pre-filter + Haiku intent-only pass + confidence/fact guards + cost
  metered to `ai_misc_usage` (feature `memory_autoextract`).
- `AiMemoryService.remember` now threads `confidence` (repo column already existed).
- `UnifiedAssistantController` — fire-and-forget hook after the reply, gated by
  `memoryEnabled && isAutoExtractEnabled()` (i.e. flag + Business tier).
- Settings UI badges auto-captured memories; admin AI-usage dashboard labels the new cost line.
- `scripts/eval-memory-autoextract.ts` — AX-5 harness (generate / `--score`), passes `assistantReply`.
- **Left:** nothing buildable. The flag turns on only after AX-5 is re-run against a real corpus —
  see `ai-memory-autoextract-eval.md`.
**Flag:** build behind `AI_MEMORY_AUTOEXTRACT` (default OFF), *under* the existing `ENABLE_AI_MEMORY`
and the Business-tier gate → zero behaviour change until deliberately turned on.

## Why

Business tier ($599) advertises **"Advanced AI Memory & Automation."** What's live (Phases 1/2/5) is
the *explicit* version: the owner must literally say "remember this" (the `remember_this` tool) for
anything to be stored. That reads as **basic** — the memory never learns on its own. Auto-extract is
the upgrade that makes it *advanced*: the assistant quietly notices standing instructions the owner
states in normal conversation and remembers them, without being told to.

**Core constraint (D0, unchanged):** memory stores owner **intent** — preferences / instructions /
decisions / corrections — **never facts the DB already holds** (revenue, stock, bookings). Auto-extract
that recreates the database as stale memory is the main failure mode; the whole design guards against it.

## Integration surface (verified in code)

- **Write path is half-built.** `AiMemoryService.remember` already accepts `source:'auto'`: it skips
  the `isFactLike` guard (auto does its own intent-only filtering upstream), leaves auto memories
  **unpinned** (so they age out), and de-dupes against existing content. Gaps: `RememberInput` has no
  `confidence` field, and `create()` doesn't pass one — the `ai_memories.confidence` column exists but
  is never written. Add `confidence?: number` to `RememberInput` → `create`.
- **Hook point.** `UnifiedAssistantController` finalizes a turn right after
  `await spendCap.recordSpend(shopId, cumulative.costUsd)` and builds the response `data`. Auto-extract
  runs *after* the reply is sent — never in the response path.
- **Tier/flag gate already computed.** The controller already derives `memoryEnabled = isAiMemoryEnabled()
  && shopHasFeature(shopId, "aiMemory")`. Auto-extract reuses that and adds the `AI_MEMORY_AUTOEXTRACT`
  sub-flag.
- **Haiku + cost.** Use `AnthropicClient.complete` with `cheapModel()` (Haiku), meter via
  `spendCap.recordSpend` like every other AI surface; the cost is logged the same way the orchestrate
  turn is.
- **Aging.** `AiMemoryRepository.purgeStale` already soft-deletes `source='auto'` + `pinned=false` +
  unreferenced-past-`AI_MEMORY_STALE_DAYS` — so auto memories that never get recalled self-clean. No new
  lifecycle work.

## Design decisions

- **D-AX1 — Per-turn extraction with a cheap pre-filter.** Run at end-of-turn (simplest hook), but only
  call Haiku when the owner's message plausibly contains a standing instruction. A regex/keyword
  pre-filter ("always", "from now on", "never", "make sure", "stop", "I prefer", "don't ever",
  "going forward", "by default") gates the Haiku call, so trivial turns ("what's my revenue?") cost
  nothing. This keeps the per-conversation cost near zero while catching real directives.
- **D-AX2 — Extract INTENT ONLY; the prompt is the primary guard.** The extractor prompt mirrors the
  `remember_this` tool description: return standing preferences/instructions/decisions/corrections the
  owner stated about how the business/assistant should behave; return NOTHING for facts answerable from
  data, one-off requests, or chit-chat. `isFactLike` is the belt-and-suspenders second guard even though
  the service skips it for auto (we'll apply it in the extractor before writing).
- **D-AX3 — Confidence threshold.** The extractor returns each candidate with a 0–1 confidence; only
  persist ≥ `AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE` (default 0.7). Stored on the row for later tuning and
  UI display.
- **D-AX4 — Fire-and-forget, fail-silent.** Extraction never blocks or breaks the reply (`setImmediate`
  / detached promise, swallow errors). A failed extraction just means nothing was learned that turn.
- **D-AX5 — Owner stays in control (D6).** Auto memories are visible in the Memory settings UI, tagged
  as auto-captured (distinct from owner-added), and editable/deletable. The owner can correct or delete
  anything the assistant inferred. (Settings UI already lists memories; add a source badge + surface
  `confidence`.)
- **D-AX6 — Stays OFF until an eval passes (D3 quality risk).** Bad auto-memories poison every future
  answer. `AI_MEMORY_AUTOEXTRACT` ships default-OFF and is only turned on per-environment after the
  precision eval below clears a bar.

## Phased steps

### AX-1 — Extractor service (~M)
`backend/src/domains/AIAgentDomain/services/AiMemoryExtractor.ts`:
- `extract(shopId, { ownerMessage, assistantReply }): Promise<Array<{ kind, content, tags, confidence }>>`
- Pre-filter (D-AX1): if the owner message matches no directive-signal pattern, return `[]` with **no**
  Haiku call.
- Otherwise one Haiku call (`cheapModel`) with the intent-only prompt (D-AX2) → parse a JSON array of
  candidates, each `{ kind, content, tags, confidence }`. Tolerant parse (`[]` on malformed).
- Drop candidates below the confidence threshold (D-AX3) and any that `isFactLike` flags.
- Meter cost via `spendCap.recordSpend`.

### AX-2 — `RememberInput.confidence` + create passthrough (~S)
- Add `confidence?: number` to `RememberInput`; thread to `repo.create` (column already exists).

### AX-3 — Hook into the turn (~S)
In `UnifiedAssistantController`, after the reply is built and `recordSpend` is done, when
`memoryEnabled && AI_MEMORY_AUTOEXTRACT`:
- `setImmediate(() => extractor.extract(...).then(cands => Promise.all(cands.map(c =>
  memory.remember(shopId, { ...c, source: 'auto', conversationId })))))`, errors swallowed.
- De-dupe is already handled by `remember`. Never awaited in the response path (D-AX4).

### AX-4 — Settings UI: show auto memories distinctly (~S)
- `AiMemorySettings.tsx`: badge `source==='auto'` rows ("Auto-captured"), optionally show confidence,
  keep edit/delete. The API already returns the rows; add `source`/`confidence` to the response shape if
  not present.

### AX-5 — Precision eval (the gate, ~M) — REQUIRED before default-on
- Sample N real orchestrate conversations (staging), run the extractor, hand-label each candidate as
  {correct standing intent | fact/redundant | one-off | wrong}.
- **Bar to turn on:** precision ≥ ~0.85 on "correct standing intent", and **zero** DB-fact leakage
  (a single stored fact is a hard fail — it's the thing D0 forbids).
- Record results in `ai-memory-autoextract-eval.md`. Tune the prompt / threshold / pre-filter until the
  bar is met; if it can't be met cheaply, the feature stays explicit-only and we say so.

## Env summary (adds to the existing AI-memory flags)

- `AI_MEMORY_AUTOEXTRACT` (default false) — master sub-flag for Phase 3.
- `AI_MEMORY_AUTOEXTRACT_MIN_CONFIDENCE` (default 0.7) — persist threshold.
- (existing) `ENABLE_AI_MEMORY`, `AI_MEMORY_TOP_K`, `AI_MEMORY_STALE_DAYS`.

## Risks

- **DB-fact leakage** — the cardinal risk. Guarded three ways: the intent-only prompt, the `isFactLike`
  filter applied to auto candidates, and the eval's zero-leak hard gate.
- **Cost** — one Haiku call only on directive-signal turns; metered on the shop allowance. The pre-filter
  keeps the common case free.
- **Bad memories degrade future answers** — bounded by the confidence threshold, owner edit/delete, the
  180-day unreferenced aging, and the default-OFF-until-eval gate.

## Effort
AX-1 ~1d · AX-2/3 ~0.5d · AX-4 ~0.5d · AX-5 eval ~1d. ~3 days, then a per-environment on/off decision
based on the eval — the flag means shipping the code is safe well before we commit to turning it on.

## The payoff
Turns the Business-tier memory from "remembers what you dictate" into "remembers what you tell it in
passing" — which is what "Advanced AI Memory" promises and what makes it feel like an assistant that
actually *learns the business*. The tier gate (#1) is already enforced; this is the capability upgrade
behind it.
