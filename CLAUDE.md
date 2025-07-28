# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Start backend in development mode
npm run server
cd backend && npm run dev

# Start frontend in development mode  
npm run client
cd frontend && npm run dev


# Build backend
npm run build
cd backend && npm run build

# Start production backend
npm run start
cd backend && npm run start
```

### Backend-Specific Commands
```bash
# Linting and type checking
cd backend && npm run lint
cd backend && npm run lint:fix
cd backend && npm run typecheck

# Testing
cd backend && npm run test
cd backend && npm run test:watch
cd backend && npm run test:coverage

# Database operations
cd backend && npm run healthcheck
curl http://localhost:3000/api/health

# API Documentation
cd backend && npm run docs:open
cd backend && npm run dev:docs  # Start server + open docs
```

### Frontend-Specific Commands
```bash
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run start
```

### Docker Operations
```bash
# Start all services
docker-compose up -d

# Start database only
docker run -d --name repaircoin-db -p 5432:5432 \
  -e POSTGRES_DB=repaircoin \
  -e POSTGRES_USER=repaircoin \
  -e POSTGRES_PASSWORD=repaircoin123 \
  postgres:15

# Connect to database
docker exec -it repaircoin-db psql -U repaircoin -d repaircoin
```

## Architecture Overview

### Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with enhanced schema for new requirements
- **Frontend**: Next.js 15 + React 19 + TypeScript + Zustand state management
- **Blockchain**: Thirdweb on Base Sepolia
- **Containerization**: Docker + Docker Compose

### Business Model Overview
- **Revenue Model**: Shops purchase RCN tokens directly from RepairCoin admin at $1.00 per RCN
- **Token Distribution**: Shops distribute earned RCN to customers as loyalty rewards
- **Redemption Value**: 1 RCN = $1.00 USD guaranteed within shop network
- **Cross-Shop Network**: Customers can use 20% of their balance at other participating shops
- **Market Protection**: Only earned RCN (not market-bought) can be redeemed at shops

### Domain-Driven Architecture
The backend uses an enhanced domain-driven architecture with the following structure:

```
backend/src/
├── domains/
│   ├── DomainRegistry.ts         # Central domain management
│   ├── types.ts                  # Domain interfaces
│   ├── customer/                 # Customer management domain
│   ├── shop/                     # Shop management domain
│   ├── token/                    # Token operations domain
│   │   ├── routes/
│   │   │   ├── index.ts          # Token statistics and main routes
│   │   │   └── verification.ts   # Verification API endpoints
│   │   └── services/
│   │       └── VerificationService.ts # Centralized verification logic
│   ├── webhook/                  # Webhook processing domain
│   └── admin/                    # Admin operations domain
├── events/
│   └── EventBus.ts              # Domain event system
├── services/
│   └── DatabaseService.ts       # Central database operations
├── middleware/                   # Express middleware
├── utils/                        # Shared utilities
└── docs/                        # API documentation
```

Each domain follows the pattern:
- `{Domain}Domain.ts` - Domain registration and initialization
- `controllers/` - HTTP request handlers
- `services/` - Business logic
- `routes/` - Express route definitions

### Key Components

**DomainRegistry (`backend/src/domains/DomainRegistry.ts:4-56`)**:
- Manages domain registration and initialization
- Provides centralized route management
- Handles graceful shutdown across all domains

**DatabaseService (`backend/src/services/DatabaseService.ts`)**:
- Centralized PostgreSQL operations
- Customer, shop, and transaction management
- Built-in pagination support

**EventBus (`backend/src/events/EventBus.ts`)**:
- Inter-domain communication
- Event history tracking
- Subscription management

### Blockchain Integration
- **Contract**: `0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5` on Base Sepolia
- **SDK**: Thirdweb v5 for token operations
- **Network**: Base Sepolia testnet
- **Token Economics**: 
  - Fixed supply: 1 billion RCN tokens
  - Shop purchase price: $1.00 per RCN (fixed)
  - Open market price: Floating (independent of shop redemption value)
  - Anti-arbitrage: Centralized verification prevents market-bought tokens from shop redemption

## Environment Configuration

Copy `env.example` to `.env` and configure:

**Essential Variables**:
- `THIRDWEB_CLIENT_ID` - From Thirdweb dashboard
- `THIRDWEB_SECRET_KEY` - From Thirdweb dashboard
- `PRIVATE_KEY` - Wallet private key (without 0x prefix)
- `REPAIRCOIN_CONTRACT_ADDRESS` - Already set to deployed contract
- `ADMIN_ADDRESSES` - Your wallet address for admin access
- `JWT_SECRET` - Generate 32+ character secret

**Database Connection**:
- Uses PostgreSQL with connection pooling
- Docker: `postgresql://repaircoin:repaircoin123@postgres:5432/repaircoin`
- Local: Update `DB_HOST`, `DB_USER`, `DB_PASSWORD` accordingly

