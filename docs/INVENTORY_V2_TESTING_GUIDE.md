# Inventory v2.0 Testing Guide

**Version**: 2.0
**Date**: May 14, 2026
**Status**: Ready for Post-Deployment Testing
**Prerequisites**: Migration 114 must be deployed

---

## 📋 Overview

This guide provides step-by-step instructions for testing all Inventory v2.0 features after deployment. Follow each section in order to ensure complete system validation.

---

## ✅ Pre-Test Checklist

Before starting tests, verify:
- [ ] Backend deployed successfully
- [ ] Migration 114 completed without errors
- [ ] Frontend deployed with latest code
- [ ] Email service configured (for alert tests)
- [ ] Test shop account with active subscription
- [ ] Test customer account

---

## 🗄️ Priority 1: Database Verification

### Step 1: Verify Tables Exist

Connect to production database and run:

```sql
-- Check if new tables exist
\dt service_inventory_items
\dt purchase_orders
\dt purchase_order_items

-- Expected output: Tables should be listed with owner and size
```

### Step 2: Verify Shop Columns

```sql
-- Check new columns on shops table
\d shops

-- Look for these columns:
-- - low_stock_alerts_enabled (boolean)
-- - low_stock_alert_email (varchar)
-- - low_stock_alert_frequency (varchar)
-- - last_low_stock_alert_sent (timestamp)
```

### Step 3: Check Indexes

```sql
-- Verify indexes were created
\di service_inventory_items*
\di purchase_orders*

-- Should see multiple indexes per table
```

### Step 4: Test Triggers

```sql
-- Insert test data to verify triggers work
INSERT INTO service_inventory_items (service_id, shop_id, inventory_item_id, quantity_required)
VALUES ('test-service', 'test-shop', 'test-item-id'::uuid, 1);

-- Check if updated_at is populated
SELECT updated_at FROM service_inventory_items WHERE service_id = 'test-service';

-- Clean up test data
DELETE FROM service_inventory_items WHERE service_id = 'test-service';
```

**✅ Pass Criteria**: All tables, columns, indexes, and triggers exist and function correctly.

---

## 🔗 Priority 2: Service-Inventory Integration

### Test Scenario: Link Inventory to Service & Verify Stock Status

#### Setup (5 minutes)

1. **Login as Shop Owner**
   - Navigate to shop dashboard
   - Go to Inventory tab

2. **Create Test Inventory Item**
   - Click "Add Item"
   - Fill in details:
     ```
     Name: iPhone 12 Screen (Test)
     SKU: IP12-SCR-001
     Price: $50.00
     Cost: $25.00
     Stock Quantity: 5
     Low Stock Threshold: 10
     Category: Repair Parts
     Status: Available
     ```
   - Save item
   - **Verify**: Item appears in inventory list

3. **Create Test Service**
   - Go to Services tab
   - Click "Create Service"
   - Fill in details:
     ```
     Name: iPhone 12 Screen Repair (Test)
     Description: Professional screen replacement
     Price: $180.00
     Duration: 60 minutes
     Category: repairs
     ```
   - Save service
   - **Verify**: Service appears in services list

#### Test 1: Link Inventory to Service (3 minutes)

1. **Open Service Editor**
   - Find "iPhone 12 Screen Repair (Test)" service
   - Click Edit/Actions → "Link Inventory Items"

2. **Link Item**
   - In the Service Inventory Picker modal:
     - Search for "iPhone 12 Screen"
     - Click to add item
     - Set Quantity Required: 1
     - Mark as Required (not optional)
   - Click "Save Links"

3. **Verify Linking**
   - Check success toast notification
   - Reopen service editor
   - **Expected**: Linked item should appear
   - **Expected**: Shows "1 required" quantity

**✅ Pass Criteria**: Item successfully linked with correct quantity and optional flag.

#### Test 2: View Status Badge in Marketplace (2 minutes)

1. **Check Current Status (Should be Low Stock)**
   - Logout as shop
   - Login as customer
   - Go to Service Marketplace
   - Search for "iPhone 12 Screen Repair (Test)"

2. **Verify Orange Badge**
   - **Expected**: Orange banner at top of service card
   - **Text**: "⚠️ Limited Parts Availability"
   - **Reason**: Stock (5) is below threshold (10)

**✅ Pass Criteria**: Orange low stock badge displays correctly.

#### Test 3: Trigger Out of Stock Status (3 minutes)

