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
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Blockchain**: Thirdweb on Base Sepolia
- **Containerization**: Docker + Docker Compose

### Domain-Driven Architecture
The backend uses an enhanced domain-driven architecture with the following structure:

```
backend/src/
├── domains/
│   ├── DomainRegistry.ts         # Central domain management
│   ├── types.ts                  # Domain interfaces
│   ├── customer/                 # Customer management + cross-shop verification
│   │   └── services/
│   │       └── CrossShopVerificationService.ts # 20% cross-shop verification
│   ├── shop/                     # Shop management + RCN purchasing + tier bonuses
│   │   └── services/
│   │       ├── ShopPurchaseService.ts    # Shop RCN purchasing at $1 per RCN
│   │       └── TierBonusService.ts       # Tier bonus system (10/20/30 RCN)
│   ├── token/                    # Token operations domain
│   ├── webhook/                  # Enhanced webhook processing with tier bonuses
│   └── admin/                    # Admin operations domain
├── services/
│   └── DatabaseService.ts        # Enhanced with new tables and methods
├── events/
│   └── EventBus.ts              # Domain event system
├── middleware/                   # Express middleware
├── utils/                        # Shared utilities
└── docs/                        # API documentation
```

### New Enhanced Features

**Shop RCN Purchasing System**:
- Shops purchase RCN at $1.00 per token
- Minimum 100 RCN purchase requirement  
- Multiple payment methods (credit card, bank transfer, USDC)
- Automatic balance tracking and alerts

**Tier Bonus System**:
- **Bronze**: +10 RCN bonus per qualifying repair
- **Silver**: +20 RCN bonus per qualifying repair
- **Gold**: +30 RCN bonus per qualifying repair
- Applied to every repair ≥ $50
- Deducted from shop's purchased RCN balance

**Cross-Shop Verification (20% Limit)**:
- Universal 20% limit for all tiers (not tier-based)
- Only earned RCN can be redeemed at shops (anti-arbitrage)
- Centralized verification API for real-time validation
- 80% home shop balance + 20% cross-shop balance

**Anti-Arbitrage Protection**:
- Token source tracking (earned vs purchased)
- Only earned tokens redeemable at shops
- Market-bought tokens blocked from shop redemption
- Complete audit trail for all token sources

### Enhanced Database Schema

**New Tables**:
- `shop_rcn_purchases` - Shop RCN purchase records
- `token_sources` - Anti-arbitrage token source tracking
- `cross_shop_verifications` - Centralized verification logs
- `tier_bonuses` - Tier bonus application records

**Enhanced Tables**:
- `shops` - Added RCN balance fields and purchase tracking
- `transactions` - Extended with token source and cross-shop flags
- `customers` - Enhanced with tier progression tracking

### Key Components

**ShopPurchaseService (`backend/src/domains/shop/services/ShopPurchaseService.ts`)**:
- Handles shop RCN purchases at $1 per token
- Payment processing and balance management
- Automatic purchase recommendations
- Purchase history and analytics

**TierBonusService (`backend/src/domains/shop/services/TierBonusService.ts`)**:
- Calculates tier bonuses (10/20/30 RCN by tier)
- Applies bonuses to qualifying repair transactions
- Tracks bonus history and statistics
- Shop balance verification and deduction

**CrossShopVerificationService (`backend/src/domains/customer/services/CrossShopVerificationService.ts`)**:
- Real-time 20% cross-shop redemption verification
- Anti-arbitrage token source validation
- Centralized verification API for shops
- Network-wide cross-shop analytics

**Enhanced DatabaseService**:
- 20+ new methods for enhanced features
- Token source tracking for anti-arbitrage
- Cross-shop balance calculations
- Tier bonus application with shop balance deduction

### Blockchain Integration
- **Contract**: `0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5` on Base Sepolia
- **SDK**: Thirdweb v5 for token operations
- **Network**: Base Sepolia testnet
- **Token Economics**: Fixed 1B RCN supply with controlled distribution

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

