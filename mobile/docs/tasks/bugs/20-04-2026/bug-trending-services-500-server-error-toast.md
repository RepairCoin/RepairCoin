# Bug: "Server error. Please try again later." toast on customer home — trending services query returns 500

**Status:** Open
**Priority:** High
**Est. Effort:** 15 minutes (1-line backend fix + rebuild)
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

On the customer home screen (and intermittently on other screens that load trending services), the mobile app shows one or two overlapping red toasts: **"Server error. Please try again later."** The user is logged in successfully and can see their balance, tier, and services, but the toasts appear on mount and again on focus.

The errors surface on both **staging** and **production** builds — `origin/main` and `origin/prod` both ship the same buggy backend code.

---

## Root Cause

Backend SQL error in the trending-services endpoint.

- **Endpoint:** `GET /api/services/discovery/trending?limit=4&days=7`
- **File:** `backend/src/domains/ServiceDomain/controllers/DiscoveryController.ts` (`getTrendingServices`)
- **PostgreSQL error:** `42803 subquery uses ungrouped column "s.shop_id" from outer query`

The inner `groups` subquery references `s.shop_id` via:

```sql
LEFT JOIN shop_group_rcn_allocations alloc
  ON alloc.shop_id = s.shop_id AND alloc.group_id = sga.group_id
```

…but the outer query's `GROUP BY` clause only contains `sh.shop_id`, not `s.shop_id`. Even though `s.shop_id = sh.shop_id` via the `INNER JOIN`, Postgres does not infer functional dependency across joins in this context and rejects the subquery.

**Scope is limited to this single method.** The same expression `alloc.shop_id = s.shop_id` also appears inside subqueries at line 198 (`getRecentlyViewed`) and line 356 (`getSimilarServices`) in this file, but **those methods do not use `GROUP BY`**, so the 42803 error does not apply to them. Verified against staging: `/services/discovery/recently-viewed` and `/services/discovery/similar/:serviceId` both return HTTP 200. Only `getTrendingServices` needs a fix.

### Why multiple toasts appear

Only one backend endpoint is failing, but `mobile/shared/config/queryClient.ts:12` configures React Query to retry non-401/404 failures while `failureCount < 3`. Each retry is a fresh HTTP request producing a fresh error object. The axios interceptor at `mobile/shared/utilities/axios.ts:40-47` dedups via `error.__toastShown` **per error instance** — it does not dedup across retries. `react-native-toast-notifications` queues toasts rather than stacking them, so the user sees them appear one after another; the screenshot shows two visible at once because their durations overlap. The exact total number of toasts depends on retry timing and toast duration and has not been measured.

---

## Evidence

- Reproduced against `https://api-staging.repaircoin.ai/api/services/discovery/trending?limit=4&days=7` with a valid customer JWT — returns `HTTP 500 {"success":false,"error":"Failed to fetch trending services"}`
- The **exact controller query** executed directly against the staging Postgres cluster fails with `42803 subquery uses ungrouped column "s.shop_id"`
- The **exact controller query with only `s.shop_id` added to the GROUP BY** executes successfully, returns 4 rows, and the `groups` field populates correctly (e.g. `[{"groupId":"grp_b4274e…","customTokenSymbol":"AMS",...}]`)
- Sibling endpoints that share the `alloc.shop_id = s.shop_id` expression but have no outer `GROUP BY` return HTTP 200 on staging: `/services/discovery/recently-viewed`, `/services/discovery/similar/:serviceId`
- Other customer-home queries all return 2xx: `/customers/:address`, `/notifications/unread/count`, `/messages/unread/count`, `/services?...`, `/services/favorites`, `/customers/:address/overall-no-show-status`

---

## Fix Required

**File:** `backend/src/domains/ServiceDomain/controllers/DiscoveryController.ts` line 506

Add `s.shop_id` to the `GROUP BY` clause:

```diff
- GROUP BY s.service_id, s.service_name, s.description, s.price_usd, s.duration_minutes, s.category, s.image_url, s.tags, s.active, s.average_rating, s.review_count, sh.shop_id, sh.name, sh.address, sh.location_city, sh.country, sh.phone, sh.email, sh.verified, sh.location_lat, sh.location_lng, sh.location_state, sh.location_zip_code${favoritesGroupBy}
+ GROUP BY s.service_id, s.shop_id, s.service_name, s.description, s.price_usd, s.duration_minutes, s.category, s.image_url, s.tags, s.active, s.average_rating, s.review_count, sh.shop_id, sh.name, sh.address, sh.location_city, sh.country, sh.phone, sh.email, sh.verified, sh.location_lat, sh.location_lng, sh.location_state, sh.location_zip_code${favoritesGroupBy}
```

That is the entire code change. No other GROUP BY in this file needs modification.

### Follow-up (separate task, not in scope for this bug)

1. **Toast spam on retries** — `mobile/shared/utilities/axios.ts` should skip the toast when the request is going to be retried by React Query, or React Query should be configured with `retry: 0` for calls that already surface their own UI. One failing endpoint shouldn't produce multiple user-facing toasts for the same failure.
2. **Optional-content queries shouldn't break the UX** — the trending-services section is non-critical. Consider wrapping it with `useQuery({ throwOnError: false })` and suppressing the global toast when the query is a background enrichment fetch.

---

## Files to Modify

| File                                                                   | Change                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/domains/ServiceDomain/controllers/DiscoveryController.ts` | Add `s.shop_id` to the `GROUP BY` clause in `getTrendingServices` (line 506). Single-line change. No other methods in this file are affected. |

Mobile code does not need changes for the fix itself. The mobile app will immediately work once the backend is redeployed to staging, then to production.

---

## Verification Checklist

- [ ] Local `curl` against staging: `GET /api/services/discovery/trending?limit=4&days=7` returns HTTP 200 with a JSON array in `data`
- [ ] Same check against production after prod deploy
- [ ] Customer home screen in the mobile app loads with no "Server error" toast on mount
- [ ] Customer home remains toast-free on navigation away and back (focus refetch)
- [ ] Trending section actually renders services (no empty state where data should exist)
- [ ] Regression check: `/services/discovery/recently-viewed` and `/services/discovery/similar/:serviceId` still return HTTP 200 (they are currently healthy; ensure the edit didn't disturb them)

---

## Notes

- **Scope of impact:** Visible to every authenticated customer on the home screen in both staging and production builds.
- **Trigger context:** Observed during QA session on 2026-04-20 on a staging APK build after the main→prod deploy earlier the same day. Confirmed present on `origin/prod` and `origin/main`.
- **No mobile rebuild needed for the fix.** Once the backend PR lands on `main` → staging auto-deploy fixes the staging app. Merging `main` → `prod` (per `docs/tasks/strategy/staging-to-production-deployment.md`) fixes production.
- **Related:** The follow-up items above (toast dedup, optional-content UX) should be filed as separate enhancement tasks under `enhancements/` once this bug is closed.
