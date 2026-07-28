# AI Memory — Capture Receipt Implementation Plan

**Date:** 2026-07-28
**Scope:** `ai-memory-scope.md` (D0–D7) · **Builds on:** `ai-memory-autoextract-plan.md` (Phase 3)
**Status (2026-07-28): RC-1 – RC-4 BUILT.** Backend tsc 0 · 948/948 ai-agent tests (7 new receipt cases)
· frontend tsc clean in touched files. Not yet browser-verified on staging.
**Flag:** none of its own — inherits `AI_MEMORY_AUTOEXTRACT`, so it is dormant wherever auto-extract is.

**Measured, not guessed (RC-1):** extraction latency over 8 real Haiku calls against real message
shapes — **p50 1431ms, p90 1922ms, max 1922ms** → `MEMORY_CAPTURE_TIMEOUT_MS = 3000`. A unit test
asserts the constant stays above the measured p90, because dropping it near p90 would make most
receipts silently vanish. The `AiMemoryExtractor timing` log line is permanent, so it can be re-derived.

**RC-4 resolved by fixing the cause, not hiding it.** Added a "ONE UTTERANCE, ONE MEMORY" rule to the
extractor prompt. Verified against the exact sentence that over-split during the AX-5 eval
("just make sure your designs are the best and always work around the logo and branding colors"):
now **1** memory, was 2. Genuinely unrelated rules still split correctly — a 4-rule sentence produced 4,
and "Never text customers after 8pm, and make sure weekend jobs go to Joe" produced 2.

**RC-5 — DOUBLE CAPTURE, found by the first browser test (2026-07-28).** "Stop using emojis in customer
messages" made the model call `remember_this` **and** tripped auto-extract. Both saved, in different
words — `"Never use emojis in customer-facing messages (campaign drafts, emails, texts, etc.)"` (explicit,
PINNED) and `"Do not use emojis in any customer-facing messages, including campaigns and emails."`
(auto). `remember()`'s duplicate guard compares exact lowercase content, so a paraphrase walks straight
past it; the shop ends up with the same rule twice, one exempt from aging, both injected into every
later prompt and both diluting top-K.

The plan never considered that the two capture paths overlap — that is the gap, and only a real turn
exposed it. Fixed three ways:
1. **Controller skips auto-extract when `remember_this` already fired this turn.** The explicit path
   wins: pinned, model-confirmed, already visible to the owner.
2. **`remember_this` now returns `memoryId`** in its display, so the explicit path can offer Undo too.
3. **`memory_saved` renders as the receipt chip, not a tool card.** The frontend had *no* `memory_saved`
   renderer, so it fell through to the generic card — printing the tool name as a header with Pin and
   Expand affordances over a one-line confirmation. Both capture paths now produce one identical,
   equally reversible receipt.

**RC-6 — ACROSS-TURN duplication, found by the SECOND browser test (2026-07-28).** RC-5 fixed the
same-turn collision. It did not fix the more common case: the owner **re-states a rule they already
have**, on a later turn. Sending "Stop using emojis in customer messages" a second time produced
`"Do not use emojis in any customer-facing messages, including campaigns, emails, and texts."` — a fresh
near-duplicate of the stored `"Never use emojis in customer-facing messages (campaign drafts, emails,
texts, etc.)"`. The assistant even *said* "I already have that as a standing rule" (recall working
correctly) and auto-extract stored it anyway, because **the extractor is never shown what the shop
already remembers** — it receives only the owner message and the reply.

Root cause is the same one throughout: `remember()`'s duplicate guard compares exact lowercase content,
so a paraphrase always slips through. String matching cannot solve this; judging "is this already
covered?" is what the model is for.

Fix: pass the shop's stored rules into the extraction prompt (capped at `MAX_EXISTING_IN_PROMPT = 40`)
with an instruction to return `[]` when the intent is already covered — **plus an explicit exception so
a rule the owner is CHANGING or REVERSING is still captured**, as a `correction`. Without that
exception, de-duplication would have made it impossible to ever change your mind. Fail-open: if the
lookup fails, extraction still runs, just without de-dup.

