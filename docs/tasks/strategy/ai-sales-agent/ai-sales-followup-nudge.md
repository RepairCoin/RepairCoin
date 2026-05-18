# Strategy — AI Sales Follow-Up Nudge ("keep the sale alive")

**Status:** Draft — for review
**Created:** 2026-05-18
**Track:** AI Sales Agent
**Author:** Deo + Claude

---

## 1. Problem

The AI Sales Agent is **purely reactive** — it only ever speaks when the
customer sends a message (`AgentOrchestrator.handleCustomerMessage`). So a
very common, high-value moment is currently dropped on the floor:

> The AI proposes a booking slot (or answers the last question), the
> customer reads it… and then just goes quiet. Maybe they got distracted,
> maybe they're "thinking about it". The conversation dies. Nobody nudges.

A human salesperson would circle back ~20 minutes later — *"still want me to
lock in that Friday 2:30 slot?"* — and a meaningful share of those stalled
chats convert. The AI does nothing.

**Goal:** when a customer goes quiet mid-conversation, have the AI send
**one** friendly follow-up after a short delay to re-engage and keep the
sale alive.

---

## 2. Current behaviour (verified in code)

| Aspect | Where | Note |
|---|---|---|
| AI is reply-only | `AgentOrchestrator.handleCustomerMessage` | No method generates an AI turn without a customer message |
| AI messages without a customer trigger DO exist | `OrderConfirmationHandler`, `BookingConfirmationHandler` | But event-driven (order paid / completed), not time-driven |
| Scheduled-job pattern | `app.ts:743-841` | Backend registers `setInterval` services on startup — `SuspensionLiftService` every **15 min**, `AutoNoShowDetectionService` every **30 min**, others hourly. No node-cron for sub-hourly work; `setInterval` is the house pattern. |
| `AutoMessageSchedulerService` | hourly tick | Shop-configured broadcast/event messages — **hourly granularity, too coarse** for a 20-min nudge, and a different feature (shop marketing blasts, not per-conversation sales recovery) |
| Conversation recency | `conversations.last_message_at`, `status` ('open'/'resolved'), `ai_paused_until` | Enough to detect "customer quiet" without new columns |
| What the AI proposed | `messages.metadata.booking_suggestions` | Lets the follow-up reference the exact slot |

There is **no** time-triggered, per-conversation re-engagement path today.

---

## 3. Goal / non-goals

**Goal:** one automatic, friendly AI follow-up ~20 minutes after a customer
goes silent on an active sales conversation, respecting every guard the
normal AI reply respects.

