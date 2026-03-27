# Google Calendar Integration Setup Guide

**Last Updated:** March 24, 2026
**Status:** Ready for Implementation

---

## Overview

This guide walks through the complete setup process for the Google Calendar integration feature. Follow these steps to enable shops to sync their appointment bookings with Google Calendar.

---

## Prerequisites

- Google Cloud Platform account (free tier is sufficient)
- Access to RepairCoin backend environment variables
- Admin access to production backend server

---

## Part 1: Google Cloud Project Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project** or **Select a Project** > **New Project**
3. Enter project details:
   - **Project Name**: `RepairCoin Calendar Integration`
   - **Organization**: (Optional)
   - **Location**: (Optional)
4. Click **Create**
5. Wait for project creation (takes ~10-30 seconds)

### Step 2: Enable Google Calendar API

1. In the Google Cloud Console, ensure you've selected the RepairCoin project
2. Navigate to **APIs & Services** > **Library**
3. Search for "Google Calendar API"
4. Click on **Google Calendar API**
5. Click **Enable**
6. Wait for the API to be enabled

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (for production use with any Google account)
3. Click **Create**

**App Information:**
- **App name**: `RepairCoin`
- **User support email**: `your-email@repaircoin.com`
- **App logo**: (Upload RepairCoin logo - optional)
- **Application home page**: `https://repaircoin.ai`
- **Application privacy policy link**: `https://repaircoin.ai/privacy`
- **Application terms of service link**: `https://repaircoin.ai/terms`

**Developer Contact Information:**
- **Email addresses**: `support@repaircoin.com`

Click **Save and Continue**

**Scopes Configuration:**

1. Click **Add or Remove Scopes**
2. Filter and add the following scopes:
   - `https://www.googleapis.com/auth/calendar.events` (Create, edit, and delete events)
   - `https://www.googleapis.com/auth/calendar.readonly` (View calendar)
   - `https://www.googleapis.com/auth/userinfo.email` (See your email address)
3. Click **Update**
4. Click **Save and Continue**

**Test Users (Optional for Development):**
- Add email addresses of developers who need to test before publishing

Click **Save and Continue**

**Review Summary:**
- Review all information
- Click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `RepairCoin Backend`

**Authorized JavaScript origins:**
```
https://repaircoin.ai
https://www.repaircoin.ai
http://localhost:3001 (for development)
```

**Authorized redirect URIs:**
```
https://repaircoin.ai/api/shops/calendar/callback/google
http://localhost:4000/api/shops/calendar/callback/google (for development)
```

5. Click **Create**
6. **IMPORTANT:** Copy the **Client ID** and **Client Secret** immediately
7. Store these securely - you'll need them for environment variables

---

## Part 2: Backend Configuration

### Step 1: Add Environment Variables

Add the following to your `.env` file:

```bash
# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=https://repaircoin.ai/api/shops/calendar/callback/google
GOOGLE_CALENDAR_ENCRYPTION_KEY=your-32-byte-random-key-here
```

**Generate Encryption Key:**

```bash
# Generate a secure 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as `GOOGLE_CALENDAR_ENCRYPTION_KEY`.

### Step 2: Run Database Migration

```bash
cd /Users/zeff/Desktop/Work/RepairCoin/backend

# Run the migration
npm run db:migrate
```

This creates:
- `shop_calendar_connections` table
- Calendar sync columns in `service_orders` table
- Indexes for performance
- Trigger for auto-updating timestamps

### Step 3: Verify Backend Setup

1. Start the backend server:
```bash
npm run dev
```

2. Check the logs for any errors related to Google Calendar

3. Test the API endpoints:
```bash
# Get calendar status (should return 404 for new shops)
curl -X GET http://localhost:4000/api/shops/calendar/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Part 3: Testing the Integration

### Test Flow (Development)

1. **Start backend**: `npm run dev`
2. **Get OAuth URL**:
```bash
curl -X GET http://localhost:4000/api/shops/calendar/connect/google \
  -H "Authorization: Bearer YOUR_SHOP_JWT_TOKEN"
```

