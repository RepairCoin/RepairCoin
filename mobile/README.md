# RepairCoin Mobile App

RepairCoin is a revolutionary blockchain-powered loyalty platform that connects repair shops with customers through a dual-token rewards system. This mobile app serves as the customer interface for earning, tracking, and redeeming RepairCoin (RCN) tokens.

## 🎯 How It Works

### Dual-Token System

- **RCN (RepairCoin)**: Utility token for rewards (1 RCN = $0.10 USD)
  - Earn tokens when you get repairs at participating shops
  - Redeem tokens for discounts on future services
  - Transfer tokens between wallets
  
- **RCG (RepairCoin Governance)**: Governance token for platform decisions
  - Fixed supply of 100 million tokens
  - Enables participation in platform governance
  - Provides tier benefits for shops

## 👤 Customer Features

### 1. **Wallet Integration**
- Connect using popular wallets (MetaMask, Coinbase, Rainbow, etc.)
- Email-based wallet creation for non-crypto users
- Social login options (Google, Facebook, Apple)
- Secure private key management

### 2. **Earn Rewards**
- **Base Rewards**: Earn RCN tokens for every repair service
- **Tier Bonuses**: 
  - Bronze Tier (0-499 RCN): Standard rewards
  - Silver Tier (500-2499 RCN): +2 RCN bonus per transaction
  - Gold Tier (2500+ RCN): +5 RCN bonus per transaction
- **Referral Program**: 
  - Earn 25 RCN for each friend you refer
  - Your friend gets 10 RCN welcome bonus
- **No Limits**: No daily or monthly earning caps

### 3. **Redeem Tokens**
- **Flexible Redemption**:
  - 100% redemption value at the shop where you earned them
  - 20% redemption value at any other participating shop
- **Instant Processing**: Real-time blockchain transactions
- **QR Code System**: Simple scan-to-redeem process

### 4. **Track & Manage**
- **Dashboard Overview**:
  - Current RCN balance
  - Tier status and progress
  - Recent transactions
  - Total earnings and savings
  
- **Transaction History**:
  - Detailed earning records
  - Redemption history
  - Transfer logs
  - Filter by date, type, and shop

### 5. **Shop Discovery**
- **Find Nearby Shops**: Location-based shop finder
- **Shop Profiles**: View shop details, services, and tier status
- **Favorites**: Save preferred shops for quick access

### 6. **Profile Management**
- Edit personal information
- Manage notification preferences
- Security settings
- Private key backup and recovery

## 🚀 Getting Started

### Prerequisites

- Node.js v22.13.1
- Android Studio (for Android development)
- Xcode (for iOS development on macOS)

### Installation

1. **Clean previous installation**:
```bash
rm -rf node_modules
rm -rf package-lock.json
rm -rf yarn.lock
```

2. **Install dependencies**:
```bash
npm install
```

3. **Prebuild native projects**:
```bash
npx expo prebuild --clean
```

4. **Run the app**:
```bash
# For Android
npx expo run:android

# For iOS (macOS only)
npx expo run:ios

# For development with Expo Go
npx expo start
```

## 📱 App Screens

### Authentication Flow
- **Onboarding**: Introduction to RepairCoin features
- **Wallet Connection**: Multiple wallet options and email signup
- **Registration**: Customer profile creation
- **Success Screen**: Welcome bonus and getting started guide

### Main Dashboard
- **Wallet Tab**: Balance, tier status, quick actions
- **Approval Tab**: Pending redemptions and verifications
- **Referral Tab**: Share referral code, track referred friends

### Features
- **Transaction History**: Complete earning and spending records
- **QR Scanner**: Scan shop QR codes for transactions
- **Send RCN**: Transfer tokens to other users
- **Notifications**: Real-time updates on transactions and rewards

## 🏪 Shop Interaction

### How Customers Interact with Shops

1. **Visit Participating Shop**: Get your device/item repaired
2. **Earn Rewards**: Shop issues RCN tokens to your wallet
3. **Track Earnings**: View transaction in your history
4. **Build Tier Status**: Accumulate tokens to reach higher tiers
5. **Redeem Rewards**: Use tokens for discounts on future services

### Shop Tiers (What Customers See)
- **Standard Shops**: Basic RCN rewards
- **Premium Shops** (10K+ RCG): Enhanced rewards and benefits
- **Elite Shops** (200K+ RCG): Maximum rewards and exclusive perks

## 🔒 Security Features

- **Non-custodial Wallet**: You control your private keys
- **Secure Storage**: Encrypted local storage for sensitive data
- **Biometric Authentication**: Face ID/Touch ID support
- **Transaction Confirmation**: Review and approve all transactions
- **Backup Options**: Secure phrase and private key export

## 📊 Customer Benefits

### Why Use RepairCoin?

1. **Universal Rewards**: Earn at any participating repair shop
2. **Real Value**: 1 RCN = $0.10 USD in services
3. **No Expiration**: Tokens never expire
4. **Transferable**: Send tokens to friends and family
5. **Tier Benefits**: Higher tiers earn bonus rewards
6. **Referral Rewards**: Earn by inviting friends
7. **Blockchain Security**: Transparent and immutable transactions

## 🛠 Technical Stack

- **Frontend**: React Native with Expo
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind CSS)
- **Blockchain**: Thirdweb SDK v5
- **Network**: Base Sepolia (testnet)
- **Authentication**: JWT with wallet signatures

## 📞 Support

For customer support and inquiries:
- In-app support chat
- Email: support@repaircoin.com
- FAQ section in app settings

## 🔗 Smart Contracts

- **RCN Token**: `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
- **RCG Token**: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
- **Network**: Base Sepolia Testnet

## 📄 License

Copyright © 2024 RepairCoin. All rights reserved.