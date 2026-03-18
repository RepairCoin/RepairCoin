# Feature: Connect "Send Message" Button to Chat

**Status:** Open
**Priority:** MEDIUM
**Est. Effort:** 2-3 hours
**Created:** 2026-03-10

---

## Problem

"Send Message" button on Customer Profile page is non-functional.

## Implementation

1. Add backend endpoint: `POST /api/messages/conversations/get-or-create`
2. Add frontend API method: `getOrCreateConversation()`
3. Wire button to navigate to Messages tab with conversation open

## Files to Modify

**Frontend:**
- `frontend/src/components/shop/customers/profile/CustomerInfoCard.tsx`
- `frontend/src/components/shop/customers/profile/CustomerProfileView.tsx`
- `frontend/src/services/api/messaging.ts`

**Backend:**
- `backend/src/domains/messaging/routes.ts`
- `backend/src/domains/messaging/controllers/MessageController.ts`

## Verification Checklist

- [ ] Click "Send Message" for customer with existing conversation → opens their chat
- [ ] Click "Send Message" for customer with no prior messages → creates conversation and opens empty chat
- [ ] Conversation appears in Messages sidebar list after creation
