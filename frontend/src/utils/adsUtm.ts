// frontend/src/utils/adsUtm.ts
//
// Ads System Stage 2 — UTM capture for landing-page attribution. Ad creatives
// point at landing URLs carrying ?utm_campaign={our campaign id}&utm_source=
// {platform}&utm_medium=ad&utm_content={creative id} (+ fbclid/gclid). Call
// captureUtmFromUrl() once on landing; the lead form reads getStoredUtm() at
// submit so attribution survives navigation within the session.

const UTM_KEYS = ["utm_campaign", "utm_source", "utm_medium", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "fixflow_ads_utm";

export interface StoredUtm {
  utm: Record<string, string>;
  clickId?: string;
  capturedAt?: number;
}

/** Read UTM + click-id params from the current URL into sessionStorage (once). */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    UTM_KEYS.forEach((k) => {
      const v = sp.get(k);
      if (v) utm[k] = v;
    });
    const clickId = sp.get("fbclid") || sp.get("gclid") || undefined;
    if (Object.keys(utm).length > 0 || clickId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ utm, clickId, capturedAt: Date.now() }));
    }
  } catch {
    /* sessionStorage unavailable (SSR / privacy mode) — attribution falls back to manual */
  }
}

/** The UTM/click-id captured this session (empty when none). */
export function getStoredUtm(): StoredUtm {
  if (typeof window === "undefined") return { utm: {} };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredUtm) : { utm: {} };
  } catch {
    return { utm: {} };
  }
}
