# QA fixtures — AI Marketing Assistant

Synthetic-data scripts for testing the AI Marketing chat flow (Phase 5 of `implementation.md`). Use these to re-run the QA scenarios in `qa-test-guide.md` without waiting for real shop activity.

All scripts:
- Connect to the database `backend/.env` is pointed at — i.e., the live DigitalOcean Postgres. There is no separate staging DB. Run `cleanup.ts` when finished.
- Default to `SHOP_ID = 'peanut'`. Edit the constant at the top of each script if testing as a different shop.
- Tag every QA row with markers that distinguish from production data:
  - **Customer name** starts with `QA-MKTG-`
  - **Customer email** is `*@repaircoin.test` (RFC 6761 reserved TLD — never deliverable, so accidental real send is impossible)
  - **Transaction reason** is `AIMK-QA-<timestamp>`
- Cleanup matches on these markers — real customers and real transactions don't carry them, so cleanup is collision-free.

## How to run

```bash
cd backend
npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/<script>.ts
```

The nested `tsconfig.json` extends `backend/tsconfig.json` so `ts-node` resolves the imports correctly.

## Scripts

| Script | Purpose |
|---|---|
| `setup-marketing-fixtures.ts` | Seeds 10 synthetic customers + ~25 transactions covering all 3 v1 audience segments: top spenders (5 with descending spend $50–$1000), lapsed (3 with `last_visit` 100/130/180 days ago), active (2 with last_visit ≤5 days). Idempotent — re-run overwrites. |
| `reset-spend-cap.ts` | Resets `ai_shop_settings.current_month_spend_usd = 0` for the test shop. Use between scenarios if you've burned through the shared monthly budget and want to keep running QA. |
| `reset-daily-drafts.ts` | Deletes AI-origin draft campaigns for the test shop. Resets the 50-drafts/day guard without waiting 24h. Sent campaigns are untouched. |
| `cleanup.ts` | Removes all QA-marked rows (transactions, customers, AI campaigns, last-24h audit log entries). Production rows have no markers — safe. |

## Sequence for one full QA pass

```bash
# 1. Seed test data
cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/setup-marketing-fixtures.ts

# 2. Reset any stale cap counters
cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-spend-cap.ts
cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/reset-daily-drafts.ts

# 3. Run scenarios in qa-test-guide.md sections §1 → §8 via the shop dashboard
#    (tap the Megaphone launcher next to the Insights launcher)

# 4. Tear down
cd backend && npx ts-node ../docs/tasks/strategy/ai-marketing-campaigns/qa-fixtures/cleanup.ts
```

## Expected segment counts after setup

When `lookup_audience_count` runs against the seeded shop, expect:

| Hint | Resolves to | Count |
|---|---|---|
| "top 100 by spend" | `top_spenders` (top 20%) | **2** — Whale Alice + Regular Bob |
| "frequent visitors" | `frequent_visitors` (top 20%) | **2** — Whale Alice + Regular Bob (most visits) |
| "active in last 30 days" | `active_customers` | **7** (everyone except 3 lapsed) |
| "haven't booked in 90+ days" | `custom` with `minDaysSinceLastVisit: 90` | **3** — Frank, Grace, Henry |
| "all customers" | `all_customers` | **10** |

These exact counts let you verify the audience-segmentation prompt rule (`Q5 — default audience size = what the shop literally asked for`). If the shop asks for "top 100" with only 10 customers, the AI should resolve to the 2 top-spenders (top 20%) — not silently expand to all 10.

## Caveats

- **Synthetic emails won't deliver.** `@repaircoin.test` is RFC 6761 reserved and never resolves. This is deliberate — testing the send flow without spamming real customers. SendGrid will return delivery failures for these recipients; campaign goes `status='sent'` but `emails_sent` will be 0 and `emails_failed` will equal `total_recipients`. That's the expected outcome of QA pass — confirms the pipeline runs end-to-end without polluting real inboxes.
- **Wallet addresses are synthetic** (`0xdead000…00001` through `0xdead000…0000a`). Don't try to authenticate as these — they're DB-only.
- **No customer-side state.** These customers exist in `customers` + `transactions` only. No notification preferences, no order history, no `shop_customers` junction rows. The marketing audience query only joins through `transactions`, so this is sufficient for Phase 5 QA — extend if a later test needs the other joins.
