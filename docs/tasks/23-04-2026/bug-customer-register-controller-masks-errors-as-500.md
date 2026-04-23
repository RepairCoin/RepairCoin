# Bug: Customer registration controller returns 500 for most non-duplicate errors, hiding real validation failures

**Status:** Open
**Priority:** Critical
**Est. Effort:** 15-20 minutes
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

`POST /api/customers/register` returns HTTP **500 Internal Server Error** for almost every failure path other than the literal-string match on *"already registered"* / *"already in use"*. This means:

- Invalid referral code → 500 (should be 400)
- DB unique-constraint violation on email → 500 (should be 409)
- TierManager validation errors → 500 (should be 400)
- Any other thrown error from `CustomerService.registerCustomer` → 500

On the client, a 500 triggers the mobile axios global-error interceptor (`mobile/shared/utilities/axios.ts:40-42`) which shows the generic toast *"Server error. Please try again later."* — the user can't see the real cause (e.g., "Invalid referral code") and has no way to self-correct.

### Evidence

- `c:\dev\sc1.png` (2026-04-23) — customer registration failure on the FixFlow mobile app. Screenshot shows two stacked *"Server error. Please try again later."* toasts and button stuck on "Creating Account…". The duplicate-toast part is tracked separately in `mobile/docs/tasks/bugs/23-04-2026/bug-mutation-retry-on-5xx-duplicates-toasts.md`. This doc is about **why the backend response said 500 in the first place**.

### Why Critical

1. **Users cannot self-correct.** If the real error is "Invalid referral code" or "Email already in use" or "Phone number format invalid", the user gets "Server error" — useless. They don't know to fix the field.
2. **Support burden.** Every instance of this error generates a support ticket or an abandoned signup.
3. **Real 500s become indistinguishable from validation errors.** Operators watching for genuine server failures have to filter through noise from what should have been 400s. Alerting rules built on `status=500` become meaningless.
4. **Blocks ALL new customer signups** whose data trips any of the non-duplicate throw paths — which, post-Phase-1b, is the remaining registration blocker.

---

## Root Cause

**File:** `backend/src/domains/customer/controllers/CustomerController.ts:70-106`

```typescript
async registerCustomer(req: Request, res: Response) {
  try {
    const {
      walletAddress, email, name, first_name, last_name, phone,
      fixflowCustomerId, referralCode,
      walletType = 'external', authMethod = 'wallet'
    } = req.body;

    const result = await this.customerService.registerCustomer({
      walletAddress, email, name, first_name, last_name, phone,
      fixflowCustomerId, referralCode, walletType, authMethod
    });

    ResponseHelper.created(res, result, 'Customer registered successfully');
  } catch (error: any) {
    if (error.message.includes('already registered') || error.message.includes('already in use')) {
      ResponseHelper.conflict(res, error.message);   // 409
    } else {
      ResponseHelper.error(res, error.message, 500); // ← everything else → 500
    }
  }
}
```

The service layer throws a variety of errors, only two of which match the string check. All other thrown errors are returned as 500.

**Concrete throw paths in `backend/src/domains/customer/services/CustomerService.ts:148-233`:**

| Line | Thrown error | Intent | Current HTTP | Correct HTTP |
|---|---|---|---|---|
| 154 | `'This wallet address is already registered as a customer. Please sign in to your existing account.'` | Uniqueness | 409 | 409 ✓ |
| 161 | `'Invalid referral code'` | Validation | **500** | **400** |
| 186 | `customerRepository.createCustomer(...)` — can throw on DB unique violation (email) | Uniqueness | **500** | **409** |
| 169-177 | `TierManager.createNewCustomer(...)` — can throw on bad input | Validation | **500** | **400** |
| any | Unhandled runtime exception | Server bug | 500 | 500 ✓ |

Additionally, the `ResponseHelper.error(res, error.message, 500)` line **leaks the raw service error message to the client**. For unexpected errors this can surface internal details (SQL text, stack hints, internal paths). Best practice: log the full error, return a generic message.

---

## Fix

Expand the catch block to map known error shapes to appropriate HTTP status codes, and sanitize the response body for unexpected errors. No service-layer changes required — this is purely a controller concern.

**File:** `backend/src/domains/customer/controllers/CustomerController.ts`

Replace the `registerCustomer` method's catch block:

```diff
   async registerCustomer(req: Request, res: Response) {
     try {
       const {
         walletAddress,
         email,
         name,
         first_name,
         last_name,
         phone,
         fixflowCustomerId,
         referralCode,
         walletType = 'external',
         authMethod = 'wallet'
       } = req.body;

       const result = await this.customerService.registerCustomer({
         walletAddress,
         email,
         name,
         first_name,
         last_name,
         phone,
         fixflowCustomerId,
         referralCode,
         walletType,
         authMethod
       });

       ResponseHelper.created(res, result, 'Customer registered successfully');
     } catch (error: any) {
-      if (error.message.includes('already registered') || error.message.includes('already in use')) {
-        ResponseHelper.conflict(res, error.message);
-      } else {
-        ResponseHelper.error(res, error.message, 500);
-      }
+      const msg: string = error?.message || '';
+      const dbCode: string = error?.code || '';
+
+      // 409 — uniqueness violations (application-level)
+      if (msg.includes('already registered') || msg.includes('already in use')) {
+        return ResponseHelper.conflict(res, msg);
+      }
+
+      // 409 — Postgres unique-constraint violation (e.g., duplicate email at DB level)
+      if (dbCode === '23505') {
+        return ResponseHelper.conflict(res, 'A customer with these details already exists.');
+      }
+
+      // 400 — known validation errors the user can correct
+      if (msg.includes('Invalid referral code')) {
+        return ResponseHelper.badRequest(res, msg);
+      }
+
+      // 400 — generic validation phrases (TierManager, etc.)
+      if (msg.startsWith('Invalid ') || msg.includes(' is required') || msg.includes('must be ')) {
+        return ResponseHelper.badRequest(res, msg);
+      }
+
+      // 500 — unexpected. Log full context; return a generic message to the client.
+      logger.error('Unexpected error in registerCustomer controller:', {
+        error: msg,
+        stack: error?.stack,
+        dbCode,
+        walletAddress: req.body?.walletAddress,
+        email: req.body?.email,
+      });
+      return ResponseHelper.internalServerError(
+        res,
+        'Registration failed due to an unexpected error. Please try again later.'
+      );
     }
   }
```

### Why each branch

- **409 for `msg.includes('already registered'|'already in use')`** — preserves existing behavior for the wallet-already-exists case at `CustomerService.ts:154`.
- **409 for `dbCode === '23505'`** — Postgres unique-violation SQLSTATE. Triggered when `customerRepository.createCustomer` hits the email unique constraint without the service pre-check catching it (race condition, or a unique constraint not yet covered by service logic).
- **400 for `msg.includes('Invalid referral code')`** — maps the known validation throw at `CustomerService.ts:161`.
- **400 for generic validation phrases** — catches TierManager and similar validation errors. The phrase patterns (`Invalid `, ` is required`, `must be `) are stable across common validation messages. Safe because these are error-throwing side effects of validation, not legitimate domain messages.
- **500 with generic client message** — unknown errors. Full context is logged (for operators) but the client gets only a safe generic message. No internal leak.

### Imports to verify

