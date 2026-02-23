# Automated No-Show Detection - Testing Guide

**Date**: February 12, 2026
**Feature**: Automated No-Show Detection System
**Service**: `AutoNoShowDetectionService`

---

## 🎯 Testing Overview

This guide provides multiple approaches to test the automated no-show detection system, from quick manual tests to comprehensive end-to-end scenarios.

---

## ⚡ Quick Test Methods

### Method 1: Manual Trigger via Test Endpoint (Recommended)

Create a test endpoint to manually trigger the detection service.

#### Step 1: Add Test Endpoint to ServiceDomain Routes

Add this to `backend/src/domains/ServiceDomain/routes.ts`:

```typescript
import { getAutoNoShowDetectionService } from '../../services/AutoNoShowDetectionService';

// Add after other routes (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test/auto-no-show-detection',
    authMiddleware,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      try {
        const service = getAutoNoShowDetectionService();
        const report = await service.runDetection();

        res.json({
          success: true,
          message: 'Auto no-show detection triggered manually',
          report: report
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Detection failed'
        });
      }
    }
  );
}
```

#### Step 2: Trigger Detection

```bash
# From your terminal or Postman
curl -X POST http://localhost:4000/api/services/test/auto-no-show-detection \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Auto no-show detection triggered manually",
  "report": {
    "timestamp": "2026-02-12T...",
    "ordersChecked": 5,
    "ordersMarked": 2,
    "customerNotificationsSent": 2,
    "shopNotificationsSent": 2,
    "emailsSent": 4,
    "errors": [],
    "shopsProcessed": ["shop-uuid-1", "shop-uuid-2"]
  }
}
```

---

### Method 2: Direct Service Call via Node Script

Create a test script to call the service directly.

#### Create Test Script

**`backend/test-auto-detection.ts`**:
```typescript
// backend/test-auto-detection.ts
import { getAutoNoShowDetectionService } from './src/services/AutoNoShowDetectionService';

async function testAutoDetection() {
  console.log('🔍 Starting manual auto-detection test...\n');

  const service = getAutoNoShowDetectionService();
  const report = await service.runDetection();

  console.log('📊 Detection Report:');
  console.log('-------------------');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Orders Checked: ${report.ordersChecked}`);
  console.log(`Orders Marked: ${report.ordersMarked}`);
  console.log(`Customer Notifications: ${report.customerNotificationsSent}`);
  console.log(`Shop Notifications: ${report.shopNotificationsSent}`);
  console.log(`Emails Sent: ${report.emailsSent}`);
  console.log(`Shops Processed: ${report.shopsProcessed.length}`);

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(error => console.log(`  - ${error}`));
  }

  console.log('\n✅ Test complete!');
  process.exit(0);
}

testAutoDetection().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
```

#### Run Test Script

```bash
cd backend
npx ts-node test-auto-detection.ts
```

---

### Method 3: Check Service Status

Verify the service is running and when it will run next.

```typescript
// Add to routes or run in Node console
const service = getAutoNoShowDetectionService();
const status = service.getStatus();

console.log('Service Running:', status.isRunning);
console.log('Next Run Estimate:', status.nextRunEstimate);
```

---

## 🗄️ Creating Test Data

To test the detection, you need orders that meet the eligibility criteria.

### Automated Test Data Script (Recommended)

We've created a comprehensive script that automatically generates test data:

```bash
cd backend
npx ts-node scripts/create-auto-detection-test-data.ts
```

**What it creates:**
- 2 test shops with auto-detection enabled
- 2 test customers (Tier 0 - Normal)
- 3 services per shop
- 4 backdated orders:
  - 3 eligible for immediate detection
  - 1 not yet eligible (for testing grace period)

**Features:**
- Automatically cleans up old test data on re-run
- Shows detailed summary of what was created
- Displays verification queries
- Provides testing instructions
- Calculates eligibility status for each order

**Output includes:**
- Number of orders eligible for detection
- Testing methods (manual trigger, wait for cron)
- SQL queries to verify detection worked
- Cleanup instructions

**Note:** Ensure your `.env` has `DATABASE_URL` configured before running.

---

### Manual Database Setup (Alternative)

#### Step 1: Create Test Shop with Policy

```sql
-- Ensure shop has auto-detection enabled
INSERT INTO no_show_policies (
  shop_id,
  enabled,
  auto_detection_enabled,
  grace_period_minutes,
  auto_detection_delay_hours
) VALUES (
  'your-test-shop-id',
  true,
  true,
  15,  -- 15 minute grace period
  2    -- 2 hour detection delay
)
ON CONFLICT (shop_id) DO UPDATE SET
  enabled = true,
  auto_detection_enabled = true;
