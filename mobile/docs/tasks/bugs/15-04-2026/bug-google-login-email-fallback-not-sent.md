# Bug: Google Login Doesn't Send Email to Backend — Email Fallback Never Triggers

## Status: Open
## Priority: Critical (raised 2026-05-04 — see "Updated 2026-05-04" section below)
## Date: 2026-04-15
## Updated: 2026-05-04
## Category: Bug - Authentication
## Platform: Mobile (React Native / Expo)
## Affects: Originally framed as "shops registered with MetaMask trying to login via Google" — broadened 2026-05-04 to **any shop using Google login** whose Thirdweb in-app wallet derivation drifted between registration and re-login (SDK upgrade, app reinstall, keystore reset, ecosystem change). See updated section.

---

## Problem

When a shop registered with one wallet method (MetaMask, or an earlier Thirdweb in-app wallet session) logs in via Google on mobile and the wallet address it gets back doesn't match the one stored in the DB, they are taken to the Role Selection screen ("I'm a Customer / I'm a Shop Owner") instead of their pending dashboard. The backend supports email fallback — if a wallet address isn't found, it checks by email to match the shop. But the mobile app never sends the email in the API call, so the fallback never fires.

**Confirmed in production 2026-05-04** — see "Updated 2026-05-04" section. The bug isn't limited to deliberate wallet-method changes; passive wallet drift on the same Google account triggers it too.

---

## ⚠️ Diagnose first — DO NOT apply the fix until these are confirmed

The fix below assumes a specific root cause (email fallback never sent → wallet-drift case unrecoverable). At least **3 other root causes produce the identical symptom** (`exists: false` for a registered shop, user lands on Role Selection). Applying the email-passthrough fix without confirming the actual cause will either:
- Mask a different bug instead of fixing it (e.g., case-sensitivity in SQL lookup), or
- Ship a fix that doesn't resolve the user's symptom because the upstream email capture is failing silently

Run all 5 diagnostic steps below before committing to the Fix Required section. Each step takes ~2-5 min.

### Step 1 — Confirm the shop record actually exists in production DB

Run against the **production DB** (not staging):

```sql
SELECT shop_id, name, email, wallet_address, verified, active, suspended_at, created_at
FROM shops
WHERE LOWER(email) = 'anna.cagunot@gmail.com';  -- substitute the affected user's email
```

| Result | What it means | Next step |
|---|---|---|
| **0 rows** | Registration didn't persist. This is a different bug (silent backend failure during shop creation). | **STOP** — do not apply this fix. File a new bug for "shop registration silently fails to persist". Check backend logs around the user's registration timestamp. |
| **1 row, `wallet_address` populated** | Continue diagnosis. Capture the stored `wallet_address` value for Step 3. | Step 2 |
| **1 row, `wallet_address` is NULL or empty** | Registration persisted but didn't capture wallet. Different bug — investigate `useShopRegister.handleSubmit` and shop register endpoint. | **STOP** — file a separate bug. |

### Step 2 — Capture the current Thirdweb wallet address on the affected device

Add a temporary log in `mobile/feature/auth/screens/connect/ConnectWalletScreen.tsx` after line 113:

```diff
   const account = w.getAccount();
   if (account) {
     const address = account.address;
+    console.log("[Diagnose] Thirdweb returned address:", address);
+    console.log("[Diagnose] Wallet ID:", walletId);
```

> Note (2026-05-04): The auth flow was refactored on `main` — the email-capture logic moved from `Onboarding3.tsx` to a new file `ConnectWalletScreen.tsx`. The shape of the code is identical, just relocated.

Have the user reproduce the bug. Capture the printed `address`.

### Step 3 — Compare stored vs returned wallet addresses

| DB `wallet_address` (Step 1) | Live Thirdweb `address` (Step 2) | What it means |
|---|---|---|
| **Lowercase match** | Lowercase match | No drift — the email fix won't help here. The bug is elsewhere (likely Step 4). |
| Same chars, **different case** | (e.g., `0xABC…` vs `0xabc…`) | Case sensitivity issue. Fix is in the SQL layer, not email passthrough. See Step 4. |
| **Different addresses entirely** | (e.g., `0xabc…` vs `0xdef…`) | Wallet drift confirmed. Email passthrough fix below IS the right one — proceed to Step 5. |

