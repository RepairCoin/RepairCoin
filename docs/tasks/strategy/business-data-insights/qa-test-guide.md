# QA Test Guide — Business-Data Insights

**Feature:** POST /api/ai/insights + frontend Insights panel.
**Target:** local dev (`npm run dev`), shop role on the `peanut` shop
(or any shop with at least some service_orders + transactions).
**Last updated:** 2026-05-25 (added §10 anomaly banner + §11 pinned queries).

This guide walks every contract the feature promises. Run the
scenarios in order — later ones depend on data set up by earlier
ones (e.g. follow-up carryover assumes a prior tool call exists).

Skip with intent — if you skip a scenario, write down which one and
why, since downstream scenarios may behave unexpectedly without it.

**Synthetic-data scripts:** §10 + §11 scenarios that need rigged
test data have ready-to-run TypeScript fixtures in `./qa-fixtures/`.
See `./qa-fixtures/README.md` for the script-per-scenario table and
run instructions. Each scenario below also documents the inline SQL
if you'd rather paste it into a DB client.

---

## 0. Setup

1. Backend + frontend both running locally (`npm run dev`).
2. Logged into the shop dashboard as a shop with real data
   (recommended: `peanut` — 108 orders, $7,783.02 lifetime revenue,
   AI sales conversations on record).
3. DB tail open in a second window so you can verify audit rows:
   ```sql
   SELECT id, shop_id, session_id, model, input_tokens, output_tokens,
          cost_usd, jsonb_array_length(tool_calls) AS n_tools, latency_ms,
          error_message, created_at
   FROM ai_insights_messages
   WHERE shop_id = 'peanut'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
4. Optional: open browser devtools Network tab filtered to `/api/ai/insights`
   so you can inspect the response payload directly.

---

## 1. Launcher visibility + opening

### 1.1 Launcher present (shop role)
- Log in as a shop owner. Look at the top-right action cluster.
- **Expect:** a round yellow icon with a bar-chart icon
  (`BarChart3` from lucide-react), **AFTER** the help-question-mark
  icon (Help first, Insights second).

### 1.2 Launcher hidden for non-shop roles
- Log in as a customer (or admin).
- **Expect:** no bar-chart icon in the action cluster.

### 1.3 Sheet opens cleanly
- Click the bar-chart icon.
- **Expect:** right-side slide-over opens, dark theme, title
  "Business Insights", subtitle "Ask about your shop's revenue,
  customers, services, and AI assistant impact."
- **Expect:** the input textarea has focus (you can start typing
  without clicking).

### 1.4 Empty-state starter chips
- Fresh panel (no prior chat).
- **Expect:** see "Ask about your business." headline + 4 starter
  chip buttons:
  - "How much did I earn last week?"
  - "Who are my top 5 customers?"
  - "Which services are most popular?"
  - "What's the breakdown of my bookings this month?"
- **Expect:** clicking a chip submits the question immediately (no
  intermediate edit step).

---

## 2. Per-tool happy paths

Each scenario: ask the question → wait for reply → verify display + audit row.

### 2.1 `revenue_summary` (number display)

**Ask:** "How much did I earn last week?"

**Expect:**
- Assistant prose mentions a dollar amount (e.g. "Your shop made
  $2,117.00 in the last 7 days across 7 paid+completed orders.").
- One data card under the bubble: `number` kind.
  - Large yellow primary text: `$2,117.00` (or whatever current
    7-day data shows).
  - Small label above: "Revenue (last 7 days)".
  - Small sub below: "7 paid + completed orders" (count varies).
- Range chip above input: `Range: LAST 7 DAYS` in a small uppercase
  pill, right-aligned. **NEW from Phase 4.5 — this must be visible.**

**DB:**
```sql
-- Latest row should show:
--   model = claude-sonnet-4-6
--   n_tools = 1
--   tool_calls[0].tool = 'revenue_summary'
--   tool_calls[0].args.range = '7d'
SELECT tool_calls FROM ai_insights_messages
WHERE shop_id = 'peanut' ORDER BY created_at DESC LIMIT 1;
```

### 2.2 `top_customers` (table display + below-threshold flag)

**Ask:** "Who are my top 5 customers?"

**Expect (post-defaults-fix):**
- **Single-turn answer.** Claude should NOT ask "by what metric?"
  or "over what window?" before answering. The defaults fix in
  rule 5 of the prompt commits to `range: '30d'`, `by: 'spend'`,
  `limit: 5` when the user doesn't say.
- Assistant prose states the assumption inline — something like
  "In the last 30 days, your top 5 customers by spend are…"
- Data card: `table` kind with columns `#`, `Customer`, `Spend`.
- 5 (or fewer) rows ranked descending. Customer names are resolved
  via the COALESCE chain (real name → first+last → email →
  `0xabcd…wxyz` truncated wallet).
