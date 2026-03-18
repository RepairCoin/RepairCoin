# Enhancement: Add Pull-to-Refresh to Home Screens

**Status:** ✅ Completed
**Completed:** 2026-03-17
**Priority:** MEDIUM
**Est. Effort:** 15 min
**Created:** 2026-03-13

---

## Problem

Home screens lack pull-to-refresh functionality, forcing users to navigate away and back to refresh data.

## Current State

- 19 screens already have RefreshControl
- Home screens are missing it (high-traffic screens)

## Screens to Update

| Screen | File |
|--------|------|
| Shop Home | `feature/home/screens/ShopHomeScreen.tsx` |
| Customer Home | `feature/home/screens/CustomerHomeScreen.tsx` |

## Implementation

```tsx
import { RefreshControl } from "react-native";

const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  await refetchData(); // refetch wallet balance, stats, etc.
  setIsRefreshing(false);
};

<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor="#FFCC00"
      colors={["#FFCC00"]}
    />
  }
>
  {/* content */}
</ScrollView>
```

## Verification Checklist

- [ ] Shop home screen has pull-to-refresh
- [ ] Customer home screen has pull-to-refresh
- [ ] Wallet balance refreshes on pull
- [ ] Stats/metrics refresh on pull
- [ ] Gold (#FFCC00) spinner color matches app theme
