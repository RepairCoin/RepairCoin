# Bug: Service marketplace completion does not trigger referral reward distribution

**Status:** Open
**Priority:** High
**Est. Effort:** 30-45 minutes (primary fix) + 30 min (backfill) + 5 min (idempotency verification) = ~75 min total
**Created:** 2026-04-20
**Updated:** 2026-05-04 (re-verified open in code; added live test evidence on staging; added prerequisites + tightened backfill scope)

---

## Problem

When a referred customer (referee) completes their first booking through the **service marketplace** flow (customer books a service, pays via Stripe, shop marks the order completed), the referral remains `status='pending'` forever. Neither the referrer's 25 RCN bonus nor the referee's 10 RCN bonus is distributed.

The referral system was built around a legacy "shop issues manual repair reward" flow. The service marketplace flow — which is now the primary path for customers to earn RCN — does not call the referral-completion handler. Every referral whose referee uses the service marketplace to complete their first repair gets stuck pending indefinitely.

This is a separate bug from `completed/bug-customer-name-referral-field-mismatch.md` (commit `272ef9f8`, which fixed the mobile-side field-name mismatch that was preventing referral *records* from being created at all). The mobile-side fix is working: referral rows are being created correctly at registration time. What doesn't work is the *completion* step once the referee starts earning.

---

## ⚠️ Prerequisites — verify these BEFORE applying the fix

The fix below assumes `completeReferralOnFirstRepair` is idempotent. If it's not, the fix will double-pay bonuses on edge cases (webhook retries, order-status flapping cancel→re-complete, manual re-trigger after admin intervention). Verify both items below before committing the fix.

### P1 — Idempotency check (5 min, mandatory)

Read `backend/src/services/ReferralService.ts` around the `completeReferralOnFirstRepair` method (currently around line 219). Confirm the function:

1. **Checks the referral row's `status` BEFORE paying** — if the row is already `status='completed'` (or any non-pending state), it returns `{ referralCompleted: false }` without re-minting bonuses.
2. **Uses a transaction OR a unique constraint** to prevent double-payment if the function is called twice in parallel (e.g., two webhook retries firing simultaneously).
3. **Validates that `metadata.awaitingFirstRepair === true`** — the row must be in the awaiting state to be eligible for completion.

Decision matrix:

| What you find | Action |
|---|---|
| Function checks status + early-returns when not pending | ✅ Idempotent. Proceed to the fix. |
| Function checks status but no transaction/lock | ⚠️ Single-call idempotent but vulnerable to concurrent double-fire. Acceptable for now if `service.order_completed` is published exactly once per order. Add a TODO to harden later. |
| Function does NOT check status before paying | ❌ STOP. Add the status check FIRST in a separate commit. Then apply the marketplace fix. Otherwise webhook retries will multiply bonuses. |

### P2 — Verify the bug is still present (30 sec)

Run:
```bash
grep -rn "completeReferralOnFirstRepair\|getReferralService" backend/src/domains/token/ --include="*.ts"
```

Expected output: zero matches. If you see any matches in `token/services/TokenService.ts` or `token/TokenDomain.ts`, someone already shipped a fix and this doc is stale — STOP and re-investigate before duplicating the work.

---

## Root Cause

Two separate completion code paths exist in the backend. Only one calls `completeReferralOnFirstRepair`.

### Path A — manual repair reward (legacy, referral-aware)

`backend/src/domains/shop/routes/index.ts:2417-2435`, inside the `POST /api/shops/:shopId/issue-reward` handler:

```ts
// After successful atomic reward issuance
try {
  const referralResult = await getReferralService().completeReferralOnFirstRepair(
    customerAddress,
    shopId,
    repairAmount
  );
  if (referralResult.referralCompleted) {
    referralMessage = 'Referral bonus distributed! Referrer received 25 RCN, customer received additional 10 RCN.';
    logger.info('Referral completed on first repair', { customerAddress, shopId, repairAmount });
  }
} catch (referralError) {
  logger.error('Error checking referral completion:', referralError);
}
```

This path works. A referee whose shop manually issues them a repair reward correctly triggers `completeReferralOnFirstRepair`, which pays out both bonuses and moves the referral to `status='completed'`.

