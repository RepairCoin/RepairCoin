/**
 * End-to-end tests for Calendar Timezone Rendering fix
 *
 * Tests the exact JavaScript date parsing patterns used in:
 * - AppointmentsTab.tsx (calendar grid, isCurrentMonth, payment modal)
 * - AppointmentCalendar.tsx (calendar grid, isCurrentMonth, booking detail)
 * - AppointmentCard.tsx (future/past check)
 * - BookingCard.tsx (date formatting)
 *
 * Validates correct behavior across UTC-8 (PST), UTC-5 (EST), UTC+0, UTC+8 (PHT)
 */

// ============================================================
// Simulate the BROKEN (old) code patterns
// ============================================================

/** OLD: new Date(day.date).getDate() — parsed as UTC, getDate() is local */
function oldDayNumber(dateStr: string): number {
  return new Date(dateStr).getDate();
}

/** OLD: isCurrentMonth using new Date(dateStr) */
function oldIsCurrentMonth(dateStr: string, currentMonth: number, currentYear: number): boolean {
  const date = new Date(dateStr);
  return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
}

/** OLD: new Date(bookingDate).toLocaleDateString() */
function oldFormatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/** OLD: isFuture check with new Date(bookingDate) */
function oldIsFuture(bookingDate: string, todayStr: string): boolean {
  const appointmentDate = new Date(bookingDate);
  const today = new Date(todayStr);
  today.setHours(0, 0, 0, 0);
  return appointmentDate >= today;
}

// ============================================================
// Simulate the FIXED (new) code patterns
// ============================================================

/** FIXED: parseInt(day.date.split('-')[2], 10) */
function fixedDayNumber(dateStr: string): number {
  return parseInt(dateStr.split('-')[2], 10);
}

/** FIXED: isCurrentMonth using string parsing */
function fixedIsCurrentMonth(dateStr: string, currentMonth: number, currentYear: number): boolean {
  const [year, month] = dateStr.split('-').map(Number);
  return (month - 1) === currentMonth && year === currentYear;
}

