# Next Session: Complete Google Calendar Integration

**Current Status**: Backend 100% Complete ✅
**Last Updated**: March 24, 2026
**Estimated Remaining Time**: 8-12 hours

---

## 🎯 Session Goals

Complete the Google Calendar integration by:
1. Setting up Google Cloud Platform
2. Integrating calendar sync with payment flow
3. Building frontend UI components
4. End-to-end testing

---

## 📋 Pre-Session Checklist

Before starting your next session, ensure you have:

- [ ] Google account with access to Google Cloud Console
- [ ] RepairCoin backend running locally
- [ ] RepairCoin frontend running locally
- [ ] Access to production environment variables
- [ ] Test shop account with active subscription
- [ ] Test customer account

---

## 🚀 Step-by-Step Implementation Plan

### Phase 1: Google Cloud Setup (30-45 minutes)

#### Step 1.1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project**
3. Enter project name: `RepairCoin Calendar Integration`
4. Click **Create**
5. Wait for project creation

#### Step 1.2: Enable Google Calendar API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and click **Enable**

#### Step 1.3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in app information:
   ```
   App name: RepairCoin
   User support email: your-email@repaircoin.com
   App logo: (optional)
   Application home page: https://repaircoin.ai
   Privacy policy: https://repaircoin.ai/privacy
   Terms of service: https://repaircoin.ai/terms
   Developer contact: support@repaircoin.com
   ```

4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

5. Click through to finish

#### Step 1.4: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `RepairCoin Backend`
5. Add **Authorized redirect URIs**:
   ```
   http://localhost:4000/api/shops/calendar/callback/google
   https://repaircoin.ai/api/shops/calendar/callback/google
   ```
6. Click **Create**
7. **COPY** the Client ID and Client Secret immediately

#### Step 1.5: Add Environment Variables

Add to `backend/.env`:

```bash
# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:4000/api/shops/calendar/callback/google
GOOGLE_CALENDAR_ENCRYPTION_KEY=<generate-this>
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy output and paste as `GOOGLE_CALENDAR_ENCRYPTION_KEY`

#### Step 1.6: Restart Backend

```bash
cd backend
npm run dev
```

Check logs for any errors.

---

### Phase 2: Integrate Calendar Sync with Payment Flow (2-3 hours)

#### Step 2.1: Update PaymentController

**File**: `backend/src/domains/ServiceDomain/controllers/PaymentController.ts`

Find the section where orders are marked as "paid" (after successful Stripe payment).

Add this import at the top:
```typescript
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';
```

Add this after payment success (around line where `status` is set to `'paid'`):

```typescript
// Auto-sync to Google Calendar if shop has connection
try {
  const googleCalendarService = new GoogleCalendarService();

  // Check if shop has active calendar connection
  const calendarRepo = new CalendarRepository();
  const connection = await calendarRepo.getActiveConnection(shopId, 'google');

  if (connection && bookingDate && bookingTimeSlot && bookingEndTime) {
    // Create calendar event
    await googleCalendarService.createEvent({
      orderId: order.orderId,
      serviceName: service.serviceName,
      serviceDescription: service.serviceDescription,
      customerName: customer.customerName || customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phoneNumber,
      customerAddress: customerAddress,
      bookingDate: bookingDate, // YYYY-MM-DD format
      startTime: bookingTimeSlot, // HH:MM format
      endTime: bookingEndTime, // HH:MM format
      totalAmount: parseFloat(totalAmount),
      shopTimezone: shop.timezone || 'America/New_York'
    });

    logger.info('Calendar event created for order', {
      orderId: order.orderId,
      shopId
    });
  }
} catch (calendarError) {
  // Log error but don't fail the payment
  logger.error('Failed to create calendar event:', {
    error: calendarError,
    orderId: order.orderId,
    shopId
  });
}
```

#### Step 2.2: Update AppointmentController (Reschedule/Cancel)

**File**: `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts`

**For Reschedule Approval:**

Find the reschedule approval logic and add:

```typescript
import { GoogleCalendarService } from '../../../services/GoogleCalendarService';

