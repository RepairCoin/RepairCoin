# Feature: Wire Up Messaging Buttons

**Status:** Open
**Priority:** MEDIUM
**Est. Effort:** 2-3 hours
**Created:** 2026-03-10

---

## Problem

Several buttons in messaging UI are non-functional.

## Buttons to Wire

| Component | Button | Purpose |
|-----------|--------|---------|
| ConversationThread | Info | Show conversation details |
| ConversationThread | More Options | Archive, block menu |
| MessagesTab | Filter | Filter conversations |
| MessagesTab | Export | Export chat history |

## Implementation

1. Add onClick handlers to each button
2. Create info panel component
3. Create options dropdown menu
4. Implement filter popover
5. Implement export functionality (CSV/text download)

## Verification Checklist

- [ ] Info button opens conversation details panel
- [ ] More Options shows dropdown with archive/block
- [ ] Filter button opens filter UI
- [ ] Export downloads conversation as file
