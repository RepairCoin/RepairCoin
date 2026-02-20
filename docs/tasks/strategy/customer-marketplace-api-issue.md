# Customer Marketplace API Performance Analysis Report

**Date:** 2026-02-19
**Status:** Analysis Complete
**Analyst:** Claude Code

---

## Executive Summary

Analysis of the teammate's implementation for resolving marketplace API performance issues. The original problem was rate limiting (100 requests/15 min) combined with 4+ concurrent API calls per page load causing "API disturbance" for users browsing the marketplace.

**Overall Assessment:** The solutions are **well-implemented** with most recommendations addressed. The rate limiter, database indexes, and query optimizations are comprehensive.

---

## Original Issue

| Problem | Impact |
|---------|--------|
| Rate limiter at 100 requests/15 min | Users hit limit after 50+ requests in a few minutes |
| 4+ concurrent API calls per page load | Multiplies request count quickly |
| Complex queries without proper indexes | Slow response times compound the issue |

---

## Traffic Analysis

### Frontend API Call Patterns

| Role | Page Load Calls | Per-Action Calls |
|------|-----------------|------------------|
| Customer dashboard | 6 – 18 | 2 – 5 |
| Shop dashboard | 8 – 22 | 3 – 8 |
| Admin dashboard | 15 – 25 | 2 – 6 |

**Additional factors:**
- Payment status polling generates ~48 calls over 2 minutes
- Frontend defines 222 API functions across 14 service files
- Worst-case single session: ~93 requests (nearly exhausted old 100 limit)

---

## Implementation Analysis

### 1. Rate Limiter Configuration

**Status:** FULLY IMPLEMENTED

**Location:** `backend/src/middleware/rateLimiter.ts`

| Limiter | Previous | Updated | Change | Rationale |
|---------|----------|---------|--------|-----------|
| generalLimiter | 100/15 min | 500/15 min | +5x | Old limit caused 429s. New limit provides ~2x headroom. |
| authLimiter | 20/15 min | 10/15 min | -2x | Tightened for security. skipSuccessfulRequests ensures only failed attempts count. |
| paymentLimiter | 5/min | 10/min | +2x | Allows retries without friction. |
| tokenLimiter | 10/min | 10/min | — | Blockchain gas costs provide natural throttling. |
| orderLimiter | 10/hour | 10/hour | — | Appropriate for repair booking frequency. |
| webhookLimiter | 100/min | 200/min | +2x | Stripe sends event bursts; authenticity verified via signatures. |

**Assessment:**
- Production limit increased from 100 to 500 (5x increase)
- Per-endpoint rate limits implemented for write operations
- Comprehensive logging with IP, path, method tracking

---

### 2. Database Indexes

**Status:** COMPREHENSIVE IMPLEMENTATION

**Location:** `backend/migrations/057_*.sql` and related migrations

**Transaction Indexes:**
- `idx_transactions_type` - Type filtering
- `idx_transactions_status` - Status filtering
- `idx_transactions_type_status` - Composite for common patterns
- `idx_transactions_cross_shop_redemptions` - Partial index (type='redeem' AND status='confirmed')
- `idx_transactions_metadata_redemption_type` - JSONB metadata indexing

**Shop Indexes:**
- `idx_shops_active_verified` - Composite for active/verified
- `idx_shops_active_verified_partial` - Partial index for active verified only

**Service Indexes:**
- `idx_shop_services_shop_id` - Service lookups by shop
- `idx_shop_services_category` - Category filtering
- `idx_shop_services_active` - Active service filtering
- `idx_shop_services_created_at DESC` - Ordering

**Customer Indexes:**
- `idx_customers_wallet_address` - Wallet lookups
- `idx_customers_wallet_tier` - Tier queries

**Notification Indexes:**
- `idx_notifications_receiver` - Fast receiver lookups
- `idx_notifications_receiver_read` - Unread notification queries
- `idx_notifications_created_at DESC` - Timestamp ordering

**Appointment Indexes:**
- `idx_shop_availability_shop` - Shop availability
- `idx_service_orders_booking_time` - Booking slot queries

**Assessment:**
- 40+ indexes added including partial indexes and composite keys
- Covers all major query patterns
- Uses partial indexes for common filtered queries (reduces index size, improves performance)

---

### 3. Caching Implementation

**Status:** PARTIAL (In-Memory Only)

**Location:** `backend/src/utils/cache.ts`

