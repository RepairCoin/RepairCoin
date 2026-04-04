# BUG-012: No maximum message length validation on support messages

**Type:** Validation Bug
**Severity:** Low
**Priority:** P3
**Component:** Backend - Support Chat Service
**Labels:** bug, backend, validation, support
**Status:** OPEN
**Date Found:** 2026-04-04

---

## Description

The support chat `createMessage()` method validates that messages are not empty but has no maximum length check. A user could submit arbitrarily large messages (e.g., 1MB+), potentially causing database bloat and slow queries.

---

## Root Cause

**File:** `backend/src/services/SupportChatService.ts` (Lines 117-119)

```typescript
if (!params.message || params.message.trim().length === 0) {
  throw new Error('Message content is required');
}
// No maximum length check
```

The database column is `TEXT` (unlimited), so there is no schema-level constraint either.

Note: `createTicket()` already validates subject length at line 32-34 (`params.subject.length > 255`), but the message body has no equivalent check.

---

## Solution

**File:** `backend/src/services/SupportChatService.ts`

Add after the empty message check (line 119):

```typescript
if (params.message.length > 10000) {
  throw new Error('Message cannot exceed 10,000 characters');
}
```

10,000 characters is a reasonable limit for support messages (roughly 2,000 words).

---

## Testing

```bash
cd backend && npm run typecheck
cd backend && npm run test
```

Manual: attempt to send a message > 10,000 chars -> should receive error response.

---

## Related Files

| File | Role |
|------|------|
| `backend/src/services/SupportChatService.ts` | Lines 117-119 (missing validation) |
| `backend/src/services/SupportChatService.ts` | Lines 32-34 (subject length validation - good example) |
