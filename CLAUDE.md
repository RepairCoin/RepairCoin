# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install everything
npm run install:all

# Start development
npm run dev        # Runs both frontend & backend

# Or run separately:
npm run server     # Backend on port 4000
npm run client     # Frontend on port 3001
```

## Essential Commands

```bash
# Backend Development
cd backend && npm run dev           # Start backend dev server (nodemon, port 4000)
cd backend && npm run lint:fix      # Fix linting issues
cd backend && npm run typecheck     # Type checking
cd backend && npm run test          # Run all tests (Jest)
cd backend && npm run test:watch    # Run tests in watch mode
cd backend && npm run test:admin    # Run admin domain tests only
cd backend && npm run build         # Production build

# Frontend Development
cd frontend && npm run dev          # Start frontend dev server (Next.js, port 3001)
cd frontend && npm run build        # Production build
cd frontend && npm run lint         # Lint frontend code

# Database
docker-compose up postgres -d       # Start PostgreSQL container
npm run db:migrate                  # Run database migrations (backend)
npm run db:check                    # Check database connection

# Admin Tools (from backend directory)
npm run admin:check-conflicts       # Check for role conflicts
npm run admin:promote <address> --action <deactivate|preserve|force>
npm run admin:history <address>     # View role change history
```

## Tech Stack

- **Backend**: Node.js + Express + TypeScript (Domain-Driven Design)
- **Frontend**: Next.js 15 + React 19 + Zustand  
- **Database**: PostgreSQL 15
- **Blockchain**: Thirdweb SDK v5 on Base Sepolia
- **Payments**: Stripe subscriptions ($500/month)

## Business Model

**Dual-Token System**:
- **RCN**: Utility token for rewards (1 RCN = $0.10 USD)
  - Shops purchase from admin at tiered pricing based on RCG holdings
  - Customers earn from repairs, redeem at shops
  - 20% base redemption at any shop (100% at shop where earned)
  
- **RCG**: Governance token (100M fixed supply)
  - Shop tiers: Standard/Premium/Elite (10K/50K/200K+ RCG)
  - Revenue sharing: 10% to stakers, 10% to DAO

## Architecture

### Backend Domain-Driven Design

The backend uses a domain-driven architecture with event-based communication:

**Core Domains** (`backend/src/domains/`):
- `CustomerDomain` - Customer management, tiers, referrals, wallet detection
- `ShopDomain` - Shop subscriptions, RCN purchasing, reward issuance
- `AffiliateShopGroupDomain` - Affiliate shop coalitions with custom tokens/points redeemable within groups
- `AdminDomain` - Platform analytics, treasury, user management
- `TokenDomain` - RCN/RCG minting, redemption, cross-shop transfers
- `WebhookDomain` - FixFlow and Stripe webhook processing
- `NotificationDomain` - Real-time notifications for users

**Domain Structure**: Each domain has:
- `index.ts` - Domain class implementing `DomainModule` interface
- `routes.ts` - Express routes (mounted at `/api/{domain-name}`)
- `controllers/` - Route handlers and business logic
- `services/` - Domain-specific services

**Key Architectural Components**:
- `DomainRegistry` - Registers and initializes all domains
- `EventBus` - Pub/sub for cross-domain communication (e.g., `customer:tier_updated`, `shop:subscription_activated`)
- `BaseRepository` - Abstract base class with transaction support, pagination, health checks
- Shared database pool via `database-pool.ts` to avoid connection exhaustion

**Repositories** (`backend/src/repositories/`):
- Data access layer using PostgreSQL
- Pattern: `{Entity}Repository extends BaseRepository`
- All use snake_case in DB, camelCase in application code
- Key repos: CustomerRepository, ShopRepository, AdminRepository, TransactionRepository, TreasuryRepository

**Middleware**:
- `auth.ts` - JWT authentication, role-based access control
- `permissions.ts` - Role validation (customer/shop/admin)
- `roleConflictValidator.ts` - Prevents admin role conflicts
- `errorHandler.ts` - Centralized error handling with request IDs

**Smart Contracts** (Base Sepolia):
- RCN: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` (utility token)
- RCG: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` (governance token)

### Frontend Architecture

**Tech**: Next.js 15 (App Router) + React 19 + TypeScript

**State Management**: Zustand stores (`frontend/src/stores/`)
- `authStore.ts` - Authentication, wallet connection, role management
- `customerStore.ts` - Customer data, balance, tier info

**Key Patterns**:
- Server/Client component separation for Web3 compatibility
- Thirdweb SDK v5 for wallet connection and blockchain interactions
- API calls via axios services in `frontend/src/services/`
- Role-based routing (customer/shop/admin dashboards)

## Environment Setup

```bash
cp env.example .env
```

**Required**:
- `THIRDWEB_CLIENT_ID` & `THIRDWEB_SECRET_KEY`
- `PRIVATE_KEY` (wallet private key without 0x)
- `ADMIN_ADDRESSES` (comma-separated admin wallets)
- `JWT_SECRET` (32+ chars)
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`

**API Docs**: http://localhost:4000/api-docs (Swagger UI)

### Important Configuration Notes

1. **Database Connection Pool**: Uses shared pool across all repositories to prevent "sorry, too many clients" errors
2. **CORS**: Configured to allow localhost:3000-3003, Digital Ocean, and Vercel deployments
3. **Stripe Webhooks**: Require raw body parsing - special route handling at `/api/shops/webhooks/stripe`
4. **Admin Security**: Admin addresses validated on startup via `StartupValidationService`
5. **Request Timeouts**: 30-second timeout on all requests
6. **Port Configuration**: Backend defaults to 4000, frontend to 3001 (may auto-increment if busy)

## Key Features

