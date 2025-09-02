# RepairCoin Backend

RESTful API server for RepairCoin dual-token ecosystem (RCN utility + RCG governance).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up postgres -d

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## 📁 Architecture

Domain-driven design with modular structure:

```
src/
├── domains/           # Business domains
│   ├── customer/     # Customer management
│   ├── shop/         # Shop operations
│   ├── token/        # Token verification
│   ├── admin/        # Admin functions
│   └── webhook/      # External integrations
├── repositories/     # Data access layer
├── middleware/       # Express middleware
├── migrations/       # Database migrations
└── contracts/        # Blockchain integration
```

## 🔧 Key Features

- **Unlimited RCN Supply**: No cap on token minting
- **Burn on Redemption**: Tokens destroyed when used
- **Dual-Token Support**: RCN (utility) + RCG (governance)
- **Shop Tier Pricing**: Based on RCG holdings
- **Domain Events**: Inter-domain communication
- **JWT Authentication**: Secure API access

## 📊 Database

PostgreSQL with migrations in `src/migrations/`:
- `000_complete_schema.sql` - Full schema
- `002_unlimited_supply.sql` - v3.0 updates

## 🔐 Environment Variables

See `env.example` for required configuration:
- RCN/RCG contract addresses
- Thirdweb credentials
- Database connection
- JWT secrets

## 📚 API Documentation

Swagger UI available at: http://localhost:3000/api-docs

## 🧪 Testing

```bash
npm test
npm run test:coverage
```