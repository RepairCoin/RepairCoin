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
 * Lookahead bounds (in days). The actual window per request uses the shop's
 * configured `booking_advance_days` from shop_time_slot_config, clamped to
 * this range:
 *   - MIN_LOOKAHEAD_DAYS: even if a shop disables advance booking entirely
 *     (configures 0 or negative), we still want today's slots in the prompt.
 *   - MAX_LOOKAHEAD_DAYS: protects against a shop misconfiguring 365 days,
 *     which would trigger 365 parallel DB queries per AI reply (cost +
 *     latency disaster). 30 days is plenty for any realistic shop and keeps
 *     the per-reply DB burst well-bounded.
 *
 * Default when config row is missing (shop hasn't run the appointment setup
 * wizard yet): 7 days. Was 3 originally — too tight, missed Thursday for a
 * Monday-asking customer with a 6-day shop policy.
 */
const MIN_LOOKAHEAD_DAYS = 1;
const MAX_LOOKAHEAD_DAYS = 30;
const DEFAULT_LOOKAHEAD_DAYS = 7;

/**
 * Slot-count safety ceiling. We surface ALL slots in the booking window up
 * to this number; only kicks in for unusually wide windows or unusually
 * slot-dense shops. Picked empirically:
 *   - Typical shop: 9 slots/day × 6-day window = 54 slots → all fit
 *   - Edge case: 12 slots/day × 14-day window = 168 → ceiling trims to 100
 *
 * Token cost at 100 slots: ~1500 tokens of slot list + tool-enum payload.
 * Anthropic caches the system prompt + tool definition after the first
 * request, so the marginal cost per AI reply is ~$0.0001. Tradeoff well
 * worth it — at this ceiling the AI sees nearly every slot for typical
 * shops, matching the manual booking page's visibility.
 *
 * Was 15 originally — too tight, truncated to ~1.5 days of slots and
 * customers asking about day 3+ got "no slots" even when the shop had
 * plenty available.
 */
