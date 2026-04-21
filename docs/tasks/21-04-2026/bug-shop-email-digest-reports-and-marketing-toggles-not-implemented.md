# Bug: Six shop email preference toggles in "Digest & Reports" and "Marketing & Updates" are not implemented — phantom controls

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1-2 days (Part A — reports scheduler) / 3-5 days (Part B — marketing broadcast MVP) / 30 minutes (Option Z — UI removal)
**Created:** 2026-04-21
**Updated:** 2026-04-21

---

## Problem

Six shop-directed toggles in the Email Notifications settings page (`/shop?tab=settings` → Emails) have no email implementation in the backend. The preference columns exist in the database, the UI renders the toggles, the controller whitelist accepts updates — but **no code anywhere reads these preference keys to trigger emails**. Shops toggle them on or off and nothing changes in either state.

### Part A — Digest & Reports section (3 toggles, data-driven)

| Toggle | UI label | UI description | Backing email? |
|---|---|---|---|
| `dailyDigest` | Daily Digest | "Daily summary of bookings and activity" | ❌ none |
| `weeklyReport` | Weekly Report | "Weekly performance summary" (with delivery-day dropdown) | ❌ none |
| `monthlyReport` | Monthly Report | "Monthly business insights and trends" | ❌ none |

### Part B — Marketing & Updates section (3 toggles, editorial / admin-driven)

| Toggle | UI label | UI description | Backing email? |
|---|---|---|---|
| `featureAnnouncements` | Feature Announcements | "New features and improvements" | ❌ none |
| `marketingUpdates` | Marketing Tips | "Tips to grow your business" | ❌ none |
| `platformNews` | Platform News | "RepairCoin updates and newsletters" | ❌ none |

The two sub-scopes differ fundamentally:

- **Part A** emails are auto-generated summaries of shop data — same pattern as the `sendShopDailyAppointmentDigest` I recently added (uses the `appointmentReminder` key). Pure backend work.
- **Part B** emails are human-authored editorial content sent from RepairCoin to all shops. Needs new admin tooling (compose → schedule → send → track delivery). Bigger scope.

---

## Root Cause

Same failure pattern documented in `bugs/21-04-2026/bug-shop-email-toggles-without-backing-emails.md` — preference keys designed ahead of the backing feature. In that doc the scope was the Booking & Appointments section (4 Class B phantoms + 3 Class A orphan methods). This doc covers the same pattern in two additional sections.

Verified by grep across `backend/src/` on 2026-04-21:

- Each of the 6 preference keys appears 2–3 times in code: controller validation whitelist, DB column mapping, Swagger docs.
- **Zero `sendEmailWithPreferenceCheck` call sites use any of the 6 keys.**
- Zero methods in `EmailService.ts` match patterns like `send*Digest`, `send*Report`, `send*Weekly`, `send*Monthly`, `send*Announcement`, `send*MarketingTip`, `send*PlatformNews`. (The one match `sendShopDailyAppointmentDigest` uses the `appointmentReminder` key, not `dailyDigest` — different feature.)
- The DB has `weekly_report_day` (varchar) and `monthly_report_day` (integer 1–28) columns specifically to support scheduling; both are validated by `EmailPreferencesController` but never consumed by any scheduler.

Evidence the features were **designed**: DB columns, UI toggles, delivery-day config, validation. Evidence they were **implemented**: none.

---

## Evidence

| Layer | Status |
|---|---|
| Frontend UI renders toggles | ✅ exists — `frontend/src/components/shop/EmailSettings.tsx` |
| Backend accepts preference updates | ✅ exists — `EmailPreferencesController.ts` whitelist + `EmailPreferencesService.ts` DB mapping |
| DB columns store the values | ✅ exists — `shop_email_preferences` has all 6 columns plus `weekly_report_day` + `monthly_report_day` |
| `EmailService` methods to render/send | ❌ **none** |
| Trigger points (schedulers, admin endpoints) | ❌ **none** |
| `sendEmailWithPreferenceCheck` callers for these keys | ❌ **none** |