1. **Reduce Stock to Zero**
   - Login as shop owner
   - Go to Inventory tab
   - Find "iPhone 12 Screen (Test)"
   - Click "Adjust Stock"
   - Select: Manual Adjustment
   - Change: -5 (reduce by 5)
   - Reason: "Testing out of stock"
   - Save

2. **Verify Zero Stock**
   - **Expected**: Item shows 0 stock
   - **Expected**: Status auto-changed to "Out of Stock"
   - **Expected**: Red pulsing border around item

3. **Check Marketplace Badge**
   - Logout, login as customer
   - View service in marketplace
   - **Expected**: Red banner appears
   - **Text**: "⚠️ Parts Out of Stock"

**✅ Pass Criteria**: Red out of stock badge displays when inventory depleted.

#### Test 4: Automatic Stock Deduction (5 minutes)

1. **Restock Item**
   - As shop owner
   - Adjust stock: +10 units
   - **Expected**: Stock now 10, status "Available"

2. **Customer Books Service**
   - As customer
   - Book "iPhone 12 Screen Repair (Test)"
   - Pay with Stripe test card
   - **Expected**: Booking confirmed

3. **Shop Completes Service**
   - As shop owner
   - Go to Bookings tab
   - Find the test booking
   - Click "Mark as Completed"
   - Confirm completion

4. **Verify Automatic Stock Deduction**
   - Go to Inventory tab
   - Check "iPhone 12 Screen (Test)"
   - **Expected**: Stock reduced by 1 (now 9 units)
   - Click "View History" or "Adjustment History"
   - **Expected**: New adjustment record:
     ```
     Type: sale
     Change: -1
     Reference: Order ID
     Reason: Automatic deduction for service completion
     ```

**✅ Pass Criteria**: Stock automatically deducted and adjustment record created.

#### Test 5: Insufficient Stock Prevention (3 minutes)

1. **Reduce Stock Below Service Requirements**
   - Adjust stock to 0 units
   - Check marketplace as customer
   - **Expected**: Red "Out of Stock" badge

2. **Attempt to Book**
   - Try to book the service
   - **Expected**: (Feature depends on implementation)
     - Either: Booking allowed but flagged for shop attention
     - Or: Booking blocked with "Parts unavailable" message

3. **Shop Receives Alert** (if implemented)
   - Shop should see warning about insufficient inventory

**✅ Pass Criteria**: System handles insufficient stock gracefully.

---

## 📦 Priority 3: Purchase Order Management

### Test Scenario: Create PO, Receive Items, Verify Stock Update

#### Setup (2 minutes)

1. **Create Vendor (if not exists)**
   - As shop owner
   - Go to Inventory → Vendors
   - Click "Add Vendor"
   - Fill in:
     ```
     Name: TechParts Supply Inc
     Contact: John Smith
     Email: john@techparts.com
     Phone: (555) 123-4567
     ```
   - Save

**✅ Vendor created successfully.

#### Test 1: Create Purchase Order (5 minutes)

1. **Navigate to Purchase Orders**
   - Go to Inventory → Purchase Orders tab
   - Click "Create Purchase Order"

2. **Fill PO Details**
   ```
   Vendor: TechParts Supply Inc
   Order Date: Today
   Expected Delivery: 7 days from today
   Notes: Test PO for v2.0 validation
   ```

3. **Add Multiple Items**
   - Item 1: iPhone 12 Screen
     - Quantity: 20
     - Unit Cost: $25.00
     - Line Total: $500.00
   - Item 2: (Create another test item if needed)
     - Quantity: 10
     - Unit Cost: $15.00
     - Line Total: $150.00

4. **Review Totals**
   - Subtotal: $650.00
   - Tax: (if applicable)
   - Shipping: (if applicable)
   - **Total**: Calculated automatically

5. **Save as Draft**
   - Click "Create Purchase Order"
   - **Expected**: PO saved successfully
   - **Expected**: PO Number auto-generated (format: PO-2026-0001)

**✅ Pass Criteria**: PO created with auto-generated number, correct totals.

#### Test 2: PO Status Workflow (3 minutes)

1. **Update Status to "Sent"**
   - Find PO in list
   - Click Actions → "Change Status" → "Sent"
   - **Expected**: Status updated, timestamp recorded

2. **Update to "Confirmed"**
   - Change status to "Confirmed"
   - **Expected**: Status badge changes color

3. **Verify Status History**
   - Open PO details
   - **Expected**: Shows status change timeline

**✅ Pass Criteria**: Status changes tracked properly.

#### Test 3: Partial Receipt (5 minutes)

