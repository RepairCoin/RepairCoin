# AI Sales Agent — Status

_Last updated: 2026-05-14_

This doc is the running status of in-flight AI Sales Agent work. Update it when the situation changes so a fresh Claude session (or anyone picking up the thread) can resume without re-discovering state.

---

## Snapshot

| Workstream | Branch | Status |
|---|---|---|
| Multi-turn topic drift + duplicate-card fixes | `deo/ai-mike-tool-overeager-fix` | ✅ Merged (PR #347, commit `7c62c76b`) — live on staging |
| Menu-item FAQ surfacing | `deo/ai-menu-item-faq` | ✅ Merged (PR #348, merge commit `547b1b26`) — deployed on staging 2026-05-13 evening |
| "Currently discussing" chip dynamic update | `deo/ai-menu-item-faq` (extended) | 🟡 Implemented locally — stamps `discussed_service_id`/`discussed_service_name` on every AI message; chip reads latest AI message's value with prop fallback. 10 unit tests passing. Not yet committed. |
| Slot-taken explicit awareness | — | ⏸ Parked (current "closest available" UX is acceptable) |

---

## What's Live on Staging (post-PR #347 merge)

### Same-slot loop guard (structural)
Drops any `(serviceId, slotIso)` Claude re-proposes when the previous AI turn already proposed it. Unconditional, no customer-wording dependency. The prior tap card from the previous turn is still visible and tappable, so a second identical card adds nothing.

### Expanded NO-CALL prompt triggers (categorical)
Flipped the tool description default from "when in doubt, call" to "when in doubt, don't call". Added explicit categories: closing/gratitude, shop-scope catalog questions, off-topic/nonsense, deferrals/negations. Claude reasons by category, not literal phrase match — generalizes to phrasings we didn't enumerate.

### Cross-service offer follow-up detector
When the AI's prior turn (same anchor) offered a non-focused service ("the Newly Baker tutorial is one of our services — want a slot?") and the customer's current message names no service, the orchestrator:
- Skips the focused-default slot filter so the offered service's slots stay in the tool enum
- Replaces the active-topic anchor reminder with a cross-service-offer reminder pointing at the offered service

This lets Claude book what it just offered without the customer having to name it explicitly. The detector compares the prior AI turn's `metadata.anchor_service_id` to the current focused serviceId to distinguish in-thread upsell from anchor-switch.

### Anchor metadata stamping
Every AI message now stamps `metadata.anchor_service_id` so future turns can read which anchor the previous turn was operating under. Legacy fallback infers from `booking_suggestions[0].serviceId` when present and unambiguous.

### Near-duplicate text-block suppression
Jaccard-style token-overlap check (≥70% of significant tokens after lowercase + punctuation strip + length filter) drops the free-text block Claude sometimes emits alongside a tool_use whose reply_text says the same thing in slightly different words. Catches the "closest match" vs "closest we've got" failure mode from `sc1.png` without suppressing legitimate multi-service combinations.

### Message metadata plumbing
`AgentMessageContext.metadata` carries through from DB to the orchestrator. Used by the loop guard (read prior `booking_suggestions`) and the cross-service detector (read prior `anchor_service_id`). Strictly internal — never sent to Anthropic.

**Tests:** 30 new unit tests on `deo/ai-mike-tool-overeager-fix`. Full ai-agent suite 409 passing post-merge.

---

## Shipped: Menu-Item FAQ Surfacing

**Branch:** `deo/ai-menu-item-faq` (commit `1d9e2d26`)
**PR:** [#348](https://github.com/RepairCoin/RepairCoin/pull/348) — merged 2026-05-13 15:47 UTC, merge commit `547b1b26`
**Deploy:** Staging redeployed evening of 2026-05-13 (user-confirmed)

### Bug being fixed
When a customer asked about a non-focused service ("what's included in Newly Baker?") on an anchored chat (anchor: I Robot), the AI replied **"I only have full FAQ info for I Robot here"** even though Newly Baker's 7 seeded FAQ rows existed in the DB. Root cause: `ContextBuilder` only fetched FAQ entries for the focused service. Non-focused menu items reached the prompt with name/price/duration/short-blurb but no Q&A detail.

### Changes
- `types.ts` — `AgentShopServiceMenuItem.faqEntries: AgentServiceFaqEntry[]` (required field)
- `ContextBuilder.fetchShopServiceMenu` — hydrates each menu item's FAQ via `faqRepo.getEntriesForService(...)` in parallel; per-service failures swallowed (empty FAQ for that item, partner still renders)
- `PromptTemplates.renderMenuItemFaqBlock` — nested "FAQ for {serviceName}:" block rendered under each menu line when entries exist; empty entries → no block (clean render)
- `MAX_MENU_ITEM_FAQ_BLOCK_CHARS = 1500` — per-item cap (tighter than the focused service's 4000) to bound prompt growth on shops with many services × verbose FAQs
- Test fixtures across `PromptTemplates.test.ts` updated with `faqEntries: []` on every existing `shopServiceMenu` entry (new required field)

**Tests:** 8 new tests; full ai-agent suite 417 passing on this branch.

### Next steps
1. ✅ Open the PR — #348
2. ✅ Merge to main — `547b1b26`
3. ✅ DO redeploy — done evening of 2026-05-13
4. ⏭️ Re-test on staging: bread → Newly Baker → "what's included?" should now cite actual seeded FAQ entries (Peanut ↔ `0x6cd0…3Cf` conversation cleared 2026-05-14 for a fresh run)

---

## Database State (staging DigitalOcean)

### Seeded FAQ rows
- **AQua Tech** (`srv_0cbf21d2-5095-4dea-af7d-c7a9be1df637`) — 7 entries via `backend/scripts/seed-aqua-tech-faq.ts`. Topics: what's included, what's NOT included, appointment duration, data safety, what to bring, supported brands + OS, warranty + cancellation. ~1,991 chars total.
- **Newly Baker** (`srv_b294a818-1938-4a0f-9565-de82bd7a2bf7`) — 7 entries via `backend/scripts/seed-newly-baker-faq.ts`. Topics: what's included, what's NOT included, session length, allergies/dietary, what to bring, children + age minimum, cancellation policy. ~1,935 chars total.
- **I Robot** — 7 entries previously seeded in earlier session (`backend/scripts/seed-i-robot-faq.ts`). Style baseline for the other two.

Seed scripts are idempotent — re-run after editing the `ENTRIES` array to update.

### Conversation cleared
- **Qua Ting / Peanut** (`conv_1778475156978_w09ibywla`) — 145 messages soft-deleted via `backend/scripts/clear-qua-ting-peanut-conversation.ts`. Conversation row preserved; unread counts + `last_message_preview` reset. Rollback command printed in the script's output if needed.

---

## Deferred / Parked

### "Currently discussing" chip dynamic update
**Status:** Implementation landed on `deo/ai-menu-item-faq` (uncommitted). Reproduced live on staging 2026-05-14 (Peanut/Qua Ting drifted AQua Tech → I Robot; chip stayed on AQua Tech). Implemented Option A resolver:

1. Tool call → first booking suggestion's serviceId
2. Single-service text mention → that service
3. Multi-mention or no signal → carry forward previous AI turn's `discussed_service_id`
4. Empty history → fall back to anchor

Backend stamps both `discussed_service_id` and `discussed_service_name` on each AI message (`AgentOrchestrator.resolveDiscussedServiceId`). Frontend chip in `ConversationThread.tsx` reads the latest AI message's name with `serviceName` prop as fallback (covers pre-deploy data + first turns). 10 new unit tests passing locally.

### Slot-taken explicit awareness
Currently `AvailabilityFetcher` filters booked slots before Claude sees them, so the AI can say "closest available is 9:30 AM" but can't say "9 AM was just booked — try another time". User decided current behavior is good enough.

**If we do it later:**
- **Option 1 (cheap, ~30 min):** Surface a short "Booked today: 10 AM, 11:30 AM, 2 PM" list to the prompt. Claude pattern-matches the customer's requested time against it and explicitly says "10 AM was booked, try 9:30 AM or 12 PM."
- **Option 2 (richer):** Per-slot status `{ slotIso, reason: "booked" | "outside_hours" | "in_break" }` so Claude can give precise per-reason responses. Requires changes to `AppointmentService.getAvailableTimeSlots`.

---

## Diagnostics & Helper Scripts (untracked, in `backend/scripts/`)

These were created during investigation and are not committed (consistent with how prior diagnostic scripts in this dir are handled). They're useful if/when re-investigating similar issues:

- `find-qua-ting-conversations.ts` — list all of Qua Ting's conversations across shops
- `read-latest-qua-ting-tail.ts` — last 20 alive messages + last 5 audit rows on the Qua Ting/Peanut conversation
- `diagnose-topic-loss-6-05.ts` — pulls raw rows + metadata around a specific timestamp; used to trace the 06:05 UTC bug
- `trace-detect-cross-service.ts` — runs my `detectCrossServiceOfferFollowUp` logic against real DB data inline (bypasses side-effect repo imports) — useful for verifying detector behavior on production data without touching the orchestrator
- `check-post-merge-turns.ts` — pulls messages + audit rows on a conversation after a given timestamp; useful for verifying behavior after a deploy lands
- `inspect-aqua-tech-and-faq.ts` — shows AQua Tech's service row + existing FAQ for FAQ seeding style-match
- `clear-qua-ting-peanut-conversation.ts` — soft-deletes all messages in a conversation; reversible via the rollback command it prints
- `seed-aqua-tech-faq.ts`, `seed-newly-baker-faq.ts` — idempotent FAQ seeders

---

## Verification Checklist (for next session)

After the `deo/ai-menu-item-faq` PR merges + DO redeploys, run these on staging:

1. **FAQ surfacing fix:**
   - Open a fresh Qua Ting/Peanut chat anchored to I Robot
   - Customer: "do you sell bread?" → expect AI to mention Newly Baker
   - Customer: "what's included in Newly Baker?" → expect AI to cite actual seeded FAQ (ingredients, take-home bake, session menu items) NOT "I only have FAQ for I Robot here"

2. **Cross-service offer (regression check from PR #347):**
   - Same setup
   - After AI offers Newly Baker, customer: "yes please"
   - Expect: a Newly Baker tap card (not an I Robot card, not a teammate-handoff fallback)

3. **Same-slot loop guard (regression check from PR #347):**
   - Get the AI to propose a specific slot
   - Customer: "thank u" or "what u sell" or other non-acceptance reply
   - Expect: text reply, NO duplicate tap card

4. **Anchor stay (regression check):**
   - Open a fresh chat anchored to Service A
   - Customer: "what's the price?" (no service named)
   - Expect: A's price, not B's even if B was discussed in history

---

## Key Files Touched (this session)

### Production code
- `backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts`
- `backend/src/domains/AIAgentDomain/services/ContextBuilder.ts`
- `backend/src/domains/AIAgentDomain/services/PromptTemplates.ts`
- `backend/src/domains/AIAgentDomain/types.ts`

### Tests
- `backend/tests/ai-agent/AgentOrchestrator.test.ts`
- `backend/tests/ai-agent/ContextBuilder.test.ts`
- `backend/tests/ai-agent/PromptTemplates.test.ts`