**Non-goals (out of scope for v1):**
- Multi-step drip sequences ("nudge at 20 min, then next day, then in 3
  days"). v1 sends exactly **one** nudge per quiet episode.
- Re-engaging cold/dead conversations (quiet for hours/days) — that's a
  different "win-back" mechanism.
- Follow-ups for human-handled chats (a human took over → AI stays out).

---

## 4. Design decisions (pick before building)

### Decision A — Delay before the nudge

The ask was "15–30 min, whatever's recommended."

- **< 15 min** reads as instant/desperate — the customer barely had time to
  step away.
- **> 30 min** and the customer has context-switched; the intent's cold.

→ **Recommend 20 minutes**, stored as a per-shop setting
(`ai_followup_delay_minutes`, default 20) so shops can tune it. With a
5-minute detector tick, the nudge actually lands 20–25 min after silence.

### Decision B — What qualifies as a "quiet sales episode"

A conversation qualifies when ALL hold:
1. `status = 'open'` (not resolved).
2. The **last** non-deleted message is an **AI message**
   (`sender_type='shop'` AND `metadata.generated_by='ai_agent'`). If the
   last message is a *human* shop reply → a human is handling it → skip.
3. The customer has sent at least one message in the thread (they actually
   engaged — don't nudge a thread the customer never spoke in).
4. Time since that last AI message ≥ `ai_followup_delay_minutes`.
5. `ai_paused_until` is null or in the past (no human takeover).
6. No `ai_followup` message already exists after the last customer message
   (episode idempotency — see §6).
7. `last_message_at` is within the last **6 hours** (older = cold; not this
   feature's job).

**Open sub-decision B1 — booking-card-only vs any sales chat:**
- *Narrow:* only nudge when the last AI message carried a
  `booking_suggestions` card (highest, cleanest intent).
- *Broad (recommended):* nudge any qualifying conversation; the message
  *adapts* — if a booking card was the last thing, reference the slot;
  otherwise a softer "any other questions?" nudge.

Recommend **broad**, because "keep the sale alive" covers the customer who
asked about a service and vanished, not just the one who saw a slot.

### Decision C — Templated vs Claude-generated message

The whole point is to re-engage on the *specific* thing being discussed
("that Friday 2:30 slot", "the brake service you asked about"). A generic
"Hi, are you still there?" is weak.

→ **Recommend Claude Haiku**, tight token budget, one short message — same
pattern as `OrderConfirmationHandler`. It reads the conversation tail +
the proposed slot and writes a contextual, low-pressure nudge. Gated by the
shop spend cap (skip if over budget). Cost ≈ $0.0005 per nudge.

### Decision D — Quiet hours

A nudge at 3 AM shop-local is bad. The delay can elapse overnight.

→ **Recommend v1: skip** the nudge if the 20-min mark lands outside a
daytime window (e.g. 8 AM–9 PM in the **shop's** timezone — we already have
the shop-tz helpers from the booking timezone fix). A customer who went
quiet at 11 PM has cooled by morning anyway; a morning re-engage is a
different "next-day" message (future phase). Simple and safe.

### Decision E — Per-shop opt-out + lifetime cap

- New `ai_shop_settings.ai_followup_enabled` (**default ON** — it's a sales
  feature shops want — but one toggle to disable).
- **Lifetime cap:** at most **1 follow-up per quiet episode**, and a hard
  ceiling of **2 follow-ups per conversation per rolling 24h**, so a long
  back-and-forth thread can't turn into AI nagging.

---

## 5. Recommended approach

Two small pieces in `AIAgentDomain`, mirroring the existing handler pattern:

**1. `AISalesFollowUpDetector` (service)** — registered in `app.ts`
alongside the other `setInterval` services, ticking **every 5 minutes**.
Each tick:
- One indexed query over `conversations` (status='open',
  `ai_paused_until` null/past, `last_message_at` between
  `now - 6h` and `now - delay`).
- For each candidate, confirm the §4-B conditions against `messages`.
- For each that qualifies, call the handler.

**2. `AISalesFollowUpHandler` (service)** — given a `conversationId`:
- Re-check every guard (`AgentOrchestrator`'s set: service `aiSalesEnabled`,
  shop `ai_global_enabled`, **spend cap**, `ai_paused_until`) — state may
  have changed since the scan.
- Re-check episode idempotency + the 24h cap + quiet-hours.
- Build a tight context (recent messages + the proposed slot), call Claude
  **Haiku**, persist the reply with
  `metadata: { generated_by: 'ai_agent', source: 'ai_followup' }`.
- Audit-log the spend (`ai_agent_messages`), record spend, WS-broadcast
  `message:new` to customer + shop.
- Swallow all errors — a follow-up hiccup must never affect anything else.

No EventBus hop is needed (detector and handler both live in
`AIAgentDomain` — the detector calls the handler directly). No synthetic
event, unlike the order-paid/completed handlers whose events originate in
another domain.

This reuses `ContextBuilder` for the conversation tail and `SpendCapEnforcer`
/ `AuditLogger` exactly as `OrderConfirmationHandler` does.

---

## 6. Episode idempotency (no new column needed)

A "quiet episode" = a stretch where the last customer message is followed
only by AI/shop messages. The follow-up itself becomes an AI message — so
after sending, "last message is AI + customer quiet" is *still true* and a
naive detector would fire again next tick.

Guard: **skip if an `ai_followup`-sourced message already exists with
`created_at` greater than the last customer message's `created_at`.** When
the customer replies, that resets — the next silence is a fresh episode.

The 24h ceiling (Decision E) is a `COUNT(*)` of `source='ai_followup'`
messages in the conversation in the last 24h. Both checks are pure
`messages`-table queries — no schema change beyond the optional index on
`conversations(last_message_at)` for the detector scan, and the
`ai_shop_settings.ai_followup_enabled` / `ai_followup_delay_minutes`
columns.

---

## 7. Implementation phases

### Phase 1 — Settings
- Migration: `ai_shop_settings.ai_followup_enabled BOOLEAN DEFAULT TRUE`,
  `ai_followup_delay_minutes INT DEFAULT 20`.
- Optional index `conversations(last_message_at)` if not already present.
- Surface the toggle in the shop AI-settings UI (can be a fast follow).

### Phase 2 — `AISalesFollowUpHandler`
- New `AIAgentDomain/services/AISalesFollowUpHandler.ts`, modelled on
  `OrderConfirmationHandler`: all guards, Haiku call, persist + audit +
  spend record + WS broadcast, idempotency + 24h cap + quiet-hours checks.

### Phase 3 — `AISalesFollowUpDetector`
- New `AIAgentDomain/services/AISalesFollowUpDetector.ts` with
  `start(intervalMinutes)` / `stop()`.
- Register in `app.ts` next to the other scheduled services (5-min tick);
  add `.stop()` to the graceful-shutdown block.

### Phase 4 — Prompt
- A focused Haiku system prompt: ONE short, warm, low-pressure message;
  reference the proposed slot if there was one; soft CTA; no fake urgency,
  no repeating price/policy; never more than ~30 words.

### Phase 5 — Tests
- Detector: qualifies / disqualifies each §4-B condition.
- Handler: sends once, idempotent within an episode, respects 24h cap,
  skips on every guard (kill-switch, spend cap, `ai_paused_until`,
  quiet-hours), swallows errors.
- `tsc` + ai-agent jest suite.

---

## 8. Edge cases & failure modes

| Case | Handling |
|---|---|
| Human takes over (`ai_paused_until` set) between scan and send | Handler re-checks `ai_paused_until` immediately before sending → skip |
| Customer replies between scan and send | Handler re-checks last-message identity → the episode ended → skip |
| Customer **booked** (order placed) | `BookingConfirmationHandler` posts a `booking_confirmed` message; detector skips conversations whose last AI message is `source='booking_confirmed'`, and skips if an order exists for the conversation |
| Conversation resolved | `status != 'open'` → not a candidate |
| Shop AI globally off / shop disabled follow-ups | Guard check → skip |
| Spend cap exceeded | Skip (consistent with `AgentOrchestrator`) — no nudge rather than an unbudgeted call |
| Delay elapses overnight | Quiet-hours check → skip for v1 (Decision D) |
| Customer never spoke (AI greeted, silence) | §4-B condition 3 → skip; don't nudge a one-sided thread |
| Long haggling thread, many quiet gaps | 1 per episode + 2-per-24h ceiling caps the nagging |
| Detector overlaps with a slow tick | Detector runs are idempotent (episode guard); a missed/late tick just delays a nudge, never duplicates |

---

## 9. Rollback

- Fully additive. `ai_followup_enabled` defaults can ship as **FALSE** for a
  staged rollout (enable per shop, watch, then flip the default).
- Not registering the detector in `app.ts` disables the feature entirely
  with zero effect on anything else.
- Env flag `AI_FOLLOWUP_ENABLED` as a global kill-switch.

---

## 10. Open questions for review

1. Decision A — confirm **20 min** (or pick within 15–30).
2. Decision B1 — **broad** (any quiet sales chat) or **narrow** (only when a
   booking card was offered)?
3. Decision D — v1 **skip** outside quiet hours, or attempt a next-morning
   nudge now?
4. Decision E — ship `ai_followup_enabled` default **ON** or **OFF** (staged
   rollout)?
5. Should a customer who explicitly said "let me think about it" be
   excluded? (Could be a future refinement — detect that intent and either
   skip or delay longer.)
