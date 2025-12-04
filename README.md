# RepairCoin

## What is RepairCoin?

RepairCoin is a dual-token ecosystem revolutionizing the repair industry through blockchain-based loyalty rewards (RCN) and decentralized governance (RCG). Powered by FixFlow.ai, it creates a transparent, cross-shop rewards network where customers earn tokens for repairs and shops benefit from tiered pricing based on their governance token holdings.

---

## 🌍 Mission

To build the first community-governed loyalty ecosystem for the repair industry, where shops with higher RCG stakes receive better RCN pricing, creating aligned incentives between platform success and participant rewards.

---

## 💡 Key Features

### Dual-Token Architecture
- **RCN (RepairCoin)** - Unlimited supply utility token for loyalty rewards
- **RCG (RepairCoin Governance)** - Limited 100M supply governance token

### For Customers
- **Fixed Value Rewards** - 1 RCN = $0.10 USD redemption value (no volatility)
- **Tiered Rewards System** - Bronze, Silver, Gold tiers with +10/+20/+30 RCN bonuses
- **Smart Referral System** - 25 RCN for referrer, 10 RCN for referee (after first repair)
- **Cross-Shop Network** - Use 20% of earned tokens at any participating shop
- **No Trading Complexity** - Pure utility token, not available on exchanges

### For Shops
- **RCG-Based Tier Pricing**:
  - Standard (10K-49K RCG): $0.10 per RCN
  - Premium (50K-199K RCG): $0.08 per RCN (20% discount)
  - Elite (200K+ RCG): $0.06 per RCN (40% discount)
- **Affiliate Shop Groups/Coalitions** - Create custom loyalty programs with other shops using unique tokens/points redeemable within the group
- **Governance Participation** - Vote on platform parameters via RCG holdings
- **Revenue Sharing** - 10% of RCN sales distributed to RCG stakers

### Platform Features
- **Unlimited RCN Minting** - No supply cap ensures continuous operations
- **Burn on Redemption** - Tokens destroyed when used, creating natural scarcity
- **DAO Governance** - RCG holders control earning rates, limits, and parameters
- **Anti-Fraud Protection** - Daily/monthly limits and pattern monitoring

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
- **Digital Ocean App Platform** - Production deployment
- **Base Sepolia Testnet** - Current blockchain deployment
- **GitHub Actions** - Automated CI/CD pipeline

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

# Terminal 3: Stripe Webhooks (optional)
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

6. **Access the application**
- Frontend: http://localhost:3001
- Backend API: http://localhost:4000
- API Documentation: http://localhost:4000/api-docs

---

## 🔐 Token Economics

### RCN (RepairCoin) - Utility Token
- **Supply Model**: Unlimited minting capability
- **Fixed Value**: 1 RCN = $0.10 USD at all shops
- **Token Flow**: Admin → Shops → Customers → Burned
- **No Trading**: Internal ecosystem only, not on exchanges

### RCG (RepairCoin Governance) - Governance Token
- **Total Supply**: 100 Million RCG (fixed)
- **Purpose**: Platform governance and shop tier benefits
- **Minimum Stake**: 10,000 RCG to become partner shop
- **Lock Period**: 6 months minimum after activation

### Customer Earning Structure
- **Small Repairs ($50-$99)**: 10 RCN base + tier bonus
- **Large Repairs ($100+)**: 25 RCN base + tier bonus
- **Referral Rewards**: 25 RCN (referrer) + 10 RCN (referee) after first repair
- **Daily Limit**: 50 RCN per customer
- **Monthly Limit**: 500 RCN per customer

### Customer Tier System
- **Bronze** (0-199 RCN lifetime): +10 RCN bonus per repair
- **Silver** (200-999 RCN lifetime): +20 RCN bonus per repair
- **Gold** (1000+ RCN lifetime): +30 RCN bonus per repair

### Shop Tier System (RCG-Based)
| Tier | RCG Required | RCN Price | Investment | Benefits |
|------|--------------|-----------|------------|----------|
| Standard | 10K-49K | $0.10 | ~$5,000 | Basic platform access |
| Premium | 50K-199K | $0.08 | ~$25,000 | Advanced analytics, priority support |
| Elite | 200K+ | $0.06 | ~$100,000 | VIP status, dedicated account manager |

### Revenue Distribution
- **Platform Operations**: 80% (development, infrastructure, support)
- **RCG Stakers**: 10% (weekly USDC rewards)
- **DAO Treasury**: 10% (community-controlled funds)

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
curl http://localhost:4000/api/health
```

### Deployment

RepairCoin uses automated deployment via GitHub Actions to Digital Ocean App Platform.

```bash
# Automatic deployment (on push to main branch)
git push origin main

