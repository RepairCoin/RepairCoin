# RepairCoin: Alternative Development Opportunities
**Last Updated:** April 2, 2026

Beyond the main feature roadmap, here are **81 documented tasks** across bugs, UX improvements, and strategic enhancements.

---

## 🐛 **HIGH-PRIORITY BUGS** (Quick Wins, 1-3 hours each)

### Critical Issues
1. **Calendar Timezone Rendering** - Shop timezones not working correctly
2. **Shop Profile Form Resets While Typing** - Auto-save issues
3. **Message Dropdown Conversation Not Opening** - Click handler broken
4. **No-Show Button Missing from Booking Card** - UI regression
5. **Bookings Sort Button Non-Functional** - Sorting broken
6. **Paid Bookings Count Mismatch** - Dashboard metrics wrong

### Data/Type Issues
7. **Balance Info Interface Mismatch in Tests** - TypeScript errors
8. **Find Shop Location Lat/Lng Returned as String** - Should be numbers
9. **Twitter/X Field Mismatch** - Field name inconsistency
10. **No-Show History Service ID Type Mismatch** - TypeScript error
11. **Category Typed Optional Allows Null Inserts** - Schema validation
12. **Null and Invalid Categories in Staging DB** - Data cleanup needed

### Integration Issues
13. **Waitlist Submit 500 in Production** - Form submission failing
14. **Migration Runner Path Resolution** - Production deployment issue
15. **Customer Search Exposes All Platform Customers** - Security/privacy issue

---

## 🎨 **UX/UI IMPROVEMENTS** (2-4 hours each)

### User Experience
16. **Chunk Load Error Recovery** - Better error handling for code splits
17. **Dropdown Arrow Browser Compatibility** - Safari/Firefox issues
18. **Landing Hero Video PIP Issue** - Picture-in-picture blocking navigation
19. **Enhance Buy Credits Visibility** - Make RCN purchase more prominent
20. **Payment Link Standalone Success Page** - Better post-payment UX
21. **Email-Based Shop Lookup** - Allow customers to find shops by email

### Dashboard Improvements
22. **Waitlist Admin Dashboard** - Better analytics and management
23. **Customer Details View** - Comprehensive customer profile page
24. **Shop Logo in Messages** - Show branding in message threads
25. **Messaging Filter Button** - Filter by read/unread, date range

### Visual Enhancements
26. **Booking Settings Save Configuration Bug** - Visual feedback missing
27. **Reschedule Pending Badge** - Show pending count on tab

---

## 🚀 **STRATEGIC ENHANCEMENTS** (4-12 hours each)

### Communication
28. **Twilio SMS Integration** (8-10 hours)
    - SMS booking reminders
    - Two-way SMS messaging
    - SMS verification for phone numbers
    - **Doc:** `/docs/tasks/strategy/twilio-sms-integration-proposal.md`

29. **WebSocket for Real-Time Messaging** (6-8 hours)
    - Replace 5-second polling
    - Instant message delivery
    - Typing indicators (real-time)
    - Presence (online/offline)
    - **Doc:** `/docs/tasks/strategy/messaging-gaps-websocket-unread-buttons.md`

30. **Shop Auto-Responses & Scheduled Messages** (4-6 hours)
    - Business hours auto-responses
    - Schedule promotional messages
    - Drip campaigns
    - **Doc:** `/docs/tasks/strategy/shop-auto-responses-scheduled-messages.md`

### Booking & Scheduling
31. **Manual Booking with Real-Time Payment Updates** (5-7 hours)
    - Shop creates booking for walk-ins
    - Real-time payment status via polling
    - Cash payment option
    - **Doc:** `/docs/tasks/strategy/manual-booking-realtime-payment-update.md`

32. **Booking Reminders via SMS/Email** (6-8 hours)
    - SMS reminders (via Twilio)
    - Customizable reminder timing
    - Reduce no-shows further
    - **Doc:** `/docs/tasks/booking-reminders-sms-email.md`

### Admin & Operations
33. **Admin Pause/Resume Notifications** (2-3 hours)
    - Pause notification types globally
    - Resume with one click
    - Useful for maintenance/testing
    - **Doc:** `/docs/tasks/admin-pause-resume-notifications.md`

34. **Admin Cancel/Reactivate Notifications** (2-3 hours)
    - Bulk notification management
    - Reactivate expired notifications
    - **Doc:** `/docs/tasks/admin-cancel-reactivate-notifications.md`

35. **Database Migration: NYC to Singapore** (12-16 hours)
    - Migrate DigitalOcean database region
    - Zero-downtime migration
    - Backup strategy
    - **Doc:** `/docs/tasks/strategy/database-migration-nyc-to-singapore.md`

