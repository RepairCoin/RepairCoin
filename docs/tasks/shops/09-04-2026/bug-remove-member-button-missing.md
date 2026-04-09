# Bug: Remove Member Button Missing from Group Members UI

## Status: Fixed (2026-04-09)
## Priority: Medium
## Date: 2026-04-09
## Category: Bug - Missing UI Element
## Affected: Shop Affiliate Groups → Members tab

---

## Overview

The group admin cannot remove active members from the group. The remove member handler (`handleRemoveMember`), confirmation modal, and backend API endpoint all exist and work — but there's no button in the members table to trigger the removal.

---

## What Exists (Built but Inaccessible)

| Component | Status |
|---|---|
| `handleRemoveMember()` function | Built (line 81) |
| `memberToRemove` state | Built (line 23) |
| Remove confirmation modal | Built (lines 218-250) |
| Backend `DELETE /affiliate-shop-groups/:groupId/members/:shopId` | Works |
| Frontend `removeMember(groupId, shopId)` API method | Works |
| **Button to trigger removal** | **Missing** |

## What's Missing

The `MembersTable` component (line 256) only accepts these action props:
```typescript
onViewApplication: (member) => void;
onApprove: (shopId: string) => void;
onReject: (shopId: string) => void;
```

No `onRemove` prop exists. The active members view (lines 335-363) shows rank, RCN allocation — but no action column for admins.

`setMemberToRemove(member)` is never called — it's only called with `null` to clear the state.

---

## Fix Required

1. Add `onRemove` prop to `MembersTable` interface
2. Add an action column in the active members table (visible only for admin, not for self)
3. Render a remove button that calls `onRemove(member)`
4. Pass `setMemberToRemove` as the `onRemove` handler

```typescript
// In MembersTable props:
onRemove?: (member: AffiliateShopGroupMember) => void;

// In active members row (admin only, not self):
{isCurrentUserAdmin && !isCurrentUser && member.role !== 'admin' && (
  <td className="py-4 px-4 text-center">
    <button onClick={() => onRemove?.(member)} className="text-red-400 hover:text-red-300">
      Remove
    </button>
  </td>
)}
```

Note: Admins should not be able to remove other admins or themselves.

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shop/groups/GroupMembersTab.tsx` | Add `onRemove` prop to `MembersTable`, add action column for active members, pass `setMemberToRemove` |

---

## QA Test Plan

1. Login as group admin → Members tab → Active filter
2. **Expected**: See "Remove" button next to non-admin members
3. Click Remove → confirmation modal appears
4. Confirm → member removed, list refreshes
5. **Expected**: Cannot remove self
6. **Expected**: Cannot remove other admins
7. Non-admin members should NOT see remove buttons