### Step 4 — Audit `shopRepository.getShopByWallet` for case sensitivity

```bash
grep -rn "getShopByWallet" backend/src/repositories/
```

Read the SQL inside that method. Check whether it does:
- `WHERE LOWER(wallet_address) = LOWER($1)` ← case-insensitive, safe
- `WHERE wallet_address = $1` ← case-sensitive, BUG if the stored address has any uppercase chars

If case-sensitive and the stored address has uppercase chars: **the actual fix is at the SQL layer**, not email passthrough. File a separate bug or expand this one's scope. The email fix can still ship as defense-in-depth, but it's not the root cause.

### Step 5 — Verify `getUserEmail({ client })` reliably returns the email

The email-passthrough fix only works if the email is actually captured at the UI layer. Currently:

```typescript
// mobile/feature/auth/screens/connect/ConnectWalletScreen.tsx:116-122
if (walletId === "google") {
  try {
    email = await getUserEmail({ client });
  } catch (err) {
    console.log("[ConnectWallet] Could not get email:", err);  // ← swallowed silently
  }
}
```

If `getUserEmail` fails or returns `undefined`, the email fix below is a no-op for this code path. Add a temporary log:

```diff
   if (walletId === "google") {
     try {
       email = await getUserEmail({ client });
+      console.log("[Diagnose] getUserEmail returned:", email);
     } catch (err) {
-      console.log("[ConnectWallet] Could not get email:", err);
+      console.error("[Diagnose] getUserEmail FAILED:", err);
     }
   }
```

If this prints `undefined` or an error in the user's repro, the email-passthrough fix won't resolve their symptom. Address the upstream capture first (e.g., add `await` waits, retry logic, or surface the error to the user instead of swallowing).

### Decision matrix: which fix to apply based on diagnostics

| Step 1 | Step 3 | Step 4 | Step 5 | Action |
|---|---|---|---|---|
| Row exists | Different addresses | Case-insensitive SQL | Email captured | **Apply Fix 1 + 2 below.** This bug is the cause. |
| Row exists | Same address | Case-insensitive SQL | Email captured | **Different bug.** Email fix won't help. Investigate routing logic in `useAuthQuery.ts:52-79`. |
| Row exists | Different/same case | Case-sensitive SQL | Either | **Fix the SQL first** (separate bug). Email fix is secondary. |
| Row exists | Different addresses | Case-insensitive SQL | Email NOT captured | **Apply Fix 1 + 2, but ALSO fix `getUserEmail` capture upstream.** Otherwise fix is a no-op. |
| 0 rows | — | — | — | **Different bug entirely.** Stop. File "shop registration silently fails". |

---

## Root Cause

> **Read the Diagnose-first section above before treating the section below as authoritative.** This describes the root cause we believe applies to the 2026-05-04 production case (Anna), but the diagnostic steps must confirm it before applying the fix.

> **Note (2026-05-04):** mobile codebase was refactored after this doc was written. Files moved from `shared/services/` and `shared/hooks/auth/` to `feature/auth/services/` and `feature/auth/hooks/`. Paths and line numbers below have been updated to current code.

**File:** `mobile/feature/auth/services/auth.services.ts` (lines 13-15)

```typescript
async checkUserExists(address: string) {
  return await apiClient.post("/auth/check-user", { address });
  //                                                ^^^^^^^^^ email NOT included
}
```

The function only accepts and sends `address`. The `email` from Google login is captured upstream and stored in account state, but never passed to `checkUserExists()`.

**File:** `mobile/feature/auth/hooks/useAuthQuery.ts` (lines 42-51)

```typescript
mutationFn: async (params: { address: string; email?: string }) => {
  const { address, email } = params;       // email IS available here
  if (!address) {
    throw new Error("No wallet address provided");
  }
  setIsLoading(true);
  setAccount({ address, email });           // stored in Zustand
  return await authApi.checkUserExists(address);  // ← email NOT passed to API
},
```

