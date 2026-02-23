# Comprehensive Rapid Refresh Fix Strategy

## Problem Statement

When users refresh the shop dashboard page (single or rapid refresh), the page shows "Loading dashboard data..." for 2+ minutes before content loads. The sidebar renders but content area is stuck loading.

**Observed Behavior:**
- Sidebar renders correctly (auth works)
- Breadcrumb shows correct tab name
- Content area shows "Loading dashboard data..." spinner
- Takes 2+ minutes to load content
- Issue persists across all tabs (Profile, Services, Settings, Overview)

**Root Cause Analysis:**

The current flow has multiple blocking points:

```
Page Load
    ↓
ThirdwebProvider initializes (can be slow - connects to blockchain)
    ↓
useActiveAccount() returns undefined initially
    ↓
useAuthInitializer runs but account is undefined
    ↓
Waits for Thirdweb to restore wallet connection
    ↓
Once account available, checks session
    ↓
Sets userProfile in Zustand
    ↓
ShopDashboardClient useEffect triggers
    ↓
loadShopData() called
    ↓
Makes 4 sequential API calls
    ↓
Finally sets shopData
```

**Key Issues:**
1. **Thirdweb wallet restoration is slow** - Can take 10-30+ seconds on refresh
2. **Sequential dependencies** - Auth → Profile → Shop Data (waterfall)
3. **No parallel execution** - Each step waits for previous
4. **Cache not being used** - shopId not available early enough
5. **Multiple API calls** - 4 sequential requests in loadShopData

---

## Solution Strategy

### Phase 1: Decouple from Thirdweb Wallet State

**Problem:** We wait for Thirdweb to restore wallet connection before checking session.

**Solution:** Check session immediately on protected routes, don't wait for wallet.

**Implementation:**

```typescript
// useAuthInitializer.ts - Run session check immediately, not after wallet
useEffect(() => {
  const initializeAuth = async () => {
    const isProtectedRoute = typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/shop') ||
       window.location.pathname.startsWith('/customer') ||
       window.location.pathname.startsWith('/admin'));

    // IMMEDIATELY check session on protected routes
    // Don't wait for wallet - session cookies are sufficient
    if (isProtectedRoute) {
      // Check cache first
      const cached = getCachedSession();
      if (cached) {
        setUserProfile(cached);
        setAuthInitialized(true);
        return; // Done - no need to wait for wallet
      }

      // No cache - check session API
      const session = await authApi.getSession();
      if (session.isValid && session.user) {
        setUserProfile(buildProfile(session.user));
        setCachedSession(profile);
        setAuthInitialized(true);
        return; // Done - no need to wait for wallet
      }
    }

    // Only reach here if not on protected route or no session
    // Now we can wait for wallet state
  };

  initializeAuth();
}, []); // Run once on mount, not on account change
```

### Phase 2: Parallel Data Loading

**Problem:** Shop data loads after auth completes (waterfall).

**Solution:** Start loading shop data in parallel with auth using shopId from URL or cache.

**Implementation:**

```typescript
// ShopDashboardClient.tsx - Load from cache immediately on mount
useEffect(() => {
  // Try to load shopId from multiple sources
  const shopIdFromCache = getShopIdFromCache();
  const shopIdFromProfile = userProfile?.shopId;
  const shopId = shopIdFromCache || shopIdFromProfile;

  if (shopId) {
    // Load cached shop data immediately
    const cachedShop = getCachedShopData(shopId);
    if (cachedShop) {
      setShopData(cachedShop);
      // Background refresh
      refreshShopDataInBackground(shopId);
    } else {
      loadShopData();
    }
  }
}, []); // Run once on mount
```

### Phase 3: Persistent Shop ID

**Problem:** shopId is only available after auth completes.

**Solution:** Store shopId in sessionStorage after first successful load.

**Implementation:**

```typescript
// Store shopId when we get it
function setShopIdCache(shopId: string): void {
  sessionStorage.setItem('rc_shop_id', shopId);
}

function getShopIdFromCache(): string | null {
  return sessionStorage.getItem('rc_shop_id');
}

// In loadShopData success:
if (shopResult.data.shopId) {
  setShopIdCache(shopResult.data.shopId);
  setCachedShopData(shopResult.data.shopId, enhancedShopData);
}
```

### Phase 4: Optimistic UI with Skeletons

**Problem:** User sees loading spinner for entire content area.

**Solution:** Show skeleton UI immediately, fill in data as it arrives.

**Implementation:**

```typescript
// Instead of:
{!shopData && activeTab !== "overview" && (
  <div>Loading dashboard data...</div>
)}

// Use:
{activeTab === "profile" && (
  <ProfileTab
    shopId={shopData?.shopId || getShopIdFromCache()}
    shopData={shopData}
    isLoading={!shopData}
  />
)}

// ProfileTab renders skeleton when shopData is null
```

### Phase 5: Reduce API Calls

**Problem:** loadShopData makes 4 sequential API calls.

**Solution:** Parallelize independent calls, defer non-critical ones.

**Implementation:**