// After reschedule is approved and order is updated
try {
  const googleCalendarService = new GoogleCalendarService();
  const eventId = await calendarRepo.getOrderCalendarEventId(orderId);

  if (eventId) {
    await googleCalendarService.updateEvent(orderId, {
      bookingDate: newDate,
      startTime: newTimeSlot,
      endTime: newEndTime,
      serviceName: order.serviceName,
      customerAddress: order.customerAddress
    });

    logger.info('Calendar event updated for reschedule', {
      orderId,
      eventId
    });
  }
} catch (calendarError) {
  logger.error('Failed to update calendar event:', calendarError);
}
```

**For Cancellation:**

Find the cancellation logic and add:

```typescript
// After order is cancelled
try {
  const googleCalendarService = new GoogleCalendarService();
  await googleCalendarService.deleteEvent(orderId, shopId);

  logger.info('Calendar event deleted for cancellation', { orderId });
} catch (calendarError) {
  logger.error('Failed to delete calendar event:', calendarError);
}
```

#### Step 2.3: Update Order Completion

Find where orders are marked as `completed` and add:

```typescript
// After order completion
try {
  const googleCalendarService = new GoogleCalendarService();
  const eventId = await calendarRepo.getOrderCalendarEventId(orderId);

  if (eventId) {
    await googleCalendarService.updateEvent(orderId, {
      serviceName: order.serviceName + ' (Completed)',
      customerAddress: order.customerAddress
    });
  }
} catch (calendarError) {
  logger.error('Failed to update calendar event on completion:', calendarError);
}
```

---

### Phase 3: Frontend UI Implementation (4-5 hours)

#### Step 3.1: Create API Client

**File**: `frontend/src/services/api/calendar.ts`

```typescript
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const calendarApi = {
  // Get connection status
  getConnectionStatus: async () => {
    const response = await axios.get(`${API_BASE}/api/shops/calendar/status`);
    return response.data;
  },

  // Get OAuth authorization URL
  connectGoogle: async () => {
    const response = await axios.get(`${API_BASE}/api/shops/calendar/connect/google`);
    return response.data;
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string) => {
    const response = await axios.post(`${API_BASE}/api/shops/calendar/callback/google`, {
      code,
      state
    });
    return response.data;
  },

  // Disconnect calendar
  disconnect: async (provider: string) => {
    const response = await axios.delete(`${API_BASE}/api/shops/calendar/disconnect/${provider}`);
    return response.data;
  },

  // Test sync (for debugging)
  testSync: async () => {
    const response = await axios.post(`${API_BASE}/api/shops/calendar/test-sync`);
    return response.data;
  }
};
```

#### Step 3.2: Create CalendarIntegrationSettings Component

**File**: `frontend/src/components/shop/CalendarIntegrationSettings.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { calendarApi } from '@/services/api/calendar';
import { toast } from 'react-hot-toast';

interface ConnectionStatus {
  connected: boolean;
  provider: string | null;
  email: string | null;
  lastSync: string | null;
  syncStatus: string | null;
  syncError: string | null;
}

