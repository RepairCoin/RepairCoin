# Strategy: AI Sales Agent ↔ Shop Staff Takeover Clash

_Drafted: 2026-05-14_

## Problem Statement

When a shop staff member manually replies in a conversation already being handled by the AI sales agent, the AI keeps replying as if nothing happened. The result is the AI firing on top of the human, contradicting them, and pulling the customer back into its own conversational track — destroying trust in both the AI and the human.

### Observed trace (Peanut ↔ Qua Ting, 2026-05-14, conv `conv_1778475156978_w09ibywla`)

```
7:35:11 AI:    "No worries! Feel free to reach out anytime..."
7:35:50 HUMAN: "real human here"           ← shop staff joins
7:36:05 CUST:  "hey real human how are you?"
7:37:13 HUMAN: "im good"
7:37:28 HUMAN: "whats your concern?"
7:37:49 CUST:  "im looking for bread training"
7:37:55 AI:    "Hey! Just a heads up — I'm actually Peanut's AI assistant,
                not a human! 😊 But great news — Newly Baker is totally
                up your alley!..."
```

**What broke for the customer:**
- The shop staff established themselves as a real human and started directing the conversation
- The AI cut across that, contradicted ("I'm an AI, not a human") without being asked, and reverted to its sales pitch
- The customer is now uncertain whether they're talking to one entity or two, and whether the human's "im good / whats your concern?" thread is still active

## Two Sub-Bugs Identified

### Bug A — No human-takeover detection (the primary issue)

The orchestrator (`AgentOrchestrator.handleCustomerMessage`) fires on every customer message in an AI-enabled conversation. It has no concept of "a real human has joined this thread and the AI should back off". Today's signals it DOES have but doesn't use:
- Each AI message metadata carries `generated_by: "ai_agent"`. Non-AI shop messages do NOT carry this — easy to distinguish.
- The conversation history is already passed to the orchestrator (used by other detectors: cross-service offer follow-up, same-slot loop guard).

The signal is right there; we just don't read it.

### Bug B — AI volunteering its identity unprompted

`UNIVERSAL_RULES` rule #9 says to confirm AI nature **when asked** (e.g., "are you AI?", "is this a bot?"). In the trace, the customer's last message — `"im looking for bread training"` — asks no such thing. The AI volunteered "I'm an AI" because the recent history contained "real human here" and customer addressing "real human". It pattern-matched on the wrong cue.

Rule #9 currently lists trigger phrases ("are you AI?", etc.) but doesn't explicitly say "ONLY when those phrases appear in the customer's CURRENT message". The model inferred a wider applicability.

## Options

| # | Approach | Effort | Durability | Notes |
|---|---|---|---|---|
| **1** | **Time-window heuristic** in the orchestrator prefilter | ~30 min | Quick fix | If most recent shop message has no `metadata.generated_by === "ai_agent"` AND is within last N minutes (e.g., 30), skip the AI reply with `SkipReason: "human_takeover"`. |
| **1.5** | **Tighten rule #9 wording** | ~5 min | Targeted | Add "ONLY trigger this rule when the customer's CURRENT message contains the disclosure question — do NOT infer from history." Kills the unprompted-AI-disclosure side bug. |
| **2** | **Persistent pause state on conversations table** | ~2-3 hours | Long-term | Add `ai_paused_until TIMESTAMPTZ` column. Human shop message bumps it +24h. AI checks before replying. Shop dashboard can manually unpause. |
| **3** | **Explicit shop "Take over" button in chat UI** | ~3-4 hours (mostly UI) | Most intentional | Shop staff click a button in the chat header → conversation marked human-only until they hand back. Pair with #2 (button flips the same state). |
| **4** | **Role badges in chat UI** | ~1 hour | UX cosmetic | Tag every AI message with "🤖 AI" and every human shop message with "👤 [Staff name]". Doesn't prevent the clash but reduces customer whiplash while clash exists. |

## Recommendation

**Ship #1 + #1.5 immediately**: a same-day fix that kills the visible bug. Plan #2 as the **durable replacement** to land within the next 1-2 weeks. Layer #3 + #4 once shop owners ask for explicit control — they will once #2 is live.

Why phased rather than jumping straight to #2:
- #1 is one repo file, one new SkipReason, ~20 lines. No DB migration.
- #2 needs a migration, a query, a write path on every human shop message, and a shop-dashboard toggle. Real work that benefits from doing it right.
- #1's failure mode (AI resumes after 30 min of staff silence) is rare and recoverable. Worth shipping a quick win that handles the common case.

## Detailed Plans

### Option 1 — Time-window heuristic (RECOMMENDED FIRST)

**Where it goes:** `AgentOrchestrator.handleCustomerMessage` in `backend/src/domains/AIAgentDomain/services/AgentOrchestrator.ts`, in the prefilter section before the Claude call. Sits next to the existing checks for `service_ai_disabled`, `shop_ai_disabled`, `spend_cap_exceeded`, etc.

