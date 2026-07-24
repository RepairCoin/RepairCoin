// backend/src/utils/shopQuietHours.ts
//
// Shared "don't message customers overnight" window, in the shop's own timezone.
//
// Extracted from AISalesFollowUpHandler so both follow-up paths agree on what
// counts as unsociable: the fixed-delay sales nudge and the AI-scheduled
// inactivity follow-up (AiFollowupScheduler). They differ in what they do about
// it — the nudge skips (the conversation stays in its scan window), the
// scheduler defers, because a follow-up armed for 24h out has no second chance.

import { Pool } from 'pg';
import { getSharedPool } from './database-pool';

/** Shop-local window in which automated customer messages may be sent. */
export const DAYTIME_START_HOUR = 8;
export const DAYTIME_END_HOUR = 21;

const DEFAULT_TIMEZONE = 'America/New_York';

/** The shop's IANA timezone from shop_time_slot_config (default ET). */
export async function getShopTimezone(
  shopId: string,
  pool: Pool = getSharedPool()
): Promise<string> {
  try {
    const res = await pool.query<{ timezone: string | null }>(
      `SELECT timezone FROM shop_time_slot_config WHERE shop_id = $1 AND location_id IS NULL`,
      [shopId]
    );
    return res.rows[0]?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Current hour-of-day (0-23) in the given IANA timezone. */
export function shopLocalHour(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    let h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    if (h === 24) h = 0;
    return h;
  } catch {
    // Unknown tz — fall back to a value inside the window so a config typo
    // doesn't silently suppress every follow-up.
    return 12;
  }
}

/** True when it is currently inside the shop's daytime window. */
export function isWithinShopDaytime(timeZone: string): boolean {
  const h = shopLocalHour(timeZone);
  return h >= DAYTIME_START_HOUR && h < DAYTIME_END_HOUR;
}

/**
 * Whole hours to wait before the shop's next daytime window opens; 0 when it is
 * already open. Hour granularity is deliberate — the result lands somewhere in
 * the 08:00 hour local, which is precise enough for a courtesy nudge and avoids
 * date arithmetic across DST boundaries.
 */
export function hoursUntilShopDaytime(timeZone: string): number {
  const h = shopLocalHour(timeZone);
  if (h >= DAYTIME_START_HOUR && h < DAYTIME_END_HOUR) return 0;
  return h < DAYTIME_START_HOUR
    ? DAYTIME_START_HOUR - h // early morning — later today
    : 24 - h + DAYTIME_START_HOUR; // evening — tomorrow morning
}
