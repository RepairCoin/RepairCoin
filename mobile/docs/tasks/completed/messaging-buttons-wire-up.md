# Feature: Wire Up Messaging Buttons

**Status:** Completed
**Priority:** Medium
**Est. Effort:** 2-3 hours
**Created:** 2026-03-10
**Updated:** 2026-03-10
**Completed:** 2026-03-12

---

## Problem

Several buttons in messaging UI are non-functional.

## Buttons to Wire

| Component | Button | Purpose | Status |
|-----------|--------|---------|--------|
| ChatHeader | Info | Show conversation details | **DONE** |
| ChatHeader | More Options | Archive, block menu | **DONE** |
| MessagesScreen | Filter | Filter conversations | **DONE** (Active/Archived tabs) |
| MessagesTab (web) | Export | Export chat history | N/A (web frontend) |

## Implementation

1. ✅ Add onClick handlers to each button
2. ✅ Create ConversationInfoModal component
3. ✅ Create ConversationMoreMenu dropdown
4. ✅ Implement Active/Archived filter tabs
5. ✅ Backend endpoints for archive/unarchive/block/unblock/delete
6. ✅ Blocked conversation UI (disabled input with message)

## Verification Checklist

- [x] Info button opens conversation details panel
- [x] More Options shows dropdown with archive/block/delete
- [x] Archive moves conversation to Archived tab
- [x] Unarchive moves conversation back to Active tab
- [x] Block disables message input with indicator
- [x] Unblock re-enables message input
- [x] Delete removes conversation from list
