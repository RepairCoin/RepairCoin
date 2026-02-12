# Strategy: Display Shop Logo in Messages

## Problem Statement
When a shop has a logo configured in their profile settings, the Messages interface shows a generic avatar (name initial in yellow circle) instead of the actual shop logo.

## Current State Analysis

### Data Flow (Already Working)
```
Database (shops.logo_url)
    ↓
MessageRepository.getConversations() - JOINs shops table, maps logo_url → shopImageUrl
    ↓
API Response (/api/messages/conversations) - includes shopImageUrl field
    ↓
Frontend messaging.ts - Conversation interface has shopImageUrl
    ↓
Frontend Components - DATA AVAILABLE BUT NOT RENDERED
```

### Key Finding
The `shopImageUrl` is **already available** in the API response but the frontend components are not using it. They show name initials instead.

## Files to Modify

| File | Current Behavior | Required Change |
|------|------------------|-----------------|
| `frontend/src/components/messaging/MessagePreviewDropdown.tsx` | Shows name initial in yellow circle (line 163) | Use `conv.shopImageUrl` if available |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Doesn't pass `shopImageUrl` to transformed data (line 37-52) | Pass `participantAvatar` field |
| `frontend/src/components/messaging/MessageInbox.tsx` | Has `participantAvatar` in interface but not used | Render avatar image if provided |
| `frontend/src/components/messaging/ConversationThread.tsx` | Shows name initial in header | Use shop logo in conversation header |

## Implementation Plan

### Step 1: MessagePreviewDropdown.tsx
Update avatar rendering to show shop logo when available:

```tsx
// Before (line 163-165)
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFCC00] flex items-center justify-center text-[#101010] font-bold text-sm">
  {otherPartyName.charAt(0).toUpperCase()}
</div>

// After
{conv.shopImageUrl && userType === 'customer' ? (
  <img
    src={conv.shopImageUrl}
    alt={conv.shopName || 'Shop'}
    className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
  />
) : (
  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFCC00] flex items-center justify-center text-[#101010] font-bold text-sm">
    {otherPartyName.charAt(0).toUpperCase()}
  </div>
)}
```

### Step 2: MessagesContainer.tsx
Pass `participantAvatar` in the transformed conversation data:

```tsx
// Add to transformation (around line 37-52)
participantAvatar: userType === "customer" ? conv.shopImageUrl : undefined,
```

### Step 3: MessageInbox.tsx
Render avatar image when `participantAvatar` is provided instead of name initial.

### Step 4: ConversationThread.tsx
Update conversation header to display shop logo when available.

## Fallback Strategy
- If `shopImageUrl` is null/undefined → Show name initial (current behavior)
- If image fails to load → Use `onError` handler to fall back to name initial

## Testing Checklist
- [ ] Shop with logo: Logo appears in message dropdown
- [ ] Shop without logo: Name initial appears (fallback)
- [ ] Customer view: See shop logos
- [ ] Shop view: See customer initials (customers don't have logos)
- [ ] Image load error: Graceful fallback to initial

## Impact
- **Customer Experience**: More recognizable shop identity in messages
- **Brand Consistency**: Shop branding visible throughout the app
- **No Backend Changes**: Only frontend rendering changes needed