### Customer Features
- Tier system: Bronze/Silver/Gold (0/+2/+5 RCN bonuses)
- Referral rewards: 25 RCN referrer, 10 RCN referee
- No daily or monthly earning limits
- 20% redemption at any shop, 100% at earning shop
- Service marketplace browsing with filters and search
- Service favorites system for saving preferred services
- Social sharing (WhatsApp, Twitter, Facebook, copy link)
- Review and rating system for completed service bookings
- View service details with reviews and ratings
- **Group Rewards Discovery**:
  - Purple badges on service cards showing bonus token opportunities
  - Filter marketplace by affiliate group to find group-specific services
  - See all available tokens (RCN + group tokens) before booking
  - Automatic earning of both RCN and group tokens on service completion
  - Visual indicators across all views (marketplace, favorites, trending, recently viewed)
- **Appointment Scheduling**:
  - Select date and time when booking services
  - Real-time availability display based on shop hours
  - Visual time slot picker with availability indicators

### Shop Features
- $500/month Stripe subscription
- Purchase RCN at tiered pricing
- Issue rewards & process redemptions
- Customer lookup & management
- Service marketplace management (create, edit, delete, activate/deactivate)
- Image upload integration with DigitalOcean Spaces
- Service booking management with custom completion modal
- View and respond to customer reviews
- Service details modal with integrated reviews tab
- **Service-Group Integration**:
  - Link services to affiliate groups for bonus token rewards
  - Configure custom reward percentages (0-500%) per group
  - Set bonus multipliers (0-10x) for special promotions
  - Visual indicators showing which services offer group rewards
  - Automatic group token issuance on order completion
  - Manage multiple group links per service
- **Service Analytics Dashboard**:
  - Performance metrics and revenue tracking
  - Top 5 performing services with conversion rates
  - Category breakdown with detailed statistics
  - Order trends with time period filters (7/30/90 days)
  - RCN redemption analytics
  - Customer rating insights
- **Appointment Scheduling System**:
  - Configure operating hours for each day of week with break times
  - Set slot duration, buffer time, and max concurrent bookings
  - Manage holiday closures and special hours via date overrides
  - View all bookings in monthly calendar view
  - Click bookings to see full customer and order details
- **Moderation System**:
  - Block/unblock problematic customers with reason tracking
  - Search blocked customers by name, wallet, or reason
  - Submit issue reports to admins (spam, fraud, harassment, inappropriate reviews)
  - Flag reviews for admin review
  - Report tracking with status updates (pending/investigating/resolved/dismissed)
- View purchase history (accessible even without active subscription)

### Admin Features
- Platform statistics & analytics
- Shop approval & management
- Token minting & treasury tracking
- Customer management
- **Service Marketplace Analytics** (NEW):
  - Platform-wide performance overview
  - Marketplace health score (0-100) with 4 key metrics
  - Top performing shops and categories
  - Revenue and order trends
  - Service adoption and conversion rates
  - Customer satisfaction metrics

## Common Issues & Solutions

**Database "too many clients"**: The app uses a shared connection pool. If seeing this error, check for:
- Unclosed connections in custom queries
- Multiple server instances running simultaneously
- Pool size in `database-pool.ts` (default: 20 connections)

**Port Conflicts**: Backend uses 4000, frontend uses 3001 (Next.js auto-increments if busy). Check actual port in startup logs.

**Stripe Webhooks**:
```bash
stripe listen --forward-to localhost:4000/api/shops/webhooks/stripe
# Copy webhook secret to .env as STRIPE_WEBHOOK_SECRET
```

**JWT Auth Failures**: Ensure:
- `JWT_SECRET` is set (32+ characters)
- Wallet addresses are lowercase in both database and `ADMIN_ADDRESSES`
- Admin addresses validated on startup (check startup logs)

**Domain Not Registered**: If adding new domain, register it in `app.ts` via `domainRegistry.register(new YourDomain())`

**Event Not Firing**: Check EventBus subscriptions at `/api/system/info` or `/api/events/history`

## Development Guidelines

**Backend**:
- All domains must implement `DomainModule` interface
- Use EventBus for cross-domain communication (avoid direct domain imports)
- Database: snake_case for columns, camelCase in TypeScript
- Transaction handling: Use `BaseRepository.withTransaction()` for multi-step operations
- Error handling: Throw descriptive errors, middleware handles standardization

**Frontend**:
- Use "use client" directive for components with Web3 hooks
- State management: Zustand stores for global state, local state for component-specific
- API calls: Use existing service layers in `frontend/src/services/`
- Wallet addresses: Always lowercase before storage/comparison

**Testing**:
- Backend: Jest tests in `__tests__/` or `*.test.ts` files
- Run domain-specific tests: `npm run test:admin`, `npm run test:shop`, etc.
- Use `test:watch` for TDD workflow
- remember to only commit if i say so
- to check database check the env database is directly connected to digital ocean
- when creating a ui in frontend check shadcn components and use it

## Frontend Development Accomplishments

### Service Favorites System
- Created interactive heart icon button to save favorite services
- Built dedicated favorites view with grid layout for easy browsing
- Added favorite buttons to all service cards for quick access
- Shows real-time status of which services you've favorited
- Only available to customers (secure access)
- Integrated favorites directly into marketplace with toggle button
- One-click switch between all services and your saved favorites
- Clean interface that hides filters when viewing favorites only

### Social Sharing System
- Created share button with dropdown menu for easy sharing
- Integrated WhatsApp, Twitter, and Facebook sharing options
- Added one-click copy link feature with success notification
- Designed clean UI with recognizable social media icons
- Positioned share buttons on service cards for convenience
- Smart dropdown that closes when clicking outside

### Reviews & Ratings System
- Built star rating display that shows service quality at a glance
- Created review browsing with pagination for easy navigation
- Developed complete review submission form for customers
- Added star ratings visible on all service cards
- Customers can filter reviews by rating (1-5 stars)
- Expandable review cards to show full content
- Shop owners can respond to customer reviews
- Added "Helpful" voting so customers can highlight useful reviews
- Support for review photos (ready for future use)

