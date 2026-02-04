# Missing Features: Support Chat System

## Status: **NOT IMPLEMENTED** ❌

The support chat system between shops and admins was planned in commit `9d669abd` but **never actually created**. The commit message describes features that don't exist in the codebase.

---

## What's Currently Missing

### Backend Components (0% Complete)

#### 1. Database Migration
- ❌ `backend/migrations/018_create_support_chat.sql`
  - Support chat messages table
  - Chat sessions/tickets table
  - Indexes and relationships

#### 2. Domain Layer
- ❌ `backend/src/domains/support/` - Entire domain missing
  - `SupportDomain.ts` - Domain module
  - `controllers/` - Message controllers
  - `services/` - Chat logic
  - `routes.ts` - API routes

#### 3. Repositories
- ❌ `backend/src/repositories/SupportChatRepository.ts`
  - CRUD operations for support messages
  - Ticket/session management
  - Message threading

#### 4. Services
- ❌ `backend/src/services/SupportChatService.ts`
  - Business logic for support chat
  - Message routing
  - Notification triggers

#### 5. Controllers
- ❌ `backend/src/controllers/SupportChatController.ts`
  - API endpoint handlers
  - Request validation

---

### Frontend Components (0% Complete)

#### 1. Shop-Side Components
- ❌ `frontend/src/components/shop/tabs/SupportTab.tsx`
  - Chat interface for shops
  - Message history
  - New message form

- ❌ `frontend/src/components/shop/FAQSection.tsx`
  - Frequently asked questions
  - Self-service help

#### 2. Admin-Side Components
- ❌ `frontend/src/components/admin/tabs/AdminSupportTab.tsx`
  - Admin chat dashboard
  - Active tickets list
  - Message responses

#### 3. Customer-Side Components
- ❌ `frontend/src/components/customer/CustomerFAQSection.tsx`
  - Customer help center
  - FAQ display

#### 4. Shared Components
- ❌ `frontend/src/components/support/` - Entire folder missing
  - ChatMessage component
  - ChatInput component
  - TicketStatus component
  - etc.

#### 5. API Client
- ❌ `frontend/src/services/api/support.ts`
  - API calls for support chat
  - TypeScript interfaces

#### 6. Data/Constants
- ❌ `frontend/src/data/` - FAQ data files
  - Shop FAQs
  - Customer FAQs

---

## What Exists (Reference Only)

### UI References
- ✅ Shop Sidebar: "Support" menu item exists (but links to non-existent tab)
- ✅ Admin Sidebar: "Support" menu item exists (but links to non-existent tab)
- ❌ Components: All commented out with TODO notes

### Code References
```typescript
// frontend/src/components/shop/ShopDashboardClient.tsx
// import { SupportTab } from "@/components/shop/tabs/SupportTab"; // TODO: component not yet created

// frontend/src/components/admin/AdminDashboardClient.tsx
// import { AdminSupportTab } from "@/components/admin/tabs/AdminSupportTab"; // TODO: component not yet created

// backend/src/app.ts
// import { SupportDomain } from './domains/support'; // TODO: domain not yet created
```

---

## Implementation Scope

### Database Schema Needed
```sql
-- Support tickets/sessions
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  shop_id VARCHAR(255) REFERENCES shops(shop_id),
  subject VARCHAR(255),
  status VARCHAR(50), -- open, in_progress, resolved, closed
  priority VARCHAR(20), -- low, medium, high, urgent
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  resolved_at TIMESTAMP,
  assigned_to VARCHAR(255) -- admin user
);

-- Support messages
CREATE TABLE support_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES support_tickets(id),
  sender_type VARCHAR(20), -- shop, admin
  sender_id VARCHAR(255),
  message TEXT,
  attachments JSONB,
  created_at TIMESTAMP,
  read_at TIMESTAMP
);
```

### Core Features Required

#### For Shops:
1. Create new support ticket
2. View ticket history
3. Send messages
4. Receive admin responses
5. Close/reopen tickets
6. FAQ section for self-service

#### For Admins:
7. View all open tickets
8. Filter/search tickets
9. Respond to shops
10. Assign tickets to admins
11. Mark tickets as resolved
12. View ticket analytics

#### Real-time Features (Optional):
- WebSocket notifications for new messages
- Typing indicators
- Read receipts
- Unread message count

---

## Estimated Implementation

### Backend (8-12 hours)
- Database migration: 1 hour
- Repository layer: 2 hours
- Service layer: 2 hours
- Controllers: 1 hour
- Domain module: 1 hour
- API routes: 1 hour
- Testing: 2-4 hours

### Frontend (12-16 hours)
- SupportTab (shop): 3 hours
- AdminSupportTab: 4 hours
- Shared chat components: 3 hours
- FAQ sections: 2 hours
- API integration: 2 hours
- Styling & UX: 2-4 hours

### Total: 20-28 hours

---

## Recommendation

**Option 1: Full Implementation**
- Build complete support chat system as described
- Real-time messaging with WebSocket
- Full admin dashboard

**Option 2: Simple Ticket System**
- Email-based support tickets (simpler)
- No real-time chat, just message threading
- Faster to implement (10-15 hours total)

**Option 3: External Integration**
- Use third-party like Intercom, Zendesk, Crisp
- Embed widget in dashboard
- Fastest (2-4 hours integration)

---

## Next Steps

1. **Decide** which option to pursue
2. **Create** technical specification
3. **Build** database schema
4. **Implement** backend domain
5. **Create** frontend components
6. **Test** end-to-end workflow
7. **Deploy** with monitoring

---

**Created:** February 2, 2026
**Status:** Planning Phase