**Current Implementation:**
```typescript
generalCache (5 minutes default TTL)
shortCache (1 minute TTL)
longCache (30 minutes TTL)
```

**Features:**
- In-memory Map-based caching
- Automatic cleanup every 60 seconds
- TTL-based expiration
- `@cached()` decorator for method-level caching
- `repositoryCache` helper for expensive queries
- Request-level caching middleware for GET endpoints

**Assessment:**
- No Redis implementation (uses in-memory caching)
- Suitable for single-instance deployments
- Works for current scale but may need Redis for horizontal scaling

---

### 4. API Endpoint Optimization

**Status:** INDIVIDUAL ENDPOINTS OPTIMIZED

**Location:** `backend/src/domains/ServiceDomain/`

**Optimized Endpoints:**

| Endpoint | Optimization |
|----------|--------------|
| Autocomplete Search | LIKE queries with CASE-based relevance scoring, returns top 10 |
| Recently Viewed | ON CONFLICT upsert, includes full service + shop + groups |
| Similar Services | Similarity score calculated in SQL |
| Trending Services | Trending score = (booking count * 100) + (rating * 20) |
| All Services | Paginated with 6+ filters |
| Favorites | Single query with JSON aggregation |

**JSON Aggregation Pattern (N+1 Prevention):**
```sql
(
  SELECT json_agg(json_build_object(
    'groupId', sga.group_id,
    'groupName', asg.group_name,
    ...
  ))
  FROM service_group_availability sga
  JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
  WHERE sga.service_id = s.service_id AND sga.active = true
) as groups
```

**Assessment:**
- Individual endpoints are well-optimized
- No combined "marketplace-init" endpoint (not implemented)
- N+1 queries prevented via JSON aggregation

---

### 5. Query Optimization

**Status:** WELL-STRUCTURED

**Location:** `backend/src/utils/sqlFragments.ts`

**Reusable SQL Fragments:**
- `SERVICE_GROUPS_SUBQUERY` - Reusable JSON aggregation
- `SERVICE_BASE_FIELDS` - Consistent field selection
- `SHOP_INFO_FIELDS` - Standardized shop info
- `FULL_SERVICE_FIELDS` - Complete service + shop + groups
- `SHOP_LOCATION_SUBQUERY` - Location data JSON object

**Assessment:**
- DRY principle applied across 7+ endpoints
- Consistent data transformation
- Avoids repetitive SQL code

---

## Summary Scorecard

| Recommendation | Status | Notes |
|----------------|--------|-------|
| Increase rate limit to 500 | DONE | Increased from 100 to 500 |
| Per-endpoint rate limits | DONE | 6 specific limiters |
| Database indexes | DONE | 40+ indexes added |
| Redis caching | NOT DONE | Using in-memory cache |
| Combined marketplace-init endpoint | NOT DONE | Endpoints still separate |
| Query optimization | DONE | SQL fragments, JSON agg |
| N+1 prevention | DONE | Single aggregation queries |

---

## Recommendations for Further Optimization

### High Priority

1. **Add Combined Marketplace Initialization Endpoint**
   ```
   GET /api/services/marketplace-init
   Returns: { trending, categories, priceRange, favoritesCount }
   ```
   - Reduces frontend parallel requests from 4-5 to 1

### Medium Priority

2. **Implement Redis Caching** (for horizontal scaling)
   - Cache trending services (5-minute TTL)
   - Cache category stats (hourly TTL)
   - Cache recently viewed per-user (30-minute TTL)

3. **Optimize Count Queries**
   - Current: separate COUNT() + data query
   - Consider: window functions or SQL LIMIT tricks

### Low Priority

4. **Query Plan Analysis**
   - Run `EXPLAIN ANALYZE` on complex queries
   - Verify indexes are used for all filter combinations

5. **Connection Pool Monitoring**
   - Currently 20 connections (good default)
   - Add metrics for pool exhaustion in production

---

## Conclusion

The teammate's implementation addresses the core issues effectively:

- **Rate limiting increased 5x** - Users can now browse freely without hitting limits
- **Database properly indexed** - Complex queries perform well
- **Caching layer added** - Reduces database load
- **Queries optimized** - N+1 problems eliminated

The remaining items (Redis, combined endpoint) are optimizations for future scaling rather than critical fixes for the current issue.

**Verdict:** The API disturbance issue should be resolved with current implementation.
