# Feature: Smart Address Input for Shop Registration

## Status: Open
## Priority: Medium
## Date: 2026-04-15
## Category: Enhancement - UX
## Platform: Mobile (React Native / Expo)
## Affects: Shop registration — Location & Wallet slide (ThirdSlide)

---

## Problem

The current location input is redundant and not user-friendly. Users must:
1. Manually type Street Address
2. Manually type City
3. Manually type Country
4. Tap "Pin Location on Map" to select coordinates separately

All 4 steps are disconnected — the address fields don't sync with the map pin, and the map pin doesn't auto-fill the address fields.

---

## Proposed Improvement

Replace the 3 separate text fields with a single smart address input that auto-populates everything. Two input methods:

### Method 1: Type Address (primary)
1. User types in a single address field (e.g., "123 Main St, Cebu City")
2. As they type, show address suggestions (Nominatim search)
3. User selects a suggestion
4. Auto-populate: street address, city, country, zip code, and coordinates (lat/lng)

### Method 2: Use My Location (secondary option)
1. User taps "Use My Location" button
2. GPS gets current coordinates
3. `reverseGeocode()` auto-fills street address, city, country, zip code
4. User can edit any field after auto-fill

### Method 3: Pin on Map (keep existing)
1. User taps "Pin Location on Map" (existing feature)
2. After selecting pin, `reverseGeocode()` auto-fills address fields
3. Currently only saves coordinates — should also populate text fields

---

## Existing Utilities (Already in Codebase)

All geocoding functions exist in `mobile/shared/services/geocoding.services.ts`:

| Function | Purpose | Status |
|---|---|---|
| `geocodeAddress(address)` | Address text → coordinates | Exists, not used in registration |
| `reverseGeocode(lat, lng)` | Coordinates → structured address (street, city, state, zip, country) | Exists, not used in registration |
| `getCurrentLocation()` | Gets device GPS coordinates | Exists, not used in registration |
| `checkLocationPermission()` | Check GPS permission | Exists |

These just need to be wired into the ThirdSlide component.

---

## Implementation

### Updated ThirdSlide Layout

```
[Smart Address Input]
  "Search for your shop address..."
  [Address suggestions dropdown]

[Use My Location] button

[Auto-filled fields (editable)]
  Street Address: [auto-filled, editable]
  City: [auto-filled, editable]  
  Country: [auto-filled, editable]

[Pin on Map] (optional, for fine-tuning)
  Coordinates: 14.5995, 120.9842

[Wallet Information]
  ...
```

### Address Search Flow

```typescript
// User types address
const handleAddressSearch = async (query: string) => {
  // Debounce 500ms, then search Nominatim
  const results = await searchNominatim(query);
  setAddressSuggestions(results);
};

// User selects suggestion
const handleSelectSuggestion = async (suggestion) => {
  const geocoded = await reverseGeocode(suggestion.lat, suggestion.lng);
  updateFormData("address", geocoded.address);
  updateFormData("city", geocoded.city);
  updateFormData("country", geocoded.country);
  updateFormData("location", {
    lat: suggestion.lat.toString(),
    lng: suggestion.lng.toString(),
    city: geocoded.city,
    state: geocoded.state,
    zipCode: geocoded.zipCode,
  });
};
```

### Use My Location Flow

```typescript
const handleUseMyLocation = async () => {
  const coords = await getCurrentLocation();
  if (!coords) {
    Alert.alert("Error", "Could not get your location. Please enable GPS.");
    return;
  }
  const geocoded = await reverseGeocode(coords.latitude, coords.longitude);
  updateFormData("address", geocoded.address);
  updateFormData("city", geocoded.city);
  updateFormData("country", geocoded.country);
  updateFormData("location", {
    lat: coords.latitude.toString(),
    lng: coords.longitude.toString(),
    city: geocoded.city,
    state: geocoded.state,
    zipCode: geocoded.zipCode,
  });
};
```

### Map Pin Improvement

Wire `reverseGeocode()` into the existing `handleLocationSelect`:

```typescript
const handleLocationSelect = async (location: SelectedLocation) => {
  const geocoded = await reverseGeocode(location.lat, location.lng);
  if (geocoded) {
    updateFormData("address", geocoded.address);
    updateFormData("city", geocoded.city);
    updateFormData("country", geocoded.country);
  }
  updateFormData("location", {
    ...formData.location,
    lat: location.lat.toString(),
    lng: location.lng.toString(),
  });
  setShowLocationPicker(false);
};
```

---

## New Nominatim Search Function Needed

Add to `geocoding.services.ts`:

```typescript
export async function searchAddress(query: string): Promise<Array<{
  displayName: string;
  lat: number;
  lng: number;
}>> {
  const encoded = encodeURIComponent(query);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5`,
    { headers: { "User-Agent": "FixFlow-Mobile-App" } }
  );
  const data = await response.json();
  return data.map((item: any) => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/components/ThirdSlide.tsx` | Replace 3 separate fields with smart input, add "Use My Location" button, wire reverseGeocode into map pin |
| `mobile/shared/services/geocoding.services.ts` | Add `searchAddress()` function for address suggestions |

---

## QA Verification

### Address Search
- [ ] Type "Cebu City" → suggestions appear
- [ ] Select suggestion → street, city, country, coordinates all auto-filled
- [ ] Edit auto-filled city → change persists
- [ ] Clear search → fields reset

### Use My Location
- [ ] Tap "Use My Location" → GPS permission requested
- [ ] Permission granted → address fields auto-filled from current location
- [ ] Permission denied → clear error message
- [ ] User not at shop location → can edit fields after auto-fill

### Map Pin (improved)
- [ ] Select pin on map → address fields auto-populated (not just coordinates)
- [ ] Move pin → address fields update

### Validation
- [ ] All required fields still validated before proceeding
- [ ] Manual entry still works (user can type everything manually)