**Logic:**
```typescript
// Pseudo
const recentHumanShopMsg = findMostRecentHumanShopMessage(ctx.conversationHistory);
if (recentHumanShopMsg) {
  const ageMinutes = (Date.now() - recentHumanShopMsg.createdAt.getTime()) / 60_000;
  if (ageMinutes < HUMAN_TAKEOVER_QUIET_MINUTES) {
    return { outcome: "skipped", reason: "human_takeover" };
  }
}
```

**Helper:**
```typescript
function findMostRecentHumanShopMessage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== "assistant") continue; // skip customer turns
    // "assistant" role = shop side in our chat model. AI vs human is in metadata.
    if (m.metadata?.generated_by === "ai_agent") continue; // it's the AI itself
    return m; // first shop msg WITHOUT the AI stamp = real human
  }
  return null;
}
```

**New SkipReason:**
```typescript
export type SkipReason =
  | "service_ai_disabled"
  | "shop_ai_disabled"
  | "spend_cap_exceeded"
  | "no_shop_settings"
  | "service_shop_mismatch"
  | "human_takeover"; // NEW
```

**Tunable:**
```typescript
const HUMAN_TAKEOVER_QUIET_MINUTES = 30;
```

**Audit log impact:** The skip path already writes an `ai_agent_messages` audit row with `escalatedToHuman: false, errorMessage: null`. We should write one for `human_takeover` skips so it's queryable from the admin dashboard ("how often is this firing?").

**Tests:** Add a unit test for `findMostRecentHumanShopMessage`:
- Returns null on empty history
- Returns null when only AI assistant messages exist
- Returns the message when a non-`generated_by:ai_agent` shop message is the most recent assistant
- Skips over interleaved customer/AI messages to find the human one further back
- Skips over older customer messages even if they're after the human (we only care about shop side)

Plus an orchestrator-level test: returns `{ outcome: "skipped", reason: "human_takeover" }` when a recent human shop message exists.

### Option 1.5 — Tighten rule #9 wording

Current rule #9 (in `PromptTemplates.ts`):
> If the customer asks whether you're an AI, a bot, or a real human (e.g. "are you AI?", "am I talking to a real person?", "is this a bot?"), confirm honestly...

Change to:
> If the customer asks whether you're an AI, a bot, or a real human **in their CURRENT message** (e.g. "are you AI?", "am I talking to a real person?", "is this a bot?"), confirm honestly... **NEVER volunteer your AI identity if the current message did not ask. Do NOT infer the question from history — even if earlier turns discussed "the human" or "the bot", that does not justify proactively re-disclosing.**

Add one or two negative few-shot examples:
- "im looking for bread training" → NOT a disclosure question → answer normally
- History contains "real human here" but current message is "what time tomorrow?" → NOT a disclosure question → answer normally

### Option 2 — Persistent pause state on conversations table

**Schema:**
```sql
-- backend/migrations/XXX_add_ai_paused_until.sql
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused_until TIMESTAMPTZ;

COMMENT ON COLUMN conversations.ai_paused_until IS
  'When set in the future, AI sales agent will NOT reply on this conversation. Auto-set to NOW() + 24h whenever a shop staff member sends a message (i.e., a shop-role message without metadata.generated_by=ai_agent). Cleared by the shop via the dashboard ''Resume AI'' control.';

-- Index used by the AI orchestrator prefilter
CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused_until
  ON conversations(ai_paused_until)
  WHERE ai_paused_until IS NOT NULL;
```

**Write path** (in `MessageRepository.createMessage` or a domain event hook):
```typescript
// When inserting a message:
//   - senderType = "shop"
//   - metadata.generated_by !== "ai_agent"
// → bump ai_paused_until on the conversation.
if (senderType === "shop" && metadata.generated_by !== "ai_agent") {
  await client.query(
    `UPDATE conversations SET ai_paused_until = NOW() + INTERVAL '24 hours'
     WHERE conversation_id = $1`,
    [conversationId]
  );
}
```

**Read path** (in orchestrator prefilter — replaces Option 1):
```typescript
const conv = await this.conversationRepo.getById(conversationId);
if (conv.aiPausedUntil && conv.aiPausedUntil.getTime() > Date.now()) {
  return { outcome: "skipped", reason: "ai_paused" };
}
```

