# Bug: "Message Shop" Button on Shop Profile Does Not Open Conversation

## Status: Open
## Priority: Medium
## Date: 2026-04-03
## Category: Bug - Messaging / Navigation
## Location: `/customer/shop/[shopId]` → "Message Shop" button

---

## Overview

The "Message Shop" button on the customer shop profile page (`/customer/shop/dc_shopu`) sends a message successfully but navigates to `/customer?tab=messages` without specifying which conversation to open. The user lands on the Messages tab with no conversation selected and must manually find and click the conversation.

The same button in the Service Details modal works correctly — it captures the `conversationId` from the API response and navigates to `/customer?tab=messages&conversation=conv_xxx`, which auto-selects the conversation.

---

## Root Cause

**File:** `frontend/src/components/customer/ShopProfileClient.tsx`
**Function:** `handleMessageShop` (line ~236)

The `sendMessage()` API call returns a `Message` object containing `conversationId`, but the return value is discarded. Navigation uses a hardcoded URL without the conversation parameter.

```typescript
// BROKEN (ShopProfileClient.tsx:248-256)
await messagingApi.sendMessage({        // <-- return value discarded
  shopId: shopInfo.shopId,
  customerAddress: userProfile.address,
  messageText: initialMessage,
  messageType: "text",
});
router.push("/customer?tab=messages");  // <-- no conversation param
```

```typescript
// WORKING (ServiceDetailsModal.tsx:67-83)
const sentMessage = await messagingApi.sendMessage({  // <-- captures response
  shopId: service.shopId,
  customerAddress: userProfile.address,
  messageText: initialMessage,
  messageType: "service_link",
  metadata: { ... }
});
const conversationParam = sentMessage?.conversationId
  ? `&conversation=${sentMessage.conversationId}` : '';
router.push(`/customer?tab=messages${conversationParam}`);  // <-- includes conversation
```

---

## Fix Required

In `frontend/src/components/customer/ShopProfileClient.tsx`, `handleMessageShop` function:

1. Capture the return value from `messagingApi.sendMessage()`
2. Extract `conversationId` from the response
3. Include `&conversation={conversationId}` in the router.push URL

This matches the working pattern in `ServiceDetailsModal.tsx`.

---

## Affected Files

| File | Change |
|------|--------|
| `frontend/src/components/customer/ShopProfileClient.tsx` | Capture `sendMessage` response, add `conversation` param to navigation URL |

---

## How the Messaging Flow Works

1. `messagingApi.sendMessage()` calls `POST /api/messages/send`
2. Backend `MessageService.sendMessage()` calls `getOrCreateConversation()` to find or create a conversation
3. Returns a `Message` object with `conversationId` field
4. Frontend navigates to `/customer?tab=messages&conversation=conv_xxx`
5. `MessagesTab` reads the `conversation` query param via `useSearchParams()`
6. `MessagesContainer` auto-selects and opens that conversation via `useEffect`

---

## QA Test Plan

### Pre-fix (reproduce bug)
1. Login as customer
2. Navigate to a shop profile page (e.g., `/customer/shop/dc_shopu`)
3. Click "Message Shop" button
4. **Observe**: Redirects to `/customer?tab=messages` — no conversation is selected
5. Must manually find and click the conversation in the sidebar

### Post-fix (verify)
1. Login as customer
2. Navigate to a shop profile page
3. Click "Message Shop" button
4. **Verify**: URL changes to `/customer?tab=messages&conversation=conv_xxx`
5. **Verify**: The conversation with the shop is automatically opened/selected
6. **Verify**: The initial message ("Hi! I'd like to inquire about your services.") is visible in the thread

### Comparison test
1. Open a service details modal and click "Message Shop"
2. **Verify**: Same behavior as the shop profile — conversation auto-opens
3. Both flows should produce identical navigation UX

### Edge cases
- Message a shop for the first time (new conversation created)
- Message a shop with an existing conversation (should reuse it)
- Click "Message Shop" while wallet is not connected (should show error toast)
