# Bug: Shop registration route returns 500 with a generic message for every caught error, hiding the real failure

**Status:** Open
**Priority:** Critical
**Est. Effort:** 15-20 minutes

**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

`POST /api/shops/register` returns HTTP **500** with a hardcoded body `{"success": false, "error": "Failed to register shop"}` for **any error that reaches the outer catch**. The real cause (DB constraint, validation error, data shape issue, etc.) is logged server-side but never surfaced to the client. On mobile, the axios global-error interceptor sees a 5xx and fires its generic *"Server error. Please try again later."* toast — paired with the mutation retry loop, the user sees 2-3 identical toasts and the Register Shop button hangs in the loading state.

This is the shop-side twin of `bug-customer-register-controller-masks-errors-as-500.md` (customer controller). The bugs share the same shape but live in different files and must be fixed independently.

### Evidence

- `c:\dev\sc2.png` (2026-04-23) — user on FixFlow mobile Shop FourthSlide (Review & Submit). After tapping **Register Shop**, three stacked *"Server error. Please try again later."* toasts appear and the button hangs. The triple toast is from the retry-policy bug (`bug-mutation-retry-on-5xx-duplicates-toasts.md`), but the backend returning 500 in the first place is this bug.

### Why Critical

Shop signup is the **paying** acquisition flow ($500/mo subscription). A prospective shop owner who completes all five registration slides and then hits a 500 with a useless generic error:
1. Has zero information to self-correct the actual problem (duplicate email, missing column, validation failure, etc.).
2. Cannot distinguish "retry now" from "this will never work."
3. Likely abandons the signup.

Combined with the customer-side bug of the same shape, **both new-user acquisition flows are gated on these two backend controllers returning proper status codes.**

---

## Root Cause

**File:** `backend/src/domains/shop/routes/index.ts:523-647`

The shop register endpoint is an **inline Express handler** (not a controller class — different pattern from customer). The outer catch at lines 639-645 treats everything as 500 with a hardcoded generic message:

```typescript
router.post('/register',
  verifyCaptchaRegister,
  validateRequired(['shopId', 'name', 'address', 'phone', 'email', 'walletAddress']),
  validateStringType('shopId'),
  validateEthereumAddress('walletAddress'),
  validateEmail('email'),
  validateShopUniqueness({ email: true, wallet: true }),
  validateShopRoleConflict,
  async (req: Request, res: Response) => {
    try {
      // ... read req.body, run pre-check inserts ...

      // Explicit 409 paths (these are correct)
      const existingShop = await shopRepository.getShop(shopId);
      if (existingShop) {
        return res.status(409).json({ success: false, error: 'Shop ID already registered' });
      }
      const existingShopByWallet = await shopRepository.getShopByWallet(walletAddress);
      if (existingShopByWallet) {
        return res.status(409).json({
          success: false,
          error: `This wallet address is already registered to shop: ${existingShopByWallet.name}`,
          conflictingRole: 'shop'
        });
      }

      // ... build newShop, call shopRepository.createShop(newShop) ...

      res.status(201).json({ success: true, message: '...', data: {...} });
    } catch (error: any) {
      logger.error('Shop registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register shop'   // ← hardcoded generic
      });
    }
  }
);
```

