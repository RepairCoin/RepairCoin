# BUG: Clicking customer in Messages dropdown doesn't open conversation

**Status:** Open
**Priority:** Medium
**Type:** Bug
**Reported:** 2026-03-06

## Description

When clicking a customer name in the Messages preview dropdown (top-right chat icon), the app navigates to the Messages tab with the conversation ID in the URL, but the conversation panel shows "Select a conversation" instead of auto-opening the clicked conversation.

The conversation only opens when manually clicking a customer name in the Messages sidebar list.

## Steps to Reproduce

1. Go to Shop Dashboard (any tab)
2. Click the chat icon in the top-right header
3. In the Messages dropdown, click on a customer (e.g., "Lee Ann")
4. **Expected:** Navigates to Messages tab and opens that conversation
5. **Actual:** Navigates to Messages tab but shows "Select a conversation" empty state

## Root Cause

The `conversation` query parameter from the URL is never read by the components:

1. **`MessagePreviewDropdown.tsx`** (line 72-78) correctly navigates to:
   `/shop?tab=messages&conversation=conv_1767839850774_38m9o8bgm`

2. **`MessagesTab.tsx`** (line 166) renders `<MessagesContainer>` but does NOT pass the conversation ID from the URL.

3. **`MessagesContainer.tsx`** (line 19) initializes `selectedConversationId` as `null` and never reads the URL `conversation` parameter.

The conversation ID is in the URL but no component reads it.

## Affected Files

- `frontend/src/components/messaging/MessagePreviewDropdown.tsx` - Sends conversation ID (working correctly)
- `frontend/src/components/shop/tabs/MessagesTab.tsx` - Does not pass conversation ID to MessagesContainer
- `frontend/src/components/messaging/MessagesContainer.tsx` - Does not read URL query param
- `frontend/src/components/customer/tabs/MessagesTab.tsx` - Same issue for customer side
- `frontend/src/app/(authenticated)/customer/CustomerDashboardClient.tsx` - Customer dashboard (same bug)
- `frontend/src/components/shop/ShopDashboardClient.tsx` - Shop dashboard (same bug)

## Fix Approach

**Option A (Recommended):** Read URL param inside `MessagesContainer`
- Use `useSearchParams()` from `next/navigation` inside `MessagesContainer`
- Initialize `selectedConversationId` from the `conversation` query param
- Add effect to sync when URL param changes

**Option B:** Pass prop from parent
- Read `conversation` param in `MessagesTab` and pass it as `initialConversationId` prop to `MessagesContainer`
- MessagesContainer uses it as initial state

### Implementation (Option A)

```tsx
// MessagesContainer.tsx
import { useSearchParams } from 'next/navigation';

// Inside component:
const searchParams = useSearchParams();
const urlConversationId = searchParams.get('conversation');

// Initialize with URL param
const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

// Sync URL param to state
useEffect(() => {
  if (urlConversationId && conversations.length > 0) {
    const exists = conversations.find(c => c.id === urlConversationId);
    if (exists) {
      setSelectedConversationId(urlConversationId);
      setShowMobileThread(true);
    }
  }
}, [urlConversationId, conversations]);
```

## Impact

- Affects both shop and customer dashboards
- Messages dropdown click navigates but doesn't auto-open conversation
- Users must click the conversation again in the sidebar — confusing UX
