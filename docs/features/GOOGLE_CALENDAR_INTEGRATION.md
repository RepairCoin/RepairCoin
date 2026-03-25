# Google Calendar Integration

**Date:** March 24, 2026
**Status:** 🟡 Planning
**Priority:** High
**Estimated Time:** 16-20 hours

---

## Overview

Allow shop owners to connect their Google Calendar account so that customer appointments automatically sync to their calendar. This provides shops with:

- Unified view of appointments across RepairCoin and personal calendar
- Mobile notifications through Google Calendar app
- Integration with existing scheduling tools
- Automatic reminders via Google Calendar
- Easy access from any device

---

## User Flow

### Shop Owner Connects Calendar

1. Shop navigates to **Settings** > **Calendar Integration**
2. Clicks **Connect Google Calendar** button
3. Redirected to Google OAuth consent screen
4. Grants RepairCoin access to create/manage calendar events
5. Redirected back to RepairCoin with success message
6. Can now see connection status and disconnect option

### Automatic Event Syncing

| Trigger | Action | Calendar Event |
|---------|--------|----------------|
| Customer books appointment | Create event | Title: "[Customer Name] - [Service Name]"<br>Time: Appointment slot<br>Description: Customer details, service info, payment amount |
| Shop confirms appointment | Update event | Add confirmation status to description |
| Customer reschedules | Update event | Change event time to new slot |
| Shop/Customer cancels | Delete event | Remove event from calendar |
| Appointment completed | Update event | Mark as completed in description |

---

## Technical Architecture

### OAuth 2.0 Flow

```
┌──────────┐           ┌──────────────┐           ┌─────────────┐
│  Shop    │           │  RepairCoin  │           │   Google    │
│ (Browser)│           │   Backend    │           │   OAuth     │
└────┬─────┘           └──────┬───────┘           └──────┬──────┘
     │                        │                          │
     │ 1. Click "Connect"     │                          │
     ├───────────────────────>│                          │
     │                        │                          │
     │ 2. Redirect to Google  │                          │
     │<───────────────────────┤                          │
     │                        │                          │
     │ 3. Grant permissions   │                          │
     ├────────────────────────┼─────────────────────────>│
     │                        │                          │
     │ 4. Redirect with code  │                          │
     │<───────────────────────┼──────────────────────────┤
     │                        │                          │
     │ 5. Send auth code      │                          │
     ├───────────────────────>│                          │
     │                        │ 6. Exchange for tokens   │
     │                        ├─────────────────────────>│
     │                        │                          │
     │                        │ 7. Return access/refresh │
     │                        │<─────────────────────────┤
     │                        │                          │
     │                        │ 8. Store tokens (encrypted)
     │                        │                          │
     │ 9. Success response    │                          │
     │<───────────────────────┤                          │
     │                        │                          │
```

### Database Schema

**New Table: `shop_calendar_connections`**

```sql
CREATE TABLE shop_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'google', -- Future: 'outlook', 'apple'

  -- OAuth tokens (encrypted at rest)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,

  -- Google Calendar specific
  calendar_id TEXT NOT NULL, -- Which calendar to sync to (primary or custom)
  google_account_email TEXT,

  -- Connection metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50), -- 'success', 'failed', 'token_expired'
  sync_error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_shop_provider UNIQUE (shop_id, provider)
);

CREATE INDEX idx_shop_calendar_shop_id ON shop_calendar_connections(shop_id);
CREATE INDEX idx_shop_calendar_active ON shop_calendar_connections(shop_id, is_active) WHERE is_active = true;
```

**Update Table: `service_orders`**

```sql
ALTER TABLE service_orders
ADD COLUMN google_calendar_event_id TEXT,
ADD COLUMN calendar_sync_status VARCHAR(50) DEFAULT 'not_synced', -- 'synced', 'failed', 'not_synced'
ADD COLUMN calendar_sync_error TEXT;

CREATE INDEX idx_service_orders_calendar_event ON service_orders(google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;
```