Verified against peanut's real stored memories, **5/5**: the exact message that duplicated now drops,
a near-identical restatement drops, the booking-rule restatement drops, "Actually, do use emojis now"
is captured as a `correction` (0.99), and a genuinely new rule is captured.

**Deviation from the plan, worth noting:** the pre-filter check was hoisted into the controller
(`hasDirectiveSignal(ownerMessage)` before the await) rather than left inside `extract()`. Without that,
every turn would have awaited a function that immediately returns `[]` — cheap, but it puts the 98.3%
of non-directive turns on the awaited path for no reason. Now they skip it entirely.

## Why

Auto-extract shipped silent. It captures a standing instruction and tells the owner nothing — the only
evidence is a row in Settings → AI Assistant they have no reason to open. Two consequences, both
observed on staging on 2026-07-28:

1. **The owner cannot distinguish "remembered" from "ignored."** The explicit (`remember_this`) flow
   confirmed in chat — "Got it, I've saved that." Auto-extract removed that receipt while keeping
   roughly the same effort, so the upgrade reads as a downgrade. This is the single biggest reason
   Advanced AI Memory does not *feel* advanced.
2. **It produced an actively confusing first run.** The owner typed "From now on always confirm bookings
   by text." The assistant replied *"I don't have a way to set that up"* — correct, since SMS booking
   confirmation is a dashboard feature it cannot configure — while memory silently stored the rule.
   Both systems behaved correctly; together they read as failure.

A receipt fixes both, and does something the Settings list cannot: it puts the correction point **at the
moment of capture**, while the owner still remembers the context.

## The delivery constraint (verified in code)

Extraction runs inside `setImmediate` **after** `res.json({ success: true, data })` has already been sent
(`backend/src/domains/AIAgentDomain/controllers/UnifiedAssistantController.ts`, the
`memoryEnabled && isAutoExtractEnabled()` block following the response). **The receipt therefore cannot
ride the reply it belongs to** without changing when extraction runs. Three options; two rejected:

- **WebSocket push — rejected.** `WebSocketManager` exposes only `sendNotificationToUser(walletAddress)`
  (`:367`) and `sendToAddresses(addresses[])` (`:402`). Everything is keyed by wallet address, and a shop
  login is frequently a social wallet that does not match `shops.wallet_address`. The receipt would
  silently fail to arrive for exactly the shops most likely to use the feature.
- **Notification gateway — rejected.** It would work, but it puts a notification-bell entry and a native
  push behind every captured preference. Wrong weight for an inline acknowledgement.
- **Bounded await in the response — chosen.** See D-RC1.

## Design decisions

- **D-RC1 — Bound the extraction and return it in the same response.** Replace the fire-and-forget
  `setImmediate` with `Promise.race([extractAndRemember(), timeout(T)])`. On resolve, attach the saved
  memories to the response; on timeout or error, detach the promise and let it finish exactly as it does
  today — the memory still saves, only the receipt is skipped. **This is affordable only because of the
  measured fire-rate:** the pre-filter fires on **1.7% of real owner turns** (measured over 479 unique
  staging messages, 2026-07-28), so ~1 turn in 60 gains the Haiku latency, on turns that already take
  several seconds. The other 98.3% are untouched — the pre-filter short-circuits before any await.
- **D-RC2 — The receipt is a correction point, not just an acknowledgement.** Each chip carries **Undo**,
  wired to the existing `DELETE /api/ai/memories/:id` (`AiMemoryController.removeMemory`). This is the
  substantive half: it converts a silent write into a reviewable one at the moment the owner still has
  the context, instead of a list reviewed weeks later — and it bounds the "bad memories degrade future
  answers" risk that `ai-memory-autoextract-plan.md` flags, since a wrong capture dies in one click
  rather than quietly shaping campaigns and ads lead replies until someone notices.