### New API Endpoints

**Shop RCN Purchasing**:
- `POST /api/shops/purchase/initiate` - Initiate RCN purchase
- `POST /api/shops/purchase/complete` - Complete RCN purchase
- `GET /api/shops/purchase/balance/{shopId}` - Get shop RCN balance
- `GET /api/shops/purchase/history/{shopId}` - Get purchase history

**Tier Bonus System**:
- `POST /api/shops/tier-bonus/preview` - Preview tier bonus for repair
- `POST /api/shops/tier-bonus/calculate` - Calculate tier bonus
- `GET /api/shops/tier-bonus/stats/{shopId}` - Get shop tier bonus stats
- `GET /api/shops/tier-bonus/customer/{customerAddress}` - Get customer bonus history

**Cross-Shop Verification**:
- `POST /api/customers/cross-shop/verify` - Verify cross-shop redemption
- `GET /api/customers/cross-shop/balance/{customerAddress}` - Get cross-shop balance breakdown
- `POST /api/customers/cross-shop/process` - Process approved redemption
- `GET /api/customers/cross-shop/history/{customerAddress}` - Get verification history
- `GET /api/customers/cross-shop/stats/network` - Network-wide stats

## Development Guidelines

### Code Patterns
- All TypeScript with strict typing
- Domain-driven architecture with event-based communication
- RESTful API design with consistent response formats
- Comprehensive error handling and logging

### New Business Logic Implementation

**Shop RCN Purchasing**:
- All purchases at exactly $1.00 per RCN
- Minimum 100 RCN purchase enforced
- Shop balance tracked separately from blockchain tokens
- Tier bonuses deducted from purchased balance

**Tier Bonus Application**:
- Automatically applied to repairs ≥ $50
- Bonus amounts: Bronze=10, Silver=20, Gold=30 RCN
- Shop must have sufficient purchased balance
- Failed bonuses logged for audit but don't fail repair

**Cross-Shop Verification**:
- 20% universal limit (not tier-specific)
- Only earned/bonus tokens eligible for shop redemption
- Market-purchased tokens blocked from shop use
- Real-time verification before redemption

### Database Operations
- Use `DatabaseService.ts` for all database operations
- Built-in connection pooling and transaction support
- New methods for shop purchasing, tier bonuses, cross-shop verification
- Token source tracking for anti-arbitrage protection
- Comprehensive audit trails for all operations

### Service Integration
- `ShopPurchaseService` for all RCN purchasing operations
- `TierBonusService` for bonus calculations and application
- `CrossShopVerificationService` for redemption verification
- Enhanced `WebhookService` with automatic tier bonus application

### Frontend Integration
- Next.js with Thirdweb integration for Web3 functionality
- New components needed for shop purchasing interface
- Cross-shop balance display (80% home / 20% cross-shop)
- Tier bonus preview for repair estimates

### Testing Strategy
- Jest for backend unit/integration tests
- Test files: `**/__tests__/**/*.ts` or `**/*.{spec,test}.ts`
- Test new services thoroughly, especially financial calculations
- Mock external payment processing in tests

## Blockchain Operations

The system integrates with a deployed RepairCoin token contract:
- **Minting**: Admin can mint tokens to customer wallets
- **Balance Checking**: Real-time token balance queries
- **Transaction Logging**: All blockchain operations are logged in PostgreSQL

## Common Issues

### Database Connection
If database connection fails, ensure PostgreSQL is running:
```bash
docker-compose up postgres -d
```

### Contract Operations  
If blockchain operations fail, verify:
1. `THIRDWEB_CLIENT_ID` and `THIRDWEB_SECRET_KEY` are correct
2. `PRIVATE_KEY` is valid and has Base Sepolia ETH
3. Contract address matches deployed contract

### API Documentation
If Swagger doesn't load, check that `ENABLE_SWAGGER=true` in environment variables.