### Shop Dashboard Improvements
- Fixed shop bookings layout with cleaner 3-column grid design
- Reduced oversized "Mark Complete" button to compact size
- Created custom CompleteOrderModal showing RCN rewards
- Moved status badges to header for better hierarchy
- Changed completion button to green for better UX
- Fixed duplicate order bug in payment flow
- Integrated service reviews into Services tab (removed separate Reviews tab)
- Made service cards clickable to open details modal
- Created ShopServiceDetailsModal with tabs for Details and Reviews
- Shop owners can view and respond to reviews from service details

### Service Analytics System (December 4, 2024)
- **Shop Analytics Dashboard** - Comprehensive performance tracking
  - 8 metric cards: total services, revenue, average order value, customer rating
  - RCN metrics: redemption rate, total redeemed, discounts given
  - Top 5 performing services with detailed stats
  - Category breakdown showing performance by service type
  - Order trends with daily activity for last 7/30/90 days
  - Time period filters for flexible analysis
- **Admin Analytics Dashboard** - Platform-wide insights
  - Marketplace health score (0-100) with color-coded status
  - 4 key health metrics: shop adoption, avg services per shop, order conversion, customer satisfaction
  - Top performing shops with revenue and rating data
  - Top categories by revenue and order count
  - Platform overview: total shops, revenue, orders, RCN metrics
- **Backend Implementation**
  - 11 new API endpoints (5 for shops, 6 for admins)
  - Complex SQL queries with CTEs for optimal performance
  - Full TypeScript API client with type safety
  - Real-time data aggregation

### Integration & Polish
- Connected review system to completed service bookings
- Customers can now write reviews directly from their orders
- Shows review status (whether already reviewed or eligible to review)
- Updated service details page with tabbed interface
- Separated service information and customer reviews for clarity
- All buttons on service cards now align perfectly at the bottom
- Fixed text overflow issues for long business names and addresses
- Repositioned action buttons for better visibility and access
- Enhanced button visibility with improved styling and effects
- All features work seamlessly on mobile and desktop devices
- Consistent design across all new features for professional look
- Smooth loading states and animations for better user experience

### Appointment Scheduling System (December 8, 2024)
- **Backend Infrastructure**
  - Created 5 database tables: shop_availability, shop_time_slot_config, service_duration_config, shop_date_overrides
  - Built AppointmentRepository with CRUD operations for availability management
  - Built AppointmentService with time slot generation algorithm
  - Created AppointmentController with 11 API endpoints
  - Added booking_time_slot and booking_end_time columns to service_orders
- **Customer Booking Flow**
  - TimeSlotPicker component with grid-based time selection
  - Real-time availability loading based on shop configuration
  - Visual indicators for available/unavailable slots
  - Integrated into ServiceCheckoutModal before payment
  - 12-hour time format with responsive design
- **Shop Management Interface**
  - AvailabilitySettings component with 3-tab interface:
    - Operating hours configuration for each day with break times
    - Booking settings: slot duration, buffer time, concurrent bookings
    - Date overrides for holidays and special hours
  - AppointmentCalendar component:
    - Monthly calendar view with all bookings
    - Color-coded by status (pending/confirmed/completed/cancelled)
    - Click bookings to view full details modal
    - Stats showing booking counts by status
  - Added "Appointments" section to shop sidebar navigation

### Appointment Reminders & Notifications System (December 15, 2024)
- **Backend Service (AppointmentReminderService.ts - 496 lines)**
  - Automated scheduler running every 2 hours checking for upcoming appointments
  - SQL query finds appointments 23-25 hours before scheduled time (2-hour window)
  - Professional HTML email templates for reminders and confirmations
  - State tracking with `reminder_sent` column to prevent duplicates
  - Graceful error handling that doesn't block payment processing
- **Customer Communications**
  - Immediate booking confirmation email after successful payment
  - 24-hour advance reminder email before appointment
  - In-app notifications for confirmations and reminders
  - Email shows booking details, shop info, RCN savings, and appointment time
  - Reminder email includes tip to arrive early and cancellation policy
- **Shop Notifications**
  - In-app notifications when new bookings are received
  - Alerts 24 hours before upcoming appointments
  - Shows customer name, service, and appointment time
  - Helps shops prepare for scheduled appointments
- **Integration**
  - Extended NotificationService with 3 new notification types
  - PaymentService sends confirmation immediately after payment success
  - App.ts initializes scheduler on startup with graceful shutdown
  - Non-blocking error handling ensures payment flow continues
- **Impact**
  - Reduces no-shows with professional reminder system
  - Improves customer experience with timely communications
  - Better shop preparation with advance notifications
  - Fully automated - zero manual intervention required

### RCN Earning Display Improvements (December 15, 2024)
- **Service Card Enhancements**
  - Moved RCN earning badge from header to bottom-right of service image
  - Consistent positioning across all cards regardless of title length
  - Compact design with Plus icon (+ 30 🪙) showing earning potential
  - Gold gradient badge with backdrop blur for visibility
  - Hover effect with scale animation for interactivity
- **Visual Design**
  - Plus icon clearly communicates "you will earn this"
  - Coin icon reinforces it's a currency reward
  - Smaller, cleaner badge that doesn't distract from service info
  - Tier bonus breakdown shown on hover tooltip
  - Shadow effect for depth and professional appearance
- **Layout Optimization**
  - Favorite button: Top right of image
  - Share button: Top right below favorite
  - RCN badge: Bottom right of image
  - Fixed text overflow issues with long service titles
  - Removed duplicate badge from header area

