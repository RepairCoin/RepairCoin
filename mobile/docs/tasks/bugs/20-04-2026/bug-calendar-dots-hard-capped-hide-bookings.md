# Bug: Calendar dots hard-capped at 2-3 per day — hides bookings and misrepresents day activity

**Status:** Open
**Priority:** Medium
**Est. Effort:** 1 hour
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

The shop-side calendar (both full-month and short-strip views) hard-caps the number of dots rendered under each day, regardless of how many bookings actually exist on that day. The current behaviour throws away information about busy days and can display a misleading picture of the day's activity.

Reproduction on staging (peanut shop, current data):

| Date | Web cells (`sc1`, `sc4`) | Mobile full-calendar dots (`sc2`, `sc3`) | Bookings actually in DB |
|---|---|---|---|
| April 16 | 4 entries (9am, 12pm, 3pm, 4:30pm) | **2 dots** (both green) | 4 bookings (2 completed, 2 expired — incl. 1 from a different customer) |
| March 31 | 3 entries | **2 dots** | 3 bookings |
| April 14 | 2 entries | 2 dots (happens to match) | 2 bookings |

Web shows every booking. Mobile silently drops the ones beyond the cap. The calendar legend advertises 6 status colours (Pending / Paid / In Progress / Completed / Cancelled / No Show) but a single day can surface at most 2 (full calendar) or 3 (short strip) of them. A day with "2 completed + 2 expired" looks identical to a day with "4 completed."

This is a separate bug from the previously-fixed filter-affects-dots issue (`completed/bug-calendar-dots-affected-by-status-filter.md`, commit `85a52c5f`). That fix correctly made `getAllBookingsForDate` return unfiltered results. This bug is about what the rendering layer *does* with those results.

---

## Root Cause

Per-booking rendering with a hard `.slice()` cap.

**Full calendar (monthly grid):**

`mobile/feature/booking/components/BookingShopTab.tsx:410`

```tsx
{dayBookings.slice(0, 2).map((b, i) => (
  <View
    key={i}
    style={{
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: getBookingStatusColor(b.status),
      marginHorizontal: 1,
    }}
  />
))}
```

Same pattern at `mobile/feature/appointment/components/AppointmentShopTab.tsx` around the equivalent line in the full-calendar render block.

**Short calendar (horizontal week strip):**

Both `BookingShopTab.tsx` (~line 153) and `AppointmentShopTab.tsx` (~line 148) use `dayBookings.slice(0, 3)` — same pattern, cap at 3 instead of 2.

### Why a hard cap is there at all

A day cell on the full monthly calendar is ~40px wide on mobile. Each dot is 6px with 2px horizontal margin. Fitting more than 3-4 dots into one cell without overflow or visual static is genuinely hard. The cap itself isn't wrong to exist — the wrong bit is that the cap truncates *bookings* rather than summarising *information*. A distinct-status-dot model keeps the same visual density while preserving every status category that's present on that day.

---

## Evidence

- **Screenshots from 2026-04-20 QA session** demonstrate the truncation:
  - `sc1.png` — web calendar, April 16 shows 4 entries
  - `sc2.png` — mobile full calendar, April 16 shows 2 dots
  - `sc3.png` — mobile, March 31 shows 2 dots
  - `sc4.png` — web, March 31 shows 3 entries
- **DB verification (staging, 2026-04-20):** peanut shop has 4 bookings on April 16, 3 on March 31, matching the web rendering. Queried both by `booking_date::date` and `AT TIME ZONE 'Asia/Manila'` — the per-day counts match what web shows.
- **Code verification:** the `.slice(0, 2)` expression is present in the full-calendar render block on both `BookingShopTab.tsx` and `AppointmentShopTab.tsx`. No conditional branching that would increase the cap under any circumstance.

---

## Fix Required

Replace per-booking rendering with **one dot per distinct status**, ordered by attention priority, capped at a reasonable max (3). Add an optional count badge to show total bookings when it's useful.

### Shared helper

`mobile/shared/utilities/calendar.ts` (or a new `booking-dot-helper.ts` if cleaner):

```ts
import { BookingData } from "@/shared/interfaces/booking.interfaces";

// Priority order: attention-requiring statuses first so the most important
// dot is always visible even when a day has more statuses than the cap.
const STATUS_PRIORITY = [
  "no_show",
  "cancelled",
  "expired",
  "pending",
  "in_progress",
  "paid",
  "completed",
] as const;

export function getDistinctStatusesForDots(bookings: BookingData[], max = 3): string[] {
  const present = new Set(bookings.map((b) => b.status));
  return STATUS_PRIORITY.filter((s) => present.has(s)).slice(0, max);
}
```

### Full calendar (monthly grid)

Replace the `slice(0, 2).map(b => …)` block:

```tsx
{hasBookings && !selected && (
  <View style={{ position: 'absolute', bottom: 2, flexDirection: 'row' }}>
    {getDistinctStatusesForDots(dayBookings, 3).map((status) => (
      <View
        key={status}
        style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: getBookingStatusColor(status),
          marginHorizontal: 1,
        }}
      />
    ))}
  </View>
)}
```

### Short strip (horizontal)

Same replacement, using `max = 3`.

### Optional — booking count badge

If the team wants parity with web's `👤 N` indicator, add a small count badge to the day cell's top-right:

```tsx
{dayBookings.length >= 3 && !selected && (
  <View style={{
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#FFCC00', borderRadius: 8,
    paddingHorizontal: 4, paddingVertical: 1,
  }}>
    <Text style={{ color: '#000', fontSize: 9, fontWeight: '600' }}>
      {dayBookings.length}
    </Text>
  </View>
)}
```