### Path B — service marketplace completion (referral-blind)

`backend/src/domains/ServiceDomain/controllers/OrderController.ts:350-420` — when an order is marked `completed`, the controller publishes a `service.order_completed` event to the domain event bus.

`backend/src/domains/token/TokenDomain.ts:28, 102-147` — `TokenDomain` subscribes to `service.order_completed` and calls:

```ts
const result = await this.tokenService.processServiceMarketplaceEarning(
  customerAddress, totalAmount, shopId, orderId
);
```

`backend/src/domains/token/services/TokenService.ts:169` — `processServiceMarketplaceEarning` mints the RCN for the service completion, applies the tier bonus, emits `token.service_minted`, and returns. **There is no call to `completeReferralOnFirstRepair`, `processReferralReward`, or anything referral-related in this method.** Verified via grep — the entire file has zero references to `completeReferral*` or `processReferral*` outside of a single internal `processReferralReward` method that no one calls from the service-marketplace path.

### Net effect

A customer who signs up with a valid referral code and completes their first service through the marketplace (the dominant flow) ends up in this state:

- `customers.referred_by` populated (mobile fix works)
- `referrals` row created, `status='pending'`, `metadata.awaitingFirstRepair=true` (mobile fix works)
- Service order completes, customer gets their base service RCN earning (this path works)
- **No referral bonus**, **no status update**, **referrer never rewarded** (the bug)

---

## Evidence — live test case on staging

Reproduction captured 2026-04-20 by manual test:

- Referrer: **Qua Ting** (`0x6cd036477d1c39da021095a62a32c6bb919993cf`), referral code `UM9W57BM`
- Referee: **anna.cagunot@gmail.com** (`0xc04f08e45d3b61f5e7df499914fd716af9854021`), registered 2026-04-20 05:23 with referral code `UM9W57BM`
- Booking: **BK-232D12** (`ord_7b79ff0c-b379-4053-b386-d48c19232d12`) at shop `peanut`, $99, status `completed`, completed 2026-04-20 05:27

| Expected | Actual in DB |
|---|---|
| Referral row created linking Anna ← Qua Ting | ✅ row id=37 created, referrer=Qua Ting, referee=Anna |
| Anna receives 10 RCN base service earning | ✅ transaction row `mint 10.00` for "Service marketplace completion - $99" |
| Anna receives additional 10 RCN **referee bonus** | ❌ no such transaction exists |
| Qua Ting receives 25 RCN **referrer bonus** | ❌ Qua Ting's balance still 161 (unchanged from pre-test) |
| Referral row transitions to `status='completed'` | ❌ still `pending`, `reward_amount=0`, `referee_bonus=0`, `completed_at=null` |
| Qua Ting's Referrals screen shows the referral as "completed" | ❌ shows "pending" — matches user's manual-test report |

---

## Fix Required

### Primary fix — wire referral completion into service-marketplace earning

**File:** `backend/src/domains/token/services/TokenService.ts`, inside `processServiceMarketplaceEarning` (around line 169), after the earning mint succeeds and the tier bonus is applied, but before the method returns.

```ts
// ... inside processServiceMarketplaceEarning, after successful mint + tier bonus ...

// Trigger referral completion if this is the referee's first repair.
// Wrapped so a referral-side failure does not roll back the earned RCN.
try {
  const referralService = getReferralService();
  const referralResult = await referralService.completeReferralOnFirstRepair(
    customerAddress,
    shopId,
    serviceAmount   // use the service amount as repair-equivalent
  );
  if (referralResult.referralCompleted) {
    logger.info('Referral completed on first service marketplace booking', {
      customerAddress, shopId, orderId
    });
  }
} catch (referralError) {
  logger.error('Error checking referral completion after service marketplace earning:', referralError);
  // Do not re-throw — keep the successful earning intact.
}
```

Placement rules:
- **After** the earning is successfully minted and the customer's tier is updated. Referral completion should not fire if the main earning failed.
- **Before** the method returns. So callers see a fully-settled state.
- **In its own try/catch.** A referral-processing failure (e.g., referrer wallet unreachable, referrals table issue) must never revert the customer's legitimate service earning.

### Alternative placement — in the event subscriber

