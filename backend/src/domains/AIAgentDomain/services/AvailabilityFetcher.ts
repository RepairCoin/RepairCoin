// backend/src/domains/AIAgentDomain/services/AvailabilityFetcher.ts
//
// Pulls real bookable slots for a service over the next N days, formats them
// for the AI prompt + booking-suggestion card persistence (Phase 3 Task 10).
//
// Wraps `AppointmentService.getAvailableTimeSlots` (the single source of truth
// for shop hours, timezone, advance/min-notice rules, max_concurrent_bookings,
// and existing-booking deduplication). We never re-implement those rules
// here — same engine the customer's booking page uses.
//
// Cost shape: 1 DB query per lookahead day. Days are queried in parallel.
// With LOOKAHEAD_DAYS=3 + a warm pool, this adds ~150-300ms per AI reply.

import { AppointmentService } from "../../ServiceDomain/services/AppointmentService";
import { AppointmentRepository } from "../../../repositories/AppointmentRepository";
import { logger } from "../../../utils/logger";
import { AgentAvailabilitySlot } from "../types";

/**
 * Days to look ahead from "today in shop's timezone". Small window keeps the
 * prompt size bounded and slots feel "near term" to the customer (the AI
 * shouldn't suggest a slot 2 weeks out — it loses the urgency that makes
 * tap-to-book valuable).
 */
const LOOKAHEAD_DAYS = 3;

/**
 * Hard cap on slots returned. Earliest-first ordering, but the cap matters:
 * with typical 50-minute slots and a 9-hour shop day (~10 slots/day), 8 slots
 * only covered the morning of day 1 — so customers asking for "afternoon"
 * had no afternoon options visible to the AI. 15 covers a full day plus
 * roughly half of the next, giving morning + afternoon + early evening
 * diversity. Token cost: ~+350 tokens per call (~$0.001/call extra), worth
 * it for actually honoring time-of-day preferences.
 */
const MAX_SLOTS = 15;

export interface AvailabilityFetcherDeps {
  appointmentService?: AppointmentService;
  appointmentRepo?: AppointmentRepository;
}

export class AvailabilityFetcher {
  private readonly appointmentService: AppointmentService;
  private readonly appointmentRepo: AppointmentRepository;

  constructor(deps: AvailabilityFetcherDeps = {}) {
    this.appointmentService = deps.appointmentService ?? new AppointmentService();
    this.appointmentRepo = deps.appointmentRepo ?? new AppointmentRepository();
  }

  /**
   * Returns up to MAX_SLOTS bookable slots over the next LOOKAHEAD_DAYS days,
   * ordered earliest-first. Slots already filtered by:
   *   - Shop's open hours per day-of-week
   *   - Day-specific overrides (closed days, special hours)
   *   - Existing bookings + max_concurrent_bookings
   *   - Min-notice + max-advance window
   *   - Service-specific duration
   *
   * Returns an empty array when the service has no AI booking assistance,
   * the shop has no slots configured, or no openings exist in the window.
   * Errors are swallowed (returns empty array) so a transient DB hiccup never
   * breaks the AI reply itself.
   */
  async fetchUpcomingSlots(
    shopId: string,
    serviceId: string
  ): Promise<AgentAvailabilitySlot[]> {
    try {
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);
      const timezone = config?.timezone ?? "America/New_York";

      // Build the list of dates to query — today + next (LOOKAHEAD_DAYS - 1) days
      // in the shop's timezone. We use simple Date arithmetic on UTC, then
      // format in the shop's timezone — sufficient because getAvailableTimeSlots
      // re-anchors against shop timezone internally.
      const dates = this.buildLookaheadDates(timezone, LOOKAHEAD_DAYS);

      // Parallel query each day — tolerable network burst, big latency win
      const perDayResults = await Promise.all(
        dates.map(async (date) => {
          try {
            const slots = await this.appointmentService.getAvailableTimeSlots(
              shopId,
              serviceId,
              date
            );
            return slots
              .filter((s) => s.available)
              .map((s) => this.toAgentSlot(date, s.time, timezone));
          } catch (err) {
            logger.warn("AvailabilityFetcher: getAvailableTimeSlots failed for date", {
              shopId,
              serviceId,
              date,
              error: (err as Error)?.message,
            });
            return [] as AgentAvailabilitySlot[];
          }
        })
      );

      // Flatten + cap. Earliest-first ordering is preserved because dates
      // are queried in chronological order and slots within a day come back
      // ascending from getAvailableTimeSlots.
      const flat = perDayResults.flat().slice(0, MAX_SLOTS);
      return flat;
    } catch (err) {
      logger.error("AvailabilityFetcher: fetchUpcomingSlots top-level failure", {
        shopId,
        serviceId,
        error: (err as Error)?.message,
      });
      return [];
    }
  }

  /**
   * Build the list of YYYY-MM-DD strings representing today + the next
   * (count - 1) days in the given IANA timezone. Each entry is the local
   * date in the shop's timezone — the format AppointmentService expects.
   */
  private buildLookaheadDates(timezone: string, count: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(this.formatDateInTimezone(d, timezone));
    }
    return dates;
  }

  /** Format a Date as YYYY-MM-DD in the given IANA timezone via Intl. */
  private formatDateInTimezone(d: Date, timezone: string): string {
    // en-CA happens to render YYYY-MM-DD natively; saves manual padding logic.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  /**
   * Map a (date, HH:MM) pair to an AgentAvailabilitySlot. Builds:
   *   - slotIso — ISO 8601 string with the shop's timezone offset, computed
   *     correctly via Intl (handles DST + offset variations)
   *   - humanLabel — readable form for the prompt ("Thursday, May 8 at 2:30 PM")
   */
  private toAgentSlot(
    date: string,
    time: string,
    timezone: string
  ): AgentAvailabilitySlot {
    const slotIso = this.buildSlotIso(date, time, timezone);
    const humanLabel = this.buildHumanLabel(slotIso, timezone);
    return { date, time, slotIso, humanLabel };
  }

  private buildSlotIso(date: string, time: string, timezone: string): string {
    // date is YYYY-MM-DD in shop tz; time is HH:MM. Compute the UTC instant
    // such that the local time in `timezone` equals our date+time.
    const [y, m, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    // Start with naive UTC interpretation, then correct by the offset between
    // that wall time in the target timezone and UTC.
    const naiveUTC = Date.UTC(y, m - 1, d, h, mi, 0);
    const offsetMs = this.timezoneOffsetMs(naiveUTC, timezone);
    const correctedUTC = naiveUTC - offsetMs;
    return new Date(correctedUTC).toISOString();
  }

  /**
   * Returns the offset in milliseconds between the given timezone and UTC
   * at the given UTC instant. Positive for timezones east of UTC.
   */
  private timezoneOffsetMs(utcMs: number, timezone: string): number {
    const date = new Date(utcMs);
    // Format date in target timezone, parse back as if it were UTC; the diff
    // is the offset.
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    let hour = get("hour");
    if (hour === 24) hour = 0; // some Intl impls return 24 for midnight
    const tzWallMs = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      hour,
      get("minute"),
      get("second")
    );
    return tzWallMs - utcMs;
  }

  private buildHumanLabel(slotIso: string, timezone: string): string {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    // Replace the comma between date and time with " at " for readability.
    return fmt.format(new Date(slotIso)).replace(/, (\d)/, " at $1");
  }
}