## API Documentation

The API uses Swagger/OpenAPI documentation:
- **Local**: http://localhost:3000/api-docs
- **JSON Spec**: http://localhost:3000/api-docs.json
- **Access**: `npm run docs:open` in backend directory

### Customer Tier System

**Tier Levels & Benefits**:
- **Bronze Tier** (0-199 lifetime RCN): +10 RCN bonus per repair transaction
- **Silver Tier** (200-999 lifetime RCN): +20 RCN bonus per repair transaction  
- **Gold Tier** (1000+ lifetime RCN): +30 RCN bonus per repair transaction

**Earning Structure**:
- Small repairs ($50-$99): 10 RCN base + tier bonus
- Large repairs ($100+): 25 RCN base + tier bonus
- Daily limit: 40 RCN (excluding bonuses)
- Monthly limit: 500 RCN (excluding bonuses)

### Role Exclusivity System

**Key Principle**: Each wallet address can only be registered as ONE role - shop, customer, or admin. This prevents conflicts and ensures clear identity management.

**New API Endpoints**:
- `GET /api/shops/wallet/{address}` - Find shop by wallet address (returns 404 if not found)
- **Updated** `POST /api/shops/register` - Now validates that wallet isn't already a customer or admin
- **Updated** `POST /api/customers/register` - Now validates that wallet isn't already a shop or admin

**Role Conflict Responses**:
All registration endpoints return HTTP 409 (Conflict) with a `conflictingRole` field when a wallet is already registered:
```json
{
  "success": false,
  "error": "This wallet address is already registered as a customer and cannot be used for shop registration",
  "conflictingRole": "customer"
}
```

**Frontend Implementation**:
- Landing page (`/app/page.tsx`) checks existing registrations on wallet connection
- Shows appropriate UI based on existing roles:
  - Existing customers see "Already Registered" with dashboard link
  - Existing shops see application status (pending/verified)
  - Role conflicts show clear messaging explaining why registration is blocked
- Registration forms handle role conflict errors gracefully

**Backend Implementation**:
- `RoleValidator` utility (`/backend/src/utils/roleValidator.ts`) - Central role validation logic
- Role conflict middleware (`/backend/src/middleware/roleConflictValidator.ts`) - Reusable validation
- Database methods check wallet addresses across all tables

### Admin Dashboard API Endpoints

**Authentication**:
- `POST /api/auth/admin` - Generate JWT token for admin users
- All admin routes require JWT Bearer token authentication

**Shop Management**:
- `GET /api/admin/shops` - List active/verified shops (default: active=true, verified=true)
- `GET /api/admin/shops?verified=false` - List pending shop applications
- `POST /api/admin/shops/{shopId}/approve` - Approve pending shop application
- `POST /api/admin/create-shop` - Admin creates new shop with full validation

**Platform Management**:
- `GET /api/admin/stats` - Platform statistics (customers, shops, transactions, tokens)
- `GET /api/admin/customers` - List customers with pagination and filters
- `POST /api/admin/mint` - Manual token minting to customer addresses
- `POST /api/admin/create-admin` - Create new admin user (placeholder implementation)

**Shop RCN Management**:
- `POST /api/admin/shops/{shopId}/sell-rcn` - Process shop RCN purchases at $1 per token
- `GET /api/admin/shops/{shopId}/rcn-balance` - Check shop's purchased RCN balance
- `GET /api/admin/shops/{shopId}/purchase-history` - View shop's RCN purchase history

**System Operations**:
- `POST /api/admin/contract/pause` - Emergency contract pause
- `POST /api/admin/contract/unpause` - Resume contract operations
- `GET /api/admin/webhooks/failed` - List failed webhook deliveries

## Enhanced Features

### Admin Dashboard (`/frontend/src/app/admin/page.tsx`)

**Complete admin management interface with the following tabs:**

**Overview Tab**:
- Platform statistics dashboard showing total customers, active shops, pending applications
- Real-time data from `/api/admin/stats` endpoint
- Quick action buttons for common admin tasks

**Customers Tab**:
- Paginated customer list with tier information and lifetime earnings
- Manual token minting capability (100 RCN quick mint button)
- Customer status management (active/suspended)

**Active Shops Tab**:
- List of verified and active shops
- Shop performance metrics (tokens issued, RCN balance, cross-shop status)
- Shop management actions (edit, verify)

**Shop Applications Tab**:
- Review pending shop applications (unverified shops)
- Approve/reject workflow with one-click approval
- Application details (contact info, application date, status)
- Real-time status updates after approval