# Manual deployment trigger
# Go to GitHub Actions → Deploy Backend → Run workflow

# View deployment logs
# GitHub Actions tab shows real-time deployment status
```

For detailed deployment setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Stripe Webhook Setup

RepairCoin uses Stripe webhooks to automatically process shop subscription events. Follow these steps to set up webhook testing locally:

#### 1. Install Stripe CLI
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (via Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget -O stripe.tar.gz https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xzf stripe.tar.gz
sudo mv stripe /usr/local/bin/
```

#### 2. Login to Stripe
```bash
stripe login
```

#### 3. Start Webhook Forwarding
```bash
# Forward Stripe webhooks to your local backend
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Copy the webhook signing secret from the output (starts with whsec_)
# Add it to your .env file as STRIPE_WEBHOOK_SECRET
```

#### 4. Test Webhook Events
```bash
# Trigger a test subscription event
stripe trigger customer.subscription.created

# Trigger payment success
stripe trigger invoice.payment_succeeded

# View webhook logs
stripe logs tail
```

#### 5. Verify Setup
- Check backend logs for webhook processing
- Visit `/api-docs` and test webhook endpoints
- Monitor `webhook_logs` table in database
- Use Stripe Dashboard to view webhook delivery status

#### Important Environment Variables
```bash
# Required in .env file
STRIPE_SECRET_KEY=sk_test_...          # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_...        # From stripe listen command
STRIPE_MONTHLY_PRICE_ID=price_...      # Your subscription price ID
STRIPE_MODE=test                       # Use 'live' for production
```

#### Production Webhook Setup
For production deployment:
1. Create webhook endpoint in Stripe Dashboard
2. Set URL to `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `customer.subscription.*`, `invoice.*`
4. Copy webhook signing secret to production environment

### Documentation
```bash
# Open API docs
cd backend && npm run docs:open

