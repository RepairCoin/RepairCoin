# Quick Start Guide - Shop Automated Reports
## For Zeff - Next Priority Implementation

**Created:** April 22, 2026
**Status:** Ready to Start
**Timeline:** Today (Frontend) + Tomorrow (Backend)

---

## 🎯 What We're Building

3 automated email reports for shops:
1. **Daily Digest** - End-of-day summary (bookings, revenue, reviews)
2. **Weekly Report** - Week performance with trends
3. **Monthly Report** - Comprehensive monthly insights

---

## 📅 Implementation Order

### **TODAY (April 22) - Frontend Only**
Focus: Build the UI and settings page (NO backend work today)

### **TOMORROW (April 23) - Backend Only**
Focus: Implement data aggregation, email methods, and scheduler

---

## 🚀 TODAY'S TASKS (Frontend)

### Task 1: Add "Reports" to Sidebar (15 min)
**File:** `frontend/src/components/shop/ShopSidebar.tsx` (or similar)

Add new menu item:
```tsx
{
  icon: <BarChartIcon />,
  label: "Reports",
  path: "/shop/reports",
  badge: "New"
}
```

### Task 2: Create Reports Settings Page (2-3 hours)
**File (New):** `frontend/src/components/shop/ReportsSettings.tsx`

**What to build:**
- 3 cards (one per report type)
- Each card has:
  - Title and description
  - Toggle switch (ON/OFF)
  - Configuration options (show when enabled)
  - Preview button
  - Send test email button
  - Last sent timestamp

**Card 1 - Daily Digest:**
- Toggle: ON/OFF
- Time picker: When to send (default 6:00 PM)
- Last sent: "Today at 6:00 PM"

**Card 2 - Weekly Report:**
- Toggle: ON/OFF
- Day dropdown: Monday/Tuesday/etc (default Monday)
- Last sent: "Monday, Apr 15 at 9:00 AM"

**Card 3 - Monthly Report:**
- Toggle: ON/OFF
- Day input: 1-28 (default 1st)
- Last sent: "April 1, 2026 at 9:00 AM"

### Task 3: Create Preview Modal (1 hour)
**File (New):** `frontend/src/components/shop/ReportPreviewModal.tsx`

**Features:**
- Show sample email with mock data
- Desktop/Mobile tabs
- Close button

### Task 4: Create API Service (30 min)
**File (New):** `frontend/src/services/reportsService.ts`

```typescript
// GET report settings
export const getReportSettings = async () => {
  return await axios.get('/api/shops/reports/settings');
};

// UPDATE report settings
export const updateReportSettings = async (settings: ReportSettings) => {
  return await axios.put('/api/shops/reports/settings', settings);
};

// PREVIEW report
export const previewReport = async (type: 'daily' | 'weekly' | 'monthly') => {
  return await axios.post(`/api/shops/reports/preview/${type}`);
};

// SEND test email
export const sendTestReport = async (type: string, email: string) => {
  return await axios.post(`/api/shops/reports/test/${type}`, { recipientEmail: email });
};
```

### Task 5: Wire Everything Together (30 min)
- Connect components to API service
- Add loading states
- Add error handling
- Test toggle switches
- Test save functionality

---

## 📱 UI Design Reference

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
│ │                                              │ │
│ │ ▼ Configuration                              │ │
│ │   Send every: [Monday ▼]                    │ │
│ │   Last sent: Monday, Apr 15 at 9:00 AM     │ │
│ │   [Preview] [Send Test Email]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📅 Monthly Report                  [Toggle] │ │
│ │ Comprehensive monthly insights               │ │
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

---

## 🎨 Design Tokens

**Colors:**
- Primary (brand): `#FFCC00`
- Toggle ON: `#FFCC00`
- Toggle OFF: `#CCCCCC`
- Card background: `#FFFFFF`
- Card border: `#E0E0E0`
- Text primary: `#333333`
- Text secondary: `#666666`

**Spacing:**
- Card padding: `24px`
- Card gap: `16px`
- Section gap: `32px`

**Icons:**
- Daily: 📊 (or `<BarChartIcon />`)
- Weekly: 📈 (or `<TrendingUpIcon />`)
- Monthly: 📅 (or `<CalendarIcon />`)

---

## 🧪 Testing Checklist (Today)

Frontend only (backend will return 404 or mock data):