**What can throw into the catch (but isn't an explicit 409):**

| Source | Error shape | Currently → | Correct → |
|---|---|---|---|
| `shopRepository.createShop(newShop)` hitting Postgres unique-constraint (email) | DB error, `error.code === '23505'` | 500 hardcoded message | **409** with real message |
| `shopRepository.createShop` schema/column mismatch (new column not migrated, type mismatch) | DB error | 500 | **500** with logged context, *but* generic client message is fine |
| Any `Error` thrown before insert (e.g., a constructed `Error('Invalid X')` for new validation logic added later) | `error.message` | 500 | **400** |
| Unexpected runtime exception (reference error, network blip to DB, etc.) | Any | 500 | **500** ✓ |

Additionally, for uniqueness middleware (`validateShopUniqueness`): it already returns proper status codes upstream, so those paths never reach this catch. Good. But the middleware doesn't catch the race where two concurrent requests both pass the pre-check and both call `createShop` — that collision lands in the catch as a Postgres `23505` and currently becomes a 500.

**Impact on mobile:**
- Mobile's `useRegisterShop` (`mobile/shared/hooks/shop/useShop.ts:104-112`) onError reads `error.response.data.error` correctly. Once the backend returns the right status and message, the mobile user sees it. **No mobile code changes required.**
- `mobile/shared/utilities/axios.ts:40-42` fires the "Server error" toast only for 5xx. Once 400/409 replace incorrect 500s, the generic toast stops firing for those cases and the real error surfaces.

---

## Fix

Replace the hardcoded-500 catch with a status-code mapping. Preserve all existing explicit-409 paths in the try block — those are correct. The fix is **only the catch block**.

**File:** `backend/src/domains/shop/routes/index.ts`

Locate the `async (req, res) => { try { ... } catch (error: any) { ... } }` block at lines 531-646 (the /register handler). Replace **only** the catch:

```diff
     } catch (error: any) {
-      logger.error('Shop registration error:', error);
-      res.status(500).json({
-        success: false,
-        error: 'Failed to register shop'
-      });
+      const msg: string = error?.message || '';
+      const dbCode: string = error?.code || '';
+
+      // 409 — Postgres unique-constraint violation (race between pre-check and insert)
+      if (dbCode === '23505') {
+        // Detail hint: Postgres provides the constraint name in error.constraint.
+        // Surface a useful message when we can identify it, else a safe generic 409.
+        const constraintHint = error?.constraint || '';
+        let friendly = 'A shop with these details already exists.';
+        if (constraintHint.includes('email')) {
+          friendly = 'A shop with this email address is already registered.';
+        } else if (constraintHint.includes('wallet')) {
+          friendly = 'A shop with this wallet address is already registered.';
+        } else if (constraintHint.includes('shop_id') || constraintHint.includes('pkey')) {
+          friendly = 'This shop ID is already registered.';
+        }
+        return res.status(409).json({
+          success: false,
+          error: friendly,
+        });
+      }
+
+      // 400 — known validation errors (from service layer or future logic)
+      if (msg.startsWith('Invalid ') || msg.includes(' is required') || msg.includes('must be ')) {
+        return res.status(400).json({
+          success: false,
+          error: msg,
+        });
+      }
+
+      // 500 — unexpected. Log full context for operators; return generic message to client.
+      logger.error('Unexpected shop registration error:', {
+        error: msg,
+        stack: error?.stack,
+        dbCode,
+        constraint: error?.constraint,
+        shopId: req.body?.shopId,
+        email: req.body?.email,
+        walletAddress: req.body?.walletAddress,
+      });
+      return res.status(500).json({
+        success: false,
+        error: 'Registration failed due to an unexpected error. Please try again later.',
+      });
     }
```

### Why each branch

- **409 for Postgres `23505`** — unique constraint violation from the race case. Without this, a pre-check-passed / insert-failed race returns a 500 and the user has no idea why. Mapping the constraint name lets us surface a useful message for the three most common cases (email, wallet, shop_id) without leaking internal DB names.
- **400 for validation-ish messages** — same pattern as the customer controller bug. Future validation logic thrown as `Error('Invalid X')` is surfaced to the user.
- **500 for anything else** — genuinely unexpected. Full context logged (including the original generic that used to be the client message) but the client sees only a safe generic. No internal detail leak.

### What stays the same

- All explicit `return res.status(409).json(...)` calls inside the try block (shopId check at line 560-564, wallet check at 569-575) — unchanged. Those are correct paths.
- The `res.status(201).json(...)` success response at line 628-637 — unchanged.
- Middleware chain (CAPTCHA, validateRequired, validateEthereumAddress, validateEmail, validateShopUniqueness, validateShopRoleConflict) — unchanged. Those return their own status codes correctly.
- The `logger` import — verify it's present at the top of `backend/src/domains/shop/routes/index.ts`. If not (unlikely given the existing `logger.info` at line 621 and `logger.error` at line 640), add `import { logger } from '../../../utils/logger';`.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/src/domains/shop/routes/index.ts` | Replace the `catch` block in the `/register` handler (lines ~639-645) with the expanded status-code mapping. No other changes to this file or any other. |

No changes to:
- Shop repository, shop service, shop domain (none of these are involved in the status-code decision)
- Middleware (already returns proper codes before reaching the handler)
- Mobile app (`useRegisterShop` already reads `error.response.data.error` correctly; no mobile changes required)
- Customer controller (separate bug, separate doc, separate fix)

---

## Verification Checklist

### Reproduction (before fix)

- [ ] Attempt shop registration with data that causes a DB-level error (examples below). Capture response: HTTP 500, body `{"success": false, "error": "Failed to register shop"}`.
  - Suggested repro: attempt to register with an **email already used by another shop** where `validateShopUniqueness` is disabled or raced (if that's hard to trigger, temporarily comment out the middleware for local test, OR force a unique-violation by running two concurrent requests)
  - Alternative: trigger any unhandled throw by temporarily adding `throw new Error('simulated')` inside the try block
- [ ] Observe mobile client showing *"Server error. Please try again later."* — the real cause is invisible to the user.

### After fix

- [ ] Postgres unique-violation (race case) → HTTP **409** with a specific message (e.g., "A shop with this email address is already registered.")
- [ ] Unknown runtime error → HTTP **500** with generic *"Registration failed due to an unexpected error. Please try again later."* Full error context appears in backend logs (stack, dbCode, constraint, shopId, email, walletAddress).
- [ ] Successful registration → HTTP **201** with shop payload (unchanged behavior).
- [ ] Middleware rejections (CAPTCHA, validateRequired, validateEmail, validateShopUniqueness) → their existing status codes unchanged (400/409).

### Mobile integration (after both this fix + `bug-customer-register-controller-masks-errors-as-500.md` land)

- [ ] Submit shop registration that the backend will 409 (e.g., duplicate wallet):
  - Mobile shows the specific 409 message via `useRegisterShop.onError` → `error.response.data.error` (e.g., "This wallet address is already registered to shop: XYZ")
  - No *"Server error."* toast
- [ ] Submit shop registration that produces a 500:
  - Mobile shows *"Server error. Please try again later."* (global toast) — this is correct for unexpected errors
  - After `bug-mutation-retry-on-5xx-duplicates-toasts.md` also ships: exactly **one** such toast, not 2-3 stacked

### Regression

- [ ] `npm run typecheck` passes (backend)
- [ ] `npm run test` passes (backend)
- [ ] Shop registration happy path works end-to-end: complete all 5 slides → tap Register Shop → routed to `/register/pending`
- [ ] Customer registration unaffected (separate file, separate controller)
- [ ] Other shop endpoints (details, suspension checks, etc.) unaffected

---

## Notes

- **Ship as a pair with the customer controller bug.** `docs/tasks/23-04-2026/bug-customer-register-controller-masks-errors-as-500.md` is the customer equivalent. Both fixes target the same failure pattern in different files; shipping only one leaves the other acquisition flow broken. Ideal: one PR covering both files. Acceptable: two PRs shipped same day.
- **Why inline handler vs controller class:** the customer route uses `CustomerController.registerCustomer` (class method), while shop uses an inline arrow function in the route file. Two different file locations, two separate diffs, but the same fix pattern. A future refactor could extract the shop handler into a `ShopController` class for consistency — not in scope here.
- **`error.constraint` availability:** the `pg` library surfaces the constraint name on unique-violation errors. If your project uses a different PG driver wrapper or the constraint name isn't preserved, the friendly-message branches fall through to the generic "A shop with these details already exists." Still a 409, still correct — just less specific. No regression risk.
- **Why not call ResponseHelper:** the existing file uses raw `res.status(...).json(...)` throughout. Matching the existing style keeps the diff minimal and avoids introducing ResponseHelper as a new dependency in this file. Future cleanup could migrate both files to ResponseHelper for consistency.
- **Defensive + Recovery scoping note:** this is a response-shape bug, not a missing-data bug. Pure defensive fix — change how errors are mapped to HTTP codes. No recovery fix needed; once status codes are correct, the mobile client's existing error handler surfaces the real message to the user.
- **Memory reference:** `feedback_defensive_vs_recovery_scoping.md` — this bug is in the "pure defensive" category (policy/shape bug). No recovery fix required because the client already handles non-5xx errors correctly; the issue is just that the server is incorrectly wrapping 400s and 409s as 500s.
- **Commit policy:** do not commit without explicit user approval.
- **Evidence stored locally at `c:\dev\sc2.png`** — not committed to the repo.

---

## Implementation confidence notes for receiving Claude

If you're the Claude implementing this fix:

1. **Only edit `backend/src/domains/shop/routes/index.ts`.** Do not touch any other file. Do not touch the shop controller or service (they're not involved in the status-code decision).

2. **Locate the exact handler.** This file has many route handlers. Find the one registered at `router.post('/register', ...)` around line 523. There is exactly one such handler. Edit **only** its `catch` block (lines ~639-645).

3. **Do not modify the `try` block or the middleware chain.** The explicit 409 responses inside the try block for `existingShop` and `existingShopByWallet` are correct and must remain. The middleware (CAPTCHA, validations, uniqueness, role-conflict) is also correct and must remain untouched.

4. **Verify `logger` is imported** at the top of the file before using it. The existing code already uses `logger.info('New shop registered', ...)` and `logger.error('Shop registration error:', error)`, so it's already imported. If by some chance it isn't (e.g., after refactor), add the appropriate relative-path import.

5. **Preserve the structure:** the fix is a drop-in replacement of the catch block. Do not nest the new logic inside an additional try/catch. Do not add new middleware. Do not change the route path.

6. **The `error.code === '23505'` check is safe** even if the specific error object doesn't have a `code` field (the string comparison just evaluates to false). No defensive optional-chaining needed beyond `error?.code || ''`.

7. **`error.constraint` access may be undefined** — the defensive default `error?.constraint || ''` is included above. The `.includes(...)` calls are safe on an empty string.

8. **After editing**, run from the `backend/` directory:
   - `npm run typecheck` — must pass
   - `npm run test` — must pass if any route-level tests exist for shop register
   - Optionally `npm run dev` and smoke-test `POST /api/shops/register` with curl forcing a duplicate to verify the 409 response with specific message

9. **No migration, no env change, no dependency change.** Pure application code.

10. **After shipping:** operator dashboards/alerts that previously watched `status=500` on `/shops/register` may see fewer alerts. This is correct behavior — 500 should be reserved for real server bugs. Inform ops if relevant.
