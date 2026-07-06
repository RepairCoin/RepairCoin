# Ads — Lead Conversation & Attention Redesign

The AI-first lead flow (auto first-contact + inbound auto-reply) is built, but the surrounding UX was designed for a
human-first, phone/chat world. Two things are now wrong:

1. **The email conversation is unreachable.** The Kanban's "open conversation" button is gated `isAdmin &&
   lead.hasChatChannel` — i.e. admins only, Messenger/WhatsApp only. Email leads (the entire inbound/outreach flow) get
   Call/Email buttons and **no way to open the thread**, on shop *or* admin. Part A wired the API + ownership + made
   `LeadConversation` mode-aware, but the entry point was never added.
2. **The pipeline/attention model conflates "AI reached out" with "a human worked it."** Auto-outreach calls
   `markContacted`, which stamps `first_response_at` and advances `new → contacted`. So AI-handled leads skip `new`, drop
   off the "leads awaiting response" widget (`first_response_at IS NULL`), and the "New lead — respond quickly" push is
   misleading (the AI already replied). The shop can't tell "AI is handling this" from "this needs me."

The root cause: **status is one axis (the sales funnel), but we're using it to also express conversation state.** They're
different. And the conversation — now the primary object in an AI-first flow — has no home in the UI.

## Design principles
- **The AI owns first contact + routine replies; the human supervises and steps in at high-value moments.** The empty
  `new` column is a *success signal* (no lead sits unattended), not a bug — but the UI must make AI-handled leads visible
  and surface a *meaningful* "needs you" queue.
- **The conversation is a first-class object.** It must be reachable for every lead with a thread, from shop and admin.
- **Two independent axes:**
  - *Pipeline stage* (sales funnel): `new → contacted → booked → paid → completed / lost`. Advances on real milestones
    (booked/paid via order attribution). An AI email is **not** a "contacted" sales milestone.
  - *Conversation state* (derived from the thread + flags): `awaiting_ai`, `ai_engaged` (sent, awaiting customer),
    `customer_replied`, `needs_human`, `dormant`.
- **Attention = derived, not a raw timestamp.** "Needs you" is computed, not `first_response_at IS NULL`.

## Target UX
### 1. Conversation Inbox (the missing surface)
A conversation-centric list per campaign (and optionally shop-wide): each lead is a row — name, last-message preview,
channel icon, relative time, a **state badge**, and an unread dot. Sortable by last activity; filterable **Needs you /
AI handling / All**. Clicking opens the thread. This becomes the shop's day-to-day home for leads; the Kanban stays for
funnel/outcome tracking.

### 2. Enhanced thread (`LeadConversation` ++)
- Clear roles (Customer / AI / You), timestamps, delivery status.
- **Take over** toggle → pause the AI for this lead so the shop can reply manually without the AI answering over them
  (new `ad_leads.ai_paused`). Resume re-enables auto-answer.
- Quick reply + "AI draft" + send; inline "mark booked / lost".

### 3. Correct attention model
- Keep `first_response_at` as the **speed-to-lead** metric (AI counts — instant response is the win).
- Replace the "X leads awaiting response" widget with **"X conversations need you"**, computed as: the last message is an
  **inbound** (customer) that no **human** has answered, AND (campaign AI is off **or** the AI failed/errored **or** an
  escalation/booking-intent flag is set). AI-sent-and-awaiting-customer is **calm**, not "needs you".
- Card/row **badges**: `AI handling` · `Customer replied` · `Needs you` · `Dormant Nd`.

### 4. Accurate notifications
- AI auto-outreach (informational, low urgency): "AI greeted **{name}** for **{campaign}** — review the conversation."
- Customer reply needing a human (high urgency — the real SLA): "**{name}** replied — needs your response."
- Booking intent / AI escalation: "**{name}** looks ready to book."

## Data model (minimal)
- `ad_leads.ai_paused BOOLEAN NOT NULL DEFAULT false` — take-over/pause.
- (optional, denormalized for inbox sort/badges) `ad_leads.last_message_at`, `last_message_direction` — or derive via a
  `LATERAL` join on `ad_lead_messages` in v1.
- Everything else derives from the existing `ad_lead_messages` thread + `ad_campaigns.ai_outreach_mode`/`ai_agent_enabled`.

## Phasing
- **P1 — Reachability + honest signals (must-fix, small).**
  - Kanban card: a **Conversation** button for any lead with a thread channel (`hasChatChannel || email`), on **shop and
    admin** (Part A's API already supports shop). Keep Call for phone.
  - Notifications: neutral base ("New lead — {name}") + on AI auto-send, "AI greeted {name} — review/take over".
  - This alone makes the whole feature visible and stops the misleading push.
- **P2 — Conversation Inbox + attention queue.**
  - The inbox list (per campaign) with state badges + Needs-you filter; replaces the "awaiting response" widget with
    "conversations need you". Derive conversation state from the thread.
- **P3 — Take-over + escalation.**
  - `ai_paused` + take-over toggle in the thread; detect booking-intent / AI-escalation → `needs_human` + the high-urgency
    notification; dormant sweep.

## Decisions
1. **Inbox vs. enhanced Kanban** as the primary shop surface — recommend a **Conversation Inbox** (the Kanban is a poor fit
   for message-driven work), with the Kanban retained for funnel tracking.
2. **Pipeline auto-advance on AI outreach** — recommend **stop** advancing `new → contacted` on AI send; keep the lead's
   funnel stage honest (still `new` until a real human/booking milestone), and express "AI reached out" via conversation
   state + badge instead. (P1 keeps current behavior; P2 flips it with the attention model so nothing looks broken.)
3. **Take-over model** — full pause (AI silent until resumed) vs. suggest-only. Recommend full pause with a clear resume.
