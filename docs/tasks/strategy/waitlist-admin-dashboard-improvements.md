# Strategy: Waitlist Admin Dashboard Improvements

## Date: 2026-03-17

## Context

The admin waitlist dashboard (`/admin?tab=waitlist`) is functional with stat cards, campaign performance metrics, filters, and a table with entry management. Owner feedback (see `waitlist-tips.txt`) identified several areas to elevate it from "good" to "enterprise-grade growth command center."

This strategy addresses each tip with concrete implementation tasks mapped to the existing codebase.

---

## Current State Summary

**What exists today:**
- 4 KPI cards: Total Entries, Pending, Shops, Last 24 Hours
- Campaign Performance row: source, visits, signups, conversion rate
- 4 filters: status, userType, inquiryType, source
- Table with 7 columns: Email, Type, Source, Inquiry, Status, Joined, Actions (Update/Delete)
- Update modal with status dropdown and notes textarea
- Delete with confirmation
- "View Public Page" button

**Key files:**
- Frontend: `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` (542 lines)
- Backend Controller: `backend/src/controllers/WaitlistController.ts` (261 lines)
- Backend Repository: `backend/src/repositories/WaitlistRepository.ts` (330 lines)
- Database: `waitlist` table + `waitlist_page_views` table

---

## Improvement Plan

### Phase 1: Critical Fixes (High Priority)

#### 1.1 Fix CVR (Conversion Rate) Calculation
**Problem:** CVR shows 200% when signups > visits due to misaligned counters (visits counted as sessions, signups as total submissions including direct links/shares without tracked visits).

**Fix:**
- **Backend** (`WaitlistRepository.ts` - `getStats()` method):
  - Use `COUNT(DISTINCT email)` for unique signups per source
  - Use `COUNT(DISTINCT ...)` or deduplicate visits by session/IP
  - Cap CVR at 100% as a safeguard: `LEAST((signups::float / NULLIF(visits, 0)) * 100, 100)`
  - Return `null` instead of a number when visits = 0
- **Frontend** (`AdminWaitlistTab.tsx` - Campaign Performance section):
  - Show "—" when `conversionRate` is `null` or visits = 0
  - Add tooltip on hover: "CVR = unique signups / unique visits"

**Files to modify:**
| File | Change |
|------|--------|
| `backend/src/repositories/WaitlistRepository.ts` | Fix `getStats()` campaign performance query |
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Handle null CVR, add tooltip |

---

#### 1.2 Rename "Staking Waitlist" to "Waitlist & Demos"
**Problem:** The title "Staking Waitlist" is misleading since this page handles both platform waitlist signups and demo requests, not just RCG staking.

**Fix:**
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Change title from "Staking Waitlist" to "Waitlist & Demos"
  - Change subtitle from "Manage users interested in RCG staking" to "Manage leads, demo requests, and waitlist signups"

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Update title and subtitle text |

---

### Phase 2: KPI & Stats Enhancements (High Priority)

#### 2.1 Split 24h Card into Demo Requests vs Waitlist Signups
**Problem:** The single "Last 24 Hours" card doesn't differentiate between demo requests (high priority, need follow-up) and waitlist signups.

**Fix:**
- **Backend** (`WaitlistRepository.ts` - `getStats()`):
  - Add two new fields to stats response:
    - `demoRequests24h`: count where `inquiry_type = 'demo' AND created_at >= NOW() - INTERVAL '24 hours'`
    - `waitlistSignups24h`: count where `inquiry_type = 'waitlist' AND created_at >= NOW() - INTERVAL '24 hours'`
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Replace single "Last 24 Hours" card with two cards:
    - "Demo Requests (24h)" — orange/red gradient (urgent feel)
    - "Waitlist Signups (24h)" — green gradient
  - Total card count goes from 4 to 5 (adjust grid to `grid-cols-5` on large screens, wrap on mobile)

**Files to modify:**
| File | Change |
|------|--------|
| `backend/src/repositories/WaitlistRepository.ts` | Add `demoRequests24h` and `waitlistSignups24h` to stats query |
| `backend/src/controllers/WaitlistController.ts` | Pass new fields through response |
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Split card, adjust grid layout |

---

### Phase 3: Lead Quality Fields (Medium Priority)

#### 3.1 Add Business Category Field
**Problem:** No way to segment leads by industry/category for targeted follow-up.

**Fix:**
- **Database migration** (new file `backend/migrations/XXX_add_waitlist_lead_fields.sql`):
  ```sql
  ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS business_category VARCHAR(50);
  ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS city VARCHAR(100);
  CREATE INDEX IF NOT EXISTS idx_waitlist_business_category ON waitlist(business_category);
  ```
- **Backend** (`WaitlistRepository.ts`):
  - Add `business_category` and `city` to `create()`, `getAll()`, `getStats()`
  - Add `businessCategory` filter option to `getAll()`
- **Backend** (`WaitlistController.ts`):
  - Accept `businessCategory` and `city` in `submitWaitlist()`
  - Accept `businessCategory` filter in `getWaitlistEntries()`
- **Frontend waitlist form** (`WaitlistTemplate.tsx`):
  - Add optional dropdown: "What type of business?" with options: Repair, Barber, Nails, Gym, Restaurant, Other
  - Add optional text input: "City / State"
- **Frontend admin** (`AdminWaitlistTab.tsx`):
  - Add "Category" column to table between Type and Source
  - Add "Category" filter dropdown
  - Show category in stats breakdown