- Range chip flips to `Range: LAST 30 DAYS`.

**If peanut's last-30-days data is sparse**, expect the
**below-threshold warning** in the assistant's prose: "the sample
is small (only N data points) so this number isn't reliable yet"
— prompt rule 7 firing on `sampleN < 5` (only applies to
ai_assistant_impact, but for top_customers the same intent prevents
overclaiming on tiny datasets).

### 2.3 `top_services` (table display)

**Ask:** "Which services are most popular?"

**Expect:**
- **Single-turn answer** (post-fix). Defaults: `range='30d'`,
  `by='revenue'`, `limit=5`.
- Prose: "In the last 30 days, your top services by revenue are…"
- Data card: `table` with columns `#`, `Service`, `Revenue`.
- Service names humanized (no raw `srv_…` IDs unless the service
  was deleted — then it shows `(deleted service srv_abcd1234…)`).
- Range chip: `Range: LAST 30 DAYS`.

### 2.4 `bookings_breakdown` (list display + canonical statuses)

**Ask:** "What's the breakdown of my bookings this month?"

**Expect:**
- Data card: `list` kind.
- First row: `Total bookings` with a count.
- Followed by ONE ROW PER CANONICAL STATUS:
  `Completed`, `Paid (awaiting completion)`, `Pending`, `Cancelled`,
  `No-show`, `Expired`, `Refunded`.
- Statuses with zero rows show **`0`** (not `0 (0.0%)`).
- Statuses with non-zero rows show `count (X.X%)` — e.g.
  `45 (33.3%)`.
- Range chip: `Range: LAST 30 DAYS`.

### 2.5 `ai_assistant_impact` (list display + truth-vs-dashboard)

**Ask:** "How is my AI sales assistant doing this month?"

**Expect:**
- Data card: `list` kind.
- Items in order: `Window`, `AI conversations`, `Bookings
  generated`, `Revenue generated`, `Conversion rate`,
  `Customers recovered`, `Time saved`, `Avg AI response time`.
- **If `sampleN < 5`**: a trailing `⚠ Low sample` row appears AND
  the assistant prose flags it up front (per prompt rule 7).
- Cross-check: open the AI Sales Agent **Impact Metrics**
  dashboard tab. The numbers in the chat card should **exactly
  match** the dashboard for the same window. If they don't, it's
  an aggregator bug (see Phase 2.5 wrapper contract).

---

## 3. Cross-cutting behaviors

### 3.1 Follow-up time-range carryover

Sequence:
1. "How much did I earn last week?" → revenue_summary with range='7d'.
2. **Follow up with:** "What about top customers?"

**Expect:** Claude calls `top_customers` with `range='7d'` (NOT 30d),
reusing the prior window. The range chip stays at `LAST 7 DAYS`.

Sequence (explicit range change):
1. "Revenue this month?" → revenue_summary with range='30d'.
2. "And the last 90 days?"

**Expect:** Claude calls `revenue_summary` with `range='90d'`. Chip
flips to `LAST 90 DAYS`.

### 3.2 Multi-tool single turn

**Ask:** "Show me revenue and the bookings breakdown for the last 30 days."

**Expect:**
- One assistant bubble with one prose summary referencing both
  metrics.
- TWO data cards directly under it: a `number` (revenue) AND a
  `list` (bookings breakdown).
- Audit row's `tool_calls` JSONB has length 2.

### 3.3 Out-of-scope decline (exact copy)

**Ask:** "How do I create a service?" (this is a how-to question,
not a data question).

