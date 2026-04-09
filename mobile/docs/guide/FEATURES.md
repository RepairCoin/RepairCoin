# FixFlow Mobile App - Complete Features Guide

**Platform:** React Native (Expo) + TypeScript
**App Name:** FixFlow
**Supported Roles:** Customer, Shop Owner
**Last Updated:** April 9, 2026

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Customer Features](#2-customer-features)
3. [Shop Owner Features](#3-shop-owner-features)
4. [Shared Features](#4-shared-features)
5. [Testing Credentials](#5-testing-credentials)

---

## 1. Authentication & Onboarding

### Onboarding Flow
- 3-slide onboarding carousel introducing FixFlow
- Swipe navigation between slides
- "Connect Wallet" CTA on the final slide

### Wallet Connection
- Thirdweb SDK v5 integration
- Connect via wallet (MetaMask, embedded wallets)
- Sign in with Google via Thirdweb embedded wallet
- Automatic session restoration on app reopen

### Registration
- New customers: prompted to enter name, email, phone on first login
- New shops: guided shop registration flow with business info
- Pending shop approval screen (for shops awaiting admin verification)

### Session Management
- JWT-based authentication with automatic token refresh
- Persistent sessions across app restarts
- Auto-logout on session expiry or corrupted state
- Recovery mechanism for auth failures (auto-clears storage)

---

## 2. Customer Features

### 2.1 Home / Dashboard
- **Balance Card** — displays current RCN balance with tier badge (Bronze/Silver/Gold)
- **On-Chain Wallet Balance** — shows blockchain wallet RCN balance separate from platform balance
- **Mint to Wallet** — transfer platform RCN balance to on-chain blockchain wallet
- **Quick Actions**: Gift Token, QR Code, Tier Info, Redeem
- **Recently Viewed Services** — last 8 services viewed
- **Trending Services** — top 4 trending services in the last 7 days
- **Featured Services** — latest 4 active services
- **Pull-to-refresh** for all data

### 2.2 Service Marketplace
- **Browse all services** in 2-column grid layout
- **Search** — backend-powered search across service name and description (with debounce)
- **Filters**:
  - Status (Available/Unavailable)
  - Multi-category selection
  - Price range (min/max)
  - Sort options (price, duration, newest)
- **Clear all filters** button
- **Favorites system** — heart icon to save/unsave services
- **Favorites view** — dedicated grid of saved services
- **Social sharing** — WhatsApp, Twitter, Facebook, copy link
- **Service cards display**:
  - Image with category badge
  - Service name, description, price
  - Duration and rating (stars + review count)
  - RCN earning badge (+ points)
  - Group rewards badge (purple) if part of affiliate group

### 2.3 Service Details
- Large service image with category
- Service name, description, price, duration
- Star ratings and review count
- **Tabs**: Details | Reviews
- **Reviews section** — paginated, filterable by rating, expandable cards
- **Book Now** button (initiates booking flow)
- **Similar services** recommendations
- Group rewards information (if applicable)

### 2.4 Booking Flow
- **Step 1: Schedule**
  - Calendar view with available dates (respects shop's advance booking days)
  - Weekend restrictions based on shop settings
  - Time slot picker with real-time availability
  - Grid layout with AM/PM labels
- **Step 2: Discount**
  - Display available RCN balance
  - Apply RCN discount with dynamic limits:
    - Home shop: up to 100% of service price
    - Cross-shop: 20% of service price
    - No-show restricted tier: capped by shop policy
  - Info message showing applicable redemption limit
  - Real-time price calculation
- **Step 3: Payment**
  - Stripe Checkout (opens in secure browser)
  - Deep link return to app after payment
  - Automatic booking confirmation
  - Minimum notice validation (e.g., 2 hours before)

### 2.5 My Bookings
- **Status filters**: All, Approved, Completed, Cancelled, No Show, Expired
- Booking cards show:
  - Service name, image, date/time
  - Shop information
  - Status badge with color coding
  - Total amount and RCN earned
- **Booking Details screen**:
  - Full booking info with order ID (BK-XXXXXX format)
  - Shop information with category label
  - Timeline of status changes
  - Actions based on status:
    - **Paid/Approved**: Cancel, Write Review (if completed)
    - **Completed**: Book Again, Write Review
  - Cancel flow with reason selection (Schedule Conflict, Found Alternative, Too Expensive, Changed Mind, Other)

### 2.6 Find Shop
- Browse all registered shops
- Shop cards with logo, name, location, verified badge
- Shop profile page with:
  - Shop info, contact details
  - Services tab with all shop services
  - Active/Inactive status indicator
- **Customer Reschedule Request** (pending implementation)

### 2.7 Token Management
- **RCN Balance** — current platform balance
- **Redeem Tokens** — at shops for discounts
- **Gift Tokens** — send to other customers
- **Buy Tokens** (customer side coming soon)
- **Transaction History** — formatted with readable labels
  - Filter: All, Earned, Redeemed, Rejected, Cancelled
  - Details: amount, type, shop, date
- **QR Code** — personal QR for shop scanning

### 2.8 Tier System
- **Bronze** (0+ RCN): Standard earnings
- **Silver** (+2 RCN bonus): 2,000+ lifetime earnings
- **Gold** (+5 RCN bonus): 5,000+ lifetime earnings
- Tier info screen showing benefits and progress
- Tier progression card on account screen

### 2.9 Reviews
- Write review for completed bookings
- Star rating (1-5)
- Written review text
- Optional photo upload (ready for future use)
- View all reviews on service detail screen

### 2.10 Referral System
- Unique referral code per customer
- Share referral via WhatsApp, social media, or copy link
- Earn 10 RCN for referring a new customer
- Referrer earns 25 RCN when referral completes first repair
- Referral count displayed on profile

### 2.11 Messages
- **Conversations list** — sorted by last activity
- **Chat screen** with real-time messaging
- **Message types**:
  - Text messages
  - Image attachments (up to 10MB)
  - **Password-locked messages** (secure mode with AES-256 encryption)
    - Optional password hint
    - Session unlock (stays unlocked during conversation)
- **Blocked conversations** indicator
- **Search** conversations
- **Filter**: Active, Resolved, Archived

### 2.12 Notifications
- In-app notification center
- Notification types:
  - Booking confirmations
  - Appointment reminders (24h before)
  - New messages
  - RCN earnings
  - Tier upgrades
  - Shop announcements
- Mark as read / unread
- Notification preferences settings

### 2.13 Account / Profile
- Profile photo upload
- Name, email, phone
- Wallet address (copyable)
- Referral code
- Member since date
- Stats: Earned, Redeemed, Repairs, Referrals
- Tier progress card
- Edit profile screen
- Settings access

### 2.14 Groups (Affiliate Rewards)
- View all affiliate groups
- See group-specific services
- Bonus token rewards for group participation
- Filter marketplace by affiliate group
- Earn both RCN and group tokens on completed orders

### 2.15 No-Show System (Customer)
- No-show warnings on home screen
- Tier-based restrictions (normal → warning → caution → deposit_required → suspended)
- Submit dispute for no-show marks
- Track dispute status (pending/approved/rejected)
- Tier recalculation after successful bookings

---

## 3. Shop Owner Features

### 3.1 Home / Dashboard
- Welcome header with shop name and logo
- **Quick stats**:
  - Today's bookings
  - Revenue this month
  - Active services
  - Pending actions
- **Subscription status** (active/expired/pending)
- **RCN balance** (purchased tokens)
- Quick action buttons

### 3.2 Services Management
- **Services tab** with all shop services
- **Create new service** with form:
  - Name, description, category
  - Price, duration, image upload
  - Tags, availability settings
- **Edit service** — update any field
- **Delete/Deactivate** services
- **Service details modal** with:
  - Details tab (service info)
  - Reviews tab (customer reviews)
  - Group Rewards tab (linked affiliate groups)
- **Availability Settings** per service:
  - Operating hours (7 days)
  - Break times
  - Slot duration (with custom input)
  - Buffer time (with custom input)
  - Advance booking days (with custom input)
  - Minimum notice hours (with custom input)
  - Max concurrent bookings
  - Weekend booking toggle
  - Date overrides (holidays, special hours)
- **Service-Group Integration**:
  - Link services to affiliate groups
  - Configure bonus reward percentages
  - Multiple group links per service

### 3.3 Bookings Tab
- **View modes**: Calendar | List
- **Calendar view**:
  - Week strip with color-coded dots
  - Full monthly calendar modal
  - Year/month picker
  - Status legend (Approved/Completed/Cancelled/Expired)
- **List view**:
  - Filter tabs: All, Approved, Completed, Cancelled, Expired
  - Sorted by booking date
  - Enhanced booking cards with actions
- **Booking actions**:
  - Approve booking
  - Mark as complete
  - Mark as no-show (with reason)
  - Cancel booking (with full refund)
  - Reschedule booking
- **Manual Booking** (walk-in/phone)
  - Search existing customers
  - Select service, date, time
  - Create booking on behalf of customer
- **"More" dropdown** with:
  - Reschedule Requests (with pending badge)
  - Disputes (with pending badge)

### 3.4 Reschedule Requests
- **Filter tabs**: Pending, Approved, Rejected, Expired, All
- View customer reschedule requests
- Request details:
  - Original date/time vs. requested date/time
  - Customer reason
  - Submission timestamp
- **Approve** — updates booking to new time
- **Reject** — notifies customer

### 3.5 Dispute Management
- **Filter tabs**: Pending, Approved, Rejected, All
- **Stats bar**: Pending count, Total count
- View customer dispute requests
- Dispute card shows:
  - Customer name and email
  - Dispute reason
  - Service name and no-show date
  - Customer tier at time of incident
- **Approve dispute** (with optional notes) — reverses no-show penalty
- **Reject dispute** (requires 10+ char reason) — penalty remains
- Automatic customer notification on resolution

### 3.6 Customers
- **Customer list** with:
  - Search by name/wallet
  - Filter tabs: My Customers, Search All
  - Filters: Tier (Bronze/Silver/Gold), Sort (Recent/Earnings/Active)
- **Customer cards** show:
  - Profile photo
  - Name, tier badge
  - Lifetime earnings
  - Total transactions
  - Last transaction date
  - Suspended status
- **Customer profile** with:
  - Full customer info
  - Transaction history
  - Booking history
  - Send message button

### 3.7 Analytics
- **Service Analytics Dashboard**
  - 8 metric cards (total services, revenue, avg order value, rating, etc.)
  - RCN metrics (redemption rate, discounts given)
  - Top 5 performing services
  - Category breakdown
  - Order trends (7/30/90 days)
  - Time period filters
- **Booking Analytics**
  - Booking conversion rates
  - Popular time slots
  - Customer demographics

### 3.8 Token Management
- **Reward Token** — issue RCN to customers for repairs
- **Redeem Token** — process customer redemptions
- **Buy Token** — purchase RCN from platform
  - Tiered pricing based on RCG holdings
  - Stripe checkout integration
- **Token balance** tracking
- **Purchase history**

### 3.9 Subscription
- **$500/month subscription** to access platform
- Stripe subscription management
- Status indicator (active/expired/cancelled)
- Renewal information
- Purchase history (accessible even without active subscription)
- Subscription form for first-time signup

### 3.10 Availability Management
- Operating hours for each day of week
- Break times
- Time slot configuration (duration, buffer, max concurrent)
- Advance booking limits
- Minimum booking notice
- Weekend booking toggle
- Date overrides for holidays/special events
- **Custom input** for non-preset values

### 3.11 No-Show Policy
- View current no-show policy settings
- Grace period configuration
- RCN redemption restrictions per tier
- Auto-detection settings
- Booking cancellation policy

### 3.12 Messages
- Same messaging features as customer
- Customer-initiated conversations
- **Moderation**:
  - Block/unblock customers
  - Search blocked customers
  - Unblock with confirmation

### 3.13 Reports
- Submit issue reports to platform admins
- Categories: Spam, Fraud, Harassment, Inappropriate Review, Other
- Severity levels: Low, Medium, High
- Optional entity linking (customer, review, order)
- Track report status (pending/investigating/resolved/dismissed)

### 3.14 Promo Codes
- Create discount codes for customers
- Usage tracking
- Expiration dates

### 3.15 Service Groups (Affiliate)
- Manage affiliate group memberships
- Link services to groups
- Configure bonus reward percentages
- View group analytics

### 3.16 Google Calendar Integration
- Connect Google Calendar via OAuth
- Sync bookings to personal calendar
- Receive notifications on mobile devices
- Multi-device scheduling

### 3.17 Settings
- Shop profile editor
- Business information
- Logo and banner upload
- Social links (Facebook, Twitter, Instagram)
- Notification preferences
- Account security
- Logout

---

## 4. Shared Features

### 4.1 Theme
- Dark theme throughout (#09090b background)
- Yellow accent color (#FFCC00) for primary actions
- Consistent spacing and typography

### 4.2 Navigation
- Tab-based navigation (Home, Services/Booking, Messages, Account)
- Role-based routing (customer vs shop dashboards)
- Deep linking support
- Back button handling

### 4.3 Error Handling
- Graceful error states with retry options
- Toast notifications (success/error/warning/info)
- Network error recovery
- Auth failure auto-recovery

### 4.4 Offline Support
- Cached data with React Query
- Pull-to-refresh on all list screens
- Offline-aware UI states

### 4.5 Platform Features
- **iOS**: Native iOS build with FixFlow app name
- **Android**: Native Android build
- Splash screen with FixFlow branding
- Custom app icon (both platforms)
- Push notifications (via Expo)

---

## 5. Testing Credentials

### Customer Test Account
- **Login method**: Connect any Thirdweb-compatible wallet or sign in with Google
- **Fresh customer**: New wallets auto-create customer account on first login

### Shop Test Account
- **Shop ID**: `peanut`
- **Login method**: Connect shop wallet
- **Test services**: 11 active services (Aqua Tech, Mongo Tea, etc.)

### Test Payment Card (Stripe Test Mode)
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any 5 digits

---

## Quick Demo Flow

### Customer Demo (5 minutes)
1. Connect wallet → see home with balance
2. Browse services → use search and filters
3. Tap a service → view details and reviews
4. Book service → schedule → apply RCN discount → pay with Stripe test card
5. Return to My Bookings → see new booking
6. Open Messages → send a message to the shop
7. View profile → check tier progress

### Shop Demo (5 minutes)
1. Connect wallet → shop dashboard
2. Go to Services → create a new service
3. Open Bookings tab → view calendar with bookings
4. Tap "More" → Reschedule Requests / Disputes
5. Open a booking → approve/complete/cancel
6. Check Analytics → view performance metrics
7. Open Customers → view customer list

---

## Known Limitations

- **Mobile wallet balance reading**: On-chain balance display uses placeholder (pending ThirdwebProvider configuration)
- **Customer reschedule requests**: Mobile UI pending (backend ready)
- **Shop tools tab**: Placeholder (coming soon)
- **Customer FAQ section**: Placeholder (coming soon)
- **Staking tab**: Placeholder (coming soon)
- **Wallet payouts**: Placeholder (coming soon)

---

## Support

For issues or questions:
- **Email**: Repaircoin2025@gmail.com
- **Website**: https://repaircoin.ai
- **Privacy Policy**: https://repaircoin.ai/privacy-policy
- **Delete Account**: https://repaircoin.ai/delete-account
