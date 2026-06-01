# QA Test Guide — Unified Assistant (Phases 1–3)

Manual acceptance walkthrough for the unified "Talk To My Business" assistant:
the cross-domain orchestrator (Phase 1), the one-door chat UI (Phase 2), and
turn-based voice in/out (Phase 3).

**Status:** for QA runs against a local or staging environment. Fill the
Pass/Notes columns during the run.

---

## 0. Prerequisites

- [ ] Backend running (`cd backend && npm run dev` → :3002) with `OPENAI_API_KEY`
      + Anthropic credits available.
- [ ] Frontend running (`cd frontend && npm run dev` → :3001), with
      `NEXT_PUBLIC_API_URL=http://localhost:3002/api` (so it hits the local backend).
- [ ] Logged in as a **shop** (use `peanut`, the seeded test shop).
- [ ] **Chrome** (best MediaRecorder support), working **microphone**, speakers/headphones.
- [ ] A DB client on the `.env` (DigitalOcean staging) database for the audit checks.

Open the assistant: shop dashboard → top-right action cluster → **✨ Sparkles** icon.

---

## Part A — Text path (baseline, no voice)

| # | Step | Expect | Pass? |
|---|---|---|---|
| A1 | Type *"How did we do this month?"* → Send | Text answer + insights card(s) (revenue / bookings / etc.) render inline | |
| A2 | Type *"Win back the customers who've gone quiet"* | Audience lookup → a **campaign-draft card** (tap-to-review); reply is grounded in the count | |
| A3 | Tap a starter chip on the empty state | Submits that prompt as a turn | |
| A4 | Tap a chip inside a card (follow-up / strategy) | Resubmits as a new turn | |

`peanut` data note: "this month" may be **zeros** and the 90-day lapsed bucket
empty — the assistant should **say so honestly** and offer a shorter window /
all-customers, then draft. That's correct, not a bug. QA is verifying the
**render + flow**, not the numbers.

---

## Part B — Voice-IN (mic → speak → answer, auto-spoken reply)

| # | Step | Expect | Pass? |
|---|---|---|---|
| B1 | Tap the **🎤 mic** button (first tap → browser asks mic permission → Allow) | Button turns **red/pulsing** = listening | |
| B2 | Say *"How did we do this month?"* then stop talking | Auto-stops after ~1.5s silence → button shows **spinner** (transcribing) | |
| B3 | — | Your transcript appears as a user bubble; assistant answers | |
| B4 | — | **The reply is spoken aloud** (voice-in auto-speaks the answer back) | |
| B5 | Tap mic again while it's listening | Recording stops early (manual stop) | |

---

## Part C — Voice-OUT toggle (typed → spoken)

| # | Step | Expect | Pass? |
|---|---|---|---|
| C1 | Tap the **🔊 speaker toggle** so it's ON (highlighted yellow) | Toggle shows the "on" state | |
| C2 | **Type** a question → Send | Reply appears **and is spoken aloud** | |
| C3 | Tap the toggle OFF (shows muted icon) | — | |
| C4 | **Type** another question | Reply is **text only — no audio** | |

---

## Part D — Turn-based loop ("like Siri")

| # | Step | Expect | Pass? |
|---|---|---|---|
| D1 | Voice a question → hear the spoken answer → voice a follow-up → hear answer | Take-turns conversation works across multiple voiced turns | |
| D2 | Start a new turn (voice or type) while a reply is still playing | Previous audio **stops**, new turn proceeds (no overlap) | |

---

## Part E — Error / edge cases

| # | Step | Expect | Pass? |
|---|---|---|---|
| E1 | **Deny** mic permission, then tap mic | Friendly inline error ("Mic permission needed…"), no crash | |
| E2 | Tap mic, stay silent | Graceful handling (empty transcript → nothing sent / "didn't catch that") | |
| E3 | Mid-conversation, hit the 30-message cap | "Conversation full — close to start fresh" message; input disabled | |
| E4 | (If forceable) TTS failure | Reply still shows as **text**; no error blocks the chat (TTS is best-effort) | |

---

## Part F — Backend verification (audit + cost)

Run after a session. Confirms the turns + voice legs were audited and billed.

```sql
-- Orchestrator turns (one row per assistant turn)
SELECT to_char(created_at,'HH24:MI:SS') t, model, input_tokens, output_tokens,
       cached_input_tokens, round(cost_usd::numeric,5) cost,
       jsonb_array_length(tool_calls) tools, latency_ms, error_message
FROM ai_orchestrate_messages WHERE shop_id='peanut'
ORDER BY created_at DESC LIMIT 10;

-- Voice-IN (STT) rows — one per mic utterance
SELECT to_char(created_at,'HH24:MI:SS') t, duration_ms,
       round(cost_usd::numeric,5) cost, latency_ms, left(transcript,50) tx
FROM ai_voice_transcriptions WHERE shop_id='peanut'
ORDER BY created_at DESC LIMIT 10;
```

