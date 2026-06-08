// backend/src/domains/AIAgentDomain/services/dateContext.ts
//
// Per-turn "today's date" system block for the shop AI assistants (orchestrator,
// marketing, insights). The model has NO inherent sense of the current date, so
// without this it proposes out-of-season campaigns (e.g. a "Black Friday" promo
// in June) and can't judge whether anything is timely.
//
// It ALSO optionally injects the owner's local TIME OF DAY so the assistant can
// greet correctly ("Good morning" / a "morning briefing"). This is gated on a
// TRUSTWORTHY timezone: the model must never guess the time of day, because the
// server clock is UTC/DigitalOcean, not the shop's local time. See
// resolveTimeOfDay() for exactly when we trust it.
//
// MUST be injected as a NON-CACHED system block — the date + time change, so a
// cached one would serve a stale value. It's tiny, so the cache hit on the big
// stable prefix (rules + help corpus) is unaffected.

// The universal default in shop_time_slot_config.timezone (migration 056). EVERY
// shop currently sits on it because there was no UI to change it — so we CANNOT
// treat it as a deliberate "this shop is in New York" signal. We treat it as
// "unset → unknown" and stay time-neutral rather than greet a Manila shop at the
// wrong time. Once a shop explicitly picks a non-default zone in settings, the
// greeting personalizes. (Trade-off: a shop that genuinely IS Eastern and
// re-selects it still reads as "default" → neutral. Acceptable: never wrong,
// just occasionally plain.)
const DEFAULT_TZ = "America/New_York";

export interface DateContextOptions {
  /**
   * The shop's IANA timezone (e.g. "Asia/Manila"), if configured. When omitted,
   * blank, equal to the default, or not a valid zone, the block stays
   * time-of-day NEUTRAL — the assistant is told NOT to guess the time.
   */
  timezone?: string | null;
}

interface ResolvedTimeOfDay {
  timezone: string;
  /** e.g. "7:14 AM" in the shop's local time. */
  localTime: string;
  /** "morning" | "afternoon" | "evening" | "night" — for description. */
  partOfDay: string;
  /** The greeting word ("morning"/"afternoon"/"evening"; night greets as evening). */
  greeting: string;
}

/** A non-cached system-prompt block stating today's date + (optionally) the
 *  shop's local time of day + how to use them. */
export function buildDateContextBlock(
  opts: DateContextOptions = {},
  now: Date = new Date()
): string {
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const base =
    `Today's date is ${dateStr}. Use it for any time-sensitive reasoning. ` +
    `When proposing a SEASONAL or holiday campaign (Black Friday, Christmas, ` +
    `Valentine's, back-to-school, etc.), check the timing against today — do NOT ` +
    `pitch one that is months away or already passed; suggest a timely angle ` +
    `instead, or confirm the date with the owner. Never claim or invent a date ` +
    `you can't derive from this.`;

  const tod = resolveTimeOfDay(opts.timezone, now);
  if (!tod) {
    return (
      base +
      ` You do NOT know the owner's local time of day — so do NOT greet with ` +
      `"good morning/afternoon/evening", and do NOT call anything a "morning ` +
      `briefing". Open neutrally instead (e.g. "Here's your briefing" / "Here's ` +
      `where things stand").`
    );
  }
  return (
    base +
    ` The owner's local time is ${tod.localTime} (${tod.timezone}) — it's ` +
    `${tod.partOfDay} there. When a greeting is natural (e.g. opening a ` +
    `briefing), greet with "Good ${tod.greeting}"; otherwise don't force it.`
  );
}

/**
 * Compute the shop's local time of day — but ONLY when we can trust it.
 * Returns null (→ neutral greeting) when:
 *   - no timezone supplied, or it's blank
 *   - it equals the universal default (treated as "unset"; see DEFAULT_TZ)
 *   - it isn't a valid IANA zone (Intl throws)
 */
function resolveTimeOfDay(
  tz: string | null | undefined,
  now: Date
): ResolvedTimeOfDay | null {
  if (!tz || typeof tz !== "string") return null;
  const zone = tz.trim();
  if (!zone || zone === DEFAULT_TZ) return null;

  let hour: number;
  let localTime: string;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour: "numeric",
        hour12: false,
      }).format(now)
    );
    localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  } catch {
    return null; // invalid timezone identifier
  }
  if (!Number.isFinite(hour)) return null;
  if (hour === 24) hour = 0; // some engines render midnight as "24" with hour12:false

  let partOfDay: string;
  let greeting: string;
  if (hour >= 5 && hour < 12) {
    partOfDay = "morning";
    greeting = "morning";
  } else if (hour >= 12 && hour < 17) {
    partOfDay = "afternoon";
    greeting = "afternoon";
  } else if (hour >= 17 && hour < 21) {
    partOfDay = "evening";
    greeting = "evening";
  } else {
    partOfDay = "night";
    greeting = "evening"; // "good night" is a farewell — greet as evening
  }
  return { timezone: zone, localTime, partOfDay, greeting };
}