```

#### Step 2: Create Backdated Test Order

```sql
-- Create an order scheduled 5 hours ago (will be caught by detection)
INSERT INTO service_orders (
  order_id,
  customer_address,
  shop_id,
  service_id,
  status,
  total_amount,
  rcn_amount,
  booking_date,
  booking_time_slot,
  no_show,
  completed_at,
  created_at
) VALUES (
  gen_random_uuid(),
  'your-customer-wallet-address',
  'your-test-shop-id',
  'your-test-service-id',
  'paid',
  50.00,
  0,
  CURRENT_DATE - INTERVAL '1 day',  -- Yesterday
  '10:00:00',                         -- 10 AM
  false,                              -- Not yet marked as no-show
  NULL,                               -- Not completed
  NOW() - INTERVAL '1 day'
);
```

**Timeline Calculation:**
- Appointment: Yesterday at 10:00 AM
- Grace Period: +15 minutes → 10:15 AM yesterday
- Detection Delay: +2 hours → 12:15 PM yesterday
- Current Time: Today (24+ hours later)
- **Result**: ✅ Eligible for auto-detection

#### Step 3: Verify Order Eligibility

```sql
-- Check if your test order will be detected
SELECT
  so.order_id,
  so.booking_date,
  so.booking_time_slot,
  so.status,
  so.no_show,
  so.completed_at,
  (so.booking_date + so.booking_time_slot::time +
   (COALESCE(nsp.grace_period_minutes, 15) || ' minutes')::interval +
   (COALESCE(nsp.auto_detection_delay_hours, 2) || ' hours')::interval
  ) as "autoMarkTime",
  NOW() as "currentTime",
  CASE
    WHEN (so.booking_date + so.booking_time_slot::time +
         (COALESCE(nsp.grace_period_minutes, 15) || ' minutes')::interval +
         (COALESCE(nsp.auto_detection_delay_hours, 2) || ' hours')::interval
        ) < NOW()
    THEN '✅ ELIGIBLE'
    ELSE '❌ NOT YET ELIGIBLE'
  END as "eligibilityStatus"
FROM service_orders so
LEFT JOIN no_show_policies nsp ON nsp.shop_id = so.shop_id
WHERE so.order_id = 'your-test-order-id';
```

---

## 🧪 Complete Test Scenarios

### Scenario 1: Basic Auto-Detection Test

**Goal**: Verify service detects and marks a past appointment

**Steps**:
1. Create test order scheduled 5 hours ago (see SQL above)
2. Verify order is `status = 'paid'` and `no_show = false`
3. Trigger detection manually (Method 1 or 2)
4. Verify order now has `no_show = true`
5. Check customer received notification
6. Check shop received notification
7. Check customer tier updated in `customer_no_show_status`

**Expected Results**:
- ✅ Order marked as no-show
- ✅ `marked_no_show_at` timestamp set
- ✅ `no_show_notes` = "Automatically marked as no-show by system"
- ✅ Customer notification created
- ✅ Shop notification created
- ✅ Email sent to customer
- ✅ Customer tier updated

---

### Scenario 2: Grace Period Respect

**Goal**: Verify detection respects grace period

**Setup**:
```sql
-- Order scheduled 2 hours and 10 minutes ago
-- Grace period: 15 minutes
-- Detection delay: 2 hours
-- Total: Should be eligible in 5 more minutes

INSERT INTO service_orders (...)
VALUES (
  ...
  CURRENT_TIMESTAMP - INTERVAL '2 hours 10 minutes',  -- booking_date
  '14:00:00',  -- booking_time_slot
  ...
);
```

**Expected Results**:
- ❌ Should NOT be detected yet (needs 5 more minutes)
- ✅ After 5+ minutes, should be detected

---

### Scenario 3: Shop Policy Disabled

**Goal**: Verify detection skips shops with disabled policies

**Setup**:
```sql
-- Disable auto-detection for shop
UPDATE no_show_policies
SET auto_detection_enabled = false
WHERE shop_id = 'test-shop-id';

