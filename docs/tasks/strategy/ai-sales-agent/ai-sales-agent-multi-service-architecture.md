# AI Sales Agent — Multi-Service Conversation Architecture

**Status:** Proposal / Architecture Record
**Owner:** Deo (deocagunot)
**Date:** 2026-05-11
**Sequence:** Follow-up to Phase 3 (Claude integration) — addresses gaps discovered during staging smoke testing
**Related plans:**
- [ai-sales-agent-claude-integration-plan.md](./ai-sales-agent-claude-integration-plan.md)
- [ai-sales-agent-integration-strategy.md](./ai-sales-agent-integration-strategy.md)

---

## TL;DR

The current AI Sales Agent assumes **one conversation = one service**. Real customer behavior breaks this assumption:
- Customers open chats from multiple service modals (same shop) and reuse the same thread
- Customers ask to book multiple services at once
- Conversation history retains references to previously-discussed services and confuses the AI

This document specifies the architectural changes needed to make **multi-service conversations work cleanly** — both at the data layer, the AI prompt layer, the tool-call layer, and the UI surface. The work is broken into 7 phases, each independently shippable, sequenced so that each phase preserves correct behavior even if subsequent phases aren't merged.

---

## Problem Statement

### Current behavior (pre-fix baseline)

```
conversations table
  conversation_id    PK
  customer_address
  shop_id
  service_id         ← single column, last-touched service wins
  ...
```

- Conversations are keyed by `(customer_address, shop_id)` — **one thread per shop relationship**
- When a customer opens chat from Service A's modal, `conversation.service_id = A`
- When the same customer later opens chat from Service B's modal, `conversation.service_id` is overwritten to B
- The AI's prompt is built from `conversation.service_id` (a single service) — so the AI is always anchored to the **most recently-touched** service

### Observed pain points (from staging smoke testing)

1. **Context drift / hallucination.** When a customer enters from Service B mid-thread, the conversation history still contains references to Service A. Claude reads the mixed history and sometimes asks "did you mean Service A?" when the customer never said so. (Patched with universal rule #12 — service priority, commit `f9a14605` on `deo/ai-service-priority-rule`.)

2. **Multi-service booking is impossible by design.** Customer says *"book me a laptop repair AND a pastry tutorial"* — the AI's `propose_booking_slot` tool takes exactly one `serviceId` (the conversation's anchor), so only one service can ever be tap-to-book'd per response. (Partially patched: rule #11 forces explicit acknowledgement of the second service + concatenation fix in commit `b0e1331c` shows both text and tool reply_text; but customer still can't actually tap-to-book the second service from the same chat.)

3. **Sibling services exist but only as text mentions.** The `aiSuggestUpsells` flag pulls a sibling list into the prompt, but the AI can't BOOK siblings — it can only talk about them. The tool's enum is gated to the conversation's anchor service.

4. **No service indicator on the booking card.** The tap-to-book card today shows just date/time. If the customer is in a multi-service thread, they may not know which service they're confirming. Trust depends entirely on the AI's reply text getting the wording exactly right.

