# Bug: "Server error. Please try again later." toast on customer home — trending services query returns 500

**Status:** Completed
**Priority:** High
**Est. Effort:** 15 minutes
**Created:** 2026-04-20
**Updated:** 2026-04-22
**Completed:** 2026-04-22

---

## Problem

Customer home screen showed red "Server error" toasts on mount and focus. The trending services endpoint (`GET /api/services/discovery/trending`) returned HTTP 500 due to a PostgreSQL 42803 error.

## Root Cause

The `groups` subquery in `getTrendingServices` referenced `s.shop_id` from the outer query, but `s.shop_id` was not in the outer `GROUP BY` clause. Postgres rejected it as an ungrouped column even though `s.shop_id = sh.shop_id` via the INNER JOIN — Postgres does not infer functional dependency across joins.

## Fix

| File | Change |
|------|--------|
| `backend/src/domains/ServiceDomain/controllers/DiscoveryController.ts` | Added `s.shop_id` to the `GROUP BY` clause in `getTrendingServices` |

Single-line change. No other methods in this file are affected — sibling methods (`getRecentlyViewed`, `getSimilarServices`) don't use GROUP BY.

## Verification

- `GET /api/services/discovery/trending?limit=4&days=7` returns HTTP 200 with data
- Customer home screen loads with no error toast
- Trending section renders services correctly
- Regression: `/services/discovery/recently-viewed` and `/services/discovery/similar/:serviceId` still return 200
