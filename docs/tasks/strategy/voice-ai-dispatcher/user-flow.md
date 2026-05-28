# Voice AI Dispatcher — User Flow

**Companion to:** `scope.md` (architecture, decisions, phasing). Read that first for the "why."
**Purpose:** make the design concrete. Walk through what happens on screen, step by step, when a shop owner taps the mic on the dashboard.
**Design reference:** `c:\dev\voice.jpeg` — shop dashboard with center voice pill and "AI Assistant — NEW" sidebar item.
**Created:** 2026-05-28.

---

## Starting state (every scenario)

Shop owner is logged in on the dashboard home. Visible elements (from voice.jpeg):

- Top bar: "Hi, John · Pro Plan" with profile photo, chat icon (3 unread), notifications (7)
- Left sidebar: Home / Customers / Bookings / Services / Inventory / Marketing / Reports / **AI Assistant (NEW)**
- Center hero: "Good morning, John! 👋 Your business is running great." + robot mascot
- KPI tiles: Revenue $2,450 / Bookings 28 / New Customers 16 / Reviews 4.8
- AI Recommendations row (3 cards: Win-Back Campaign, Low Stock Alert, Slow Day Tomorrow)
- Right rail: Today's Agenda + Recent Activity
- **Center-bottom voice pill:** *"Ask AI Anything · 🎤 · AI will handle the rest"* with the example *"Create a campaign for slow days"*
- Bottom mobile-nav: Home / Customers / Bookings / **[yellow + button — "One tap to do anything"]** / Services / Inventory / More

The 4 sidebar AI launchers (Megaphone for Marketing, BarChart3 for Insights, Help icon, Sales Agent chat) stay visible as direct manual entry points throughout every voice flow. Voice is the shortcut; the launchers are the expert-mode direct path.

---

## Scenario 1 — Happy path: Marketing command (~15-18s end-to-end)

The "exec demo" version of the feature. Common cross-domain command.

### Step 1 — Tap the mic

- Voice pill: `"Ask AI Anything · 🎤 · AI will handle the rest"` → `"🎙️ Listening… (tap to stop)"`
- Mic icon pulses; subtle waveform / glowing ring around the pill
- **First-time only**: browser permission prompt — *"Allow staging.repaircoin.ai to use your microphone?"* → shop owner clicks Allow

### Step 2 — Speak the command

Shop owner says: *"Send a Black Friday campaign with 20 percent off this weekend"*

The pill stays in "Listening…" state. The ring pulses in time with the audio amplitude so the shop owner knows the mic is actually capturing.

### Step 3 — Stop recording

Two ways:
- **Manual**: shop owner taps the mic again
- **Auto**: 1.5s of detected silence ends the capture

Pill changes to `"⏳ Transcribing…"` with a small spinner.

### Step 4 — Transcript returns (~2-3s on Whisper)

Pill expands into an edit-confirm card:

```
┌─────────────────────────────────────────────────┐
│  "Send a Black Friday campaign with 20% off    │
│   this weekend"                                 │
│                              [Edit] [Send →]    │
└─────────────────────────────────────────────────┘
```

Shop owner options:
- **Tap Send** → proceeds to Step 5
- **Tap Edit** → text becomes editable, fix any STT mistake, then Send
- **Tap mic again** → re-record from scratch (rare — usually just edit)

### Step 5 — Router fires (~300ms, Haiku)

Pill: `"⏳ Routing your request…"`

Backend `POST /api/ai/dispatch` runs a 4-way classification (Haiku, tiny prompt). Returns:

```json
{ "domain": "marketing", "transcript": "Send a Black Friday campaign with 20% off this weekend" }
```

### Step 6 — Marketing panel slides open

Brief toast bottom-right: *"📣 Asked Marketing Assistant"* — so the shop owner understands where the question went.

The existing `MarketingAIPanel` `Sheet` animates in from the right. The transcript appears as the first user bubble (yellow pill on the right) in the chat thread:

```
┌──────────────────────────────────────────────────┐
│  Marketing Assistant                       ⛶  ✕  │
│  Tell me what campaign to send…                  │
├──────────────────────────────────────────────────┤
│                                                  │
│                  ┌─────────────────────────────┐ │
│                  │ Send a Black Friday         │ │
│                  │ campaign with 20% off       │ │
│                  │ this weekend                │ │
│                  └─────────────────────────────┘ │
│                                                  │
│  🤖 Thinking…                                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Step 7 — Marketing AI runs (~10s, existing flow)

This is the same flow that happens today when the shop owner types into the Marketing panel directly. No new behavior — voice just seeded the input.

Eventually the assistant bubble + cards fill in:

- Prose: *"Drafted your Black Friday campaign for all 4 customers (your full list) — tap the card to preview and edit."*
- `audience_summary` card: "4 customers match · All customers"
- `campaign_draft` card: "🛍️ Black Friday at Peanut — 20% off all services" with body preview + "Tap to preview →" CTA

### Step 8 — Shop owner acts

- Taps the draft card → `CampaignReviewModal` opens
- Subject + body shown editable; recipient list; red "Send 4 emails" destructive-confirm button
- Either edits + sends OR closes the panel and goes back to the dashboard

**Total elapsed:** ~15-18s from mic tap to draft card on screen. Roughly matches the time it'd take to type the equivalent command.

---

## Scenario 2 — Insights command (~12-14s)

Shop owner says: *"How much did I earn last week?"*

Steps 1-5 are identical to Scenario 1. Differences start at Step 6:

### Step 6 — Toast + Insights panel opens

Toast: *"📊 Asked Insights Assistant"*. The `InsightsPanel` Sheet slides open instead of Marketing's.

### Step 7 — Insights agent loop

Existing Insights surface runs `revenue_summary({range:"7d"})` automatically. Reply lands as:

- Prose: *"You earned $1,847 last week."*
- `number` card: large $1,847 with "Last 7 days" label and sparkline
- `suggest_followups` chips: "Top customers this week" / "Compare to prior 7 days" / "Bookings breakdown this week"

### Step 8 — Follow-up

Shop owner taps a chip → the chip text becomes the next user message in the same Insights chat. No need to go back to the dashboard or use the mic again — they're now in a normal Insights multi-turn session.

**Total elapsed:** ~12-14s. Faster than Marketing because Insights flows are usually single-tool round-trips.

---

## Scenario 3 — OUT_OF_SCOPE (booking command)

Shop owner says: *"Book Alex Johnson for a phone repair at 2pm Friday"*

Steps 1-4 identical. STT returns the transcript correctly. Shop owner sends.

### Step 5 — Router fires

Returns `{ "domain": "out_of_scope", "transcript": "..." }`.

### Step 6 — Voice pill renders inline response (NO panel opens)

The pill expands into a small response card right there on the dashboard:

```
┌────────────────────────────────────────────────────┐
│  ℹ️  I can't help with bookings by voice yet.      │
│      Use the Bookings tab to schedule              │
│      Alex Johnson manually.                        │
│                                                    │
│  [Open Bookings]  [Try a different command]        │
└────────────────────────────────────────────────────┘
```

Shop owner taps:
- **Open Bookings** → navigates to `/shop?tab=bookings`
- **Try a different command** → pill resets to its idle state, ready for another mic tap

No Sheet panel opens. No retry into the wrong domain. Honest decline, useful next-action.

---

## Scenario 4 — Follow-up by voice inside a panel (~8-10s per turn)

Picks up where Scenario 1 (or any panel-open flow) leaves off. Shop owner just got the Black Friday `campaign_draft` card. They want a quick edit-by-voice on the next message.

### Step 1 — Inline mic next to send button

The Marketing panel's input area now shows:

```
┌──────────────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  🎤  ➤  │
│  │ Tell me what campaign to send…     │         │
│  └────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

The small mic icon is the new inline voice control. Same icon-style as the global pill, smaller, scoped to the panel.

### Step 2 — Tap inline mic

- Mic pulses, input area shows "🎙️ Listening… (tap to stop)"
- Same recording UX as the global pill, just contained inside the panel

### Step 3 — Speak the follow-up

Shop owner says: *"Make the subject more urgent — add fire emojis"*

### Step 4 — Transcript appears in the panel's textarea (edit-confirm step)

```
┌──────────────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  🎤  ➤  │
│  │ Make the subject more urgent — add  │         │
│  │ fire emojis                         │         │
│  └────────────────────────────────────┘         │
│  [Edit] [Send →]                                 │
└──────────────────────────────────────────────────┘
```

