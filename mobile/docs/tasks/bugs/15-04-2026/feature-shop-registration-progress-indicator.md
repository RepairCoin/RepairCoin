# Feature: Add Progress Indicator to Shop Registration Multi-Step Form

## Status: Open
## Priority: Low
## Date: 2026-04-15
## Category: Enhancement - UX
## Platform: Mobile (React Native / Expo)
## Affects: Shop registration flow (5-slide form)

---

## Problem

The shop registration form has 5 slides but no visual indicator showing which step the user is on or how many steps remain. Users don't know if they're on step 2 of 5 or 4 of 5, which creates uncertainty and may cause abandonment.

---

## Current Slides

| Slide | Component | Title |
|---|---|---|
| 1 | FirstSlide | Personal Info |
| 2 | SecondSlide | Business Info |
| 3 | ThirdSlide | Location & Wallet |
| 4 | SocialMediaSlide | Social Media |
| 5 | FourthSlide | Review & Submit |

---

## Fix Required

Add a step progress bar below the header on each slide showing current position (e.g., "Step 2 of 5" with dots or a progress bar).

**File:** `mobile/feature/register/screens/ShopRegisterScreen.tsx`

Add a progress component that receives the current `index` and total slides:

```tsx
const StepProgress = ({ current, total }: { current: number; total: number }) => (
  <View className="flex-row items-center justify-center gap-2 py-3 px-6">
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        className={`h-1.5 rounded-full flex-1 ${
          i <= current ? 'bg-[#FFCC00]' : 'bg-gray-700'
        }`}
      />
    ))}
  </View>
);
```

Render above each slide:
```tsx
<StepProgress current={index} total={slides.length} />
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/feature/register/screens/ShopRegisterScreen.tsx` | Add progress bar component above FlatList or inside each slide |

---

## QA Verification

- [ ] Progress bar visible on all 5 slides
- [ ] Current step highlighted (filled/yellow)
- [ ] Future steps dimmed (gray)
- [ ] Progress updates when advancing or going back
- [ ] Step count text shows "Step X of 5" (optional)