1. **Receive Partial Quantity**
   - Open PO details
   - Click "Receive Items"
   - For iPhone 12 Screen:
     - Ordered: 20
     - Already Received: 0
     - Receive Now: 10
   - For second item:
     - Receive: 0 (don't receive yet)
   - Click "Receive"

2. **Verify PO Status**
   - **Expected**: Status changes to "Partially Received"
   - **Expected**: Shows "10 of 20 received" for screen

3. **Verify Inventory Stock**
   - Go to Inventory tab
   - Check "iPhone 12 Screen" stock
   - **Expected**: Stock increased by 10
   - Previous: 0, Now: 10

4. **Verify Adjustment Record**
   - Click "View History" on item
   - **Expected**: New adjustment:
     ```
     Type: purchase
     Change: +10
     Reference: PO-2026-0001
     Reason: Purchase order receipt
     ```

**✅ Pass Criteria**: Partial receipt updates stock and creates adjustment records.

#### Test 4: Complete Receipt (3 minutes)

1. **Receive Remaining Items**
   - Open PO again
   - Click "Receive Items"
   - Receive remaining 10 screens
   - Receive all of second item (10 units)

2. **Verify PO Completion**
   - **Expected**: Status changes to "Received"
   - **Expected**: Received Date populated
   - **Expected**: All items show 100% received

3. **Verify Final Stock**
   - iPhone 12 Screen: Should be +20 from initial
   - Second item: Should be +10 from zero

**✅ Pass Criteria**: Full receipt completes PO and updates all stock.

#### Test 5: PO Statistics Dashboard (2 minutes)

1. **View Statistics**
   - At top of Purchase Orders tab
   - **Expected Stats**:
     - Total Orders: 1
     - Total Spending: $650.00
     - Pending Orders: 0
     - Received Orders: 1
     - Average Order Value: $650.00

**✅ Pass Criteria**: Statistics accurately reflect PO data.

---

## 🔔 Priority 4: Low Stock Email Alerts

### Test Scenario: Configure Alerts & Receive Email

#### Test 1: Configure Alert Settings (2 minutes)

1. **Navigate to Alert Settings**
   - Go to Inventory → Low Stock Alerts tab

2. **Enable Alerts**
   - Toggle "Enable Low Stock Alerts": ON
   - Email: (your test email)
   - Frequency: Daily
   - Save settings

**✅ Pass Criteria**: Settings saved successfully.

#### Test 2: Create Low Stock Condition (2 minutes)

1. **Adjust Item Below Threshold**
   - Find iPhone 12 Screen (threshold: 10)
   - Current stock: 20
   - Adjust to: 5 units
   - **Expected**: Item shows "Low Stock" status
   - **Expected**: Yellow pulsing border

**✅ Pass Criteria**: Low stock item visible in inventory.

#### Test 3: Manual Alert Trigger (3 minutes)

1. **Trigger Manual Check**
   - In Low Stock Alerts tab
   - Click "Check Now" or "Trigger Alert"
   - **Expected**: Loading indicator
   - **Expected**: Success message: "Alert check completed"

2. **View Low Stock Items**
   - Table at bottom should list:
     - iPhone 12 Screen
     - Stock: 5
     - Threshold: 10
     - Status Badge: "Low Stock"

3. **Check Email**
   - Open your test email inbox
   - **Expected**: Email received within 1-2 minutes
   - **Subject**: "Low Stock Alert - [Shop Name]"
   - **Content**:
     - Shop name
     - Date/time
     - List of low/out-of-stock items
     - Item details (name, SKU, stock, threshold)
     - Color-coded status badges

**✅ Pass Criteria**: Email received with correct item information.

#### Test 4: Cooldown Period (2 minutes)

1. **Trigger Again Immediately**
   - Click "Check Now" again
   - **Expected**: Message: "Alert sent recently, skipping (24-hour cooldown)"
   - **Expected**: No new email sent

2. **Verify Last Sent Timestamp**
   - Should show when last alert was sent

**✅ Pass Criteria**: Cooldown prevents email spam.

#### Test 5: Scheduler Status (Admin Only - 1 minute)

1. **Check Scheduler**
   - As admin, visit: `GET /api/inventory/alerts/scheduler/status`
   - **Expected JSON**:
     ```json
     {
       "running": true,
       "nextRun": "2026-05-15T09:00:00Z",
       "frequency": "0 9 * * *"
     }
     ```

**✅ Pass Criteria**: Scheduler running and will execute at 9 AM daily.

---

## 📊 Priority 5: Inventory Analytics

### Test Scenario: Verify All Analytics Endpoints

#### Test 1: Overview Analytics (3 minutes)

1. **Navigate to Analytics**
   - Go to Inventory → Analytics tab
   - Select Overview section

2. **Verify Statistics Cards**
   - Total Items: Should match inventory count
   - Total Value: Sum of (price × stock)
   - Total Cost: Sum of (cost × stock)
   - Potential Profit: Value - Cost
   - Profit Margin: Percentage calculated
   - Low Stock Items: Count of items below threshold
   - Out of Stock: Count of zero stock items

3. **Verify Charts**
   - **Top 10 Items by Value**: Bar chart
     - Shows items sorted by (price × stock)
     - Hover shows exact values
   - **Category Breakdown**: Pie chart
     - Shows value distribution by category
     - Color-coded slices

4. **Test Period Filter**
   - Change period: 7, 30, 90, 365 days
   - **Expected**: Charts update to show data for selected period

**✅ Pass Criteria**: All stats accurate, charts render correctly.

#### Test 2: Inventory Turnover (3 minutes)

1. **Navigate to Turnover Section**
   - **Expected Table**: Lists all items with:
     - Turnover Ratio: (Sales / Avg Stock)
     - Classification: Fast/Moderate/Slow
     - Sales Count: Number of times sold
     - Units Sold: Total quantity sold
     - Average Stock: Avg stock level over period
     - Days to Sell: Estimated days to deplete stock

2. **Verify Chart**
   - Bar chart showing top 15 items
   - Dual metrics: Turnover ratio + Days to sell

3. **Test Classification**
   - Fast movers: High turnover, low days-to-sell
   - Slow movers: Low turnover, high days-to-sell

**✅ Pass Criteria**: Turnover calculations accurate, fast/slow classification correct.

#### Test 3: Profit Margins (2 minutes)

1. **Navigate to Margins Section**
   - **Expected Table**: Shows:
     - Margin %: ((Price - Cost) / Price × 100)
     - Unit Profit: Price - Cost
     - Total Potential: Unit Profit × Stock
     - Classification: High (>50%), Medium (25-50%), Low (<25%)

2. **Verify Chart**
   - Dual-axis bar chart
   - Shows margin % and potential profit

3. **Identify Winners**
   - High margin items: Good profit per sale
   - High volume items: Good total profit potential

**✅ Pass Criteria**: Margin calculations correct, classifications accurate.

#### Test 4: Stock Trends (3 minutes)

1. **Navigate to Trends Section**
   - **Expected Chart**: Line graph showing:
     - Daily stock added (green line)
     - Daily stock removed (red line)
     - Net change (blue line)

2. **Test Period Selector**
   - Try 7, 30, 60, 90 days
   - **Expected**: Chart updates with more/less data points

3. **Verify Summary Stats**
   - Total Added: Sum of all additions in period
   - Total Removed: Sum of all deductions
   - Net Change: Added - Removed
   - Average Daily Change: Net / Days

**✅ Pass Criteria**: Trend data accurate, chart responsive to period changes.

#### Test 5: Low Stock Forecast (3 minutes)

1. **Navigate to Forecast Section**
   - **Expected Table**: Lists items predicted to run out:
     - Days Until Stockout: Estimated days
     - Current Stock: Current quantity
     - Avg Daily Usage: Calculated from adjustments
     - Urgency: Critical (<7 days), High (<14), Moderate (<30)
     - Predicted Date: Exact stockout date

2. **Test Forecast Period**
   - Change forecast horizon: 7, 14, 30, 60 days
   - **Expected**: Shows items predicted to run out within period

3. **Verify Urgency Colors**
   - Critical: Red badge
   - High: Orange badge
   - Moderate: Yellow badge

**✅ Pass Criteria**: Forecast algorithm reasonable, urgency classification helpful.

---

## 📱 Priority 6: Mobile Responsiveness

### Device Testing Matrix

Test on these viewport sizes:
- **Mobile**: 375px (iPhone SE)
- **Mobile**: 414px (iPhone 12 Pro)
- **Tablet**: 768px (iPad)
- **Desktop**: 1024px+

### Inventory List Table

#### Mobile (375px - 414px)

1. **Layout Check**
   - [ ] Table converts to card view OR
   - [ ] Table scrolls horizontally
   - [ ] Action buttons accessible
   - [ ] Search bar full width
   - [ ] Filter buttons wrap or scroll

2. **Interaction Check**
   - [ ] Can tap items to view details
   - [ ] Bulk select checkboxes usable (not too small)
   - [ ] Action dropdown menus accessible
   - [ ] Modals fill screen appropriately

3. **Issues to Fix**:
   - If table doesn't scroll: Add `overflow-x: auto`
   - If text truncated: Implement card view for mobile
   - If buttons overlap: Stack vertically

**✅ Pass Criteria**: Inventory list usable on mobile, no horizontal overflow.

### Analytics Charts (Mobile)

1. **Chart Responsiveness**
   - [ ] Charts scale to screen width
   - [ ] Touch interactions work (zoom, pan)
   - [ ] Legend readable
   - [ ] Tooltips don't go offscreen

2. **Issues to Fix**:
   - If chart overflows: Wrap in `<ResponsiveContainer>`
   - If legend cut off: Stack vertically
   - If tooltips hidden: Adjust tooltip position

**✅ Pass Criteria**: Charts readable and interactive on mobile.

### Purchase Order Modals (Mobile)

1. **Create PO Modal**
   - [ ] Form fields stack vertically
   - [ ] Vendor dropdown not cut off
   - [ ] Date picker works on mobile
   - [ ] Item list scrollable
   - [ ] Submit button always visible

2. **Receive Items Modal**
   - [ ] Item list fits screen
   - [ ] Quantity inputs accessible
   - [ ] "Receive All" buttons usable
   - [ ] Summary visible without scroll

3. **Issues to Fix**:
   - If modal too tall: Add `max-height` with scroll
   - If inputs too small: Increase touch target size (min 44px)
   - If dropdown cut off: Use portal/overlay positioning

**✅ Pass Criteria**: All modals functional on mobile, no usability issues.

### Tablet (768px)

1. **Layout Check**
   - [ ] Charts display 2-column grid
   - [ ] Tables show most columns
   - [ ] Modals use ~80% of screen width
   - [ ] Navigation accessible

**✅ Pass Criteria**: Tablet layout optimized, not just stretched mobile view.

### Known Mobile Issues (Document These)

| Issue | Screen | Severity | Fix Priority |
|-------|--------|----------|--------------|
| Table horizontal scroll | Mobile | Medium | Low |
| Chart tooltips offscreen | Mobile | Low | Low |
| Modal too tall on small phones | Mobile | Medium | Medium |
| Filter buttons wrap awkwardly | Mobile | Low | Low |

---

## 🐛 Bug Tracking Template

For any issues found during testing, create a bug report:

```markdown
## Bug: [Short Description]

**Severity**: Critical / High / Medium / Low
**Component**: Service Integration / Purchase Orders / Analytics / Alerts
**Environment**: Production / Staging / Local

### Steps to Reproduce
1.
2.
3.

### Expected Behavior


### Actual Behavior


### Screenshots/Videos
(Attach if applicable)

### Browser/Device
- Browser: Chrome 120
- Device: iPhone 12 Pro
- OS: iOS 17

### Additional Context
```

---

## ✅ Final Validation Checklist

After completing all tests above:

### Functionality
- [ ] All database tables exist and populated
- [ ] Service-inventory linking works
- [ ] Stock status badges display correctly
- [ ] Automatic stock deduction works
- [ ] Purchase orders create and update stock
- [ ] PO number auto-generation works
- [ ] Low stock emails send successfully
- [ ] Email cooldown prevents spam
- [ ] All 5 analytics endpoints return data
- [ ] Charts render without errors

### Performance
- [ ] Page load times acceptable (<3s)
- [ ] No console errors
- [ ] Charts render smoothly
- [ ] Large datasets (100+ items) perform well
- [ ] Search/filter responsive (<500ms)

### Mobile
- [ ] All screens usable on mobile
- [ ] No horizontal scroll issues
- [ ] Touch targets appropriately sized
- [ ] Forms easy to fill on mobile
- [ ] Charts interactive on touch devices

### Documentation
- [ ] User guides created
- [ ] Admin guides created
- [ ] API docs updated
- [ ] Known issues documented
- [ ] Migration guide available

---

## 📞 Support

If tests fail or issues found:
1. Document bug using template above
2. Check backend logs for errors
3. Verify migration 114 ran completely
4. Review `/docs/INVENTORY_ENHANCEMENTS_MAY_13_2026.md`
5. Contact development team

---

**Test Guide Version**: 1.0
**Last Updated**: May 14, 2026
**Next Review**: After first production deployment