An equally valid option is to call `completeReferralOnFirstRepair` from `TokenDomain.handleServiceOrderCompleted` (`backend/src/domains/token/TokenDomain.ts:102`) after `processServiceMarketplaceEarning` resolves successfully. That keeps `TokenService` focused on the mint logic and moves the cross-service orchestration into the domain subscriber. Either placement works; team preference decides.

Do **not** put it inside `OrderController.markOrderStatus` — that path fires the `service.order_completed` event which is also consumed by notifications, messaging, and group tokens. Putting referral processing there would couple an order-controller update to the referral service and duplicate the "did we already process" checks.

### Defensive — call order verification inside `completeReferralOnFirstRepair`

Optional hardening in `ReferralService.completeReferralOnFirstRepair`: accept an optional `orderId` argument and verify the order exists + has `status='completed'` + belongs to `customerAddress`. Prevents the function from firing against half-finalised or cancelled orders if called from future code paths.

```ts
// In ReferralService
async completeReferralOnFirstRepair(
  customerAddress: string,
  shopId: string,
  repairAmount: number,
  orderId?: string   // new optional param
): Promise<{ referralCompleted: boolean }> {
  // ... existing awaitingFirstRepair + lookup logic ...
  // If orderId supplied, confirm it's legitimately completed before paying bonuses.
}
```

Not strictly required for the fix; file separately if team wants it.

---

## Backfilling Existing Pending Referrals — REQUIRED before closing this task

The primary fix only helps **future** completions. Referrals that were created under the broken flow will remain `status='pending'` unless backfilled. Known stuck rows on staging as of 2026-05-04:

- referral id=37 — Anna (`0xc04f08e45d3b61f5e7df499914fd716af9854021`) ← Qua Ting (`UM9W57BM`)
- referral id=38 — Deo Nuts (`0x3d4841b6e2b1f49ef54ea7a794328582c6d5c14d`, `testdeo016@gmail.com`) ← Lee Ann (`U2LYCTFY`, `0x960aa947468cfd80b8e275c61abce19e13d6a9e3`)

There are likely more on prod that we haven't enumerated.

> **Skipping the backfill ships a half-fix.** New referrals after the deploy will work, but every customer who registered with a referral code and completed their first marketplace booking BEFORE the deploy stays stuck — referrer never paid 25 RCN, referee never paid the 10 RCN welcome bonus. Silently disadvantages early adopters of the referral funnel. **Apply backfill alongside the primary fix; don't punt to a follow-up.**

### Option 1 — manual per-row fix (quickest for the staging test cases)

Admin/DB operator runs `ReferralService.completeReferralOnFirstRepair(<referee>, <shopId>, <repairAmount>)` directly, or invokes the admin endpoint if one exists. Suitable while only a handful of pending-but-should-be-complete rows exist on staging.

### Option 2 — one-time backfill script (REQUIRED for prod)

Before rolling out the backend fix to production, run a script that scans for stuck referrals and completes them:

```sql
-- Candidates: pending referrals whose referee has at least one completed service_order
SELECT r.id, r.referee_address, r.referrer_address, r.metadata,
       (SELECT MIN(so.created_at) FROM service_orders so
        WHERE LOWER(so.customer_address) = LOWER(r.referee_address)
          AND so.status = 'completed') AS first_completed_order
FROM referrals r
WHERE r.status = 'pending'
  AND r.metadata->>'awaitingFirstRepair' = 'true'
  AND EXISTS (
    SELECT 1 FROM service_orders so
    WHERE LOWER(so.customer_address) = LOWER(r.referee_address)
      AND so.status = 'completed'
  );
```

For each row returned, call `completeReferralOnFirstRepair`. This catches every referee who already completed a service marketplace booking under the broken flow.

### Option 3 — skip backfill, accept data loss

