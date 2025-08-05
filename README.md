# RepairCoin

## What is RepairCoin?

RepairCoin is the first tokenized rewards ecosystem designed for the global gadget and robotics repair industry. Powered by FixFlow.ai, it lets customers earn and redeem digital tokens for services while enabling shops to participate in a modern Web3 economy.

---

## 🌍 Mission

To revolutionize customer loyalty and retention in the repair industry by introducing a Web3-powered reward system that replaces traditional coupons and discount codes with blockchain-based tokens.

---

## 💡 Key Features

- **ERC-20 Token on Base Network** - Secure, scalable blockchain infrastructure
- **Real-world Utility** - Tokens tied directly to in-store repair services
- **Tiered Rewards System** - Bronze, Silver, Gold tiers with increasing benefits
- **Smart Referral System** - 25 RCN for referrer, 10 RCN for referee (after first repair)
- **Cross-Shop Network** - Use earned tokens across participating repair shops
- **Anti-Arbitrage Protection** - Only earned tokens can be redeemed at shops
- **Shop RCN Management** - Shops purchase RCN at $0.10 per token for customer rewards

---

## 📊 Market Opportunity

- $4B U.S. gadget repair market
- $20B+ global repair services
- $200B+ loyalty industry
- 400M+ global crypto users

---

## 🛠️ Technical Stack

### Backend
- **Node.js + Express + TypeScript** - RESTful API server
- **PostgreSQL** - Primary database with enhanced schema
- **Domain-Driven Architecture** - Modular, scalable design
- **Thirdweb SDK v5** - Blockchain interactions
- **JWT Authentication** - Secure API access

### Frontend
- **Next.js 15 + React 19** - Modern web application
- **TypeScript** - Type-safe development
- **Zustand** - State management
- **Tailwind CSS** - Responsive styling
- **Thirdweb React SDK** - Web3 wallet integration

### Infrastructure
- **Docker + Docker Compose** - Container orchestration
- **Base Sepolia Testnet** - Current deployment
- **GitHub Actions** - CI/CD pipeline

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/repaircoin.git
cd repaircoin
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Start PostgreSQL with Docker**
```bash
docker run -d --name repaircoin-db \
  -p 5432:5432 \
  -e POSTGRES_DB=repaircoin \
  -e POSTGRES_USER=repaircoin \
  -e POSTGRES_PASSWORD=repaircoin123 \
  postgres:15
```

4. **Configure environment**
```bash
cp env.example .env
# Edit .env with your configuration
```

5. **Start development servers**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

6. **Access the application**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API Documentation: http://localhost:3000/api-docs

---

## 🔐 Current Tokenomics

### Token Distribution
- **Total Supply**: 1 Billion RCN
- **Shop Purchase Price**: $0.10 per RCN
- **In-Store Redemption**: 1 RCN = $1.00 value

### Earning Structure
- **Small Repairs ($50-$99)**: 10 RCN base + tier bonus
- **Large Repairs ($100+)**: 25 RCN base + tier bonus
- **Referral Rewards**: 25 RCN (referrer) + 10 RCN (referee) after first repair
- **Daily Limit**: 40 RCN (excluding bonuses)
- **Monthly Limit**: 500 RCN (excluding bonuses)

### Tier System
- **Bronze** (0-199 RCN): +10 RCN bonus per repair
- **Silver** (200-999 RCN): +20 RCN bonus per repair
- **Gold** (1000+ RCN): +30 RCN bonus per repair

### Redemption Rules
- **Home Shop**: 100% of earned balance
- **Cross-Shop**: 20% of earned balance
- **Market-Bought Tokens**: Cannot be redeemed at shops

---

## 📁 Project Structure

```
RepairCoin/
├── backend/
│   ├── src/
│   │   ├── domains/        # Domain-driven modules
│   │   ├── repositories/   # Data access layer
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── app.ts         # Application entry
│   └── migrations/        # Database migrations
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   ├── hooks/         # Custom React hooks
│   │   └── stores/        # Zustand stores
│   └── public/           # Static assets
└── docs/                 # Documentation
```

---

## 🔧 Key Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Run tests
cd backend && npm run test

# Lint code
cd backend && npm run lint
cd frontend && npm run lint
```

### Database
```bash
# Connect to database
docker exec -it repaircoin-db psql -U repaircoin -d repaircoin

# Health check
curl http://localhost:3000/api/health
```

### Documentation
```bash
# Open API docs
cd backend && npm run docs:open

# Start with docs
cd backend && npm run dev:docs
```

---

## 🤝 B2B Value for Repair Shops

- **Customer Loyalty** - Automated rewards for repeat customers
- **Cross-Shop Network** - Attract customers from other shops
- **Analytics Dashboard** - Track performance and customer behavior
- **Marketing Tools** - Built-in referral system and promotions
- **FixFlow Integration** - Seamless CRM and repair tracking

---

## 📝 Recent Updates

### August 5, 2025
- Fixed referral tracking to properly increment referral counts
- Implemented repair-completion requirement for referral rewards
- Fixed RCN breakdown case sensitivity issues
- Updated wallet detection service for better user routing

### July 28, 2025
- Implemented new business model: shops purchase RCN at $0.10
- Added centralized verification system
- Created tier bonus system
- Updated cross-shop redemption to 20% limit

---

## 🔒 Security Considerations

- All wallet addresses stored in lowercase
- JWT authentication for admin operations
- Role-based access control (customer/shop/admin)
- Anti-arbitrage verification system
- Smart contract pause functionality

---

## 📩 Contact

- **Website**: [repaircoin.ai](https://repaircoin.ai)  
- **Email**: funders@repaircoin.ai
- **GitHub**: [RepairCoin Repository](https://github.com/your-org/repaircoin)

---

## 📄 License

This project is proprietary software. All rights reserved.