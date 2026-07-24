import { AdPlacement, ServiceData } from "@/feature/services/services/service.interface";

/**
 * A rendered row of the services grid. FlatList's `numColumns` forces every item to the same
 * width, so a full-width sponsored card is impossible with it — instead the list is pre-chunked
 * into rows here and rendered as a single-column list.
 */
export type ServiceGridRow =
  | { kind: "services"; key: string; items: ServiceData[] }
  | { kind: "ad"; key: string; ad: AdPlacement };

export const SERVICES_PER_ROW = 2;
/** Services between sponsored cards (3 rows of 2). */
export const DEFAULT_AD_INTERVAL = 6;

interface BuildAdRowsOptions {
  /** Services shown between two ads. Must be a positive multiple of SERVICES_PER_ROW. */
  adEvery?: number;
  /** Open with an ad above the first service row. Default true. */
  leadWithAd?: boolean;
}

/**
 * Interleave sponsored cards into a two-column service grid.
 *
 * Layout is ad-first: AD → `adEvery` services → AD → `adEvery` services → …
 *
 * Ads are strictly additive: with no ads (empty list, query still loading, or the request
 * failed) this returns exactly the service rows, so the grid renders identically to a build
 * with no ads at all. An empty service list yields NO rows at all — not a lone ad — so the
 * screen's empty state still shows.
 *
 * Trailing-ad rule: an ad landing on the last row is suppressed, EXCEPT when it would be the
 * first ad in the list. That exception matters when `leadWithAd` is off — without it a list of
 * exactly `adEvery` services renders no ad at all.
 */
export function buildAdRows(
  services: ServiceData[] | undefined,
  ads: AdPlacement[] | undefined,
  options: BuildAdRowsOptions = {},
): ServiceGridRow[] {
  const list = services ?? [];
  if (list.length === 0) return [];

  const adEvery = options.adEvery ?? DEFAULT_AD_INTERVAL;
  const rowsBetweenAds = Math.max(1, Math.floor(adEvery / SERVICES_PER_ROW));
  const available = ads ?? [];

  const rows: ServiceGridRow[] = [];
  let serviceRowCount = 0;
  let adIndex = 0;

  const pushAd = () => {
    const ad = available[adIndex % available.length];
    rows.push({
      kind: "ad",
      // adIndex keeps the key unique when fewer ads than slots means one repeats.
      key: `ad-${ad.campaignId}-${adIndex}`,
      ad,
    });
    adIndex += 1;
  };

  // Lead card, above the first service row. Only when there are services to lead into —
  // an ad alone on an otherwise empty screen would replace the empty state.
  if ((options.leadWithAd ?? true) && available.length > 0) pushAd();

  for (let i = 0; i < list.length; i += SERVICES_PER_ROW) {
    const items = list.slice(i, i + SERVICES_PER_ROW);
    rows.push({
      kind: "services",
      key: `services-${items[0].serviceId}`,
      items,
    });
    serviceRowCount += 1;

    const isLastRow = i + SERVICES_PER_ROW >= list.length;
    // A boundary on the last row only yields an ad if none has been placed yet, so short
    // lists still show one card without long lists ending on a dangling ad.
    const allowedHere = !isLastRow || adIndex === 0;
    if (allowedHere && available.length > 0 && serviceRowCount % rowsBetweenAds === 0) {
      pushAd();
    }
  }

  return rows;
}