# Start with docs
cd backend && npm run dev:docs
```

---

## 🤝 Value Propositions

### For Repair Shops
- **Lower Token Costs** - Up to 40% discount based on RCG holdings
- **Customer Loyalty** - Automated rewards for repeat customers
- **Cross-Shop Network** - Attract 20% spending from other shops' customers
- **Governance Rights** - Vote on platform parameters and improvements
- **Revenue Sharing** - Earn from platform success as RCG staker
- **FixFlow Integration** - Seamless CRM and repair tracking

### For Customers
- **No Volatility** - Fixed $0.10 redemption value
- **Cross-Shop Usage** - Rewards work at any participating shop
- **Tier Benefits** - Earn more as you progress
- **Simple Experience** - No crypto knowledge required
- **Referral Rewards** - Earn by bringing friends

### For RCG Investors
- **Revenue Share** - 10% of all RCN sales distributed weekly
- **Governance Control** - Direct platform decisions
- **Demand Driver** - Shops must stake RCG for benefits
- **Limited Supply** - Only 100M RCG will ever exist

---

## 📝 Recent Updates

### December 4, 2024
- **Service Analytics Dashboard** - Comprehensive performance tracking for shops
  - Top performing services with conversion rates
  - Category breakdown and revenue analytics
  - Order trends with customizable time periods (7/30/90 days)
  - RCN redemption and customer rating insights
- **Admin Marketplace Analytics** - Platform-wide insights
  - Marketplace health score (0-100) based on 4 key metrics
  - Top performing shops and service categories
  - Revenue and order trends across all shops
- Fixed deployment errors (TypeScript compilation and missing dependencies)
- Fixed shop purchase history accessibility
- Fixed customer marketplace query bug

### December 2-3, 2024
- **Reviews & Ratings System**
  - Customer reviews with 1-5 star ratings
  - Shop response capability
  - Helpful voting and verified order badges
  - Integrated review tabs in service details
- **Service Favorites System**
  - Save/bookmark favorite services
  - Dedicated favorites view with toggle
  - One-click access from marketplace
- **Social Sharing**
  - Share services via WhatsApp, Twitter, Facebook
  - Copy link feature with success notifications
- **Shop Dashboard Improvements**
  - Redesigned booking items with compact layout
  - Custom completion modal showing RCN rewards
  - Clickable service cards opening details modal

### September 1, 2025
- Transitioned to dual-token model (RCN utility + RCG governance)
- Updated RCN to unlimited supply with burn mechanism
- Implemented RCG-based shop tier pricing system
- Added revenue distribution model for RCG stakers
- Configured separate Thirdweb projects for each token

### August 5, 2025
- Fixed referral tracking to properly increment referral counts
- Implemented repair-completion requirement for referral rewards
- Fixed RCN breakdown case sensitivity issues
- Updated wallet detection service for better user routing

### July 28, 2025
- Implemented new business model: shops purchase RCN
- Added centralized verification system
- Created customer tier bonus system
- Updated cross-shop redemption to 20% limit

---

## 🚧 Implementation Roadmap

### Phase 1: RCG Foundation (Current - Months 1-3)
- ✅ Deploy RCG token contract (100M supply)
- ⏳ Build DAO governance system
- ⏳ Implement shop tier system
- ⏳ Create RCG staking platform

### Phase 2: RCN Integration (Months 4-6)
- ✅ Deploy RCN token contract (unlimited supply)
- ⏳ Implement burn mechanism on redemption
- ⏳ Build tier-based pricing for shops
- ⏳ Integrate FixFlow CRM webhooks

### Phase 3: Network Launch (Months 7-9)
- ⏳ Multi-shop deployment with tier benefits
- ⏳ Cross-shop redemption system activation
- ⏳ Mobile app launch (iOS/Android)
- ⏳ Marketing website launch

### Phase 4: Advanced Features (Months 10-12)
- ⏳ Enhanced analytics dashboard
- ⏳ Automated marketing integrations
- ⏳ Advanced fraud detection
- ⏳ DAO parameter adjustment tools

### 📱 HIGH Priority (Core Functionality)
1. **Mobile Applications**
   - **Customer App**: View balance, QR code for redemptions, find shops, share referrals
   - **Shop App**: QR scanner, issue rewards, view balance, transaction reporting
   - Critical for real-world usage

2. **FixFlow Webhook Integration**
   - Receive `repair_completed` webhooks to auto-mint tokens
   - Receive `referral_verified` and `ad_funnel_conversion` events
   - Currently using manual reward issuance

3. **QR Code System**
   - Generate unique QR codes for each customer
   - Shop scanning interface for redemptions
   - Real-time validation and processing

4. **Security & Compliance**
   - Smart contract professional audit
   - Penetration testing
   - Terms of Service and Privacy Policy
   - KYC/AML procedures if required

### 🔧 MEDIUM Priority (Enhanced Features)
1. **Public Marketing Website**
   - repaircoin.ai landing page
   - Shop onboarding information
   - Customer education materials

2. **Guest Wallet Solutions**
   - Web3Auth or Magic.link integration
   - Allow non-crypto users to participate
   - Email/social login options

3. **Advanced Analytics**
   - Detailed platform metrics beyond basic stats
   - Revenue projections and insights
   - Export capabilities for reports

4. **Shop Integration Tools**
   - POS system APIs
   - Bulk repair upload
   - Automated reconciliation

### ✅ Already Implemented
- Complete backend API with domain-driven architecture
- Admin dashboard with full platform control
- Customer and shop registration flows
- Dual-token system (RCN + RCG contracts deployed)
- Referral system with repair requirement
- Centralized verification for redemptions
- Treasury management with unlimited minting
- Customer tier system with bonuses
- Basic analytics and reporting

---

## 🏛️ Governance Parameters (RCG DAO Controlled)

The following parameters can be adjusted through RCG token holder votes:

### Customer Parameters
- RepairCoin earning rates (currently 10-25 RCN per repair)
- Customer tier bonus amounts (currently +10/+20/+30 RCN)
- Daily earning limit (currently 50 RCN)
- Monthly earning limit (currently 500 RCN)
- Referral rewards (currently 25/10 RCN)

### Shop Parameters
- Cross-shop redemption limit (currently 20%)
- Minimum RCG stake requirements
- Shop tier thresholds and benefits
- Onboarding requirements

### Platform Parameters
- Revenue distribution (currently 80/10/10 split)
- DAO treasury allocation
- Security parameters and limits

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

## 📄 Smart Contracts

### Deployed on Base Sepolia (Testnet)
- **RCN Contract**: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
- **RCG Contract**: `0x973D8b27E7CD72270F9C07d94381f522bC9D4304`

### Contract Features
- **RCN**: Unlimited minting, burnable, pausable
- **RCG**: Fixed 100M supply, governance voting power
- **Both**: ERC-20 compliant, Thirdweb SDK compatible

---

## 🌐 Ecosystem Flywheel

```
More shops need RCG → RCG price rises → Better RCN margins for shops →
Attracts more shops → Higher RCN sales → Better RCG staker yields →
More RCG investment demand → Cycle accelerates
```

This creates aligned incentives where:
- Shops benefit from lower costs as they invest more
- RCG holders benefit from platform growth
- Customers benefit from a larger network
- Platform benefits from sustainable revenue

---

## 📄 License

This project is proprietary software. All rights reserved.

---

**RepairCoin** - The first community-governed loyalty ecosystem for the repair industry.