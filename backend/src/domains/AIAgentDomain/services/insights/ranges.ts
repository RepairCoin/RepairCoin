// backend/src/domains/AIAgentDomain/services/insights/ranges.ts
//
// Shared range-vocabulary helpers for the Business-Data Insights
// tools. Centralizes:
//   - the RangeKey enum (rolling + calendar variants)
//   - the RANGE_LABEL human-readable map
//   - windowBoundsFor() which converts a RangeKey to {from, to} Date
//     bounds (both bounds optional — rolling ranges have no upper bound,
//     'all' has neither).
//
// Phase 6.1 adds the calendar-aligned ranges (this_week / last_week /
// this_month / last_month / this_quarter) alongside the existing
// rolling ranges (7d / 30d / 90d / all). Both vocabularies coexist —
// rolling for "rolling 30-day NPS" style asks, calendar for "this
// month" style asks. The prompt tells Claude to pick whichever the
// user phrased.
//
// Calendar math is hand-rolled to avoid adding a date lib for what's
// fundamentally a 30-line function. ISO 8601 week-start (Monday) used
// for `this_week` / `last_week` — see `startOfIsoWeek()`.

/** Canonical range keys across all insights tools. */
export type RangeKey =
  | "7d"
  | "30d"
  | "90d"
  | "all"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter";

/** Source of truth for JSON-schema `enum` arrays in tool input schemas. */
export const RANGE_ENUM: readonly RangeKey[] = [
  "7d",
  "30d",
  "90d",
  "all",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
] as const;

/** Human-readable label for display.label / sub fields. */
export const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  all: "all time",
  this_week: "this week",
  last_week: "last week",
  this_month: "this month",
  last_month: "last month",
  this_quarter: "this quarter",
};

/**
 * Bounds for a range. `from = null` means no lower bound (=
 * `range = 'all'`). `to = null` means no upper bound (rolling ranges
 * + 'this_*' variants — they extend to "now").
 */
export interface WindowBounds {
  from: Date | null;
  to: Date | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Convert a RangeKey to a {from, to} Date pair. Always inclusive-from,
 * exclusive-to (matches SQL `created_at >= from AND created_at < to`).
 *
 * Pure function — accepts `now` for testability. Default is real-time.
 */
export function windowBoundsFor(
  range: RangeKey,
  now: Date = new Date()
): WindowBounds {
  switch (range) {
    case "all":
      return { from: null, to: null };
    case "7d":
      return { from: new Date(now.getTime() - 7 * MS_PER_DAY), to: null };
    case "30d":
      return { from: new Date(now.getTime() - 30 * MS_PER_DAY), to: null };
    case "90d":
      return { from: new Date(now.getTime() - 90 * MS_PER_DAY), to: null };
    case "this_week": {
      const monday = startOfIsoWeek(now);
      return { from: monday, to: null };
    }
    case "last_week": {
      const thisMonday = startOfIsoWeek(now);
      const lastMonday = new Date(thisMonday.getTime() - 7 * MS_PER_DAY);
      return { from: lastMonday, to: thisMonday };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from: first, to: null };
    }
    case "last_month": {
      const thisFirst = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      const lastFirst = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
        0,
        0,
        0,
        0
      );
      return { from: lastFirst, to: thisFirst };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(
        now.getFullYear(),
        quarterStartMonth,
        1,
        0,
        0,
        0,
        0
      );
      return { from: first, to: null };
    }
  }
}

/**
 * Monday-anchored ISO 8601 week start. Returns the most recent Monday
 * at 00:00:00.000 local time, or `now` if `now` IS a Monday past
 * midnight. Examples: Sun → previous Monday; Wed 14:00 → that Monday
 * at 00:00.
 */
function startOfIsoWeek(now: Date): Date {
  // getDay(): Sunday=0, Monday=1, ..., Saturday=6
  // We want Monday=0, ..., Sunday=6 — shift by (day + 6) % 7 days back.
  const dayShift = (now.getDay() + 6) % 7;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayShift,
    0,
    0,
    0,
    0
  );
  return monday;
}

/**
 * Backward-compat shim for tools that only used a lower bound before
 * Phase 6. Drops the upper bound. New tools should call
 * windowBoundsFor() directly.
 */
export function windowStartFor(
  range: RangeKey,
  now: Date = new Date()
): Date | null {
  return windowBoundsFor(range, now).from;
}

/**
 * "Prior" window for a compare='prior' tool call. Shifts the current
 * window backward by its own length:
 *   - 7d current=[now-7d, now)            → prior=[now-14d, now-7d)
 *   - this_week current=[mon, now)         → prior=[mon-7d, mon)  (=last_week so-far)
 *   - this_month current=[1st, now)        → prior=[prevMonth1st, 1st)
 *   - last_week current=[mon-7d, mon)      → prior=[mon-14d, mon-7d)
 *
 * Returns null for `range === 'all'` — no prior window is defined.
 *
 * Same-elapsed-length semantics matter for fair comparison: if today
 * is Wednesday and the user asks `this_week` vs prior, prior is
 * Mon-Wed last week, not the full Mon-Sun last week. Apples-to-apples.
 */
export function priorWindowBoundsFor(
  range: RangeKey,
  now: Date = new Date()
): WindowBounds | null {
  const current = windowBoundsFor(range, now);
  if (current.from === null) return null;
  const currentTo = current.to ?? now;
  const length = currentTo.getTime() - current.from.getTime();
  const priorFrom = new Date(current.from.getTime() - length);
  return { from: priorFrom, to: current.from };
}