**Dropdown options for business_category:**
| Value | Label |
|-------|-------|
| `repair` | Auto Repair |
| `barber` | Barber / Salon |
| `nails` | Nail Salon |
| `gym` | Gym / Fitness |
| `restaurant` | Restaurant |
| `retail` | Retail |
| `other` | Other |

**Files to modify:**
| File | Change |
|------|--------|
| `backend/migrations/XXX_add_waitlist_lead_fields.sql` | New migration |
| `backend/src/repositories/WaitlistRepository.ts` | Add fields to CRUD + filters |
| `backend/src/controllers/WaitlistController.ts` | Accept new fields |
| `frontend/src/components/waitlist/WaitlistTemplate.tsx` | Add form fields |
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Add column + filter |

---

### Phase 4: Table Actions Workflow (Medium Priority)

#### 4.1 Replace Generic Actions with Workflow-Specific Actions
**Problem:** "Update" and "Delete" buttons are too generic and don't match the admin's actual workflow.

**Fix:**
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Replace the two-button action column with a dropdown menu (using shadcn `DropdownMenu`):
    - **View** — Opens a read-only detail modal showing all entry data
    - **Mark Contacted** — Quick-action: sets status to "contacted" with one click
    - **Mark Booked** — Quick-action: sets status to "approved" (representing a booked demo)
    - **Archive** — Sets status to "rejected" (soft archive, entry stays in DB)
    - **Delete** — Only for spam, behind confirmation modal (keep existing logic)
  - Add a "View" detail modal that shows: email, type, source, inquiry, status, joined date, notes, last updated
- **Backend**: No changes needed — existing `PUT /waitlist/:id/status` endpoint handles all status updates

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Replace action buttons with dropdown, add View modal |

---

### Phase 5: Export & Assignment (Low Priority)

#### 5.1 CSV Export for Filtered Results
**Problem:** No way to export leads for external tools (CRM, email campaigns, spreadsheets).

**Fix:**
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Add "Export CSV" button next to the filter row
  - Uses current filter state to export only visible/filtered entries
  - Client-side CSV generation from the already-fetched `entries` array
  - Columns: Email, Type, Category, Source, Inquiry, Status, Joined, Notes
  - File name: `repaircoin-waitlist-{date}.csv`
- No backend changes needed (data is already fetched)

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Add export button + CSV generation utility |

---

#### 5.2 "Assigned To" Field
**Problem:** No way to route leads to a specific team member for follow-up.

**Fix:**
- **Database migration**:
  ```sql
  ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100);
  ```
- **Backend**: Add `assigned_to` to repository CRUD, controller accepts it in update
- **Frontend**: Add "Assigned" column to table, editable via the update modal
- **Note:** Even if there's only one admin now, this future-proofs for team growth

**Files to modify:**
| File | Change |
|------|--------|
| `backend/migrations/XXX_add_waitlist_assigned_to.sql` | New migration |
| `backend/src/repositories/WaitlistRepository.ts` | Add field to CRUD |
| `backend/src/controllers/WaitlistController.ts` | Accept in update |
| `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` | Add column + modal field |

---

### Phase 6: Polish (Low Priority)

#### 6.1 Consistent Source Badge Colors
**Problem:** Source badges should have fixed, recognizable colors regardless of context.

**Fix:**
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Lock badge colors per source:
    | Source | Color |
    |--------|-------|
    | Direct | Gray (`bg-gray-500/20 text-gray-400`) |
    | Organic | Green (`bg-green-500/20 text-green-400`) |
    | Facebook | Blue (`bg-blue-500/20 text-blue-400`) |
    | Twitter/X | Black/White (`bg-white/10 text-white`) |
    | Other | Yellow (`bg-yellow-500/20 text-yellow-400`) |

---

#### 6.2 Email Search
**Problem:** No way to quickly find a specific lead by email.

**Fix:**
- **Frontend** (`AdminWaitlistTab.tsx`):
  - Add a search input above the filter row: "Search by email..."
  - Client-side filter on the `entries` array (already loaded, max 100)
  - Debounced input (300ms) to avoid re-renders on every keystroke

---

## Implementation Priority & Effort

| # | Task | Priority | Effort | Impact |
|---|------|----------|--------|--------|
| 1.1 | Fix CVR calculation | High | Small | Fixes misleading data |
| 1.2 | Rename title | High | Tiny | Fixes confusion |
| 2.1 | Split 24h into Demo/Waitlist KPIs | High | Small | Better prioritization |
| 4.1 | Workflow action buttons | Medium | Medium | Better admin UX |
| 3.1 | Business category + city fields | Medium | Medium | Lead quality |
| 5.1 | CSV export | Low | Small | External tool support |
| 6.2 | Email search | Low | Small | Quick lookup |
| 6.1 | Consistent badge colors | Low | Tiny | Visual polish |
| 5.2 | Assigned to field | Low | Medium | Team scalability |

**Recommended order:** 1.1 → 1.2 → 2.1 → 4.1 → 6.2 → 5.1 → 3.1 → 6.1 → 5.2

---

## Quick Win Checklist (Can ship in one session)

- [ ] Fix CVR: cap at 100%, show "—" when no visits
- [ ] Rename "Staking Waitlist" → "Waitlist & Demos"
- [ ] Split "Last 24h" card into "Demo Requests (24h)" + "Waitlist Signups (24h)"
- [ ] Add email search input (client-side filter)
- [ ] Lock source badge colors
