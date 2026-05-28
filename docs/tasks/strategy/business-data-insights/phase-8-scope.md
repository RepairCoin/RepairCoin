# Business-Data Insights — Phase 8 Scope (Inventory Tools)

**Status:** Draft scope. Not yet planned-out into implementation.
**Created:** 2026-05-28.
**Builds on:** Phase 7 (`phase-7-scope.md`, `phase-7-implementation.md`) — Insights tabs / pinned / anomalies / multi-domain breadth.
**Companion to:** existing Insights surface — adds 3-4 new tools to `services/insights/registry.ts` following the established pattern.

---

## 1. Goal

Let shop owners ask **inventory questions** through the existing Business-Data Insights panel — natural-language Q&A like:

- *"Do I have enough iPhone 14 screens for this week?"*
- *"What's running low?"*
- *"What inventory items are turning over fastest?"*
- *"Is my inventory shrinking?"*

The data is already in the database (`inventory_items`, `inventory_adjustments`, `inventory_categories`, `inventory_vendors` from migration 109 + the v2 enhancements from migration 117). Today shops can only see it through the dedicated Inventory tab in the dashboard — they can't ASK questions about it. Phase 8 closes that gap.

Inventory is the missing leg of the "ask the AI about my business" promise. Revenue, customers, services, bookings, AI impact, tier distribution, RCN balance, cancellations, repeat customers, time-of-day — all covered in Phases 1-7. Inventory is the obvious next thing a shop owner would want to ask about.

---

## 2. What's already in place (don't rebuild)

- **Inventory data layer.** `InventoryRepository.ts`, `inventory_items` + `inventory_adjustments` tables, the v2.1 enhancement from migration 117. Production data is in good shape.
- **Existing services that query inventory.** `LowStockAlertService.ts` already does the "items at or below safety stock" query for nightly email digests. The SQL is proven; Phase 8 reuses it for the Insights tool.
- **Insights infrastructure.** `services/insights/registry.ts`, `dispatcher.ts`, `types.ts`, `tools/` folder pattern. New tools drop in following the existing template (each tool = one file + one registry line).
- **Insights audit + spend cap.** `ai_insights_messages` table captures every tool call; spend cap shared with other shop-side AI. No new audit infrastructure.
- **Display rendering.** Frontend `InsightsToolCallCard.tsx` already branches on `display.kind`. The new inventory tools use existing display kinds (`number`, `list`, `table`, `comparison`) — no new visual primitives needed.

---

## 3. New tools — proposed inventory toolkit

Four tools cover the 80% of inventory questions shop owners actually ask. Each follows the existing `BusinessInsightsTool` shape (input schema + `execute()` returning `{ data, display }`).

### 3.1 `inventory_summary`

**Answers:** *"How much stock do I have?"* / *"What's my total inventory value?"*

**Input:** none (or optional `category` filter).

**SQL shape:**
```sql
SELECT
  COUNT(*) FILTER (WHERE current_stock > 0) AS items_in_stock,
  COUNT(*) FILTER (WHERE current_stock = 0) AS items_out_of_stock,
  COUNT(*) FILTER (WHERE current_stock <= safety_stock_threshold) AS items_low_stock,
  SUM(current_stock * unit_cost) AS total_inventory_value
FROM inventory_items
WHERE shop_id = $1
  AND is_active = true
```

**Display:** `kind: "list"` — three items (in-stock count, low-stock count, out-of-stock count) + total value as a sub-line.

### 3.2 `low_stock_items`

**Answers:** *"What's running low?"* / *"What do I need to reorder?"*

**Input:** `limit` (default 10) — top N low-stock items.

**SQL shape:** reuses the query already in `LowStockAlertService.ts` (deliver via the Insights tool path instead of the email digest path).

**Display:** `kind: "table"` — columns `[Item, Current, Safety, Vendor]`, rows = top N items at or below threshold.

### 3.3 `inventory_turnover`

**Answers:** *"What inventory is selling fastest?"* / *"What's not moving?"*

**Input:** `range` (e.g. `"30d"`, `"90d"`), `by` (`"fastest"` or `"slowest"`).

**SQL shape:**
```sql
SELECT
  i.item_id,
  i.item_name,
  i.current_stock,
  SUM(ABS(a.quantity_change)) FILTER (WHERE a.adjustment_type = 'consumption') AS units_used,
  ...
FROM inventory_items i
LEFT JOIN inventory_adjustments a ON i.item_id = a.item_id
WHERE i.shop_id = $1
  AND a.created_at >= NOW() - INTERVAL '$range'
GROUP BY i.item_id
ORDER BY units_used DESC (or ASC) LIMIT 10
```

**Display:** `kind: "table"` — columns `[Item, Used in window, Current stock, Estimated days remaining]`.

