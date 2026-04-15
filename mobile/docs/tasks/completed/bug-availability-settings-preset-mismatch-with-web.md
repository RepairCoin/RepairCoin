# Bug: Availability Settings Presets Don't Cover All Web Values

## Status: Fixed

## Priority: Medium

## Date: 2026-04-06

## Category: Bug - UX Inconsistency (Web vs Mobile)

## Affected: Shop availability settings (mobile)

---

## Overview

The mobile Availability Settings uses preset button options for all configuration fields, while the web uses free-form number inputs. If a shop sets a value on web that doesn't match a mobile preset (e.g., Buffer Time = 20 minutes), the mobile can't display it (no button highlighted) and saving from mobile would overwrite it with a preset value.

---

## Comparison

| Setting            | Web Input   | Mobile Presets                  | Mismatch Example                             |
| ------------------ | ----------- | ------------------------------- | -------------------------------------------- |
| Slot Duration      | Free number | `[15, 30, 45, 60, 90, 120]` min | Web sets 50m → mobile shows nothing selected |
| Buffer Time        | Free number | `[0, 5, 10, 15, 30]` min        | Web sets 20m → mobile shows nothing selected |
| Max Concurrent     | Free number | `[1, 2, 3, 4, 5]`               | Web sets 10 → mobile shows nothing selected  |
| Advance Booking    | Free number | `[7, 14, 30, 60, 90]` days      | Web sets 10d → mobile shows nothing selected |
| Min Booking Notice | Free number | `[0, 1, 2, 4, 12, 24]` hours    | Web sets 3h → mobile shows nothing selected  |

### What Happens With Mismatched Values

1. Shop sets Buffer Time to **20 minutes** on web
2. Shop opens Availability Settings on mobile
3. No preset button is highlighted (20 is not in `[0, 5, 10, 15, 30]`)
4. Shop taps "Save & Done" without changing anything
5. Mobile sends default/previously-tapped value → **overwrites 20m with a preset**

---

## Recommended Fix: Hybrid Approach

Replace preset-only buttons with **presets + custom input**. Show the preset buttons as quick-select shortcuts, but also allow a custom value via a number input.

### Implementation

Replace the `SettingCard` component with a hybrid version:

```tsx
function SettingCard({
  title,
  description,
  options,
  selectedValue,
  onSelect,
  suffix,
  min,
  max,
}) {
  const isCustom = !options.includes(selectedValue);
  const [customMode, setCustomMode] = useState(isCustom);
  const [customValue, setCustomValue] = useState(String(selectedValue));

  return (
    <View>
      <Text>{title}</Text>
      <Text>{description}</Text>

      {/* Preset buttons */}
      <View className="flex-row gap-2">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => {
              setCustomMode(false);
              onSelect(option);
            }}
            className={
              selectedValue === option && !customMode
                ? "bg-[#FFCC00]"
                : "bg-[#252525]"
            }
          >
            <Text>
              {option}
              {suffix}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Custom button */}
        <TouchableOpacity
          onPress={() => setCustomMode(true)}
          className={customMode ? "bg-[#FFCC00]" : "bg-[#252525]"}
        >
          <Text>Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Custom input - shown when value doesn't match presets or user taps Custom */}
      {customMode && (
        <TextInput
          value={customValue}
          onChangeText={(text) => {
            setCustomValue(text);
            const num = parseInt(text);
            if (!isNaN(num) && num >= min && num <= max) onSelect(num);
          }}
          keyboardType="numeric"
          placeholder={`Enter ${suffix || "value"}`}
        />
      )}

      {/* Show current value if it doesn't match any preset */}
      {isCustom && !customMode && (
        <Text>
          Current: {selectedValue}
          {suffix} (set via web)
        </Text>
      )}
    </View>
  );
}
```

### Why This Approach

- **Preserves quick-select UX** — common values are one tap
- **Supports any value** — matches web's free input capability
- **Shows current value** — if set via web, displays the actual value even if it's not a preset
- **Prevents data loss** — opening and saving won't silently overwrite custom values
- **Low effort** — only changes the `SettingCard` component, no backend changes needed

### Alternative Approaches Considered

| Approach                        | Pros                | Cons                                |
| ------------------------------- | ------------------- | ----------------------------------- |
| **Add more presets**            | Simple              | Can never cover all possible values |
| **Switch to number input only** | Matches web exactly | Loses the quick-select mobile UX    |
| **Hybrid (recommended)**        | Best of both        | Slightly more complex UI            |

---

## Files to Modify

| File                                                              | Change                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `mobile/feature/service/components/AvailabilityModal.tsx:391-421` | Update `SettingCard` to support hybrid preset + custom input |

---

## QA Test Plan

### Mismatch scenario

1. On web, set Buffer Time to **20 minutes** and save
2. Open mobile Availability Settings
3. **Before fix**: No button highlighted, saving would overwrite
4. **After fix**: Shows "Custom" selected with value "20m" displayed

### Preset scenario

1. On mobile, tap "15m" for Buffer Time → saves correctly
2. On web, verify value is 15 minutes

### Custom input scenario

1. On mobile, tap "Custom" for Advance Booking
2. Enter "10" → saves as 10 days
3. On web, verify value is 10 days

### Round-trip test

1. Set all fields to non-preset values on web (e.g., 20m buffer, 10d advance, 3h notice)
2. Open mobile settings → verify all values display correctly
3. Change one field on mobile → save
4. Verify other fields were NOT overwritten
5. Check web → all values intact
