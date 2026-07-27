# QA Guide — AI Campaigns (Advanced) [Business tier]

How to test AI Campaigns (Advanced) end-to-end on staging. Covers the tier gate (Phase 1), AI-drafted copy +
Marketing-tab hub + autonomous triggers (Phase 2), drip sequences (Phase 3), and A/B testing (Phase 4).

Related: `implementation-plan.md`. Feature gate: `aiCampaignsAdvanced` (Business), enforced behind the flag
`ENFORCE_CAMPAIGN_AUTOMATION_TIER`.

---

## 0. How it works (30-second version)

The shop **Auto-Messages** engine (scheduled + event-triggered automated messages) IS "AI Campaigns
(Advanced)". It lives at **Marketing tab → "AI Campaigns" sub-tab**, and is a Business-tier feature. A rule
can be a single message, a **drip sequence** (multiple messages over time), or an **A/B test** (two versions,
split 50/50). The AI can draft any of the copy. Rules fire on a scheduler (hourly) / on real events — they
are NOT instant, which is why behavior tests (§4) are driven via a script rather than by waiting.

**Prereqs:** a **Business** shop (peanut is Business on staging). The tier-enforcement flag
`ENFORCE_CAMPAIGN_AUTOMATION_TIER` defaults **off** — the UI is visible to all tiers until it's flipped on.

---

## 1. The gate / where it lives (UI)

1. Log in as a **Business** shop → **Marketing** tab → the **"AI Campaigns"** sub-tab is present (alongside
   Campaigns + Contacts).
2. It should NOT appear under the **Messages** tab (Auto-Messages was relocated here in Phase 2 Slice B).
3. `New Rule` opens the rule editor.

---

## 2. Test A — AI-drafted copy + creation (UI)

In **Marketing → AI Campaigns → New Rule**:
1. Set a **trigger** (e.g. *Booking Completed*) + an **audience**.
2. Click **"Generate with AI"** → the message field fills with on-brand copy using the supported
   `{{customerName}}` / `{{shopName}}` / `{{rcnBalance}}` / `{{lastServiceName}}` / `{{lastVisitDate}}`
   placeholders, plain text.
3. Save → the rule appears in the list. Toggle it active/inactive; edit; delete.

**Autonomous triggers to create:** an event rule (*Booking Completed* / *First Visit* / *Inactive 30 Days* /
*Booking Cancelled*) and a **"Slow Week (low bookings)"** rule.

---

## 3. Test B — drip sequences + A/B (UI creation)

**Drip (event triggers only):**
1. On an *event* rule, tick **"Multi-step sequence (drip)"**.
2. Add 2–3 **steps**; for each set the message (or **AI** button per step) and **"Wait N hours"**.
3. Tick **"Stop the sequence if the customer books"** (optional). Save.

