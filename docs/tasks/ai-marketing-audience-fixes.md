# AI Marketing — audience segmentation fixes

**Status:** Items 1 + 2 shipped 2026-05-27 (commits cd612833, 3822ec7d). Item 3 fix queued 2026-05-27 — audit showed it didn't actually need product alignment; ShopMetricsService analytics already uses service_orders.total_amount, the marketing query was the outlier. See bottom of doc for the applied fix.
**Symptom seen on:** shop "Peanut" testing the "Tell my top 50 customers about our latest service" prompt — card showed "1 customer match" labeled "Top 50 by spend".
**Severity:** Three separate issues stacked in one observation. Items 1 and 2 are correctness/UX bugs in v1; item 3 is a product decision.

---

## Background — what the QA test showed

User typed: *"Tell my top 50 customers about our latest service"*

What rendered:
- `audience_summary` card: **1 customer match** with label "Top 50 by spend"
- `campaign_draft` card aimed at that 1 customer (essentially "Lee Ann" — chosen because she happens to sort first when all 4 Peanut customers are tied at $0 spend)

Real data on Peanut (verified via `backend/scripts/check-peanut-customers.ts`):

```
Peanut customers: 4
  top_spenders (top 20%) = 1

  0x960aa9… "Lee Ann"     · spent $0.00 · 9 visits  · last 2026-05-18
  0x6cd036… "Qua Ting"    · spent $0.00 · 13 visits · last 2026-04-13
  0xe3e20b… "Mike "       · spent $0.00 · 7 visits  · last 2026-03-14
  0x150e4a… "(no name)"   · spent $0.00 · 7 visits  · last 2026-03-08
```

The card is technically correct given the math but misleading given what we promised the shop owner. Three distinct issues.

---

## Item 1 — `top_spenders` ignores the `limit` filter (BUG) — ✅ SHIPPED 2026-05-27 (cd612833)

