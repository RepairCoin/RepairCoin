# Voice-first AI Dispatcher — QA Test Guide (Phase 6)

Manual acceptance walkthrough for voice v1. Six scenarios, one per surface /
flow, mirroring the per-phase acceptance criteria in `implementation.md`
§4. Each scenario is **Ask → Expect → DB check**. Run them against the
seeded test shop (`peanut` by default) on a real browser with a working mic.

The automated cousin of this guide is `qa-fixtures/replay-fixtures.ts`, which
covers router classification headlessly. This guide covers the things a script
can't: mic permission UX, panel hand-off animation, edit-before-send, and the
cross-domain choice card.

**Status:** scaffold — fill the "Observed" / "Pass?" columns during the run.

---

## Pre-flight

- [ ] `qa-fixtures/seed-test-shop.ts` reports the test shop ready (green).
- [ ] Backend running with `OPENAI_API_KEY` set; voice feature flags on for
      the test shop (`VOICE_DASHBOARD_PILL_ENABLED`, `VOICE_ROUTER_ENABLED`,
      `VOICE_INLINE_MIC_ENABLED`).
- [ ] Logged in as the test shop in a Chromium browser; mic available.
- [ ] A psql/Beekeeper window open on the `.env` DB for the audit checks.

Audit queries used throughout:

```sql
-- STT (one row per transcribe call)
SELECT created_at, duration_ms, ROUND(cost_usd::numeric,5) AS cost_usd,
       latency_ms, left(transcript,60) AS transcript, error_message
FROM ai_voice_transcriptions
WHERE shop_id = 'peanut' AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- Router (one row per dispatch that actually routed)
SELECT created_at, transcript_source, router_decision,
       router_input_tokens, router_output_tokens,
       ROUND(router_cost_usd::numeric,6) AS router_cost_usd,
       latency_ms, original_transcript, error_message
FROM ai_dispatch_audit
WHERE shop_id = 'peanut' AND created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

---

## Scenario 1 — Dashboard pill, happy path (Insights)

**Surface:** `VoiceCommandPill` on `/shop` home.

**Ask:** Tap pill → grant mic → say *"What was my revenue last week?"* →
auto-stops on silence → transcript appears → tap **Send**.

**Expect:**
- "Listening…" pulse → "Transcribing…" spinner → editable transcript.
- "Asked Insights" success toast.
- Insights panel slides open with the question pre-filled and Claude already
  replying with a revenue figure.

**DB check:**
- 1 new `ai_voice_transcriptions` row, `error_message` NULL, `cost_usd` ≈ 0.001.
- 1 new `ai_dispatch_audit` row, `router_decision = 'insights'`,
  `transcript_source = 'voice'`.

| | Observed | Pass? |
|---|---|---|
| Transcript correct | | |
| Toast = "Asked Insights" | | |
| Insights panel answered | | |
| Audit rows present | | |

---

## Scenario 2 — Header mic, popover follow-up (Marketing)

**Surface:** `HeaderVoiceMic` in the `DashboardLayout` action cluster.

**Ask:** Tap header mic → say *"Make a Black Friday campaign, twenty percent
off all services"* → Send from the popover (not full-page takeover).

**Expect:**
- Popover hosts the EDIT_CONFIRM step.
- "Asked Marketing" toast; Marketing panel opens with a draft whose body
  echoes **20%** (anti-hallucination — must not invent a different number).

**DB check:** `ai_dispatch_audit.router_decision = 'marketing'`.

| | Observed | Pass? |
|---|---|---|
| Popover (not full page) | | |
| Body says "20%" exactly | | |
| Router = marketing | | |

---

## Scenario 3 — Mobile bottom-nav mic (Help)

**Surface:** `MobileBottomNavMic` (yellow `+`, `lg:hidden`). Use a mobile
viewport or real phone.

**Ask:** Tap `+` → drawer opens AND recording starts on the same tap (iOS
gesture requirement) → say *"How do I export my bookings?"* → Send.

**Expect:**
- vaul bottom Drawer runs the full state machine.
- "Asked Help" toast; Help panel opens and answers the export question.

**DB check:** `ai_dispatch_audit.router_decision = 'help'`,
`transcript_source = 'voice'`.

| | Observed | Pass? |
|---|---|---|
| Single-gesture start works | | |
| Help panel answered | | |
| Router = help | | |

---

## Scenario 4 — OUT_OF_SCOPE decline (no panel opens)

**Surface:** any global mic (pill / header / mobile).

**Ask:** Say *"What's the weather today?"* → Send.

**Expect:**
- Inline templated decline (*"I can't help with that yet — try the Bookings
  tab, Inventory page, or the manual panels."*).
- **No** panel opens, **no** "Asked …" toast.

**DB check:** 1 `ai_dispatch_audit` row, `router_decision = 'out_of_scope'`.
(STT row still exists — the utterance was transcribed.)

| | Observed | Pass? |
|---|---|---|
| Inline decline shown | | |
| No panel opened | | |
| Router = out_of_scope | | |

---

## Scenario 5 — Edit-before-send is honored in the audit

**Surface:** any global mic.

**Ask:** Say *"Who are my top customers?"* → in EDIT_CONFIRM, change the text
to *"Who are my top 10 customers this month?"* → Send.

**Expect:**
- The edited text is what the panel receives and answers.
- Router still classifies `insights`.

**DB check:** `ai_dispatch_audit` row where:
- `transcript` = the **edited** text.
- `original_transcript` = the **raw STT** text (non-NULL because it was edited).

| | Observed | Pass? |
|---|---|---|
| Edited text sent | | |
| `original_transcript` captured | | |
| Router = insights | | |

---

## Scenario 6 — Inline mic cross-domain hand-off (D3 hybrid)

**Surface:** `InlineVoiceMic` inside an already-open **Marketing** panel.

**Ask:** With Marketing open, tap the inline mic → say *"What's my revenue
this week?"* (an Insights question).

**Expect:**
- Client keyword classifier flags Insights ≠ current panel → confirms via
  `/api/ai/dispatch` (`transcript_source = 'inline_mic'`).
- `CrossDomainChoiceCard` renders: *"This looks like an Insights question —
  [Open Insights instead] / [Send to Marketing anyway]"*.
- Tap **Open Insights instead** → Marketing draft preserved → Insights panel
  opens with the transcript and answers.

**Also verify the no-router path:** with Marketing open, say *"make the
subject more urgent"* (in-domain). Classifier matches current panel → **no**
`/api/ai/dispatch` call, **no** new `ai_dispatch_audit` row — Marketing just
receives the message. (Cost for that turn = STT + downstream only.)

**DB check:**
- Cross-domain turn → 1 `ai_dispatch_audit` row, `router_decision = 'insights'`,
  `transcript_source = 'inline_mic'`.
- In-domain turn → **no** new `ai_dispatch_audit` row.

| | Observed | Pass? |
|---|---|---|
| Choice card on cross-domain | | |
| Draft preserved on hand-off | | |
| In-domain skips the router (no audit row) | | |

---

## Wrap-up

- [ ] All 6 scenarios pass.
- [ ] `replay-fixtures.ts` accuracy ≥ 95%.
- [ ] Cost/latency numbers transferred to `v1-cost-report.md`.
- [ ] Decision matrix in the cost report resolved (ship / tune).