36. **Prevent Migration Data Gaps** (4-6 hours)
    - Migration validation scripts
    - Data integrity checks
    - Rollback procedures
    - **Doc:** `/docs/tasks/strategy/prevent-migration-data-gaps-strategy.md`

### Testing & Quality
37. **Referral System E2E Testing** (3-4 hours)
    - Automated test suite
    - Edge case coverage
    - **Doc:** `/docs/tasks/referral-system-e2e-testing.md`

38. **Expired Subscription Test Data Cleanup** (1-2 hours)
    - Clean up test shops
    - Script for future cleanup
    - **Doc:** `/docs/tasks/strategy/expired-subscription-test-data.md`

### Feature Additions
39. **Quick Replies Edit Feature** (2-3 hours)
    - Edit quick replies inline
    - Better UX than delete+recreate
    - **Doc:** `/docs/tasks/strategy/quick-replies-edit-feature.md`

40. **Shop Issue Rewards: Subscription Guard** (2-3 hours)
    - Prevent reward issuance without subscription
    - Better error messages
    - **Doc:** `/docs/tasks/shop-issue-rewards-subscription-guard.md`

41. **Issue Reward Idempotency Fix** (2-3 hours)
    - Prevent duplicate reward issuance
    - Add transaction locks
    - **Doc:** `/docs/tasks/issue-reward-idempotency-fix.md`

---

## 🔧 **TECHNICAL DEBT & INFRASTRUCTURE** (2-8 hours each)

### Performance
42. **Backend: Too Many DB Connections** (4-6 hours)
    - Connection pooling optimization
    - Query batching
    - **Doc:** `/docs/tasks/backend-too-many-db-connections.md`

43. **Rapid Refresh Comprehensive Fix** (6-8 hours)
    - Fix HMR issues in development
    - Better dev experience
    - **Doc:** `/docs/tasks/strategy/rapid-refresh-comprehensive-fix.md`

### Security & Auth
44. **Session Signature Verification Fix** (3-4 hours)
    - Improve JWT validation
    - Better security
    - **Doc:** `/docs/tasks/session-signature-verification-fix.md`

45. **Subscription Guard Standardization** (4-6 hours)
    - Consistent subscription checks
    - Middleware approach
    - **Doc:** `/docs/tasks/subscription-guard-standardization.md`

46. **Social Login: Customer Search 403** (2-3 hours)
    - Fix permission error
    - Google/Facebook login issues
    - **Doc:** `/docs/tasks/social-login-customer-search-403.md`

### Data Quality
47. **Phone Number Country Code Validation** (2-3 hours)
    - International phone support
    - libphonenumber integration
    - **Doc:** `/docs/tasks/phone-number-country-code.md`

48. **Mobile RCN Purchase: Max Validation** (1-2 hours)
    - Prevent over-purchase
    - Better UX
    - **Doc:** `/docs/tasks/mobile-rcn-purchase-max-validation.md`

49. **Mobile Redemption: Cross-Shop Validation** (2-3 hours)
    - Validate shop ID before redemption
    - Better error handling
    - **Doc:** `/docs/tasks/mobile-redemption-cross-shop-validation.md`

### Race Conditions & Edge Cases
50. **Mint to Wallet Race Condition** (3-4 hours)
    - Fix concurrent minting issues
    - Transaction locks
    - **Doc:** `/docs/tasks/mint-to-wallet-race-condition.md`

51. **Stripe Subscription Period Dates Fix** (2-3 hours)
    - Correct billing period calculation
    - Timezone handling
    - **Doc:** `/docs/tasks/stripe-subscription-period-dates-fix.md`

---

## 📊 **ANALYTICS & REPORTING** (4-8 hours each)

52. **Customer Lifetime Value (LTV) Dashboard**
    - Track customer spend over time
    - Cohort analysis
    - Retention metrics

53. **Shop Performance Benchmarking**
    - Compare shop to platform averages
    - Category-based benchmarks
    - Growth suggestions

54. **RCN Flow Visualization**
    - Track RCN movement platform-wide
    - Mint/redemption/burn analytics
    - Treasury health dashboard

55. **No-Show Rate Analytics**
    - Track no-show patterns
    - Identify problematic customers
    - Suggest policy changes

---

## 🎯 **CUSTOMER-FACING FEATURES** (3-8 hours each)

56. **Service Recommendations Engine**
    - AI-based service suggestions
    - Based on past bookings
    - Location-aware

57. **Loyalty Points System**
    - Separate from RCN
    - Shop-specific loyalty programs
    - Tiered rewards

58. **Gift Cards/Vouchers**
    - Purchase gift cards
    - Redeem at any shop
    - Expiration tracking

59. **Service Bundles/Packages**
    - Multi-service discounts
    - Pre-pay for 5 haircuts, get 1 free
    - Subscription-based services

