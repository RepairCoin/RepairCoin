# Mobile Shop Address - Rename & Autocomplete Feature

## Priority: Medium
## Status: Open
## Requested By: Sir Zeff
## Assignee: Mobile Developer
## Platform: Mobile Only

## Overview

Two enhancements for the Shop Edit Profile address field:
1. **Rename** "Street Address" to "Shop Address" (match web naming convention)
2. **Add autocomplete/suggestion** feature while typing address

## Current Behavior (Mobile)

- Field labeled "Street Address" (web uses "Shop Address")
- Simple text input with no suggestions
- User must type full address manually
- Separate "Pin Location on Map" feature exists but doesn't provide address suggestions

## Web Reference

The web version (`frontend/src/components/maps/LocationPicker.tsx`) has:
- Search input with address lookup via OpenStreetMap Nominatim API
- Click-to-select on map with reverse geocoding (auto-fills address)
- "Use Current Location" button

## Affected Files

### Mobile
- `mobile/feature/profile/screens/ShopEditProfileScreen.tsx` (line 84-90)

Current code:
```tsx
<FormInput
  label="Street Address"  // <-- Rename to "Shop Address"
  icon={<Ionicons name="location-outline" size={20} color={PROFILE_COLORS.primary} />}
  value={formData.address}
  onChangeText={updateField("address")}
  placeholder="Enter your street address"  // <-- Update placeholder
/>
```

---

## Task 1: Rename Field Label

### Changes Required

**File:** `mobile/feature/profile/screens/ShopEditProfileScreen.tsx`

```diff
<FormInput
-  label="Street Address"
+  label="Shop Address"
  icon={<Ionicons name="location-outline" size={20} color={PROFILE_COLORS.primary} />}
  value={formData.address}
  onChangeText={updateField("address")}
-  placeholder="Enter your street address"
+  placeholder="Enter your shop address"
/>
```

### Testing
- [ ] Verify label shows "Shop Address" instead of "Street Address"
- [ ] Verify placeholder text is updated

---

## Task 2: Add Address Autocomplete/Suggestion Feature

### Implementation Options

#### Option A: OpenStreetMap Nominatim (Free, No API Key)

**Pros:**
- Free to use
- No API key required
- Same API used by web version

**Cons:**
- Rate limited (1 request/second)
- Less accurate than Google Places

**Implementation:**
```typescript
// Search for address suggestions
const searchAddress = async (query: string) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
  );
  const results = await response.json();
  return results.map((r: any) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
};
```

#### Option B: Google Places Autocomplete (Recommended for Production)

**Pros:**
- More accurate suggestions
- Better coverage
- Industry standard

**Cons:**
- Requires API key
- Has usage costs (free tier available)

**Library:** `react-native-google-places-autocomplete`

```bash
npm install react-native-google-places-autocomplete
```

### UI Design

```
┌─────────────────────────────────────────┐
│ Shop Address                            │
├─────────────────────────────────────────┤
│ 📍  asista, Pangasinan...          ✕   │
├─────────────────────────────────────────┤
│ 📍  Asista, Pangasinan, Ilocos Region  │ ← Suggestion 1
│ 📍  Asista Road, Santa Barbara         │ ← Suggestion 2
│ 📍  Asista Street, Dagupan City        │ ← Suggestion 3
└─────────────────────────────────────────┘
```

**Features:**
- Debounced search (300ms delay to avoid too many API calls)
- Show loading indicator while fetching
- Display up to 5 suggestions
- Tap suggestion to auto-fill address
- Clear button to reset input

### Component Structure

**New Component:** `mobile/components/ui/AddressAutocomplete.tsx`

```typescript
interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: {
    displayName: string;
    lat: number;
    lng: number;
  }) => void;
  placeholder?: string;
}
```

### Integration with Location Picker

When user selects an address from suggestions:
1. Auto-fill the address field
2. Update the location coordinates (lat/lng)
3. Optionally update the map pin in LocationPickerModal

```typescript
const handleSelectAddress = (address: AddressSuggestion) => {
  updateField("address")(address.displayName);
  setFormData((prev) => ({
    ...prev,
    location: {
      ...prev.location,
      lat: address.lat.toString(),
      lng: address.lng.toString(),
    },
  }));
};
```

---

## Files to Create/Modify

### New Component
- `mobile/components/ui/AddressAutocomplete.tsx`

### Modifications
- `mobile/feature/profile/screens/ShopEditProfileScreen.tsx`
  - Change label from "Street Address" to "Shop Address"
  - Replace FormInput with AddressAutocomplete component
- `mobile/feature/profile/hooks/ui/useShopEditProfile.ts`
  - Add handler for address selection with coordinates

---

## Testing Checklist

### Task 1: Rename
- [ ] Label shows "Shop Address"
- [ ] Placeholder shows "Enter your shop address"

### Task 2: Autocomplete
- [ ] Typing in address field triggers suggestions after 300ms
- [ ] Suggestions appear in dropdown below input
- [ ] Loading indicator shows while fetching
- [ ] Tapping suggestion fills address and updates coordinates
- [ ] Clear button resets input
- [ ] Suggestions dismiss when tapping outside
- [ ] Works offline gracefully (shows error or falls back to manual entry)
- [ ] Rate limiting handled properly (Nominatim: 1 req/sec)

---

## Dependencies

### Option A (Nominatim)
No additional dependencies - uses native `fetch`

### Option B (Google Places)
```json
"react-native-google-places-autocomplete": "^2.5.6"
```
Requires `GOOGLE_PLACES_API_KEY` in environment

---

## Notes

- Consider caching recent searches for offline use
- Debounce is critical to avoid API rate limits
- Match styling with existing FormInput component (dark theme, yellow accents)
- Address autocomplete should also work on Shop Registration screen for consistency