**Expect:** Assistant replies with **exactly**:
> "I can answer questions about your shop's revenue, bookings,
> customers, services, and AI assistant impact. For other questions,
> try the **Help** assistant."

No tool calls. No data card. Audit row's `tool_calls` is `[]`.

### 3.4 Out-of-scope decline — variant

**Ask:** "What's the weather today?"

**Expect:** same decline copy, no tool call.

### 3.5 Conversion >100% honest phrasing (Phase 2.3 caveat)

**Ask:** "Which service has the highest conversion rate?"

**Expect:**
- If a service has more paid bookings than AI conversations (very
  likely on peanut — AQua Tech showed 1300% during dev), the data
  card displays something like `1300.0% (13/1)`.
- Claude's prose should phrase it honestly — e.g. "AQua Tech shows
  13 paid bookings against just 1 AI conversation, which means
  most bookings came from outside the AI flow" — **NOT** rounded
  to "100%" and **NOT** presented as a typo.
- This is prompt rule 6 firing. If Claude rounds or hides the
  oddity, the prompt needs tuning.

### 3.6 Below-threshold flag (Phase 2.5)

This is harder to force unless the shop has < 5 AI conversations
in the window. peanut typically has 4 across all windows, which
triggers it.

**Ask:** "How is my AI assistant doing?"

**Expect:**
- `data.belowThreshold === true` in the response payload
  (devtools).
- Card has a trailing `⚠ Low sample` warning row.
- Assistant prose **leads with the caveat** ("the sample is small
  — only 4 AI conversations in this window, so this isn't reliable
  yet"), then quotes the metrics.

---

## 4. Display-variant rendering checks

Open the panel, run one question per variant, eyeball the card.

| Variant | Test question | Visual check |
|---|---|---|
| `number` | "How much did I earn this month?" | Large yellow figure, small label above, small sub below. Digits aligned (tabular-nums). |
| `table` | "Top 5 customers" | Header row in muted gray, rank column muted, data rows in white-ish, value column right-aligned numerically. Horizontal scroll if narrow. |
| `list` | "Bookings breakdown last week" | Label/value pairs, label left-truncated if long, value flex-shrink so it never gets crowded out. |
| `sparkline` | _(no v1 tool returns sparkline yet — defer)_ | n/a |

---

## 5. Range chip behaviors

### 5.1 Chip hidden before any tool call
- Open a fresh panel.
- **Expect:** no chip anywhere (no tool has run yet).

### 5.2 Chip shows after first tool call
- Ask "How much did I earn last week?"
- **Expect:** chip appears: `Range: LAST 7 DAYS`.

### 5.3 Chip updates on subsequent calls
- Then ask "What about the last 30 days?"
- **Expect:** chip flips to `Range: LAST 30 DAYS`.

### 5.4 Chip tooltip
- Hover the chip.
- **Expect:** native browser tooltip: "Follow-up questions will
  reuse this range unless you specify a different one."

### 5.5 Chip on multi-tool turn
- Ask "Show me revenue and bookings for the last 90 days."
- **Expect:** chip shows the LAST tool's range — `LAST 90 DAYS`
  (both tools used 90d, so consistent here; if Claude ever
  mixes ranges within one turn, the last one wins).

---

## 6. Error paths

### 6.1 Validation failure (400)

- Open browser devtools console. Manually POST a bad body:
  ```js
  fetch('/api/ai/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('shopToken')}` },
    body: JSON.stringify({ sessionId: '', messages: [{ role: 'user', content: 'hi' }] }),
  }).then(r => r.json()).then(console.log);
  ```
- **Expect:** `{ success: false, error: '\`sessionId\` must be a non-empty string' }`.

### 6.2 Auth failure (401)
- Same fetch but with no `Authorization` header.
- **Expect:** `{ success: false, error: 'Shop ID required' }` (401).

### 6.3 Spend cap exhausted (429)
- Skip unless you can rig a test row in `ai_shop_settings` where
  the shop's monthly spend > monthly budget. Verified via mocked
  smoke test (Phase 3.3 case 6); manual reproduction optional.

### 6.4 Claude failure (503)
- Force by temporarily setting an invalid `ANTHROPIC_API_KEY` in
  the backend env, restart, retry a question.
- **Expect:** the panel shows "AI service is temporarily
  unavailable. Try again in a moment."
- **Verify audit:** the audit row for that attempt should have
  `response_payload = NULL`, `error_message` populated,
  `latency_ms = NULL`.
- Restore the API key after testing.

### 6.5 Conversation message-limit
- Ask 15 questions in a single panel session (= 30 messages).
- **Expect:** at 30 messages, the input is disabled with
  placeholder "Conversation full — close to start fresh". Closing
  and reopening the panel mints a new sessionId.
- Note: the cap was bumped from Help's 20 → 30 specifically for
  insights (drill-down/analytics use pattern needs more headroom).
  Per-session cost is still bounded by the monthly per-shop spend
  cap so a chatty session can't burn the budget.

---

## 7. Audit-log spot checks

After running the scenarios above, run:

```sql
SELECT
  session_id,
  jsonb_array_length(tool_calls) AS n_tools,
  cost_usd,
  input_tokens,
  output_tokens,
  cached_input_tokens,
  latency_ms,
  error_message,
  created_at
