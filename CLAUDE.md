# CLAUDE.md

Guidance for AI assistants working with the RepairCoin codebase.

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
# Backend
cd backend && npm run lint:fix      # Fix linting issues
cd backend && npm run typecheck     # Type checking
cd backend && npm run test          # Run tests
cd backend && npm run build         # Production build

# Frontend  
cd frontend && npm run build        # Production build

# Database
docker-compose up postgres -d       # Start PostgreSQL
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

**Backend**: Domain-driven with `/domains` (customer, shop, admin, token, webhook)
**Repositories**: Data access layer with BaseRepository pattern
**Key Services**: DomainRegistry, EventBus, DatabaseService

**Contracts**:
- RCN: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`  
- RCG: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`

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

**API Docs**: http://localhost:4000/api-docs

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

## Common Issues

**Database Connection**: Ensure PostgreSQL is running with `docker-compose up postgres -d`

**Port Conflicts**: Backend uses 4000, frontend uses 3001 (may increment if busy)

**Stripe Webhooks**: Use `stripe listen --forward-to localhost:4000/api/webhooks/stripe`

**JWT Auth**: Ensure `JWT_SECRET` is set and wallet addresses match `ADMIN_ADDRESSES`

## Development Guidelines

- TypeScript with strict typing throughout
- Domain-driven architecture with event-based communication
- RESTful APIs with consistent response formats
- Repository pattern for data access
- Zustand for frontend state management