**Upstream caller** (`mobile/feature/auth/screens/connect/ConnectWalletScreen.tsx` lines 115-125 — formerly `Onboarding3.tsx` before the 2026-05-04 mobile auth refactor) correctly captures email via Thirdweb's `getUserEmail({ client })` and passes it to `connectWalletMutation.mutate({ address, email })`. The drop happens at the service layer, not the call site.

**Backend** (`backend/src/routes/auth.ts` line 534) reads `{ email }` from `req.body` for the fallback lookup (lines 532-628), but mobile never sends it.

---

## Flow Comparison

**Web app (working):**
```
Google login → get address + email → POST /auth/check-user { address, email }
  → address not found → email fallback → shop found by email → login success
```

**Mobile app (broken):**
```
Google login → get address + email → POST /auth/check-user { address }
  → address not found → no email to fallback → 404 user not found → Role Selection
```

---

## Fix Required

> **Prerequisites:** complete the "Diagnose first" section above. The Decision Matrix at the end of that section tells you whether Fix 1 + 2 are sufficient, need to be paired with an upstream capture fix, or aren't the right fix at all. **Do not apply the diff below until diagnostics confirm wallet drift + working email capture + case-insensitive SQL lookup.**

### Fix 1: Pass email to checkUserExists

**File:** `mobile/feature/auth/services/auth.services.ts` (lines 13-20)

```typescript
async checkUserExists(address: string, email?: string) {
  try {
    return await apiClient.post("/auth/check-user", { address, email });
  } catch (error) {
    console.error("Failed to check user exists:", error);
    throw error;
  }
}
```

### Fix 2: Pass email from useConnectWallet mutation

**File:** `mobile/feature/auth/hooks/useAuthQuery.ts` (line 50)

```diff
-      return await authApi.checkUserExists(address);
+      return await authApi.checkUserExists(address, email);
```

### Fix 3: Verify `getToken` doesn't need the same passthrough

**File:** `mobile/feature/auth/services/auth.services.ts` (lines 4-11)

```typescript
async getToken(address: string) {
  return await apiClient.post("/auth/token", { address });
}
```

The `/auth/token` backend endpoint may also support email fallback. Audit `backend/src/routes/auth.ts` to confirm whether `/auth/token` reads `req.body.email`. If so, apply the same passthrough pattern.