**Create Admin Tab**:
- Form to create new admin accounts
- Permission-based role assignment
- Wallet address validation

**Create Shop Tab**:
- Complete shop creation form matching registration schema
- Business information, wallet details, location data
- Instant verification and activation options

**Authentication & Security**:
- JWT-based authentication for all admin operations
- Automatic token refresh and session management
- Admin address validation against `ADMIN_ADDRESSES` environment variable

### Shop Registration System

The shop registration form (`frontend/src/app/shop/register/page.tsx`) includes comprehensive business information:

**Personal Information**:
- First Name, Last Name
- Phone Number, Email Address

**Business Information**:
- Shop ID (unique identifier)
- Company Name
- Company Size (1-10, 11-50, 51-100, 100+ employees)
- Monthly Revenue (<$10k, $10k-$50k, $50k-$100k, $100k+)
- Role (Owner, Manager, Employee)
- Website URL (optional)
- Referral information (optional)

**Address Information**:
- Street Address
- City, Country
- Additional location fields for mapping

**Terms and Conditions**:
- Required acceptance checkbox
- Detailed terms including verification requirements

### State Management Architecture

**Zustand Store (`frontend/src/stores/authStore.ts`)**:
- Centralized authentication state
- Wallet integration with Thirdweb
- Role-based access control (admin/shop/customer)
- DevTools integration for debugging

**Authentication Hook (`frontend/src/hooks/useAuth.tsx`)**:
- Auto-sync between wallet connection and auth state
- Higher-order component (withAuth) for route protection
- Role validation and access control

## Development Guidelines

### Code Patterns
- All TypeScript with strict typing
- Domain-driven architecture with event-based communication
- RESTful API design with consistent response formats
- Comprehensive error handling and logging

### Database Operations
- Use `DatabaseService.ts` for all database operations
- Built-in connection pooling and transaction support
- Pagination helper for large result sets
- Proper error handling and query logging

### Frontend Integration
- Next.js 15 with Thirdweb integration for Web3 functionality
- **State Management**: Zustand store replacing React Context for better performance
- **Authentication**: Custom useAuth hook with wallet integration and role-based access
- Tailwind CSS for styling with responsive design
- TypeScript throughout with strict typing
- **File Structure**: Components use `.tsx` extension for JSX support

### Testing Strategy
- Jest for backend unit/integration tests
- Test files: `**/__tests__/**/*.ts` or `**/*.{spec,test}.ts`
- Coverage reporting available

## Blockchain Operations

The system integrates with a deployed RepairCoin token contract:
- **Minting**: Admin can mint tokens to customer wallets
- **Balance Checking**: Real-time token balance queries
- **Transaction Logging**: All blockchain operations are logged in PostgreSQL

### Centralized Verification System

**Purpose**: Prevent arbitrage by distinguishing earned RCN from market-bought RCN

**Key Endpoints**:
- `POST /api/tokens/verify-redemption` - Validate if customer's RCN can be redeemed
- `GET /api/tokens/earned-balance/{address}` - Get customer's earned (redeemable) RCN balance
- `POST /api/shops/{shopId}/redeem` - Process customer redemption with verification

**Verification Rules**:
- Only RCN earned from repairs, referrals, or shop bonuses can be redeemed
- Market-purchased RCN cannot be redeemed at shops
- Cross-shop redemptions limited to 20% of earned balance
- Same-shop redemptions allow 100% of earned balance

**Implementation Details**:
- **VerificationService** (`backend/src/domains/token/services/VerificationService.ts:56-394`) - Core verification logic
- **Home Shop Detection** - Automatically identifies customer's primary earning shop
- **Earning Breakdown** - Tracks RCN sources: repairs, referrals, tier bonuses
- **Batch Processing** - Supports bulk verification for admin operations
- **Real-time Validation** - Integrated into shop redemption flow at `backend/src/domains/shop/routes/index.ts:692-716`

## Common Issues

### Admin Dashboard Authentication
If admin dashboard shows "Authentication required" errors:
1. Verify `ADMIN_ADDRESSES` environment variable contains your wallet address
2. Ensure `JWT_SECRET` is configured (32+ characters)
3. Check that wallet address in `ADMIN_ADDRESSES` matches connected wallet exactly
4. Frontend should be calling `POST /api/auth/admin` to get JWT token

### Shop Count Discrepancies
If Overview stats don't match Active Shops tab:
- Overview shows only verified AND active shops
- Shop Applications tab shows unverified shops
- Total shops = Active Shops + Pending Applications

### Date Display Issues
If shop applications show "Invalid Date":
- Backend returns `join_date` (snake_case) 
- Frontend expects both `joinDate` and `join_date` formats
- Date validation handles empty/invalid dates gracefully

### Database Connection
If database connection fails, ensure PostgreSQL is running:
```bash
docker-compose up postgres -d
```