- [ ] Sidebar shows "Reports" menu item
- [ ] Clicking "Reports" navigates to new page
- [ ] Page loads without errors
- [ ] All 3 cards render properly
- [ ] Toggle switches work (ON/OFF)
- [ ] Configuration sections show/hide based on toggle
- [ ] Time picker works for daily digest
- [ ] Day dropdown works for weekly report
- [ ] Day input works for monthly report (validates 1-28)
- [ ] Preview button opens modal
- [ ] Modal shows sample data
- [ ] Modal can be closed
- [ ] Send test email button shows input dialog
- [ ] Save button exists and has loading state
- [ ] Page is responsive on mobile
- [ ] Page works on tablet
- [ ] Page works on desktop

**NOTE:** Backend endpoints will fail today (404) - that's expected! We'll implement them tomorrow.

---

## 🔧 TOMORROW'S TASKS (Backend Preview)

Don't start these today - just FYI:

1. Create `ShopMetricsService` - Calculate stats from DB
2. Add 3 methods to `EmailService` - Generate email HTML
3. Create `ReportSchedulerService` - Schedule automated sends
4. Add 4 API endpoints - Handle frontend requests
5. Wire scheduler to existing cron job
6. Test end-to-end

---

## 📂 Files You'll Create Today

```
frontend/
├── src/
│   ├── components/
│   │   └── shop/
│   │       ├── ReportsSettings.tsx        (NEW - Main page)
│   │       ├── ReportPreviewModal.tsx     (NEW - Preview popup)
│   │       └── ShopSidebar.tsx            (MODIFY - Add menu item)
│   └── services/
│       └── reportsService.ts              (NEW - API calls)
```

**Total estimated lines:** ~500-700 lines of code

---

## 🚨 Important Notes

### Mock Data for Testing Today
Since backend isn't ready, use this mock data in your components:

```typescript
const mockReportSettings = {
  dailyDigest: {
    enabled: false,
    sendTime: "18:00",
    lastSent: null
  },
  weeklyReport: {
    enabled: false,
    dayOfWeek: "monday",
    lastSent: null
  },
  monthlyReport: {
    enabled: false,
    dayOfMonth: 1,
    lastSent: null
  }
};
```

### API Endpoints (Will be 404 today)
```
GET    /api/shops/reports/settings
PUT    /api/shops/reports/settings
POST   /api/shops/reports/preview/:type
POST   /api/shops/reports/test/:type
```

### Shadcn Components to Use
Check these in your shadcn library:
- `<Card>` - For report cards
- `<Switch>` - For toggles
- `<Select>` - For dropdowns
- `<Input>` - For day number
- `<Button>` - For actions
- `<Dialog>` - For preview modal
- `<Label>` - For form labels

---

## 💡 Tips for Implementation

1. **Start with skeleton:** Build all 3 cards with static content first
2. **Add interactivity:** Then add toggles and state management
3. **Connect API:** Finally wire up API calls (they'll fail today, that's OK)
4. **Use mock data:** Hardcode response data for testing today
5. **Mobile first:** Design for mobile, then scale up to desktop

---

## 🎯 Definition of Done (Today)

Frontend is "done" when:
- [ ] Sidebar has Reports menu item
- [ ] Reports page renders all 3 cards
- [ ] Toggles work (can turn ON/OFF)
- [ ] Configuration options show/hide
- [ ] All inputs work (time, day, date)
- [ ] Preview modal opens and closes
- [ ] Page is responsive (mobile/tablet/desktop)
- [ ] Code is clean and typed (TypeScript)
- [ ] No console errors
- [ ] Committed to git with message: `feat(shop): add automated reports settings UI`

**Don't worry about:**
- Backend API calls (tomorrow's work)
- Real data (use mock data today)
- Email sending (tomorrow's work)
- Scheduler (tomorrow's work)

---

## 📞 Questions?

If stuck, check:
1. Main implementation doc: `feature-shop-automated-reports-implementation-plan.md`
2. Existing email settings: `frontend/src/components/shop/EmailSettings.tsx`
3. Similar components in codebase for patterns

---

## 🎉 Tomorrow's Preview

Once frontend is done today, tomorrow we'll:
- Build backend services
- Make all your API calls work
- Test with real data
- Send actual test emails
- Deploy and celebrate! 🚀

---

**Good luck, Zeff! Focus on clean, simple UI today. Backend magic happens tomorrow! 💪**
