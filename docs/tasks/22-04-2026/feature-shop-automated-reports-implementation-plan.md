# Feature: Shop Automated Reports System
## Implementation Plan for Part A - Digest & Reports

**Priority:** High (Next Priority - Zeff)
**Status:** Planned
**Estimated Effort:** 1-2 days (Backend) + 0.5-1 day (Frontend)
**Created:** 2026-04-22
**Owner:** Zeff

---

## 📋 Overview

Implement 3 automated email reports for shops to provide regular business insights and performance summaries. This completes the "Digest & Reports" section of the shop email preferences, fixing 3 currently non-functional toggles.

**Current State:**
- ❌ UI toggles exist but do nothing
- ❌ DB columns exist (`daily_digest`, `weekly_report`, `monthly_report`, `weekly_report_day`, `monthly_report_day`)
- ❌ No backend implementation
- ❌ No email templates
- ❌ No scheduler integration

**Target State:**
- ✅ Daily digest sent automatically at configured time
- ✅ Weekly reports sent on shop's chosen day
- ✅ Monthly reports sent on shop's chosen date
- ✅ All preference-gated and controlled by shop toggles
- ✅ Professional HTML email templates with business metrics

---

## 🎯 Success Criteria

1. Shops receive daily digests summarizing today's activity (bookings, revenue, reviews)
2. Shops receive weekly reports with performance trends and comparisons
3. Shops receive monthly reports with comprehensive business insights
4. All emails respect preference toggles (can be turned on/off)
5. Reports contain accurate, real-time data from the database
6. Email templates are professional, mobile-responsive, and on-brand
7. Scheduler runs reliably without missing scheduled sends
8. Frontend UI clearly shows report configuration options

---

## 📅 Implementation Schedule

### **Day 1: Frontend Implementation (Today - April 22)**
- Morning: Create sidebar navigation for Reports section
- Afternoon: Build Reports settings UI with toggle controls
- Evening: Design email template previews and sample data

### **Day 2: Backend Implementation (Tomorrow - April 23)**
- Morning: Create `ShopMetricsService` for data aggregation
- Afternoon: Implement 3 email methods in `EmailService`
- Evening: Create `ReportSchedulerService` and wire to scheduler

### **Day 3: Testing & Polish (April 24)**
- Morning: End-to-end testing of all 3 report types
- Afternoon: Email template refinements and mobile testing
- Evening: Documentation and deployment prep

---

## 🎨 Frontend Implementation (TODAY)

### 1. **Sidebar Navigation Enhancement**

**File:** `frontend/src/components/shop/ShopSidebar.tsx` (or equivalent)

**Add New Menu Item:**
```tsx
{
  icon: <BarChartIcon />,
  label: "Reports",
  path: "/shop/reports",
  badge: "New"
}
```

### 2. **Reports Settings Page**

**File (New):** `frontend/src/components/shop/ReportsSettings.tsx`

**Component Structure:**
```tsx
// Three main sections:
// 1. Daily Digest Configuration
// 2. Weekly Report Configuration
// 3. Monthly Report Configuration

interface ReportSettings {
  dailyDigest: {
    enabled: boolean;
    sendTime: string; // "18:00" (6 PM local time)
  };
  weeklyReport: {
    enabled: boolean;
    dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  };
  monthlyReport: {
    enabled: boolean;
    dayOfMonth: number; // 1-28
  };
}
```

**UI Components Needed:**
- Toggle switches for enable/disable
- Time picker for daily digest send time
- Dropdown for weekly report day selection
- Number input (1-28) for monthly report day
- Preview button for each report type
- Save button with loading state

### 3. **Report Preview Modal**

**File (New):** `frontend/src/components/shop/ReportPreviewModal.tsx`

**Features:**
- Shows sample email template with mock data
- Tabs for Desktop/Mobile view
- "Send Test Email" button
- Close and "Configure" actions

### 4. **API Integration**

**File (New):** `frontend/src/services/reportsService.ts`

**API Endpoints to Call:**
```typescript
// Get current report settings
GET /api/shops/reports/settings

// Update report settings
PUT /api/shops/reports/settings

// Preview report with sample data
POST /api/shops/reports/preview/:type  // type: daily|weekly|monthly

// Send test email
POST /api/shops/reports/test/:type
```

