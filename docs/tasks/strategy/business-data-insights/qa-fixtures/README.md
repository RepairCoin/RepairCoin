# QA fixtures — Business-Data Insights §10 + §11 + §12

Synthetic-data scripts for re-running the anomaly banner (§10),
pinned queries (§11), and inventory toolkit (§12) manual QA scenarios
documented in `../qa-test-guide.md`. Use these when you can't wait
for the nightly cron to produce real anomalies, when you need to
verify a specific edge case (template fallback, max-3 cap, expiry
filter, etc.), or when you need a deterministic inventory dataset
to exercise the four Phase 8.1 tools.

All scripts:
- Are idempotent — safe to re-run.
- Hard-code `shop_id = 'peanut'` as the test shop. Edit the `SHOP_ID`
  constant at the top if you want to point them at a different shop.
- Connect directly to the database the backend's `.env` is pointed at
  (DigitalOcean Postgres). **There is no separate staging DB** — these
  inserts land in production. Run the relevant cleanup script when
  finished; see "Cleanup" section below.
- Use distinctive `claude_phrasing` markers (`ROW A — ...`,
  `Row #N — ...`, etc.) so cleanup can target only synthetic rows
  without touching real cron-generated data.

## How to run

```bash
cd backend
npx ts-node ../docs/tasks/strategy/business-data-insights/qa-fixtures/<script>.ts
```

The `tsconfig.json` in this folder extends `backend/tsconfig.json`,
which is why `npx ts-node` resolves cleanly from the new location
without a `--project` flag. CWD must be `backend/` so Node's module
resolution finds `pg`, `dotenv`, etc. in `backend/node_modules`.

## Scripts

| Script | Scenario | What it does |
|---|---|---|
| `qa-10-3-severity-matrix.ts` | §10.3 | Dismisses leftovers, inserts 3 rows (low / medium / high) with staggered `detected_at` so they sort high → medium → low |
| `qa-10-4-template-fallback.ts` | §10.4 | Inserts 1 row with `claude_phrasing = NULL` + `follow_up_question = NULL` — exercises the template-formatter path |
| `qa-10-9-max-cap.ts` | §10.9 | Inserts 5 active rows so the `LIMIT 3` cap can be verified across 3 stages (initial render, dismiss-without-promote, refetch-on-reopen) |
| `qa-10-10-11-expiry-and-scope.ts` | §10.10 + §10.11 | Inserts ROW A (control, peanut, active), ROW B (peanut, expired), ROW C (different shop, active). Only ROW A should be visible. |
| `qa-10-cleanup.ts` | §10 | Hard-deletes all synthetic test rows by phrasing-pattern match. Real cron data is untouched. |
| `qa-11-0-cleanup.ts` | §11.0 | Drops all pinned queries for the test shop — clean start for §11.1 empty-state test |
| `qa-11-9-pin-cap.ts` | §11.9 | Seeds exactly 50 `fake question N` pins so the 50-cap can be verified by attempting a 51st via the UI |
| `qa-11-9-cleanup.ts` | §11.9 | Hard-deletes the 50 `fake question N` pins by prefix match. Real user pins (anything not starting with "fake question ") stay intact. |
| `qa-12-inventory-setup.ts` | §12.1-§12.5 | Seeds 10 `QA-INV-%` inventory items (mix of in-stock / low / OOS / discontinued) + ~60 `AINV-QA-%` adjustments spread across current-30d / prior-30-60d / 60-89d windows. Idempotent — wipes prior QA-INV items first. Prints expected per-tool numbers as a read-back. |
| `qa-12-inventory-cleanup.ts` | §12 | Deletes adjustments matching `reason LIKE 'AINV-QA-%'` then items matching `name LIKE 'QA-INV-%'`. Real inventory rows on the test shop stay intact. |

## Suggested order for a full §10 + §11 + §12 walkthrough

1. `qa-10-3-severity-matrix.ts` — verify §10.3 → §10.5 → §10.6 → §10.1 (using these 3 rows)
2. `qa-10-4-template-fallback.ts` — verify §10.4
3. `qa-10-9-max-cap.ts` — verify §10.9 (all 3 stages)
4. `qa-10-10-11-expiry-and-scope.ts` — verify §10.10 + §10.11
5. `qa-10-cleanup.ts` — drop §10 synthetic data
6. `qa-11-0-cleanup.ts` — clean slate for §11
7. Pin manually via the UI for §11.1 → §11.8 + §11.10 + §11.12
8. `qa-11-9-pin-cap.ts` — verify §11.9
9. `qa-11-9-cleanup.ts` — drop §11.9 synthetic data
10. `qa-12-inventory-setup.ts` — seed inventory dataset for §12
11. Manually run §12.1 → §12.6 via the Insights panel
12. `qa-12-inventory-cleanup.ts` — drop §12 synthetic inventory data

## Cleanup safety

Cleanup scripts target only rows with the distinctive synthetic
markers I baked into the inserts. Real cron-generated anomalies and
user-pinned queries are matched by neither pattern, so they survive
cleanup runs untouched. The phrasing markers are:

- `'ROW A — ...'`, `'ROW B — ...'`, `'ROW C — ...'` (§10.10/11)
- `'Row #1 — ...'` through `'Row #5 — ...'` (§10.9)
- Three exact strings for §10.3 (severity-matrix fixtures)
- Composite key for §10.4's NULL-phrasing fixture (`metric_key='weekly_revenue'` + `current_value=1234` + `prior_value=500`)
- `'fake question %'` prefix for §11.9 pins
- `'QA-INV-%'` prefix on `inventory_items.name` for §12 items
- `'AINV-QA-%'` prefix on `inventory_adjustments.reason` for §12 adjustments

Cron-generated anomalies use Claude-written natural-language phrasing
that wouldn't collide with any of these patterns. Real inventory items
created by shops via the dashboard never start with `QA-INV-`, and
real inventory adjustments never carry an `AINV-QA-` reason — both
prefixes are exclusive to these QA fixtures.
