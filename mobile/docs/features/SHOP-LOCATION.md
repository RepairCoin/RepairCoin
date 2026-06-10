# Shop Location

## Overview

The Shop Location feature allows shop owners to set and update their physical address and pin their location on a map. Customers use this to find shops nearby via the Find Shop / map feature.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Implemented (part of shop profile) |
| Mobile (React Native) | Not implemented as a dedicated settings screen |

## Features

- Display current saved address and map pin
- Edit mode: type a new address or pick location on an interactive map
- Map picker uses Google Maps / LocationPicker integration
- Saves `address` (text) and `location` (`lat`, `lng`) to shop profile
- After saving, customer-facing Find Shop map reflects the new pin

## Data Fields

```ts
{
  address: string;       // Human-readable address
  location: {
    lat: number;
    lng: number;
  }
}
```

## API

Location is saved as part of the shop profile update:

`PUT /api/shops/profile` — includes `address` and `location` fields

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/ShopLocationTab.tsx`
- Map component: `frontend/src/components/maps/LocationPickerWrapper.tsx`

## Mobile Notes

The mobile app has a shop profile edit screen (`ShopEditProfileScreen.tsx`) but it does not include a map picker or dedicated location update flow. The address field may exist as plain text input only.