**A/B (any single-message rule):**
1. Tick **"A/B test"** (this hides the sequence toggle — they're mutually exclusive).
2. Fill **Variant A** and **Variant B** (or **Generate with AI** for B). Save.
3. Re-open the rule → a **"Results so far"** panel shows per-variant sent/booked once sends exist (§4).

Confirm you **cannot** enable both drip and A/B on the same rule.

---

## 4. Test C — behavior / firing (script-driven, staging)

Rules fire on the hourly scheduler / real events, so drive them with a script against staging (the exact
approach used to build + verify the feature). Connect a throwaway script via the discrete `DB_*` vars + SSL
(see `reference_oneoff_db_script_connection`), import `autoMessageSchedulerService` +
`AutoMessageRepository`, and:

- **Event fire** — `autoMessageSchedulerService.handleEventTrigger('booking_completed', { shopId, customerAddress, orderId })`
  then `await autoMessageSchedulerService.processScheduledMessages()`. Verify a shop message landed in the
  customer's conversation and a row exists in `auto_message_sends`.
- **Drip** — create a sequence rule (steps with `delayHours: 0` for a fast test), fire the event to enrol,
  then call `processScheduledMessages()` ~4× → the 3 step messages appear **in order** in the conversation.
  With `stop_on_booking` on, insert a completed `service_orders` row for the customer after enrolment → the
  sequence ends without sending the remaining steps.
- **Slow week** — create a `low_bookings` rule; it fires only when the shop's last-7-days bookings are
  < 50% of its trailing 4-week weekly average (baseline ≥ 4 prior bookings). Seed `service_orders` to create
  that dip, then `processScheduledMessages()`.
- **A/B** — create an A/B rule (event, `delayHours: 0`), fire the event for ~6 test customers → sends split
  ~50/50 A/B in `auto_message_sends.variant`; `repo.getAbResults(ruleId)` returns per-variant sends +
  conversions (a "conversion" = the customer completed a booking within 7 days after the send — an
  **indicator, not proof**).

### ⚠️ Seeding rules — read before running any of the above

The first QA run (2026-07-21) got both of these wrong. Don't repeat them.

1. **Never let the seed resolve the shop's real customers.** `getTargetCustomers()` returns live customers
   for the shop, so a rule fired against `peanut` reaches real staging customers. Pass your fake addresses
   explicitly and assert the target list contains nothing else before sending. The first run leaked a drip
   step into a real customer's thread (Qua Ting / peanut).
2. **Cleanup must restore `conversations.last_message_preview`, not just delete rows.** The preview is
   denormalized — deleting a message leaves the inbox list advertising a message the thread no longer has.
   After deleting test messages, repoint the preview at the newest surviving message (or `NULL` if none):

   ```sql
   UPDATE conversations c
      SET last_message_preview = LEFT(m.message_text, 100), last_message_at = m.created_at
     FROM (SELECT message_text, created_at FROM messages
            WHERE conversation_id = $1 AND is_deleted = FALSE
            ORDER BY created_at DESC LIMIT 1) m
    WHERE c.conversation_id = $1;
   ```

**Step copy is a label, not a feature.** The drip seed writes literal `Step 1: …` / `Step 2: …` bodies so
ordering is verifiable at a glance. Nothing in the product prefixes messages that way — if you see `Step N`
in a real inbox, it is leaked test data.

**Cleanup checklist:** demo rules → their `auto_message_sends` (FK: sends must go first) → test messages →
FK children of `conversations` (`ai_agent_messages`, `conversation_channel_identities`) → test conversations
→ repair previews. Use clearly-fake addresses (`0x…ab001`…) so no real customer's thread is touched, then
verify zero leftovers:

```sql
SELECT COUNT(*) FROM messages      WHERE message_text ~* '(^|[^a-z])step [0-9]';
SELECT COUNT(*) FROM conversations WHERE last_message_preview ~* '(^|[^a-z])step [0-9]';
```

**Verified live on staging 2026-07-21 (peanut):** drip advanced through all 3 steps in order; A/B split
across variants (A/B) with per-variant results aggregated; all firing paths ran clean. **Cleanup was
incomplete and was finished 2026-07-22** — 7 test conversations (19 messages), the `Sample — Booking Thank
You` rule + its send, and one corrupted real-customer preview were removed; leftover counts now zero.

---

## 5. Test D — the tier gate (Phase 1)

The gate is flag-gated so it can be enforced deliberately.
1. Set **`ENFORCE_CAMPAIGN_AUTOMATION_TIER=true`** on the backend + redeploy.
2. Log in as a **Growth or Starter** shop → the **AI Campaigns** section shows the **upgrade lock**
   (`<TierGate>`), and the `/api/messages/auto-messages*` endpoints return **403** (`FEATURE_NOT_IN_TIER`).
3. A **Business** shop still has full access.
4. Flip the flag back **off** when done (the feature returns to open-to-all).

**Rollout note:** flipping the flag on removes auto-message access from any Starter/Growth shop that already
has rules — notify them first. On staging the impact is ~zero (the only auto-message users are Business).

---

## Quick reference

- **Where:** Marketing tab → "AI Campaigns" sub-tab (Business).
- **Flag:** `ENFORCE_CAMPAIGN_AUTOMATION_TIER` (default off = open to all; true = Business-only).
- **Tables:** `shop_auto_messages` (rules: `steps` JSONB, `stop_on_booking`, `variant_b`),
  `auto_message_sends` (`step_index`, `variant`), `service_orders` (bookings — drip/slow-week/A/B signals).
- **Endpoints:** `/api/messages/auto-messages` (CRUD), `.../generate` (AI copy), `.../:id/ab-results`,
  `.../:id/history` — all Business-gated by `autoMessageGuard`.
- **Scheduler:** `AutoMessageSchedulerService` (hourly): `handleEventTrigger`, `processScheduledMessages`
  (pending queue + `processInactiveCustomers` + `processLowBookings`).
- **Migrations:** 232 (`steps`/`stop_on_booking`/`step_index`), 233 (`variant_b`/`variant`).
