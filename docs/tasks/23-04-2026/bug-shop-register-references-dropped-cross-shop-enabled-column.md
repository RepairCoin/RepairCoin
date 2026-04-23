# Bug: Shop registration fails with "column cross_shop_enabled does not exist" — code references column dropped by migration 006

**Status:** Open
**Priority:** Critical
**Est. Effort:** 10 min (minimum fix to unblock registration) + 30 min (full code cleanup)
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

`POST /api/shops/register` fails on the staging Postgres with:

```
error: column "cross_shop_enabled" of relation "shops" does not exist
code: "42703"  (undefined_column)
at ShopRepository.createShop (...ShopRepository.js:133)
```

This happens because migration `006_remove_obsolete_columns.sql` (dated 2025-10-03) dropped the `cross_shop_enabled` column from the `shops` table, but **the application code was never updated**. `ShopRepository.createShop` still lists `cross_shop_enabled` in its INSERT column list and pushes a value for it into the parameters array. When the migration is applied on a DB (as it has been on staging), every shop registration fails with a generic 500 on the client side.

### Evidence

Staging DO backend log captured at 2026-04-23 13:27:57 UTC (`c:\dev\do-shop-err.txt`):

```
Apr 23 13:27:57 [error]: Error creating shop: column "cross_shop_enabled" of relation "shops" does not exist {
  length: 137, name: "error", severity: "ERROR", code: "42703",
  position: "145", file: "parse_target.c", line: "1066", routine: "checkInsertTargets",
  stack: "error: column \"cross_shop_enabled\" of relation \"shops\" does not exist
    at /workspace/backend/node_modules/pg-pool/index.js:45:11
    ...
    at async ShopRepository.createShop (/workspace/backend/dist/src/repositories/ShopRepository.js:133:28)
    at async /workspace/backend/dist/src/domains/shop/routes/index.js:539:9"
}
```

User's actual payload (captured from the same log) was clean and valid — just a normal mobile shop registration with standard fields. The failure is entirely in the repository code's INSERT statement trying to write to a column that doesn't exist.

Reproducibility note: requests intermittently succeed depending on staging DB state. At 13:27 UTC the column was missing (migration 006 applied) and registrations failed. Other windows during the same day have seen the column present (registrations succeed). Regardless of the DB state at any given moment, the **code is incorrect**: it references an officially obsolete column, so every time the migration is correctly applied, registration breaks.

### Why Critical

1. **Production-impacting on staging RIGHT NOW** — new shop signups are the paying acquisition flow ($500/mo subscription). Users abandon registration when they see "Server error."
2. **Latent trap for production** — if migration 006 is applied to the production DB in any future deploy cycle, shop registration will break there too.
3. **Silent bug for months** — migration 006 is dated 2025-10-03. The code has been out-of-sync for 6+ months. It's already "worked by accident" (column still existed on production) or been masked by the generic 500 error toast on the mobile client.
4. **Schema drift is a systemic risk** — this is the kind of bug that indicates weak coupling between migrations and code. Other dropped-column-still-referenced bugs may exist.

---

## Root Cause

**Migration:** `backend/migrations/006_remove_obsolete_columns.sql` (2025-10-03)

```sql
-- Remove cross_shop_enabled from shops table (no longer needed - universal redemption)
ALTER TABLE shops
DROP COLUMN IF EXISTS cross_shop_enabled;
```

Rationale per the migration's own comment: *"all shops now support universal redemption (100% of earned RCN)"*. The column is semantically obsolete — the behavior it controlled (opt-in cross-shop redemption) is now the default for every shop.

**The code that still references it** — 17 locations across the backend:

`backend/src/repositories/ShopRepository.ts`:
- **Line 15** — type `crossShopEnabled: boolean` in ShopData-like interface
- **Line 72** — type `crossShopEnabled?: boolean` in another interface
- **Line 110** — `getShop` row mapping reads `row.cross_shop_enabled`
- **Line 160** — `createShop` INSERT **column list** (the crash)
- **Line 180** — `createShop` **value** being pushed (`shop.crossShopEnabled || false`)
- **Line 284** — camel↔snake column map
- **Line 430-433** — filter clause (`WHERE ... cross_shop_enabled = $N`)
- **Lines 467, 581, 667, 733, 775, 837** — various row mappings reading `row.cross_shop_enabled`
- **Line 719** — hardcoded `AND cross_shop_enabled = true` in a WHERE clause (this is broken — would fail any query using it)