### Service-Group Integration System (December 19, 2024)
- **Backend Implementation (Complete)**
  - ServiceGroupController with 5 endpoints for linking services to affiliate groups
  - Duplicate prevention system (409 Conflict on duplicate links)
  - Automatic group token issuance on order completion
  - Database N+1 query optimization using PostgreSQL json_agg subquery
  - Groups data added to ALL 7 service endpoints:
    - Main services (getAllActiveServices)
    - Shop services (getServicesByShop)
    - Favorites (getCustomerFavorites)
    - Recently viewed (getRecentlyViewed)
    - Trending services (getTrendingServices)
    - Similar services (getSimilarServices)
    - Group services (getGroupServices)
  - Shared utilities for maintainability:
    - sqlFragments.ts - Reusable SQL subqueries and field selections
    - serviceMapper.ts - Consistent data transformation functions
- **Frontend Implementation (Complete)**
  - ServiceGroupSettings component (194 lines) for shop management
  - Purple group badge system on all service cards:
    - Bottom-left badges showing token symbols (e.g., "🏪 CDV+")
    - "+N more" indicator for 3+ groups
    - Hover tooltips explaining rewards
  - "BONUS GROUP REWARDS" info box inside service cards
  - Group filter dropdown in customer marketplace
  - API client (serviceGroups.ts) with 5 methods
  - Integration with ShopServiceDetailsModal (Group Rewards tab)
- **Visual Design (Purple Theme)**
  - Purple gradient backgrounds to distinguish from yellow RCN
  - Backdrop blur effects for visual depth
  - Responsive design for mobile and desktop
  - Consistent purple color scheme across all group features
- **Bug Fixes & Optimizations**
  - Fixed rate limiter for development (increased to 1000/10000 requests)
  - Fixed appointment calendar colors (paid = blue, not green)
  - Fixed N+1 query causing "too many clients" database errors
  - Fixed axios double .data access in API client
  - Fixed FavoriteController missing groups field in transformation
  - Fixed DiscoveryController endpoints missing groups data
- **Architecture Improvements**
  - DRY principle with shared SQL fragments
  - Single source of truth for service data mapping
  - Type-safe transformations with shared interfaces
  - Easy to maintain and extend for future features
- **Impact**
  - Shops can link services to multiple affiliate groups
  - Customers see purple badges showing which services offer bonus tokens
  - Automatic token issuance when orders complete
  - Customers earn both RCN + group tokens simultaneously
  - Filter marketplace by group to discover group-specific services

### Auth Resilience Improvements (February 2026)
- **Phase 1: SessionStorage Mutex**
  - Cross-refresh mutex using sessionStorage (`rc_auth_lock`)
  - 5-second lock timeout to prevent deadlocks
  - Prevents concurrent auth operations across rapid page refreshes
- **Phase 2: Session Caching**
  - Session profile caching in sessionStorage (`rc_session_cache`)
  - 30-second cache TTL for instant page loads
  - Cache-first strategy before API calls
- **Phase 3: Immediate Session Check**
  - Session check runs immediately on mount (before Thirdweb wallet restoration)
  - Decoupled from wallet connection state
  - Reduces load time from 2+ minutes to < 1 second
- **Phase 4: Shop Data Caching**
  - Shop data caching with 60-second TTL (`rc_shop_data_cache`)
  - Shop ID persistence for faster lookups (`rc_shop_id`)
  - Background refresh while showing cached content
- **Phase 5: Logout Fix**
  - `clearAllAuthCaches()` function clears all session-related caches
  - Proper redirect to home on logout/session expiry
  - Fixed "stuck on Initializing..." screen issue
- **Phase 6: Auto-Recovery Mechanism**
  - Tracks auth failures in 30-second sliding window
  - Triggers recovery after 3 failures (clears storage, redirects home)
  - Safety net for corrupted auth state edge cases
  - File: `frontend/src/utils/authRecovery.ts`
- **Phase 7: Wallet Mismatch Debounce**
  - 500ms stability check before triggering mismatch warnings
  - Prevents false positives during rapid wallet switches
  - Re-validates addresses after debounce period
  - Cancels pending checks on new wallet switches
- **Key Files**
  - `frontend/src/hooks/useAuthInitializer.ts` - Central auth flow
  - `frontend/src/utils/authRecovery.ts` - Auto-recovery mechanism
  - `frontend/src/stores/authStore.ts` - Auth state management
  - `frontend/src/services/api/client.ts` - API client with token refresh

### Shop Moderation System (March 20, 2026)
Complete end-to-end moderation system enabling shops to manage problematic customers, report platform issues, and flag inappropriate reviews.

- **Backend Implementation (Complete)**
  - **Database Migration** (`092_create_moderation_system.sql` - 159 lines)
    - 3 tables: blocked_customers, shop_reports, flagged_reviews
    - 13 optimized indexes with partial indexing for performance
    - Foreign key constraints with CASCADE delete
    - Check constraints for data integrity
    - Auto-update triggers for timestamps
  - **ModerationRepository** (`ModerationRepository.ts` - 432 lines)
    - Blocked customers: getBlockedCustomers, isCustomerBlocked, blockCustomer, unblockCustomer
    - Reports: getReports, createReport, getAllReports (admin), updateReportStatus (admin)
    - Flagged reviews: getFlaggedReviews, flagReview
    - Snake_case ↔ camelCase mapping
    - Parameterized queries for SQL injection prevention
    - Duplicate prevention with unique constraints
  - **Moderation Routes** (`moderation.ts` - 387 lines)
    - 8 RESTful API endpoints with full authentication
    - JWT authentication + shop role validation
    - Shop ownership verification (shops only access own data)
    - Input validation (categories, severity, wallet formats)
    - Comprehensive error handling (400/401/403/404/409/500)

