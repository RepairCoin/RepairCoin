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

### Database Viewing
**TablePlus Connection**:
- Host: localhost:5432
- Database: repaircoin
- Username: repaircoin  
- Password: repaircoin123

**Shop ID Purpose**: Human-readable business identifiers for easy shop reference

## Recent Updates

### July 23, 2025 Development Session
- **State Management Migration**: Replaced React Context with Zustand for improved performance
- **Enhanced Shop Registration**: Added comprehensive business information fields
- **Admin Shop Creation**: Backend API for admins to create shops with field mapping
- **Authentication Improvements**: Role-based access control with wallet integration
- **Build System Fixes**: Resolved Next.js 15 Turbopack compatibility issues
- **Database Integration**: Enhanced field mapping between frontend and database schema
3. Contract address matches deployed contract

### API Documentation
If Swagger doesn't load, check that `ENABLE_SWAGGER=true` in environment variables.