# QA Test Guide — AI Marketing Assistant

Manual verification steps for the v1 AI Marketing surface (Phases 1-3).

**Prerequisites:**
- Logged in as the test shop (`peanut` by default)
- Seeded data via `qa-fixtures/setup-marketing-fixtures.ts`
- Spend cap + daily drafts counters reset (`reset-spend-cap.ts` + `reset-daily-drafts.ts`)
- `ANTHROPIC_API_KEY` set in backend `.env`

**How to open the panel:** Tap the **Megaphone** icon in the top-right action cluster of the shop dashboard (sits next to the BarChart3 Insights icon).

For each scenario: note **PASS** or **FAIL** + a one-line observation. If you fail a scenario, capture the AI's actual reply text + the tool_calls JSON in `ai_marketing_messages.tool_calls` for the latest row.

---

## §1 — Top-spenders flow

**Goal:** AI resolves "top N by spend" to the existing `top_spenders` segment, drafts an announcement, persists it as a draft, and surfaces the review modal on tap.

**Steps:**
1. In the chat panel, type: `Tell my top 50 customers about our new pastry tutorial`
2. Hit Send.
3. Observe the AI's response:
   - Prose: brief 2-3 sentences ("Drafted a campaign for your top 50 customers — tap to preview.")
   - First inline card: `audience_summary` showing **2 customers** (top 20%) with the label "Top 50 by spend" OR "Top spenders" + sample names "QA-MKTG-Whale Alice", "QA-MKTG-Regular Bob"
   - Second inline card: `campaign_draft` with a subject + body preview + "Email · 2 recipients (Top 50 by spend)" footer
4. Tap the `campaign_draft` card → review modal opens.
5. Modal shows:
   - Audience strip: "2 recipients" + label
   - Subject input (editable)
   - Body textarea (editable, multi-paragraph) with a note about edits not yet persisting
   - Red "Send 2 emails" button + Cancel
6. Tap Cancel → modal closes, card unchanged.