---

## Implementation Plan

### Phase 1: Backend Infrastructure (6-8 hours)

#### 1.1 Google Cloud Project Setup (1 hour)
- [ ] Create Google Cloud project for RepairCoin
- [ ] Enable Google Calendar API
- [ ] Configure OAuth 2.0 consent screen
- [ ] Create OAuth 2.0 credentials (Client ID & Secret)
- [ ] Add authorized redirect URIs
- [ ] Configure scopes: `calendar.events`, `calendar.readonly`

#### 1.2 Database Migration (1 hour)
- [ ] Create migration file `093_create_calendar_integration.sql`
- [ ] Add `shop_calendar_connections` table
- [ ] Add calendar columns to `service_orders`
- [ ] Run migration on development database
- [ ] Test rollback strategy

#### 1.3 Google Calendar Service (2-3 hours)
**File:** `backend/src/services/GoogleCalendarService.ts`

```typescript
export class GoogleCalendarService {
  // OAuth
  async getAuthorizationUrl(shopId: string): Promise<string>
  async handleOAuthCallback(code: string, shopId: string): Promise<void>
  async refreshAccessToken(shopId: string): Promise<void>
  async disconnectCalendar(shopId: string): Promise<void>

  // Event Management
  async createEvent(orderId: string): Promise<string> // Returns event ID
  async updateEvent(orderId: string, eventId: string): Promise<void>
  async deleteEvent(orderId: string, eventId: string): Promise<void>

  // Helpers
  private buildEventPayload(order: ServiceOrder): GoogleCalendarEvent
  private encryptToken(token: string): string
  private decryptToken(encrypted: string): string
}
```

#### 1.4 Calendar Repository (1 hour)
**File:** `backend/src/repositories/CalendarRepository.ts`

```typescript
export class CalendarRepository extends BaseRepository {
  async saveConnection(connection: CalendarConnection): Promise<void>
  async getConnection(shopId: string, provider: string): Promise<CalendarConnection | null>
  async updateLastSync(shopId: string, status: string, error?: string): Promise<void>
  async disconnectCalendar(shopId: string, provider: string): Promise<void>
  async getActiveConnection(shopId: string): Promise<CalendarConnection | null>
}
```

#### 1.5 API Routes (1-2 hours)
**File:** `backend/src/domains/ShopDomain/controllers/CalendarController.ts`

```typescript
POST   /api/shops/calendar/connect/google        // Get OAuth URL
POST   /api/shops/calendar/callback/google       // Handle OAuth callback
GET    /api/shops/calendar/status                // Get connection status
DELETE /api/shops/calendar/disconnect/:provider  // Disconnect calendar
POST   /api/shops/calendar/test-sync             // Manual test sync
```

---

### Phase 2: Event Sync Integration (4-5 hours)

#### 2.1 Integrate with Booking Flow (2 hours)
**Update:** `backend/src/domains/ServiceDomain/controllers/PaymentController.ts`

When order status changes to `paid`:
```typescript
// After payment success
if (shop has active calendar connection) {
  try {
    const eventId = await googleCalendarService.createEvent(orderId);
    await orderRepo.updateCalendarEventId(orderId, eventId, 'synced');
  } catch (error) {
    logger.error('Calendar sync failed', error);
    await orderRepo.updateCalendarSyncStatus(orderId, 'failed', error.message);
  }
}
```

#### 2.2 Integrate with Appointment Changes (1-2 hours)
**Update:** `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts`

- On reschedule approval: `updateEvent()`
- On cancellation: `deleteEvent()`
- On completion: `updateEvent()` with completion status

#### 2.3 Token Refresh Strategy (1 hour)
**Background Service:** `backend/src/services/CalendarTokenRefreshService.ts`

```typescript
// Run every 30 minutes via cron
async refreshExpiringTokens(): Promise<void> {
  // Find tokens expiring in next hour
  // Refresh them proactively
  // Update database with new tokens
}
```

---

