# Phone Input with Country Code Prefix - Implementation Plan

## Overview
Convert the phone input field in SettingsTab to a country-aware phone input with:
- Country selector dropdown with flags and dial codes (from API)
- Local number input field
- Phone number validation per country format
- Store as single combined field in existing `phone` column

## Implementation Steps

### Step 1: Install Dependencies
```bash
cd frontend && npm install libphonenumber-js
```
- `libphonenumber-js`: Google's libphonenumber port for validation and formatting

### Step 2: Create Country Data Service
**File**: `frontend/src/services/countryService.ts`
- Fetch country data from RestCountries API (`https://restcountries.com/v3.1/all`)
- Extract: country name, ISO code (cca2), dial code, flag emoji
- Cache results to avoid repeated API calls
- Fallback to common countries if API fails

### Step 3: Create CountryPhoneInput Component
**File**: `frontend/src/components/ui/CountryPhoneInput.tsx`

**Features**:
- Dropdown with searchable country list (flag + name + dial code)
- Local number input with placeholder based on selected country
- Real-time validation using `libphonenumber-js`
- Error message display for invalid numbers
- Disabled state support for view mode
- Parse existing phone numbers to detect country code

**Props**:
```typescript
interface CountryPhoneInputProps {
  value: string;                    // Combined phone: "+1-5551234567"
  onChange: (phone: string) => void; // Returns combined format
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}
```

**Internal State**:
```typescript
{
  countryCode: string;   // "+1"
  countryIso: string;    // "US"
  localNumber: string;   // "5551234567"
  isValid: boolean;
  errorMessage: string;
}
```

### Step 4: Update SettingsTab
**File**: `frontend/src/components/shop/tabs/SettingsTab.tsx`

Changes:
- Import `CountryPhoneInput` component
- Replace plain `<input type="tel">` with `<CountryPhoneInput>`
- Keep `shopFormData.phone` as string (no structure change)
- Component handles parsing/combining internally

### Step 5: Phone Storage Format
Store in existing `phone` field as: `+{dialCode}-{localNumber}`
- Example: `+1-5551234567` (US)
- Example: `+44-7911123456` (UK)
- Example: `+63-9171234567` (Philippines)

### Step 6: Validation Rules
Using `libphonenumber-js`:
- Validate number is possible for selected country
- Validate number length matches country format
- Show specific error messages:
  - "Phone number is too short"
  - "Phone number is too long"
  - "Invalid phone number for this country"

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | Modify | Add `libphonenumber-js` dependency |
| `frontend/src/services/countryService.ts` | Create | API service for country data |
| `frontend/src/components/ui/CountryPhoneInput.tsx` | Create | New phone input component |
| `frontend/src/components/shop/tabs/SettingsTab.tsx` | Modify | Use new phone input component |

## UI Mockup
```
Phone Number
┌─────────────────────┐ ┌────────────────────────────────┐
│ 🇺🇸 United States ▼ │ │ (555) 123-4567                 │
└─────────────────────┘ └────────────────────────────────┘
                         ✓ Valid phone number

On dropdown open:
┌─────────────────────────────┐
│ 🔍 Search countries...      │
├─────────────────────────────┤
│ 🇺🇸 United States    +1    │
│ 🇬🇧 United Kingdom   +44   │
│ 🇵🇭 Philippines      +63   │
│ 🇨🇦 Canada           +1    │
│ ...                         │
└─────────────────────────────┘
```

## API Details

**RestCountries API Endpoint**:
```
GET https://restcountries.com/v3.1/all?fields=name,cca2,idd,flag
```

**Response Structure**:
```json
{
  "name": { "common": "United States" },
  "cca2": "US",
  "idd": { "root": "+1", "suffixes": [""] },
  "flag": "🇺🇸"
}
```

## Backwards Compatibility
- Existing phone numbers without country code will default to US (+1)
- Component parses incoming value to detect existing country code
- No database migration required