**Status of Fix 3:** ⏳ Still TODO as of 2026-05-04 — never resolved since this doc was created.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/auth/services/auth.services.ts` (lines 13-20) | Add `email` param to `checkUserExists()` and include in request body |
| `mobile/feature/auth/hooks/useAuthQuery.ts` (line 50) | Pass `email` to `checkUserExists()` call |
| `mobile/feature/auth/services/auth.services.ts` (lines 4-11) | Audit/fix `getToken()` if backend `/auth/token` also accepts email |

---

## QA Verification

### Original scenario (MetaMask register → Google login)

- [ ] Register shop with MetaMask wallet + email "test@example.com"
- [ ] Logout
- [ ] Login via Google using same email "test@example.com"
- [ ] **Expected**: Goes directly to shop dashboard (not Role Selection)
- [ ] Shop data and settings are accessible
- [ ] Same test for customer accounts registered with MetaMask + Google login

### Updated scenario (Google register → Google re-login, wallet drift) — added 2026-05-04

- [ ] Register shop via Google login with email "test@example.com" (creates Thirdweb in-app wallet, address X)
- [ ] Reach `/register/pending` ("waiting for admin activation") screen
- [ ] Force wallet drift to simulate SDK upgrade / reinstall: clear app data OR uninstall/reinstall the app build
- [ ] Login again via Google with same email
- [ ] **Before fix**: Thirdweb returns wallet address Y (different from X), backend `getShopByWallet(Y)` returns nothing, no email sent → returns `{exists: false}` → routes to Role Selection
- [ ] **After fix**: backend `getShopByWallet(Y)` returns nothing → email fallback fires → backend finds shop by email → returns `{exists: true, type: 'shop', linkedByEmail: true, user: {verified: false, active: false, ...}}` → routes to `/register/pending`
- [ ] No regression for the no-drift case: shop owner whose wallet matches between registration and login still routes correctly
- [ ] Customer flow (Google register → Google re-login) gets the same protection (bug applies to customers too — shop is just the high-revenue case)

---

## Updated 2026-05-04 — confirmed in production

### What happened

A shop owner (test account `anna.cagunot@gmail.com`) on production:
1. Registered as a shop via Google login on mobile — completed all 5 slides successfully
2. Reached `/register/pending` ("waiting for admin activation") screen as expected
3. Closed the app / re-opened later, went through the connect-wallet flow
4. Backend `/auth/check-user` returned `{exists: false}` despite the shop record existing in production DB
5. Mobile routed to `/register` → ChooseRoleScreen ("I'm a Customer / I'm a Shop Owner")

Evidence: screenshot of ChooseRoleScreen captured during the session, account details in production DB confirmed by query against `shops` table by email.

### Why this scenario isn't covered by the original framing

The original doc (2026-04-15) framed the bug narrowly: *"shops registered with MetaMask trying to login via Google"* — i.e., the user actively chose a different wallet method. Anna's case is **same Google account, same login method, both times** — yet the wallet address Thirdweb produced on re-login didn't match what was stored in the DB at registration time.

In-app Thirdweb wallet derivation is supposed to be deterministic per Google account, but in practice can drift across:
- Thirdweb SDK upgrades (derivation salt or ecosystem config changes between app versions)
- App reinstall / clearing app data (in-app wallet keystore wiped, regenerates a different address)
- Dev-mode storage clears (Fast Refresh, Metro cache reset, EAS build profile changes)
- Switching between dev / staging / prod builds (different `clientId` → potentially different wallet)

This means **every Google-login shop owner is at passive risk** of getting locked out of their pending dashboard, not just shops who deliberately switched wallet methods.

### Priority bump

Original priority: **High** (framed as edge case — shops migrating wallet methods)
New priority: **Critical** (every Google-login shop is at risk; pending shops can't reach their dashboard at all if the drift hits before admin approval)

Revenue impact: shop signups are the paying customer flow ($500/mo subscription). A shop that registers, gets stuck on Role Selection on re-login, and has no way to know "your record exists, just wait for approval" is likely to bounce or contact support with no actionable info.

### Two completed sibling docs misdiagnosed the same symptom

For continuity, two prior tasks investigated the same symptom (pending shop → Role Selection) and concluded the cause was field-name mismatch (`active` vs `isActive`):
- `mobile/docs/tasks/completed/bug-pending-shop-sees-role-selection.md` (closed 2026-04-07)
- `mobile/docs/tasks/completed/bug-pending-shop-shows-role-selection.md` (closed 2026-04-07, duplicate)

The field-name fix from those tasks IS in place today (`useAuthQuery.ts:65` uses `user?.active`). But the email-fallback hole identified in THIS doc was never closed, so the symptom resurfaced via a different code path. The two prior tasks were closed prematurely — they fixed a real bug, just not the one causing the symptom in those reports.

### Verification before closing this task (post-fix)

> **Note:** the original 5-step list below was subsumed by the "Diagnose first" section at the top of this doc. Steps 1-2 below are now the FIRST things to do, not the last. Steps 3-5 are the post-fix close-out.

**Pre-fix diagnostics (mandatory — see "Diagnose first" section):**
1. ✅ Confirm `shops` row exists for the affected user with non-null `wallet_address`
2. ✅ Capture current Thirdweb address on the affected device
3. ✅ Compare DB vs live address — confirm wallet drift (different addresses) is the actual scenario
4. ✅ Confirm `getShopByWallet` SQL uses case-insensitive comparison
5. ✅ Confirm `getUserEmail({client})` actually returns the email at runtime

**Post-fix close-out:**
6. Apply Fix 1 + Fix 2
7. Audit Fix 3 (`getToken`) — apply if backend `/auth/token` accepts email
8. Re-test affected user's account on the patched build → should now reach `/register/pending`, not Role Selection
9. Re-test happy path (no drift) — confirm no regression for shop owners whose wallet matches between registration and login
10. Re-test customer flow with the same drift scenario — fix should benefit customers too
11. Update the two completed sibling docs (`bug-pending-shop-sees-role-selection.md`, `bug-pending-shop-shows-role-selection.md`) with a back-reference to this fix so future investigators understand the full history
12. Remove the diagnostic `console.log` statements added in Diagnose Steps 2 and 5

---

## If the fix doesn't resolve the symptom

If you applied Fix 1 + 2 and the affected user STILL lands on Role Selection after re-login, work through this branch:

### Branch A — User's `getUserEmail` returns undefined despite Google login

Symptom: in DevTools / Metro console, `[Diagnose] getUserEmail returned: undefined` even though they logged in via Google.

Cause candidates:
- Thirdweb SDK version mismatch — `getUserEmail` API changed between versions. Check `package.json` thirdweb version vs the version that introduced `getUserEmail`.
- The user's Thirdweb wallet wasn't created with Google strategy in the first place — maybe in-app wallet was created via a different auth method first.
- `client` instance passed to `getUserEmail` differs from the one used at wallet creation.

Fix path: surface the error from the swallowed try/catch, retry on failure, OR fall back to prompting the user for their registered email manually.

### Branch B — Email is captured but backend `getShopByEmail` doesn't find the shop

Symptom: logs show email IS sent in the request body but backend still returns `{ exists: false }`.

Cause candidates:
- Email case mismatch in DB — user registered with `Anna.Cagunot@Gmail.com` but lookup uses lowercase. Backend does `getShopByEmail(email)` on line 545 — verify that function's SQL uses `LOWER()`.
- Email field on shop record is null/empty (registration didn't capture it). Re-query Step 1 from Diagnose section and check `email` column.
- Email mismatch entirely (different email than registration). Confirm via DB query.

Fix path: ensure SQL is `WHERE LOWER(email) = LOWER($1)` in `shopRepository.getShopByEmail`. If email is null on the row, that's a separate registration bug.

### Branch C — Backend returns `{ exists: true }` but mobile still routes to Role Selection

Symptom: backend logs show 200 with full shop user object, but mobile app navigates to `/register`.

Cause candidates:
- `useAuthQuery.ts:54` (`if (!result.exists)`) — confirm the response shape matches what the code expects. Is `result.exists` really `true`, or is it `result.data.exists`?
- `userType !== "shop"` for some reason — maybe backend returned `type: 'customer'` due to a different bug.
- Race condition between `setUserProfile`, `setUserType`, and the `router.replace` call.

Fix path: add `console.log("[useConnectWallet] result:", JSON.stringify(result))` at line 53 and trace the exact response.

### Branch D — Different login flow path

Symptom: the affected user reports the bug but the diagnostics in `ConnectWalletScreen.tsx` aren't being hit.

Cause candidates:
- They went through `useSplashNavigation.ts` (cold-start authenticated path) instead of the connect-wallet path. That path uses cached `userProfile` from Zustand, not a fresh `checkUserExists` call. If the cached profile has stale data, behavior diverges.
- Refresh-token flow expired and the rehydration failed silently.
- A logout/clear happened and the entry point was different from `ConnectWalletScreen`.

Fix path: capture the user's exact reproduction steps. Add diagnostic logs in `useSplashNavigation.ts:14` (`navigate` function entry) to confirm whether that path was taken instead.

---

## Confidence note (2026-05-04)

The Fix Required section is high-confidence on the **shape** of the bug (email destructured but never forwarded — provable by reading the code). It is **medium-confidence** on whether this particular bug is what hit Anna in production — that requires the diagnostic steps above to confirm. Do not assume "fix shipped" until Anna's account is re-tested on the patched build and lands on `/register/pending`.
