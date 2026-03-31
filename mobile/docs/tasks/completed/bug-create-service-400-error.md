# Bug: Create Service fails with 400 error on mobile

**Status:** Completed
**Priority:** High
**Est. Effort:** 1-2 hrs
**Created:** 2026-03-30
**Updated:** 2026-03-31
**Completed:** 2026-03-31

## Problem / Goal

When a shop tries to create a new service on the mobile app, the request fails with a 400 Bad Request error.

**Steps to reproduce:**
1. Login as shop
2. Go to Service tab
3. Tap create/add new service
4. Fill in service details
5. Submit → 400 error

**Expected:** Service is created successfully
**Actual:** 400 Bad Request error

## Analysis

- Could be a missing or invalid field in the request payload
- Mobile form may send data in a different format than the backend expects
- Image upload or multipart form data handling may differ from web frontend
- Validation rules on backend may reject mobile request format

## Implementation

1. Check the mobile create service request payload vs what the backend expects
2. Compare with the web frontend's working request
3. Fix field names, data types, or missing required fields
4. Test with and without image upload

## Verification Checklist

- [ ] Create service with all fields → success
- [ ] Create service with minimum required fields → success
- [ ] Create service with image upload → success
- [ ] Created service appears in shop's service list
- [ ] Created service visible to customers in marketplace

## Notes

- High priority — shops cannot add services from mobile, blocking core functionality
