/**
 * Which branch this device rings up for. Held per-device rather than per-user: a till stays at
 * one counter regardless of who is on shift, and asking every sale would be the wrong question.
 */
export const POS_LOCATION_KEY = "fixflow.pos.locationId";

export function readPosLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(POS_LOCATION_KEY) || null;
  } catch {
    return null;
  }
}

export function writePosLocation(locationId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (locationId) window.localStorage.setItem(POS_LOCATION_KEY, locationId);
    else window.localStorage.removeItem(POS_LOCATION_KEY);
  } catch {
    /* private browsing — the register still works, it just forgets between visits */
  }
}
