# QA Test Guide — AI Sales Follow-Up Nudge

**Feature:** When a customer goes quiet mid-conversation with the AI Sales
Agent, the AI sends **one** friendly follow-up message after a delay to
re-engage them.
**Strategy doc:** `docs/tasks/strategy/ai-sales-agent/ai-sales-followup-nudge.md`

---

## 1. One-time setup (DEV — not QA)

These steps need DB access and are done **once** by a developer before QA
starts. QA's own test steps (Section 3) are **UI only — no queries**.

```sql
-- Enable the feature for the test shop (it ships OFF — staged rollout).
UPDATE ai_shop_settings SET ai_followup_enabled = TRUE  WHERE shop_id = 'peanut';

-- Use the minimum sensible delay so QA waits ~15-20 min, not 20-25.
UPDATE ai_shop_settings SET ai_followup_delay_minutes = 15 WHERE shop_id = 'peanut';
```

Also confirm (should already be true — Peanut has been used for AI testing):
- `ai_shop_settings.ai_global_enabled = TRUE` for `peanut`
- The service being chatted about has AI selling enabled
- The backend is running the build that includes this feature
- `AI_FOLLOWUP_ENABLED` is **not** set to `false` in the environment

---

## 2. Timing — what to expect

- The follow-up is **not instant**. A background detector scans every
  **5 minutes**, and only picks up conversations that have been quiet for
  at least **15 minutes**.
- So after the customer goes silent, the follow-up arrives roughly
  **15–20 minutes later** (15-min minimum + up to 5 min for the next scan).
- **Shop daytime window:** follow-ups are only sent between **8 AM and
  9 PM in the SHOP's timezone**. Peanut is `America/New_York` (Eastern).
  - In Philippine time that window is roughly **8 PM → 9 AM**.
  - ⚠️ If QA tests during PH daytime (9 AM–8 PM), it is *night* at the
    shop and **no follow-up will be sent** — this is correct behavior, not
    a bug. Test in the PH evening / early morning.

---

## 3. QA test cases (UI only)

Use the test customer (Qua Ting) and shop (Peanut). "Customer side" = the
customer chat; "Shop side" = the shop dashboard Messages tab.

### TC1 — Happy path: the follow-up fires ✅
1. As the customer, open a chat with Peanut and ask about a service
   (e.g. "do you have any slots this week?").
2. Wait for the AI to reply (it may include a booking card).
3. **Do not reply.** Leave the conversation idle.
4. Wait ~15–20 minutes.
5. **Expected:** a new AI message appears in the chat — a short, friendly
   follow-up that references what was being discussed
   (e.g. *"Hi Qua Ting — still want me to lock in that Friday slot? 😊"*).
   It should appear live (or on refresh) on **both** the customer and shop
   sides, styled as an AI message.

### TC2 — Only ONE follow-up per quiet period ✅
1. After TC1's follow-up appears, keep **not replying**.
2. Wait another 15–20 minutes.
3. **Expected:** **no second follow-up.** The AI nudges once per quiet
   episode, not repeatedly.

### TC3 — Customer replies → no follow-up ✅
1. Fresh chat: customer asks something, AI replies.
2. The customer **replies again** within a few minutes.
3. Wait ~20 minutes.
4. **Expected:** no follow-up — the customer is engaged, nothing to chase.

### TC4 — Human takeover suppresses the follow-up ✅
1. Customer asks something, AI replies, customer goes quiet.
2. On the **shop side**, click **"Take Over"** on that conversation.
3. Wait ~20 minutes.
4. **Expected:** no AI follow-up — a human is handling the conversation.

### TC5 — Customer booked → no follow-up ✅
1. Customer chats, AI proposes a slot, customer taps the booking card and
   completes payment.
2. **Expected:** the "your appointment is confirmed" message appears, but
   **no follow-up nudge** afterward.

### TC6 — Disabled shop → no follow-up ✅
1. On a *different* shop that still has `ai_followup_enabled = FALSE`,
   repeat TC1.
2. **Expected:** no follow-up — the feature is off for that shop.

---

## 4. Acceptance criteria

- [ ] TC1: exactly one follow-up arrives ~15–20 min after the customer
      goes quiet, during shop daytime hours.
- [ ] The follow-up is contextual (mentions the service / proposed slot),
      short, friendly, and **not** pushy.
- [ ] It renders as an AI message on both customer and shop sides.
- [ ] TC2–TC6: **no** follow-up is sent in any of those scenarios.

---

## 5. Repeating tests / reset

- Episode rule: the AI sends one follow-up per "quiet episode". When the
  customer sends a new message, a new episode can start.
- A hard cap of **2 follow-ups per conversation per 24 hours** applies — so
  on one conversation QA gets ~2 happy-path cycles per day.
- For a clean slate (more cycles, or a fresh thread), ask a developer to
  clear the test conversation, or use a different test customer.

---

## 6. Troubleshooting — "I don't see a follow-up"

Check, in order:

1. **Time of day** — is it 8 AM–9 PM *Eastern* right now? (PH evening /
   early morning.) Outside that window the nudge is intentionally skipped.
2. **Waited long enough?** Minimum ~15 min quiet + up to 5 min for the next
   detector scan. Give it a full 20 minutes.
3. **Did the customer reply?** Any customer message ends the episode.
4. **Was the conversation taken over** by a human, or marked resolved?
5. **Setup applied?** `ai_followup_enabled = TRUE` and
   `ai_global_enabled = TRUE` for the shop; backend running the new build.
6. **Already nudged?** One per episode; 2 per 24h max — check if a
   follow-up already went out earlier.
7. Backend logs show detector activity — search for
   `AISalesFollowUpDetector` and `AISalesFollowUpHandler` lines.
