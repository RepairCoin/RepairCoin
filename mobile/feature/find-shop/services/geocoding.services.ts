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

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  return reverseGeocodeNominatim(latitude, longitude);
}

async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "FixFlow-Mobile-App",
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

function formatNominatimResult(data: any): GeocodedAddress {
  const addr = data.address || {};

  const streetParts: string[] = [];
  if (addr.house_number) streetParts.push(addr.house_number);
  if (addr.road || addr.street) streetParts.push(addr.road || addr.street);
  const streetAddress = streetParts.join(" ");

  const barangay =
    addr.neighbourhood ||
    addr.quarter ||
    addr.suburb ||
    addr.village ||
    undefined;

  const municipality =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.city_district ||
    undefined;

  const province =
    addr.state ||
    addr.province ||
    addr.region ||
    addr.state_district ||
    undefined;

  const zipCode = addr.postcode || undefined;

  const addressParts: string[] = [];
  if (streetAddress) addressParts.push(streetAddress);
  if (barangay) addressParts.push(barangay);
  if (municipality) addressParts.push(municipality);
  if (province) addressParts.push(province);
  if (zipCode) addressParts.push(zipCode);

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

export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === "granted";
}

export async function geocodeAddress(
  address: string
): Promise<Coordinates | null> {
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

  return geocodeWithNominatim(address);
}

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
          "User-Agent": "FixFlow-Mobile-App",
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
