# Bug: Rejoining Group Creates Duplicate Member Records

## Status: Fixed (2026-04-09)
## Priority: Medium
## Date: 2026-04-09
## Category: Bug - Data Integrity / Affiliate Groups
## Affected: Shop group membership management

---

## Overview

When a rejected or removed shop tries to rejoin a group, a new member record is created instead of updating the existing one. This creates duplicate records in `affiliate_shop_group_members` (e.g., one rejected + one pending for the same shop). Pending members can also submit duplicate requests.

No unique constraint exists on `(group_id, shop_id)` to prevent this.

---

## Root Cause

**`AffiliateShopGroupService.requestToJoinGroup()`** line 222-226:

```typescript
const isMember = await this.repository.isShopMemberOfGroup(groupId, shopId);
if (isMember) {
  throw new Error('Shop is already a member of this group');
}
```

**`AffiliateShopGroupRepository.isShopMemberOfGroup()`** line 489:

```sql
SELECT 1 FROM affiliate_shop_group_members
WHERE group_id = $1 AND shop_id = $2 AND status = 'active'
```

Only checks for `status = 'active'`. Rejected, removed, and pending records are invisible to this check.

**`addMemberRequest()`** does a plain INSERT — no check for existing rows, no unique constraint to prevent duplicates.

---

## Current Behavior

| Existing Status | Try to rejoin | Result |
|---|---|---|
| Active | Blocked ("already a member") | Correct |
| Pending | Creates duplicate pending record | **Bug** |
| Rejected | Creates duplicate (rejected + pending) | **Bug** |
| Removed | Creates duplicate (removed + pending) | **Bug** |

---

## Expected Behavior

| Existing Status | Try to rejoin | Expected Result |
|---|---|---|
| Active | Blocked | "You are already a member of this group" |
| Pending | Blocked | "You already have a pending join request for this group" |
| Rejected | Allowed — update existing | Reset existing record to `pending`, update `request_message` and `requested_at` |
| Removed | Allowed — update existing | Reset existing record to `pending`, update `request_message` and `requested_at` |

Key principle: **one record per shop per group** — update status instead of creating duplicates.

---

## Fix Required

### Step 1: Update `isShopMemberOfGroup` or create new check

Check ALL statuses, not just active:

```typescript
async getShopMembershipRecord(groupId: string, shopId: string): Promise<{ status: string } | null> {
  const query = `
    SELECT status FROM affiliate_shop_group_members
    WHERE group_id = $1 AND shop_id = $2
    ORDER BY created_at DESC LIMIT 1
  `;
  const result = await this.pool.query(query, [groupId, shopId]);
  return result.rows[0] || null;
}
```

### Step 2: Update `requestToJoinGroup` logic

```typescript
const existing = await this.repository.getShopMembershipRecord(groupId, shopId);

if (existing) {
  if (existing.status === 'active') {
    throw new Error('You are already a member of this group');
  }
  if (existing.status === 'pending') {
    throw new Error('You already have a pending join request for this group');
  }
  if (existing.status === 'rejected' || existing.status === 'removed') {
    // Update existing record back to pending
    await this.repository.resetMemberToPending(groupId, shopId, requestMessage);
    // Auto-approve if enabled
    if (group.autoApproveRequests) {
      await this.repository.approveMemberRequest(groupId, shopId, group.createdByShopId);
    }
    return;
  }
}

// No existing record — create new
await this.repository.addMemberRequest(groupId, shopId, requestMessage);
```

### Step 3: Add `resetMemberToPending` repository method

```typescript
async resetMemberToPending(groupId: string, shopId: string, requestMessage?: string): Promise<void> {
  await this.pool.query(`
    UPDATE affiliate_shop_group_members
    SET status = 'pending',
        request_message = $3,
        requested_at = NOW(),
        approved_by_shop_id = NULL,
        approved_at = NULL
    WHERE group_id = $1 AND shop_id = $2
  `, [groupId, shopId, requestMessage || null]);
}
```

### Step 4: Add unique constraint (optional but recommended)

```sql
-- Clean up existing duplicates first
DELETE FROM affiliate_shop_group_members a
USING affiliate_shop_group_members b
WHERE a.id > b.id
AND a.group_id = b.group_id
AND a.shop_id = b.shop_id;

-- Add constraint
ALTER TABLE affiliate_shop_group_members
ADD CONSTRAINT unique_group_shop_member UNIQUE (group_id, shop_id);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/repositories/AffiliateShopGroupRepository.ts` | Add `getShopMembershipRecord()` and `resetMemberToPending()` methods |
| `backend/src/services/AffiliateShopGroupService.ts` | Update `requestToJoinGroup()` to handle all statuses |
| `backend/migrations/` | Optional: new migration to clean duplicates and add unique constraint |

---

## QA Test Plan

### Pending member
1. Shop A requests to join Group X (pending)
2. Shop A tries to join again
3. **Expected**: "You already have a pending join request"

### Rejected member
1. Admin rejects Shop A's request
2. Shop A requests to join again
3. **Expected**: Request resubmitted (status back to pending), no duplicate record
4. Admin sees the new request in pending list

### Removed member
1. Admin removes Shop A from group
2. Shop A requests to rejoin
3. **Expected**: Request submitted (status back to pending), no duplicate record

### Active member
1. Shop A is an active member
2. Shop A tries to join again
3. **Expected**: "You are already a member of this group"