FROM ai_insights_messages
WHERE shop_id = 'peanut'
ORDER BY created_at DESC
LIMIT 20;
```

**Expect:**
- One row per question asked (including failures).
- Multiple rows share the same `session_id` within one panel open.
- `n_tools` matches what you saw in the UI per question (0 for
  declines, 1 for typical questions, 2+ for multi-tool turns).
- `cached_input_tokens > 0` from the SECOND question onward in a
  session (system prompt cache hit — drops cost ~90%).
- `latency_ms` is wall-clock total across all loop iterations
  (typically 2000-6000ms for a 1-tool question).
- `error_message` is NULL except for forced-failure tests.

Also inspect one row's `tool_calls`:
```sql
SELECT jsonb_pretty(tool_calls)
FROM ai_insights_messages
WHERE shop_id = 'peanut' ORDER BY created_at DESC LIMIT 1;
```

**Expect:** each entry has `tool`, `args`, `display` (with `kind`),
`latencyMs`, and optionally `error`. No `result.data` (excluded
from audit on purpose — it would duplicate what Claude saw).

---

## 8. Visual / polish checks

- **Auto-scroll:** ask 3+ questions; the latest message should
  always be visible (smooth scroll to bottom).
- **Markdown:** assistant replies with `**bold**` should render
  bold. With `1. item / 2. item` should render as a numbered list.
- **Long replies:** the bubble should wrap, not overflow horizontally.
- **Footer text:** "Answers are based on your shop's live data.
  The assistant can only see your own shop." stays anchored below
  the input.
- **Bubble alignment:** user messages are right-aligned yellow,
  assistant messages are left-aligned dark with a border.
- **Cards:** sit DIRECTLY under the assistant bubble, not floating
  somewhere else.

---

## 9. What to capture if something fails

For any failed assertion:
1. **Screenshot** of the panel state.
2. **devtools Network tab** — the request body + the full response
   JSON (especially the `toolCalls` array).
3. **Backend logs** — search for `InsightsController:` or
   `dispatchTool` for the question's session_id.
4. **Audit row** SQL query result for that session.
5. **One-line summary** of what you expected vs what you got.

Attach those and ping me. The 5 things together usually pin the
cause to controller / prompt / tool / display / wire in under one
roundtrip.

---

## 10. Anomaly banner (Phase 7.2.16/7.2.17)

The nightly cron at `03:00 UTC` walks every shop and detects
week-over-week anomalies on 5 starter metrics: `weekly_revenue`,
`weekly_no_shows`, `weekly_cancellations`, `weekly_ai_conversations`,
`weekly_bookings`. Each flagged row gets phrased by Claude (short
Sonnet call, spend-cap gated) and persisted to
`ai_insights_anomalies` with a 14-day expiry. The frontend banner
surfaces up to 3 active rows at the top of the chat tab.

Because the cron only fires nightly, most §10 scenarios are tested
by **manually inserting a synthetic anomaly row** for your shop
and then opening the panel. The detector/phraser pipeline itself
is covered by jest in `backend/tests/ai-agent/insights/`.

### 10.0 Setup — synthetic anomaly insert

```sql
-- High-severity, fully phrased anomaly. Adjust shop_id to your test shop.
INSERT INTO ai_insights_anomalies
  (shop_id, metric_key, current_value, prior_value,
   delta_value, delta_pct, severity,
   claude_phrasing, follow_up_question, expires_at)