**NOT RECOMMENDED.** If the team explicitly decides bonuses for stuck referrals aren't worth the backfill effort, leave existing pending referrals as-is. This silently disadvantages every early adopter who followed the referral funnel correctly and is exactly the kind of decision that erodes trust in the referral feature. Only choose this if there's an explicit business sign-off and a documented apology / make-good plan for affected users.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/domains/token/services/TokenService.ts` (or `backend/src/domains/token/TokenDomain.ts`) | Call `getReferralService().completeReferralOnFirstRepair(customerAddress, shopId, serviceAmount)` after successful service-marketplace earning, wrapped in try/catch so referral failures don't void the earning |
| `backend/src/services/ReferralService.ts` | *(optional)* accept optional `orderId` arg and verify order completion state — defensive hardening only, not required for the fix |
| Backfill script (new file, `backend/src/scripts/backfill-pending-referrals.ts` or similar) | One-time script that completes pending referrals whose referees already have completed service_orders — run before/as part of prod deploy |

No mobile changes. No DB schema changes.

---

## Verification Checklist

### Core fix

- [ ] **Fresh referee test case:** create a new customer using an existing referrer's code, have them book and complete a service marketplace order. After the order is marked `completed`:
  - Referrer's `customers.current_balance` increases by 25 RCN
  - Referee's `customers.current_balance` increases by 10 RCN (in addition to the base service earning)
  - `referrals` row transitions to `status='completed'` with `completed_at`, `reward_amount=25`, `referee_bonus=10` populated
  - Two new `transactions` rows: one for referrer with reason like "Referral bonus - referee first repair", one for referee with reason like "Referral welcome bonus"
- [ ] **Legacy path still works:** shop issues a manual repair reward via `POST /api/shops/:shopId/issue-reward` for a referee — referral still completes correctly (no regression in `shop/routes/index.ts:2417` path)
- [ ] **Double-fire safety:** if the same order is somehow reprocessed, referral is not completed twice. `completeReferralOnFirstRepair` must be idempotent — if the row is already `status='completed'`, it returns `{ referralCompleted: false }` without double-paying
- [ ] **Failure isolation:** simulate a failure inside `completeReferralOnFirstRepair` (e.g. throw in the service). The referee's base service earning is still minted correctly; only the referral bonus is skipped; error is logged but request succeeds

### Backfill script (if implementing Option 2)

- [ ] Dry-run mode prints every candidate row without modifying the DB
- [ ] Live run completes each eligible referral, using the referee's earliest-completed service_order as the trigger-equivalent
- [ ] Script is idempotent — running it twice doesn't double-pay
- [ ] For the specific test case (Anna ← Qua Ting, referral id=37): row transitions to `completed`, Qua Ting gets 25 RCN, Anna gets additional 10 RCN

### Cross-flow consistency

- [ ] Referrer sees the referral as "completed" in the mobile Referrals screen (not "pending")
- [ ] Referrer's recent-referrals list correctly counts completed vs pending referrals
- [ ] Referee's transaction history shows two separate entries for the first service: the base service earning and the welcome referral bonus

---

## Notes

- **Relation to other referral docs:**
  - `completed/bug-customer-name-referral-field-mismatch.md` — mobile-side fix (commit `272ef9f8`). Fixed the mismatch that was preventing referral rows from being *created at all*. **Remains correctly closed.**
  - `bugs/15-04-2026/bug-customer-name-not-saved-field-mismatch.md` — related sibling bug (customer name field) that's already verified fixed on `origin/prod`.
  - **This doc is not a supersede.** It describes a distinct backend bug whose symptoms surfaced only because the mobile fix is now working and creating referral rows that never complete. Before the mobile fix, no rows existed to get stuck.
- **User-facing impact and priority rationale:**
  - Referrals are a growth-marketing primitive — broken distribution silently disadvantages every advocate (Qua Ting) and every newcomer (Anna) who followed the documented flow.
  - Service marketplace is the dominant completion path (Stripe-paid service bookings). Manual repair-reward is the legacy path. Most real users will hit the broken flow, not the working one.
  - No data corruption, no security risk — pure reward-distribution miss. Marked **High** rather than **Critical** on that basis, but bump to Critical if referral volume is a business KPI.
- **Why the legacy path survived the refactor:** the referral call at `shop/routes/index.ts:2417` predates the service marketplace feature. When the marketplace shipped, its completion flow went through a new event-driven path (`service.order_completed` → `TokenDomain` → `TokenService.processServiceMarketplaceEarning`) that was modelled on `processRepairEarning` but did not pick up the referral-completion step. The existing code has no lint or test that would have flagged the gap.
- **Out of scope for this task:**
  - An audit of every other completion-triggered side-effect (notifications, group tokens, tier promotions, no-show clearance) to confirm they're wired to BOTH paths. Worth a separate investigation task — this specific bug may not be the only such gap.
  - Moving the referral-completion call to a shared listener on `service.order_completed` and/or a synthetic `repair.completed` event that both paths publish. Cleaner long-term architecture, larger change. File as an enhancement after the fix lands.
- **Test customer for QA on staging (once deleted and re-registered):** use Qua Ting's current referral code (`UM9W57BM`) on a freshly-created wallet + email pair; book a service at any shop via marketplace; mark completed. The described verification items should all pass.

---

## Verified live on staging — 2026-05-04

Re-verified the bug exists in code and reproduced live on staging today. Adding fresh evidence:

### New test case captured 2026-05-04 14:21:51 PHT

- **Referrer (Lee Ann):** `0x960aa947468cfd80b8e275c61abce19e13d6a9e3`, email `ac_baniqued@yahoo.com`, referral code `U2LYCTFY`
- **Referee (Deo Nuts):** `0x3d4841b6e2b1f49ef54ea7a794328582c6d5c14d`, email `testdeo016@gmail.com`, registered 2026-05-04 14:13 PHT using code `U2LYCTFY`
- **Booking:** `BK-2D458A` → `ord_2fa8b575-3379-4840-b07a-1f70f92d458a` at shop `dc_shopu`, $69, status `completed`, completed 2026-05-04 14:21:51 PHT (4 minutes after creation)

### Live DB state confirms the bug

| Expected | Actual |
|---|---|
| Lee Ann (referrer) gets 25 RCN | ❌ no transaction; her last activity was a 2026-03-16 redemption |
| Deo Nuts (referee) gets 10 RCN base service earning | ✅ `mint 10.00` recorded with reason "Service marketplace completion - $69", metadata `{"source":"service_marketplace","tierBonus":0,"baseTokens":10,"totalTokens":10}` |
| Deo Nuts (referee) gets ADDITIONAL 10 RCN referee welcome bonus | ❌ no second transaction |
| Referral row id=38 transitions to `status='completed'` | ❌ still `status='pending'`, `reward_amount=0`, `referee_bonus=0`, `completed_at=null`, `metadata.awaitingFirstRepair=true` |

### Code state confirmed open

```
$ grep -rn "completeReferralOnFirstRepair" backend/src/domains/token/
(no matches)
```

Only legacy caller remains: `backend/src/domains/shop/routes/index.ts:2419` (manual repair reward). The marketplace path is still uninstrumented.

### Post-fix re-test plan (use this after applying the primary fix on staging)

1. Run the backfill (Option 2 in the Backfill section) — referral id=37 and id=38 should both transition to `status='completed'` with bonuses paid out
2. Verify Lee Ann's balance increased by 25 RCN
3. Verify Deo Nuts's balance increased by an ADDITIONAL 10 RCN (so her transaction list shows TWO mints: the existing 10 RCN service marketplace + a new 10 RCN referee bonus)
4. Verify referral row id=38: `status='completed'`, `reward_amount=25`, `referee_bonus=10`, `completed_at` populated
5. Delete `testdeo016@gmail.com` again (use `backend/scripts/delete-customer-by-email.ts`), re-register fresh with code `U2LYCTFY`, book another service, mark completed → confirm the FIX path (not just the backfill) works for new completions

If steps 4 and 5 both pass, fix is verified end-to-end on staging. Promote to prod, run the same backfill query against prod, and re-verify with a small spot-check sample.

### Files / scripts available at handoff time (2026-05-04)

- `backend/scripts/check-customer-by-email.ts` — read-only customer lookup with related-data summary
- `backend/scripts/delete-customer-by-email.ts` — safety-gated customer purge for re-test
- `backend/scripts/investigate-booking-rewards.ts` — pulls order + customer + transactions + referral row + referrer transactions for a given booking ID (BK-XXXXXX or full ord_*)

These are useful for both pre-deploy diagnosis and post-fix verification. Currently in working tree, untracked.
