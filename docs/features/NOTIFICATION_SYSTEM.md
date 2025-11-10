# Notification System Documentation

## Overview

The RepairCoin notification system provides real-time notifications to users (customers, shops, and admins) for important events like rewards issued, redemption requests, token transfers, and more. The system uses WebSocket for real-time delivery and RESTful APIs for notification management.

---

## Architecture

### Backend Components

1. **NotificationDomain** (`backend/src/domains/notification/`)
   - Domain module following DDD architecture
   - Subscribes to EventBus events
   - Creates notifications based on events
   - Sends real-time notifications via WebSocket

2. **NotificationRepository** (`backend/src/repositories/NotificationRepository.ts`)
   - Data access layer for notifications
   - CRUD operations on the `notifications` table
   - Pagination support

3. **WebSocketManager** (`backend/src/services/WebSocketManager.ts`)
   - Manages WebSocket connections
   - Handles authentication via JWT
   - Sends notifications to connected clients
   - Heartbeat for connection health

4. **NotificationController** (`backend/src/domains/notification/controllers/NotificationController.ts`)
   - REST API endpoints for notification management
   - Authentication required for all endpoints

### Frontend Components

1. **NotificationBell** (`frontend/src/components/notifications/NotificationBell.tsx`)
   - Bell icon with unread count badge
   - Dropdown panel showing notifications
   - Modal for viewing notification details
   - Mark as read/delete functionality

2. **useNotifications Hook** (`frontend/src/hooks/useNotifications.ts`)
   - Manages WebSocket connection
   - Fetches notifications from API
   - Handles mark as read, delete operations
   - Auto-reconnection with exponential backoff

3. **NotificationStore** (`frontend/src/stores/notificationStore.ts`)
   - Zustand store for notification state
   - Notifications array, unread count, connection status
   - Actions for adding, updating, removing notifications

---

## Database Schema

### Notifications Table

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_address VARCHAR(42) NOT NULL,
  receiver_address VARCHAR(42) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_receiver ON notifications(receiver_address);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

**Fields:**
- `sender_address`: Wallet address of the sender (can be customer, shop, or admin)
- `receiver_address`: Wallet address of the receiver
- `notification_type`: Type of notification (see types below)
- `message`: Human-readable message
- `metadata`: Additional data (JSONB) - amount, shop name, transaction ID, etc.
- `is_read`: Whether the notification has been read
- `created_at`: Timestamp when notification was created
- `updated_at`: Timestamp when notification was last updated

---

## Notification Types

### 1. `reward_issued`
**Triggered when:** A shop issues a reward to a customer

**Event:** `shop:reward_issued`

**Metadata:**
```json
{
  "amount": 100,
  "shopName": "Tech Repair Shop",
  "shopAddress": "0x123...",
  "transactionId": "0xabc..."
}
```

**Example Message:**
"You received 100 RCN reward from Tech Repair Shop!"

---

### 2. `redemption_approval_request`
**Triggered when:** A shop requests approval to redeem tokens from a customer's wallet

**Event:** `token:redemption_approval_requested`

**Metadata:**
```json
{
  "amount": 50,
  "shopName": "Tech Repair Shop",
  "shopAddress": "0x123...",
  "sessionId": "uuid"
}
```

**Example Message:**
"Tech Repair Shop is requesting approval to redeem 50 RCN from your wallet."

---

### 3. `redemption_approved`
**Triggered when:** A customer approves a redemption request

**Event:** `token:redemption_approved`

**Metadata:**
```json
{
  "amount": 50,
  "customerAddress": "0x456...",
  "sessionId": "uuid"
}
```

**Example Message:**
"Customer approved your redemption request for 50 RCN."

---

### 4. `redemption_rejected`
**Triggered when:** A customer rejects a redemption request

**Event:** `token:redemption_rejected`

**Metadata:**
```json
{
  "amount": 50,
  "customerAddress": "0x456...",
  "sessionId": "uuid"
}
```

**Example Message:**
"Customer rejected your redemption request for 50 RCN."