Shops on staging can freely flip these toggles; their state persists in the DB and is loaded on page render. The end-user effect is always the same — no email ever arrives, regardless of toggle position.

---

## Fix Options

Three options, modular.

### Option A (recommended for Digest & Reports — ~1-2 days)

**Implement the three scheduled-report emails.** Pattern is established; scope is bounded.

#### A1. `sendShopDailyDigest` — broader than tomorrow's appointments

Different from the existing `sendShopDailyAppointmentDigest` (which covers only next-day appointments, gated on `appointmentReminder`). Daily Digest covers today's shop activity:

- New bookings received today
- Bookings completed today
- Revenue today
- Reviews received today
- Any no-shows today

Method signature:
```ts
async sendShopDailyDigest(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    date: string;
    stats: {
      newBookings: number;
      completedBookings: number;
      revenue: number;          // USD total from today's completed orders
      rcnIssued: number;        // RCN minted from today's completions
      newCustomers: number;
      reviewsReceived: number;
      avgRatingToday: number | null;
      noShowsRecorded: number;
    };
  }
): Promise<boolean>;
```

Gated on `dailyDigest` preference key. Called from the same hourly `processReminders` loop, guarded by the `DAILY_DIGEST_HOUR_UTC` env var I already added + a new per-process `lastDailyDigestDate` flag (parallel to `lastShopDigestDate`).

#### A2. `sendShopWeeklyReport` — weekly performance summary

Delivered once per week on the shop's configured `weekly_report_day` (stored as `monday`, `tuesday`, etc.). Covers the last 7 days. Metrics similar to daily digest but weekly totals plus week-over-week comparisons.

Method:
```ts
async sendShopWeeklyReport(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    weekStart: string;
    weekEnd: string;
    stats: {
      bookingsCount: number;
      bookingsTrend: number;    // +/- percentage vs prior week
      revenue: number;
      revenueTrend: number;
      completionRate: number;   // completed / (completed + no_show + cancelled)
      topService: string | null;
      topServiceBookings: number;
      avgRating: number | null;
      reviewsCount: number;
    };
  }
): Promise<boolean>;
```

Gated on `weeklyReport`. Delivery scheduled by checking `shop_email_preferences.weekly_report_day === current day of week` in the scheduler loop.

#### A3. `sendShopMonthlyReport` — monthly business insights

Delivered once per month on the shop's configured `monthly_report_day` (integer 1–28). Covers the previous full calendar month. Heavier analytics:

- All metrics from weekly
- Plus: top 5 services by revenue, top 5 customers by repeat visits, tier-bonus distribution, no-show trend, refund rate

Method:
```ts
async sendShopMonthlyReport(
  shopEmail: string,
  shopId: string,
  data: {
    shopName: string;
    monthLabel: string;  // e.g. "March 2026"
    stats: { /* ...as above... */ };
  }
): Promise<boolean>;
```

Gated on `monthlyReport`. Scheduled on `shop_email_preferences.monthly_report_day === today's day of month`.

#### A4. Shared aggregation helper

Most of the numbers above are already computed somewhere — the admin analytics dashboard aggregates similar metrics. Extract a `ShopMetricsService` that takes a shop_id + date range and returns the stats object. Reuse across A1, A2, A3, and the existing admin dashboard where possible.

#### A5. Scheduler wiring

Add three new methods to `AppointmentReminderService` (or a new `ReportSchedulerService` — cleaner separation):
- `sendDailyDigests()` — fires every day at configured UTC hour
- `sendWeeklyReports()` — fires once per day, sends only to shops whose `weekly_report_day` matches today's day-of-week
- `sendMonthlyReports()` — fires once per day, sends only to shops whose `monthly_report_day` matches today's day-of-month

All three called from the existing hourly `processReminders` loop with internal hour-of-day + date-of-run guards (same pattern as `sendDailyShopDigests`).

**Effort:** ~1-2 days for all three reports + shared helper. Each report is ~3 hours of queries + template + wiring. Guard logic + scheduler hookup is ~2 hours shared.

### Option B (for Marketing & Updates — 3-5 days MVP)