`backend/src/domains/shop/routes/index.ts`:
- **Line 39** — interface field
- **Line 114** — query parameter `crossShopEnabled` in a GET endpoint
- **Line 597** — `crossShopEnabled: false` in the `newShop` object that feeds into `createShop`

Other places: `setup.ts`, `auth.ts`, `cache.ts`, `ShopManagementService.ts`, `AdminService.ts`, `AdminController.ts`.

The **critical breaking path** is lines 160/180 in `ShopRepository.createShop` — the INSERT. Every other reference is a SELECT/filter (missing column read returns `undefined` in JS, no crash) or an unused query filter that nobody exercises. The INSERT is the one that fails.

---

## Fix

Two-tier approach. Ship Tier 1 immediately to unblock registration. Tier 2 can follow as a cleanup PR.

### Tier 1 — Minimum fix to unblock registration (~10 min)

Remove the column from the INSERT statement in `ShopRepository.createShop`. Keep the value out of the values array to preserve positional alignment with the `VALUES ($1..$N)` placeholders.

**File:** `backend/src/repositories/ShopRepository.ts`, `createShop` method around lines 155-218.

```diff
   async createShop(shop: ShopData & { location?: any }): Promise<{ id: string }> {
     try {
       const query = `
         INSERT INTO shops (
           shop_id, name, address, phone, email, wallet_address,
-          reimbursement_address, verified, active, cross_shop_enabled,
+          reimbursement_address, verified, active,
           total_tokens_issued, total_redemptions, total_reimbursements,
           join_date, last_activity, fixflow_shop_id,
           location_city, location_state, location_zip_code, location_lat, location_lng,
           facebook, twitter, instagram,
           first_name, last_name, company_size, monthly_revenue, website, referral, accept_terms, country, category
-        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
+        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
         RETURNING shop_id
       `;

       const values = [
         shop.shopId,
         shop.name,
         shop.address,
         shop.phone,
         shop.email,
         shop.walletAddress?.toLowerCase(),
         shop.reimbursementAddress?.toLowerCase(),
         shop.verified || false,
         shop.active !== false,
-        shop.crossShopEnabled || false,
         shop.totalTokensIssued || 0,
         shop.totalRedemptions || 0,
         shop.totalReimbursements || 0,
         shop.joinDate || new Date().toISOString(),
         shop.lastActivity || new Date().toISOString(),
         shop.fixflowShopId,
         typeof shop.location === 'object' ? shop.location?.city : null,
         typeof shop.location === 'object' ? shop.location?.state : null,
         typeof shop.location === 'object' ? shop.location?.zipCode : null,
         typeof shop.location === 'object' && shop.location?.lat ? parseFloat(shop.location.lat) : null,
         typeof shop.location === 'object' && shop.location?.lng ? parseFloat(shop.location.lng) : null,
         shop.facebook,
         shop.twitter,
         shop.instagram,
         shop.firstName,
         shop.lastName,
         shop.companySize,
         shop.monthlyRevenue,
         shop.website,
         shop.referral,
         shop.acceptTerms,
         shop.country,
         shop.category
       ];
```

**Exactly two edits:**
1. Remove `cross_shop_enabled,` from the column list (line 160)
2. Remove `shop.crossShopEnabled || false,` from the values array (line 180)
3. Update the `VALUES ($1..$33)` list to `($1..$32)` because now there are 32 values instead of 33

After this fix, `ShopRepository.createShop` will successfully INSERT into the current schema (with or without the column present).

### Tier 2 — Full code cleanup (~30 min, separate PR is fine)

Remove all remaining 15-ish references to `cross_shop_enabled`/`crossShopEnabled` since the column is officially obsolete. These won't *crash* because SELECT-missing-column returns `undefined` in JS, but they should still be cleaned up because:
- Leaving dead references invites confusion and re-introduction in future PRs
- The query filter at line 430-433 and line 719 is actively broken (silently returns empty results if column missing, or crashes if filter param is actually sent)
- The interfaces typed as `crossShopEnabled: boolean` mislead new developers into thinking the field exists

Cleanup checklist:
- `backend/src/repositories/ShopRepository.ts` — remove all remaining 15 references (interface fields, row mappings, filter clause, column map)
- `backend/src/domains/shop/routes/index.ts` — remove line 39 interface field, line 114 query param destructuring, line 597 in the newShop object
- `backend/src/routes/setup.ts` — remove from CREATE TABLE
- `backend/src/utils/cache.ts` — remove interface field
- `backend/src/domains/admin/services/management/ShopManagementService.ts` — remove interface field + spread
- `backend/src/domains/admin/services/AdminService.ts` — remove interface field
- `backend/src/domains/admin/controllers/AdminController.ts` — remove response mapping
- `backend/src/routes/auth.ts` — remove response mapping

For each file, run `grep -n "cross_shop_enabled\|crossShopEnabled" <file>` after editing to confirm zero remaining references.

---

## Files to Modify (Tier 1 only, minimum fix)

| File | Change |
|---|---|
| `backend/src/repositories/ShopRepository.ts` | In `createShop` method: remove `cross_shop_enabled,` from INSERT column list; remove `shop.crossShopEnabled || false,` from values array; update VALUES placeholder list from `$1..$33` to `$1..$32`. |

**Tier 2 is a follow-up PR, not part of the critical-path fix.**

No frontend/mobile changes. No migration changes. No tests to add (existing test coverage should surface the fix automatically; if a test was mocking the INSERT it'll need the column list updated).

---

## Verification Checklist

### Reproduction (before fix)

- [x] User's DO staging log captured 2026-04-23 13:27:57 UTC shows `column "cross_shop_enabled" of relation "shops" does not exist` error with request payload and stack trace.
- [ ] (Optional local repro) `cd backend && npm run dev` with `DATABASE_URL` pointing at a DB where migration 006 has been applied (column dropped). Run curl:
  ```powershell
  $body = @{ shopId="TEST-001"; name="Test"; address="123 St"; phone="+1234567890"; email="t$(Get-Random)@t.com"; walletAddress="0xAABBccDDeeFF00112233445566778899AaBbCcDd"; firstName="A"; lastName="B"; city="X"; country="Y"; acceptTerms=$true } | ConvertTo-Json
  try { Invoke-RestMethod -Uri "http://localhost:4000/api/shops/register" -Method Post -Body $body -ContentType "application/json" } catch { $_.ErrorDetails.Message }
  ```
  Expected output: 500 body `{"success":false,"error":"Failed to register shop"}`.

### After Tier 1 fix

- [ ] Same repro → 201 Success with `{ success: true, message: "Shop registered successfully. Awaiting admin verification.", data: {...} }`.
- [ ] Happy-path shop registration on mobile APK (staging build) completes end-to-end: user fills all slides, taps Register Shop, routes to `/register/pending`.
- [ ] Admin can still view the newly-registered shop in the admin dashboard (read-side still works because SELECT-missing-column returns undefined for `cross_shop_enabled`).
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes (if any test exercises createShop with a mocked INSERT assertion, update the mock to match).

### Regression

- [ ] Customer registration unaffected (different file, different route).
- [ ] Shop GET endpoints (`/shops/:id`, `/shops/wallet/:address`, etc.) still work — they SELECT `*` or named columns, and row mappings setting `crossShopEnabled: row.cross_shop_enabled` return `undefined`, which is fine (just shown as undefined/false in downstream code).
- [ ] Admin shop list / approval flows still work.
- [ ] Existing shops in the DB (with or without the column) are still readable.

### Tier 2 (post-cleanup)

- [ ] `grep -rn "cross_shop_enabled\|crossShopEnabled" backend/src` returns zero matches (or only comments/docs).
- [ ] All backend tests still pass.
- [ ] Admin UI doesn't break when the `crossShopEnabled` field is absent from responses.
- [ ] Any frontend/mobile code consuming shop data doesn't branch on `crossShopEnabled` (spot-check by grepping the frontend).

---

## Notes

- **Discovery path:** the user's curl-equivalent mobile registration failed with a generic 500. Backend logs (DO staging at 2026-04-23 13:27:57 UTC) captured the real Postgres error `column "cross_shop_enabled" of relation "shops" does not exist`. Matched against migration `006_remove_obsolete_columns.sql` which dropped that column in 2025-10-03 for universal redemption reasons.
- **Why the bug is intermittent on staging:** the column state seems to fluctuate (my curl tests before and after 13:27 both succeeded). Likely cause: the staging DB has had migration 006 applied and rolled back multiple times during other schema work, or there are competing migration scripts. Tier 1 fix makes the code immune to the column's presence/absence — a shop registration will succeed either way.
- **Relationship to other filed bugs:**
  - `docs/tasks/23-04-2026/bug-shop-register-route-masks-errors-as-500.md` — still valid as a supplementary fix. Once Tier 1 of THIS bug lands, shop registration succeeds on the happy path; but the shop route handler still maps ALL future errors to 500 with a generic message, hiding real validation/DB errors. The error-mapping fix remains important for long-term error UX. **Order doesn't strictly matter, but this doc's Tier 1 is the acquisition blocker.** Ship Tier 1 FIRST.
  - `mobile/docs/tasks/bugs/23-04-2026/bug-mutation-retry-on-5xx-duplicates-toasts.md` — also valid. Even after THIS fix, if any future 500 occurs, the mobile client currently retries and multiplies toasts. That fix is complementary and covers the mobile client's UX across all mutations, not just shop register.
- **Customer registration is NOT affected by this bug.** The `customers` table didn't have `cross_shop_enabled` (it was shop-specific). Customer's register path is independent and has been verified working by curl tests.
- **Defensive + Recovery scoping note (per memory `feedback_defensive_vs_recovery_scoping.md`):** this is a missing-data bug in disguise — the "data" being missing is the DB column. Tier 1 is the **defensive fix** (remove the broken reference so INSERT succeeds regardless). Tier 2 is the **follow-up** (clean up remaining dead references so the next developer isn't misled). There is no Recovery fix to pair — the code simply shouldn't reference a dropped column.
- **Commit policy:** do not commit without explicit user approval (per CLAUDE.md + memory `feedback_commit_policy.md`).
- **Evidence stored at `c:\dev\do-shop-err.txt`** — not committed to the repo.

---

## Implementation confidence notes for receiving Claude

If you're the Claude implementing this fix:

1. **ONLY edit `backend/src/repositories/ShopRepository.ts`** for Tier 1. Do not touch any other file.

2. **Locate the exact method.** The file has multiple methods. Find `async createShop(shop: ShopData & { location?: any }): Promise<{ id: string }>` around line 155. Edit only within this method's body.

3. **Three coordinated edits, all inside `createShop`:**
   - (a) Remove `cross_shop_enabled,` from the `INSERT INTO shops (... )` column list (line 160)
   - (b) Remove `shop.crossShopEnabled || false,` from the `values` array (line 180)
   - (c) Change `VALUES ($1, $2, ..., $33)` to `VALUES ($1, $2, ..., $32)` — the placeholder list must match the reduced column/value count

4. **Do NOT touch the rest of `ShopRepository.ts`** (interfaces, row mappings, filter clauses, column map). Those are the Tier 2 scope and are read-side — they don't crash when the column is missing.

5. **Preserve every other column and every other value.** The fix is surgical: minus one column, minus one value, minus one placeholder.

6. **After editing**, run from the `backend/` directory:
   - `npm run typecheck` — must pass
   - `npm run test` — must pass (if any test mocks the INSERT, it may need the placeholder count updated)
   - `npm run dev` and curl the endpoint locally if you want a quick smoke test; use the PowerShell repro in the Verification section above

7. **Do NOT add a new migration** to re-create the `cross_shop_enabled` column. That would contradict migration 006's intent (the column is obsolete). The fix is to align the code with the migration, not the other way around.

8. **Tier 2 is out of scope for this PR.** A separate PR can remove the 15-ish remaining dead references. Do not bundle Tier 2 into Tier 1 unless explicitly requested; the goal of Tier 1 is to unblock production ASAP with minimal risk surface.

9. **If you accidentally break placeholder alignment** (e.g., drop the column but leave the value, or vice versa), the INSERT will write wrong data to wrong columns — far worse than the current failure. Double-check that columns, values, and placeholder count are all reduced by exactly 1.

10. **Side effect to monitor:** any downstream code that reads `shop.crossShopEnabled` from a newly-created shop will get `undefined`. Existing code typically treats it as falsy, which is the same effective behavior as the old `false` default. If any logic genuinely branched on this flag, that logic is already dead under the universal-redemption model and can be cleaned up in Tier 2.