---

### 5. `token_gifted`
**Triggered when:** A customer gifts tokens to another customer

**Event:** `customer:token_gifted`

**Metadata:**
```json
{
  "amount": 100,
  "fromCustomerName": "John Doe",
  "fromCustomerAddress": "0x789...",
  "transactionId": "0xdef..."
}
```

**Example Message:**
"You received 100 RCN from John Doe!"

---

## Backend Implementation

### Step 1: Create Notification Domain

The `NotificationDomain` subscribes to events and creates notifications:

```typescript
// backend/src/domains/notification/NotificationDomain.ts
export class NotificationDomain implements DomainModule {
  async initialize(): Promise<void> {
    this.setupEventSubscriptions();
    logger.info('NotificationDomain initialized');
  }

  private setupEventSubscriptions(): void {
    // Subscribe to events
    eventBus.subscribe('shop:reward_issued', this.handleRewardIssued.bind(this));
    eventBus.subscribe('token:redemption_approval_requested', this.handleRedemptionApprovalRequest.bind(this));
    eventBus.subscribe('token:redemption_approved', this.handleRedemptionApproved.bind(this));
    eventBus.subscribe('token:redemption_rejected', this.handleRedemptionRejected.bind(this));
    eventBus.subscribe('customer:token_gifted', this.handleTokenGifted.bind(this));
  }

  private async handleRewardIssued(event: DomainEvent): Promise<void> {
    // Create notification and send via WebSocket
    const notification = await this.notificationService.createRewardIssuedNotification(event.data);
    this.wsManager?.sendNotificationToUser(event.data.customerAddress, notification);
  }
}
```

### Step 2: Emit Events When Actions Occur

Emit events in your domain routes/services:

```typescript
// Example: Shop issues reward
await eventBus.publish({
  type: 'shop:reward_issued',
  aggregateId: shopId,
  data: {
    shopAddress: shop.walletAddress,
    customerAddress: customerAddress,
    shopName: shop.name,
    amount: totalReward,
    transactionId: transactionHash
  },
  timestamp: new Date(),
  source: 'ShopRoutes',
  version: 1
});
```

### Step 3: Setup WebSocket Server

In `app.ts`:

```typescript
// Create HTTP server from Express app
this.server = new HTTPServer(this.app);

// Setup WebSocket server
const wss = new WebSocketServer({ server: this.server });
this.wsManager = new WebSocketManager(wss);

// Attach WebSocket manager to NotificationDomain
const notificationDomain = domainRegistry.getAllDomains().find(
  d => d.name === 'notifications'
) as NotificationDomain;

if (notificationDomain?.setWebSocketManager) {
  notificationDomain.setWebSocketManager(this.wsManager);
}
```

### Step 4: Add CORS Support for PATCH

Make sure CORS allows PATCH method:

```typescript
this.app.use(cors({
  origin: [/* your origins */],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));
```

---

## REST API Endpoints

All endpoints require authentication via JWT token in `Authorization: Bearer <token>` header.

### Get Notifications

```http
GET /api/notifications?page=1&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "senderAddress": "0x123...",
        "receiverAddress": "0x456...",
        "notificationType": "reward_issued",
        "message": "You received 100 RCN reward from Tech Repair Shop!",
        "metadata": {
          "amount": 100,
          "shopName": "Tech Repair Shop"
        },
        "isRead": false,
        "createdAt": "2025-10-31T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

### Get Unread Count

```http
GET /api/notifications/unread/count
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

### Mark as Read

```http
PATCH /api/notifications/:id/read
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### Mark All as Read

```http
PATCH /api/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "count": 5
  }
}
```

### Delete Notification

```http
DELETE /api/notifications/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

## WebSocket Protocol

### Connection