```typescript
const loadShopData = async () => {
  // 1. Load core shop data first
  const shopResult = await apiClient.get(shopEndpoint);

  if (shopResult.success && shopResult.data) {
    // Set shop data immediately (don't wait for other calls)
    setShopData(shopResult.data);
    setCachedShopData(shopResult.data.shopId, shopResult.data);

    // 2. Load additional data in parallel (non-blocking)
    Promise.all([
      apiClient.get(`/shops/subscription/status`),
      apiClient.get(`/shops/purchase/history/${shopId}`),
      apiClient.get(`/shops/tier-bonus/stats/${shopId}`)
    ]).then(([subResult, purchaseResult, tierResult]) => {
      // Update state with additional data
      if (subResult.success) {
        setShopData(prev => ({ ...prev, ...subResult.data }));
      }
      // ... etc
    });
  }
};
```

---

## Implementation Plan

### Step 1: Add Shop ID Caching (Quick Win)

File: `frontend/src/components/shop/ShopDashboardClient.tsx`

```typescript
// Add near top of file
const SHOP_ID_CACHE_KEY = 'rc_shop_id';

function getShopIdFromCache(): string | null {
  try {
    return sessionStorage.getItem(SHOP_ID_CACHE_KEY);
  } catch { return null; }
}

function setShopIdCache(shopId: string): void {
  try {
    sessionStorage.setItem(SHOP_ID_CACHE_KEY, shopId);
  } catch {}
}
```

### Step 2: Update loadShopData to Use Cache

```typescript
const loadShopData = async (forceRefresh = false) => {
  // Try multiple sources for shopId
  const shopIdFromSession = userProfile?.shopId;
  const shopIdFromCache = getShopIdFromCache();
  const shopId = shopIdFromSession || shopIdFromCache;
  const walletAddress = account?.address || userProfile?.address;

  // If we have a shopId, try cache first
  if (!forceRefresh && shopId) {
    const cached = getCachedShopData(shopId);
    if (cached) {
      console.log('[ShopDashboard] ⚡ Using cached shop data');
      setShopData(cached);
      // Background refresh
      refreshShopDataInBackground(shopId, walletAddress);
      return;
    }
  }

  // No cache or no shopId - need to load from API
  // But don't wait if we don't have an identifier yet
  if (!shopId && !walletAddress) {
    console.log('[ShopDashboard] No identifier available yet');
    return; // Will retry when userProfile is set
  }

  setLoading(true);
  // ... rest of loading logic
};
```

### Step 3: Update useAuthInitializer for Immediate Session Check

```typescript
// Run immediately on mount for protected routes
useEffect(() => {
  const checkSessionImmediately = async () => {
    const isProtectedRoute = /* ... */;

    if (isProtectedRoute) {
      // 1. Check cache (instant)
      const cached = getCachedSession();
      if (cached) {
        setUserProfile(cached);
        setAuthInitialized(true);
        return;
      }

      // 2. Check session API (doesn't need wallet)
      try {
        const session = await authApi.getSession();
        if (session.isValid && session.user) {
          const profile = buildProfile(session.user);
          setUserProfile(profile);
          setCachedSession(profile);
          setAuthInitialized(true);
          return;
        }
      } catch {}
    }

    // Mark as initialized even if no session (let dashboard handle redirect)
    setAuthInitialized(true);
  };

  checkSessionImmediately();
}, []); // Run once on mount
```

### Step 4: Update Shop Dashboard Initial Load

```typescript
// Add new useEffect that runs immediately on mount
useEffect(() => {
  const shopId = getShopIdFromCache();
  if (shopId) {
    const cached = getCachedShopData(shopId);
    if (cached) {
      console.log('[ShopDashboard] ⚡ Immediate cache hit on mount');
      setShopData(cached);
    }
  }
}, []); // Empty deps - run once on mount

// Existing useEffect now only handles fresh loads
useEffect(() => {
  if (!shopData) { // Only load if we don't have data yet
    const walletAddress = account?.address || userProfile?.address;
    const shopId = userProfile?.shopId || getShopIdFromCache();

    if (walletAddress || shopId) {
      loadShopData();
    }
  }
}, [account?.address, userProfile?.address, userProfile?.shopId]);
```

---

## Testing Checklist

After implementation:

- [ ] First load works normally (data loads from API)
- [ ] Single refresh loads instantly from cache
- [ ] Rapid refresh (10+ times) loads instantly
- [ ] Logout and login works correctly
- [ ] Different shop accounts don't see wrong data
- [ ] Cache expires after TTL (data refreshes)
- [ ] Console shows cache hit/miss logs

---

## Rollback Plan

If issues occur:

```bash
# Revert changes
git checkout HEAD~1 -- frontend/src/components/shop/ShopDashboardClient.tsx
git checkout HEAD~1 -- frontend/src/hooks/useAuthInitializer.ts
```

---

## Success Metrics

- Page refresh load time: < 1 second (from 2+ minutes)
- No "Loading dashboard data..." spinner on refresh
- User sees content immediately with skeleton states
- Console shows: `[ShopDashboard] ⚡ Using cached shop data`
