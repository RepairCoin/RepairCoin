/**
 * Shared distance and conversion utilities for map features.
 * Used by useShopMap hook, ShopMapView, and FindShopMap.
 * Ported from: mobile/feature/find-shop/utils/index.ts
 *              mobile/shared/providers/RouteProvider.ts
 */

const EARTH_RADIUS_MILES = 3959;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/** Convert miles to meters */
export function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

/** Convert meters to miles */
export function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

/** Format duration in seconds to human-readable string */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

/** Radius step values in miles */
export const RADIUS_STEPS = [1, 2, 5, 10, 15, 20] as const;

/** Default map configuration */
export const MAP_DEFAULTS = {
  lat: parseFloat(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT || '39.8283'),
  lng: parseFloat(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG || '-98.5795'),
  zoom: parseInt(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM || '4', 10),
  radius: 1,
} as const;
