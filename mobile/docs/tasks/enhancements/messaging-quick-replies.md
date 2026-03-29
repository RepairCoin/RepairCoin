# Feature: Quick Replies for Shop Messaging

**Status:** Pending
**Priority:** Medium
**Est. Effort:** 2-3 hrs
**Created:** 2026-03-10
**Updated:** 2026-03-10

---

## Overview
Allow shop owners to create and use pre-saved message templates for common responses, improving efficiency in customer communication.

## Backend Endpoints (Already Implemented)
- `GET /api/messages/quick-replies` - Get all quick replies for shop
- `POST /api/messages/quick-replies` - Create new quick reply
- `PUT /api/messages/quick-replies/:id` - Update quick reply
- `DELETE /api/messages/quick-replies/:id` - Delete quick reply
- `POST /api/messages/quick-replies/:id/use` - Increment usage count

## Mobile Implementation Required

### 1. API Service Methods
Add to `message.services.ts`:
- `getQuickReplies()` - Fetch all quick replies
- `createQuickReply({ title, content, category })` - Create new
- `updateQuickReply(id, { title, content, category })` - Update
- `deleteQuickReply(id)` - Delete
- `useQuickReply(id)` - Track usage

### 2. Quick Reply Management Screen
Create `feature/messages/screens/QuickRepliesScreen.tsx`:
- List all quick replies with title, preview, usage count
- Add new quick reply button
- Edit/delete actions per item
- Category filter (optional)

### 3. Quick Reply Modal
Create `feature/messages/components/QuickReplyModal.tsx`:
- Form fields: title, content, category (optional)
- Save/cancel buttons
- Character count for content

### 4. Quick Reply Picker in Chat
Update `MessageInput.tsx`:
- Add quick reply button (lightning bolt icon)
- Show bottom sheet with quick reply list
- Tap to insert content into message input
- Track usage when selected

## UI Design
```
Quick Replies Screen:
┌─────────────────────────────────────┐
│  Quick Replies            [+ Add]   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Thanks for booking!        │    │
│  │ "Thank you for your..."    │    │
│  │ Used: 24 times    [⋮]      │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Hours & Location           │    │
│  │ "We're open Mon-Fri..."    │    │
│  │ Used: 18 times    [⋮]      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

Chat Input with Quick Reply:
┌─────────────────────────────────────┐
│  [⚡] [+]  [Message...]      [Send] │
└─────────────────────────────────────┘
```

## Effort Estimate
- API methods: 30 min
- Management screen: 1 hr
- Quick reply picker: 1 hr
- **Total: 2-3 hrs**
