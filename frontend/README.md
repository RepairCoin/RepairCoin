# RepairCoin Frontend

A Next.js 15 + React 19 frontend application for the RepairCoin loyalty token system, featuring three distinct user perspectives.

## 🏗️ Architecture

### User Perspectives

The application provides three main user interfaces:

1. **Customer Dashboard** (`/`)
   - View RCN token balance and tier status
   - Track daily/monthly/lifetime earnings
   - Connect Web3 wallet
   - Tier progression tracking (Bronze/Silver/Gold)

2. **Shop Dashboard** (`/shop`)
   - Purchase RCN tokens at $1.00 per token
   - Manage tier bonus distribution
   - View shop analytics and purchase history
   - Monitor cross-shop redemption settings

3. **Admin Dashboard** (`/admin`)
   - Platform-wide statistics and oversight
   - Customer and shop management
   - Token minting controls
   - System health monitoring

### Core Components

- **Navigation**: Unified navigation bar with perspective switching
- **LoadingSpinner**: Consistent loading states across all views
- **ErrorDisplay**: Standardized error handling with retry functionality
- **StatCard**: Reusable statistic display cards
- **TabNavigation**: Tabbed interface component
- **WalletConnectPrompt**: Standardized wallet connection interface

## 🛠️ Tech Stack

- **Next.js 15**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Full type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Thirdweb v5**: Web3 wallet connection and blockchain interaction
- **Base Sepolia**: Ethereum Layer 2 testnet

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or newer
- npm 10 or newer

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
NEXT_PUBLIC_CONTRACT_ADDRESS=0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ADMIN_ADDRESS=your_admin_wallet_address
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## 📱 Features by Perspective

### Customer Features
- **Wallet Integration**: Connect MetaMask, Coinbase, or other Web3 wallets
- **Token Balance**: Real-time RCN balance display from blockchain
- **Tier System**: Visual progression through Bronze, Silver, Gold tiers
- **Earnings Tracking**: Daily, monthly, and lifetime earning statistics
- **Registration**: Automatic customer registration for new wallets

### Shop Features
- **RCN Purchasing**: Buy RCN tokens at fixed $1.00 rate
- **Payment Methods**: Credit card, bank transfer, or USDC options
- **Tier Bonus Management**: Track bonus distribution by customer tier
- **Balance Monitoring**: Real-time shop RCN balance with low-balance alerts
- **Analytics Dashboard**: Comprehensive shop performance metrics
- **Purchase History**: Complete record of all RCN purchases

### Admin Features
- **Platform Overview**: System-wide statistics and health metrics
- **Customer Management**: View, edit, and manage customer accounts
- **Shop Administration**: Approve, verify, and configure shops
- **Token Controls**: Mint tokens to customers for special occasions
- **System Monitoring**: Real-time platform health and performance

## 🔐 Security Features

- **Anti-Arbitrage Protection**: Only earned tokens can be redeemed at shops
- **Cross-Shop Limits**: Universal 20% cross-shop redemption limit
- **Token Source Tracking**: Complete audit trail of token origins
- **Wallet Verification**: Secure Web3 wallet authentication
- **Admin Access Control**: Role-based access to admin functions

## 🎨 Design System

### Color Palette
- **Customer**: Blue to Indigo gradient (`from-blue-600 to-indigo-600`)
- **Shop**: Green to Emerald gradient (`from-green-600 to-emerald-600`)
- **Admin**: Red to Pink gradient (`from-red-600 to-pink-600`)

### Tier Colors
- **Bronze**: Orange background (`bg-orange-100 text-orange-800`)
- **Silver**: Gray background (`bg-gray-100 text-gray-800`)
- **Gold**: Yellow background (`bg-yellow-100 text-yellow-800`)

### Components
- Rounded corners: `rounded-2xl` for cards, `rounded-xl` for buttons
- Shadows: `shadow-xl` for elevated cards
- Gradients: Consistent use of perspective-specific gradients
- Typography: Inter font family with consistent sizing hierarchy

## 📊 State Management

The application uses React's built-in state management:
- `useState` for component-level state
- `useEffect` for side effects and data fetching
- Custom hooks for shared logic (wallet connection, data fetching)

## 🔗 API Integration

All perspectives integrate with the backend API:
- Customer data fetching and registration
- Shop purchase and analytics endpoints
- Admin platform management endpoints
- Real-time balance updates from blockchain

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📦 Deployment

The application is designed for deployment on Vercel, Netlify, or similar platforms:

```bash
# Build for production
npm run build

# Test production build locally
npm start
```

## 🔧 Customization

### Adding New Perspectives
1. Create new page in `/src/app/[perspective]/page.tsx`
2. Add navigation item to `Navigation.tsx`
3. Update color scheme in design system
4. Add perspective-specific components as needed

### Extending Components
All shared components are in `/src/components/` and accept props for customization:
- Colors via className props
- Content via children or text props
- Behavior via callback props

## 🤝 Contributing

1. Follow the established patterns for new components
2. Use TypeScript for all new code
3. Maintain consistent styling with Tailwind CSS
4. Test across all three perspectives
5. Update documentation for new features

## 📄 License

MIT License - see LICENSE file for details