5. **Architectural assumptions about "the service" leak across files.** `ContextBuilder`, `AgentOrchestrator`, `AvailabilityFetcher`, `PromptTemplates`, and the booking card all encode "one service" thinking. Each iterative patch (rules #11, #12, multi-tool concatenation) adds prompt complexity without changing the underlying model. Eventually the rule stack becomes brittle.

### Surface area inventory

All five messaging entry points point to the same backend conversation. The architecture must be coherent across all of them:

| Entry point | URL | Side | Reaches `conversations` how? |
|---|---|---|---|
| Top-right dropdown (recent conversations) | any page | Both | Direct (conversation_id from list API) |
| Service modal → 💬 icon | `/customer?tab=marketplace` | Customer | `getOrCreateConversation(customer, shop, serviceId)` — **updates `service_id`** |
| Customer messages tab | `/customer?tab=messages` | Customer | Direct (conversation_id) |
| Shop bookings page → booking detail → Messages tab | `/shop?tab=bookings` | Shop | Direct (conversation_id) |
| Shop messages tab | `/shop?tab=messages` | Shop | Direct (conversation_id) |

The service modal entry point is the only one that mutates `conversation.service_id` mid-thread — that's where the single-service assumption first breaks.

---

## Goals

1. **One thread per (customer, shop)** — preserve the existing data model and UX. Customers and shops shouldn't have to navigate multiple threads per relationship.
2. **AI can discuss AND book any AI-enabled service from the shop** within that one thread, without re-entering a service modal.
3. **AI can book multiple services in one response** when the customer asks for it (e.g., "book me X and Y" → two tap-to-book cards in one reply).
4. **No context drift** — the AI doesn't hallucinate that the customer wants a service they didn't ask about, even when history is mixed.
5. **Visible service context** — the customer and shop both always know which service a given message or booking card is about.
6. **Backwards-compatible per phase** — each phase ships independently; partial deployments leave the system in a coherent state.

## Non-Goals

- **Per-service threads (separate conversation_id per service).** Considered and rejected: customer-facing UX gets cluttered ("you have 5 threads with Peanut, one per service"), shop-side context-switching is worse, sidebar gets noisy. Stick with one-thread-per-shop.
- **Booking across multiple shops in one response.** Each shop has its own conversation thread. Multi-shop coordination is a human-side concern.
- **Bundled appointment objects** (one calendar entry covering two services). Each tap-to-book card still creates a separate appointment row — no cross-service atomic booking.
- **Cross-service availability queries on demand by the AI.** Pre-fetch a bounded set; don't let the AI loop on availability checks.
- **Replacing universal prompt rules #11 / #12.** Those rules remain — they're cheap insurance even after the data/tool model is fixed. Belt + suspenders.

---

## Architecture Overview

### Data model — minimal change, additive only

```
conversations table:
  conversation_id        PK
  customer_address
  shop_id                ← still the key
  service_id             ← rename meaning: "current_service_focus" (most recent intent)
  ...                    (no schema change in MVP; field semantics shift)

messages.metadata (JSONB):
  + service_context      ← which service this message was about; falls back to
                           conversation.service_id when not set. Lazy fill from
                           the next AI reply onward (no migration).
  + booking_suggestions  ← already exists; each entry has its own serviceId
```

**No SQL migration required.** All changes are at the application layer.

### Prompt layer — two new context blocks

Replace the existing single-service prompt structure with a two-tier model:

```
About this shop's available services (the AI may help with any of these):
  - AQua Tech ($455): laptop diagnostic + repair
  - Newly Baker ($99, 45 min): pastry tutorial
  - Mongo Tea ($25): tea consultation
  - ... (cap at MAX_SHOP_SERVICES_IN_PROMPT)

Current focus (the service the customer most recently engaged with):
  AQua Tech — $455, 60 min, [description]

[+ existing booking policy, hours, etc.]
```

Universal rule #12 (already shipped) handles priority: history references are background, current focus is default, customer's explicit mention in latest message overrides.

### Tool layer — multi-service enum + multi-call handling

```
propose_booking_slot tool's input_schema:
  serviceId: { enum: <all AI-enabled services for this shop> }
  slot_iso:  { enum: <slots for the in-scope services, tagged by service> }
  reply_text: { maxLength: 130, description: "MUST name the service" }
```

Each slot in the prompt is rendered with its service:
```
Available slots:
  - AQua Tech, Thursday May 14 at 9:00 AM  (slot_iso: 2026-05-14T13:00:00Z)
  - AQua Tech, Thursday May 14 at 10:00 AM
  - Newly Baker, Thursday May 14 at 9:00 AM (slot_iso: ...different ISO...)
  ...
```

Claude can emit **multiple `tool_use` blocks** in a single response (Anthropic API supports this). The orchestrator already concatenates text + reply_text from PR `b0e1331c`; it needs to be extended to handle **multiple tool_use blocks**, producing multiple `booking_suggestions` entries in `messages.metadata`.

### Orchestrator — multi-call response handler

```
claudeResponse:
  text:     "Got both. Here are your two slots —"
  toolUses: [
    { serviceId: AQua_Tech, slot_iso: ..., reply_text: "Laptop repair Thursday 9 AM" },
    { serviceId: Newly_Baker, slot_iso: ..., reply_text: "Pastry tutorial Friday 10 AM" }
  ]

customerFacingText = "[text block]\n\n[tool 1 reply_text]\n\n[tool 2 reply_text]"
bookingSuggestions = [
  { serviceId: AQua_Tech, slotIso: ..., humanLabel: ... },
  { serviceId: Newly_Baker, slotIso: ..., humanLabel: ... }
]
```

`messages.metadata.booking_suggestions` is already an array — frontend already renders one card per entry. The orchestrator just needs to populate the array correctly.

### Frontend — service name visibility

1. **Tap-to-book card** renders the service name above the date/time:
   ```
   TAP TO BOOK
   AQua Tech — Thursday, May 14 at 9:00 AM
   ```

2. **Chat header chip** under the shop name: `Currently discussing: X` (updates when conversation's `service_id` / `current_service_focus` changes).

3. **No change to dropdown / sidebar / bookings tab** — those show conversations, not services. Existing display works.

---

## Phased Implementation

Each phase is an independent PR. Each phase preserves current behavior if subsequent phases aren't shipped. Sequenced so the highest-leverage changes land first.

### Phase 1 — Multi-service context in the prompt (foundation)

**Scope:** `ContextBuilder` fetches all `ai_sales_enabled=true` services for the shop (with a cap, e.g., `MAX_SHOP_SERVICES_IN_PROMPT = 15`). New context block in the prompt lists them. The current service remains the "focus" but the AI now knows the full shop menu.

**Files:**
- `backend/src/domains/AIAgentDomain/services/ContextBuilder.ts` — extend service query, new `shopServices` field on `AgentContext`
- `backend/src/domains/AIAgentDomain/types.ts` — add `AgentShopServiceContext[]` to `AgentContext`
- `backend/src/domains/AIAgentDomain/services/PromptTemplates.ts` — new "About this shop's services" block in `buildContextBlock`
- Tests: ~10 new

**What changes for the AI:**
- AI can now answer "what other services do you offer?" without needing the `aiSuggestUpsells` toggle (which becomes more of a "promote this service" emphasis flag than a gate)
- Customer asks about a service not currently in focus → AI knows it exists and can describe it briefly

**What doesn't change yet:** AI still can only BOOK the current focus (tool's enum unchanged). Cross-service booking-intent still escalates or describes-not-books.

**Risk:** Low. Prompt-only addition. Backwards-compatible.

**Test:** Customer in Newly Baker thread asks "do you fix laptops?" → AI says yes (it sees AQua Tech in the menu) and gives a brief description, redirects to AQua Tech's modal for booking.

### Phase 2 — Expand the tool's serviceId + slot enum

**Scope:** `AgentOrchestrator.buildBookingSuggestionTool` accepts all AI-enabled services + their slots, not just the current service. Each slot in the prompt is tagged with its service name.

**Files:**
- `backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts` — extend tool builder
- `backend/src/domains/AIAgentDomain/services/AvailabilityFetcher.ts` — new method `fetchUpcomingSlotsForShop` (multi-service variant)
- `backend/src/domains/AIAgentDomain/services/PromptTemplates.ts` — slot list rendering includes service name
- Tests: ~15 new

**What changes for the AI:**
- Customer says "book me AQua Tech Thursday at 3 PM" — even though current focus is Newly Baker, AI can call the tool with `serviceId=AQua Tech` because that service is in the enum.
- Customer says "what laptop repair slots are available?" — AI can offer AQua Tech slots via the tool.

**Cost tradeoff:**
- Tool's serviceId enum + slot list grow proportionally to shop's AI-enabled services
- Per AI call: ~1 extra DB query per AI-enabled service (currently 1 per day × lookahead days, becomes 1 per service per day × lookahead)
- Anthropic prompt cache absorbs most of the size growth
- Latency: parallel queries scale; for a 6-day window + 4 AI-enabled services = ~24 parallel queries vs current 6. Acceptable.

**Risk:** Medium. Tool schema change. Existing tests will need updating to reflect multi-service tool definition.

**Test:** Customer in Newly Baker thread says "book me AQua Tech Thursday afternoon" → AI proposes AQua Tech slot via tool with `serviceId=AQua_Tech`. Card renders with "AQua Tech" labeled.

### Phase 3 — Orchestrator handles multiple tool_use blocks

**Scope:** Anthropic responses can contain N tool_use blocks. Orchestrator's response handler iterates, validates each, builds the `booking_suggestions` array.

**Files:**
- `backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts` — response handler loops over `claudeResponse.toolUses`
- Tests: ~20 new (single tool, multiple tools, mixed valid/invalid, dedupe, ordering)

**What changes for the AI:**
- "Book me a laptop repair AND a pastry tutorial" — AI emits two tool_use blocks in one response. Customer's chat shows ONE message bubble with TWO tap-to-book cards stacked. Each card is its own service.

**Important guardrails:**
- Each tool_use must have a serviceId from the enum (validated)
- Each slot_iso must match a slot from that service's availability set (validated)
- Anthropic validates schema before we see the response; we double-check
- Duplicate tool_use for the same (serviceId, slot_iso) gets deduped
- Reply_text for each tool gets concatenated into customerFacingText in order

**Risk:** Medium. Backend logic change with several edge cases. Heavy test coverage required.

**Test:** Customer asks for two services in one message → DB shows ONE messages row with TWO entries in `metadata.booking_suggestions`. Customer's chat renders two cards.

### Phase 4 — Pre-fetch availability across services

**Scope:** `ContextBuilder` parallelizes slot fetches across all AI-enabled services for the shop (not just the current focus). Reuses the existing `AvailabilityFetcher.fetchUpcomingSlots` per-service, in parallel.

**Files:**
- `backend/src/domains/AIAgentDomain/services/ContextBuilder.ts` — orchestrate multi-service slot fetch
- Tests: ~10 new

**Cost:**
- For a shop with N AI-enabled services: N × `fetchUpcomingSlots` calls in parallel
- Each `fetchUpcomingSlots` is already parallel internally (per day)
- For Peanut shop with 2 AI-enabled services + 6-day window + ~9 slots/day = `2 × 6 = 12` parallel queries
- DB connection pool should handle this trivially (pool size 20)
- Latency: roughly the same as the slowest single-service fetch (~150-300ms)

**Cap:** `MAX_AI_ENABLED_SERVICES_FOR_AVAILABILITY = 5` to bound the burst on shops with many AI-enabled services.

**Risk:** Medium. Latency + DB load increase, bounded but real.

**Test:** Shop with 3 AI-enabled services → all 3 services' slots reach the prompt within the existing `MAX_SLOTS_CEILING` budget.

### Phase 5 — Frontend: service name on tap-to-book cards

**Scope:** `BookingSuggestionCard.tsx` renders service name prominently. Service name comes from the `booking_suggestions[].humanLabel` (already populated server-side with format `"AQua Tech — Thursday, May 14 at 9:00 AM"`) or a new `serviceName` field if simpler.

**Files:**
- `frontend/src/components/messaging/BookingSuggestionCard.tsx` — render service name above date/time
- Possibly: extend `booking_suggestions[]` shape on backend to include `serviceName` explicitly (optional — humanLabel is enough)

**Risk:** Low. Cosmetic.

**Test:** Visual verification in staging. Card shows service name on every tap-to-book regardless of conversation's current focus.

### Phase 6 — Frontend: "Currently discussing: X" chip

**Scope:** Chat header (in `ConversationThread` or `MessagesLayout`) renders a small chip under the shop name showing the current `service_id`'s name. Updates when conversation's service_id changes (which already happens when customer enters from a different service's modal).

**Files:**
- `frontend/src/components/messaging/ConversationThread.tsx` (or `MessagesLayout.tsx`) — fetch + render service name chip
- Possibly: `frontend/src/services/api/messaging.ts` — extend conversation API response to include the current service's name

**Risk:** Low. Cosmetic + small API extension.

**Test:** Customer enters from AQua Tech modal → chip says "Currently discussing: AQua Tech." Switches to Newly Baker modal → chip updates.

### Phase 7 — Architecture decision record (this document)

**Scope:** Commit this doc to `docs/tasks/strategy/ai-sales-agent/`. Reference it from the existing Phase 3 plan as a continuation.

**Files:**
- `docs/tasks/strategy/ai-sales-agent/ai-sales-agent-multi-service-architecture.md` (this file)
- Optionally: add a "What's Next" note in `ai-sales-agent-claude-integration-plan.md` pointing to this doc.

**Risk:** Zero. Documentation only.

---

## Implementation Sequencing

```
Phase 1 (prompt context)
       ↓
Phase 2 (tool enum)  ← unlocks "book any service"
       ↓
Phase 3 (multi-tool handling)  ← unlocks "book multiple services at once"
       ↓
Phase 4 (multi-service availability fetch)  ← keeps slots accurate for any service
       ↓
Phase 5 (card service name)  ← UX: customer always knows what they're booking
       ↓
Phase 6 (header chip)  ← UX: customer always knows what's in focus

Phase 7 (this doc) — can ship anytime, doesn't gate code phases.
```

**Each phase is independently mergeable.** Skipping phase 6, for instance, doesn't break phase 5 — it just loses the header chip; cards still show the service name.

**Phase 3 is the architectural lynchpin.** Without it, the AI can talk about multiple services but still can't BOOK both. Phases 1-2 are foundation; phases 4-6 are quality-of-life.

---

## Backwards Compatibility / Rollout Plan

- **No DB migration** required. All changes are application-layer.
- **No breaking API changes.** Existing `messages.metadata.booking_suggestions` is already an array; multi-tool just populates more entries.
- **Existing conversations work.** Pre-existing conversations have a single `service_id`. After phase 2 deploys, the AI sees that service as the "focus" plus the shop's other services as available — same behavior for the focus service, expanded behavior for the others.
- **Feature flag (optional):** if rollout risk is a concern, gate phases 2-3 behind a per-shop `ai_multi_service_enabled` flag on `ai_shop_settings`. Default off; enable per-shop during pilot.

## Telemetry / Acceptance

For each phase, instrument:
- Phase 1: % of AI replies that reference a non-focus service (a new service-mention counter in audit log)
- Phase 2: % of `tool_use` calls with `serviceId !== conversation.service_id`
- Phase 3: % of responses with >1 `tool_use` block; success rate (no validation drops)
- Phase 4: P95 latency of `fetchUpcomingSlots` across all services vs single-service baseline
- Phase 5-6: User-side smoke (visual confirmation; no telemetry needed)

## Open Questions

1. **Service prioritization in the menu.** When the shop has 15+ AI-enabled services, which do we surface in the prompt? Current proposal: top N most-recently-booked, or shop-owner-tagged "featured." Defer to phase 1 review.

2. **Cross-service deduplication.** If `AvailabilityFetcher` returns the same slot ISO for two services (impossible if services have different durations, but possible in degenerate configurations), how does the AI disambiguate? Likely a non-issue in practice; defer.

3. **Booking attribution for the audit log.** Each `propose_booking_slot` tool call should be auditable as a separate intent. The current `ai_agent_messages.tool_calls` JSONB column already stores an array, so this should be natural. Phase 3 verifies.

4. **What happens to the `aiSuggestUpsells` toggle after phase 1?** Originally it gated whether siblings appear in the prompt. After phase 1, all AI-enabled services appear regardless. The toggle becomes a "this service should be PROMOTED in conversations" flag — pushes the AI to mention it actively. Reconsider semantics during phase 1 implementation.

5. **What about non-AI services in the menu?** A shop might have 10 services with only 4 AI-enabled. Do we mention non-AI services in the prompt at all? Current proposal: NO — non-AI services don't surface, which preserves the shop owner's intent that those services require human handling. Customer asking about a non-AI service triggers the standard "I don't have info on that, want me to flag a teammate?" pattern (already in place per universal rule #2).

6. **Service modal entry intent vs. conversation memory.** When a customer opens chat from Service B's modal, we update `conversation.service_id` to B. But the customer might have just been curious — they may continue talking about Service A in their next message. Should `service_id` only update on the *first* customer message after the modal entry, not on the modal entry itself? Defer to UX review during phase 6 (chat header chip will surface this signal).

## Future Considerations (Out of Scope)

- **Bundled appointments** — a single calendar entry covering multiple services back-to-back. Requires changes to `appointments` table + slot generation logic + payment flow. Big lift; defer until multi-service booking demand is validated post-rollout.
- **Cross-shop AI** — customer asking about Shop A's service in a thread with Shop B. Architecturally cleaner to disallow; AI escalates to "you'd need to chat with Shop A directly." No change planned.
- **AI-initiated upsell campaigns** — AI proactively offers other services even when not asked. Phase 1+2 enable this; the prompt rule would say "after closing a booking, naturally mention 1 relevant sibling service if appropriate." Defer to product / behavior review.

---

## Related Patches Already Shipped (context — informs this design)

These patches addressed symptoms en route to this architecture. Each remains valuable even after the full architecture lands:

| Commit | Branch | Date | What it patched | Survives this architecture? |
|---|---|---|---|---|
| `f4dab234` | `deo/phase-3-task-10-fix-7` | 2026-05-07 | Fenced JSON → tool-use migration | Yes — foundational |
| `b09dd44d` | `deo/phase-3-task-10-fix-7` | 2026-05-07 | WS race catchup + audit log `tool_calls` | Yes |
| `9d83c4dd` | `deo/phase-3-task-10-fix-7` | 2026-05-07 | WS auto-reconnect + heartbeat | Yes |
| `36a078c2` | `deo/phase-3-task-10-fix-7` | 2026-05-08 | AI reply broadcast to shop (Bug #1) | Yes |
| `a97920bb` | `deo/ai-shop-hours-and-disclosure` | 2026-05-08 | Shop hours summarizer + AI disclosure handling | Yes |
| `d7166749` | `deo/ai-dynamic-booking-window` | 2026-05-10 | Dynamic `booking_advance_days` lookahead | Yes |
| `7e151796` | `deo/ai-today-date-context` | 2026-05-11 | Today's date anchor + rule #10 refinement | Yes |
| `f29e5589` | `deo/ai-ws-broadcast-recovery` | 2026-05-11 | Post-send + reconnect catchup | Yes |
| `04583f2b` | `deo/ai-dynamic-slot-cap` | 2026-05-11 | `MAX_SLOTS_CEILING = 100` + per-day cap | Yes (per-day cap becomes per-service-per-day in phase 4) |
| `87c80996` | `deo/ai-catchup-timing-fix` | 2026-05-11 | Staggered 5s + 12s catchup | Yes |
| `5a3dd0be` | `deo/ai-cancel-reschedule-policy` | 2026-05-11 | Reschedule + cancellation policy in prompt | Yes |
| `58bba382` | `deo/ai-multi-service-rule` | 2026-05-11 | Universal rule #11 (multi-service handling) | Yes — partial overlap; some text may simplify after phase 3 |
| `b0e1331c` | `deo/ai-merge-text-and-tool` | 2026-05-11 | Concatenate text block + tool reply_text | Yes — extended in phase 3 to handle multiple tool_use blocks |
| `4389952b` | `deo/ai-rule11-channel-guidance` | 2026-05-11 | Sharpened rule #11 two-channel guidance | Yes |
| `f9a14605` | `deo/ai-service-priority-rule` | 2026-05-11 | Universal rule #12 (service priority) | Yes — load-bearing for context-drift defense |

---

## Sign-off

Once this document is approved and the implementation phases are scoped to specific PRs, this file becomes the **source of truth** for the multi-service conversation architecture. Updates to the design should be committed as amendments to this file, with the change reflected in a "Revision History" section appended below.

### Revision History

| Date | Author | Change |
|---|---|---|
| 2026-05-11 | Deo + Claude | Initial draft |