**Build a platform broadcast tool.** Admin composes a message, system fans out to all shops with the matching preference toggle ON.

Fundamentally different from A — these are editorial emails, not data-driven. Needs admin UI + authoring workflow, not just a scheduler.

#### B1. New DB tables

```sql
-- backend/migrations/XXX_create_platform_broadcasts.sql
CREATE TABLE platform_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'feature_announcement', 'marketing_tip', 'platform_news'
  )),
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
  )),
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  emails_suppressed INTEGER DEFAULT 0,  -- preference-off
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE platform_broadcast_recipients (
  id SERIAL PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES platform_broadcasts(id) ON DELETE CASCADE,
  shop_id VARCHAR(100) NOT NULL,
  shop_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
    -- pending, sent, failed, suppressed_by_preference
  sent_at TIMESTAMP,
  error_message TEXT,
  UNIQUE(broadcast_id, shop_id)
);

CREATE INDEX idx_platform_broadcasts_status ON platform_broadcasts(status);
CREATE INDEX idx_platform_broadcasts_scheduled ON platform_broadcasts(scheduled_at)
  WHERE status = 'scheduled';
```

#### B2. New service — `PlatformBroadcastService`

```ts
// backend/src/services/PlatformBroadcastService.ts
class PlatformBroadcastService {
  async create(data: {
    category: 'feature_announcement' | 'marketing_tip' | 'platform_news';
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    scheduledAt?: Date;
    createdBy: string;  // admin wallet
  }): Promise<string>;  // returns broadcastId

  async updateDraft(broadcastId: string, updates: Partial<...>): Promise<void>;
  async schedule(broadcastId: string, scheduledAt: Date): Promise<void>;
  async cancel(broadcastId: string): Promise<void>;
  async sendNow(broadcastId: string): Promise<BroadcastResult>;
  async getStatus(broadcastId: string): Promise<BroadcastDetail>;

  // Scheduler calls this; picks up due broadcasts and sends them
  async processScheduled(): Promise<{ processed: number }>;

  private async loadRecipients(category): Promise<Array<{shopId: string; email: string}>> {
    // Category → preference key
    const prefKey = {
      'feature_announcement': 'featureAnnouncements',
      'marketing_tip': 'marketingUpdates',
      'platform_news': 'platformNews',
    }[category];

    // Active shops with email, where this preference = true
    // (preference check is redundant with sendEmailWithPreferenceCheck's
    // own gate, but filtering here avoids querying recipients we know
    // won't receive the email)
    return this.repo.getActiveShopsWithPreference(prefKey);
  }

  private async deliverOne(broadcast, recipient): Promise<boolean> {
    return emailService.sendPlatformBroadcast(
      recipient.email,
      recipient.shopId,
      { subject: broadcast.subject, bodyHtml: broadcast.bodyHtml },
      broadcast.category === 'feature_announcement' ? 'featureAnnouncements' :
      broadcast.category === 'marketing_tip' ? 'marketingUpdates' : 'platformNews'
    );
  }
}
```

#### B3. New EmailService method

Single generic method parameterised by preference key:

```ts
// backend/src/services/EmailService.ts
async sendPlatformBroadcast(
  shopEmail: string,
  shopId: string,
  data: { subject: string; bodyHtml: string },
  preferenceKey: 'featureAnnouncements' | 'marketingUpdates' | 'platformNews'
): Promise<boolean> {
  // Could wrap bodyHtml with standard RepairCoin header/footer + unsubscribe link here
  return this.sendEmailWithPreferenceCheck(
    shopEmail, data.subject, data.bodyHtml, shopId, preferenceKey
  );
}
```

#### B4. Admin routes

```
POST   /api/admin/broadcasts             (create draft)
GET    /api/admin/broadcasts             (list with filters)
GET    /api/admin/broadcasts/:id         (detail + delivery stats)
PATCH  /api/admin/broadcasts/:id         (edit draft only)
POST   /api/admin/broadcasts/:id/send    (send now)
POST   /api/admin/broadcasts/:id/schedule (body: { scheduledAt })
POST   /api/admin/broadcasts/:id/cancel  (cancel scheduled)
DELETE /api/admin/broadcasts/:id         (delete draft)
```

