/**
 * Route fetching utility for directions feature.
 * Supports OpenRouteService (primary) and Mapbox (fallback).
 * Ported from: mobile/shared/providers/RouteProvider.ts
 */

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet
  distance: number; // meters
  duration: number; // seconds
}

const OPENROUTESERVICE_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY || '';

/**
 * Fetch driving route between two coordinates via OpenRouteService
 */
async function fetchRouteFromOpenRouteService(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult | null> {
  if (!OPENROUTESERVICE_API_KEY) {
    console.warn('OpenRouteService API key not configured (NEXT_PUBLIC_OPENROUTESERVICE_API_KEY)');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTESERVICE_API_KEY}&start=${startLng},${startLat}&end=${endLng},${endLat}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json, application/geo+json' },
      }
    );

    if (!response.ok) {
      console.error('OpenRouteService error:', response.status);
      return null;
    }

    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    // GeoJSON coordinates are [lng, lat] — convert to [lat, lng] for Leaflet
    const coordinates: [number, number][] = feature.geometry.coordinates.map(
      (coord: number[]) => [coord[1], coord[0]] as [number, number]
    );

    return {
      coordinates,
      distance: feature.properties.summary?.distance || 0,
      duration: feature.properties.summary?.duration || 0,
    };
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  }
}

/**
 * Fetch driving route between two coordinates.
 * Returns coordinates in [lat, lng] format for Leaflet Polyline.
 */
export async function fetchRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult | null> {
  return fetchRouteFromOpenRouteService(startLat, startLng, endLat, endLng);
}