export default function CalendarIntegrationSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await calendarApi.getConnectionStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load calendar status:', error);
      toast.error('Failed to load calendar connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await calendarApi.connectGoogle();

      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to initiate connection:', error);
      toast.error('Failed to connect Google Calendar');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Calendar? Future appointments will not be synced.')) {
      return;
    }

    try {
      await calendarApi.disconnect('google');
      toast.success('Google Calendar disconnected successfully');
      await loadConnectionStatus();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect calendar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Calendar Integration</h2>

      {status?.connected ? (
        // Connected State
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-white font-medium">Google Calendar Connected</p>
                <p className="text-gray-400 text-sm">{status.email}</p>
              </div>
            </div>
          </div>

          {/* Last Sync Status */}
          {status.lastSync && (
            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-400">Last Sync</p>
              <p className="text-white">
                {new Date(status.lastSync).toLocaleString()}
              </p>
              <p className={`text-sm mt-1 ${
                status.syncStatus === 'success' ? 'text-green-500' : 'text-red-500'
              }`}>
                Status: {status.syncStatus}
              </p>
              {status.syncError && (
                <p className="text-sm text-red-400 mt-1">{status.syncError}</p>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
            <p className="text-blue-400 text-sm">
              ✓ New appointments are automatically added to your Google Calendar
              <br />
              ✓ Rescheduled appointments update your calendar
              <br />
              ✓ Cancelled appointments are removed from your calendar
            </p>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Disconnect Google Calendar
          </button>
        </div>
      ) : (
        // Disconnected State
        <div className="space-y-4">
          <div className="p-4 bg-gray-700 rounded-lg">
            <h3 className="text-white font-medium mb-2">Why Connect Google Calendar?</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Automatically sync appointment bookings
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Get mobile notifications for upcoming appointments
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                View appointments across all your devices
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                Never miss an appointment with Google Calendar reminders
              </li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.5 3.09L15 5.92V7h5a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h5V5.92L4.5 3.09A.5.5 0 014 3V2a.5.5 0 01.5-.5h15a.5.5 0 01.5.5v1a.5.5 0 01-.5.5zM7 9H5v2h2V9zm10 0h2v2h-2V9zm-5 0h2v2h-2V9zM7 13H5v2h2v-2zm10 0h2v2h-2v-2zm-5 0h2v2h-2v-2z"/>
                </svg>
                <span>Connect Google Calendar</span>
              </>
            )}
          </button>

          <p className="text-gray-400 text-xs text-center">
            You'll be redirected to Google to authorize RepairCoin
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Step 3.3: Create OAuth Callback Handler Page

**File**: `frontend/src/app/shop/calendar/callback/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calendarApi } from '@/services/api/calendar';
import { toast } from 'react-hot-toast';

export default function CalendarCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      toast.error('Google Calendar connection cancelled');
      setTimeout(() => router.push('/shop/settings'), 2000);
      return;
    }

    if (!code) {
      setStatus('error');
      toast.error('Missing authorization code');
      setTimeout(() => router.push('/shop/settings'), 2000);
      return;
    }

    try {
      await calendarApi.handleCallback(code, state || '');
      setStatus('success');
      toast.success('Google Calendar connected successfully!');
      setTimeout(() => router.push('/shop/settings?tab=calendar'), 2000);
    } catch (error) {
      console.error('Callback error:', error);
      setStatus('error');
      toast.error('Failed to connect Google Calendar');
      setTimeout(() => router.push('/shop/settings'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Connecting Calendar...</h2>
            <p className="text-gray-400">Please wait while we connect your Google Calendar</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400">Your Google Calendar is now connected</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
            <p className="text-gray-400">Redirecting you back to settings...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Step 3.4: Add Calendar Tab to Shop Settings

**File**: `frontend/src/components/shop/tabs/SettingsTab.tsx`

Add to the tabs array:

```typescript
const tabs = [
  'General',
  'Social Media',
  'FAQ',
  'Calendar Integration', // ADD THIS
  'Availability',
  'Moderation'
];

// In the tab content section, add:
{activeTab === 'Calendar Integration' && (
  <CalendarIntegrationSettings />
)}
```

Don't forget to import:
```typescript
import CalendarIntegrationSettings from '../CalendarIntegrationSettings';
```

---

### Phase 4: Testing (2 hours)

#### Test 4.1: OAuth Flow

1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Login as a shop owner
4. Navigate to Settings → Calendar Integration
5. Click "Connect Google Calendar"
6. Should redirect to Google OAuth consent
7. Grant permissions
8. Should redirect back to RepairCoin
9. Verify connection status shows "Connected"

#### Test 4.2: Event Creation

1. Have a customer book an appointment
2. Check the shop's connected Google Calendar
3. Verify event appears with:
   - Correct date and time
   - Customer name and service
   - Event description with details

#### Test 4.3: Event Update (Reschedule)

1. Shop approves a reschedule request
2. Check Google Calendar
3. Verify event time is updated

#### Test 4.4: Event Deletion (Cancellation)

1. Cancel an appointment
2. Check Google Calendar
3. Verify event is removed

#### Test 4.5: Disconnect

1. Click "Disconnect Google Calendar"
2. Confirm disconnect
3. Verify status shows "Disconnected"
4. Book new appointment
5. Verify no calendar event is created

---

## 🐛 Troubleshooting Guide

### Issue: "Invalid grant" error

**Cause**: Authorization code expired or already used
**Solution**: Start OAuth flow again (codes expire in 60 seconds)

### Issue: Events not appearing in calendar

**Checklist**:
1. Check backend logs for API errors
2. Verify connection is active in database:
   ```sql
   SELECT * FROM shop_calendar_connections WHERE shop_id = 'your-shop-id';
   ```
3. Check `calendar_sync_status` in service_orders table
4. Verify redirect URI matches exactly in Google Cloud Console

### Issue: Token refresh fails

**Solution**: User needs to disconnect and reconnect calendar

### Issue: CORS error on OAuth callback

**Solution**: Add callback URL to `GOOGLE_CALENDAR_REDIRECT_URI` and Google Cloud Console authorized redirect URIs

---

## 📝 Success Criteria

You'll know the integration is complete when:

- [ ] Shop can connect Google Calendar via OAuth
- [ ] Connection status displays correctly
- [ ] New bookings create calendar events
- [ ] Rescheduled appointments update calendar events
- [ ] Cancelled appointments delete calendar events
- [ ] Shop can disconnect calendar
- [ ] Events include all relevant details (customer, service, time, price)
- [ ] Tokens refresh automatically without user intervention
- [ ] Sync errors are logged and displayed to user

---

## 📚 Reference Documentation

- **Feature Spec**: `/docs/features/GOOGLE_CALENDAR_INTEGRATION.md`
- **Setup Guide**: `/docs/setup/GOOGLE_CALENDAR_SETUP.md`
- **Backend Files**:
  - Repository: `/backend/src/repositories/CalendarRepository.ts`
  - Service: `/backend/src/services/GoogleCalendarService.ts`
  - Controller: `/backend/src/domains/ShopDomain/controllers/CalendarController.ts`
  - Routes: `/backend/src/domains/ShopDomain/routes/calendar.routes.ts`
  - Migration: `/backend/migrations/095_create_calendar_integration.sql`

---

## ⏱️ Time Estimates

| Phase | Task | Time |
|-------|------|------|
| 1 | Google Cloud Setup | 30-45 min |
| 2 | Payment Integration | 2-3 hours |
| 3 | Frontend UI | 4-5 hours |
| 4 | Testing | 2 hours |
| **Total** | | **8-12 hours** |

---

## 💡 Tips for Success

1. **Test OAuth flow first** - Make sure Google Cloud is configured correctly before building frontend
2. **Use test shop account** - Don't use production shop for initial testing
3. **Check backend logs** - Most issues will show up in logs
4. **Handle errors gracefully** - Calendar sync should never block payment processing
5. **Mobile test** - Test on mobile to ensure calendar notifications work
6. **Token refresh** - Test with expired tokens to verify refresh works

---

## 🎉 When Complete

Once all phases are done:

1. Update CLAUDE.md with Calendar Integration section
2. Mark feature as complete in project tracking
3. Deploy to staging environment for team testing
4. Create user documentation/tutorial
5. Plan rollout to production

---

**Good luck with your next session! The backend is solid and ready to go. 🚀**