3. **Visit the returned `authUrl`** in your browser
4. **Sign in with Google** and grant permissions
5. **You'll be redirected** back to the callback URL with a code
6. **Extract the code** from the URL query parameter
7. **Complete the connection**:
```bash
curl -X POST http://localhost:4000/api/shops/calendar/callback/google \
  -H "Authorization: Bearer YOUR_SHOP_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0Adeu5BW...",
    "state": "shop-123"
  }'
```

8. **Verify connection**:
```bash
curl -X GET http://localhost:4000/api/shops/calendar/status \
  -H "Authorization: Bearer YOUR_SHOP_JWT_TOKEN"
```

### Test Event Creation

1. Create a test appointment through the normal booking flow
2. Check if the event appears in the connected Google Calendar
3. Verify event details match the appointment

---

## Part 4: Production Deployment

### Step 1: Environment Variables

Add to production server:

```bash
# SSH into production server
ssh user@your-production-server

# Edit .env file
nano /path/to/backend/.env

# Add Google Calendar variables (see Part 2, Step 1)
```

### Step 2: Run Migration on Production

```bash
cd /path/to/backend
npm run db:migrate
```

### Step 3: Restart Backend

```bash
pm2 restart repaircoin-backend
# or
systemctl restart repaircoin-backend
```

### Step 4: Verify Production Setup

1. Check backend logs:
```bash
pm2 logs repaircoin-backend
```

2. Test API connectivity:
```bash
curl https://repaircoin.ai/api/shops/calendar/status \
  -H "Authorization: Bearer SHOP_TOKEN"
```

---

## Part 5: Security Checklist

- [ ] OAuth client secret stored securely (not in version control)
- [ ] Encryption key is random and unique (32 bytes)
- [ ] Redirect URIs match exactly (https:// for production)
- [ ] Scopes limited to only what's needed
- [ ] Database tokens encrypted at rest
- [ ] HTTPS enforced on all calendar endpoints
- [ ] Rate limiting configured for calendar API calls

---

## Part 6: Monitoring & Maintenance

### Things to Monitor

1. **Token Refresh Failures**
   - Check logs for `token_expired` errors
   - Verify refresh token is working

2. **Event Sync Failures**
   - Monitor `calendar_sync_status = 'failed'` in service_orders table
   - Check `sync_error_message` for root causes

3. **API Rate Limits**
   - Google Calendar API: 1 million queries/day
   - Monitor daily usage in Google Cloud Console

### Maintenance Tasks

**Weekly:**
- Review failed sync attempts
- Check for disconnected calendars

**Monthly:**
- Review Google API quotas usage
- Clean up old disconnected connections:
```sql
SELECT cleanup_old_calendar_connections();
```

---

## Troubleshooting

### Issue: "Invalid grant" error during token refresh

**Solution:**
- User needs to reconnect their calendar
- Refresh token may have expired (happens after 6 months of inactivity)
- Shop should disconnect and reconnect

### Issue: Events not appearing in calendar

**Checklist:**
1. Is the calendar connection active?
```sql
SELECT * FROM shop_calendar_connections WHERE shop_id = 'shop-123' AND is_active = true;
```

2. Check sync status:
```sql
SELECT order_id, calendar_sync_status, calendar_sync_error
FROM service_orders
WHERE shop_id = 'shop-123' AND calendar_sync_status = 'failed';
```

3. Check backend logs for API errors

### Issue: OAuth callback fails

**Common Causes:**
- Redirect URI mismatch (check Google Cloud Console)
- Invalid authorization code (codes expire after 60 seconds)
- Missing scopes in OAuth consent screen

---

## Next Steps

After completing this setup:

1. ✅ Backend calendar integration is ready
2. ⏭️ Implement frontend UI (CalendarIntegrationSettings component)
3. ⏭️ Integrate with payment flow (auto-create events on booking)
4. ⏭️ Add calendar sync to appointment management
5. ⏭️ Create user documentation and tutorials

---

## Support

For issues or questions:
- **Backend Logs**: Check `backend/logs/` directory
- **Database Queries**: See repository methods in `CalendarRepository.ts`
- **Google Cloud**: [Cloud Console](https://console.cloud.google.com/)
- **API Documentation**: http://localhost:4000/api-docs

---

## References

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [RepairCoin Calendar Feature Spec](/docs/features/GOOGLE_CALENDAR_INTEGRATION.md)