Connect to WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:3002');
```

### Authentication

After connection, send authentication message:

```json
{
  "type": "authenticate",
  "payload": {
    "token": "your-jwt-token"
  }
}
```

### Server Messages

**Connected:**
```json
{
  "type": "connected",
  "payload": {
    "message": "Connected to notification server"
  }
}
```

**Authenticated:**
```json
{
  "type": "authenticated",
  "payload": {
    "walletAddress": "0x123..."
  }
}
```

**New Notification:**
```json
{
  "type": "notification",
  "payload": {
    "id": "uuid",
    "senderAddress": "0x123...",
    "receiverAddress": "0x456...",
    "notificationType": "reward_issued",
    "message": "You received 100 RCN!",
    "metadata": { "amount": 100 },
    "isRead": false,
    "createdAt": "2025-10-31T12:00:00Z"
  }
}
```

**Error:**
```json
{
  "type": "error",
  "payload": {
    "error": "Authentication failed"
  }
}
```

**Pong (Heartbeat):**
```json
{
  "type": "pong"
}
```

### Client Messages

**Ping (Heartbeat):**
```json
{
  "type": "ping"
}
```

---

## Frontend Implementation

### Step 1: Setup Notification Store

The store is already configured in `frontend/src/stores/notificationStore.ts`.

### Step 2: Use Notification Hook

In your layout or component:

```typescript
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  // Initialize notification system
  useNotifications();

  return <div>Your content</div>;
}
```

### Step 3: Display Notification Bell

```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell';

function Header() {
  return (
    <header>
      <NotificationBell />
    </header>
  );
}
```

### Step 4: Access Notification State

```typescript
import { useNotificationStore } from '@/stores/notificationStore';

