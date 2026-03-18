# Enhancement: Create Skeleton Loading Components

**Status:** ✅ Completed
**Completed:** 2026-03-13
**Priority:** HIGH
**Est. Effort:** 1-2 hours
**Created:** 2026-03-13

---

## Problem

All screens use basic ActivityIndicator spinners. Skeleton screens provide better perceived performance.

## Current State

- No skeleton components exist
- All 15+ screens use ActivityIndicator
- Users see blank screen with spinner

## Components to Create

### 1. SkeletonBox

Base shimmer component:

```tsx
// shared/components/ui/SkeletonBox.tsx
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming
} from "react-native-reanimated";

type SkeletonBoxProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
};

export function SkeletonBox({
  width = "100%",
  height = 20,
  borderRadius = 4
}: SkeletonBoxProps) {
  // Shimmer animation
  return (
    <View
      className="bg-zinc-800 overflow-hidden"
      style={{ width, height, borderRadius }}
    >
      {/* Shimmer overlay */}
    </View>
  );
}
```

### 2. SkeletonServiceCard

For marketplace services:

```tsx
// shared/components/ui/SkeletonServiceCard.tsx
export function SkeletonServiceCard() {
  return (
    <View className="bg-zinc-900 rounded-xl p-4 mb-4">
      <SkeletonBox height={150} borderRadius={12} /> {/* Image */}
      <SkeletonBox width="70%" height={20} className="mt-3" /> {/* Title */}
      <SkeletonBox width="50%" height={16} className="mt-2" /> {/* Price */}
      <SkeletonBox width="30%" height={14} className="mt-2" /> {/* Rating */}
    </View>
  );
}
```

### 3. SkeletonListItem

For customer lists, transactions:

```tsx
export function SkeletonListItem() {
  return (
    <View className="flex-row items-center p-4 border-b border-zinc-800">
      <SkeletonBox width={48} height={48} borderRadius={24} /> {/* Avatar */}
      <View className="flex-1 ml-3">
        <SkeletonBox width="60%" height={16} /> {/* Name */}
        <SkeletonBox width="40%" height={14} className="mt-2" /> {/* Subtitle */}
      </View>
      <SkeletonBox width={60} height={20} /> {/* Badge/Amount */}
    </View>
  );
}
```

### 4. SkeletonList

List wrapper with multiple items:

```tsx
export function SkeletonList({ count = 5, ItemComponent = SkeletonListItem }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </View>
  );
}
```

## Screens to Update

| Screen | Skeleton Type |
|--------|---------------|
| ServicesTabContent | SkeletonServiceCard x 4 |
| CustomerListScreen | SkeletonListItem x 5 |
| ShopHistoryScreen | SkeletonListItem x 5 |
| CustomerHistoryScreen | SkeletonListItem x 5 |
| NotificationScreen | SkeletonListItem x 5 |
| GroupsScreen | SkeletonListItem x 3 |
| MessagesScreen | SkeletonListItem x 5 |

## Dependencies

May need `react-native-reanimated` for shimmer animation (already installed).

## Verification Checklist

- [ ] SkeletonBox component created with shimmer
- [ ] SkeletonServiceCard matches service card layout
- [ ] SkeletonListItem matches list item layout
- [ ] Skeleton shows instead of spinner on initial load
- [ ] Smooth transition from skeleton to real content
- [ ] Works on iOS and Android