Guard with admin-wallet middleware (pattern exists in `admin` domain).

#### B5. Admin UI

New tab under admin settings: "Broadcasts". Three panes:

- **Compose:** category selector + subject + HTML editor (reuse `EmailTemplateEditor` component). Buttons: Save draft / Send now / Schedule.
- **List:** table of all broadcasts with status, scheduled time, sent counts.
- **Detail:** single broadcast's delivery stats (N sent / N failed / N suppressed-by-preference), recipient breakdown, optional resend for failed recipients.

#### B6. Scheduler hookup

Add to the hourly `processReminders` loop:
```ts
try {
  await platformBroadcastService.processScheduled();
} catch (err) {
  logger.error('Platform broadcast scheduler failed:', err);
}
```

`processScheduled` picks up any broadcasts with `status = 'scheduled' AND scheduled_at <= NOW()` and fires `sendNow` on them.

#### B7. Unsubscribe / compliance

Required before launching to real shops at volume (CAN-SPAM-equivalent):

- Every broadcast email gets a footer with a "Manage email preferences" link deep-linking to `/shop?tab=settings&section=emails`
- Optional: per-category unsubscribe ("I don't want marketing tips")
- Audit log for unsubscribe actions

**Effort:**
- B1–B4 (backend foundation, admin can drive via curl): ~2 days
- B5 (admin UI): ~1-2 days
- B6 (scheduler): ~0.5 day
- B7 (compliance polish): ~0.5-1 day

Total MVP: 3-5 days. Full production-ready with compliance: 5-7 days.

### Option Z — Remove the 6 toggles from the UI (~30 minutes)

Short-term band-aid if the team can't prioritise Parts A and B this sprint. Hide the 6 broken toggles from `EmailSettings.tsx`. Keep DB columns, backend whitelist, Zod types — removing them is more painful than leaving them dormant.

Removal locations — see `frontend/src/components/shop/EmailSettings.tsx` for the current toggle definitions block. Delete the 6 entries, keep remaining working ones.

**Pros:** ~30-minute change. Makes the UI truthful.
**Cons:** Shops lose visibility into features they may have been expecting. The dormant DB columns are a code smell until removed.

### Recommended path

**Part A now, Part B next sprint, skip Part Z.**

Part A is a natural extension of the reporting work already in the codebase (shop analytics, appointment digest). Pattern is proven and the effort is bounded. Ships three valuable features in ~2 days.

Part B is a real feature build with admin tooling. Worth doing but needs product/design input on the admin UX, editorial workflow, and compliance requirements. Better scoped as its own sprint rather than squeezed alongside Part A.

Option Z only if neither A nor B fits in the current cycle and the product owner wants to clear the UI-lie in the meantime.

---

## Files to Modify

### Part A — Reports (~1-2 days)

| File | Action |
|------|--------|
| `backend/src/services/ShopMetricsService.ts` (new) | Reusable aggregator: `getDailyStats(shopId, date)`, `getWeeklyStats(shopId, weekEnd)`, `getMonthlyStats(shopId, month)` |
| `backend/src/services/EmailService.ts` | Add `sendShopDailyDigest`, `sendShopWeeklyReport`, `sendShopMonthlyReport` (all use `sendEmailWithPreferenceCheck` with the respective keys) |
| `backend/src/services/ReportSchedulerService.ts` (new — or extend `AppointmentReminderService`) | `sendDailyDigests()`, `sendWeeklyReports()`, `sendMonthlyReports()` — each with hour-of-day + date-guard internal gating |
| Existing hourly scheduler (`app.ts` startup or `processReminders`) | Call the three new dispatch methods |
| Email templates (3 new) | HTML templates for each report |

### Part B — Marketing broadcast (~3-5 days)