### 5. **UI/UX Design Specifications**

**Layout:**
- Card-based layout (one card per report type)
- Each card shows:
  - Report icon and title
  - Description of what's included
  - Toggle switch (primary action)
  - Configuration options (collapsed when disabled)
  - Preview button
  - Last sent timestamp

**Visual Hierarchy:**
```
┌─────────────────────────────────────────────────┐
│ Reports & Analytics                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📊 Daily Digest                    [Toggle] │ │
│ │ Get a daily summary of your business         │ │
│ │ activity, bookings, and revenue.             │ │
│ │                                              │ │
│ │ ▼ Configuration                              │ │
│ │   Send time: [18:00 ▼] (6:00 PM)           │ │
│ │   Last sent: Today at 6:00 PM               │ │
│ │   [Preview] [Send Test Email]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📈 Weekly Report                   [Toggle] │ │
│ │ Weekly performance summary with trends       │ │
│ │ and comparisons to previous week.           │ │
│ │                                              │ │
│ │ ▼ Configuration                              │ │
│ │   Send every: [Monday ▼]                    │ │
│ │   Last sent: Monday, Apr 15 at 9:00 AM     │ │
│ │   [Preview] [Send Test Email]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📅 Monthly Report                  [Toggle] │ │
│ │ Comprehensive monthly insights and          │ │
│ │ business trends.                            │ │
│ │                                              │ │
│ │ ▼ Configuration                              │ │
│ │   Send on day: [1 ▼] of each month         │ │
│ │   Last sent: April 1, 2026 at 9:00 AM      │ │
│ │   [Preview] [Send Test Email]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Save All Settings]                              │
└─────────────────────────────────────────────────┘
```

