# Auto-Lift No-Show Suspensions

## Context

The customer no-show penalty system escalates a customer to `no_show_tier = 'suspended'` once their `no_show_count` crosses a shop's `suspension_threshold` (default 5), and sets `booking_suspended_until` to `NOW() + suspension_duration_days` (default 30 days). This tier escalation is handled by a DB trigger (`backend/migrations/065_recreate_no_show_tables.sql:192-238`) that fires on `INSERT INTO no_show_history`.

**Problem:** there is currently no mechanism to *lift* suspension when `booking_suspended_until` elapses. The DB row stays frozen at `tier='suspended'` with a past-date `booking_suspended_until` forever. Consequences:

- `frontend/src/components/customer/NoShowWarningBanner.tsx:54` switches purely on `tier === 'suspended'` and keeps rendering the gray "Account Temporarily Suspended" banner indefinitely, displaying a past date.
- `backend/src/services/NoShowPolicyService.ts:270` computes `canBook = booking_suspended_until > NOW()` at read time, so the customer *can* technically book — creating a UX contradiction with the banner.
- `EmailService.ts:1374` already tells customers "Suspension automatically lifts on ${suspensionEndDate}" and promises a `deposit_required` state with a refundable deposit and 48h advance booking — a promise the code doesn't keep.
- Analytics queries counting `tier='suspended'` customers (`NoShowPolicyService.ts:490-493`) overstate the real number.

**Outcome:** when `booking_suspended_until` passes, the customer should be automatically moved to the correct lower tier based on their remaining `no_show_count`, with `booking_suspended_until` cleared and a notification sent.

## Approach

Add a new scheduled service `SuspensionLiftService` that polls every 15 minutes for suspended customers whose timer has expired, downgrades them to the appropriate tier, and notifies them. Mirrors the existing `AutoNoShowDetectionService` pattern exactly.

**Target tier after lift** (cascade based on current `no_show_count` using default thresholds — same approach as `NoShowPolicyService.getOverallCustomerStatus`):

| `no_show_count` | New `no_show_tier` | `deposit_required` |
|---|---|---|
| `>= 3` (deposit threshold) | `deposit_required` | `TRUE` |
| `= 2` (caution threshold)  | `caution` | `FALSE` |
| `= 1` | `warning` | `FALSE` |
| `0` | `normal` | `FALSE` |

`no_show_count` is **not** reduced — the lift is time-served, not forgiveness. The customer must then complete successful appointments to drop further, handled by the existing `NoShowPolicyService.recordSuccessfulAppointment()` → `checkTierReset()` flow (lines 392-428). Realistic case after a fresh suspension: count is still ≥ 5, so the target is always `deposit_required`.

Why a cron (not lazy-on-read): the existing code already lazy-computes `canBook` at read time, which proves lazy isn't sufficient — the banner, analytics, and reports all see the stale tier. A cron keeps DB state truthful for every reader with no per-call-site patching.

## Files to Create

### 1. `backend/src/services/SuspensionLiftService.ts`

Class mirroring `AutoNoShowDetectionService` structure (`backend/src/services/AutoNoShowDetectionService.ts:58-77, 515-579`):

- Constructor instantiates `NotificationService` and holds `getSharedPool()` for DB access.
- `processSuspensionLifts()`: single UPDATE with RETURNING — atomic and idempotent:
  ```sql
  UPDATE customers
  SET
    no_show_tier = CASE
      WHEN no_show_count >= 3 THEN 'deposit_required'
      WHEN no_show_count >= 2 THEN 'caution'
      WHEN no_show_count = 1 THEN 'warning'
      ELSE 'normal'
    END,
    deposit_required = (no_show_count >= 3),
    booking_suspended_until = NULL,
    successful_appointments_since_tier3 = 0,
    updated_at = NOW()
  WHERE no_show_tier = 'suspended'
    AND booking_suspended_until IS NOT NULL
    AND booking_suspended_until <= NOW()
  RETURNING address, no_show_count, no_show_tier;
  ```
  Thresholds 2/3 match `getDefaultPolicy()` (NoShowPolicyService.ts:141-170) and `DisputeController.reverseNoShowPenalty` defaults (DisputeController.ts:723-732). `successful_appointments_since_tier3 = 0` resets the counter so `checkTierReset()` starts fresh from `deposit_required`.