| File | Action |
|------|--------|
| `backend/migrations/XXX_create_platform_broadcasts.sql` (new) | Two tables as above |
| `backend/src/services/PlatformBroadcastService.ts` (new) | CRUD + send + scheduler processor |
| `backend/src/repositories/PlatformBroadcastRepository.ts` (new) | DB layer |
| `backend/src/services/EmailService.ts` | Add `sendPlatformBroadcast` generic method (accepts preference key as param) |
| `backend/src/domains/admin/routes/broadcasts.ts` (new) | 7 admin endpoints |
| `frontend/src/components/admin/tabs/BroadcastsContent.tsx` (new) | Admin UI — list + detail |
| `frontend/src/components/admin/tabs/BroadcastComposer.tsx` (new) | Compose + send/schedule (can reuse `EmailTemplateEditor` for the HTML body) |
| Existing hourly scheduler | Call `platformBroadcastService.processScheduled()` |

### Option Z — UI removal (~30 minutes)

| File | Action |
|------|--------|
| `frontend/src/components/shop/EmailSettings.tsx` | Remove the 6 toggle entries (3 in Digest & Reports section, 3 in Marketing & Updates). Keep section headers? Or remove entire sections if no working toggles remain — depends on whether any other toggles live under those sections. |

---

## Verification Checklist

### Part A — Reports

- [ ] **Daily Digest ON:** manually trigger `sendDailyDigests` (e.g. set `DAILY_DIGEST_HOUR_UTC` to current hour), confirm shop receives one email summarising today's activity with accurate numbers (cross-check against a manual SQL query for the same day).
- [ ] **Daily Digest OFF:** same trigger, no email arrives.
- [ ] **Weekly Report:** configure a test shop's `weekly_report_day = 'monday'`. On a Monday, scheduler fires; shop receives summary of the prior 7 days. Change day to Tuesday → no email until the following Tuesday.
- [ ] **Monthly Report:** configure `monthly_report_day = 1`. On the 1st of the month, scheduler fires for that shop. Report covers the previous full calendar month.
- [ ] **Shop with 0 activity:** no bookings/revenue/reviews/etc. Daily digest should either skip the send entirely (preferred) or render a minimal "no activity today" version. Pick one and stick with it.
- [ ] **Empty month edge case:** month has no bookings, monthly report either sends a minimal report or skips. Document choice.
- [ ] **Multi-shop idempotency:** two shops with the same `weekly_report_day`. Both receive their own report, not each other's. Weekly scheduler iterates shop-by-shop.
- [ ] **Numbers match admin analytics:** spot-check a few numbers in the report against the corresponding admin dashboard metric for the same shop + time window. If they diverge, the aggregation logic is wrong.
- [ ] **`weekly_report_day` and `monthly_report_day` dropdowns:** edit from UI, confirm next scheduler run respects new values.

### Part B — Broadcasts

- [ ] **Compose + send now:** admin creates a Feature Announcement, clicks Send Now. Email arrives at every shop with `feature_announcements = true` and a valid email. Count matches total recipient count.
- [ ] **Preference suppression:** one test shop has `feature_announcements = false`. Their row in `platform_broadcast_recipients` shows status `suppressed_by_preference`; no email sent; the broadcast's `emails_suppressed` counter increments.
- [ ] **Compose + schedule:** create a draft with `scheduledAt = now + 2 minutes`. Don't click Send. Wait 2 minutes. Scheduler processes it automatically. All recipients receive the email. Status transitions draft → scheduled → sending → sent.
- [ ] **Cancel scheduled:** create a scheduled broadcast, cancel it before its send time. Status transitions to `cancelled`. Scheduler skips it when due time passes.
- [ ] **All three categories:** test `feature_announcement`, `marketing_tip`, `platform_news` separately. Each filters recipients by the correct preference key.
- [ ] **Draft editing:** admin can edit subject/body while status is `draft`; locked once status is `scheduled` or later.
- [ ] **Send-to-no-one edge case:** all shops have the relevant toggle off. Broadcast sends, but `emails_sent = 0, emails_suppressed = N`. Admin sees this in the detail view. No error.
- [ ] **Admin-only access:** non-admin wallet attempting any `/api/admin/broadcasts/*` route gets 403.
- [ ] **Unsubscribe link present:** sent email HTML contains a "Manage email preferences" link deep-linking to `/shop?tab=settings` (prerequisite for compliance).
- [ ] **Audit trail:** delivery stats persist correctly — total, sent, failed, suppressed. Viewable in admin UI even for sends from weeks ago.

