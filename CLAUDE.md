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
- `AdminDomain` - Platform analytics, treasury, user management
- `TokenDomain` - RCN/RCG minting, redemption, cross-shop transfers
- `WebhookDomain` - FixFlow and Stripe webhook processing

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

### Shop Features  
- $500/month Stripe subscription
- Purchase RCN at tiered pricing
- Issue rewards & process redemptions
- Customer lookup & management

### Admin Features
- Platform statistics & analytics
- Shop approval & management  
- Token minting & treasury tracking
- Customer management

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