VALUES
  ('peanut', 'weekly_no_shows', 8, 2, 6, 300, 'high',
   'No-shows tripled this week — 8 vs 2 last week. Worth a look.',
   'Which services had the most no-shows this week?',
   NOW() + INTERVAL '14 days');
```

Verify the insert:
```sql
SELECT id, shop_id, metric_key, severity, claude_phrasing IS NOT NULL AS phrased,
       dismissed_at, expires_at
FROM ai_insights_anomalies
WHERE shop_id = 'peanut' AND dismissed_at IS NULL AND expires_at > NOW()
ORDER BY detected_at DESC;
```

### 10.1 Banner hidden when no active anomalies

- Soft-dismiss every active row first:
  ```sql
  UPDATE ai_insights_anomalies
  SET dismissed_at = NOW()
  WHERE shop_id = 'peanut' AND dismissed_at IS NULL;
  ```
- Reopen the Insights panel.
- **Expect:** no banner; Chat tab shows the EmptyState starter
  chips as if nothing had happened. Pinned tab unaffected.

### 10.2 Banner appears for a fresh anomaly

- Run the 10.0 insert.
- Open the panel (or close + reopen if already open — the banner
  fetch fires on every mount via the Sheet's open lifecycle).
- **Expect:**
  - One row at the top of the Chat tab, above the messages list
    and above the EmptyState starter chips.
  - Red-toned border + left bar (high severity).
  - AlertTriangle icon, red-400 tint.
  - Phrasing text: "No-shows tripled this week — 8 vs 2 last week.
    Worth a look."
  - "Tell me more" chip in red-300, with a right-arrow icon.
  - "Detected just now" recency hint to the right of the chip.
  - Dismiss X in the top-right corner.

### 10.3 Severity color mapping

For each severity, insert one row and confirm the visual:

| Severity | Border tone | Left bar | Icon tint | Chip text tint |
|---|---|---|---|---|
| `low`    | `amber-700/40` | `amber-500/70` | `amber-400` | `amber-300` |
| `medium` | `orange-700/50` | `orange-500` | `orange-400` | `orange-300` |
| `high`   | `red-700/60` | `red-500` | `red-400` | `red-300` |

Recipe — three inserts with different severities:
```sql
INSERT INTO ai_insights_anomalies
  (shop_id, metric_key, current_value, prior_value,
   delta_value, delta_pct, severity, claude_phrasing,
   follow_up_question, expires_at)
VALUES
  ('peanut', 'weekly_revenue',         3200, 2500,  700,  28, 'low',
   'Revenue ticked up 28% week-over-week.',
   'Which services drove this week''s revenue?',
   NOW() + INTERVAL '14 days'),
  ('peanut', 'weekly_cancellations',     5,    2,    3,  150, 'medium',
   'Cancellations 2.5x'' ed this week — 5 vs 2.',
   'Which services had the most cancellations this week?',
   NOW() + INTERVAL '14 days'),
  ('peanut', 'weekly_no_shows',          8,    2,    6,  300, 'high',
   'No-shows tripled this week.',
   'Which services had the most no-shows this week?',
   NOW() + INTERVAL '14 days');
```

**Expect:** banner stacks all three rows, low → medium → high
ordering reflects `detected_at DESC` (most-recently-inserted at top).

### 10.4 Template fallback when `claude_phrasing` is NULL

Backend leaves the column NULL when the spend cap is exhausted or
the Claude call failed. Banner must degrade gracefully.

```sql
INSERT INTO ai_insights_anomalies
  (shop_id, metric_key, current_value, prior_value,
   delta_value, delta_pct, severity,
   claude_phrasing, follow_up_question, expires_at)
VALUES
  ('peanut', 'weekly_revenue', 1234, 500, 734, 147, 'medium',
   NULL, NULL,
   NOW() + INTERVAL '14 days');
