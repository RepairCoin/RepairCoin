# Mobile Shop Profile - Phone Number Country Code

## Priority: Medium
## Status: Open
## Requested By: Sir Zeff
## Assignee: Mobile Developer
## Platform: Mobile Only

## Feature Request

Add country code selection/prefix to the phone number field in the mobile Shop Edit Profile screen. This feature already exists on the web version and needs to be implemented on mobile for platform parity.

## Current Behavior (Mobile)

- Phone number field accepts raw input without country code
- No validation for international format
- Users may enter numbers in various formats (e.g., "09171234567", "+639171234567", "917-123-4567")
- Inconsistent with web version which has country code selector

## Desired Behavior

- Phone input should include a country code selector/dropdown (matching web implementation)
- Default to Philippines (+63)
- Store phone numbers in E.164 international format (e.g., "+639171234567")
- Display formatted phone numbers with country code

## Reference

**Web implementation already exists** - refer to web Shop Profile for expected behavior and UI pattern.

## Affected Screens

### Mobile
- [ ] Shop Edit Profile (`mobile/feature/profile/screens/ShopEditProfileScreen.tsx`) - **Primary**
- [ ] Shop Registration (`mobile/feature/register/screens/ShopRegisterScreen.tsx`) - Optional, for consistency

## Implementation

### UI Pattern (Match Web)

```
┌─────────────┬────────────────────────┐
│ 🇵🇭 +63  ▼ │ 917 123 4567           │
└─────────────┴────────────────────────┘
```

- Country flag + code dropdown on the left
- Phone number input on the right
- Match the styling and behavior of web implementation

## Recommended Libraries (React Native)

- `react-native-phone-number-input` - Popular, customizable, includes country flags
- `react-native-phone-input` - Lightweight alternative

## Technical Implementation

### 1. Create Reusable Phone Input Component

**Location:** `mobile/components/ui/PhoneInput.tsx`

```typescript
interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string; // ISO country code, e.g., "PH"
  placeholder?: string;
  error?: string;
}
```

### 2. Update Shop Edit Profile Screen

**File:** `mobile/feature/profile/screens/ShopEditProfileScreen.tsx`

Replace current phone FormInput with new PhoneInput component:
```typescript
// Before
<FormInput
  label="Phone Number"
  icon={<Feather name="phone" size={20} color={PROFILE_COLORS.primary} />}
  value={formData.phone}
  onChangeText={updateField("phone")}
  placeholder="Enter your phone number"
  keyboardType="phone-pad"
/>

// After
<PhoneInput
  label="Phone Number"
  value={formData.phone}
  onChange={updateField("phone")}
  defaultCountry="PH"
  placeholder="917 123 4567"
/>
```

### 3. Storage Format

Store in E.164 format: `+[country code][number]`
- Example: `+639171234567` (Philippines)

No backend changes needed - web already handles this format.

## UI/UX Considerations

1. **Default Country:** Philippines (+63) - primary market
2. **Flag Icons:** Show country flag next to code (match web)
3. **Search:** Allow searching countries by name in dropdown
4. **Formatting:** Auto-format as user types
5. **Styling:** Match existing dark theme with yellow accents
6. **Consistency:** Must look and behave like web version

## Testing Checklist

- [ ] Test phone input on shop edit profile (mobile)
- [ ] Verify country code dropdown displays with flag icons
- [ ] Verify default country is Philippines (+63)
- [ ] Verify country search/selection works
- [ ] Verify phone number auto-formats as user types
- [ ] Verify phone validation rejects invalid numbers
- [ ] Verify E.164 format is saved to database
- [ ] Verify existing phone numbers with country code display correctly
- [ ] Verify existing phone numbers without country code are handled gracefully
- [ ] Compare behavior with web version for consistency

## Files to Create/Modify

### New Component
- `mobile/components/ui/PhoneInput.tsx`

### Modifications
- `mobile/feature/profile/screens/ShopEditProfileScreen.tsx` - Replace phone FormInput with PhoneInput

## Dependencies to Add

```json
"react-native-phone-number-input": "^2.1.0"
```

## Notes

- Reference web implementation for expected behavior
- Phone numbers should be clickable to initiate calls (tel: link)
- Ensure styling matches the existing form design (dark theme, yellow accents)
