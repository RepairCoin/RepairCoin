# RepairCoin TODO List

## 🎯 High Priority Features

### No-Show Tracking System
**Status**: Not Started
**Priority**: High
**Description**: Comprehensive system to track and manage customer no-shows for appointments

#### Backend Implementation
- [ ] Add `no_show` status to `service_orders` table
- [ ] Add `no_show_count` column to `customers` table
- [ ] Create `no_show_history` table to track all no-show incidents
  - customer_id
  - order_id
  - service_id
  - shop_id
  - scheduled_time
  - marked_no_show_at
  - marked_by (shop admin)
  - notes
- [ ] Add API endpoint: `PUT /api/orders/:orderId/mark-no-show`
- [ ] Add API endpoint: `GET /api/customers/:customerId/no-show-history`
- [ ] Add API endpoint: `GET /api/shops/:shopId/no-show-analytics`
- [ ] Implement automated no-show detection (e.g., 2 hours after appointment time)
- [ ] Add email notification when customer is marked as no-show

#### Frontend Implementation
- [ ] Shop Dashboard: Add "Mark as No-Show" button in appointment calendar
- [ ] Shop Dashboard: Add no-show analytics card showing:
  - Total no-shows this month
  - No-show rate percentage
  - Top no-show customers (with privacy considerations)
- [ ] Customer Dashboard: Display no-show count in profile/settings
- [ ] Customer Dashboard: Show warning banner if no-show count is high
- [ ] Booking Modal: Show deposit requirement for customers with 3+ no-shows
- [ ] Add filter in appointment calendar to show only no-shows

#### Business Logic
- [ ] Implement penalty system:
  - 1st no-show: Warning email
  - 2nd no-show: Warning banner in dashboard
  - 3rd+ no-show: Require deposit for future bookings
- [ ] Add grace period configuration (default: 15 minutes late = no-show)
- [ ] Allow shops to configure their own no-show policies
- [ ] Add ability for customers to dispute no-show marks

#### Analytics & Reporting
- [ ] Admin dashboard: Platform-wide no-show statistics
- [ ] Shop analytics: No-show trends over time
- [ ] Identify services with highest no-show rates
- [ ] Generate monthly no-show reports for shops

---

## 🐛 Bug Fixes

### "Book Again" Navigation Issue
**Status**: ✅ FIXED
**Priority**: High
**Issue**: Clicking "Book Again" button navigates to non-existent page `/customer/services/[serviceId]` resulting in 404
**Location**: Customer bookings tab
**Fix Applied**:
- [x] Updated "Book Again" button to navigate to shop profile page `/customer/shop/[shopId]`
- [x] User can now view all shop services and book the service again from shop profile
**File Changed**: `src/components/customer/ServiceOrdersTab.tsx` (line 90-94)

---

## 📋 Feature Backlog

### RCG Staking System
**Status**: Not Started
**Priority**: Critical Blocker
**Description**: Implementation required for tokenomics

### Messaging Feature Backend
**Status**: UI Complete, Backend Pending
**Priority**: Medium
**Description**:
- [ ] Create database tables for messages and conversations
- [ ] Implement WebSocket for real-time messaging
- [ ] Create API endpoints for message CRUD operations
- [ ] Add message notifications

### Shop Profile Enhancements
**Status**: Complete ✅
**Completed**:
- ✅ Banner and logo upload
- ✅ About section (2000 characters)
- ✅ Photo gallery (up to 20 photos)
- ✅ Operating hours with real-time status
- ✅ Google Maps integration

---

## 🔍 Code Quality

- [ ] Add TypeScript strict mode
- [ ] Improve error handling in API calls
- [ ] Add loading states to all async operations
- [ ] Implement proper form validation across all forms
- [ ] Add unit tests for critical business logic

---

## 📝 Documentation Needed

- [ ] API documentation for new endpoints
- [ ] Setup guide for development environment
- [ ] Deployment guide
- [ ] No-show tracking feature documentation
- [ ] Customer-facing FAQ about no-show policies

---

**Last Updated**: 2026-01-02
