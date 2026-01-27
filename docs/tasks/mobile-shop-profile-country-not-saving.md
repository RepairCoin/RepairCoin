# Mobile Shop Profile - Country Field Not Saving

## Priority: Medium
## Status: Open
## Assignee: Backend Developer
## Platform: Mobile (Shop Edit Profile)

## Problem

When a shop owner edits their profile on the mobile app and enters a value in the **Country** field, the value is not persisted after saving. Upon revisiting the Edit Profile screen, the Country field shows the placeholder "Enter your country" instead of the saved value.

**Steps to Reproduce:**
1. Open mobile app as a shop owner
2. Navigate to Edit Profile
3. Enter "Philippines" in the Country field
4. Click "Save Changes"
5. Return to Edit Profile
6. **Expected:** Country field shows "Philippines"
7. **Actual:** Country field shows placeholder "Enter your country"

## Root Cause

The backend `PUT /shops/:shopId/details` endpoint does **NOT** handle the `country` field.

### Backend Issue (`backend/src/domains/shop/routes/index.ts` lines 564-579)

The endpoint extracts these fields from `req.body`:
```typescript
const {
  name,
  email,
  phone,
  address,
  website,
  openingHours,
  ownerName,
  location,
  facebook,
  twitter,
  instagram,
  firstName,
  lastName,
  logoUrl,
  // MISSING: country
  // MISSING: city (as top-level field)
} = req.body;
```

**`country` is NOT extracted, so it's never saved.**

### Secondary Issue: `city` Field Mismatch

The mobile app sends `city` as a **top-level** field:
```typescript
// Mobile formData structure
{
  city: "Sta. Rosa City",      // <-- Top-level
  country: "Philippines",       // <-- Top-level
  location: {
    lat: "15.854224",
    lng: "120.413273",
    city: "",                   // <-- Also here but often empty
    state: "",
    zipCode: ""
  }
}
```

But the backend only reads `city` from `location.city` (line 646-648), not from the top-level field.

## Affected Files

### Backend
- `backend/src/domains/shop/routes/index.ts` (lines 564-579, 612-624)

### Mobile (Reference - No changes needed)
- `mobile/feature/profile/screens/ShopEditProfileScreen.tsx`
- `mobile/feature/profile/hooks/ui/useShopEditProfile.ts`
- `mobile/services/shop.services.ts`

### Repository (Already supports country)
- `backend/src/repositories/ShopRepository.ts` - Line 296 has `country: 'country'` mapping

## Solution Options

### Option A: Fix Backend to Handle Country & City (Add Missing Fields)

#### Fix 1: Add `country` to extracted fields (line 564-579)
```typescript
const {
  name,
  email,
  phone,
  address,
  city,        // ADD THIS
  country,     // ADD THIS
  website,
  openingHours,
  ownerName,
  location,
  facebook,
  twitter,
  instagram,
  firstName,
  lastName,
  logoUrl,
} = req.body;
```

#### Fix 2: Add `country` and `city` to updates object (after line 624)
```typescript
if (country !== undefined) updates.country = country;
if (city !== undefined) updates.locationCity = city;  // Map to location_city column
```

#### Fix 3: Update ShopData interface if needed
Ensure the `ShopData` interface includes `country` in the updates type (lines 596-611).

---

### Option B: Remove Country & City Fields (Recommended)

Since we already have a complete **Street Address** field that can include city/country information, and these fields are **NOT available on the web version**, we can remove them from mobile for consistency.

#### Rationale:
- **Street Address** field already captures full address (e.g., "asista, Pangasinan, Ilocos Region, 2422, Philippines")
- **City** and **Country** are redundant when full address is provided
- **Web version** does not have these fields - removing them creates platform parity
- Simplifies the form and reduces maintenance burden

#### Changes Required:

**Mobile - Remove from UI:**
- `mobile/feature/profile/screens/ShopEditProfileScreen.tsx`
  - Remove `<FormInput label="City" ... />` (lines 92-98)
  - Remove `<FormInput label="Country" ... />` (lines 100-106)

**Mobile - Remove from form data:**
- `mobile/feature/profile/hooks/ui/useShopEditProfile.ts`
  - Remove `city` from `formData` state (line 23)
  - Remove `country` from `formData` state (line 24)
  - Remove `city: shopData.location?.city || ""` from useEffect (line 49)
  - Remove `country: shopData.country || ""` from useEffect (line 50)

**Mobile - Update types:**
- `mobile/feature/profile/types/index.ts` (if exists)
  - Remove `city` and `country` from `ShopEditFormData` interface

**No backend changes needed** - backend will simply ignore these fields if not sent.

## Testing Checklist

### If Option A (Fix Backend):
- [ ] Edit shop profile on mobile
- [ ] Enter value in Country field
- [ ] Save changes
- [ ] Verify success message appears
- [ ] Return to Edit Profile
- [ ] Verify Country field shows saved value
- [ ] Repeat for City field
- [ ] Verify all other fields still save correctly (name, email, phone, address, etc.)

### If Option B (Remove Fields):
- [ ] Verify City and Country fields are removed from mobile Edit Profile screen
- [ ] Verify Street Address field still works correctly
- [ ] Verify all other fields still save correctly
- [ ] Verify no errors when saving profile
- [ ] Compare with web Edit Profile - confirm parity (both lack City/Country fields)

## Database Verification

The `country` column exists in the `shops` table and the repository already supports it:
```sql
-- Verify column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'shops' AND column_name = 'country';
```

## Notes

- The `ShopRepository.updateShop()` method already has the field mapping for `country` (line 296)
- No database migration needed - column already exists
- No mobile changes needed - mobile is sending the data correctly