### Phase 3: Frontend UI (4-5 hours)

#### 3.1 Calendar Settings Component (3 hours)
**File:** `frontend/src/components/shop/CalendarIntegrationSettings.tsx`

```tsx
export default function CalendarIntegrationSettings() {
  // Features:
  // - Show connection status (connected/disconnected)
  // - "Connect Google Calendar" button
  // - Display connected Google account email
  // - "Disconnect" button with confirmation
  // - Last sync time and status
  // - Sync error messages if any
  // - "Test Sync" button for debugging
}
```

Visual Design:
- Card-based layout matching existing settings tabs
- Green checkmark icon when connected
- Red X icon when disconnected
- Loading spinner during OAuth flow
- Toast notifications for success/error

#### 3.2 API Client (1 hour)
**File:** `frontend/src/services/api/calendar.ts`

```typescript
export const calendarApi = {
  getConnectionStatus: () => axios.get('/api/shops/calendar/status'),
  connectGoogle: () => axios.post('/api/shops/calendar/connect/google'),
  disconnect: (provider: string) => axios.delete(`/api/shops/calendar/disconnect/${provider}`),
  testSync: () => axios.post('/api/shops/calendar/test-sync'),
};
```

#### 3.3 Integration with Settings Tab (1 hour)
**Update:** `frontend/src/components/shop/tabs/SettingsTab.tsx`

Add new tab: **Calendar Integration**

```tsx
<Tabs>
  <Tab label="General" />
  <Tab label="Social Media" />
  <Tab label="FAQ" />
  <Tab label="Calendar Integration" /> {/* NEW */}
  <Tab label="Availability" />
  <Tab label="Moderation" />
</Tabs>
```

---

### Phase 4: Testing & Polish (2-3 hours)

#### 4.1 Backend Testing (1 hour)
- [ ] Test OAuth flow with Google
- [ ] Test token refresh mechanism
- [ ] Test event creation/update/deletion
- [ ] Test error handling (expired tokens, API failures)
- [ ] Test encryption/decryption of tokens

#### 4.2 Frontend Testing (1 hour)
- [ ] Test connection flow end-to-end
- [ ] Test disconnect flow
- [ ] Test UI states (loading, success, error)
- [ ] Test mobile responsive design
- [ ] Test toast notifications

#### 4.3 End-to-End Testing (1 hour)
- [ ] Book appointment → Verify event created in Google Calendar
- [ ] Reschedule appointment → Verify event updated
- [ ] Cancel appointment → Verify event deleted
- [ ] Complete appointment → Verify event updated
- [ ] Disconnect calendar → Verify future bookings don't sync

---

## Security Considerations

### Token Storage
- **Encryption at rest**: Encrypt access/refresh tokens using AES-256-GCM
- **Environment variable**: Store encryption key in `.env` as `GOOGLE_CALENDAR_ENCRYPTION_KEY`
- **Never log tokens**: Redact tokens from all logs

### OAuth Security
- **PKCE flow**: Use Proof Key for Code Exchange (recommended for server-side apps)
- **State parameter**: Prevent CSRF attacks during OAuth callback
- **Validate redirect URIs**: Whitelist only RepairCoin URLs

### API Rate Limiting
- **Google Calendar API**: 1 million queries per day (sufficient for our use)
- **Retry strategy**: Exponential backoff on rate limit errors
- **Batch operations**: Group multiple event updates when possible

---

## Environment Variables

Add to `.env`:

```bash
# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=https://repaircoin.ai/api/shops/calendar/callback/google
GOOGLE_CALENDAR_ENCRYPTION_KEY=your-32-byte-random-key-here
```

---

## User Documentation

### For Shop Owners

**How to Connect Google Calendar:**

1. Navigate to **Settings** > **Calendar Integration**
2. Click **Connect Google Calendar**
3. Sign in to your Google account
4. Grant RepairCoin permission to manage your calendar events
5. You'll be redirected back - connection complete!

**What Gets Synced:**