**Pass criteria:**
- ✅ AI resolved "top 50" to 2 customers (literal-match constraint from prompt rule 5 — doesn't expand to all 10).
- ✅ Both cards rendered; no duplicate prose listing the chip text.
- ✅ Modal shows editable subject + body.
- ✅ No discount-value hallucination — body doesn't claim a specific % or $ amount unless you asked for one.

---

## §2 — Lapsed (win-back) flow

**Goal:** AI uses the new `minDaysSinceLastVisit` filter from Phase 1 for the lapsed segment.

**Steps:**
1. Type: `Bring back customers who haven't booked in 90 days`
2. Hit Send.
3. Observe:
   - `audience_summary` shows **3 customers** (Frank, Grace, Henry) with label like "Customers who haven't booked in 90+ days"
   - `campaign_draft` with a win-back tone subject (e.g., "We miss you at {shop}") and body acknowledging the gap without guilt-tripping
4. Open modal, scan body content.

**Pass criteria:**
- ✅ Audience count = 3 (matches the 3 lapsed customers seeded).
- ✅ Tone is warm/sincere, not desperate or guilt-trippy (scaffold tone hint from `templateScaffolds.ts:win_back`).
- ✅ Subject doesn't promise a specific discount unless you stated one.

---

## §3 — Black Friday flow (recognized category, free-form offer)

**Goal:** Category detection picks up "Black Friday" → uses the `black_friday` scaffold. All-customers segment.

**Steps:**
1. Type: `Make a Black Friday campaign — 20% off all services this weekend`
2. Hit Send.
3. Observe:
   - `audience_summary` shows **10 customers** (all of them) with label like "All customers"
   - `campaign_draft` with a Black Friday subject (🛍️ or "Black Friday at {shop}" pattern)
   - Body should mention "20% off" since you explicitly stated it. Verify the percentage matches what you typed — AI should NOT fabricate a different number.
4. Open modal.

**Pass criteria:**
- ✅ Audience = 10 (all customers).
- ✅ Subject uses Black Friday scaffold pattern.
- ✅ Body echoes "20% off" exactly (or "20 percent off") — NOT "25% off" or some other number.
- ✅ Deadline is mentioned (urgency is part of the scaffold).

**Variation — anti-hallucination check:** Re-run with just `Make a Black Friday campaign` (no discount stated). Body should contain `(your offer here)` or similar placeholder — NOT a hallucinated percentage.

---

## §4 — Free-draft flow (novel category)

**Goal:** Verify that asks not matching any of the 4 scaffolds still produce a sensible draft (free-draft path).

**Steps:**
1. Type: `Send a campaign about our new puppy training class on Saturday mornings`
2. Hit Send.
3. Observe:
   - `audience_summary` with all_customers (default for shop-wide announcements)
   - `campaign_draft` with subject mentioning the puppy training class
   - Body should be cohesive (intro → benefit → CTA) even though no scaffold applies

**Pass criteria:**
- ✅ AI didn't refuse just because no scaffold matched (prompt rule 1).
- ✅ Body references the shop's services where relevant (context block working).
- ✅ Subject is not a generic template echo — should be specific to "puppy training class".

---

## §5 — Validation guards

### §5.1 — Empty audience

**Steps:** Sign in as a shop with ZERO customers seeded. Type `Send a Black Friday campaign`.

**Pass criteria:**
- ✅ AI either calls `lookup_audience_count` and refuses to draft (says count is 0), OR `propose_campaign_draft` errors with "resolved audience is empty" and the AI gracefully explains.

### §5.2 — Discount hallucination guard

**Steps:** With seeded shop, type `Make a Black Friday campaign` (no offer stated).

**Pass criteria:**
- ✅ Body contains a placeholder marker like `(your offer here)`, `(your discount here)`, or similar parenthetical. 
- ❌ Body does NOT claim a specific % off, $ off, or "limited-time pricing" with concrete numbers.

### §5.3 — Daily drafts cap (50/day)

**Steps:** 
- Quickly fire ~50 different draft requests. Use this loop in a separate terminal:
  ```bash
  for i in {1..52}; do
    curl -X POST http://localhost:4000/api/ai/marketing-chat \
      -H "Authorization: Bearer <shop-jwt>" \
      -H "Content-Type: application/json" \
      -d "{\"sessionId\":\"qa-cap-$i\",\"messages\":[{\"role\":\"user\",\"content\":\"Draft a weekend special $i\"}]}"
  done
  ```
- (Real shops would never hit this — anti-spam ceiling.)

**Pass criteria:**
- ✅ Around request 51 or 52, response is 429 with body `{ "error": "Daily AI campaign draft limit reached (50). ..." }`.
- ✅ Run `reset-daily-drafts.ts` and the next request succeeds normally.

### §5.4 — Send without draft

**Steps:** Open a fresh panel session. Type `Send the campaign`.

**Pass criteria:**
- ✅ AI does NOT call `propose_campaign_send`. Either asks what to send (most likely — prompt rule 6), or calls `propose_campaign_draft` first.

---

## §6 — UI confirmation states

> Note: original impl-doc Phase 4 was a backend `CampaignSentConfirmationHandler` that posts an auto-message into the chat thread. That was skipped (see implementation.md §5 Phase 4 SKIPPED note). The confirmation now lives entirely in the frontend.

### §6.1 — Modal → Sent transition

**Steps:**
1. Run §1 to get a `campaign_draft` card.
2. Tap the card → modal opens.
3. Tap **Send 2 emails** (red button).

**Pass criteria:**
- ✅ Button shows "Sending…" with a spinner.
- ✅ Modal closes on success.
- ✅ The original `campaign_draft` card in the chat transitions to an **emerald** colored "Sent" state showing recipient count.
- ✅ Second tap is impossible (state machine in `CampaignDraftCard` — `sentAt` set prevents re-open).

### §6.2 — Modal error path

**Steps:** With Stripe/SendGrid down (or test by temporarily blocking the `/marketing/campaigns/:id/send` endpoint), tap Send.

**Pass criteria:**
- ✅ Red error banner inside the modal with the server's error message.
- ✅ Button returns to "Send N emails" state — user can retry without reopening.

---

## §7 — Compliance footer

**Goal:** Confirm AI-drafted emails inherit the existing `CampaignEmailService` unsubscribe footer.

**Steps:**
1. Run §3 (Black Friday).
2. Tap Send in the modal.
3. Open the SendGrid dashboard (or check the email-render preview if you have one).
4. View the raw HTML of one of the queued emails.

**Pass criteria:**
- ✅ Email contains `<a href="#">Unsubscribe</a>` (or the configured unsubscribe link) in the footer.
- ✅ Footer line: `You received this email because you are a customer of {shop}.`
- ✅ The AI-drafted body did NOT include its own unsubscribe link (prompt rule baked into `templateScaffolds.ts` says "DO NOT include an unsubscribe footer — the email template adds it automatically").

If the seeded customers use `@repaircoin.test` emails (default), SendGrid will fail delivery — that's expected. Inspect the rendered HTML from SendGrid's "preview" or "raw payload" view rather than waiting for delivery.

---

## §8 — Cost calibration

**Goal:** Establish a per-flow token + dollar baseline so Phase 6 cost monitoring has a reference.

**Steps:** For each of §1-§4 above, after the flow completes, query the audit log:

```sql
SELECT
  created_at,
  model,
  input_tokens,
  output_tokens,
  cached_input_tokens,
  cost_usd,
  latency_ms,
  jsonb_array_length(tool_calls) AS tool_count
FROM ai_marketing_messages
WHERE shop_id = 'peanut'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Pass criteria (rough budgets — adjust after empirical observation):**
- ✅ Single-turn cost per flow: **< $0.10** (target ~$0.03–$0.05)
- ✅ Cached input tokens ratio > 0 on the 2nd turn onward (system prompt cache hits)
- ✅ Latency: < 8s for the full agent loop end-to-end

**Record per flow:**

| Flow | Input tokens | Output tokens | Cost (USD) | Latency (ms) | Tool count |
|---|---|---|---|---|---|
| §1 Top spenders | | | | | |
| §2 Lapsed | | | | | |
| §3 Black Friday | | | | | |
| §4 Free-draft | | | | | |

Numbers landing above the rough budget = open question for Phase 6 — investigate prompt length, scaffold size, or context preload.

---

## Cleanup

When done with the QA pass:

```bash
cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/cleanup.ts
```

This removes all QA-marked customers, transactions, AI drafts, and recent audit rows. Production data is untouched (no real customer name starts with `QA-MKTG-`).

---

## Known v1 limitations to NOT flag as bugs

These are intentional v1 scope decisions documented in `scope.md` §6:

- **No SMS** — AI declines and points to email
- **No scheduling** — send-now only
- **No image generation** — text-only campaigns
- **Modal edits don't persist** — review modal is final-check only; for full edits use the manual builder. Note surfaced in the modal footer.
- **No conversation persistence across Sheet close** — sessionId minted fresh each open; turns lost on close.
- **No backend confirmation message** — UI handles confirmation via the emerald "Sent" state on the draft card (Phase 4 skipped, see impl doc).
- **Proactive cron suggestions** deferred to v1.5.