```

**Expect:**
- Row renders with the medium-severity tone.
- Body text reads:
  `Your weekly revenue changed from $500 to $1,234 this week (+147%).`
  (currency formatting for `weekly_revenue`; counts for the other
  4 metrics.)
- **No "Tell me more" chip** — `follow_up_question` is null so the
  button is hidden.
- Recency hint + dismiss X still render.

### 10.5 "Tell me more" submit + auto-dismiss

- Insert the 10.0 row (or any row with a non-null
  `follow_up_question`).
- Open the panel. Switch to the **Pinned** tab to prove the
  follow-up handler returns you to Chat.
- Click "Tell me more".
- **Expect:**
  - Tab auto-switches to Chat.
  - The chip's `follow_up_question` text appears as a user bubble
    on the right.
  - The TypingBubble shows, then an assistant reply lands with
    one or more data cards (typically `bookings_breakdown` for the
    no-shows follow-up).
  - The banner row is gone — auto-dismissed before the submit.
- **Verify DB:**
  ```sql
  SELECT id, dismissed_at FROM ai_insights_anomalies
  WHERE id = '<the inserted row id>';
  ```
  `dismissed_at` is non-null.
- Close + reopen the panel. **Expect:** banner row stays gone.

### 10.6 Dismiss X — optimistic remove + server persistence

- Insert one row (10.0 recipe).
- Open the panel. Click the X in the top-right of the row.
- **Expect:** row disappears immediately (optimistic).
- **Verify DB:** `dismissed_at` set on that row.
- Close + reopen the panel. **Expect:** banner is empty (row stays
  dismissed across reopens).

### 10.7 Dismiss X — restore on network failure

- Hard scenario; easiest with devtools "Offline" throttling enabled
  before clicking X.
- **Expect:** row briefly disappears then reappears (panel restored
  the optimistic state because the POST failed). User sees the row
  is back, knows it didn't stick.

### 10.8 Dismiss X — 404 from server treated as success

- Manually mark the row dismissed via SQL FIRST:
  ```sql
  UPDATE ai_insights_anomalies SET dismissed_at = NOW()
  WHERE id = '<inserted row id>';
  ```
- Without reopening the panel (so the frontend still has the row
  in local state), click X on it.
- **Expect:** the POST returns 404 (server's existence-leak
  prevention path), but the row stays optimistically removed.
  No restore-flicker.

### 10.9 Max 3 anomalies cap

- Insert 5 active rows for the same shop.
- Open the panel.
- **Expect:** banner shows exactly 3 rows — the 3 most-recently-
  detected (`ORDER BY detected_at DESC`).
- After dismissing one of the visible three, the panel does NOT
  auto-promote a 4th into view. Next mount (close + reopen) will.

### 10.10 14-day expiry honored

- Insert a row with `expires_at = NOW() - INTERVAL '1 hour'`
  (already expired).
- **Expect:** banner does NOT show it (the GET filter is
  `expires_at > NOW()`).

### 10.11 Shop-scope isolation

- Insert an active anomaly row for a DIFFERENT shop:
  ```sql
  INSERT INTO ai_insights_anomalies
    (shop_id, metric_key, current_value, prior_value, delta_value,
     delta_pct, severity, claude_phrasing, follow_up_question, expires_at)
  VALUES
    ('aqua-tech', 'weekly_no_shows', 99, 1, 98, 9800, 'high',
     'Leaked test row.', 'Should not appear.',
     NOW() + INTERVAL '14 days');
  ```
- Log in as `peanut`, open the panel.
- **Expect:** `aqua-tech`'s row is NOT visible — the GET endpoint
  scopes via `WHERE shop_id = $1` from the JWT.

### 10.12 Pinned tab unaffected by banner state

- With active anomalies present, switch to the Pinned tab.
- **Expect:** banner is HIDDEN on the Pinned tab — it only renders
  on the Chat tab. Pinned tab content (list or empty state) takes
  the full vertical space.
- Switch back to Chat. **Expect:** banner re-appears.

### 10.13 Refetch on panel reopen

- Open the panel with one active row visible.
- Close the panel (click outside the Sheet or hit Esc).
- Insert a SECOND anomaly via SQL while the panel is closed.
- Reopen the panel.
- **Expect:** banner shows BOTH rows. The mount-effect's GET fires
  on every reopen because the Sheet remounts InsightsPanel.

---

## 11. Pinned queries (Phase 7.3)

Pin button sits on every InsightsToolCallCard except `follow_ups`
chip rows. Pinned rows live in `ai_insights_pinned_queries`,
shop-scoped, deduped on `(shop_id, question_text)`, capped at 50
per shop. Pinned tab renders them; tapping re-submits the question
through the normal chat pipeline and records the run.

### 11.0 Setup

Drop existing pins to start clean:
```sql
DELETE FROM ai_insights_pinned_queries WHERE shop_id = 'peanut';
```

### 11.1 Pinned tab — empty state

- Confirm 0 pins via SQL.
- Open the panel. Switch to the **Pinned** tab.
- **Expect:**
  - Centered pin-outline icon (`Pin` from lucide).
  - Headline: "No pinned questions yet."
  - Subtext: "Ask a question in the Chat tab, then tap **Pin** on
    the answer to save it here."
  - Tab badge shows nothing (no count).

### 11.2 Pin button on a card

- Ask a question that triggers a non-follow_ups card, e.g.
  "How much did I earn last week?"
- After the reply lands, look at the card header (right side, next
  to Expand).
- **Expect:**
  - A Pin button (lucide `Pin`) is visible.
  - Tooltip on hover: "Pin this question".
- Click Pin.
- **Expect:**
  - Button optimistically swaps to a green check icon for ~1.5s,
    then reverts to the Pin icon (already-pinned state).
  - Pinned-tab count badge ticks up: `Pinned (1)`.
  - No banner / error chrome on success.

### 11.3 Pin button hidden on `follow_ups` chip rows

- Ask a question that prompts Claude to suggest follow-ups (any
  drilldown question — the `suggest_followups` meta-tool fires on
  most analytical turns).
- Look at the chip row that appears below the data card.
- **Expect:** NO Pin button on the chip row itself; only on the
  data card above it.

### 11.4 Tab switcher + count badge

- With ≥ 1 pin, look at the tab switcher above the messages list.
- **Expect:**
  - Two tabs: `Chat` (with MessageSquare icon) and `Pinned` (with
    Pin icon + count badge).
  - Active tab has yellow underline (`border-[#FFCC00]`) +
    white text.
  - Inactive tab is gray.
  - Badge: yellow (`#FFCC00`/20 bg + `#FFCC00` text), tabular-nums.

### 11.5 Pinned tab — list state

- With 2-3 pins, switch to the Pinned tab.
- **Expect:** one row per pin showing:
  - Question text (full, wraps if long).
  - Below it: `Last run Xh ago — <80-char excerpt>` IF the pin has
    been run at least once. Otherwise no second line.
  - Small X in the top-right for unpin.
- Most-recently-pinned at the top (default `display_order = 0`,
  ordered by `pinned_at DESC` as secondary).

### 11.6 Tap-to-run flow

- From the Pinned tab, click anywhere on a pinned row's body (NOT
  the X).