### Contract Operations  
If blockchain operations fail, verify:
1. `THIRDWEB_CLIENT_ID` and `THIRDWEB_SECRET_KEY` are correct
2. `PRIVATE_KEY` is valid and has Base Sepolia ETH

### Frontend Build Issues
**JSX in TypeScript files**: Use `.tsx` extension for files containing JSX
**Next.js 15 Turbopack**: Some syntax patterns may need adjustment for compatibility
**Port conflicts**: Frontend may use alternative ports (3002, 3003) if 3000 is occupied

### Database Connection Issues
If you see "Connection terminated due to connection timeout" errors:
1. **Check Database Container**: Ensure PostgreSQL container is running
   ```bash
   docker ps | grep postgres
   docker logs repaircoin-db --tail 10
   ```
2. **Test Direct Connection**: Verify database responds
   ```bash
   docker exec repaircoin-db psql -U repaircoin -d repaircoin -c "SELECT 1;"
   ```
3. **Environment Variables**: Ensure `.env` file has correct database credentials
   - `DB_HOST=localhost`
   - `DB_USER=repaircoin`
   - `DB_PASSWORD=repaircoin123`
   - `DB_NAME=repaircoin`
4. **Connection Pool Settings**: Current settings in DatabaseService.ts:
   - Connection timeout: 10 seconds (increased from 2s)
   - Idle timeout: 30 seconds
   - Keep-alive: enabled

### Thirdweb v5 Issues
If you see "parseUnits was not found" errors:
- **Issue**: Thirdweb v5 doesn't export `parseUnits` from utils
- **Solution**: Use manual BigInt conversion as implemented in `frontend/src/components/ThirdwebPayment.tsx:10-12`
- **Alternative**: Import from ethers.js if needed: `import { parseUnits } from 'ethers'`

### Database Viewing
**TablePlus Connection**:
- Host: localhost:5432
- Database: repaircoin
- Username: repaircoin  
- Password: repaircoin123

**Shop ID Purpose**: Human-readable business identifiers for easy shop reference

## Recent Updates

### July 25, 2025 Development Session
- **Shop Wallet Lookup Endpoint**: Added `/api/shops/wallet/{address}` endpoint to find shops by wallet address
- **Role Exclusivity System**: Implemented strict role separation - wallets can only be registered as one role (shop, customer, or admin)
- **Frontend Role Conflict UI**: Landing page now prevents inappropriate registration based on existing roles
- **Role Validation Middleware**: Added backend middleware to enforce role exclusivity during registration
- **Swagger Documentation**: Enhanced API docs with role conflict examples and responses

### July 23, 2025 Development Session
- **State Management Migration**: Replaced React Context with Zustand for improved performance
- **Enhanced Shop Registration**: Added comprehensive business information fields
- **Admin Shop Creation**: Backend API for admins to create shops with field mapping
- **Authentication Improvements**: Role-based access control with wallet integration
- **Build System Fixes**: Resolved Next.js 15 Turbopack compatibility issues
- **Database Integration**: Enhanced field mapping between frontend and database schema

### July 28, 2025 Development Session - Business Model Update
- **New Business Model**: Shops now purchase RCN tokens from RepairCoin admin at $1 per token
- **Tier Bonus System**: Implemented automatic bonuses (Bronze +10, Silver +20, Gold +30 RCN per transaction)
- **Cross-Shop Rules**: Changed to 20% balance limit (replacing tier-based transaction limits)
- **Centralized Verification**: Added API to track earned vs market-bought RCN
- **Arbitrage Prevention**: Only earned RCN can be redeemed at shops, market-bought tokens blocked
- **Database Fix**: Fixed `updateShop` method field mapping for proper SQL generation

### July 28, 2025 Evening Session - System Fixes
- **Verification Service Implementation**: Added complete verification system with new endpoints
  - `POST /api/tokens/verify-redemption` - Validate customer redemptions
  - `GET /api/tokens/earned-balance/{address}` - Get earned vs market-bought RCN breakdown
  - `GET /api/tokens/earning-sources/{address}` - Detailed earning history by shop
  - `POST /api/tokens/verify-batch` - Batch verification for admin operations
- **Shop Redemption Integration**: Updated shop redemption flow to use centralized verification
- **Thirdweb v5 Compatibility**: Fixed `parseUnits` import error in payment component
- **Database Connection Improvements**: 
  - Increased connection timeout from 2s to 10s
  - Fixed credential defaults to match production setup
  - Added keep-alive for stable connections
- **Live Crypto Payments**: Enhanced shop dashboard with USDC/ETH payment integration

### API Documentation
If Swagger doesn't load, check that `ENABLE_SWAGGER=true` in environment variables.