Extended the same one-liner to `frequent_visitors` defensively — same bug class, same fix shape, zero behavior change for current call sites (the audience tool doesn't yet pass `limit` for frequent_visitors hints, but if it ever does the data layer is ready).

Original problem description preserved below for context.

---


**Where:** `backend/src/services/MarketingService.ts:280-285` (the `top_spenders` case in `getTargetAudience`).

**What:**

```ts
case 'top_spenders':
  const sortedBySpent = shopCustomers.sort((a, b) =>
    (b.totalSpent || 0) - (a.totalSpent || 0)
  );
  const topCount = Math.max(1, Math.ceil(sortedBySpent.length * 0.2));
  return sortedBySpent.slice(0, topCount);
```

The function ignores `audienceFilters.limit` entirely. Always returns top 20%, floor of 1.

**Conflict with prompt rule:**

`backend/src/domains/AIAgentDomain/services/marketing/promptBuilder.ts` rule 5:
> *"Default audience size = the shop's literal request ('top 100' → top 100, not 'top 20%')."*

The AI's `lookup_audience_count` tool resolves "top 50" → `audienceFilters: { limit: 50 }` and passes it through (`backend/src/domains/AIAgentDomain/services/marketing/tools/lookupAudienceCount.ts:165-170`). The query throws it away.

So the prompt rule is a promise the data layer can't keep. Shop owners ask for "top 50" and get back top 20% labeled "Top 50".

### Fix

Update the `top_spenders` case to honor `audienceFilters.limit` when present, fall back to top 20% when not:

```ts
case 'top_spenders': {
  const sortedBySpent = shopCustomers.sort((a, b) =>
    (b.totalSpent || 0) - (a.totalSpent || 0)
  );
  // Honor explicit `limit` from natural-language "top N" requests
  // (see promptBuilder.ts rule 5). Default to top 20% when no limit
  // is supplied — matches manual-builder UI behavior.
  const limit = typeof audienceFilters?.limit === 'number'
    ? audienceFilters.limit
    : Math.max(1, Math.ceil(sortedBySpent.length * 0.2));
  return sortedBySpent.slice(0, limit);
}
```

**Tests to add (or smoke):**
- Shop with 10 customers + `limit: 50` → returns all 10 (not 2)
- Shop with 10 customers + no limit → returns 2 (existing top 20% behavior preserved)
- Shop with 100 customers + `limit: 50` → returns 50
- Shop with 0 customers + `limit: 50` → returns 0 (no Math.max floor on the explicit-limit path)

**Effort:** ~15 min code + 10 min smoke test.

---

## Item 2 — UX: flag degenerate cases in the audience summary (BUG / UX) — ✅ SHIPPED 2026-05-27 (3822ec7d)

Two-layer fix landed:
- `lookup_audience_count` now returns `totalShopCustomers` (re-uses the existing `customerRepo.findByShopInteraction` call — no new query).
- `AudienceSummaryCard` renders an amber note when shop literally asked for "top N" (`audienceFilters.limit` set) AND `totalShopCustomers < N`.
- Prompt rule 5 tells Claude to surface "You have N customers in total, so your top 50 is the whole list — let's send to all N" in prose BEFORE drafting.

Original problem description preserved below for context.

---


**Where:** `frontend/src/components/shop/marketing-ai/MarketingToolCallCard.tsx:50-92` (the `AudienceSummaryCard`).

**What:**

When the shop owner asks for "top 50" but only has 4 customers, the card currently shows:
- Count: 1 (or after item 1 fix: 4)
- Label: "Top 50 by spend"

That's confusing — they asked for 50, the answer is 4. The card should make the "you have N total customers" context explicit.

**Same problem applies to:**
- `frequent_visitors` — "top 20%" of small N yields 1
- `active_customers` (last 30 days) — could trivially be 0 or 1 for low-traffic shops
- Custom `minDaysSinceLastVisit` — could be 0 if every customer is recent

### Fix

Two layers — code + prompt:

**Code (`AudienceSummaryCard` in `MarketingToolCallCard.tsx`):**

When `resolvedCount` is meaningfully smaller than what the shop asked for (heuristic: shop's name contains "top N" and N > resolvedCount × 2), append a one-line note:

```tsx
{shouldShowSmallShopNote(d) && (
  <p className="mt-1 text-[10px] text-amber-400">
    Your shop has {totalShopCustomers} customers total — that's why the
    segment is smaller than {askedFor}.
  </p>
)}
```

This requires the audience tool to ALSO return `total_shop_customers` so the card has it.

**Prompt (`promptBuilder.ts` rule 5):**

Add to rule 5:
> *"If the shop's customer base is smaller than the requested N (e.g., shop has 4 customers, shop asked for 'top 50'), say so explicitly in your prose ('You have 4 customers in total, so your top 50 is the whole list — let's send to all 4.') BEFORE drafting the campaign."*

This means even if the card UI lags the data, Claude's prose will explain the situation.

**Effort:** ~30 min code + prompt update + a turn or two of AI smoke-testing to confirm prose lands well.

---

## Item 3 — `type='redemption'` as spend signal (FIX APPLIED 2026-05-27)

**Audit finding:** Item 3 was filed as "needs product alignment" but the audit revealed alignment was already there. `ShopMetricsService.getTopCustomers` (admin analytics) already sources spend from `service_orders.total_amount`. Only the marketing `lookup_audience_count` query was using `transactions.type='redemption'` — that was the bug, not a design intent.

**Fix applied:** `CustomerRepository.findByShopInteraction` + `findByShopInteractionPaginated` updated to source `total_spent` from `service_orders.total_amount` (paid + completed) via parallel LEFT JOIN. Visit_count + last_visit still come from transactions (any token activity counts as a "visit"). Tier logic (Category A from the audit) untouched.

Behavior change: shops without redemption history now get meaningful `top_spenders` rankings based on actual dollars spent at the shop. Shops WITH redemption history shift to ranking by order amount instead — aligns with the analytics surface.

Original problem description and audit findings preserved below.

---

**Where:** `backend/src/repositories/CustomerRepository.ts:1070` (the `findByShopInteraction` query).

**What:**

```sql
SUM(CASE WHEN type = 'redemption' THEN amount ELSE 0 END) AS total_spent
```

`total_spent` is only summed across `transactions` rows where `type='redemption'`. For Peanut, NO customer has any redemption row — they have visits (7-13 each) but no redemption history. So every Peanut customer's `total_spent = $0.00`, and the "top spender" ranking is essentially the order Postgres returns the rows.

This is a real consideration for shops that:
- Haven't yet taken any RCN redemptions
- Have customers who book/visit but pay via Stripe/cash (no on-chain redemption)
- Are in a soft-launch where RCN redemption isn't the primary engagement signal

### Options for `total_spent` semantics

| Option | Definition | Pros | Cons |
|---|---|---|---|
| A — Status quo | Only `type='redemption'` counts | Honest signal of RCN usage; aligns with token-economy thesis | Shops without redemption history have empty rankings; AI marketing card looks broken |
| B — All transactions | SUM all transaction amounts regardless of type | Works for any shop with any activity | Mixes mints (rewards), redemptions (spend), tier_bonus, transfers — doesn't actually mean "spent" |
| C — Service orders | SUM `service_orders.total_amount` for paid orders | Reflects actual dollars-or-equivalent spent at the shop | Requires a different join; orders may not include walk-in / non-app transactions |
| D — Tier on a different signal | Use `visit_count` as the "top customers" ranking proxy instead of spend | Always works (every active customer has visits); not opinionated about RCN usage | Renames "top spenders" → "most frequent visitors", overlaps with existing `frequent_visitors` segment |

**Recommendation: get product alignment before changing this.** It affects:
- `top_spenders` segment
- The manual campaign builder UI (which also reads this column)
- Any insights dashboard or report that surfaces "lifetime value"
- The customer-tier promotion logic (Bronze → Silver → Gold based on lifetime earnings — same column?)

This isn't a "go fix it" task — it's a "schedule a design conversation" task.

### Suggested approach

1. Audit every consumer of `total_spent` / `lifetime_earnings` in the codebase (~30 min grep).
2. Document each consumer's actual need ("ranking only", "tier promotion threshold", "dashboard display").
3. Decide per-consumer whether `redemption`-only is the right signal or whether they should look at orders / visits / something composite.
4. If consumers diverge, may need separate computed columns (e.g., `total_redeemed_usd` vs `total_spent_usd`) instead of one overloaded `total_spent`.

**Effort:** investigation 1-2 hours + design discussion + implementation (depends on what we decide).

---

## Recommended order

1. **Item 1 first** — small, mechanical, fixes the prompt-rule mismatch. Standalone PR. Smoke against `setup-marketing-fixtures.ts` (10 seeded customers + `limit:50` should now return all 10).
2. **Item 2 second** — UX improvement that becomes more valuable once Item 1 is in (less risk of confusion when literal counts work). Standalone PR.
3. **Item 3 last (and slowest)** — product conversation first, then design, then code. Don't bundle with 1 or 2.

## Out of scope for this doc

- Adding a new `top_revenue` segment that ranks by service order amounts (would be a v1.5 / v2 feature, not a fix)
- Migrating away from the `transactions` table's mixed-purpose `type` column (architectural, not in scope)
- Cron-based recompute of segment caches if performance becomes an issue (premature — current scale doesn't need it)