- **Expect:**
  - Tab auto-switches to Chat.
  - Question text appears as a user bubble.
  - TypingBubble → assistant reply with appropriate cards.
  - After the reply lands, switch back to Pinned tab.
  - **The tapped pin's "Last run Xh ago" now reads "just now"** and
    the excerpt is the first ~80 chars of the new reply. (This is
    the optimistic in-memory update; the DB write happens via
    `recordPinnedRun` in the background.)
- **Verify DB:**
  ```sql
  SELECT id, last_run_at, last_response_excerpt
  FROM ai_insights_pinned_queries
  WHERE shop_id = 'peanut'
  ORDER BY last_run_at DESC NULLS LAST LIMIT 1;
  ```
  `last_run_at` updated within the last few seconds;
  `last_response_excerpt` ≤ 500 chars.

### 11.7 Unpin

- Click the X on a pinned row.
- **Expect:**
  - Row removed immediately from the list (optimistic).
  - Badge count decrements.
- **Verify DB:** `SELECT COUNT(*) FROM ai_insights_pinned_queries
  WHERE shop_id = 'peanut';` — count matches the UI.
- On network failure (devtools Offline): the row should reappear
  in the list (restore-on-failure path).

### 11.8 Dedupe — pinning the same text twice

- Pin "How much did I earn last week?" once.
- Ask the same question again, click Pin a second time on the new
  card.