-- Create eligible order for this shop
INSERT INTO service_orders (...) VALUES (...);
```

**Expected Results**:
- ❌ Order should NOT be detected (policy disabled)
- Report shows 0 orders marked for this shop

---

### Scenario 4: Already Completed Order

**Goal**: Verify detection skips completed orders

**Setup**:
```sql
-- Create order that's completed (should be ignored)
INSERT INTO service_orders (...)
VALUES (
  ...
  completed_at = NOW() - INTERVAL '1 hour',  -- Already completed
  ...
);
```

**Expected Results**:
- ❌ Order should NOT be detected (already completed)

---

### Scenario 5: Multiple Tier Escalation

**Goal**: Verify tier escalation from Tier 0 → Tier 1 → Tier 2

**Steps**:
1. Create customer with `no_show_count = 1`
2. Create eligible order for this customer
3. Run detection
4. Verify customer moved to Tier 1 (Warning)
5. Create another eligible order
6. Run detection again
7. Verify customer moved to Tier 2 (Caution)

**Expected Results**:
- ✅ First detection: Tier 1 warning email sent
- ✅ Second detection: Tier 2 caution email sent
- ✅ `no_show_count` increments correctly
- ✅ Restrictions applied correctly

---

## 📊 Monitoring & Verification

### Check Service Logs

The service logs extensively. Check your logs for:

```bash
# Backend logs
tail -f backend.log | grep "Auto no-show"

# Look for:
# - "Starting auto no-show detection run..."
# - "Found X orders eligible for auto no-show detection"
# - "Processing auto no-show for order..."
# - "Auto no-show detection run completed"
```

### Verify Database Changes

```sql
-- Check recently marked no-shows
SELECT
  order_id,
  customer_address,
  booking_date,
  booking_time_slot,
  marked_no_show_at,
  no_show_notes
FROM service_orders
WHERE no_show = true
  AND marked_no_show_at > NOW() - INTERVAL '1 hour'
ORDER BY marked_no_show_at DESC;

-- Check no-show history (should have 'SYSTEM' as marker)
SELECT
  customer_address,
  order_id,
  marked_by,
  marked_no_show_at,
  notes
FROM no_show_history
WHERE marked_by = 'SYSTEM'
ORDER BY created_at DESC
LIMIT 10;

-- Check customer tier updates
SELECT
  customer_address,
  no_show_count,
  current_tier,
  last_no_show_at
FROM customer_no_show_status
WHERE last_no_show_at > NOW() - INTERVAL '1 hour'
ORDER BY last_no_show_at DESC;
```

### Check Notifications

```sql
-- Check customer notifications
SELECT
  receiver_address,
  notification_type,
  message,
  metadata,
  created_at
FROM notifications
WHERE notification_type = 'service_no_show'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check shop notifications
SELECT
  receiver_address,
  notification_type,
  message,
  metadata,
  created_at
FROM notifications
WHERE notification_type = 'shop_no_show_auto_detected'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 🔍 Debugging Tips

### Issue: No Orders Detected

**Check**:
1. ✅ Service is running: `getAutoNoShowDetectionService().getStatus()`
2. ✅ Orders exist with correct status
3. ✅ Orders have `booking_date` and `booking_time_slot`
4. ✅ Shop has `auto_detection_enabled = true`
5. ✅ Enough time has passed (appointment + grace + delay)

**Query to Debug**:
```sql
-- See why orders aren't being detected
SELECT
  so.order_id,
  so.status,
  so.booking_date,
  so.booking_time_slot,
  so.no_show,
  so.completed_at,
  nsp.enabled as "policyEnabled",
  nsp.auto_detection_enabled as "autoDetectionEnabled",
  CASE
    WHEN so.status NOT IN ('paid', 'confirmed') THEN '❌ Wrong status'
    WHEN so.booking_date IS NULL THEN '❌ No booking date'
    WHEN so.booking_time_slot IS NULL THEN '❌ No time slot'
    WHEN so.no_show = true THEN '❌ Already marked'
    WHEN so.completed_at IS NOT NULL THEN '❌ Already completed'
    WHEN nsp.enabled IS NOT TRUE THEN '❌ Policy disabled'
    WHEN nsp.auto_detection_enabled IS NOT TRUE THEN '❌ Auto-detection disabled'
    WHEN (so.booking_date + so.booking_time_slot::time +
         (COALESCE(nsp.grace_period_minutes, 15) || ' minutes')::interval +
         (COALESCE(nsp.auto_detection_delay_hours, 2) || ' hours')::interval
        ) >= NOW() THEN '❌ Not enough time passed'
    ELSE '✅ SHOULD BE DETECTED'
  END as "reason"
FROM service_orders so
LEFT JOIN no_show_policies nsp ON nsp.shop_id = so.shop_id
WHERE so.shop_id = 'your-shop-id'
ORDER BY so.created_at DESC
LIMIT 10;
```