Same edit-confirm card as global voice (Q6) — STT can mistranscribe; user always sees transcript before send fires.

### Step 5 — Client keyword check (instant, no network call)

Per Layer 4 D3 hybrid in scope.md §4.4: client-side helper inspects the transcript against per-domain keyword signals:

- Insights signals: `revenue|sales|customer|booking|order|earned|made|...`
- Marketing signals: `campaign|email|send (to)|win[- ]back|black friday|subject|...`
- Help signals: `how do I|how to|where is|where do|...`

Transcript *"make the subject more urgent — add fire emojis"* matches Marketing signals (`subject`). Current panel = Marketing. Match → **skip the router**.

### Step 6 — Edit-confirm card (normal variant, no cross-domain choice)

Transcript drops into the panel's textarea state. User can tap **Edit** to fix STT errors, or tap **Send** to fire the panel's existing send action.

### Step 7 — Marketing AI responds

- New user bubble appears with the follow-up text
- AI runs another agent loop, returns updated `campaign_draft` card with new urgent subject + 🔥 emojis
- Shop owner taps to open the review modal, edits if needed, sends

**Total elapsed:** ~8-10s per follow-up turn. Faster than Scenario 1's full flow because:
- Client keyword check skipped the router call entirely (~300ms saved)
- Domain context already loaded (cache-friendly system prompt)
- Conversation already established (Claude doesn't re-discover the shop's context)

---

## Scenario 4-B — Per-panel mic with cross-domain handoff (~10-12s)

Same starting state as Scenario 4 (shop owner mid-conversation in the Marketing panel after the Black Friday draft) — but this time the follow-up question is from a different domain.

### Steps 1-4 — Identical to Scenario 4

Tap inline mic, speak, transcribe. Transcript this time: *"What's my revenue this week?"*

### Step 5 — Client keyword check fires a CROSS-DOMAIN signal

Client helper sees `revenue` (Insights signal), `week` (time range — Insights-aligned). Current panel = Marketing. No Marketing signals fire.

Client concludes: signals point at Insights, not the current Marketing panel. **Call the router to confirm.**

### Step 6 — Router check (~300ms)

Router (Haiku) classifies *"What's my revenue this week?"* → confirms `INSIGHTS`.

### Step 7 — Edit-confirm card with cross-domain choice

```
┌──────────────────────────────────────────────────┐
│ "What's my revenue this week?"                   │
│                                                  │
│ ⚠ This looks like an Insights question.          │
│                                                  │
│ [Send to Marketing]   [Open Insights instead]    │
└──────────────────────────────────────────────────┘
```

Two valid paths from here:

**Path 7a — Send to Marketing (user overrides the router's domain guess).**
- Transcript drops into Marketing's textarea, send fires
- Marketing AI sees the request, recognizes it's not marketing-related
- Responds with rule 7 decline copy: *"I can help you draft and send marketing campaigns. For other questions, try the Insights assistant."*
- Friction but recoverable (same as Edge case B in the global-voice scenarios)

**Path 7b — Open Insights instead (the intended cross-domain handoff).**
- Marketing panel closes (any unsaved draft in the textarea is preserved — Phase 5.5 acceptance includes this guarantee)
- Insights panel slides open from the right (same animation as if the global router had dispatched there)
- Transcript pre-fills the Insights chat as the first user message
- Insights AI immediately runs `revenue_summary({range:"7d"})` and returns the answer
- Shop owner gets the revenue card without leaving the voice flow

**Total elapsed (Path 7b):** ~10-12s. Slightly longer than 4-A because the router added ~300ms and the panel transition took ~500ms. But user never had to:
- Manually close Marketing
- Manually open Insights
- Re-type the question

The cross-domain handoff IS the continuity benefit.

### Why D3 hybrid (recap from scope.md §4.4)

- Common case (~90%): in-domain follow-up like Scenario 4. Client keyword check passes, router is NOT called, zero added cost or latency.
- Edge case (~10%): cross-domain follow-up like Scenario 4-B. Client keyword check flags it, router confirms, cross-domain choice card appears.
- User always retains control via the edit-confirm card — they can override the router's domain guess by tapping "Send to current panel" anyway (Path 7a).
- Cost difference: $0.019 (in-domain) vs $0.0192 (cross-domain with router) = under 1% of total turn cost.

The decision tradeoff: voice on short follow-ups isn't always faster than typing (*"compare to last week"* = 4 taps vs ~3s of recording + edit). But it's:
- Always-available (no mode switch to keyboard)
- Hands-free (shop owners on the shop floor with dirty hands)
- Accessible (users with typing difficulties)
- Continuity-preserving (cross-domain questions don't break the voice flow)

---

## Edge case A — STT mistranscription

Shop owner says *"What's my revenue this week?"* but STT returns *"What revenue this is week?"* (slight garble).

### Step 4 — Garbled transcript displayed in the edit card

Shop owner notices immediately. Options:
- **Tap Edit** → fix the typo manually → tap Send
- **Tap mic again** → re-record cleanly
- **Send anyway** → the AI's prompt is forgiving enough to interpret intent

The edit-before-dispatch step is mandatory — STT will never directly trigger a destructive action. (Per `scope.md` §5 Q6 and §7 Risks.)

---

## Edge case B — Router picks the wrong domain

Shop owner says *"Show me how many bookings I had yesterday."* Router *should* classify as `INSIGHTS` — but suppose Haiku misfires and picks `MARKETING`.

### Step 6 — Marketing panel opens with the question seeded

### Step 7 — Marketing AI sees the request, recognizes it's not marketing

The existing Marketing assistant's prompt rule 7 fires: *"For unsupported questions, reply with this exact line and nothing else: 'I can help you draft and send marketing campaigns. For other questions, try the Insights assistant ("Ask about your business") or the Help assistant.'"*

Shop owner sees the decline copy.

### Step 8 — Recovery

Shop owner has two paths:
- Manual: tap the BarChart3 (Insights launcher) icon in the sidebar → Insights panel opens → re-type the question
- Voice retry: close the Marketing panel, tap the mic on the dashboard again, rephrase

**Friction but not a dead end.** The existing sidebar launchers are always available. The router's mistake costs one extra tap, not a broken experience.

---

## Edge case C — Mic permission denied

Shop owner taps mic. Browser blocks (they previously denied or are on a privacy-locked browser).

### Voice pill renders the deny state inline

```
┌────────────────────────────────────────────────────┐
│  🚫 Microphone access is blocked.                  │
│      Enable it in your browser settings, or        │
│      type your request below.                      │
│                                                    │
│  ┌──────────────────────────────────┐  [Send →]    │
│  │ Type your request…               │              │
│  └──────────────────────────────────┘              │
└────────────────────────────────────────────────────┘
```

Text fallback — same router-and-dispatch flow, just typed instead of spoken. Voice users who can't grant mic permission don't dead-end; they get a parallel input path.

---

## Edge case D — Long pause / no speech detected

Shop owner taps mic but doesn't say anything (changed their mind, distracted, etc.).

After 5s of pure silence:
- Pill auto-stops recording
- Renders: *"I didn't catch anything — tap to try again"* with a small mic icon
- No transcript is sent to the router; no API cost incurred

---

## Edge case E — Background noise corrupts transcription

Shop owner is in a noisy environment (loud shop floor, music playing). STT returns garbage or an empty string.

If transcript is empty or single-word noise:
- Pill renders: *"That didn't sound like a command — try again in a quieter spot?"*
- Doesn't send to router

If transcript is partial / weird:
- Treated like Edge case A — shop owner sees the garbled text and can edit before sending

---

## State machine summary

Two parallel paths depending on entry point:

**Path A — Global voice (dashboard pill / header icon / mobile FAB):**

```
[IDLE pill]
   │
   │  (tap mic)
   ▼
[LISTENING] ──(silence 5s / no audio)──> [NO_INPUT — "didn't catch anything"]
   │                                              │ (tap mic)
   │  (stop recording)                            └─> [IDLE]
   ▼
[TRANSCRIBING]
   │
   │  (STT response)
   ▼
[EDIT_CONFIRM card]
   │
   ├──(tap Edit)──> [user edits text inline]──> [EDIT_CONFIRM card]
   ├──(tap mic)──> [LISTENING]
   └──(tap Send)
              │
              ▼
        [ROUTING — small Haiku call]
              │
              ▼
      ┌───────┴───────┬─────────────────┐
      │               │                 │
   INSIGHTS       MARKETING            HELP            OUT_OF_SCOPE
      │               │                 │                  │
      ▼               ▼                 ▼                  ▼
   [Insights      [Marketing        [Help               [inline decline
    panel opens    panel opens       panel opens         card on dashboard,
    with transcript with transcript  with transcript     no panel opens]
    pre-filled]    pre-filled]       pre-filled]
      │               │                 │
      ▼               ▼                 ▼
   [existing      [existing         [existing
    Insights       Marketing         Help
    agent loop]    agent loop]       corpus search]
```

**Path B — Per-panel inline mic with D3 hybrid (mic next to send button inside a panel):**

```
[panel input area, mic IDLE]
   │
   │  (tap inline mic)
   ▼
[LISTENING — scoped to panel]
   │
   │  (stop recording / silence)
   ▼
[TRANSCRIBING]
   │
   │  (STT response — same endpoint as Path A)
   ▼
[CLIENT KEYWORD CHECK — synchronous, no network]
   │
   │  Inspects transcript against per-domain keyword signals
   │
   ▼
   ┌────────────────────────┴────────────────────────┐
   │                                                 │
   ▼                                                 ▼
[in-domain — signals match               [cross-domain — signals point at
 current panel or no signals]             different domain than current panel]
   │                                                 │
   │  (skip router)                                  │  (call router for confirmation)
   ▼                                                 ▼
[EDIT_CONFIRM (normal variant)]                [ROUTER — Haiku confirms domain]
   │                                                 │
   │                                                 ▼
   │                                  [EDIT_CONFIRM (cross-domain choice variant)]
   │                                                 │
   │                                  ├──(tap "Send to current panel")──> [normal in-domain flow]
   │                                  └──(tap "Open other panel instead")
   │                                                       │
   │                                                       ▼
   │                                            [current panel closes]
   │                                            [other panel opens, transcript pre-filled]
   │                                            [other panel's existing send fires]
   │
   ├──(tap Edit)──> [normal textarea editing]
   ├──(tap inline mic)──> [LISTENING — re-record]
   └──(tap Send — the panel's existing send button)
              │
              ▼
   [panel's existing send action fires]
              │
              ▼
   [Claude continues the existing chat thread]
```

Path B is shorter than Path A in the common case — no router, no domain switching, no toast. The cross-domain branch only fires when the client keyword check suggests a mismatch (~10% of per-panel voice turns), and even then the user gets a choice card rather than an automatic handoff.

---

## What this story makes obvious

Three things this walkthrough surfaces that the scope doc alone didn't make vivid:

1. **The transcript-edit step is the safety valve.** STT will be wrong sometimes — sometimes badly. The edit-confirm card before dispatch is what prevents bad transcripts from triggering wrong actions. Don't cut this in v1 even if it adds a click.

2. **The voice pill is statefully alive on the dashboard.** It's not just a button — it's a small response surface for OUT_OF_SCOPE, permission-denied, no-input cases. Avoids opening a panel for cases that don't have a domain to land in.

3. **Router mistakes are recoverable, not catastrophic.** Even if Haiku misfires (rare but possible), the wrong panel opens, sees a decline from its own prompt rules, and the shop owner manually reaches for the right sidebar launcher. Friction but not a broken experience. This is only true because we kept the 4 panels separate (see scope.md §5 Q1 decision).

---

## Sketch for the v1 implementation order (pulled from scope.md §6)

1. **Phase 1** — STT endpoint (Whisper) — Step 4 of every scenario
2. **Phase 2** — Voice pill UI with states IDLE / LISTENING / TRANSCRIBING / EDIT_CONFIRM (dashboard pill + header icon) — Steps 1-4 of Scenarios 1/2/3
3. **Phase 3** — Router endpoint (Haiku) — Step 5 of Scenarios 1/2/3
4. **Phase 4** — Open target panel with transcript pre-filled — Steps 6-7 of Scenarios 1/2
5. **Phase 5** — OUT_OF_SCOPE inline card + permission-denied / no-input states — Scenario 3 + edge cases A, C, D
6. **Phase 5.5** — Per-panel inline mic component + 3 panel wirings — **Scenario 4**
7. **Phase 6** — QA fixtures + cost report

The flows above are the acceptance scenarios. Each phase ends with a sub-flow visibly working end-to-end.