**Color Scheme:**
- Toggle ON: Primary brand color (#FFCC00)
- Toggle OFF: Gray (#CCCCCC)
- Cards: White background with subtle shadow
- Icons: Match report type (📊 daily, 📈 weekly, 📅 monthly)

**Responsive Behavior:**
- Desktop: 3 cards in grid (or vertical stack)
- Tablet: 2 cards per row
- Mobile: Single column, stacked cards
- Configuration sections collapse on mobile by default

---

## 📧 Email Template Design Specifications

### **Template 1: Daily Digest**

**Subject:** `Your Daily Digest - {{shopName}} ({{date}})`

**Content Sections:**
1. **Header**
   - Shop logo/name
   - Date
   - Greeting: "Here's how your business performed today"

2. **Key Metrics (Card Grid)**
   ```
   ┌──────────────┬──────────────┬──────────────┐
   │ New Bookings │   Revenue    │ New Customers│
   │      12      │   $1,245     │      3       │
   │   +20% ↑     │   +15% ↑     │   +50% ↑    │
   └──────────────┴──────────────┴──────────────┘

   ┌──────────────┬──────────────┬──────────────┐
   │  Completed   │  Avg Rating  │  No-Shows    │
   │      10      │     4.8 ⭐    │      1       │
   │   Same       │   +0.2 ↑     │   -1 ↓      │
   └──────────────┴──────────────┴──────────────┘
   ```

3. **Activity Summary**
   - Total RCN issued: 150 RCN (~$15.00)
   - Reviews received: 8 (avg 4.8 stars)
   - Cancellations: 2

4. **Quick Actions**
   - [View Full Dashboard]
   - [Manage Bookings]

5. **Footer**
   - Unsubscribe link
   - RepairCoin branding

**Variables:**
```typescript
{
  shopName: string;
  date: string;
  stats: {
    newBookings: number;
    newBookingsTrend: number; // percentage change
    revenue: number;
    revenueTrend: number;
    newCustomers: number;
    newCustomersTrend: number;
    completedBookings: number;
    completedTrend: number;
    avgRating: number;
    ratingTrend: number;
    noShows: number;
    noShowsTrend: number;
    rcnIssued: number;
    rcnIssuedUsd: number;
    reviewsReceived: number;
    cancellations: number;
  };
}
```

### **Template 2: Weekly Report**

**Subject:** `Weekly Report - {{shopName}} ({{weekStart}} - {{weekEnd}})`

**Content Sections:**
1. **Header**
   - Week range
   - "Your week at a glance"

2. **Performance Overview**
   ```
   ┌────────────────────────────────────────────┐
   │ This Week         │ Last Week   │ Change   │
   ├────────────────────────────────────────────┤
   │ 45 Bookings       │ 38 Bookings │ +18.4% ↑ │
   │ $4,230 Revenue    │ $3,850      │ +9.9% ↑  │
   │ 42 Completed      │ 35          │ +20% ↑   │
   │ 4.7 ⭐ Rating     │ 4.5 ⭐      │ +4.4% ↑  │
   └────────────────────────────────────────────┘
   ```

3. **Top Performing Services** (Top 3)
   - Service name
   - Number of bookings
   - Revenue generated
   - Progress bar visualization

4. **Customer Insights**
   - New customers: 12
   - Repeat customers: 28
   - Customer satisfaction: 93%

5. **Operational Metrics**
   - Completion rate: 93% (42/45)
   - No-show rate: 4% (2/45)
   - Cancellation rate: 2% (1/45)

6. **Action Items / Recommendations**
   - "🎉 Great week! Bookings up 18%"
   - "💡 Consider promoting [Top Service]"
   - "⚠️ 2 no-shows this week - review reminder settings"

7. **Footer**

**Variables:**
```typescript
{
  shopName: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    bookingsCount: number;
    bookingsTrend: number;
    revenue: number;
    revenueTrend: number;
    completedCount: number;
    completedTrend: number;
    avgRating: number;
    ratingTrend: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
  };
  topServices: Array<{
    name: string;
    bookings: number;
    revenue: number;
    percentage: number;
  }>;
  customerInsights: {
    newCustomers: number;
    repeatCustomers: number;
    satisfactionRate: number;
  };
}
```

### **Template 3: Monthly Report**

**Subject:** `Monthly Report - {{shopName}} ({{monthLabel}})`

**Content Sections:**
1. **Header**
   - Month name
   - Executive summary

2. **Monthly Highlights**
   ```
   ┌──────────────────────────────────────────┐
   │ Total Bookings      │  195  │  +12% ↑   │
   │ Total Revenue       │ $18.5K│  +8% ↑    │
   │ New Customers       │   42  │  +25% ↑   │
   │ Customer Retention  │  78%  │  +5% ↑    │
   └──────────────────────────────────────────┘
   ```

3. **Revenue Breakdown**
   - Service revenue: $15,200
   - Average order value: $95
   - Peak booking days: Fridays, Saturdays
   - RCN issued: 1,850 RCN (~$185)

4. **Top 5 Services** (Detailed table)
   - Rank, service name, bookings, revenue, avg rating

5. **Customer Analytics**
   - Total unique customers: 156
   - First-time customers: 42 (27%)
   - Returning customers: 114 (73%)
   - Top 5 customers by visits
   - Average customer rating: 4.7 stars

6. **Performance Trends** (Line chart or sparkline visual)
   - Weekly revenue trend
   - Booking volume trend
   - Rating trend

7. **Operational Health**
   - Total completed: 182 (93%)
   - No-shows: 8 (4%)
   - Cancellations: 5 (3%)
   - Average response time: 2.5 hours

8. **Month-over-Month Comparison**
   - Side-by-side comparison with previous month
   - Key improvements highlighted
   - Areas needing attention

9. **Goals & Recommendations**
   - Suggested focus areas for next month
   - Growth opportunities
   - Optimization suggestions

10. **Footer**

**Variables:**
```typescript
{
  shopName: string;
  monthLabel: string; // "March 2026"
  stats: {
    totalBookings: number;
    bookingsTrend: number;
    totalRevenue: number;
    revenueTrend: number;
    newCustomers: number;
    newCustomersTrend: number;
    customerRetention: number;
    retentionTrend: number;
    avgOrderValue: number;
    rcnIssued: number;
    rcnIssuedUsd: number;
    peakDays: string[];
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    avgRating: number;
    avgResponseTime: number; // in hours
  };
  topServices: Array<{
    rank: number;
    name: string;
    bookings: number;
    revenue: number;
    avgRating: number;
  }>;
  topCustomers: Array<{
    name: string;
    visits: number;
    totalSpent: number;
  }>;
  weeklyTrends: Array<{
    week: string;
    revenue: number;
    bookings: number;
  }>;
}
```

---

## 🔧 Backend Implementation (TOMORROW)

### **Phase 1: Data Aggregation Service**

**File (New):** `backend/src/services/ShopMetricsService.ts`

**Purpose:** Centralized service for calculating shop performance metrics

**Methods:**
```typescript
class ShopMetricsService {
  // Daily metrics for a specific date
  async getDailyStats(shopId: string, date: string): Promise<DailyStats>;

  // Weekly metrics for date range
  async getWeeklyStats(shopId: string, weekEnd: string): Promise<WeeklyStats>;

  // Monthly metrics for full calendar month
  async getMonthlyStats(shopId: string, month: string): Promise<MonthlyStats>;

  // Helper: Calculate percentage change
  private calculateTrend(current: number, previous: number): number;

  // Helper: Get previous period data for comparison
  private async getPreviousPeriodStats(shopId: string, period: string): Promise<any>;
}
```

**Queries Needed:**
- Bookings count by date range
- Revenue sum by date range
- New customers count (first booking at this shop)
- Completed orders count
- Average rating from reviews
- No-shows count
- Cancellations count
- RCN issued sum
- Top services by bookings/revenue

**Database Tables to Query:**
- `service_orders` (main data source)
- `service_reviews` (ratings)
- `customers` (new customer detection)
- `services` (service details)
- `service_bookings` (appointment data)

### **Phase 2: Email Service Methods**

**File:** `backend/src/services/EmailService.ts`

**Add 3 New Methods:**

```typescript
/**
 * Send daily digest to shop
 */
async sendShopDailyDigest(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    date: string;
    stats: DailyStats;
  }
): Promise<boolean> {
  const subject = `Your Daily Digest - ${data.shopName} (${data.date})`;
  const html = `<!-- Daily digest template HTML -->`;

  return this.sendEmailWithPreferenceCheck(
    shopEmail,
    subject,
    html,
    shopId,
    'dailyDigest'
  );
}

/**
 * Send weekly report to shop
 */
async sendShopWeeklyReport(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    weekStart: string;
    weekEnd: string;
    stats: WeeklyStats;
    topServices: ServiceStat[];
    customerInsights: CustomerInsights;
  }
): Promise<boolean> {
  const subject = `Weekly Report - ${data.shopName} (${data.weekStart} - ${data.weekEnd})`;
  const html = `<!-- Weekly report template HTML -->`;

  return this.sendEmailWithPreferenceCheck(
    shopEmail,
    subject,
    html,
    shopId,
    'weeklyReport'
  );
}

/**
 * Send monthly report to shop
 */
async sendShopMonthlyReport(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    monthLabel: string;
    stats: MonthlyStats;
    topServices: ServiceStat[];
    topCustomers: CustomerStat[];
    weeklyTrends: WeeklyTrend[];
  }
): Promise<boolean> {
  const subject = `Monthly Report - ${data.shopName} (${data.monthLabel})`;
  const html = `<!-- Monthly report template HTML -->`;

  return this.sendEmailWithPreferenceCheck(
    shopEmail,
    subject,
    html,
    shopId,
    'monthlyReport'
  );
}
```

### **Phase 3: Report Scheduler Service**

**File (New):** `backend/src/services/ReportSchedulerService.ts`

**Purpose:** Schedule and send automated reports

**Architecture:**
```typescript
class ReportSchedulerService {
  private shopMetricsService: ShopMetricsService;
  private emailService: EmailService;
  private lastDailyRunDate: string | null = null;

  constructor() {
    this.shopMetricsService = new ShopMetricsService();
    this.emailService = new EmailService();
  }

  /**
   * Main entry point - called by scheduler every hour
   */
  async processScheduledReports(): Promise<void> {
    const now = new Date();
    const hour = now.getUTCHours();

    // Daily digests - run once per day at configured hour
    if (this.shouldRunDailyDigests(now)) {
      await this.sendDailyDigests();
    }

    // Weekly reports - run once per day, send to matching shops
    if (hour === 9) { // 9 AM UTC
      await this.sendWeeklyReports();
    }

    // Monthly reports - run once per day, send to matching shops
    if (hour === 9) { // 9 AM UTC
      await this.sendMonthlyReports();
    }
  }

  /**
   * Send daily digests to all shops with preference enabled
   */
  private async sendDailyDigests(): Promise<void> {
    // 1. Query shops with daily_digest = true AND email exists
    // 2. For each shop:
    //    - Get yesterday's stats from ShopMetricsService
    //    - Send email via EmailService
    //    - Log result
  }

  /**
   * Send weekly reports to shops where today matches their chosen day
   */
  private async sendWeeklyReports(): Promise<void> {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });

    // 1. Query shops WHERE weekly_report = true
    //    AND weekly_report_day = today AND email exists
    // 2. For each shop:
    //    - Get last 7 days stats from ShopMetricsService
    //    - Get previous 7 days for comparison
    //    - Send email via EmailService
    //    - Log result
  }

  /**
   * Send monthly reports to shops where today matches their chosen day
   */
  private async sendMonthlyReports(): Promise<void> {
    const dayOfMonth = new Date().getDate();

    // 1. Query shops WHERE monthly_report = true
    //    AND monthly_report_day = dayOfMonth AND email exists
    // 2. For each shop:
    //    - Get last full month stats from ShopMetricsService
    //    - Get previous month for comparison
    //    - Send email via EmailService
    //    - Log result
  }

  /**
   * Check if daily digests should run now
   */
  private shouldRunDailyDigests(now: Date): boolean {
    const currentDate = now.toISOString().split('T')[0];
    const hour = now.getUTCHours();
    const targetHour = parseInt(process.env.DAILY_DIGEST_HOUR_UTC || '18', 10);

    // Run once per day at target hour
    if (hour === targetHour && this.lastDailyRunDate !== currentDate) {
      this.lastDailyRunDate = currentDate;
      return true;
    }

    return false;
  }
}
```

### **Phase 4: Scheduler Integration**

**File:** `backend/src/app.ts` (or wherever scheduler is initialized)

**Add to Existing Scheduler:**
```typescript
import { ReportSchedulerService } from './services/ReportSchedulerService';

// Initialize service
const reportScheduler = new ReportSchedulerService();

// Add to existing hourly cron job
setInterval(async () => {
  try {
    await reportScheduler.processScheduledReports();
  } catch (error) {
    logger.error('Report scheduler failed:', error);
  }
}, 60 * 60 * 1000); // Run every hour
```

### **Phase 5: API Endpoints**

**File:** `backend/src/domains/shop/routes/reports.ts` (new)

**Endpoints:**
```typescript
// Get report settings for shop
GET /api/shops/reports/settings
Response: {
  dailyDigest: { enabled: boolean, sendTime: string },
  weeklyReport: { enabled: boolean, dayOfWeek: string },
  monthlyReport: { enabled: boolean, dayOfMonth: number }
}

// Update report settings
PUT /api/shops/reports/settings
Body: Same as GET response
Response: { success: true, message: "Settings updated" }

// Preview report with sample data
POST /api/shops/reports/preview/:type
Params: type = 'daily' | 'weekly' | 'monthly'
Response: { html: string, subject: string }

// Send test email
POST /api/shops/reports/test/:type
Params: type = 'daily' | 'weekly' | 'monthly'
Body: { recipientEmail: string }
Response: { success: true, message: "Test email sent" }
```

---

## 🗄️ Database Schema (Already Exists)

**Table:** `shop_email_preferences`

**Relevant Columns:**
```sql
daily_digest BOOLEAN DEFAULT FALSE,
weekly_report BOOLEAN DEFAULT FALSE,
weekly_report_day VARCHAR(10) DEFAULT 'monday',
monthly_report BOOLEAN DEFAULT FALSE,
monthly_report_day INTEGER DEFAULT 1 CHECK (monthly_report_day BETWEEN 1 AND 28)
```

**No migration needed** - columns already exist from previous work.

---

## 📝 Testing Checklist

### **Frontend Testing (Today)**
- [ ] Sidebar navigation shows "Reports" menu item
- [ ] Reports settings page loads without errors
- [ ] Toggle switches work for all 3 report types
- [ ] Configuration options show/hide based on toggle state
- [ ] Time picker works for daily digest
- [ ] Day dropdown works for weekly report
- [ ] Day number input works for monthly report (1-28 validation)
- [ ] Preview button opens modal with sample email
- [ ] Send test email button shows success message
- [ ] Save button updates settings and shows confirmation
- [ ] Mobile responsive - all cards stack properly
- [ ] Loading states work correctly
- [ ] Error messages display properly

### **Backend Testing (Tomorrow)**
- [ ] ShopMetricsService returns accurate data for all periods
- [ ] Daily stats calculation matches manual SQL query
- [ ] Weekly stats include proper trend calculations
- [ ] Monthly stats aggregate correctly across full month
- [ ] EmailService methods generate proper HTML templates
- [ ] All methods use sendEmailWithPreferenceCheck correctly
- [ ] Preference keys match DB columns exactly
- [ ] ReportSchedulerService runs at correct times
- [ ] Daily digests sent to all enabled shops
- [ ] Weekly reports sent only to shops matching chosen day
- [ ] Monthly reports sent only to shops matching chosen day
- [ ] No duplicate sends on same day
- [ ] Scheduler survives errors without crashing
- [ ] Test emails deliver successfully
- [ ] Preview endpoint returns proper HTML

### **Integration Testing**
- [ ] Shop toggles report ON → receives email next scheduled time
- [ ] Shop toggles report OFF → stops receiving emails
- [ ] Shop changes weekly day → receives on new day
- [ ] Shop changes monthly day → receives on new day
- [ ] Email content matches live shop data
- [ ] Trends calculate correctly vs previous period
- [ ] Top services list is accurate
- [ ] Customer insights are accurate
- [ ] Links in emails work correctly
- [ ] Unsubscribe link navigates to settings
- [ ] Mobile email rendering looks good
- [ ] Desktop email rendering looks good

---

## 🚀 Deployment Steps

### **Frontend Deployment**
1. Run `npm run build` to verify no errors
2. Test locally on `localhost:3001`
3. Commit changes with message: "feat(shop): add automated reports settings UI"
4. Push to staging branch
5. Deploy to staging environment
6. Test on staging URL
7. Merge to main and deploy to production

### **Backend Deployment**
1. Run `npm run typecheck` to verify TypeScript
2. Run `npm run lint:fix` to fix any linting issues
3. Test locally with `npm run dev`
4. Commit changes with message: "feat(backend): implement automated shop reports system"
5. Push to staging branch
6. Deploy to staging environment
7. Monitor scheduler logs for successful runs
8. Verify emails send correctly on staging
9. Merge to main and deploy to production

---

## 🔍 Monitoring & Observability

### **Metrics to Track**
- Daily digest send success rate
- Weekly report send success rate
- Monthly report send success rate
- Email delivery rate (via email provider)
- Email open rate (if tracking implemented)
- Click-through rate on dashboard links
- Average report generation time
- Scheduler execution time

### **Logging Requirements**
```typescript
// Success logs
logger.info('Daily digest sent successfully', {
  shopId,
  shopName,
  reportDate,
  stats: { bookings, revenue }
});

// Error logs
logger.error('Failed to send weekly report', {
  shopId,
  error: error.message,
  stack: error.stack
});

// Performance logs
logger.debug('Report generation completed', {
  shopId,
  reportType: 'monthly',
  executionTime: endTime - startTime,
  dataPoints: stats.totalBookings
});
```

### **Alerts to Configure**
- Alert if daily digests don't run for 48 hours
- Alert if weekly reports success rate < 95%
- Alert if monthly reports success rate < 95%
- Alert if report generation takes > 30 seconds
- Alert if email delivery failure rate > 5%

---

## 📚 Documentation Updates Needed

### **User Documentation**
1. Help article: "Understanding Your Automated Reports"
2. Help article: "Configuring Your Report Schedule"
3. FAQ entry: "Why didn't I receive my report?"
4. FAQ entry: "Can I receive reports multiple times?"

### **Developer Documentation**
1. Update API documentation with new endpoints
2. Document ShopMetricsService methods and return types
3. Add email template design guidelines
4. Document scheduler architecture and timing
5. Add troubleshooting guide for common issues

### **Admin Documentation**
1. How to monitor report delivery health
2. How to manually trigger reports for a shop
3. How to debug failed report sends
4. How to update email templates

---

## 🎁 Future Enhancements (Out of Scope for Initial Release)

### **Phase 2 Features:**
- Custom report scheduling (multiple times per day)
- Report data export to PDF/Excel
- Comparison to industry benchmarks
- Goal setting and progress tracking
- Custom metric selection (shops choose what to include)
- Report sharing with team members
- Historical report archive and search

### **Phase 3 Features:**
- AI-powered insights and recommendations
- Predictive analytics for future periods
- Automated A/B testing suggestions
- Integration with third-party analytics tools
- White-label report branding
- Multi-location report consolidation

---

## 💡 Technical Notes

### **Performance Considerations**
- Cache frequently accessed metrics (daily stats for today)
- Use database indexes on order date columns
- Batch process multiple shops in parallel (max 10 concurrent)
- Limit query complexity for large shops (> 10,000 orders)
- Implement query timeout protection (30 seconds max)

### **Scalability Considerations**
- Move scheduler to separate service in future if needed
- Use message queue for large-scale report generation
- Implement rate limiting on email sends (max 100/minute)
- Consider using read replicas for report queries
- Plan for multi-region deployment (timezone handling)

### **Security Considerations**
- Validate shop ownership before sending reports
- Sanitize all data in email templates (XSS protection)
- Rate limit API endpoints (max 10 requests/minute per shop)
- Require authentication for all report endpoints
- Log all configuration changes for audit trail

### **Timezone Handling**
- MVP: All times in UTC, converted in email display
- Phase 2: Store shop timezone preference
- Phase 3: Send reports at shop's local time

---

## 📞 Support & Rollback Plan

### **Support Preparation**
- Create support macros for common questions
- Train support team on report features
- Prepare troubleshooting flowchart
- Create sample reports for reference

### **Rollback Plan**
If critical issues arise:
1. Disable scheduler via environment variable
2. Stop sending new reports immediately
3. Investigate and fix root cause
4. Test fix on staging
5. Re-enable scheduler gradually (10% → 50% → 100%)

### **Rollback Trigger Criteria**
- Email delivery failure rate > 20%
- Database performance degradation
- Customer complaints > 10 per hour
- Incorrect data in reports (verified bug)
- Security vulnerability discovered

---

## ✅ Success Metrics (30 days post-launch)

- [ ] 60%+ shops enable at least one report type
- [ ] 95%+ email delivery success rate
- [ ] < 1% unsubscribe rate
- [ ] Average email open rate > 40%
- [ ] Dashboard click-through rate > 15%
- [ ] < 5 support tickets per week
- [ ] Zero critical bugs reported
- [ ] Positive feedback from beta shops

---

## 👥 Stakeholders & Sign-off

**Owner:** Zeff
**Reviewer:** [Tech Lead Name]
**Approver:** [Product Manager Name]
**QA Lead:** [QA Name]

**Sign-off Checklist:**
- [ ] Product requirements reviewed and approved
- [ ] Technical design reviewed by team
- [ ] UI/UX mockups approved
- [ ] Email templates approved
- [ ] Security review completed
- [ ] Privacy review completed (GDPR compliance)
- [ ] Performance testing plan approved
- [ ] Deployment plan approved

---

**Document Version:** 1.0
**Last Updated:** 2026-04-22
**Next Review:** 2026-04-23 (after frontend completion)

---

## 🔗 Related Documents

- `bug-shop-email-digest-reports-and-marketing-toggles-not-implemented.md` - Original bug report
- `qa-email-notifications-test-guide.md` - Testing procedures
- `BACKEND_UPDATE_2026-04-20.md` - Email templates implementation
- `backend/docs/plans/admin-email-templates-feature.md` - Template system design

---

**END OF DOCUMENT**
