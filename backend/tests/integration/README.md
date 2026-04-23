# Integration Tests

These tests run against a real Postgres database. The no-show SQL integration
suite (`no-show-sql.test.ts`) is the primary audience — it exercises the UPDATE
statements that unit tests can't fully verify.

## When the suite runs

- **`TEST_DATABASE_URL` set** → all tests run against that database.
- **`TEST_DATABASE_URL` unset** → the suite is marked `.skip` silently. CI stays green without a test DB.

Never point `TEST_DATABASE_URL` at production. The tests write and delete rows matching the `0xtest_` wallet-address prefix plus a fixed `integration-test-shop` row in `shop_no_show_policy`. Collisions are unlikely but not impossible on a live DB.

## Local setup

```bash
# Create a throwaway DB
createdb repaircoin_test

# Point the setup at it
export TEST_DATABASE_URL=postgres://postgres@localhost:5432/repaircoin_test

# Run the migrations
npm run db:migrate

# Run just the integration suite
npx jest tests/integration/no-show-sql.test.ts
```

Or drop `TEST_DATABASE_URL=...` into `backend/.env.test` — `tests/setup.ts` loads that file before tests run.

## What's covered

- **Cascade reset (`NoShowPolicyService.recordSuccessfulAppointment`)**
  - Warning → Normal with full count wipe.
  - Caution → Warning (intermediate, count preserved).
  - Counter below threshold — only increments.
  - Normal / Suspended tiers untouched.
- **Suspension auto-lift (`SuspensionLiftService.processSuspensionLifts`)**
  - Past `booking_suspended_until` → cascades to `deposit_required`.
  - Future `booking_suspended_until` → untouched.
- **Dispute reversal (`reverseNoShowPenalty`)**
  - Marks row with `[DISPUTE_REVERSED]`, recomputes customer count/tier.

## What the suite does NOT cover

- The DB trigger at `backend/migrations/065_recreate_no_show_tables.sql:192–238`. It references `wallet_address` while the service code uses `address` — possible pre-existing inconsistency. The tests verify the service-level SQL, not the trigger.
- HTTP layer. Tests call services directly; auth, routing, and request validation are not exercised.

## Cleanup contract

After every test: delete any `customers`, `no_show_history`, and `notifications` rows whose address / receiver matches `LOWER(...) LIKE '0xtest_%'`.
After the full suite: delete the `shop_no_show_policy` row for `integration-test-shop` and close the shared pool.

If a test crashes mid-run, leftover rows with the `0xtest_` prefix may need manual cleanup. They are cosmetic; no foreign keys reference them.