- **Frontend Implementation (Complete)**
  - **ModerationSettings Component** (`ModerationSettings.tsx` - 607 lines)
    - Tabbed interface: Blocked Customers | Reports
    - Real-time search functionality for blocked customers
    - Customer cards showing name, wallet, reason, block date
    - One-click block/unblock actions with confirmations
    - Empty states with helpful messaging
  - **Block Customer Modal**
    - Wallet address input with validation
    - Reason textarea (required)
    - Warning about blocking consequences
    - Form validation and error handling
    - Toast notifications for success/error
  - **Report Issue Modal**
    - Category dropdown: spam, fraud, inappropriate_review, harassment, other
    - Severity selection: low, medium, high (color-coded buttons)
    - Description textarea (required)
    - Optional entity linking (customer, review, order)
    - Warning about false reports
  - **Reports Tab**
    - Display all submitted reports with status tracking
    - Color-coded severity indicators (red/yellow/blue)
    - Status badges (pending/investigating/resolved/dismissed)
    - Timestamp and category display
  - **API Client** (`moderation.ts` - 122 lines)
    - Full TypeScript type definitions
    - 7 API methods with error handling
    - Consistent response format handling

- **Features**
  - ✅ Block/unblock customers with reason tracking
  - ✅ Search blocked customers by name, wallet, or reason
  - ✅ Submit issue reports to admins (5 categories, 3 severity levels)
  - ✅ Flag inappropriate reviews for admin review
  - ✅ Track report status (pending → investigating → resolved/dismissed)
  - ✅ Duplicate prevention (can't block same customer twice, can't flag same review twice)
  - ✅ Lowercase wallet address normalization
  - ✅ Real-time toast notifications
  - ✅ Responsive design for mobile/desktop

- **Security**
  - JWT authentication required on all endpoints
  - Shop role validation
  - Shop ownership verification (shops can only manage their own data)
  - Input validation (wallet addresses, enums, required fields)
  - SQL injection prevention (parameterized queries)
  - Unique constraints prevent duplicates

- **Database Schema**
  - **blocked_customers**: Customer blocks with soft delete (is_active flag)
  - **shop_reports**: Issue reports with admin workflow (assigned_to, admin_notes, resolution)
  - **flagged_reviews**: Review moderation with admin review tracking
  - All tables have foreign keys to shops(shop_id) with CASCADE delete
  - Optimized indexes for fast queries (including partial indexes)