**Frontend:**
- Add `aiPausedUntil?: string` to `Conversation` (API + UI types)
- Shop chat header shows "AI paused — Resume AI" button when set
- Customer sees no change (the AI just doesn't fire)

**Migration concerns:** Backward-compatible — column defaults to NULL on existing rows. Existing AI behavior unchanged for any conversation where no human has spoken.

**Choosing the pause window:**
- 24 hours: assumes shop staff who jumped in are owning that conversation for the rest of the day
- 7 days: more conservative; ensures the AI doesn't ambush a slow-moving human-handled thread
- "Until shop unpauses": no auto-resume. Cleanest UX but creates a tail of permanently paused conversations
- Recommendation: **24h auto-resume, manual unpause available**. Tunable in `ai_shop_settings`.

### Option 3 — Explicit "Take over" button

Builds on #2. Shop staff sees a button in the chat header:
- **Before takeover:** "🤖 AI is active · Take over"
- **After takeover:** "👤 You're handling this · Resume AI"

Clicking flips `ai_paused_until` to far future / NULL. Adds a system message in the thread: "Sarah from Peanut took over this conversation" / "AI sales assistant resumed".

**Why pair with #2:** the state is the same — the button just gives the shop staff an explicit control surface in addition to the implicit "you sent a message" trigger.

### Option 4 — Role badges in chat UI

Tagging each shop message with the actual sender — pulls `metadata.generated_by` to distinguish:
- Has `generated_by === "ai_agent"` → render with a small "🤖 AI" pill
- Otherwise → render with "👤 [Staff name]" pill (sourced from a new `messages.metadata.staff_name` or the auth context at insert time)

This doesn't prevent the clash but makes it visually unambiguous WHO said what. Useful even alongside #2 — a paused conversation still has historical AI + human messages mixed, and the badges keep the trace readable.

## Rollback Plan

### Option 1 (time-window heuristic)
- **L1**: feature flag `HUMAN_TAKEOVER_DETECTION_ENABLED` constant in the orchestrator. Flip to false → AI fires on every customer message as before. Zero deploy.
- **L2**: `git revert <commit>` — single file (`AgentOrchestrator.ts`), one new SkipReason in `types.ts`, one new test file.

### Option 2 (persistent pause state)
- **L1**: feature flag `AI_PAUSE_STATE_ENABLED`. When off, the read path skips the check; the write path still updates the column (so no data is lost during the off period).
- **L2**: revert the read path only — keeps the data, disables the gating. Forward-compatible.
- **DB rollback**: the column is nullable and has no constraints. Dropping it is safe but unnecessary; leave it for forensics.

### Failure modes that would trigger rollback
| Failure | Rollback level | Reason |
|---|---|---|
| AI silent on conversations where shop staff never joined (false positive) | L1 flag flip | Detection logic bugged |
| Customer waits >30 min for AI to resume after staff goes silent (Option 1) | Accept + bump window OR migrate to #2 | Expected behavior of #1; if customer complaints surface, push #2 forward |
| Human takeover state stuck — AI never resumes even after staff confirms done | Manual SQL update for affected convs + investigate write path | Option 2 specific |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shop staff sends one welcome message then walks away → AI permanently silent (Option 2 with no auto-resume) | High | High — customer abandonment | Use 24h auto-resume window; tunable per shop |
| False positive: a system message inserted by some other code path lacks `generated_by:ai_agent` and gets misread as human | Low | Medium — AI goes silent unexpectedly | Audit all server-side message inserts to ensure system messages have a distinct `generated_by` value (e.g., `"system"`) so the detector can exclude them |
| Race condition: human staff message and AI message both in flight; AI's was started before the human's was received | Low | Low | Acceptable — happens once per takeover; AI's reply lands, then it stops |
| Customer doesn't realize AI has paused and waits for AI-style response | Low | Low | Optional system message "AI assistant has paused this conversation. A team member will respond shortly." (Option 3 polish) |

## Open Questions for Owner

1. **Pause window**: 24h auto-resume the right default, or something different?
2. **Per-shop tunability**: should each shop be able to set their own "AI quiet" window in `ai_shop_settings`?
3. **Customer-visible UX**: should the customer see a system message when the AI pauses, or stay silent and let the human take over invisibly?
4. **Re-engagement**: when AI resumes after 24h, should it post a "I'm back if you have more questions" message, or wait for the next customer turn?

## Out of Scope (Known Gaps to Address Later)

- **Shop-initiated proactive AI mode** (shop staff drafts a reply with AI assistance, then sends manually). Different problem.
- **Multi-staff handoff inside the shop** (Sarah hands to John). Solved by #4 (role badges) when implemented.
- **Customer asking explicitly for a human while AI is active**. Already handled by `EscalationDetector` → `outcome: "escalated"` — not part of this scope.

## Success Criteria

1. After a shop staff member sends a message, the AI does not reply to subsequent customer messages within the chosen quiet window.
2. The AI never volunteers "I'm an AI assistant" unless the customer's current message explicitly asks (Bug B).
3. Audit log surfaces `human_takeover` / `ai_paused` skips so we can quantify how often takeovers happen.
4. Shop staff can resume AI on demand (Option 2/3) without waiting for the auto-resume timer.
5. Zero new false-positive AI replies after takeover during a 2-week observation window post-deploy.