At the top of `CustomerController.ts`, confirm `logger` is already imported. If not, add:
```typescript
import { logger } from '../../../utils/logger';
```
The existing imports typically already include this — verify before adding.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/src/domains/customer/controllers/CustomerController.ts` | Replace the `catch` block in `registerCustomer` (lines ~99-105) with the expanded mapping above. No other methods change. |

No changes to:
- `CustomerService.ts` — service continues throwing the same errors
- `CustomerRepository.ts` — repository unchanged
- Middleware (captcha, validation, uniqueness) — already correct, already returns proper status codes
- Routes — already correct
- Frontend / mobile — the mobile client's mutation `onError` at `mobile/shared/hooks/customer/useCustomer.ts:97-105` already correctly reads `error.response.data.error` and falls back to `error.message`. Once the backend returns proper 400/409 with meaningful messages, the mobile user sees them automatically. **No mobile changes required.**

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Attempt customer registration with a **bad referral code** (e.g., `FAKECODE123` that doesn't exist in DB). Capture response: HTTP 500, body `{"success": false, "error": "Invalid referral code"}`.
- [ ] Attempt customer registration with an **email that already exists** in the customers table but a fresh wallet. Capture response: HTTP 500 (assuming unique constraint on email exists) or similar.
- [ ] Observe mobile client shows "Server error. Please try again later." toast (from `axios.ts:40-42`) — real error message never surfaces.

### After fix

- [ ] Invalid referral code → HTTP **400** with body `{"success": false, "error": "Invalid referral code"}`. Mobile client displays "Invalid referral code" toast (via `useCustomer.ts:101` reading `error.response.data.error`).
- [ ] Duplicate wallet → HTTP **409** (unchanged behavior for this case, but re-verify) with message about already registered.
- [ ] Duplicate email at DB level (if the schema has the unique constraint) → HTTP **409** with *"A customer with these details already exists."*
- [ ] Successful registration with all valid data → HTTP **201** with customer payload (unchanged).
- [ ] Unexpected error (can be simulated by temporarily throwing in the service, e.g., `throw new Error('simulated')`) → HTTP **500** with body `{"success": false, "error": "Registration failed due to an unexpected error. Please try again later."}`. Backend logs show full stack and context. Client does NOT see the raw error message.

### Regression

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (if there are controller-level tests)
- [ ] Existing test suite `backend/tests/` passes
- [ ] Shop registration, login, token operations — unaffected (different controllers)

### Integration with the mobile client

- [ ] After the backend fix lands, submit a customer registration from the mobile app with a bad referral code. Expected: mobile shows "Invalid referral code" toast. No "Server error." toast.
- [ ] Paired with `mobile/docs/tasks/bugs/23-04-2026/bug-mutation-retry-on-5xx-duplicates-toasts.md` — after both ship, the user sees exactly **one correct error toast** per submit attempt.

---

## Notes

- **This fix alone does NOT cover the duplicate-toast problem** on the mobile side. Both bugs must ship to fully resolve the 2026-04-23 QA finding. Ship order doesn't strictly matter — each improves the UX independently:
  - Mobile alone: toasts stop duplicating, but user still sees wrong/generic message (at least they see it once).
  - Backend alone: user sees the right message, but it appears 2-3 times due to retries.
  - Both: user sees exactly one correct message. ← goal state.
- **Error-class refactor (future scope, NOT in this ticket):** a cleaner long-term solution is typed error classes thrown by the service layer (`CustomerAlreadyExistsError`, `InvalidReferralCodeError`, `CustomerValidationError`) and an `instanceof` switch in the controller. That's a broader refactor affecting every controller in the backend. Keep it as a follow-up; the string-pattern expansion above is the right scope for the critical fix today.
- **Why `error.code === '23505'`:** Postgres SQLSTATE for `unique_violation`. Reliable across pg-node versions. Covers the case where the service's application-level uniqueness pre-check misses a race (two requests hit the DB concurrently, both pass the pre-check, one commits, the other hits the unique index).
- **Defensive + Recovery scoping note (per memory `feedback_defensive_vs_recovery_scoping.md`):** this is a response-shape bug, not a missing-data bug. No recovery fix needed — once the controller returns the right status + message, the mobile client's existing `onError` handler correctly surfaces the message to the user. The pairing for this bug is the mobile retry fix (sibling doc), not a recovery fix.
- Commit policy: do not commit without explicit approval.
- **Evidence stored locally at `c:\dev\sc1.png`** — not committed to repo.

---

## Implementation confidence notes for receiving Claude

If you're the Claude implementing this fix:

1. **Only edit `CustomerController.ts`.** Do not touch `CustomerService.ts`, `CustomerRepository.ts`, middleware, or any mobile/frontend code.

2. **Locate the exact method.** The file contains many `async` methods — find `async registerCustomer(req: Request, res: Response)` and edit ONLY its `catch` block (currently ~lines 99-105). The `try` block and method signature must remain unchanged.

3. **Verify `logger` is imported** at the top of the file before using it. If not, add `import { logger } from '../../../utils/logger';` (confirm the relative path matches the controller's actual depth).

4. **Do not add `return` before `ResponseHelper.created(...)` in the try block** — that's existing code, leave it. The new `return` statements in the catch block prevent fall-through to subsequent branches.

5. **`ResponseHelper` methods to use:**
   - `ResponseHelper.conflict(res, message)` — sends 409
   - `ResponseHelper.badRequest(res, message)` — sends 400
   - `ResponseHelper.internalServerError(res, message)` — sends 500
   - All exist; verify by searching for usages elsewhere in the backend (e.g., `grep "ResponseHelper.badRequest" backend/src`).

6. **After editing**, run from the `backend/` directory:
   - `npm run typecheck` — must pass
   - `npm run test` — must pass (if the test suite exercises CustomerController)
   - Optionally `npm run dev` and smoke-test `POST /api/customers/register` with curl using a bad referral code to verify the 400 response.

7. **Do not modify error messages that are currently passing** — e.g., the "already registered" wording at line 154 of the service is consumed by the controller's string match. Preserving that exact phrasing keeps the 409 branch intact.

8. **No migration needed.** DB schema unchanged.

9. **No config or env change needed.** The fix is pure application code.

10. **Side effect to be aware of:** after this fix lands, any operator monitoring / alerting that previously triggered on `status=500` for `/customers/register` may see fewer alerts (as 400/409 take over the legitimate validation/uniqueness cases). This is correct — 500 should be reserved for true server bugs. Inform ops team if they have dashboards here.
