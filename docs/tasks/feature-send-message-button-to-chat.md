# FEATURE: Connect "Send Message" Button to Customer Chat

**Status:** Open
**Priority:** Medium
**Type:** Feature (UX Integration)
**Created:** 2026-03-09

## Description

The "Send Message" button on the shop's Customer Profile page (`/shop?tab=customers`) is currently a **static, non-functional button**. It needs to be wired up to navigate the shop owner to the Messages tab (`/shop?tab=messages`) and open (or create) a conversation with that specific customer.

The chat dropdown in the upper right corner (sc3) already has the navigation pattern — clicking a conversation calls `router.push('/shop?tab=messages&conversation=${conversationId}')`. The "Send Message" button should reuse this same flow.

## Current State

- **Button location:** `frontend/src/components/shop/customers/profile/CustomerInfoCard.tsx` (line 133)
- **Button is static:** No `onClick` handler, no routing, no API call
- **Chat system fully functional:** Messages tab, conversation thread, real-time polling all work
- **Backend ready:** `MessageRepository.getOrCreateConversation(customerAddress, shopId)` exists (line 76) and handles both lookup and creation

## Implementation Plan

### Step 1: Add Backend Endpoint — Get or Create Conversation

**File:** `backend/src/domains/messaging/routes.ts`

Add a new route:
```
POST /api/messages/conversations/get-or-create
Body: { customerAddress: string }
```

**File:** `backend/src/domains/messaging/controllers/MessageController.ts`

Add handler that:
1. Reads `customerAddress` from body
2. Gets `shopId` from `req.user.shopId` (authenticated shop)
3. Calls `messageRepository.getOrCreateConversation(customerAddress, shopId)`
4. Returns `{ success: true, data: { conversationId } }`

**Why:** The frontend currently needs a `conversationId` to navigate. This endpoint gives us one, creating the conversation if it doesn't exist yet.

### Step 2: Add Frontend API Method

**File:** `frontend/src/services/api/messaging.ts`

Add:
```typescript
export const getOrCreateConversation = async (customerAddress: string): Promise<{ conversationId: string }> => {
  const response = await apiClient.post('/messages/conversations/get-or-create', { customerAddress });
  return response.data;
};
```

### Step 3: Wire Up the "Send Message" Button

**File:** `frontend/src/components/shop/customers/profile/CustomerInfoCard.tsx`

Changes:
1. Add `onSendMessage?: (customerAddress: string) => void` to `CustomerInfoCardProps`
2. Add `onClick` handler to the button (line 133):
   ```typescript
   <button
     onClick={() => onSendMessage?.(customer.address)}
     className="..."
   >
   ```

### Step 4: Pass Handler from Parent

**File:** `frontend/src/components/shop/customers/profile/CustomerProfileView.tsx`

1. Import `useRouter` from Next.js and `getOrCreateConversation` from messaging API
2. Create handler:
   ```typescript
   const handleSendMessage = async (customerAddress: string) => {
     const { conversationId } = await getOrCreateConversation(customerAddress);
     router.push(`/shop?tab=messages&conversation=${conversationId}`);
   };
   ```
3. Pass to `CustomerInfoCard`:
   ```typescript
   <CustomerInfoCard customer={...} onSendMessage={handleSendMessage} />
   ```

## Key Files

### Frontend
| File | Change |
|------|--------|
| `frontend/src/components/shop/customers/profile/CustomerInfoCard.tsx` | Add `onSendMessage` prop and onClick handler to button (line 133) |
| `frontend/src/components/shop/customers/profile/CustomerProfileView.tsx` | Create handler: call API → get conversationId → `router.push()` |
| `frontend/src/services/api/messaging.ts` | Add `getOrCreateConversation()` API method |

### Backend
| File | Change |
|------|--------|
| `backend/src/domains/messaging/routes.ts` | Add `POST /api/messages/conversations/get-or-create` route |
| `backend/src/domains/messaging/controllers/MessageController.ts` | Add `getOrCreateConversation` handler |

### Already Working (No Changes Needed)
| File | Purpose |
|------|---------|
| `backend/src/repositories/MessageRepository.ts` | `getOrCreateConversation()` method (line 76-123) already handles lookup + creation |
| `frontend/src/components/shop/tabs/MessagesTab.tsx` | Reads `conversation` from URL params, passes to `MessagesContainer` |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Auto-selects conversation via `initialConversationId` prop |
| `frontend/src/components/messaging/MessagePreviewDropdown.tsx` | Reference for navigation pattern: `router.push('/shop?tab=messages&conversation=${id}')` (line 72-79) |

## Navigation Flow

```
Shop clicks "Send Message" on Customer Profile
  → CustomerInfoCard calls onSendMessage(customerAddress)
  → CustomerProfileView handler:
      1. POST /api/messages/conversations/get-or-create { customerAddress }
      2. Backend: MessageRepository.getOrCreateConversation(address, shopId)
         - If conversation exists → return conversationId
         - If not → create new conv_XXXX_XXXX → return conversationId
      3. router.push('/shop?tab=messages&conversation=${conversationId}')
  → ShopDashboardClient reads tab=messages from URL → renders MessagesTab
  → MessagesTab reads conversation param → passes to MessagesContainer
  → MessagesContainer auto-selects conversation → shows chat thread
```

## Edge Cases to Handle

- **Loading state:** Show spinner on button while API call is in progress
- **Error handling:** Toast error if conversation creation fails
- **Customer without prior messages:** New conversation should open with empty thread (already handled by existing UI)
- **Navigation from modal:** If customer profile is in a modal, close modal before navigating

## Testing

- Click "Send Message" for customer with existing conversation → should open their chat
- Click "Send Message" for customer with no prior messages → should create conversation and open empty chat
- Verify the conversation appears in the Messages sidebar list after creation
- Verify the chat dropdown also shows the new conversation