### 3.4 `inventory_value_trend`

**Answers:** *"Is my inventory shrinking?"* / *"How much have I spent on stock this month?"*

**Input:** `range` (`"7d"`, `"30d"`, `"90d"`).

**SQL shape:** sum of `inventory_adjustments.quantity_change × unit_cost` grouped by date over the window, plus prior-window comparison.

**Display:** `kind: "comparison"` (already exists from Phase 7.1) — current-window value vs prior-window value with sentiment indicator (decrease in value = potential cash issue; increase = restocking activity).

---

## 4. Phasing

Single phase, 2-3 days of focused engineering. Could split if needed.

### Phase 8.1 — Tool implementations (1.5-2 days)

- 4 new files under `services/insights/tools/`:
  - `inventoryStockSummary.ts`
  - `lowStockItems.ts`
  - `inventoryTurnover.ts`
  - `inventoryValueTrend.ts`
- Each follows the existing `BusinessInsightsTool` shape (see `revenueSummary.ts` for the template).
- Each reuses `InventoryRepository` queries where possible; new SQL only when the existing repo methods don't match.
- Add to `services/insights/registry.ts` — 4 new entries.

### Phase 8.2 — Prompt rules update (~0.5 day)

- `services/InsightsPromptBuilder.ts` "What you can answer" section — add the inventory question categories so Claude knows to pick the new tools.
- Update the decline-copy escape so inventory questions DON'T trigger the decline path (which currently routes anything outside the toolkit to the Help assistant).

### Phase 8.3 — QA fixtures + tests (~0.5 day)

- Mirror `ai-marketing-campaigns/qa-fixtures/` pattern — small fixture script that seeds 10 inventory items + adjustments for a test shop, so the QA pass can reproduce all 4 tool outputs.
- Update `qa-test-guide.md` with 4 new test scenarios (one per tool) + a fifth scenario for the Claude-picks-the-right-tool routing.
- Existing Jest test pattern in `services/insights/tools/*.test.ts` applies; add tests per new tool.

### Out of scope for Phase 8

- **Anomaly detection on inventory signals** (e.g. *"your top-selling part dropped below safety stock yesterday"*) — separate Phase 8.5 or 9 enhancement. Reuses the existing `AnomalyDetector` pattern but adds inventory-specific signal definitions.
- **Inventory forecasting** (predict when an item will run out based on usage rate) — needs a forecasting model decision; defer.
- **Multi-shop inventory aggregation** for chain owners — different scope, different auth model.
- **Customer-facing inventory questions** (*"do you have my screen in stock?"*) — that's a Sales Agent (customer chat) tool, not Insights.
- **Inventory editing via Insights** — Insights is read-only. Adjusting stock counts happens in the Inventory tab UI (or via the manual adjustment flow). No AI-driven mutations.

---

## 5. Cost impact (small)

Adding 4 tools means the system prompt grows by their descriptions (~600-1000 tokens total). Per-question impact:

| Metric | Before Phase 8 | After Phase 8 | Delta |
|---|---|---|---|
| System prompt size | ~7,000 tokens | ~7,800 tokens | +800 tokens |
| Per-question cost (cached) | ~$0.015 | ~$0.016 | +$0.001 (~6%) |
| Per-shop monthly cost (heavy user @ 30 questions/mo) | $0.45 | $0.48 | +$0.03 |

**Net effect on the cost summary docs:** rounding error. Doesn't materially change any tier estimate ($3 / $12 / $36 / $42 stay where they are) or the spend cap recommendation. Worth noting in the next `ai-cost-summary.md` revision but not a forcing function for pricing.

**Vendor cost:** zero — uses the existing Anthropic integration (Claude Sonnet for the answer generation, same as every other Insights tool). No procurement.

---

## 6. Decisions to lock (4 open questions)

Recommendations in **bold**.

1. **Q1 — Which 4 tools land in Phase 8?**
   - Option A: **All 4 above (Recommended)** — covers 80% of inventory questions; mechanical to build.
   - Option B: Just `low_stock_items` + `inventory_summary` first, defer turnover + value trend. Smaller PR, lands faster.
   - Recommendation: A. The cost difference between 2 vs 4 tools is ~1 day of work; coherence is better with the full toolkit.

2. **Q2 — Should `inventory_summary` accept a category filter in v1?**
   - Option A: Yes — *"how much inventory in screens vs batteries?"*
   - Option B: **No (Recommended).** Add in v1.5 if shop owners ask for it. v1 returns aggregate-only.
   - Recommendation: B. Keep tool input schemas tight for v1; expand based on usage.