- **UX/UI Design**
  - Dark theme matching RepairCoin branding (#FFCC00 accents)
  - Loading spinners for async operations
  - Form validation with inline error messages
  - Confirmation dialogs for destructive actions (unblock)
  - Color-coded severity: Red (high), Yellow (medium), Blue (low)
  - Empty states encourage action
  - Mobile responsive layout

- **Bug Fixes**
  - Fixed 404 errors by correcting API URL structure
  - Removed non-existent customer_id column from queries
  - Fixed database query errors in ModerationRepository
  - Updated frontend API client to match backend route structure

- **Impact**
  - Shops can protect their business from problematic customers
  - Reduce no-shows by blocking repeat offenders
  - Report fraudulent activity to platform admins
  - Maintain professional reputation by flagging inappropriate reviews
  - Self-service moderation reduces admin support burden

### Google Calendar Integration (March 24, 2026 - April 2, 2026)
**Status:** 100% Complete ✅

Enables shops to sync appointment bookings with their Google Calendar for unified scheduling and mobile notifications.

- **Backend Implementation (Complete)**
  - **Database Migration** (`095_create_calendar_integration.sql` - 120 lines)
    - `shop_calendar_connections` table for OAuth token storage
    - Extended `service_orders` with calendar sync tracking columns
    - 6 performance indexes for fast lookups
    - Auto-update triggers and cleanup functions
    - Support for multiple providers (Google/Outlook/Apple ready)

  - **CalendarRepository** (`CalendarRepository.ts` - 340 lines)
    - Complete CRUD for calendar connections
    - Token management (save, refresh, expire)
    - Sync status tracking and error logging
    - Order-to-calendar event linking
    - Query methods for token refresh automation
    - Full transaction support

  - **GoogleCalendarService** (`GoogleCalendarService.ts` - 460 lines)
    - **OAuth 2.0 Flow**: Authorization URL generation, callback handling, token exchange
    - **Token Security**: AES-256-GCM encryption for access/refresh tokens
    - **Event Management**: Create, update, delete calendar events
    - **Auto Refresh**: Proactive token refresh before expiry
    - **Rich Events**: Customer details, service info, pricing, reminders
    - **Timezone Support**: Shop-specific timezone handling

  - **API Endpoints** (`CalendarController.ts` + Routes - 290 lines)
    - `GET /api/shops/calendar/connect/google` - Get OAuth URL
    - `POST /api/shops/calendar/callback/google` - Handle OAuth callback
    - `GET /api/shops/calendar/status` - Connection status
    - `DELETE /api/shops/calendar/disconnect/:provider` - Disconnect
    - `POST /api/shops/calendar/test-sync` - Manual sync (testing)
    - `POST /api/shops/calendar/refresh-token` - Manual refresh (testing)
    - Full authentication, authorization, and Swagger docs

- **Frontend Implementation (Complete)**
  - **CalendarIntegrationSettings Component** (`CalendarIntegrationSettings.tsx` - 200+ lines)
    - OAuth connection flow with Google redirect
    - Connection status display (connected/disconnected)
    - Calendar email and sync status tracking
    - Disconnect functionality with confirmation
    - Loading and error states
  - **Calendar API Client** (`calendar.ts` - 66 lines)
    - `connectGoogle()` - Get OAuth URL
    - `handleCallback()` - Process OAuth callback
    - `getConnectionStatus()` - Check connection
    - `disconnect()` - Remove connection
    - `testSync()` - Manual sync testing
  - **OAuth Callback Page** (`/shop/calendar/callback/page.tsx` - 90 lines)
    - Processes OAuth callback from Google
    - Success/error state handling
    - Auto-redirect to shop dashboard
    - Visual feedback with icons
  - **Integration**
    - Integrated into Shop Settings tab
    - Dedicated "Calendar Integration" section
    - Professional UI matching RepairCoin theme

- **Payment Integration (Complete - April 2, 2026)**
  - **PaymentService Integration** (`PaymentService.ts` modifications)
    - Auto-creates calendar event on successful payment (line 676-706)
    - Deletes calendar event on order cancellation (line 1033-1040)
    - Graceful error handling (doesn't fail payment if calendar fails)
    - Calculates 1-hour appointment duration automatically
    - Includes customer details, service info, pricing in calendar events

- **Reschedule Integration (Complete - April 2, 2026)**
  - **RescheduleService Integration** (`RescheduleService.ts` modifications)
    - Auto-updates calendar event when reschedule request is approved (line 355-378)
    - Auto-updates calendar event when shop reschedules directly (line 706-729)
    - Uses GoogleCalendarService.updateEvent() to modify existing calendar events
    - Updates booking date, start time, end time in calendar
    - Graceful error handling (doesn't fail reschedule if calendar fails)
    - Maintains calendar sync for all reschedule workflows

- **Features**
  - ✅ OAuth 2.0 integration with Google Calendar API
  - ✅ Encrypted token storage with automatic refresh
  - ✅ Calendar event CRUD operations
  - ✅ Multi-provider architecture (Google ready, others extensible)
  - ✅ Comprehensive error handling and logging
  - ✅ Frontend OAuth connection flow
  - ✅ Connection management UI
  - ✅ OAuth callback handling
  - ✅ **Auto-sync on appointment booking** (Integrated into PaymentService)
  - ✅ **Event deletion on cancellation** (Integrated into PaymentService)
  - ✅ **Event updates on reschedule** (Integrated into RescheduleService)

- **Security**
  - AES-256-GCM encryption for OAuth tokens at rest
  - PKCE flow support for OAuth security
  - State parameter for CSRF protection
  - Tokens never logged or exposed in responses
  - Scoped permissions (calendar.events, calendar.readonly, userinfo.email)
  - HTTPS-only redirect URIs for production

- **Documentation**
  - **Feature Spec**: `docs/features/GOOGLE_CALENDAR_INTEGRATION.md` (400+ lines)
    - Complete technical architecture and OAuth flow diagrams
    - Security considerations and best practices
    - 4-phase implementation plan (16-20 hours estimated)
  - **Setup Guide**: `docs/setup/GOOGLE_CALENDAR_SETUP.md` (350+ lines)
    - Step-by-step Google Cloud Platform configuration
    - Environment variable setup with encryption key generation
    - Testing procedures and troubleshooting guide
    - Production deployment checklist
  - **Next Session Guide**: `docs/setup/NEXT_SESSION_CALENDAR_INTEGRATION.md` (500+ lines)
    - Complete step-by-step implementation plan for remaining work
    - Code snippets for payment/appointment integration
    - Full frontend component implementations
    - Testing procedures and success criteria

- **NPM Dependencies**
  - `googleapis` - Official Google API client
  - `crypto-js` - Token encryption
  - `@types/crypto-js` - TypeScript definitions

- **Environment Variables Required**
  ```bash
  GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
  GOOGLE_CALENDAR_REDIRECT_URI=https://repaircoin.ai/api/shops/calendar/callback/google
  GOOGLE_CALENDAR_ENCRYPTION_KEY=<32-byte-hex-key>
  ```

- **Implementation Complete** ✅
  1. ~~Google Cloud Platform setup~~ ✅
  2. ~~Build frontend UI components~~ ✅
  3. ~~Integrate GoogleCalendarService with PaymentService~~ ✅
     - ✅ Imported GoogleCalendarService into PaymentService.ts
     - ✅ Calendar event creation on payment success
     - ✅ Calendar event deletion on cancellation
     - ✅ Graceful error handling (payment never fails due to calendar)
     - ✅ Helper method `calculateEndTime()` for 1-hour appointments
  4. Production testing (requires Google Cloud setup)

- **Impact**
  - Unified scheduling across RepairCoin and personal calendar
  - Mobile push notifications via Google Calendar

### Customer Cancellation & Refund System (January 2026)
**Status:** 100% Complete ✅

Full customer self-service cancellation with automatic refunds for both RCN tokens and Stripe payments.

- **Backend Implementation (Complete)**
  - **PaymentService.cancelOrder()** - Customer cancellation endpoint
    - Full RCN refund to customer wallet
    - Full Stripe payment refund (5-10 business days)
    - Transaction logging (`service_redemption_refund`)
    - Email notifications to customer
    - In-app notifications to customer and shop
  - **24-Hour Restriction** - Prevents cancellation within 24 hours of appointment
  - **Cancellation Data Tracking**
    - Cancellation reason (required)
    - Cancellation notes (optional)
    - Timestamp tracking
    - Cancelled by (customer/shop)

- **Frontend Implementation (Complete)**
  - **CancelBookingModal Component** (`/customer/CancelBookingModal.tsx` - 230 lines)
    - Clean modal UI with service details
    - 6 predefined cancellation reasons
    - Optional additional notes field
    - Refund preview display
      - Shows RCN refund amount
      - Shows USD payment refund amount
      - Displays refund timeline (5-10 days)
    - Warning message about irreversibility
    - Loading states during cancellation
    - Success/error toast notifications
  - **Integration**
    - Integrated into Customer Appointments tab
    - Integrated into Customer Service Orders tab
    - Cancel button visible on eligible bookings
    - Disabled for bookings within 24 hours

- **API Endpoint**
  - `POST /api/services/orders/:id/cancel`
  - Body: `{ cancellationReason: string, cancellationNotes?: string }`
  - Requires customer authentication
  - Returns success/error with detailed messages

- **Features**
  - ✅ Customer self-service cancellation
  - ✅ Automatic full RCN refund
  - ✅ Automatic full Stripe refund
  - ✅ 24-hour cancellation window enforcement
  - ✅ Cancellation reason tracking
  - ✅ Email confirmation to customer
  - ✅ In-app notifications
  - ✅ Transaction audit trail
  - ✅ Refund preview in UI
  - ⏳ Tiered refund policies (future enhancement)
  - ⏳ Shop-configurable policies (future enhancement)

- **Impact**
  - Customers can cancel without contacting support
  - Instant RCN refunds improve trust
  - Automatic Stripe refunds reduce admin work
  - 24-hour window protects shops from last-minute cancellations
  - Full transparency with refund preview

### Messaging System (2024-2026)
**Status:** 100% Complete ✅

Full-featured real-time messaging system between customers and shops with attachments, quick replies, and auto-responses.

- **Backend Implementation (Complete)**
  - **MessageController** - REST API for messaging
    - Send/receive messages with real-time updates
    - Upload message attachments (images, PDFs up to 5MB each)
    - Mark messages as read
    - Get conversation history with pagination
    - Archive/resolve conversations
  - **MessageService** - Business logic layer
    - Message validation (text or attachments required)
    - Attachment handling via ImageStorageService
    - Conversation threading
    - Unread count tracking per user type
  - **AutoMessageController** - Automated messaging
    - Quick reply templates (CRUD operations)
    - Auto-response rules with triggers
    - Scheduled message sending
  - **MessageRepository** - Data access layer
    - Efficient queries with conversation grouping
    - Unread count calculation
    - Message status tracking

- **Frontend Implementation (Complete)**
  - **MessagesContainer** (`MessagesContainer.tsx` - 500+ lines)
    - Inbox + thread view layout
    - Real-time polling (5-second intervals)
    - Mobile-responsive design
    - Filter by unread/date range
  - **ConversationThread** (`ConversationThread.tsx` - 600+ lines)
    - Message composition with emoji picker
    - Attachment upload (drag & drop + file picker)
    - Image preview for attachments
    - Message status indicators (sent/delivered/read)
    - Archive/resolve conversation button
    - Quick reply dropdown
    - Typing indicators
  - **QuickReplyManager** (`QuickReplyManager.tsx` - 200+ lines)
    - Create/edit/delete quick replies
    - Category organization (general, booking, payment, greeting)
    - Title and content templates
    - One-click insertion into messages
  - **AutoMessagesManager** (`AutoMessagesManager.tsx` - 300+ lines)
    - Configure auto-response rules
    - Trigger conditions (keywords, time-based)
    - Scheduled message campaigns
  - **MessageInbox** - Conversation list with search
  - **Integration**
    - Customer Messages tab
    - Shop Messages tab
    - Booking-specific messaging

- **Features**
  - ✅ Real-time messaging between customers and shops
  - ✅ Message attachments (images, PDFs, up to 5 files, 5MB each)
  - ✅ Emoji picker for expressive messaging
  - ✅ Quick reply templates with categories
  - ✅ Auto-response system with rule builder
  - ✅ Archive/resolve conversations
  - ✅ Unread count tracking
  - ✅ Message status indicators (sent/delivered/read)
  - ✅ Typing indicators
  - ✅ Search conversations
  - ✅ Filter by unread/date range
  - ✅ Mobile-responsive design
  - ✅ Drag-and-drop file upload
  - ⏳ Export conversation to CSV (documented, not implemented)

- **API Endpoints**
  - `POST /api/messages/send` - Send message with optional attachments
  - `POST /api/messages/attachments/upload` - Upload files (up to 5, 5MB each)
  - `GET /api/messages/conversations` - List all conversations
  - `GET /api/messages/conversation/:id` - Get messages in conversation
  - `PUT /api/messages/mark-read` - Mark messages as read
  - `PUT /api/messages/archive/:id` - Archive conversation
  - `GET /api/messages/quick-replies` - Get quick reply templates
  - `POST /api/messages/quick-replies` - Create quick reply
  - `PUT /api/messages/quick-replies/:id` - Update quick reply
  - `DELETE /api/messages/quick-replies/:id` - Delete quick reply
  - `GET /api/messages/auto-messages` - Get auto-response rules
  - `POST /api/messages/auto-messages` - Create auto-response rule

- **Impact**
  - Customers can ask questions before booking
  - Shops can provide real-time support
  - Reduces support burden with quick replies
  - Auto-responses handle common inquiries 24/7
  - Professional communication with attachments
  - Better customer experience with emoji support

### Auto-Cancel Expired Bookings (April 2026)
**Status:** 100% Complete ✅

Automated cleanup of expired unpaid bookings with shop management UI for manual bulk cancellation.

- **Backend Implementation (Complete)**
  - **BookingCleanupService** (`BookingCleanupService.ts` - 179 lines)
    - Runs every 2 hours via cron
    - Auto-cancels pending bookings past their scheduled date
    - 1-hour grace period after appointment time
    - Logs all auto-cancellations
    - Graceful error handling
  - **API Endpoints** (3 total)
    - `GET /api/services/orders/expired-unpaid` - Fetch expired bookings
    - `POST /api/services/orders/bulk-cancel` - Cancel selected bookings
    - `POST /api/services/orders/cancel-all-expired` - Cancel all at once
  - **OrderRepository Extensions**
    - `getExpiredUnpaidOrders()` - Query expired bookings
    - `bulkCancelOrders()` - Batch cancellation
    - `cancelAllExpiredUnpaid()` - Single-query cleanup

- **Frontend Implementation (Complete)**
  - **ExpiredBookingsSection Component** (`ExpiredBookingsSection.tsx` - 320 lines)
    - Dedicated "Expired" tab in shop bookings
    - Grid view of all expired unpaid bookings
    - Checkbox selection system for bulk operations
    - "Select All" / "Deselect All" toggle
    - Individual booking cards with details
    - Orange "Expired" status badges
    - Empty state when no expired bookings
  - **Bulk Actions**
    - "Cancel Selected (N)" button - Cancel checked bookings
    - "Cancel All" button - One-click cleanup
    - Confirmation dialogs before cancellation
    - Success/error toast notifications
  - **Booking Cards**
    - Service image, name, customer info
    - Booking date, time, and amount
    - Click to select/deselect
    - Visual selection feedback (yellow border)
  - **Integration**
    - Added to BookingsTabV2 as third tab
    - Auto-refresh main bookings after bulk cancel
    - Loading states with spinners

- **Features**
  - ✅ Automated cleanup every 2 hours
  - ✅ 1-hour grace period protection
  - ✅ Manual bulk cancellation UI
  - ✅ Individual selection with checkboxes
  - ✅ Cancel all expired in one click
  - ✅ Empty state when clean
  - ✅ Real-time count display
  - ✅ Confirmation dialogs
  - ✅ Toast notifications

- **Impact**
  - Keeps booking database clean automatically
  - Shops can manually manage expired bookings
  - Reduces clutter in main bookings list
  - Prevents confusion from old pending bookings
  - Reduce no-shows with calendar reminders
  - Professional customer experience
  - Multi-device appointment access

### WhatsApp & Messenger Integration (April 6, 2026)
**Status:** Frontend Complete ✅ | Backend Integration Pending ⏳

Direct customer communication via WhatsApp and Facebook Messenger with automated booking notifications.

- **Frontend Implementation (Complete)**
  - **ChatButton Component** (`ChatButton.tsx` - 140 lines)
    - Single platform: Shows direct "Chat on WhatsApp" or "Chat on Messenger" button
    - Multiple platforms: Shows dropdown with both options
    - Pre-filled messages with shop name and service name
    - Smart display: Only shows if shop has WhatsApp/Messenger configured
    - Professional UI: Color-coded (green for WhatsApp, blue for Messenger, purple for both)

  - **Service Card Integration** (`ServiceCard.tsx`)
    - Chat button appears above "Book Now" button
    - Conditional rendering based on shop's social media settings
    - Pre-filled message: "Hi [Shop Name]! I'm interested in your '[Service Name]' service. Is this available?"
    - Opens WhatsApp/Messenger app with one click

  - **Shop Settings UI** (`SocialMediaSettings.tsx`)
    - Added WhatsApp field: `https://wa.me/1234567890`
    - Added Messenger field: `https://m.me/yourshop`
    - Professional input forms with icons and descriptions
    - Included in social media statistics counter
    - Save/update via existing shop details API

- **Backend Implementation (Complete)**
  - **WhatsAppService** (`WhatsAppService.ts` - 295 lines)
    - **Booking Confirmations**: Sent immediately after payment
    - **Appointment Reminders**: Sent 24 hours before appointment
    - **Order Completion**: Sent when service is marked complete
    - **Cancellation Notifications**: Sent with refund information
    - E.164 phone number formatting
    - Graceful fallback (doesn't break if WhatsApp not configured)
    - Professional message templates with emojis
    - Support for Facebook WhatsApp Business API
    - Ready for Twilio WhatsApp API (alternative provider)
    - Environment-based configuration

  - **API Integration** (Pending)
    - Environment variables: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`
    - Needs integration into `PaymentService.ts` for booking confirmations
    - Needs integration into `AppointmentReminderService.ts` for reminders
    - Backend service endpoints must return `shopWhatsapp` and `shopMessenger` fields

- **Documentation** (`docs/integrations/WHATSAPP_SETUP.md` - 400+ lines)
  - Complete setup guide for Facebook WhatsApp Business API
  - Alternative setup for Twilio WhatsApp API
  - Environment configuration instructions
  - Testing procedures
  - Message templates and examples
  - Cost estimates for different providers
  - Troubleshooting guide

- **Database Schema** (Pending Verification)
  - Columns needed in `shops` table:
    - `whatsapp VARCHAR(255)` - WhatsApp link (e.g., https://wa.me/1234567890)
    - `messenger VARCHAR(255)` - Messenger link (e.g., https://m.me/shopname)

- **Features**
  - ✅ Chat Now buttons on all service cards
  - ✅ Pre-filled messages with context
  - ✅ Shop settings UI for WhatsApp/Messenger links
  - ✅ WhatsApp API service for automated notifications
  - ✅ Comprehensive setup documentation
  - ⏳ Backend endpoint integration (returns whatsapp/messenger fields)
  - ⏳ PaymentService WhatsApp notification integration
  - ⏳ AppointmentReminderService WhatsApp notification integration
  - ⏳ Database column verification/migration
  - 🔮 WhatsApp Business API production setup

- **Impact**
  - Customers can chat with shops directly from service cards
  - Reduced friction in customer communication
  - Automated booking confirmations via WhatsApp
  - 24-hour appointment reminders reduce no-shows
  - Professional customer communication experience
  - Especially valuable in regions where WhatsApp is dominant (Latin America, Europe, Asia)

- **Next Steps** (See `docs/NEXT_SESSION_WHATSAPP_MESSENGER.md`)
  - Update backend service endpoints to return `shopWhatsapp` and `shopMessenger`
  - Integrate WhatsAppService into PaymentService for booking confirmations
  - Integrate WhatsAppService into AppointmentReminderService for reminders
  - Verify database columns exist or create migration
  - Test end-to-end flow
  - Optional: Set up WhatsApp Business API for production (requires Facebook verification)
