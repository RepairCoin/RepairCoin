# Support Tickets

## Overview

The Support Tickets feature allows shop owners to open support conversations with the admin team directly from the dashboard. It is a ticketed chat system with real-time messaging.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented (shop side) |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## Features

### For Shop Owners
- Create a new support ticket with a subject and message
- View all open and resolved tickets
- Chat back and forth with admin in each ticket thread
- See unread message count badge
- Filter tickets by status

### For Admins
- View all shop tickets in the admin dashboard
- Reply to tickets
- Add internal notes (not visible to shops)
- Update ticket status (pending / investigating / resolved / dismissed)

## Ticket Structure

- Subject
- Status: `open`, `in_progress`, `resolved`, `closed`
- Messages (threaded chat)
- Unread count per party

## API Services

Frontend API service: `frontend/src/services/api/support.ts`

Key functions:
- `createTicket(subject, message)` — open a new ticket
- `getShopTickets()` — list all tickets for the current shop
- `getTicketMessages(ticketId)` — load message thread
- `addMessage(ticketId, message)` — send a reply
- `markMessagesAsRead(ticketId)` — mark messages as read
- `getUnreadCount()` — get total unread badge count

## Frontend Location

- Shop tab: `frontend/src/components/shop/tabs/SupportTab.tsx`
- Shared components: `frontend/src/components/support/`
  - `ChatMessage.tsx`
  - `ChatInput.tsx`
  - `TicketList.tsx`

## Related Features

- **Moderation Reports** — shops can also submit issue reports against specific customers (spam, fraud, harassment). See [CUSTOMER-MODERATION.md](CUSTOMER-MODERATION.md).