- ✅ New appointments (when customer books)
- ✅ Rescheduled appointments (when you approve reschedule requests)
- ✅ Cancelled appointments (deleted from calendar)
- ✅ Completed appointments (marked as done)

**Event Details Include:**

- Customer name and contact info
- Service name and description
- Appointment time and duration
- Payment amount and RCN rewards
- Booking reference number

**To Disconnect:**

1. Navigate to **Settings** > **Calendar Integration**
2. Click **Disconnect**
3. Confirm disconnection
4. Future appointments won't sync (existing events remain in calendar)

---

## Future Enhancements

### Phase 2 (Future)
- [ ] Support Microsoft Outlook Calendar
- [ ] Support Apple iCloud Calendar
- [ ] Two-way sync (detect external changes)
- [ ] Choose which calendar to sync to (primary vs. custom)
- [ ] Customize event titles and descriptions
- [ ] Sync past appointments

### Phase 3 (Future)
- [ ] SMS notifications via Google Calendar
- [ ] Integrate with Google Meet for video appointments
- [ ] Color-code events by service type
- [ ] Add customer profile links to event description

---

## Dependencies

### Backend NPM Packages

```bash
npm install googleapis
npm install crypto-js
```

**googleapis**: Official Google API client library
**crypto-js**: For encrypting/decrypting OAuth tokens

### Frontend (None Required)
Uses existing axios client and UI components.

---

## Success Metrics

After launch, track:

1. **Adoption Rate**: % of shops that connect calendar
2. **Sync Success Rate**: % of events successfully created
3. **Error Rate**: % of sync failures (target: <1%)
4. **Token Refresh Success**: % of successful token refreshes (target: >99%)
5. **User Feedback**: Collect feedback from shops using the feature

---

## Rollout Plan

### Development (Week 1)
- Phase 1: Backend infrastructure
- Phase 2: Event sync integration

### Testing (Week 1-2)
- Internal testing with test Google accounts
- Beta testing with 2-3 pilot shops

### Production (Week 2)
- Deploy to staging environment
- Deploy to production
- Announce feature to all shops
- Create tutorial video/documentation

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google API changes | High | Use official SDK, monitor Google Calendar API changelog |
| Token expiration | Medium | Proactive token refresh every 30 min |
| Network failures | Medium | Retry logic with exponential backoff |
| Shop disconnects mid-booking | Low | Graceful degradation - booking works without calendar |
| Google account suspended | Low | Clear error messages, support documentation |

---

## Open Questions

- [ ] Which Google Calendar should we default to? (Primary vs. let shop choose)
- [ ] Should we sync past appointments when first connecting?
- [ ] Should we allow customization of event titles/descriptions?
- [ ] Do we need webhook notifications from Google Calendar for two-way sync?
- [ ] What happens to calendar events if shop subscription expires?

---

## Implementation Checklist

### Backend
- [ ] Google Cloud project setup
- [ ] Database migration
- [ ] GoogleCalendarService implementation
- [ ] CalendarRepository implementation
- [ ] CalendarController and routes
- [ ] Integration with PaymentController
- [ ] Integration with AppointmentController
- [ ] Token refresh background service
- [ ] Error handling and logging
- [ ] Unit tests for calendar service

### Frontend
- [ ] CalendarIntegrationSettings component
- [ ] API client methods
- [ ] Integration with SettingsTab
- [ ] Loading states and error handling
- [ ] Toast notifications
- [ ] Mobile responsive design
- [ ] User documentation

### DevOps
- [ ] Add environment variables to production
- [ ] Configure OAuth redirect URIs
- [ ] Set up monitoring/alerts for sync failures
- [ ] Database migration on production

### Testing
- [ ] OAuth flow testing
- [ ] Event CRUD testing
- [ ] Token refresh testing
- [ ] Error scenario testing
- [ ] End-to-end user flow testing

---

**Status:** Ready for implementation
**Next Step:** Begin Phase 1 - Backend Infrastructure
