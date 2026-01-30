import { LatLng } from "react-native-maps";

// Route Provider Configuration
// Change this to switch between providers: "openrouteservice" | "mapbox"
export type RouteProviderType = "openrouteservice" | "mapbox";
export const ROUTE_PROVIDER: RouteProviderType = "openrouteservice";

// OpenRouteService API key - Get free key at https://openrouteservice.org/dev/#/signup
// Free: 2,000 requests/day
const OPENROUTESERVICE_API_KEY = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY || "";

// Mapbox API key - Get free key at https://account.mapbox.com/access-tokens/
// Free: 100,000 requests/month
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface RouteResult {
  coordinates: LatLng[];
  distance: number; // in meters
  duration: number; // in seconds
}

/**
 * Fetch route from OpenRouteService
 */
const fetchRouteFromOpenRouteService = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult | null> => {
  if (!OPENROUTESERVICE_API_KEY) {
    console.log("OpenRouteService API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTESERVICE_API_KEY}&start=${startLng},${startLat}&end=${endLng},${endLat}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json, application/geo+json",
        },
      }
    );

    if (!response.ok) {
      console.log("OpenRouteService error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const geometry = feature.geometry;
      const properties = feature.properties;

      // GeoJSON coordinates are [lng, lat], convert to LatLng
      const coordinates: LatLng[] = geometry.coordinates.map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      // Distance in meters, duration in seconds
      const distance = properties.summary?.distance || 0;
      const duration = properties.summary?.duration || 0;

      return { coordinates, distance, duration };
    }
  } catch (error) {
    console.log("Error fetching route from OpenRouteService:", error);
  }

  return null;
};

/**
 * Fetch route from Mapbox
 */
const fetchRouteFromMapbox = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult | null> => {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.log("Mapbox access token not configured");
    return null;
  }

  try {
    // Mapbox expects coordinates as lng,lat pairs separated by semicolons
    const coordinates = `${startLng},${startLat};${endLng},${endLat}`;
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.log("Mapbox error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry;

      // GeoJSON coordinates are [lng, lat], convert to LatLng
      const routeCoords: LatLng[] = geometry.coordinates.map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));

      // Distance in meters, duration in seconds
      const distance = route.distance || 0;
      const duration = route.duration || 0;

      return { coordinates: routeCoords, distance, duration };
    }
  } catch (error) {
    console.log("Error fetching route from Mapbox:", error);
  }

  return null;
};

/**
 * Unified route fetching based on selected provider
 */
export const fetchRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  provider: RouteProviderType = ROUTE_PROVIDER
): Promise<RouteResult | null> => {
  if (provider === "mapbox") {
    return fetchRouteFromMapbox(startLat, startLng, endLat, endLng);
  }
  return fetchRouteFromOpenRouteService(startLat, startLng, endLat, endLng);
};

/**
 * Convert meters to miles
 */
export const metersToMiles = (meters: number): number => {
  return meters / 1609.34;
};

/**
 * Convert miles to meters
 */
export const milesToMeters = (miles: number): number => {
  return miles * 1609.34;
};

/**
 * Format duration to human readable string
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};
