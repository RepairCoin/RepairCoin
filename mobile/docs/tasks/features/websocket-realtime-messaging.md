# Feature: WebSocket Real-Time Messaging

**Status:** Open
**Priority:** LOW (this week) / HIGH (next sprint)
**Est. Effort:** 4-6 hours
**Created:** 2026-03-10

---

## Overview

Backend WebSocket infrastructure already exists. Need to create frontend hook and integrate.

## Current State

- Backend: `WebSocketManager.ts` fully built (492 lines)
- Frontend: No WebSocket connection code exists
- All messaging updates use `setInterval()` polling

## Implementation Plan

1. Create `frontend/src/hooks/useWebSocket.ts`
2. Add messaging events to backend WebSocketManager
3. Update frontend components to use WebSocket
4. Implement graceful fallback to polling

## Impact

- Performance: ~38 requests/min → ~1 request/min
- UX: Messages appear instantly instead of 3-5 second delay

## Defer to next sprint if time constrained