const MAX_SLOTS_CEILING = 100;

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
   *   - Min-notice + max-advance window (the SHOP's min_booking_hours)
   *   - Service-specific duration
   *
   * `minAdvanceHours` is an ADDITIONAL, per-customer floor on top of the
   * shop's min-notice rule. It exists because a customer on a no-show
   * restriction tier (caution = 24h, deposit_required = 48h) must book
   * further out than the shop baseline. Without this, the AI would propose
   * a near slot that the checkout then rejects with "Booking Time Too
   * Soon" — a confusing dead end for the customer. Defaults to 0 (no extra
   * restriction) for unrestricted customers.
   *
   * Returns an empty array when the service has no AI booking assistance,
   * the shop has no slots configured, or no openings exist in the window.
   * Errors are swallowed (returns empty array) so a transient DB hiccup never
   * breaks the AI reply itself.
   */
  async fetchUpcomingSlots(
    shopId: string,
    serviceId: string,
    serviceName: string = serviceId,
    minAdvanceHours: number = 0
  ): Promise<AgentAvailabilitySlot[]> {
    try {
      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);
      const timezone = config?.timezone ?? "America/New_York";

      // Cutoff for the per-customer advance-notice floor. Slots whose start
      // instant is before this are dropped so the AI never proposes a slot
      // the checkout would reject. Computed once per call.
      const advanceCutoffMs =
        minAdvanceHours > 0 ? Date.now() + minAdvanceHours * 3_600_000 : 0;

      // Use the shop's configured booking_advance_days as the lookahead
      // window. Clamped to [MIN, MAX] so a misconfigured 0 or 365 doesn't
      // produce empty or runaway-cost prompts. Falls back to DEFAULT
      // when the config row doesn't exist yet for a new shop.
      const lookaheadDays = clampLookahead(
        config?.bookingAdvanceDays ?? DEFAULT_LOOKAHEAD_DAYS
      );

      // Build the list of dates to query — today + next (lookaheadDays - 1)
      // days in the shop's timezone. We use simple Date arithmetic on UTC,
      // then format in the shop's timezone — sufficient because
      // getAvailableTimeSlots re-anchors against shop timezone internally.
      const dates = this.buildLookaheadDates(timezone, lookaheadDays);

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
              .map((s) => this.toAgentSlot(date, s.time, timezone, serviceId, serviceName))
              // Per-customer advance-notice floor (no-show tier). Drop any
              // slot starting before the cutoff. No-op when minAdvanceHours
              // is 0 (advanceCutoffMs === 0).
              .filter(
                (slot) =>
                  advanceCutoffMs === 0 ||
                  Date.parse(slot.slotIso) >= advanceCutoffMs
              );
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

      // Slot selection: include ALL slots in the booking window when the
      // total fits within MAX_SLOTS_CEILING. The shop's actual schedule
      // dictates slot count (duration + buffer + operating hours +
      // existing bookings), so this honors whatever the manual booking
      // page would show.
      //
      // When the total exceeds the ceiling (unusual: wide windows + dense
      // schedules), apply a per-day cap to ensure every day gets fair
      // representation. Without this, earliest days would saturate the
      // cap and later days drop entirely — which is exactly the bug we
      // had with the old MAX_SLOTS=15 (Thursday got dropped).
      const totalSlots = perDayResults.reduce((sum, day) => sum + day.length, 0);
      let flat: AgentAvailabilitySlot[];

      if (totalSlots <= MAX_SLOTS_CEILING) {
        // Fits cleanly — include every slot. Earliest-first preserved
        // because dates are queried in chronological order and
        // getAvailableTimeSlots returns ascending within each day.
        flat = perDayResults.flat();
      } else {
        // Cap exceeded — fairly distribute. perDayCap ensures each day
        // gets at least floor(ceiling/days) slots so a customer asking
        // about a specific day always sees options if the shop is open.
        const perDayCap = Math.max(2, Math.ceil(MAX_SLOTS_CEILING / dates.length));
        const trimmed = perDayResults.map((day) => day.slice(0, perDayCap));
        flat = trimmed.flat().slice(0, MAX_SLOTS_CEILING);
        logger.info("AvailabilityFetcher: slot ceiling reached, applied per-day cap", {
          shopId,
          serviceId,
          totalSlotsBeforeCap: totalSlots,
          lookaheadDays: dates.length,
          perDayCap,
          finalSlotCount: flat.length,
        });
      }
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
   * Phase 2 of multi-service architecture: fetch slots for MULTIPLE
   * services in parallel and concatenate them into a single tagged list.
   * Used by ContextBuilder to populate AgentContext.availabilitySlots when
   * the AI needs to be able to book any AI-enabled service from the shop
   * (not just the focused one).
   *
   * Each service is fetched independently using the existing
   * single-service `fetchUpcomingSlots`. After concatenating, the
   * MAX_SLOTS_CEILING applies to the combined list. Phase 4 of the
   * architecture will replace the simple slice-at-ceiling with a fairer
   * per-service distribution; for Phase 2 the ceiling is high enough
   * (100) that typical shops with 2-4 AI-enabled services × 6-day
   * window fit cleanly within budget.
   *
   * Empty `services` array → returns empty list immediately (no work).
   * Per-service failures are swallowed inside fetchUpcomingSlots; the
   * combined list just omits that service's slots.
   *
   * `minAdvanceHours` is forwarded to every per-service fetch — the
   * per-customer no-show advance-notice floor (see fetchUpcomingSlots).
   */
  async fetchUpcomingSlotsForServices(
    shopId: string,
    services: { serviceId: string; serviceName: string }[],
    minAdvanceHours: number = 0
  ): Promise<AgentAvailabilitySlot[]> {
    if (!services || services.length === 0) {
      return [];
    }
    try {
      // Parallel per-service fetches. Each one already parallelizes per-day
      // internally, so the total burst is num_services × num_days promises.
      // For Peanut with 2 AI-enabled services + 6-day window = 12 parallel
      // queries — well within pool capacity (20).
      const perServiceResults = await Promise.all(
        services.map((s) =>
          this.fetchUpcomingSlots(shopId, s.serviceId, s.serviceName, minAdvanceHours)
        )
      );
      const flat = perServiceResults.flat();
      if (flat.length <= MAX_SLOTS_CEILING) {
        return flat;
      }
      // Combined list exceeded the ceiling. Round-robin across services
      // so each service keeps representation rather than the first one
      // saturating the budget. Each per-service array is already
      // earliest-first; interleaving preserves that property roughly.
      const trimmed: AgentAvailabilitySlot[] = [];
      const cursors = perServiceResults.map(() => 0);
      let exhausted = false;
      while (trimmed.length < MAX_SLOTS_CEILING && !exhausted) {
        exhausted = true;
        for (let i = 0; i < perServiceResults.length; i++) {
          const arr = perServiceResults[i];
          const idx = cursors[i];
          if (idx < arr.length) {
            trimmed.push(arr[idx]);
            cursors[i] = idx + 1;
            exhausted = false;
            if (trimmed.length >= MAX_SLOTS_CEILING) break;
          }
        }
      }
      logger.info(
        "AvailabilityFetcher: multi-service ceiling hit, round-robin trim applied",
        {
          shopId,
          serviceCount: services.length,
          totalBeforeCap: flat.length,
          finalCount: trimmed.length,
        }
      );
      return trimmed;
    } catch (err) {
      logger.error(
        "AvailabilityFetcher: fetchUpcomingSlotsForServices top-level failure",
        {
          shopId,
          serviceCount: services.length,
          error: (err as Error)?.message,
        }
      );
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
   *
   * Phase 2 of multi-service architecture: now tags each slot with
   * (serviceId, serviceName) so the AI knows which service the slot
   * belongs to. Critical for the multi-service tool — the AI can only
   * call propose_booking_slot if it can name the right serviceId
   * alongside the slot_iso.
   */
  private toAgentSlot(
    date: string,
    time: string,
    timezone: string,
    serviceId: string,
    serviceName: string
  ): AgentAvailabilitySlot {
    const slotIso = this.buildSlotIso(date, time, timezone);
    const humanLabel = this.buildHumanLabel(slotIso, timezone);
    return { date, time, slotIso, humanLabel, serviceId, serviceName };
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

/**
 * Clamp the lookahead window to a safe range. Exported only for tests —
 * production code should not bypass `fetchUpcomingSlots`.
 */
export function clampLookahead(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_LOOKAHEAD_DAYS;
  if (days < MIN_LOOKAHEAD_DAYS) return MIN_LOOKAHEAD_DAYS;
  if (days > MAX_LOOKAHEAD_DAYS) return MAX_LOOKAHEAD_DAYS;
  return Math.floor(days);
}