60. **Waitlist for Fully Booked Slots**
    - Join waitlist if slot full
    - Auto-notify when available
    - Priority booking

---

## 🏪 **SHOP-FACING FEATURES** (4-10 hours each)

61. **Multi-Location Support**
    - Shops with multiple locations
    - Separate calendars per location
    - Location-specific staff

62. **Staff Management**
    - Add employees
    - Role-based permissions
    - Staff-specific calendars

63. **Inventory Management**
    - Track products used in services
    - Low stock alerts
    - Auto-order integration

64. **Dynamic Pricing**
    - Peak hour pricing
    - Seasonal adjustments
    - Demand-based pricing

65. **Marketing Campaigns**
    - Email campaigns to customers
    - Promo code generation
    - A/B testing

---

## 🔔 **NOTIFICATION ENHANCEMENTS** (2-6 hours each)

66. **Push Notifications (Web)**
    - Browser push for new messages
    - Booking reminders
    - Service Web Push API

67. **Push Notifications (Mobile)**
    - iOS/Android app integration
    - Deep linking to bookings
    - Custom notification sounds

68. **Notification Preferences**
    - Granular control (email vs push vs SMS)
    - Frequency settings
    - Quiet hours

69. **Notification Templates**
    - Customizable message templates
    - Shop branding
    - Localization support

---

## 🌐 **INTERNATIONALIZATION** (8-16 hours each)

70. **Multi-Language Support**
    - i18n framework integration
    - Spanish, French, Mandarin
    - RTL language support

71. **Multi-Currency Support**
    - USD, EUR, GBP, CAD
    - Real-time exchange rates
    - Currency conversion at checkout

72. **Timezone Management**
    - User-selected timezone
    - Appointment display in local time
    - DST handling

---

## 📱 **MOBILE APP OPPORTUNITIES**

73. **React Native Mobile App**
    - iOS & Android native apps
    - Push notifications
    - Camera for QR codes
    - Offline mode

74. **Progressive Web App (PWA)**
    - Install to home screen
    - Offline functionality
    - Push notifications (web)

---

## 🤖 **AI/ML FEATURES** (12-20+ hours each)

75. **Chatbot for Customer Support**
    - AI-powered responses
    - Handle common questions
    - Escalate to human when needed

76. **Smart Scheduling**
    - AI suggests best appointment times
    - Based on shop capacity
    - Customer preferences

77. **Review Sentiment Analysis**
    - Auto-detect negative reviews
    - Alert shops immediately
    - Suggest responses

78. **Fraud Detection**
    - Detect fake reviews
    - Suspicious booking patterns
    - Payment fraud prevention

---

## 🎮 **GAMIFICATION** (6-12 hours each)

79. **Achievement Badges**
    - "First Booking" badge
    - "Regular Customer" badge
    - Display on profile

80. **Leaderboards**
    - Top RCN earners
    - Most loyal customers
    - Top-rated shops

81. **Challenges & Rewards**
    - "Book 3 services this month" challenge
    - Bonus RCN for completing
    - Time-limited events

---

## 💡 **RECOMMENDED QUICK WINS** (1-3 hours, high impact)

1. ⚡ **Fix Calendar Timezone Rendering** (1-2 hrs)
2. ⚡ **Fix No-Show Button Missing** (1 hr)
3. ⚡ **Fix Message Dropdown Not Opening** (1 hr)
4. ⚡ **Add Reschedule Pending Badge** (1 hr)
5. ⚡ **Fix Shop Profile Form Reset** (2 hrs)
6. ⚡ **Add Email-Based Shop Lookup** (2 hrs)
7. ⚡ **Admin Pause/Resume Notifications** (2-3 hrs)
8. ⚡ **Quick Replies Edit Feature** (2-3 hrs)
9. ⚡ **CSV Export for Messages** (1-2 hrs)
10. ⚡ **Enhance Buy Credits Visibility** (2 hrs)

---

## 🎯 **RECOMMENDED BY CATEGORY**

### **If you want to fix bugs:** Start with calendar timezone, no-show button, message dropdown
### **If you want UX improvements:** Shop profile form, quick replies edit, email shop lookup
### **If you want infrastructure:** WebSocket messaging, SMS integration, database migration
### **If you want analytics:** Customer LTV, shop benchmarking, RCN flow visualization
### **If you want new features:** Staff management, gift cards, service bundles
### **If you want AI/ML:** Chatbot, sentiment analysis, smart scheduling

---

**Total Opportunities:** 81+ documented tasks
**Estimated Total Work:** 300-500+ hours
**Quick Wins Available:** 10+ tasks under 3 hours

Choose based on your priorities: bugs, UX, features, infrastructure, or strategic growth!
