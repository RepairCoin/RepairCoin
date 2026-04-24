# API Endpoints Reference

> Last updated: 2026-04-24

Complete cross-reference of all backend API routes and their mobile app integration status.

---

## Table of Contents

- [Active Endpoints (Used by Mobile)](#active-endpoints-used-by-mobile)
- [Backend-Only Endpoints (Not Used by Mobile)](#backend-only-endpoints-not-used-by-mobile)
- [Summary](#summary)

---

## Active Endpoints (Used by Mobile)

### Authentication (`/api/auth`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/auth/token` | `auth.services.ts` | `getToken()` |
| POST | `/auth/check-user` | `auth.services.ts` | `checkUserExists()` |
| POST | `/auth/refresh` | `auth.services.ts` | `getRefreshToken()` |

### Customers (`/api/customers`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/customers/:address` | `customer.services.ts` | `getCustomerByWalletAddress()` |
| GET | `/customers?search=` | `customer.services.ts` | `searchAllCustomers()` |
| GET | `/customers/:address/transactions` | `customer.services.ts` | `getTransactionByWalletAddress()` |
| GET | `/customers/cross-shop/balance/:address` | `customer.services.ts` | `getCrossShopBalance()` |
| GET | `/customers/balance/:address` | `balance.services.ts` | `getCustomerBalance()` |
| POST | `/customers/register` | `customer.services.ts` | `register()` |
| PUT | `/customers/:address` | `customer.services.ts` | `update()` |
| GET | `/customers/:address/no-show-status` | `appointment.services.ts` | `getCustomerNoShowStatusForShop()` |
| GET | `/customers/:address/overall-no-show-status` | `appointment.services.ts` | `getCustomerNoShowStatus()` |
| GET | `/customers/:address/no-show-history` | `dispute.services.ts` | `getCustomerNoShowHistory()` |
| GET | `/customers/:address/notification-preferences` | `notification.services.ts` | `getAppointmentPreferences()` |
| PUT | `/customers/:address/notification-preferences` | `notification.services.ts` | `updateAppointmentPreferences()` |

### Shops (`/api/shops`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/shops/register` | `shop.services.ts` | `register()` |
| PUT | `/shops/:shopId/details` | `shop.services.ts` | `updateShopDetails()` |
| GET | `/shops` | `shop.services.ts` | `listShops()` |
| GET | `/shops/:shopId` | `shop.services.ts` | `getShopById()` |
| GET | `/shops/wallet/:address` | `shop.services.ts` | `getShopByWalletAddress()` |
| GET | `/shops/:shopId/customers` | `shop.services.ts` | `getShopCustomers()` |
| GET | `/shops/:shopId/customer-growth` | `shop.services.ts` | `getShopCustomerGrowth()` |
| POST | `/shops/:shopId/redeem` | `shop.services.ts` | `processRedemption()` |
| POST | `/shops/:shopId/issue-reward` | `shop.services.ts` | `issueReward()` |
| GET | `/shops/:shopId/promo-codes` | `shop.services.ts` / `promocode.services.ts` | `getShopPromoCodes()` / `getPromoCodes()` |
| POST | `/shops/:shopId/promo-codes` | `shop.services.ts` / `promocode.services.ts` | `createPromoCode()` |
| POST | `/shops/:shopId/promo-codes/validate` | `shop.services.ts` / `promocode.services.ts` | `validatePromoCode()` |
| PUT | `/shops/:shopId/promo-codes/:id` | `shop.services.ts` / `promocode.services.ts` | `updatePromoCodeStatus()` (reactivate) |
| DELETE | `/shops/:shopId/promo-codes/:id` | `shop.services.ts` / `promocode.services.ts` | `updatePromoCodeStatus()` (deactivate) |
| GET | `/shops/:shopId/transactions` | `shop.services.ts` / `analytics.services.ts` | `getRecentRewards()` / `getShopTransactions()` |

### Shop Purchases (`/api/shops/purchase`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/shops/purchase/stripe-payment-intent` | `purchase.services.ts` | `createTokenPurchasePaymentIntent()` |
| POST | `/shops/purchase/stripe-checkout` | `purchase.services.ts` | `createStripeCheckout()` |
| GET | `/shops/purchase/history/:shopId` | `purchase.services.ts` | `getShopTransactions()` |

### Shop Analytics (`/api/shops`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/shops/:shopId/purchases` | `analytics.services.ts` | `getShopPurchases()` |

### Services (`/api/services`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services` | `service.services.ts` | `getAll()` |
| GET | `/services/shop/:shopId` | `service.services.ts` | `getShopServices()` |
| GET | `/services/:serviceId` | `service.services.ts` | `getService()` |
| POST | `/services` | `service.services.ts` | `create()` |
| PUT | `/services/:serviceId` | `service.services.ts` | `update()` |
| DELETE | `/services/:serviceId` | `service.services.ts` | `delete()` |
| PUT | `/services/:serviceId/duration` | `appointment.services.ts` | `updateServiceDuration()` |

### Service Discovery (`/api/services/discovery`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/discovery/trending` | `service.services.ts` | `getTrendingServices()` |
| GET | `/services/discovery/recently-viewed` | `service.services.ts` | `getRecentlyViewed()` |
| POST | `/services/discovery/recently-viewed` | `service.services.ts` | `trackRecentlyViewed()` |
| GET | `/services/discovery/similar/:id` | `service.services.ts` | `getSimilarServices()` |

### Service Favorites (`/api/services/favorites`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/favorites` | `service.services.ts` | `getFavorites()` |
| POST | `/services/favorites` | `service.services.ts` | `addFavorite()` |
| DELETE | `/services/favorites/:id` | `service.services.ts` | `removeFavorite()` |
| GET | `/services/favorites/check/:id` | `service.services.ts` | `checkFavorite()` |

### Service Reviews (`/api/services`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/:id/reviews` | `service.services.ts` | `getServiceReviews()` |
| GET | `/services/reviews/shop` | `service.services.ts` | `getShopReviews()` |
| POST | `/services/reviews/:id/respond` | `service.services.ts` | `addShopResponse()` |

### Service Groups (`/api/services`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/:id/groups` | `serviceGroup.services.ts` | `getServiceGroups()` |
| POST | `/services/:id/groups/:groupId` | `serviceGroup.services.ts` | `linkServiceToGroup()` |
| DELETE | `/services/:id/groups/:groupId` | `serviceGroup.services.ts` | `unlinkServiceFromGroup()` |
| PUT | `/services/:id/groups/:groupId/rewards` | `serviceGroup.services.ts` | `updateServiceGroupRewards()` |

### Bookings / Orders (`/api/services/orders`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/orders/shop` | `booking.services.ts` | `getShopBookings()` |
| GET | `/services/orders/customer` | `booking.services.ts` | `getCustomerBookings()` |
| GET | `/services/orders/:orderId` | `booking.services.ts` | `getOrderById()` |
| PUT | `/services/orders/:orderId/status` | `booking.services.ts` | `updateOrderStatus()` |
| POST | `/services/orders/:orderId/cancel` | `booking.services.ts` | `cancelOrder()` |
| POST | `/services/orders/:orderId/approve` | `booking.services.ts` | `approveOrder()` |
| POST | `/services/orders/:orderId/shop-cancel` | `booking.services.ts` | `cancelOrderByShop()` |
| POST | `/services/orders/:orderId/confirm` | `booking.services.ts` | `confirmPayment()` |
| POST | `/services/orders/confirm` | `booking.services.ts` | `confirmCheckoutPayment()` |
| POST | `/services/orders/create-payment-intent` | `booking.services.ts` | `createPaymentIntent()` |
| POST | `/services/orders/stripe-checkout` | `booking.services.ts` | `createStripeCheckout()` |

### Booking Analytics (`/api/services/analytics`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/analytics/shop/bookings` | `bookingAnalytics.services.ts` | `getBookingAnalytics()` |

### Appointments (`/api/services/appointments`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/appointments/available-slots` | `appointment.services.ts` | `getAvailableTimeSlots()` |
| GET | `/services/appointments/shop-availability/:shopId` | `appointment.services.ts` | `getShopAvailability()` |
| PUT | `/services/appointments/shop-availability` | `appointment.services.ts` | `updateShopAvailability()` |
| GET | `/services/appointments/time-slot-config` | `appointment.services.ts` | `getTimeSlotConfig()` |
| GET | `/services/appointments/time-slot-config/:shopId` | `appointment.services.ts` | `getTimeSlotConfig(shopId)` |
| PUT | `/services/appointments/time-slot-config` | `appointment.services.ts` | `updateTimeSlotConfig()` |
| GET | `/services/appointments/date-overrides` | `appointment.services.ts` | `getDateOverrides()` |
| POST | `/services/appointments/date-overrides` | `appointment.services.ts` | `createDateOverride()` |
| DELETE | `/services/appointments/date-overrides/:date` | `appointment.services.ts` | `deleteDateOverride()` |
| GET | `/services/appointments/calendar` | `appointment.services.ts` | `getShopCalendar()` |
| GET | `/services/appointments/my-appointments` | `appointment.services.ts` | `getMyAppointments()` |
| POST | `/services/appointments/cancel/:orderId` | `appointment.services.ts` | `cancelAppointment()` |

### Reschedule Requests (`/api/services/appointments`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/services/appointments/reschedule-request` | `appointment.services.ts` | `createRescheduleRequest()` |
| GET | `/services/appointments/reschedule-requests` | `appointment.services.ts` | `getShopRescheduleRequests()` |
| GET | `/services/appointments/reschedule-requests/count` | `appointment.services.ts` | `getShopRescheduleRequestCount()` |
| POST | `/services/appointments/reschedule-request/:id/approve` | `appointment.services.ts` | `approveRescheduleRequest()` |
| POST | `/services/appointments/reschedule-request/:id/reject` | `appointment.services.ts` | `rejectRescheduleRequest()` |
| DELETE | `/services/appointments/reschedule-request/:id` | `appointment.services.ts` | `cancelRescheduleRequest()` |
| GET | `/services/appointments/reschedule-request/order/:orderId` | `appointment.services.ts` | `getRescheduleRequestForOrder()` |

### Direct Reschedule (`/api/services/bookings`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/services/bookings/:orderId/direct-reschedule` | `appointment.services.ts` | `directRescheduleOrder()` |

### Disputes & No-Show

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/services/orders/:orderId/dispute` | `dispute.services.ts` (appointment) | `submitDispute()` |
| GET | `/services/orders/:orderId/dispute` | `dispute.services.ts` (appointment) | `getDisputeStatus()` |
| POST | `/services/orders/:orderId/mark-no-show` | `appointment.services.ts` | `markOrderAsNoShow()` |
| GET | `/services/shops/:shopId/disputes` | `dispute.services.ts` (booking) | `getShopDisputes()` |
| PUT | `/services/shops/:shopId/disputes/:id/approve` | `dispute.services.ts` (booking) | `approveDispute()` |
| PUT | `/services/shops/:shopId/disputes/:id/reject` | `dispute.services.ts` (booking) | `rejectDispute()` |

### No-Show Policy

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/shops/:shopId/no-show-policy` | `noShowPolicy.services.ts` | `getShopPolicy()` |
| PUT | `/services/shops/:shopId/no-show-policy` | `noShowPolicy.services.ts` | `updateShopPolicy()` |

### Manual Bookings

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/services/shops/:shopId/customers/search` | `appointment.services.ts` | `searchCustomers()` |
| POST | `/services/shops/:shopId/appointments/manual` | `appointment.services.ts` | `createManualBooking()` |

### Messages (`/api/messages`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/messages/send` | `message.services.ts` | `sendMessage()` |
| POST | `/messages/attachments/upload` | `message.services.ts` | `uploadAttachments()` |
| GET | `/messages/conversations` | `message.services.ts` | `getConversations()` |
| POST | `/messages/conversations` | `message.services.ts` | `startConversation()` |
| POST | `/messages/conversations/get-or-create` | `message.services.ts` | `getOrCreateConversation()` |
| GET | `/messages/conversations/:id` | `message.services.ts` | `getConversation()` |
| GET | `/messages/conversations/:id/messages` | `message.services.ts` | `getMessages()` |
| POST | `/messages/conversations/:id/read` | `message.services.ts` | `markConversationAsRead()` |
| PATCH | `/messages/conversations/:id/archive` | `message.services.ts` | `setConversationArchived()` |
| DELETE | `/messages/conversations/:id` | `message.services.ts` | `deleteConversation()` |
| POST | `/messages/conversations/:id/block` | `message.services.ts` | `blockConversation()` |
| POST | `/messages/conversations/:id/unblock` | `message.services.ts` | `unblockConversation()` |
| POST | `/messages/conversations/:id/resolve` | `message.services.ts` | `resolveConversation()` |
| POST | `/messages/conversations/:id/reopen` | `message.services.ts` | `reopenConversation()` |
| PATCH | `/messages/:id/read` | `message.services.ts` | `markMessageAsRead()` |
| GET | `/messages/unread/count` | `message.services.ts` | `getUnreadCount()` |

### Quick Replies (`/api/messages/quick-replies`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/messages/quick-replies` | `message.services.ts` | `getQuickReplies()` |
| POST | `/messages/quick-replies` | `message.services.ts` | `createQuickReply()` |
| PUT | `/messages/quick-replies/:id` | `message.services.ts` | `updateQuickReply()` |
| DELETE | `/messages/quick-replies/:id` | `message.services.ts` | `deleteQuickReply()` |
| POST | `/messages/quick-replies/:id/use` | `message.services.ts` | `useQuickReply()` |

### Auto-Messages (`/api/messages/auto-messages`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| GET | `/messages/auto-messages` | `message.services.ts` | `getAutoMessages()` |
| POST | `/messages/auto-messages` | `message.services.ts` | `createAutoMessage()` |
| PUT | `/messages/auto-messages/:id` | `message.services.ts` | `updateAutoMessage()` |
| DELETE | `/messages/auto-messages/:id` | `message.services.ts` | `deleteAutoMessage()` |
| PATCH | `/messages/auto-messages/:id/toggle` | `message.services.ts` | `toggleAutoMessage()` |
| GET | `/messages/auto-messages/:id/history` | `message.services.ts` | `getAutoMessageHistory()` |

### Notifications (`/api/notifications`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/notifications/push-tokens` | `notification.services.ts` | `registerPushToken()` |
| DELETE | `/notifications/push-tokens/:token` | `notification.services.ts` | `deactivatePushToken()` |
| DELETE | `/notifications/push-tokens` | `notification.services.ts` | `deactivateAllPushTokens()` |
| GET | `/notifications/push-tokens` | `notification.services.ts` | `getActiveDevices()` |
| GET | `/notifications` | `notification.services.ts` | `getNotifications()` |
| GET | `/notifications/unread` | `notification.services.ts` | `getUnreadNotifications()` |
| GET | `/notifications/unread/count` | `notification.services.ts` | `getUnreadCount()` |
| PATCH | `/notifications/:id/read` | `notification.services.ts` | `markAsRead()` |
| PATCH | `/notifications/read-all` | `notification.services.ts` | `markAllAsRead()` |
| GET | `/notifications/preferences/general` | `notification.services.ts` | `getGeneralPreferences()` |
| PUT | `/notifications/preferences/general` | `notification.services.ts` | `updateGeneralPreferences()` |
| POST | `/notifications/preferences/general/reset` | `notification.services.ts` | `resetGeneralPreferences()` |

### Affiliate Shop Groups (`/api/affiliate-shop-groups`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/affiliate-shop-groups` | `groups.services.ts` | `createGroup()` |
| GET | `/affiliate-shop-groups` | `groups.services.ts` | `getAllGroups()` |
| GET | `/affiliate-shop-groups/my-groups` | `groups.services.ts` | `getMyGroups()` |
| GET | `/affiliate-shop-groups/:groupId` | `groups.services.ts` | `getGroup()` |
| PUT | `/affiliate-shop-groups/:groupId` | `groups.services.ts` | `updateGroup()` |
| POST | `/affiliate-shop-groups/:groupId/join` | `groups.services.ts` | `requestToJoinGroup()` |
| POST | `/affiliate-shop-groups/join-by-code` | `groups.services.ts` | `joinByInviteCode()` |
| GET | `/affiliate-shop-groups/:groupId/members` | `groups.services.ts` | `getGroupMembers()` |
| POST | `/affiliate-shop-groups/:groupId/members/:shopId/approve` | `groups.services.ts` | `approveMember()` |
| POST | `/affiliate-shop-groups/:groupId/members/:shopId/reject` | `groups.services.ts` | `rejectMember()` |
| DELETE | `/affiliate-shop-groups/:groupId/members/:shopId` | `groups.services.ts` | `removeMember()` |
| POST | `/affiliate-shop-groups/:groupId/tokens/earn` | `groups.services.ts` | `earnGroupTokens()` |
| POST | `/affiliate-shop-groups/:groupId/tokens/redeem` | `groups.services.ts` | `redeemGroupTokens()` |
| GET | `/affiliate-shop-groups/:groupId/balance/:address` | `groups.services.ts` | `getCustomerBalance()` |
| GET | `/affiliate-shop-groups/:groupId/customers` | `groups.services.ts` | `getGroupCustomers()` |
| GET | `/affiliate-shop-groups/:groupId/transactions` | `groups.services.ts` | `getGroupTransactions()` |
| GET | `/affiliate-shop-groups/:groupId/analytics` | `groups.services.ts` | `getGroupAnalytics()` |
| GET | `/affiliate-shop-groups/:groupId/analytics/members` | `groups.services.ts` | `getMemberActivityStats()` |
| GET | `/affiliate-shop-groups/:groupId/analytics/trends` | `groups.services.ts` | `getTransactionTrends()` |
| POST | `/affiliate-shop-groups/:groupId/rcn/allocate` | `groups.services.ts` | `allocateRcnToGroup()` |
| POST | `/affiliate-shop-groups/:groupId/rcn/deallocate` | `groups.services.ts` | `deallocateRcnFromGroup()` |
| GET | `/affiliate-shop-groups/:groupId/rcn/allocation` | `groups.services.ts` | `getGroupRcnAllocation()` |
| GET | `/affiliate-shop-groups/rcn/allocations` | `groups.services.ts` | `getAllRcnAllocations()` |

### Tokens (`/api/tokens`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/tokens/redemption-session/create` | `token.services.ts` | `createRedemptionSession()` |
| GET | `/tokens/redemption-session/status/:id` | `token.services.ts` | `checkRedemptionSessionStatus()` |
| POST | `/tokens/redemption-session/cancel` | `token.services.ts` | `cancelRedemptionSession()` |
| POST | `/tokens/redemption-session/approve` | `token.services.ts` | `approvalRedemptionSession()` |
| POST | `/tokens/redemption-session/reject` | `token.services.ts` | `rejectRedemptionSession()` |
| GET | `/tokens/redemption-session/my-sessions` | `token.services.ts` | `fetchMyRedemptionSessions()` |
| POST | `/tokens/transfer` | `token.services.ts` | `transferToken()` |
| POST | `/tokens/validate-transfer` | `token.services.ts` | `validateTransfer()` |
| GET | `/tokens/transfer-history/:address` | `token.services.ts` | `getTransferHistory()` |
| GET | `/tokens/balance/:address` | `token.services.ts` | `fetchTokenBalance()` |

### Bug Reports (`/api/bug-reports`)

| Method | Path | Mobile Service | Function |
|--------|------|---------------|----------|
| POST | `/bug-reports` | `bugReport.services.ts` | `submit()` |

### External APIs (non-backend)

| Service | Endpoint | Function |
|---------|----------|----------|
| Nominatim (OpenStreetMap) | `nominatim.openstreetmap.org/reverse` | `reverseGeocode()` |
| Nominatim (OpenStreetMap) | `nominatim.openstreetmap.org/search` | `geocodeAddress()` |

---

## Backend-Only Endpoints (Not Used by Mobile)

### Auth — web/admin only

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/profile` | Create user profile |
| GET | `/auth/session` | Get current session |
| POST | `/auth/admin` | Admin login |
| POST | `/auth/customer` | Customer login (mobile uses `/auth/token`) |
| POST | `/auth/shop` | Shop login |
| POST | `/auth/logout` | Logout (mobile handles client-side) |
| GET | `/auth/test-cookie` | Dev/debug |

### Security (`/api/security`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| GET | `/security/sessions` | Session management |
| DELETE | `/security/sessions/:tokenId` | Revoke session |
| POST | `/security/sessions/revoke-all` | Revoke all sessions |
| GET | `/security/activity` | Activity log |
| GET | `/security/stats` | Security stats |

### Customers — admin/web only

| Method | Path | Notes |
|--------|------|-------|
| GET | `/customers/` | List all customers |
| GET | `/customers/:address/analytics` | Customer analytics |
| POST | `/customers/:address/mint` | Manual mint (admin) |
| GET | `/customers/:address/redemption-check` | Redemption eligibility |
| GET | `/customers/tier/:tierLevel` | Get by tier (admin) |
| POST | `/customers/:address/deactivate` | Deactivate (admin) |
| POST | `/customers/:address/request-unsuspend` | Request unsuspension |
| GET | `/customers/claim/check` | Account claim check |
| POST | `/customers/claim/check-by-contact` | Claim by email/phone |
| POST | `/customers/claim` | Claim placeholder account |
| GET | `/customers/shops` | Get shops for QR code |
| GET | `/customers/:address/export-data` | Data export |

### Shops — web only sub-routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/shops/map` | Map view with coordinates |
| * | `/shops/tier-bonus/*` | Tier bonus routes |
| * | `/shops/deposit/*` | RCN deposit routes |
| * | `/shops/purchase-sync/*` | Payment sync routes |
| * | `/shops/payment-methods/*` | Payment methods |
| * | `/shops/reports/*` | Reports |
| * | `/shops/moderation/*` | Moderation |
| * | `/shops/calendar/*` | Calendar integration |
| * | `/shops/gmail/*` | Gmail integration |

### Promo Codes — web/admin only

| Method | Path | Notes |
|--------|------|-------|
| GET | `/shops/:shopId/promo-codes/:id/stats` | Promo code statistics |
| POST | `/shops/promo-codes/validate` | Public validation (no shop scoping) |
| GET | `/shops/customers/:address/promo-history` | Customer promo history |
| GET | `/shops/admin/promo-codes` | All promo codes (admin) |
| GET | `/shops/admin/promo-codes/analytics` | Promo analytics (admin) |

### Referrals (`/api/referrals`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| POST | `/referrals/generate` | Generate referral code |
| GET | `/referrals/validate/:code` | Validate referral code |
| GET | `/referrals/stats` | Referral statistics |
| GET | `/referrals/leaderboard` | Referral leaderboard |
| GET | `/referrals/rcn-breakdown` | RCN breakdown by source |
| POST | `/referrals/verify-redemption` | Verify redemption eligibility |

### Upload (`/api/upload`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| POST | `/upload/shop-logo` | Upload shop logo |
| POST | `/upload/service-image` | Upload service image |
| POST | `/upload/shop-banner` | Upload shop banner |
| POST | `/upload/customer-avatar` | Upload customer avatar |
| DELETE | `/upload/:key` | Delete image |
| GET | `/upload/presigned/:key` | Get presigned URL |

### Health (`/api/health`) — infra/monitoring

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health/ping` | Fast health check |
| GET | `/health/perf` | Performance diagnostics |
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed system info |
| GET | `/health/database` | Database health |
| GET | `/health/blockchain` | Blockchain health |
| GET | `/health/debug-dispute/:orderId` | Dispute debug (temp) |

### Waitlist (`/api/waitlist`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| POST | `/waitlist/submit` | Submit waitlist entry |
| POST | `/waitlist/track-visit` | Track page visit |
| GET | `/waitlist/entries` | Get entries (admin) |
| GET | `/waitlist/stats` | Get stats (admin) |
| PUT | `/waitlist/:id/status` | Update status (admin) |
| DELETE | `/waitlist/:id` | Delete entry (admin) |

### Marketing (`/api/marketing`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| GET | `/marketing/shops/:shopId/campaigns` | Get campaigns |
| POST | `/marketing/shops/:shopId/campaigns` | Create campaign |
| GET | `/marketing/shops/:shopId/stats` | Campaign stats |
| GET | `/marketing/shops/:shopId/audience-count` | Audience count |
| GET | `/marketing/shops/:shopId/customers` | Customers for targeting |
| GET | `/marketing/campaigns/:id` | Get campaign |
| PUT | `/marketing/campaigns/:id` | Update campaign |
| DELETE | `/marketing/campaigns/:id` | Delete campaign |
| POST | `/marketing/campaigns/:id/send` | Send campaign |
| POST | `/marketing/campaigns/:id/schedule` | Schedule campaign |
| POST | `/marketing/campaigns/:id/cancel` | Cancel campaign |
| GET | `/marketing/templates` | Get templates |
| GET | `/marketing/templates/:id` | Get template |

### Support (`/api/support`) — entire domain

| Method | Path | Notes |
|--------|------|-------|
| POST | `/support/tickets` | Create ticket (shop) |
| GET | `/support/tickets` | Get shop tickets |
| GET | `/support/tickets/:id` | Get ticket |
| GET | `/support/tickets/:id/messages` | Get messages |
| POST | `/support/tickets/:id/messages` | Add message |
| POST | `/support/tickets/:id/read` | Mark as read |
| GET | `/support/unread-count` | Unread count (shop) |
| GET | `/support/admin/tickets` | All tickets (admin) |
| GET | `/support/admin/stats` | Admin stats |
| PUT | `/support/admin/tickets/:id/status` | Update status (admin) |
| PUT | `/support/admin/tickets/:id/assign` | Assign ticket (admin) |

### Webhooks (`/api/webhooks`) — server-to-server

| Method | Path | Notes |
|--------|------|-------|
| POST | `/webhooks/fixflow` | FixFlow webhook |

### Notifications — unused by mobile

| Method | Path | Notes |
|--------|------|-------|
| GET | `/notifications/vapid-public-key` | Web push only |
| POST | `/notifications/test-push` | Debug only |
| GET | `/notifications/push-tokens/stats` | Admin only |
| GET | `/notifications/:id` | Get specific notification |
| DELETE | `/notifications/:id` | Delete notification |
| DELETE | `/notifications/` | Delete all notifications |

### Affiliate Groups — unused by mobile

| Method | Path | Notes |
|--------|------|-------|
| GET | `/affiliate-shop-groups/with-services` | Groups with active services |
| GET | `/affiliate-shop-groups/balances/:address` | All balances for customer |
| GET | `/affiliate-shop-groups/:groupId/transactions/:address` | Per-customer transactions |

### Tokens — unused by mobile

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tokens/stats` | Token statistics |
| * | `/tokens/*/verification` | Token verification |

### System / Misc

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Root status |
| GET | `/api/` | API status |
| GET | `/api/events/history` | Event bus history |
| GET | `/api/errors/summary` | Error tracking |
| DELETE | `/api/errors/clear` | Clear errors |
| GET | `/api/system/info` | System info |
| GET | `/api/metrics` | Metrics (admin) |
| POST | `/api/setup/init-database/:secret` | DB init (temp) |

---

## Summary

| Category | Count |
|----------|-------|
| **Active (used by mobile)** | ~170 endpoints |
| **Backend-only (web/admin/infra)** | ~100+ endpoints |
| **Total backend endpoints** | ~270+ |

### Entire domains with zero mobile usage

- Security
- Referrals
- Upload
- Health
- Waitlist
- Marketing
- Support
- Webhooks
- Metrics
- Setup
