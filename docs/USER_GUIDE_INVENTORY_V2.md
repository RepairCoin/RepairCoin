# Inventory Management v2.0 - User Guide

**For Shop Owners**
**Version**: 2.0
**Last Updated**: May 14, 2026

---

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Inventory Management](#basic-inventory-management)
3. [Linking Inventory to Services](#linking-inventory-to-services)
4. [Purchase Order Management](#purchase-order-management)
5. [Low Stock Alerts](#low-stock-alerts)
6. [Analytics Dashboard](#analytics-dashboard)
7. [FAQs](#faqs)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### What's New in v2.0?

Inventory v2.0 adds powerful automation and insights:

- **🔗 Service Integration**: Link inventory items to services for automatic stock tracking
- **📦 Purchase Orders**: Manage orders from suppliers with auto-stock updates
- **📊 Analytics**: View turnover rates, profit margins, and stock forecasts
- **🔔 Smart Alerts**: Get email notifications when stock runs low

### Prerequisites

- Active RepairCoin shop subscription ($500/month)
- At least one inventory item created
- At least one service created (for integration features)

---

## 📦 Basic Inventory Management

### Adding Inventory Items

1. **Navigate to Inventory**
   - Go to Shop Dashboard → Inventory tab

2. **Click "Add Item"**

3. **Fill in Details**:
   - **Name**: Product name (e.g., "iPhone 13 Screen")
   - **SKU**: Stock keeping unit (auto-generated or custom)
   - **Category**: Select or create category
   - **Vendor**: Select supplier (optional)
   - **Price**: Selling price to customers
   - **Cost**: Your purchase cost (for profit tracking)
   - **Stock Quantity**: Current units in stock
   - **Low Stock Threshold**: Alert when below this number

4. **Upload Image** (optional)
   - Drag & drop or click to upload product photo
   - Recommended: 800x800px, under 2MB

5. **Click "Save"**

**💡 Pro Tip**: Set realistic low stock thresholds based on typical usage. For fast-moving items, set higher thresholds (20-30 units).

### Adjusting Stock

When you need to change stock quantities:

1. **Find Item** in inventory list
2. **Click Actions → Adjust Stock**
3. **Select Adjustment Type**:
   - **Manual**: Corrections or counts
   - **Purchase/Restock**: Received from supplier
   - **Sale**: Sold to walk-in customer (not through RepairCoin)
   - **Return**: Customer returned item
   - **Damage/Loss**: Damaged or lost items
   - **Theft**: Stolen inventory
   - **Recount**: Physical inventory count correction
   - **Transfer**: Moved to another location

4. **Enter Change**:
   - Positive number (+5) to add stock
   - Negative number (-3) to remove stock

5. **Add Reason**: Explain why (for audit trail)

6. **Save**

**Example**: If you received 20 screens from supplier:
- Type: Purchase/Restock
- Change: +20
- Reason: "Received PO-2026-0015 from TechParts"

### Viewing History

Every stock change is tracked:

1. Find item
2. Click "View History"
3. See complete adjustment log:
   - Who made change
   - When it happened
   - Reason provided
   - Before/after quantities

---

## 🔗 Linking Inventory to Services

### Why Link Inventory?

When you link inventory items to services:
- ✅ Stock **automatically deducts** when service completed
- ✅ Customers see **real-time availability** badges
- ✅ **Prevent overbooking** when parts unavailable
- ✅ Complete **audit trail** of part usage

### Step-by-Step Guide

#### Step 1: Navigate to Service

1. Go to **Services** tab
2. Find service that uses inventory
3. Click **Edit** or **Actions → Link Inventory**

#### Step 2: Add Items

In the **Service Inventory Picker** modal:

1. **Search** for inventory items (by name or SKU)
2. **Click item** to add to service
3. **Set Quantity Required**: How many units per service
   - Example: Screen repair needs 1 screen
4. **Mark as Optional or Required**:
   - **Required**: Service needs this item to complete
   - **Optional**: Nice to have but not essential

5. **Repeat** for all items this service uses

#### Step 3: Save

Click **"Save Links"**

**Example: iPhone 13 Screen Repair**
- Item: iPhone 13 Screen → Qty: 1 (Required)
- Item: Cleaning Cloth → Qty: 1 (Optional)
- Item: Screen Protector → Qty: 1 (Optional)

### How Automatic Deduction Works

**Scenario**: Customer books "iPhone 13 Screen Repair"

1. **Customer completes booking** and pays
2. **Shop marks order as completed** in Bookings tab
3. **System automatically**:
   - Deducts 1 iPhone 13 Screen from inventory
   - Deducts optional items if not out of stock
   - Creates adjustment record: "Service: [Order ID]"
   - Updates stock status (low/out if needed)

4. **No manual action needed!** ✨

### Stock Status Badges

Customers see badges on service cards:

| Badge | Color | Meaning | When |
|-------|-------|---------|------|
| None | - | Fully stocked | Stock > threshold |
| ⚠️ Limited Parts | Orange | Running low | Stock ≤ threshold, >0 |
| ⚠️ Parts Out of Stock | Red | No stock | Stock = 0 |

**These badges update automatically** as inventory changes.

### Managing Links

To view or edit linked items:

1. Edit service
2. Click "Linked Inventory" section
3. Options:
   - **Change Quantity**: Adjust units needed
   - **Toggle Optional**: Change required status
   - **Remove Link**: Unlink item completely

---

## 📦 Purchase Order Management

### What are Purchase Orders?

Purchase Orders (POs) are formal requests to suppliers for inventory. They help you:
- Track what's been ordered
- Know when items arriving
- Update stock automatically when received
- Manage vendor relationships

### Creating a Purchase Order

#### Step 1: Navigate

Go to **Inventory → Purchase Orders** tab

#### Step 2: Click "Create Purchase Order"

#### Step 3: Fill PO Header

- **Vendor**: Select supplier (or add new vendor)
- **Order Date**: When you placed order (default: today)
- **Expected Delivery**: When items should arrive
- **Notes**: Any special instructions or details

#### Step 4: Add Items

For each item you're ordering:

1. **Select Inventory Item** from dropdown
2. **Quantity Ordered**: How many units
3. **Unit Cost**: Price per unit from vendor
4. **Line Total**: Auto-calculated (qty × cost)

Click **"Add Item"** to add more.

#### Step 5: Review Totals

System calculates:
- **Subtotal**: Sum of all line totals
- **Tax**: (if applicable)
- **Shipping**: (if applicable)
- **Total**: Final amount

#### Step 6: Save

- **Save as Draft**: Keep working on it later
- **Save & Send**: Mark as sent to vendor

**✅ PO Number Auto-Generated**: Format `PO-2026-0001`

### PO Status Workflow

Purchase orders move through statuses:

```
Draft → Sent → Confirmed → Partially Received → Received
            ↓
        Cancelled
```

- **Draft**: Still creating, not sent yet
- **Sent**: Sent to vendor, awaiting confirmation
- **Confirmed**: Vendor confirmed, items on the way
- **Partially Received**: Some items arrived, some pending
- **Received**: All items arrived, PO complete
- **Cancelled**: Order cancelled (before/after sending)

### Receiving Items

When items arrive from vendor:

#### Option A: Full Receipt (All Items)

1. **Find PO** in list
2. **Click Actions → Receive All**
3. **Confirm receipt**
4. ✅ **Stock automatically updated** for all items
5. ✅ **PO status → Received**

#### Option B: Partial Receipt (Some Items)

1. **Find PO** in list
2. **Click Actions → Receive Items**
3. **Enter quantities** received for each item:
   - Can receive less than ordered
   - Can't receive more than ordered
4. **Click "Receive"**
5. ✅ **Stock updated** for received items
6. ✅ **PO status → Partially Received**

**Example**:
- Ordered: 50 screens
- Received today: 30 screens (vendor shipped in 2 batches)
- Pending: 20 screens

When remaining 20 arrive:
- Receive again with qty: 20
- PO status → Received ✅

### Viewing PO Statistics

At top of Purchase Orders tab:

- **Total Orders**: Lifetime PO count
- **Total Spending**: Sum of all completed POs
- **Pending Orders**: Currently open (not fully received)
- **Received Orders**: Completed POs
- **Average Order Value**: Total spent ÷ order count

Use these to:
- Track procurement costs
- Monitor vendor performance
- Plan future orders

---

## 🔔 Low Stock Alerts

### Why Use Alerts?

Never run out of popular items! Low stock alerts:
- ✅ Email you when items reach threshold
- ✅ Include item details and current stock
- ✅ Prevent stockouts and lost sales
- ✅ Smart cooldown to avoid spam

### Setting Up Alerts

1. **Navigate**: Inventory → Low Stock Alerts tab

2. **Enable Alerts**: Toggle switch ON

3. **Configure Settings**:
   - **Email**: Where to send alerts (default: shop email)
   - **Frequency**: How often to check
     - **Daily**: Check every morning at 9 AM
     - **Weekly**: Check every Monday at 9 AM

4. **Save Settings**

### How Alerts Work

**Daily at 9:00 AM**, system:

1. **Checks all inventory items** in your shop
2. **Finds items** where:
   - Stock ≤ Low Stock Threshold
   - OR Stock = 0 (out of stock)
3. **Sends email** if low/out items found
4. **Applies 24-hour cooldown** to prevent duplicate alerts

### Email Format

You'll receive:

**Subject**: "Low Stock Alert - [Your Shop Name]"

**Content**:
```
Hi [Shop Name],

The following items need restocking:

⚠️ LOW STOCK (2 items)
━━━━━━━━━━━━━━━━━━━━
1. iPhone 13 Screen
   SKU: IP13-SCR-001
   Current Stock: 3 units
   Threshold: 10 units

2. Cleaning Solution
   SKU: CLN-SOL-500
   Current Stock: 2 units
   Threshold: 5 units

🚨 OUT OF STOCK (1 item)
━━━━━━━━━━━━━━━━━━━━
1. iPad Pro Battery
   SKU: IPD-BAT-2021
   Current Stock: 0 units
   Last sold: 2 days ago

━━━━━━━━━━━━━━━━━━━━
Recommended Actions:
- Review your purchase orders
- Create new POs for depleted items
- Adjust thresholds if needed

View Full Inventory: [Link]
```

### Manual Alert Check

Don't want to wait for scheduled check?

1. Go to Low Stock Alerts tab
2. Click **"Check Now"**
3. System runs alert check immediately
4. View results on screen
5. Email sent (if items found + cooldown passed)

### Alert Cooldown

To prevent email spam:
- ✅ **First alert**: Sent immediately
- ⏸️ **Next 24 hours**: No duplicate alerts
- ✅ **After 24 hours**: New alert can send

**Example**:
- Monday 9 AM: Alert sent (3 items low)
- Monday 3 PM: Trigger manual check → No email (cooldown)
- Tuesday 9 AM: Alert sent (same 3 items still low)

### Disabling Alerts

To turn off:
1. Go to Low Stock Alerts tab
2. Toggle switch OFF
3. Save

No more emails until re-enabled.

---

## 📊 Analytics Dashboard

### Overview Tab

**Purpose**: High-level inventory health snapshot

**Metrics**:
- **Total Items**: Count of all inventory items
- **Total Value**: Worth at selling prices (price × stock)
- **Total Cost**: What you paid (cost × stock)
- **Potential Profit**: Value - Cost
- **Profit Margin**: (Profit / Value) × 100%
- **Low Stock Items**: Items below threshold
- **Out of Stock**: Items at zero stock

**Charts**:
- **Top 10 Items by Value**: Which items represent most inventory value
- **Category Breakdown**: Pie chart of value distribution by category

**Use Cases**:
- Assess total inventory investment
- Identify which categories dominate
- Calculate overall profitability

### Turnover Tab

**Purpose**: Identify fast-moving vs slow-moving items

**Metrics**:
- **Turnover Ratio**: How fast items sell (higher = faster)
- **Classification**:
  - 🟢 **Fast Movers**: High turnover (stock 1-2 weeks)
  - 🟡 **Moderate**: Medium turnover (stock 1-2 months)
  - 🔴 **Slow Movers**: Low turnover (stock 3+ months)
- **Sales Count**: Number of times sold
- **Units Sold**: Total quantity sold
- **Days to Sell**: Estimated days to deplete current stock

**Chart**: Bar graph of top 15 items showing turnover and days-to-sell

**Use Cases**:
- **Fast movers**: Keep well-stocked, bulk order for discounts
- **Slow movers**: Reduce order quantities, consider discounts to move
- **Dead stock**: Items not selling → liquidate or remove

**Example**:
```
iPhone 13 Screen:
- Turnover: 12.5 (very fast!)
- Sales: 50 times in 90 days
- Days to Sell: 7 days
- Action: Increase stock, set high threshold
```

### Profit Margins Tab

**Purpose**: Find your most profitable items

**Metrics**:
- **Margin %**: ((Price - Cost) / Price) × 100
- **Unit Profit**: Profit per item sold (Price - Cost)
- **Total Potential**: Unit Profit × Stock (if sold all)
- **Classification**:
  - 🟢 **High Margin**: >50% profit
  - 🟡 **Medium Margin**: 25-50% profit
  - 🔴 **Low Margin**: <25% profit

**Chart**: Dual-axis showing margin % and total potential profit

**Use Cases**:
- **High margin + high volume**: Your winners! Promote these
- **High margin + low volume**: Good profit but underperforming, market more
- **Low margin + high volume**: Price increase opportunity or cost reduction
- **Low margin + low volume**: Consider discontinuing

**Example**:
```
Premium Screen Protector:
- Margin: 75% (high)
- Unit Profit: $15.00
- Stock: 50 units
- Potential: $750
- Action: Great product, promote heavily
```

### Stock Trends Tab

**Purpose**: Visualize stock movements over time

**Chart**: Line graph showing:
- 🟢 **Stock Added**: Daily additions (purchases, returns)
- 🔴 **Stock Removed**: Daily deductions (sales, damage)
- 🔵 **Net Change**: Added - Removed

**Metrics**:
- **Total Added**: Sum in period
- **Total Removed**: Sum in period
- **Net Change**: Overall increase/decrease
- **Average Daily Change**: Trend indicator

**Use Cases**:
- Spot unusual spikes (large order or damage)
- See seasonal patterns
- Validate restocking frequency
- Plan future purchases

**Example Insights**:
- "Removed spike on Black Friday → plan ahead next year"
- "Steady decline → need regular restocking"
- "Flat line → dead stock, not selling"

### Forecast Tab

**Purpose**: Predict when items will run out

**Metrics**:
- **Days Until Stockout**: When predicted to hit zero
- **Current Stock**: Units available now
- **Avg Daily Usage**: Calculated from history
- **Urgency**:
  - 🔴 **Critical**: <7 days (order NOW)
  - 🟠 **High**: 7-14 days (order this week)
  - 🟡 **Moderate**: 14-30 days (plan ahead)

**Use Cases**:
- Proactive reordering (don't wait for zero stock)
- Prioritize urgent items in POs
- Adjust thresholds based on usage

**Example**:
```
iPhone 13 Screen:
- Current: 15 units
- Usage: 2.5 per day
- Stockout: 6 days
- Urgency: Critical!
- Action: Create PO immediately
```

### Using Analytics Together

**Workflow Example**:

1. **Overview**: "Total value $50K, margin 40%, 5 items low stock"
2. **Turnover**: "iPhone 13 screens = fast mover, iPad batteries = slow"
3. **Margins**: "Screen protectors = 75% margin, need more marketing"
4. **Forecast**: "iPhone screens run out in 6 days, order now!"
5. **Action**: Create PO for screens, discount iPad batteries, promote protectors

---

## ❓ FAQs

### General

**Q: Do I need a subscription to use inventory features?**
A: Yes, inventory management requires an active RepairCoin shop subscription ($500/month).

**Q: Is there a limit on inventory items?**
A: No hard limit, but we recommend under 500 items for optimal performance. For larger catalogs, contact us for enterprise options.

**Q: Can I import inventory from Excel/CSV?**
A: Yes! Use the "Import" button on Inventory tab. We provide a template to fill.

### Service Integration

**Q: What happens if inventory is low but customer books anyway?**
A: Customer sees a warning badge but can still book. You can fulfill with alternate parts or cancel/reschedule.

**Q: Can I link the same item to multiple services?**
A: Yes! For example, "Cleaning Cloth" can be linked to all screen repair services.

**Q: What if I forget to mark optional items as optional?**
A: Edit the service → Change "Required" to "Optional" for any item. Stock won't block service completion if optional items are out.

**Q: Does automatic deduction work for manual/walk-in orders?**
A: No, only for RepairCoin bookings marked as "completed". For walk-in sales, manually adjust stock using "Sale" adjustment type.

### Purchase Orders

**Q: Can I edit a PO after sending it?**
A: Yes, you can update any PO except "Received" ones. Best practice: add notes explaining changes.

**Q: What if vendor ships less than ordered?**
A: Use "Receive Items" to enter actual quantity received. PO stays "Partially Received" until full order arrives or you cancel remaining.

**Q: Can I delete a PO?**
A: Only "Draft" POs can be deleted. Sent/Received POs should be cancelled instead (preserves audit trail).

**Q: Do I have to use purchase orders?**
A: No, they're optional. You can still manually adjust stock with "Purchase/Restock" type. POs just provide better tracking.

### Alerts

**Q: Why didn't I receive an alert email?**
A: Check:
- Alerts enabled (toggle ON)
- Correct email address
- Items actually below threshold
- 24-hour cooldown hasn't blocked alert
- Email not in spam folder

**Q: Can I change the alert time (9 AM)?**
A: Currently fixed at 9 AM. Contact support if you need a different schedule.

**Q: Will alerts send if I'm out of stock completely?**
A: Yes! Out of stock alerts are prioritized and clearly marked in emails.

### Analytics

**Q: Why are my analytics empty?**
A: Need at least:
- Some inventory items created
- Some stock adjustments (sales/purchases)
- Time period with data (try extending to 90 days)

**Q: How is turnover calculated?**
A: Turnover = (Units Sold in Period) ÷ (Average Stock Level in Period)

**Q: Can I export analytics to Excel?**
A: Not yet in v2.0. Planned for future update. For now, use browser print or screenshot.

---

## 🔧 Troubleshooting

### Stock Not Deducting Automatically

**Symptoms**: Completed service but stock unchanged

**Checks**:
1. ✅ Is item **linked** to the service? (Edit service → check links)
2. ✅ Did you mark order as **"Completed"**? (Not just paid)
3. ✅ Is linked item **required**? (Optional items may skip if low stock)
4. ✅ Check adjustment history (may have deducted but you didn't notice)

**Solution**: If bug persists, manually adjust with "Sale" type and reference order ID.

### Stock Status Badge Not Showing

**Symptoms**: Service should show low/out badge but doesn't

**Checks**:
1. ✅ Is item **linked** to service?
2. ✅ Is item truly **below threshold** or **zero stock**?
3. ✅ Are you viewing as **customer**? (Shop view doesn't show badges)
4. ✅ Refresh page (cache issue)

**Solution**: Clear browser cache or try incognito mode.

### PO Not Updating Stock

**Symptoms**: Received PO but stock didn't increase

**Checks**:
1. ✅ Did you use **"Receive Items"** button? (Just changing status doesn't update stock)
2. ✅ Did you enter **quantity received** for each item?
3. ✅ Check **adjustment history** on item (should show "purchase" entry)

**Solution**: If stock didn't update, re-open PO and receive items again, or manually adjust.

### Low Stock Email Not Sending

**Symptoms**: Alerts enabled but no email

**Checks**:
1. ✅ **Email configured** in shop settings?
2. ✅ **Alerts enabled** (toggle ON)?
3. ✅ **Items actually low**? Check inventory tab
4. ✅ **24-hour cooldown** blocking? Check "Last Alert Sent" timestamp
5. ✅ **Check spam folder**

**Solution**:
- Trigger manual check (should show results on screen even if email blocked)
- Verify email delivery logs (ask support)

### Analytics Not Loading

**Symptoms**: Charts empty or error messages

**Checks**:
1. ✅ **Wait 5-10 seconds** (large datasets take time)
2. ✅ **Check console** for errors (press F12)
3. ✅ **Try different period** (data may not exist for selected range)
4. ✅ **Refresh page**

**Solution**: Contact support if persistent, may be backend issue.

### Mobile Issues

**Symptoms**: Features don't work on mobile

**Checks**:
1. ✅ **Use latest app version** (update if available)
2. ✅ **Clear app cache**
3. ✅ **Check internet connection**
4. ✅ **Try desktop browser** (isolate if mobile-specific)

**Solution**: Report mobile-specific bugs to support with:
- Device model
- OS version
- Screenshots

---

## 📞 Getting Help

### In-App Support

1. Click **Help** icon (?) in top navigation
2. Search knowledge base
3. Submit ticket if needed

### Email Support

**support@repaircoin.com**

Include:
- Shop name
- Issue description
- Screenshots
- Steps to reproduce

**Response time**: Within 24 hours

### Video Tutorials

Visit **help.repaircoin.com/videos** for:
- Getting started with inventory
- Linking items to services
- Creating purchase orders
- Reading analytics

---

## 🎉 Pro Tips

1. **Set Realistic Thresholds**: Fast movers need higher thresholds (20-30), slow movers lower (5-10)

2. **Use Categories**: Organize items into categories for easier analytics

3. **Add Costs**: Track item costs to see true profit margins in analytics

4. **Regular Audits**: Do monthly physical counts and use "Recount" adjustment type

5. **Leverage Forecast**: Check forecast weekly, create POs for items predicted to run out in 7-14 days

6. **Optional vs Required**: Mark expensive/specialty items as "optional" in service links so stockouts don't block service

7. **PO Notes**: Always add tracking numbers and vendor contact in PO notes

8. **Bulk Orders**: Use turnover data to identify fast movers → order in bulk for better vendor pricing

9. **Dead Stock**: Use analytics to find items not sold in 90+ days → discount or discontinue

10. **Mobile App**: Download RepairCoin mobile app for quick stock checks on the go

---

**Need More Help?** Contact our support team anytime!

**Happy Selling!** 🚀

---

**Guide Version**: 1.0
**Last Updated**: May 14, 2026
**Applies to**: Inventory v2.0
