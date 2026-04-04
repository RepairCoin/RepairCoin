# BUG-011: Internal admin notes leak in shop ticket list preview

**Type:** Security / Data Leak
**Severity:** High
**Priority:** P1
**Component:** Backend - Support Chat Repository
**Labels:** bug, backend, security, support
**Status:** OPEN
**Date Found:** 2026-04-04

---

## Description

When an admin sends an internal note on a support ticket, the shop owner can see the note content in the `lastMessage` preview on their ticket list. Internal notes are correctly hidden in the chat view but leak through the ticket list's `lastMessage` subquery.

---

## Symptoms

- Admin writes an internal note (e.g., "This shop has been flagged for fraud review")
- Shop opens their support tab and sees the note text in the ticket list preview
- The note is NOT visible when they open the ticket chat (correctly filtered there)

---

## Root Cause

**File:** `backend/src/repositories/SupportChatRepository.ts` (Lines 162-167)

The `getShopTickets()` method's `lastMessage` subquery does not filter out internal notes:

```sql
-- CURRENT (buggy) - shop view
(
  SELECT m.message
  FROM support_messages m
  WHERE m.ticket_id = t.id
  ORDER BY m.created_at DESC
  LIMIT 1
) as "lastMessage"
```

Compare with the admin view at lines 252-258 which correctly filters:

```sql
-- CORRECT - admin view
(
  SELECT m.message
  FROM support_messages m
  WHERE m.ticket_id = t.id
    AND m.is_internal = false    -- <-- this filter is missing from shop view
  ORDER BY m.created_at DESC
  LIMIT 1
) as "lastMessage"
```

---

## Solution

**File:** `backend/src/repositories/SupportChatRepository.ts`

Add `AND m.is_internal = false` to the `lastMessage` subquery in `getShopTickets()`:

```sql
(
  SELECT m.message
  FROM support_messages m
  WHERE m.ticket_id = t.id
    AND m.is_internal = false
  ORDER BY m.created_at DESC
  LIMIT 1
) as "lastMessage"
```

This is a one-line fix.

---

## Testing

### Manual Test
1. Admin sends an internal note on a ticket
2. Shop opens support tab -> ticket list preview should NOT show the internal note
3. Shop opens the ticket -> internal note should NOT appear in chat (already working)
4. Admin sends a regular (non-internal) reply -> shop sees it in both list preview and chat

### Automated
```bash
cd backend && npm run typecheck
cd backend && npm run test
```

---

## Related Files

| File | Role |
|------|------|
| `backend/src/repositories/SupportChatRepository.ts` | Lines 162-167 (buggy subquery) |
| `backend/src/repositories/SupportChatRepository.ts` | Lines 306-331 (`getTicketMessages` correctly filters internal notes) |
| `backend/src/repositories/SupportChatRepository.ts` | Lines 252-258 (admin view correctly filters) |

---

## Impact

| Area | Before | After |
|------|--------|-------|
| **Internal notes** | Visible in shop ticket list preview | Hidden from shop entirely |
| **Admin privacy** | Compromised | Restored |
| **Chat view** | Already correctly filtered | No change |

---

## Prevention

1. Always filter `is_internal = false` in any query that returns message content to shops
2. Consider adding a shared SQL fragment for shop-visible message queries
