# BUG-007: Price filter not working correctly - services above max price still shown

**Type:** Bug
**Severity:** Medium
**Priority:** P2
**Component:** Frontend/Backend - Service Marketplace Filters
**Labels:** bug, frontend, filters, marketplace
**Status:** FIXED ✅
**Date Fixed:** December 2025

---

## Description

The price range filter in the Service Marketplace does not correctly filter services. When setting a max price of $290, services priced at $300 still appear in the results.

---

## Steps to Reproduce

1. Login as customer
2. Navigate to Marketplace tab
3. Click "Filters" to expand advanced filters
4. Set Price Range:
   - Min: $0
   - Max: $290
5. Observe the filtered results

---

## Expected Result

- Only services priced between $0 and $290 should appear
- "Massage" service at $300.00 should NOT appear in results

---

## Actual Result

- "Massage" service at $300.00 DOES appear in filtered results
- Filter shows services that exceed the max price limit

---

## Evidence from Screenshots

**Screenshot 1 (sc1.png):** Filter panel showing price range configuration

**Screenshot 2 (sc2.png):** Results showing services including:
- service 12: $2.00 ✅ (within range)
- service 9: $1.99 ✅ (within range)
- Service 4: $2.00 ✅ (within range)
- Sample Service: $10.00 ✅ (within range)
- Massage Spa: $12.00 ✅ (within range)
- **Massage: $300.00** ❌ (EXCEEDS max of $290!)
- Haircut mens: $50.00 ✅ (within range)

---

## Root Cause Analysis

**Potential Issue 1: Frontend not sending filter**

File: `frontend/src/components/customer/ServiceFilters.tsx` (Lines 48-55)

```typescript
const handlePriceRangeChange = (min: number, max: number) => {
  setPriceRange([min, max]);
  onFilterChange({
    ...filters,
    minPrice: min > 0 ? min : undefined,
    maxPrice: max < 500 ? max : undefined  // Only sets if < 500
  });
};
```

If max is set to exactly 500 (slider max), `maxPrice` becomes `undefined` and no filter is applied.

**Potential Issue 2: Slider vs Manual Input Mismatch**

The component has TWO ways to set price:
1. Dual range sliders (lines 164-194)
2. Manual number inputs (lines 199-217)

These may not be synchronized properly. The manual inputs call `handleMinPriceChange` and `handleMaxPriceChange` directly, which update `filters` but may not update `priceRange` state.

**Potential Issue 3: Backend filter not applied**

Need to verify the API request actually contains the maxPrice parameter.

---

## Debugging Steps Needed

1. Check browser Network tab to see if `maxPrice=290` is in the API request URL
2. If present, check backend logs to see SQL query being executed
3. If not present, the bug is in frontend filter handling

---

## Acceptance Criteria

- [ ] Services above maxPrice are excluded from results
- [ ] Services below minPrice are excluded from results
- [ ] Slider and manual inputs stay synchronized
- [ ] Filter persists when navigating pages
- [ ] Edge cases handled (0, 500, negative values)

---

## Technical Investigation Needed

Add console logging to trace the filter flow:

**Frontend (ServiceFilters.tsx):**
```typescript
const handlePriceRangeChange = (min: number, max: number) => {
  console.log('Price range changed:', { min, max });
  // ... existing code
};
```

**Frontend (ServiceMarketplaceClient.tsx):**
```typescript
const loadServices = async () => {
  console.log('Loading services with filters:', filters);
  // ... existing code
};
```

**Backend (ServiceController.ts):**
```typescript
console.log('Received filters:', {
  minPrice: req.query.minPrice,
  maxPrice: req.query.maxPrice
});
```

---

## Related Files

| File | Area |
|------|------|
| `frontend/src/components/customer/ServiceFilters.tsx` | Filter UI and state management |
| `frontend/src/components/customer/ServiceMarketplaceClient.tsx` | Calls API with filters |
| `frontend/src/services/api/services.ts` | API client `getAllServices()` |
| `backend/src/domains/ServiceDomain/controllers/ServiceController.ts` | Parses filter params |
| `backend/src/repositories/ServiceRepository.ts` | SQL WHERE clause |
