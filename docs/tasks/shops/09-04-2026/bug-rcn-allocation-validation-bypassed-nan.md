# Bug: RCN Allocation Validation Bypassed Due to NaN Comparison

## Status: Fixed (2026-04-09)
## Priority: Critical
## Date: 2026-04-09
## Category: Bug - Token Economics / Data Integrity
## Affected: Group token issuance RCN backing validation

---

## Overview

The RCN allocation check that prevents issuing group tokens without sufficient backing is bypassed because `available_rcn` is always `null` in the database. `parseFloat(null)` returns `NaN`, and `NaN < requiredRcn` is always `false` in JavaScript — so the validation never rejects.

This allows shops to issue unlimited group tokens without allocating any RCN backing, breaking the 1:2 token-to-RCN ratio requirement.

---

## Evidence

Shop peanut allocated 200 RCN to Amazing Resto but issued 1,820 tokens (requiring 910 RCN backing):

```
allocated_rcn: 200
used_rcn: 910
available_rcn: null  ← never computed
```

Expected: issuance should have been rejected (200 available < 910 required).

---

## Root Cause

### Bug 1: `available_rcn` column is never computed

The `shop_group_rcn_allocations` table has `available_rcn` as a stored column with no default. It's never updated by any code — it stays `null` forever.

It should be either:
- A computed/generated column: `allocated_rcn - used_rcn`
- Or updated alongside `allocated_rcn` and `used_rcn`

### Bug 2: NaN bypasses validation

**File:** `backend/src/services/AffiliateShopGroupService.ts` lines 390-398

```typescript
const allocation = await this.repository.getShopGroupRcnAllocation(shopId, groupId);

if (!allocation || allocation.availableRcn < requiredRcn) {
  throw new Error('Insufficient RCN allocated...');
}
```

**File:** `backend/src/repositories/AffiliateShopGroupRepository.ts` line 1105

```typescript
availableRcn: parseFloat(row.available_rcn),  // parseFloat(null) = NaN
```

`NaN < 910` evaluates to `false` → validation passes → tokens issued without backing.

---

## Fix Required

### Fix 1: Compute `available_rcn` in the repository query

Instead of reading the stored `available_rcn` column (which is never updated), compute it:

```typescript
// In getShopGroupRcnAllocation()
const query = `
  SELECT *,
    (allocated_rcn - used_rcn) as computed_available_rcn
  FROM shop_group_rcn_allocations
  WHERE shop_id = $1 AND group_id = $2
`;

// Then use:
availableRcn: parseFloat(row.computed_available_rcn) || 0,
```

### Fix 2: Add NaN safety to validation

```typescript
const available = allocation?.availableRcn || 0;
if (!allocation || isNaN(available) || available < requiredRcn) {
  throw new Error('Insufficient RCN allocated...');
}
```

### Fix 3: Migration to fix the column

Either make it a generated column or drop it and always compute:

```sql
-- Option A: Update existing records
UPDATE shop_group_rcn_allocations
SET available_rcn = allocated_rcn - used_rcn;

-- Option B: Make it a generated column (PostgreSQL 12+)
ALTER TABLE shop_group_rcn_allocations
DROP COLUMN available_rcn;

ALTER TABLE shop_group_rcn_allocations
ADD COLUMN available_rcn NUMERIC GENERATED ALWAYS AS (allocated_rcn - used_rcn) STORED;
```

### Fix 4: Fix peanut's negative balance

The 910 used_rcn needs to be corrected since it should never have been allowed:

```sql
-- Reset used_rcn to match allocated_rcn (cap at what was available)
UPDATE shop_group_rcn_allocations
SET used_rcn = allocated_rcn
WHERE shop_id = 'peanut' AND used_rcn > allocated_rcn;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/repositories/AffiliateShopGroupRepository.ts` | Compute `available_rcn` in query, add NaN fallback |
| `backend/src/services/AffiliateShopGroupService.ts` | Add NaN safety check in validation |
| `backend/migrations/` | Optional: fix column to be generated or always computed |

---

## QA Test Plan

1. Allocate 100 RCN to a group
2. Link a $200 service (100% reward, 1.0x) → would issue 200 tokens, need 100 RCN backing
3. Customer books → order completes → **Expected**: 200 tokens issued, used_rcn = 100, available = 0
4. Another customer books same service → **Expected**: Rejected — "Insufficient RCN allocated"
5. Allocate 100 more RCN → book again → **Expected**: Tokens issued successfully