### Issue: Service Not Running

**Check**:
```typescript
const service = getAutoNoShowDetectionService();
console.log(service.getStatus());
// Should show: { isRunning: true, nextRunEstimate: Date }
```

**Restart Manually**:
```typescript
const service = getAutoNoShowDetectionService();
service.stop();
service.start();
```

### Issue: Emails Not Sending

**Check EmailService logs**:
```bash
tail -f backend.log | grep "email"
```

**Verify email configuration** in `.env`:
```
EMAIL_SERVICE=configured
SMTP_HOST=...
SMTP_USER=...
```

---

## ⏱️ Testing Timeline Examples

### Example 1: Fast Test (Immediate)
- Create order: Yesterday at 10:00 AM
- Current time: Today at 2:00 PM
- **Status**: ✅ Eligible immediately

### Example 2: Scheduled Test (In Production)
- Create order: Today at 2:00 PM (appointment time)
- Grace period: 15 minutes
- Detection delay: 2 hours
- **Detection time**: Today at 4:15 PM
- **Wait**: 2 hours 15 minutes

### Example 3: Edge Case (Just Eligible)
- Create order: 2 hours 16 minutes ago
- Grace: 15 min
- Delay: 2 hours
- Total needed: 2:15
- **Status**: ✅ Eligible by 1 minute

---

## 📋 Test Checklist

Before deploying to production, verify:

- [ ] Service starts on app.ts initialization
- [ ] Service stops on graceful shutdown
- [ ] Query finds eligible orders correctly
- [ ] Orders are marked with `no_show = true`
- [ ] `marked_no_show_at` timestamp is set
- [ ] `no_show_notes` contains "Automatically marked as no-show by system"
- [ ] History recorded with `marked_by = 'SYSTEM'`
- [ ] Customer tier updated correctly
- [ ] Customer notification sent (in-app)
- [ ] Shop notification sent (in-app)
- [ ] Tier-based email sent to customer
- [ ] Grace period respected
- [ ] Detection delay respected
- [ ] Shop policy `auto_detection_enabled` respected
- [ ] Completed orders skipped
- [ ] Already marked no-shows skipped
- [ ] Errors handled gracefully
- [ ] Logs written correctly
- [ ] Reports generated accurately
- [ ] Service runs every 30 minutes

---

## 🚀 Production Monitoring

Once deployed, monitor these metrics:

### Daily Checks
```sql
-- How many auto-detections today?
SELECT COUNT(*) as auto_detections_today
FROM no_show_history
WHERE marked_by = 'SYSTEM'
  AND DATE(created_at) = CURRENT_DATE;

-- Which shops had auto-detections?
SELECT
  shop_id,
  COUNT(*) as detections
FROM no_show_history
WHERE marked_by = 'SYSTEM'
  AND DATE(created_at) = CURRENT_DATE
GROUP BY shop_id
ORDER BY detections DESC;

-- Any errors in the last 24 hours?
-- Check application logs for "Error in auto no-show detection"
```

### Weekly Reports
- Average detections per day
- Shops with most auto-detections
- Customer tier distribution changes
- Email delivery success rate

---

## 📞 Support

If you encounter issues:

1. **Check Logs**: Look for error messages in application logs
2. **Verify Data**: Run SQL queries to check order eligibility
3. **Test Endpoint**: Use manual trigger to isolate issues
4. **Service Status**: Verify service is running
5. **Database Connection**: Ensure pool is healthy

---

**Document**: Auto No-Show Detection Testing Guide
**Version**: 1.0
**Last Updated**: February 12, 2026
**Status**: Ready for Testing
