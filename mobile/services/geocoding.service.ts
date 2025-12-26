import * as Location from "expo-location";

export interface GeocodedAddress {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Request location permissions and get current position
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.log("Location permission denied");
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address
 * Uses Nominatim API for detailed address components (barangay, municipality, etc.)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  // Use Nominatim API for all platforms - better international address support
  // especially for Filipino addresses (barangay, municipality, province)
  return reverseGeocodeNominatim(latitude, longitude);
}

/**
 * Format expo-location geocode result
 */
function formatExpoGeocode(
  result: Location.LocationGeocodedAddress
): GeocodedAddress {
  const parts: string[] = [];

  if (result.streetNumber) parts.push(result.streetNumber);
  if (result.street) parts.push(result.street);

  const streetAddress = parts.join(" ");

  const addressParts: string[] = [];
  if (streetAddress) addressParts.push(streetAddress);
  if (result.city) addressParts.push(result.city);
  if (result.region) addressParts.push(result.region);
  if (result.postalCode) addressParts.push(result.postalCode);

  return {
    address: addressParts.join(", ") || "Unknown location",
    city: result.city || undefined,
    state: result.region || undefined,
    zipCode: result.postalCode || undefined,
    country: result.country || undefined,
  };
}

/**
 * Reverse geocode using Nominatim (OpenStreetMap) API
 * Includes timeout to prevent hanging
 */
async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  // Create abort controller with 10 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "RepairCoin-Mobile-App",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.address) {
      return formatNominatimResult(data);
    }

    return null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("Nominatim geocoding timed out");
    } else {
      console.error("Nominatim reverse geocoding failed:", error);
    }
    return null;
  }
}

/**
 * Format Nominatim API result
 * Handles Filipino address components (barangay, municipality, etc.)
 */
function formatNominatimResult(data: any): GeocodedAddress {
  const addr = data.address || {};

  // Build street address (house number + road/street)
  const streetParts: string[] = [];
  if (addr.house_number) streetParts.push(addr.house_number);
  if (addr.road || addr.street) streetParts.push(addr.road || addr.street);
  const streetAddress = streetParts.join(" ");

  // Get barangay (Filipino neighborhood/district)
  // Nominatim uses various fields for barangay
  const barangay =
    addr.neighbourhood ||
    addr.quarter ||
    addr.suburb ||
    addr.village ||
    undefined;

  // Get municipality/city
  const municipality =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.city_district ||
    undefined;

  // Get province/state/region
  const province =
    addr.state ||
    addr.province ||
    addr.region ||
    addr.state_district ||
    undefined;

  // Get postal code
  const zipCode = addr.postcode || undefined;

  // Build full address with all components
  const addressParts: string[] = [];
  if (streetAddress) addressParts.push(streetAddress);
  if (barangay) addressParts.push(barangay);
  if (municipality) addressParts.push(municipality);
  if (province) addressParts.push(province);
  if (zipCode) addressParts.push(zipCode);

  // Use display_name as fallback for complete address
  const fullAddress =
    addressParts.length > 0
      ? addressParts.join(", ")
      : data.display_name || "Unknown location";

  return {
    address: fullAddress,
    city: municipality,
    state: province,
    zipCode,
    country: addr.country || undefined,
  };
}

/**
 * Check if location permissions are granted
 */
export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === "granted";
}

/**
 * Forward geocode an address to get coordinates
 * Uses expo-location first, then Nominatim as fallback
 */
export async function geocodeAddress(
  address: string
): Promise<Coordinates | null> {
  // Try expo-location first (works well on iOS)
  try {
    const results = await Location.geocodeAsync(address);
    if (results && results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
  } catch (error) {
    console.log("Expo geocoding error:", error);
  }

  // Fallback to Nominatim API (more reliable on Android)
  return geocodeWithNominatim(address);
}

/**
 * Forward geocode using Nominatim (OpenStreetMap) API
 */
async function geocodeWithNominatim(
  address: string
): Promise<Coordinates | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          "User-Agent": "RepairCoin-Mobile-App",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }

    return null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("Nominatim geocoding timed out");
    } else {
      console.error("Nominatim forward geocoding failed:", error);
    }
    return null;
  }
}