### Option Z — UI removal

- [ ] `/shop?tab=settings` → Emails no longer renders the 6 phantom toggles. Remaining working toggles still save/load.
- [ ] No DB migration run; existing preference rows keep the hidden columns untouched.
- [ ] Backend whitelist unchanged; older clients sending these keys don't break.

---

## Notes

- **Related docs:**
  - `bugs/21-04-2026/bug-shop-email-toggles-without-backing-emails.md` — sibling doc covering the Booking & Appointments + Financial sections (8 toggles, 7 broken). Same phantom-toggle failure mode. That doc's Option 1A + 1B have already been applied; 11 of 12 toggles in those sections now work (Appointment Reminder digest via `sendShopDailyAppointmentDigest` shipped in the same batch).
  - `test/qa-email-notifications-test-guide.md` — QA guide. Will need a new section covering these 6 toggles; current guide's Section 5 only covers the Class B phantoms in Booking & Appointments.
  - Migration 105 (`backend/migrations/105_create_email_templates.sql`) and `EmailTemplateService` — groundwork for templated emails. Relevant to Part B if the team wants reusable templates for broadcasts rather than inline body.
  - `backend/migrations/042_create_marketing_campaigns.sql` and `MarketingService` — existing shop→customer marketing pipeline. Reusable *patterns* for Part B (send loop, recipient tracking, delivery status) but the audience model is different (shop-as-sender vs platform-as-sender) so it's not a drop-in.
- **Why Medium not High:** no broken existing functionality, no data-integrity risk. Trust/UX issue where the UI promises features that don't exist. Upgrade to High if shop-retention analytics show shops abandoning over missing expected comms, or if product flags these as key differentiators.
- **Digest vs existing `sendShopDailyAppointmentDigest`:** Part A's Daily Digest is broader in scope. The existing appointment-reminder digest covers only tomorrow's appointment list (gated on `appointmentReminder`). Daily Digest covers today's full shop activity (gated on `dailyDigest`). Shops could reasonably want both — appointment-reminder in the evening before their shift, daily digest at end-of-day summarising what actually happened.
- **Timezone handling** (same caveat as the appointment-reminder digest):
  - MVP: single UTC-anchored hour for all shops.
  - Shops in different timezones receive at varying local hours (6am for Asia, afternoon for Americas).
  - Upgrade path once per-shop timezone is populated: `WHERE shop.timezone_now_is_digest_hour`.
- **Multi-instance deploy limitation** (same caveat as before): in-memory `lastRunDate` flags are per-process. Multi-instance prod deploys need a DB-backed lock. Not blocking for MVP; file as a hardening follow-up if prod runs multiple instances.
- **Compliance note for Part B:** platform-to-all-shops messaging for marketing content is arguably a CAN-SPAM-like scenario. An unsubscribe link is table stakes before launching to real shops at scale. Transactional content (Feature Announcements describing a feature the shop is using) is less fraught than pure marketing content (Marketing Tips, Platform News). Product + legal should review Part B content categories before Feature Announcements goes to Option 1B-level broadcast scale.
- **Out of scope for this task:**
  - Open/click tracking on broadcast emails.
  - Segmentation ("only shops in country X", "only Elite-tier shops"). MVP sends to all shops with the toggle ON; segmentation is a follow-up enhancement.
  - A/B testing of subject lines or body content.
  - Rich scheduling calendar UI (natural-language scheduling like "every Monday at 9am"). MVP is just "send now" or "send at this absolute timestamp."
  - Full audit of admin who sent what (for Part B) — basic audit is in `platform_broadcasts.created_by`; richer admin-action log is a separate observability task.
  - Consolidation with existing `marketing_campaigns` infrastructure into a unified messaging layer. Possible future cleanup if both campaign types stabilise.