- For each RETURNING row, call `NotificationService.createNotification` with `notificationType: 'suspension_lifted'`, following the pattern at `AutoNoShowDetectionService.ts:187-227`. Notification failures are caught and logged; they do not roll back the lift.
- `start()` / `stop()` / `getStatus()` identical to `AutoNoShowDetectionService:515-579` but with `INTERVAL_MS = 15 * 60 * 1000` (15 minutes — finer than 30m because suspension deadlines aren't aligned to cron boundaries).
- `start()` runs `processSuspensionLifts()` once immediately, then on interval.
- Report object `{ timestamp, customersChecked, customersLifted, notificationsSent, errors[] }` — matches `AutoDetectionReport` shape.

## Files to Modify

### 2. `backend/src/app.ts` (around line 755)

After the `getAutoNoShowDetectionService().start()` block, add:

```ts
const suspensionLiftEnabled = process.env.SUSPENSION_LIFT_ENABLED !== 'false';
if (suspensionLiftEnabled) {
  getSuspensionLiftService().start();
  logger.info('Suspension lift service started (every 15 minutes)');
} else {
  logger.info('Suspension lift service DISABLED via SUSPENSION_LIFT_ENABLED=false');
}
```

Feature-flag convention matches `AUTO_DETECTION_ENABLED` (app.ts:753). Import the service via a singleton accessor like `getSuspensionLiftService()` to mirror `getAutoNoShowDetectionService()`.

### 3. `frontend/src/components/customer/NoShowWarningBanner.tsx:54` (safety net)

Cron runs every 15 min, so there's a window where `booking_suspended_until < NOW()` but `tier` is still `'suspended'`. Add a client-side guard to suppress the suspended banner in that window:

```tsx
case 'suspended':
  const suspendedUntil = status.bookingSuspendedUntil
    ? new Date(status.bookingSuspendedUntil)
    : null;
  if (suspendedUntil && suspendedUntil <= new Date()) {
    return null; // cron will reconcile tier on next run
  }
  // ...existing suspended config
```

This avoids showing a gray "suspended until [past date]" banner during the up-to-15-min reconciliation window.

### 4. `deposit_required` banner copy alignment

After the cron moves a customer from `suspended` → `deposit_required`, the banner is the user-facing result of this feature. Update banner copy and restriction text so the post-lift state reads cleanly:

**Frontend (`frontend/src/components/customer/NoShowWarningBanner.tsx:49-50`):**
- Title: `'Refundable Deposit Required'` → `'Deposit Required - Account Restricted'`
- Message: `'Due to X missed appointments, you must now pay a refundable deposit for all bookings:'` → `'Due to X missed appointments, the following restrictions apply:'`

**Backend (`backend/src/services/NoShowPolicyService.ts`):** align the shop-agnostic `getOverallCustomerStatus` (line 280-284) deposit-required restrictions with the (already-correct) shop-scoped `getCustomerStatus` (line 212-216), and format `depositAmount` with `.toFixed(2)` in both paths:

```ts
// getOverallCustomerStatus — replace existing three push() calls:
restrictions.push(`Must book at least ${defaultPolicy.depositAdvanceBookingHours} hours in advance`);
restrictions.push(`$${defaultPolicy.depositAmount.toFixed(2)} refundable deposit required`);
restrictions.push(`Maximum ${defaultPolicy.maxRcnRedemptionPercent}% RCN redemption`);
```

```ts
// getCustomerStatus — only the middle push() needs the format fix:
restrictions.push(`$${policy.depositAmount.toFixed(2)} refundable deposit required`);
```

Rendered result for a customer with `no_show_count=5` after suspension lifts:
- Title: `Deposit Required - Account Restricted`
- Message: `Due to 5 missed appointments, the following restrictions apply:`
- Bullets (in order):
  - `Must book at least 48 hours in advance`
  - `$25.00 refundable deposit required`
  - `Maximum 80% RCN redemption`

## Files to Reference (Reused, Not Modified)

- `backend/src/services/AutoNoShowDetectionService.ts:510-579` — `start()` / `stop()` / `getStatus()` template to copy.
- `backend/src/services/NoShowPolicyService.ts:141-170` — `getDefaultPolicy()` thresholds source (caution=2, deposit=3, suspension=5).
- `backend/src/domains/notification/services/NotificationService.ts` — `createNotification()` for `'suspension_lifted'` notification.
- `backend/src/utils/database-pool.ts` — `getSharedPool()` to avoid connection exhaustion.
- `backend/src/utils/logger.ts` — `logger.info/error` for structured logs.

## Out of Scope (deferred)

- **Email notification** (`EmailService.sendSuspensionLifted`) — the in-app notification is sufficient for v1. Email can be added later using `EmailService.ts:1374+` as a template.
- **Per-shop tier lookup** — current DB schema doesn't track which shop's policy caused the suspension, so we apply the global default thresholds. This matches the existing `getOverallCustomerStatus` precedent.
- **Backfill of existing stale rows** — the first cron run will naturally catch any already-expired suspensions, so no separate migration needed.

## Verification

1. **Seed a test customer with expired suspension** (DB):
   ```sql
   UPDATE customers
   SET no_show_count = 5,
       no_show_tier = 'suspended',
       booking_suspended_until = NOW() - INTERVAL '1 hour',
       deposit_required = TRUE
   WHERE LOWER(address) = LOWER('0xTEST_WALLET');
   ```

2. **Run the service manually** via a one-off script or by restarting the backend (the service runs immediately on `start()`). Check logs for `Suspension lift service started` and `Lifted N suspensions`.

3. **Verify DB state** after the run:
   ```sql
   SELECT address, no_show_count, no_show_tier, booking_suspended_until, deposit_required
   FROM customers WHERE LOWER(address) = LOWER('0xTEST_WALLET');
   -- Expect: tier='deposit_required', booking_suspended_until=NULL, deposit_required=TRUE, count=5
   ```

4. **Verify notification** was created:
   ```sql
   SELECT * FROM notifications
   WHERE LOWER(receiver_address) = LOWER('0xTEST_WALLET')
     AND notification_type = 'suspension_lifted'
   ORDER BY created_at DESC LIMIT 1;
   ```

5. **Verify frontend**: reload customer dashboard — banner should now show red "Refundable Deposit Required" (deposit_required tier) instead of gray "Suspended".

6. **Edge-case tests** (mirror `backend/tests/shop/shop.dispute-tier-recalculation.test.ts` structure, create `backend/tests/services/suspension-lift.test.ts`):
   - Customer with `booking_suspended_until` in the future → untouched.
   - Customer with `booking_suspended_until = NULL` + `tier='suspended'` (anomalous state) → untouched.
   - Customer with `tier='deposit_required'` + past `booking_suspended_until` → untouched (only `suspended` tier is lifted).
   - Cascade matrix: count 5→deposit_required, count 2→caution, count 1→warning, count 0→normal.
   - Notification is created per lifted customer.
   - Notification failure does not prevent DB update (mock `createNotification` to throw).

7. **Idempotency check**: run the service twice in a row — second run should report `customersLifted: 0`.
