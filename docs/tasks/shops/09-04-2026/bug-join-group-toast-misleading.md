# Bug: Join Group Toast Shows "Successfully Joined" Even When Pending Approval

## Status: Fixed (2026-04-09)
## Priority: Low
## Date: 2026-04-09
## Category: Bug - UX / Misleading Message
## Affected: Shop Affiliate Groups → Join by invite code

---

## Overview

When a shop joins a group via invite code, the toast always shows "Successfully joined group!" regardless of whether the request was auto-approved or is pending admin approval. This is misleading — shops think they're already in the group when they actually need to wait for approval.

---

## Root Cause

**File:** `frontend/src/components/shop/groups/ShopGroupsClient.tsx` line 124

```typescript
await shopGroupsAPI.joinByInviteCode(inviteCode, message);
toast.success("Successfully joined group!");  // Always shows this
```

The API returns a member object with `status` field (`'active'` if auto-approved, `'pending'` if needs approval) but the frontend ignored it and always showed the success message.

---

## Backend Behavior

- `autoApproveRequests: true` → member created with status `'active'` (instantly joined)
- `autoApproveRequests: false` → member created with status `'pending'` (needs admin approval)

The modal info text correctly says "For private groups, your request will need admin approval" — but the toast after submission contradicts this.

---

## Fix Applied

```typescript
const result = await shopGroupsAPI.joinByInviteCode(inviteCode, message);
if (result?.status === 'active') {
  toast.success("Successfully joined group!");
} else {
  toast.success("Join request submitted! Waiting for admin approval.");
}
```

---

## File Changed

| File | Change |
|------|--------|
| `frontend/src/components/shop/groups/ShopGroupsClient.tsx:121-126` | Check response status before showing toast |

---

## QA Test Plan

1. Join a group with `autoApproveRequests: true`
2. **Expected toast**: "Successfully joined group!"
3. Join a group with `autoApproveRequests: false`
4. **Expected toast**: "Join request submitted! Waiting for admin approval."