function MyComponent() {
  const { notifications, unreadCount, isConnected } = useNotificationStore();

  return (
    <div>
      <p>Unread: {unreadCount}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

---

## Configuration

### Backend Environment Variables

```env
# Required
JWT_SECRET=your-secret-key-min-32-chars
PORT=3002

# Optional
NODE_ENV=development
```

### Frontend Environment Variables

```env
# Backend URL (without /api)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3002

# API URL (with /api)
NEXT_PUBLIC_API_URL=http://localhost:3002/api
```

---

## How to Add a New Notification Type

### Step 1: Add Event Subscription in NotificationDomain

```typescript
// backend/src/domains/notification/NotificationDomain.ts
private setupEventSubscriptions(): void {
  // ... existing subscriptions

  eventBus.subscribe('your:new_event', this.handleNewEvent.bind(this));
}

private async handleNewEvent(event: DomainEvent): Promise<void> {
  const notification = await this.notificationService.createNewEventNotification(event.data);
  this.wsManager?.sendNotificationToUser(event.data.receiverAddress, notification);
}
```

### Step 2: Add Message Template in NotificationService

```typescript
// backend/src/domains/notification/services/NotificationService.ts
private messageTemplates: NotificationMessageTemplates = {
  // ... existing templates

  new_event_type: (data) => `Your custom message with ${data.someField}!`
};

async createNewEventNotification(data: any): Promise<Notification> {
  return this.createNotification(
    data.senderAddress,
    data.receiverAddress,
    'new_event_type',
    this.messageTemplates.new_event_type(data),
    {
      someField: data.someField,
      transactionId: data.transactionId
    }
  );
}
```

### Step 3: Emit Event in Your Domain

```typescript
// Where the action occurs
await eventBus.publish({
  type: 'your:new_event',
  aggregateId: 'some-id',
  data: {
    senderAddress: '0x123...',
    receiverAddress: '0x456...',
    someField: 'value',
    transactionId: '0xabc...'
  },
  timestamp: new Date(),
  source: 'YourDomain',
  version: 1
});
```

### Step 4: Add Icon in Frontend

```typescript
// frontend/src/components/notifications/NotificationBell.tsx
const getNotificationIcon = (type: string) => {
  switch (type) {
    // ... existing cases
    case 'new_event_type':
      return '🎯'; // Your emoji icon
    default:
      return '📬';
  }
};

const getNotificationTitle = (type: string) => {
  switch (type) {
    // ... existing cases
    case 'new_event_type':
      return 'New Event';
    default:
      return 'Notification';
  }
};
```

---

## Testing

### Test WebSocket Connection

```bash
# Using wscat (install: npm install -g wscat)
wscat -c ws://localhost:3002

# After connection, send authentication:
{"type":"authenticate","payload":{"token":"your-jwt-token"}}
```

### Test REST API

```bash
# Get notifications
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:3002/api/notifications

# Get unread count
curl -H "Authorization: Bearer your-jwt-token" \
  http://localhost:3002/api/notifications/unread/count

# Mark as read
curl -X PATCH -H "Authorization: Bearer your-jwt-token" \
  http://localhost:3002/api/notifications/notification-id/read
```

### Manual Testing in Browser

1. Open browser console
2. Check WebSocket connection:
   ```javascript
   // Should see "WebSocket connected" in console
   ```
3. Check notification state:
   ```javascript
   // In React DevTools, check notificationStore state
   ```

---

## Troubleshooting

### WebSocket Not Connecting

**Symptom:** "WebSocket disconnected" repeatedly in console

**Solutions:**
1. Check backend is running on correct port
2. Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
3. Check JWT token is valid
4. Look at backend logs for authentication errors

### Notifications Not Appearing

**Symptom:** Notification created in database but not showing in UI

**Solutions:**
1. Check WebSocket is connected (green dot on bell)
2. Verify JWT token includes correct wallet address
3. Check browser console for errors
4. Refresh notifications manually

### CORS Errors

**Symptom:** "CORS policy: Method PATCH is not allowed"

**Solutions:**
1. Ensure CORS middleware includes `PATCH` in methods array
2. Check `Access-Control-Allow-Methods` header in response
3. Restart backend after CORS changes

### Token Not Found

**Symptom:** "Token: ❌ Missing" in debug logs

**Solutions:**
1. Check authentication is completing successfully
2. Verify token is stored in localStorage
3. Check token key names match between auth and notification systems

---

## Performance Considerations

### Database Indexes

Indexes are created on:
- `receiver_address` - Fast lookup of user's notifications
- `created_at DESC` - Fast sorting by date
- `is_read` - Fast filtering of unread notifications

### WebSocket Scaling

For production with multiple server instances:
1. Use Redis for pub/sub between servers
2. Implement sticky sessions for WebSocket connections
3. Consider using a dedicated WebSocket service

### Notification Cleanup

Regularly clean up old read notifications:

```sql
-- Delete read notifications older than 30 days
DELETE FROM notifications
WHERE is_read = true
AND created_at < NOW() - INTERVAL '30 days';
```

Add to cron job or background task.

---

## Security Considerations

1. **Authentication Required:** All endpoints require valid JWT token
2. **User Isolation:** Users can only see their own notifications
3. **WebSocket Authentication:** Connections must authenticate before receiving notifications
4. **Rate Limiting:** Consider adding rate limiting on notification endpoints
5. **Input Validation:** All notification data is validated before storage

---

## Future Enhancements

1. **Push Notifications:** Browser push notifications using service workers
2. **Email Notifications:** Send email for important notifications
3. **Notification Preferences:** Let users configure which notifications they want
4. **Rich Notifications:** Support for images, actions, and custom layouts
5. **Notification History:** Archive and search old notifications
6. **Admin Broadcasts:** Send notifications to all users
7. **Notification Templates:** Support for localized messages

---

## Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Check browser console for frontend errors
- Verify database has notifications table
- Test WebSocket connection separately
- Review EventBus subscriptions are registered

---

## Summary

The notification system provides:
- ✅ Real-time notifications via WebSocket
- ✅ Persistent storage in PostgreSQL
- ✅ RESTful API for notification management
- ✅ Event-driven architecture using EventBus
- ✅ Authentication and user isolation
- ✅ Auto-reconnection with exponential backoff
- ✅ Clean, dark-themed UI
- ✅ Modal for detailed notification view
- ✅ Mark as read/delete functionality
- ✅ Unread count badge
- ✅ Connection status indicator

The system is production-ready and can be extended to support new notification types easily.