- [ ] One `ai_orchestrate_messages` row per assistant turn, tokens/cost/tool_calls populated, `error_message` NULL.
- [ ] One `ai_voice_transcriptions` row per **voiced** input (text-only turns won't add one).
- [ ] Voice-OUT (TTS) has **no dedicated table** — verify cost via backend logs
      (look for `VoiceSpeak` log lines with `chars` / `costUsd`) and that the
      shared spend cap advanced.
- [ ] No spend-cap surprises / 429s during normal use.

---

## Part G — Phase 4 actions (confirm-before-execute)

The assistant now PROPOSES actions; the owner's tap executes them. Two actions:
campaign **send** and inventory **purchase order**.

**Data prereqs / gotchas:**
- The shop needs **low-stock inventory items** (peanut has `QA-INV-*` seed items).
- The seed items have **no vendor** → approving them records the suggestion but
  does NOT create a real PO. To exercise the **full PO-create** path, assign a
  **vendor** to one low item first (Inventory → item → vendor), or pick a real
  low item that already has a vendor.
- **SendGrid may be unconfigured on staging** (`SendGrid API key not configured`
  in the backend log) → the campaign **status flips to sent but no email is
  delivered**. That's fine — QA verifies the *flow + status*, not delivery.

| # | Step | Expect | Pass? |
|---|---|---|---|
| G1 | Ask *"Order more of whatever's running low"* | One or more **PO proposal cards** — item, qty, urgency badge | |
| G2 | A **no-vendor** item's card | Amber "no vendor set…" note + button reads **"Approve"** | |
| G3 | Tap **Approve** on a no-vendor item | Card → "Approved — … (add a vendor to generate the PO)" | |
| G4 | A **with-vendor** item's card → tap **"Create purchase order"** | Card → "Purchase order created — N × item" | |
| G5 | Ask *"Draft a win-back and send it to my customers"* | Draft card, then a **send-confirm** card ("Send to N customers?") | |
| G6 | Tap **"Yes, send"** | Card → "Sent — N emails queued" | |
| G7 | **Guardrail:** before any tap | The reply says it's *proposed / ready to confirm* — it must NOT claim it already sent/ordered, and nothing executes until you tap | |

**Backend verification (after the taps):**
```sql
-- PO suggestion approved (+ a real PO created when the item had a vendor)
SELECT id, item_name, status, purchase_order_id, approved_at
FROM purchase_order_suggestions WHERE shop_id='peanut'
ORDER BY approved_at DESC NULLS LAST LIMIT 5;
SELECT id, status, created_at FROM purchase_orders WHERE shop_id='peanut'
ORDER BY created_at DESC LIMIT 5;   -- new row only for the with-vendor approve (G4)

-- Campaign flipped to sent (G6)
SELECT id, subject, status, sent_at FROM marketing_campaigns WHERE shop_id='peanut'
ORDER BY created_at DESC LIMIT 5;

-- Orchestrator audit — the action turns recorded propose_* tool calls
SELECT to_char(created_at,'HH24:MI:SS') t, jsonb_array_length(tool_calls) tools,
       tool_calls FROM ai_orchestrate_messages WHERE shop_id='peanut'
ORDER BY created_at DESC LIMIT 5;
```
- [ ] G3 approve → suggestion `status='approved'`, `purchase_order_id` NULL (no vendor).
- [ ] G4 approve → suggestion `status='approved'` + `purchase_order_id` set + a new `purchase_orders` row.
- [ ] G6 send → campaign `status` advanced (sent/queued).
- [ ] Nothing in those tables changed **before** you tapped (confirm-before-execute holds).

---

## Sign-off

- [ ] Part A (text + cards) pass
- [ ] Part G (actions: PO + send, confirm-gated) pass
- [ ] Part B (voice-in + auto-spoken reply) pass
- [ ] Part C (speaker toggle) pass
- [ ] Part D (turn-based loop) pass
- [ ] Part E (errors graceful) pass
- [ ] Part F (audit rows + cost) pass
- [ ] QA by: __________ on __________

**Known/expected for v2 so far:** the assistant is **draft-only** — it never
sends/charges/orders (confirm-before-execute lands in Phase 4). `peanut`'s thin
data makes some answers report zeros (correct, not a bug). The redundant-re-pull
behavior (turn occasionally re-fetches metrics it already has) is a known
latency/cost wart, not a correctness issue.