- **Expect:**
  - No error.
  - Badge count does NOT increment (still N, not N+1).
  - `SELECT COUNT(*) FROM ai_insights_pinned_queries WHERE
    shop_id = 'peanut' AND question_text = 'How much did I earn
    last week?';` returns 1.
- The server returns the existing row's id; the frontend's local
  state already has it, so the `.some(p => p.id === created.id)`
  guard in `handlePin` keeps the list unchanged.

### 11.9 Pin cap — 50 per shop (409)

- Hard to reach manually; rig via SQL:
  ```sql
  INSERT INTO ai_insights_pinned_queries (shop_id, question_text)
  SELECT 'peanut', 'fake question ' || g.i
  FROM generate_series(1, 50) AS g(i);
  ```
- Now try to pin one more via the UI.
- **Expect:** the Pin button briefly turns red for ~2s (error
  state), then reverts. No row added to the DB.
- **Verify:** `SELECT COUNT(*) FROM ai_insights_pinned_queries
  WHERE shop_id = 'peanut';` still 50.
- Cleanup: `DELETE FROM ai_insights_pinned_queries WHERE shop_id
  = 'peanut' AND question_text LIKE 'fake question %';`

### 11.10 Pinned tab clean of chat chrome

- Switch to Pinned tab.
- **Expect:**
  - **No** range chip above the input (it's chat-only).
  - **No** input textarea + send button (chat-only).
  - **No** footer "Answers are based on your shop's live data…"
    line (chat-only).
  - **No** anomaly banner (chat-only).
- The Pinned tab should feel like a clean list view, not a chat
  surface.

### 11.11 Shop-scope isolation

- As `peanut`, pin one question.
- Log out, log in as a different shop (`aqua-tech`).
- Open the panel, switch to Pinned tab.
- **Expect:** `aqua-tech`'s Pinned list does NOT include
  `peanut`'s pin. The GET endpoint scopes via JWT shop_id.

### 11.12 Session lifecycle isolation

- Within one panel-open session, pin two questions.
- Close + reopen the panel.
- **Expect:** the Pinned tab still shows both pins (they're
  persisted server-side, not session-local).
- The chat (sessionId, turns) IS reset on reopen — but pins
  survive because they live in `ai_insights_pinned_queries`, not
  in component state.

---

## Acceptance summary

Phase 4 ships when:
- Sections 1, 2, 3, 5, 8 all pass cleanly (the user-facing surface).
- Section 4 verified for the 3 variants v1 tools actually emit
  (sparkline can wait — no v1 tool returns it yet).
- Section 7 confirms audit rows look correct.
- Section 6 — at minimum 6.1 + 6.2 verified manually; 6.3 + 6.4
  may stay as mocked-test coverage only.

Phase 7.2 banner ships when (already in prod since 2026-05-25):
- §10.1 + 10.2 + 10.3 confirm the visual contract across the three
  severity tones.
- §10.4 confirms template fallback renders when phrasing is NULL
  (real-world spend-cap / Claude-failure path).
- §10.5 + 10.6 confirm both submit paths ("Tell me more" and
  manual dismiss) clear the row server-side.
- §10.9 + 10.10 + 10.11 confirm the cap / expiry / scope guards.

Phase 7.3 pinned queries ships when (already in prod since
2026-05-22):
- §11.1 + 11.2 + 11.3 confirm pin-from-card UX.
- §11.6 confirms tap-to-run drops back to Chat AND records the run.
- §11.8 confirms dedupe — re-pinning is silent, never duplicates.
- §11.11 + 11.12 confirm shop scope + cross-session persistence.

Phase 5 (next) will turn these scenarios into automated Jest tests
under `backend/tests/ai-agent/insights/` and a Playwright spec for
the panel.