Only showing the badge at ≥3 keeps light days clean (a single dot already conveys "one booking"). This is a UX judgement call; team can pick any threshold or skip the badge entirely if the distinct-status dots are considered sufficient.

### What NOT to do

- Do not switch to a single generic dot — that erases status information that the legend advertises.
- Do not colour the whole cell background — fights with selected/today highlights.
- Do not pick a single "representative" status (e.g. "worst of the day") — lies by omission; "3 completed + 1 no_show" would look identical to "4 no_show."
- Do not raise the cap to `slice(0, 10)` — breaks layout on busy days and fails on any day with more bookings than the new cap.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/shared/utilities/calendar.ts` *(or new helper file)* | Add `getDistinctStatusesForDots(bookings, max)` |
| `mobile/feature/booking/components/BookingShopTab.tsx` | Replace `slice(0, 2)` in full calendar and `slice(0, 3)` in short strip with `getDistinctStatusesForDots` output. Optionally add count-badge rendering. |
| `mobile/feature/appointment/components/AppointmentShopTab.tsx` | Same changes as Booking tab |

No backend changes required. No API changes required.

---

## Verification Checklist

### Core rendering behaviour

- [ ] **April 16 (peanut staging):** full calendar day cell shows 2 dots — one for `completed`, one for `expired`. Not 2 green. Colours match the legend.
- [ ] **March 31 (peanut staging):** same — distinct-status dots only, no duplicates.
- [ ] **Day with all-same-status bookings** (e.g. 4 completed on a single day): renders **1 dot**, not 4. Confirms deduplication by status.
- [ ] **Day with ≥ 4 distinct statuses** (rare but possible: pending + paid + in_progress + completed on a busy shop day): renders 3 dots, prioritising attention-requiring statuses (pending before completed).
- [ ] **Empty day:** no dots, no badge. Cell looks identical to how empty days look today.
- [ ] **Selected day:** dots hide while selected (current behaviour — don't regress).

### Short strip

- [ ] Same tests as full calendar but against the horizontal 7-day strip at the top of Appointments / Bookings tabs.

### Count badge (if implemented)

- [ ] Day with 1 booking: no badge.
- [ ] Day with 2 bookings: no badge.
- [ ] Day with 3 bookings: badge shows "3".
- [ ] Day with 10+ bookings: badge shows the real number (no ellipsis truncation of the number itself).
- [ ] Badge doesn't overlap the day-number text or the dots.

### Regression

- [ ] The filter-separation fix still works: switching filter chips doesn't change which dots appear (still ALL statuses). Only the list below the calendar filters.
- [ ] Tapping a day still opens the full bookings list for that day, showing every booking (not just the ones represented by visible dots).
- [ ] Calendar strip scroll/centering behaviour unchanged.
- [ ] No console warnings about duplicate React keys (`key={status}` is safe because statuses are unique post-dedup).

### Cross-check against web

- [ ] For any three test days, the set of status colours shown on mobile equals the set of distinct statuses shown in the web grid for the same shop on the same day. (Web renders full entries, mobile renders dots; the question is status *coverage*, not visual format.)

---

## Notes

- **Related (not superseded):** `mobile/docs/tasks/bugs/15-04-2026/bug-full-calendar-dots-affected-by-status-filter.md` covered the filter-affects-dots issue, which was shipped in commit `85a52c5f` (see `completed/bug-calendar-dots-affected-by-status-filter.md`). That fix is **correct and should stay**. This bug is a separate rendering-layer issue that the previous fix did not touch. The task doc's original QA item — *"April 16 (peanut) shows 4 dots: 2 green (completed) + 2 blue (paid)"* — would need to be revised to *"shows 2 distinct-status dots (completed + expired-colour)"* after this fix, since per-booking dots are intentionally dropped.
- **Why Medium, not High:** no data is lost; the detailed booking list is still accessible by tapping the day. The bug is a UX discoverability issue (shop may not realise a given day has more bookings than dots suggest) rather than a functional block. Would be High if it caused the shop to miss appointments, but because the list-below view shows everything, the risk is contained to calendar-glance misreading.
- **Why per-booking dots was the wrong model to start with:** a day cell is ~40 px wide on mobile. Fitting N dots scales very badly past 3-4; any solution that attempts to represent booking *count* by dot *quantity* will either break layout on busy days or force tiny unreadable dots. The correct signal for "how many bookings" is a number badge (or tapping through to the list). Dots are best used as a categorical indicator.
- **Why STATUS_PRIORITY puts completed last:** completed bookings don't need the shop's attention — they're done. No_show, cancelled, and expired all represent situations the shop may need to follow up on (dispute, reschedule, reach out to customer). Putting them first in the priority list ensures they're never hidden behind happy-path statuses on busy days.
- **Counts from the peanut-Qua-Ting investigation (for context):** peanut has 32 total orders from Qua Ting across 20 distinct days. Days with 3+ bookings in that set: March 17 (3), March 22 (4), March 23 (complex), April 14 (3). Several days will reveal the cap behaviour during QA. Data queried 2026-04-20.
- **Out of scope for this bug:**
  - Timezone handling of `booking_date` — discovered during this investigation that raw `::date` cast and explicit `AT TIME ZONE 'Asia/Manila'` give different days for the same row, suggesting the DB session TZ and the column's type interact in ways worth auditing. File separately if relevant.
  - Per-customer filter on the shop calendar (currently shows all customers' bookings on one calendar) — by design, just noting the expected behaviour.