- **D-RC3 — Never degrade the reply.** The receipt is strictly additive. Any failure, timeout, or slow
  Haiku call must leave the response identical to today's. No new way for a turn to fail.
- **D-RC4 — Silent when off.** The `memoriesCaptured` field is omitted entirely unless
  `memoryEnabled && isAutoExtractEnabled()`. Below-Business shops and flag-off environments see an
  unchanged payload.
- **D-RC5 — Measure the timeout, don't guess it.** We have extraction *cost* (~$0.000702/call) but not
  extraction *latency* — the Haiku call is not separately timed today. Instrument first, then choose T
  from real percentiles. Shipping a guessed constant is how this quietly starts costing reply latency.

## Phased steps

### RC-1 — Instrument extraction latency (~S) — DO FIRST
- Time the Haiku call inside `AiMemoryExtractor.extract` and log/record it (the `ai_misc_usage` write is
  already there; add the duration).
- Let it run on staging traffic, then pick `T` from observed p90 rather than assumption (D-RC5).

### RC-2 — Backend: bounded await + response field (~S/M)
- `UnifiedResponseData` (`UnifiedAssistantController.ts:336`) gains
  `memoriesCaptured?: Array<{ id: string; kind: AiMemoryKind; content: string; confidence: number }>`.
- Replace the `setImmediate` block with the bounded race (D-RC1); collect the rows returned by
  `memory.remember(...)` so each chip has an `id` for Undo.
- Field omitted unless enabled (D-RC4).
- Tests: receipt present on a directive turn; timeout path returns the normal payload and still saves;
  absent when the flag is off; a turn capturing two memories returns two entries.

### RC-3 — Frontend: the chip (~S/M)
- `frontend/src/services/api/aiOrchestrate.ts` — extend the response type.
- `frontend/src/components/shop/unified/UnifiedAssistantPanel.tsx` — render chips beneath the assistant
  message: `🧠 Remembered: "<content>"  [Undo]`.
- shadcn `Badge` + `Button` per the repo convention; Undo calls the existing delete endpoint and removes
  the chip optimistically.
- Respect the readability floor (no text below 12px; secondary 14px).

### RC-4 — Decide the two-memories-per-sentence case (~S)
The AX-5 eval saw one sentence — "just make sure your designs are the best and always work around the
logo and branding colors" — split into **two** memories. Two chips for one sentence reads as a bug even
though it is not. Two ways to resolve, and they are not equivalent:
- Cap the display ("+1 more"), which hides the symptom; or
- Tighten the extractor prompt against over-splitting, which fixes the underlying memory bloat.

**Recommendation: fix the splitting.** The bloat is real whether or not it is visible, and it degrades
recall ranking by diluting the top-K.

## Env summary

None. Inherits `ENABLE_AI_MEMORY`, `AI_MEMORY_AUTOEXTRACT` and the Business-tier gate. No migration —
`ai_memories` already stores everything the chip needs.

## Risks

- **Reply latency** — bounded by D-RC1's race and confined to the 1.7% of turns that fire. The timeout
  must be chosen from measurement (RC-1), not assumption.
- **Chip noise** — a chatty owner stating several rules in one turn gets several chips. Bounded by RC-4.
- **Undo race** — Undo fires while the recall path may already have injected the memory into a
  subsequent turn. Harmless (the memory is deleted, later turns are clean) but worth not pretending the
  chip is transactional.

## Effort
RC-1 ~0.25d · RC-2 ~0.5d · RC-3 ~0.5d · RC-4 ~0.25d. **~1.5 days.**

## What this does and does not fix

**Does:** makes capture visible and correctable; resolves the "assistant says it can't, memory saves it
anyway" confusion by showing both at once; converts the Settings list from the only review surface into
a backstop.

**Does not:** make the feature smarter. Recall was the other half and was fixed separately (`a152a4ca8` —
18/20 ordinary phrasings, up from 7/20). The receipt makes a feature *visible*; the pre-filter rebuild
made it *hear*. Both were needed, and neither alone would have made Advanced AI Memory feel advanced.