3. **Q3 — How does the "estimated days remaining" calculation in `inventory_turnover` work?**
   - Option A: Simple — `current_stock / (units_used_in_window / window_days)`. Linear assumption.
   - Option B: Use a more sophisticated trend that weights recent usage more heavily.
   - Recommendation: **A** — simple linear, surface as approximate ("~12 days at current pace"). Sophisticated forecasting is its own workstream.

4. **Q4 — Should low-stock items in the Insights response link to a "create purchase order" action?**
   - Option A: Yes — tap the row → opens PO creation form pre-filled
   - Option B: **No for v1 (Recommended)** — Insights is read-only by design; mutation flows live in the Inventory tab. Don't blur the boundary.
   - Recommendation: B. Cleaner separation. v1.5 can add deep-link if shop owners ask.

---

## 7. Acceptance criteria

A shop owner asks each of these questions in the Insights panel; Claude picks the matching tool; the response renders the expected display kind.

| Question | Tool fired | Display rendered |
|---|---|---|
| *"How much inventory do I have?"* | `inventory_summary` | `list` — 3 items (in-stock, low, out) + total value |
| *"What's running low?"* / *"What do I need to reorder?"* | `low_stock_items` | `table` with item / current / safety / vendor columns |
| *"What inventory's turning over fastest?"* | `inventory_turnover` (by=fastest, range=30d) | `table` with item / used / current / days remaining |
| *"What's not moving?"* | `inventory_turnover` (by=slowest, range=30d) | same shape, different sort |
| *"Has my inventory value dropped this month?"* | `inventory_value_trend` (range=30d) | `comparison` with current month vs prior month value + sentiment |
| *"How do I add an item to my inventory?"* (out-of-scope question) | None — Insights returns decline copy pointing at Help assistant | (no inventory tool fires) |

All four tools also need `suggest_followups` chips that propose related questions after the answer (e.g., after `low_stock_items`, chips might be *"Show fastest-moving items"* / *"What's my inventory value trend?"*).

---

## 8. Risks (small, all manageable)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stock counts in production differ from "what shops believe they have" — bad data leads to bad answers | Medium | Surface the data as-recorded ("according to your inventory records") — Insights doesn't validate; it reports |
| Shops with empty inventory (haven't adopted the Inventory feature) get unhelpful answers | High | Each tool's empty-result path returns a clear *"You don't have inventory items configured yet — visit the Inventory tab to add some"* response |
| `inventory_turnover` returns nothing for items with no `consumption` adjustments (only `purchase` or `manual_adjustment`) | Medium | Validate the SQL handles this; consumption-only filter is correct but flag if `adjustment_type` enum changes over time |
| Token cost grows unpredictably as more tools land | Low — small constant per tool | Each tool description is bounded (~150-250 tokens); 4 tools = ~800 tokens added; pattern stays sustainable |
| Claude confuses inventory tools with revenue/order tools when the question is ambiguous | Medium | Tool descriptions are explicit about distinct domains; QA scenario 6 in §7 catches this with the routing test |

---

## 9. Effort summary

- **Phase 8.1** — Tool implementations: 1.5-2 days
- **Phase 8.2** — Prompt rules: 0.5 day
- **Phase 8.3** — QA fixtures + tests: 0.5 day
- **Total v1:** **~2.5-3 days**

Phasing fits cleanly inside a single sprint cycle. No new infrastructure, no new vendor, no new audit table — pure tool addition.

---

## 10. Why this is worth doing

Inventory is the most-asked-about business signal that the current Insights surface can't answer. Shop owners check stock weekly (often daily for fast-moving items like phone screens). A natural-language *"what do I need to reorder?"* answer in 5 seconds is genuinely useful — and unlocks an obvious upgrade path: once Phase 8 lands, anomaly detection on inventory signals (Phase 8.5/9) becomes a small follow-up that catches *"your iPhone 14 screens just dropped below safety stock"* automatically.

For the voice-AI-dispatcher workstream, this also matters: voice + inventory queries are a natural pair. Shop owner on the shop floor with dirty hands says *"what do I need to order this week?"* and gets a useful answer without touching keyboard or scrolling tabs. That UX story is dramatically stronger once inventory is in the router's INSIGHTS classification.

The cost is negligible. The implementation is mechanical. The user value is high. Worth landing alongside or shortly after the voice dispatcher work.

---

## 11. Next step

1. Lock the 4 decisions in §6
2. Write `phase-8-implementation.md` with per-task checkboxes (mirror `phase-7-implementation.md`)
3. Phase 8.1 first — 4 tool files + registry entries, no UX changes
4. Phase 8.2 + 8.3 land as a single PR with the tools (small enough to bundle)

No code work until §6 decisions land + a quick smoke-check that `InventoryRepository` exposes everything the 4 tools need (it likely does; the existing `LowStockAlertService` already queries the same shape).
