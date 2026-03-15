# FIX: Conversation Query Param Not Cleaned Up on Tab Switch

**Status:** Complete
**Priority:** Medium
**Type:** Bug Fix (Customer & Shop Dashboard)
**Created:** 2026-03-11

## Description

When navigating to the messages tab with a conversation pre-selected (e.g., from the Service Details modal message icon or the message dropdown), the `conversation` query parameter persisted in the URL when switching to other tabs.

### Example

1. Click message icon on Service Details modal
2. Redirected to: `/customer?tab=messages&conversation=conv_123`
3. Click "Orders" in sidebar
4. URL becomes: `/customer?tab=orders&conversation=conv_123` (bug — `conversation` param should be gone)

### Root Cause

The `handleTabChange` function in both `CustomerDashboardClient.tsx` and `ShopDashboardClient.tsx` used `window.history.pushState` to update the URL with the new `tab` param, but never cleaned up the `conversation` param when leaving the messages tab.

## Fix

Added `url.searchParams.delete("conversation")` when the target tab is not `messages`.

### Files Modified

| File | Change |
| ---- | ------ |
| `frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx` | Delete `conversation` param in `handleTabChange` when tab !== "messages" |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Same cleanup in shop `handleTabChange` |

### Related Fix (Same Session)

**Service Details Modal — Message icon not opening conversation:**

The message icon (`MessageCircle`) in `ServiceDetailsModal.tsx` sent a message via API but navigated to `/customer?tab=messages` without the `conversation` param, so the conversation wasn't pre-selected.

**Fix:** Captured the `conversationId` from the `sendMessage` response and appended it to the URL:

```typescript
const sentMessage = await messagingApi.sendMessage({...});
const conversationParam = sentMessage?.conversationId ? `&conversation=${sentMessage.conversationId}` : '';
router.push(`/customer?tab=messages${conversationParam}`);
```

| File | Change |
| ---- | ------ |
| `frontend/src/components/customer/ServiceDetailsModal.tsx` | Use `conversationId` from response to navigate with `&conversation=` param |

## Effort

~10 minutes