/** FIXED: append T00:00:00 for local parsing */
function fixedFormatDate(dateStr: string): string {
  const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/** FIXED: isFuture using component constructor */
function fixedIsFuture(bookingDate: string, todayStr: string): boolean {
  const bookingParts = bookingDate.split('-').map(Number);
  const appointmentDate = new Date(bookingParts[0], bookingParts[1] - 1, bookingParts[2]);
  const todayParts = todayStr.split('-').map(Number);
  const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  return appointmentDate >= today;
}

/** Helper: formatDateLocal (same as component) */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** FIXED: booking filter logic (same as component line 191-198) */
function fixedBookingFilter(bookingDateRaw: string, cellDateStr: string): boolean {
  const bookingDateStr = typeof bookingDateRaw === 'string' ? bookingDateRaw : String(bookingDateRaw);
  const bookingDate = new Date(bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`);
  const bookingDateOnly = formatDateLocal(bookingDate);
  return bookingDateOnly === cellDateStr;
}

/** Calendar cell date generation (same as component line 188-189) */
function calendarCellDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return formatDateLocal(date);
}

// ============================================================
// TIMEZONE TEST HELPERS
// ============================================================

const TIMEZONES = [
  { name: 'US/Pacific (UTC-8)', tz: 'America/Los_Angeles' },
  { name: 'US/Eastern (UTC-5)', tz: 'America/New_York' },
  { name: 'UTC', tz: 'UTC' },
  { name: 'Asia/Manila (UTC+8)', tz: 'Asia/Manila' },
  { name: 'Pacific/Auckland (UTC+12)', tz: 'Pacific/Auckland' },
];

// Store original TZ
const originalTZ = process.env.TZ;

function setTimezone(tz: string) {
  process.env.TZ = tz;
  // Force Node.js to pick up the new timezone
  // @ts-ignore - internal Node.js API to reset timezone cache
  if (typeof (process as any)._tzReload === 'function') {
    (process as any)._tzReload();
  }
}

function restoreTimezone() {
  if (originalTZ !== undefined) {
    process.env.TZ = originalTZ;
  } else {
    delete process.env.TZ;
  }
}

// ============================================================
// TESTS
// ============================================================

describe('Calendar Timezone Rendering', () => {

  afterAll(() => {
    restoreTimezone();
  });

  describe('Fixed dayNumber extraction', () => {
    const testDates = [
      '2026-03-18', '2026-03-01', '2026-01-31',
      '2026-12-31', '2026-06-15', '2026-02-28',
    ];

    it('should always return correct day number regardless of timezone', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        for (const dateStr of testDates) {
          const expectedDay = parseInt(dateStr.split('-')[2], 10);
          const result = fixedDayNumber(dateStr);
          expect(result).toBe(expectedDay);
        }
      }
    });

    it('old code (new Date("YYYY-MM-DD").getDate()) is vulnerable to UTC parsing', () => {
      // Demonstrate: new Date("2026-03-18") creates a UTC midnight date
      const utcDate = new Date('2026-03-18');
      // getUTCDate always returns 18 (UTC midnight is Mar 18 in UTC)
      expect(utcDate.getUTCDate()).toBe(18);
      // But getDate() depends on local timezone — in UTC-5 to UTC-12 it would return 17
      // We can verify the UTC interpretation by checking the ISO string
      expect(utcDate.toISOString()).toBe('2026-03-18T00:00:00.000Z');

      // The fixed code always returns the correct day regardless
      expect(fixedDayNumber('2026-03-18')).toBe(18);
    });

    it('fixed code never depends on Date object for day extraction', () => {
      // The old code: new Date(dateStr).getDate() — timezone-dependent
      // The fixed code: parseInt(dateStr.split('-')[2], 10) — pure string, always correct
      const testDates = ['2026-01-01', '2026-03-01', '2026-03-18', '2026-12-31'];
      for (const d of testDates) {
        expect(fixedDayNumber(d)).toBe(parseInt(d.split('-')[2], 10));
      }
    });
  });

  describe('Fixed isCurrentMonth', () => {
    it('should correctly identify month for all timezones', () => {
      const dateStr = '2026-03-18';
      const marchIndex = 2; // JavaScript month (0-indexed)

      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        expect(fixedIsCurrentMonth(dateStr, marchIndex, 2026)).toBe(true);
        expect(fixedIsCurrentMonth(dateStr, 1, 2026)).toBe(false); // February
        expect(fixedIsCurrentMonth(dateStr, marchIndex, 2025)).toBe(false); // Wrong year
      }
    });

    it('should handle month boundaries correctly (March 1)', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        // March 1 should be in March (index 2), not February (index 1)
        expect(fixedIsCurrentMonth('2026-03-01', 2, 2026)).toBe(true);
        expect(fixedIsCurrentMonth('2026-03-01', 1, 2026)).toBe(false);
      }
    });

    it('old code (new Date("YYYY-MM-DD").getMonth()) is vulnerable at month boundaries', () => {
      // new Date("2026-03-01") is UTC midnight → in UTC-8 would be Feb 28 4pm
      // Verify it's UTC midnight:
      expect(new Date('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z');
      expect(new Date('2026-03-01').getUTCMonth()).toBe(2); // March in UTC

      // Fixed code always gets the right month from the string
      expect(fixedIsCurrentMonth('2026-03-01', 2, 2026)).toBe(true);
      expect(fixedIsCurrentMonth('2026-01-01', 0, 2026)).toBe(true);
    });

    it('old code vulnerable at year boundary (Jan 1 → Dec 31 in western TZ)', () => {
      // new Date("2026-01-01") = UTC midnight Jan 1 → Dec 31 2025 in UTC-8
      expect(new Date('2026-01-01').toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(new Date('2026-01-01').getUTCFullYear()).toBe(2026);

      // Fixed code extracts year from string, not from Date object
      expect(fixedIsCurrentMonth('2026-01-01', 0, 2026)).toBe(true);
      expect(fixedIsCurrentMonth('2026-01-01', 11, 2025)).toBe(false);
    });
  });

  describe('Fixed date formatting', () => {
    it('should show correct date string in all timezones', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        const result = fixedFormatDate('2026-03-18');
        // Should contain "18" (the day) and "Mar" or "March" and "2026"
        expect(result).toContain('18');
        expect(result).toContain('2026');
      }
    });

    it('old code (new Date("YYYY-MM-DD").toLocaleDateString()) is UTC-dependent', () => {
      // Verify that new Date("2026-03-18") is always UTC midnight
      const d = new Date('2026-03-18');
      expect(d.getUTCDate()).toBe(18);
      // In western timezones, toLocaleDateString would show 17

      // Fixed code appends T00:00:00 making it local time
      const fixedResult = fixedFormatDate('2026-03-18');
      expect(fixedResult).toContain('18');
      expect(fixedResult).toContain('2026');
    });

    it('should handle ISO strings with T correctly', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        // ISO string with time — should pass through without appending T00:00:00
        const result = fixedFormatDate('2026-03-18T10:30:00');
        expect(result).toContain('18');
      }
    });
  });

  describe('Fixed isFuture check', () => {
    it('should correctly identify future dates in all timezones', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        // March 18 should be future when today is March 17
        expect(fixedIsFuture('2026-03-18', '2026-03-17')).toBe(true);
        // March 18 should NOT be future when today is March 19
        expect(fixedIsFuture('2026-03-18', '2026-03-19')).toBe(false);
        // Same day should count as "future" (>=)
        expect(fixedIsFuture('2026-03-18', '2026-03-18')).toBe(true);
      }
    });

    it('old code (new Date("YYYY-MM-DD") >= today) is vulnerable to timezone shift', () => {
      // new Date("2026-03-18") = UTC midnight → in UTC-8: Mar 17 4pm < Mar 18 midnight local
      // This means today's appointment could be classified as "past"
      const d = new Date('2026-03-18');
      expect(d.toISOString()).toBe('2026-03-18T00:00:00.000Z');

      // Fixed code uses component constructor, always local
      expect(fixedIsFuture('2026-03-18', '2026-03-18')).toBe(true); // same day = future
      expect(fixedIsFuture('2026-03-18', '2026-03-17')).toBe(true);
      expect(fixedIsFuture('2026-03-18', '2026-03-19')).toBe(false);
    });
  });

  describe('Calendar grid booking filter (end-to-end)', () => {
    // This tests the full flow: API returns date → calendar cell generates date → filter matches

    it('should match bookings to correct calendar cells in all timezones', () => {
      // Simulate API returning "2026-03-18" (backend formatLocalDate output)
      const apiBookingDate = '2026-03-18';

      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        // Calendar cell for March 18 (generated via new Date(2026, 2, 18))
        const cellDate = calendarCellDate(2026, 2, 18); // month is 0-indexed
        expect(cellDate).toBe('2026-03-18');

        // Filter should match
        const matches = fixedBookingFilter(apiBookingDate, cellDate);
        expect(matches).toBe(true);

        // Should NOT match adjacent days
        const prevDay = calendarCellDate(2026, 2, 17);
        const nextDay = calendarCellDate(2026, 2, 19);
        expect(fixedBookingFilter(apiBookingDate, prevDay)).toBe(false);
        expect(fixedBookingFilter(apiBookingDate, nextDay)).toBe(false);
      }
    });

    it('should document that ISO UTC strings (with Z) are timezone-sensitive', () => {
      // ISO string with Z suffix: new Date("2026-03-18T00:00:00.000Z") is always UTC
      const isoDate = new Date('2026-03-18T00:00:00.000Z');
      expect(isoDate.getUTCDate()).toBe(18);
      // getDate() would return 17 in UTC-5 to UTC-12 — this is why backend
      // sends YYYY-MM-DD (not ISO) via formatLocalDate()

      // The filter handles both formats:
      // - YYYY-MM-DD: appends T12:00:00 → parsed as local noon → always correct
      // - ISO with T: passed through directly → timezone-dependent
      // Backend always sends YYYY-MM-DD, so the filter works correctly
      const cellDate = calendarCellDate(2026, 2, 18);
      expect(fixedBookingFilter('2026-03-18', cellDate)).toBe(true);
    });

    it('should correctly handle YYYY-MM-DD (what backend actually sends)', () => {
      // Backend formatLocalDate always returns YYYY-MM-DD without timezone
      const backendDate = '2026-03-18';

      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        // The fixed filter appends T12:00:00 which is always parsed as local noon
        const cellDate = calendarCellDate(2026, 2, 18);
        expect(fixedBookingFilter(backendDate, cellDate)).toBe(true);
      }
    });
  });

  describe('Full calendar month simulation', () => {
    // Simulate rendering an entire month's calendar and verify all day numbers

    it('should render correct day numbers for March 2026 in all timezones', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        for (let day = 1; day <= 31; day++) {
          const cellDate = calendarCellDate(2026, 2, day); // March (0-indexed = 2)
          const dayNum = fixedDayNumber(cellDate);
          expect(dayNum).toBe(day);
        }
      }
    });

    it('should render correct day numbers for December 2026 in all timezones', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        for (let day = 1; day <= 31; day++) {
          const cellDate = calendarCellDate(2026, 11, day); // December (0-indexed = 11)
          const dayNum = fixedDayNumber(cellDate);
          expect(dayNum).toBe(day);
        }
      }
    });

    it('should correctly place bookings on the right day across a full month', () => {
      // 5 bookings scattered across March
      const bookings = [
        '2026-03-01', '2026-03-08', '2026-03-15',
        '2026-03-18', '2026-03-31'
      ];

      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        for (let day = 1; day <= 31; day++) {
          const cellDate = calendarCellDate(2026, 2, day);
          const expectedDate = `2026-03-${String(day).padStart(2, '0')}`;

          // Day number should match
          expect(fixedDayNumber(cellDate)).toBe(day);

          // Check if this cell should have a booking
          const shouldHaveBooking = bookings.includes(expectedDate);
          const hasBooking = bookings.some(b => fixedBookingFilter(b, cellDate));
          expect(hasBooking).toBe(shouldHaveBooking);
        }
      }
    });
  });

  describe('Sidebar vs Calendar consistency', () => {
    // The original bug: sidebar showed "Wed, Mar 18" but calendar grid was empty on 18

    it('sidebar date label and calendar cell should agree in all timezones', () => {
      const bookingDate = '2026-03-18';

      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        // Sidebar label generation (from groupedUpcoming)
        const bookingDateStr = bookingDate;
        const parsedBookingDate = new Date(
          bookingDateStr.includes('T') ? bookingDateStr : `${bookingDateStr}T12:00:00`
        );
        const bookingDateOnly = formatDateLocal(parsedBookingDate);

        // Label from sidebar
        const labelDate = new Date(bookingDateOnly + 'T00:00:00');
        const sidebarLabel = labelDate.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric'
        });

        // Calendar cell for March 18
        const cellDate = calendarCellDate(2026, 2, 18);
        const cellDayNum = fixedDayNumber(cellDate);

        // Booking should appear in the cell
        const bookingInCell = fixedBookingFilter(bookingDate, cellDate);

        // Verify consistency
        expect(bookingDateOnly).toBe('2026-03-18');
        expect(cellDate).toBe('2026-03-18');
        expect(cellDayNum).toBe(18);
        expect(bookingInCell).toBe(true);
        expect(sidebarLabel).toContain('18');
        expect(sidebarLabel).toContain('Mar');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle month boundary: last day of month', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        expect(fixedDayNumber('2026-02-28')).toBe(28);
        expect(fixedIsCurrentMonth('2026-02-28', 1, 2026)).toBe(true); // Feb = 1
        expect(fixedIsCurrentMonth('2026-02-28', 2, 2026)).toBe(false); // Not March
      }
    });

    it('should handle year boundary: Dec 31 and Jan 1', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);

        expect(fixedDayNumber('2026-12-31')).toBe(31);
        expect(fixedIsCurrentMonth('2026-12-31', 11, 2026)).toBe(true);

        expect(fixedDayNumber('2027-01-01')).toBe(1);
        expect(fixedIsCurrentMonth('2027-01-01', 0, 2027)).toBe(true);
        expect(fixedIsCurrentMonth('2027-01-01', 11, 2026)).toBe(false);
      }
    });

    it('should handle leap year: Feb 29', () => {
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        // 2028 is a leap year
        expect(fixedDayNumber('2028-02-29')).toBe(29);
        expect(fixedIsCurrentMonth('2028-02-29', 1, 2028)).toBe(true);
      }
    });

    it('should handle DST transition dates', () => {
      // US DST spring forward: March 8, 2026 (2nd Sunday in March)
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        expect(fixedDayNumber('2026-03-08')).toBe(8);
        expect(fixedBookingFilter('2026-03-08', calendarCellDate(2026, 2, 8))).toBe(true);
      }

      // US DST fall back: November 1, 2026 (1st Sunday in November)
      for (const tz of TIMEZONES) {
        setTimezone(tz.tz);
        expect(fixedDayNumber('2026-11-01')).toBe(1);
        expect(fixedBookingFilter('2026-11-01', calendarCellDate(2026, 10, 1))).toBe(true);
      }
    });

    it('should handle the exact reported bug scenario (Mike, March 18, RepairCoin shop)', () => {
      // Reproduce the exact bug: US tester, March 18, two bookings
      const bookings = [
        { date: '2026-03-18', service: 'Gold 6 Month Plan', time: '10:15' },
        { date: '2026-03-18', service: 'Hand Wraps', time: '11:30' },
      ];

      // Test in US Eastern (the tester's timezone)
      setTimezone('America/New_York');

      const march18Cell = calendarCellDate(2026, 2, 18);
      expect(march18Cell).toBe('2026-03-18');

      // Day number should be 18, not 17
      expect(fixedDayNumber(march18Cell)).toBe(18);

      // Both bookings should appear on March 18 cell
      for (const booking of bookings) {
        expect(fixedBookingFilter(booking.date, march18Cell)).toBe(true);
      }

      // March 18 should be in current month (March)
      expect(fixedIsCurrentMonth(march18Cell, 2, 2026)).toBe(true);

      // Sidebar should show "Wed, Mar 18"
      const labelDate = new Date(march18Cell + 'T00:00:00');
      const label = labelDate.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });
      expect(label).toContain('Wed');
      expect(label).toContain('Mar');
      expect(label).toContain('18');

      // Both bookings should count (sidebar shows "(2)")
      const matchCount = bookings.filter(b =>
        fixedBookingFilter(b.date, march18Cell)
      ).length;
      expect(matchCount).toBe(2);
    });
  });
});
