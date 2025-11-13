# RepairCoin Documentation

**Last Updated**: November 10, 2025

Welcome to the RepairCoin documentation! This directory contains all technical documentation organized by category.

---

## Quick Links

- 📋 [Project Overview](../README.md) - Main project README
- 🤖 [Claude Instructions](../CLAUDE.md) - Instructions for Claude Code AI assistant
- 🔐 [Authentication Docs](#authentication) - Auth system implementation
- 💾 [Database Docs](#database) - Database schema and migrations
- 🚀 [Deployment Docs](#deployment) - Deployment guides and checklists
- ⚡ [Features Docs](#features) - Feature specifications
- 🔌 [API Docs](#api) - API documentation and audits

---

## 🔐 Authentication

**Location**: [`./authentication/`](./authentication/)

Complete documentation for the authentication system, including the new access/refresh token implementation.

### Current Status
✅ **Phase 1**: Backend implementation complete
✅ **Phase 2**: Frontend implementation complete
⏳ **Phase 3**: Production deployment pending

### Core Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [**Access/Refresh Token Design**](./authentication/ACCESS_REFRESH_TOKEN_DESIGN.md) | Architecture and design decisions for dual-token system | ✅ Complete |
| [**Backend Implementation**](./authentication/ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md) | Backend Phase 1 implementation guide | ✅ Complete |
| [**Frontend Implementation**](./authentication/FRONTEND_TOKEN_REFRESH_IMPLEMENTATION.md) | Frontend Phase 2 implementation guide | ✅ Complete |
| [**Security Audit**](./authentication/AUTH_SECURITY_AUDIT.md) | Security analysis and recommendations | ✅ Complete |

### Migration & Fixes

| Document | Description |
|----------|-------------|
| [Cookie Auth Production Issues](./authentication/COOKIE_AUTH_PRODUCTION_ISSUES.md) | Analysis of production cookie issues |
| [Cookie Auth Fixes Applied](./authentication/COOKIE_AUTH_FIXES_APPLIED.md) | Fixes for cross-origin cookies |
| [Production Cookie Config](./authentication/PRODUCTION_COOKIE_AUTH_CONFIG.md) | Production configuration guide |
| [Authentication Migration Status](./authentication/AUTHENTICATION_MIGRATION_STATUS.md) | Cookie migration status |
| [Auth Migration Summary](./authentication/AUTH_MIGRATION_SUMMARY.md) | Summary of auth migrations |
| [Migration Complete](./authentication/MIGRATION_COMPLETE.md) | Migration completion report |
| [Migration Progress](./authentication/MIGRATION_PROGRESS.md) | Migration progress tracking |

### Other

| Document | Description |
|----------|-------------|
| [Testing Auth](./authentication/TESTING_AUTH.md) | Authentication testing guide |
| [Cleanup Summary](./authentication/CLEANUP_SUMMARY.md) | API client cleanup documentation |
| [Implementation Phase 1](./authentication/IMPLEMENTATION_COMPLETE_PHASE1.md) | Phase 1 completion report |

### Key Features Implemented

- ✅ **Dual-Token System**: 15-minute access tokens + 7-day refresh tokens
- ✅ **99% Attack Window Reduction**: 24 hours → 15 minutes
- ✅ **Automatic Token Refresh**: Seamless frontend auto-refresh
- ✅ **Token Revocation**: Logout immediately invalidates sessions
- ✅ **Session Management**: Track and manage user sessions
- ✅ **Backward Compatible**: Legacy tokens still supported

---

## 💾 Database

**Location**: [`./database/`](./database/)

Database schema documentation, migration guides, and best practices.

| Document | Description |
|----------|-------------|
| [**Database Schema**](./database/DATABASE_SCHEMA.md) | Complete schema documentation |
| [**Migration Guide**](./database/DATABASE_MIGRATION_GUIDE.md) | How to create and run migrations |
| [**Database Guide**](./database/DATABASE_GUIDE.md) | General database usage guide |

### Key Tables

- `customers` - Customer accounts and tier information
- `shops` - Shop registrations and subscriptions
- `admins` - Admin users with role management
- `transactions` - All token transactions (RCN/RCG)
- `refresh_tokens` - Refresh token storage for auth ⭐ NEW
- `notifications` - Real-time notification system
- `promo_codes` - Promotional code management
- `affiliate_shop_groups` - Shop coalitions

---

## 🚀 Deployment

**Location**: [`./deployment/`](./deployment/)

Deployment guides, checklists, and production plans.

| Document | Description |
|----------|-------------|
| [**Deployment Guide**](./deployment/DEPLOYMENT.md) | General deployment procedures |
| [**Mainnet Deployment Plan**](./deployment/MAINNET_DEPLOYMENT_PLAN.md) | Mainnet launch strategy |
| [**Production Checklist**](./deployment/PRODUCTION_CHECKLIST.md) | Pre-deployment checklist |

### Deployment Environments

- **Production**: Digital Ocean (Backend) + Vercel (Frontend)
- **Database**: PostgreSQL on Digital Ocean
- **Blockchain**: Base Sepolia testnet
- **Mainnet**: Planned migration to Base mainnet

---

## ⚡ Features

**Location**: [`./features/`](./features/)

Feature specifications and implementation details.

| Document | Description | Status |
|----------|-------------|--------|
| [**RCG Token**](./features/RCG.md) | Governance token specifications | ✅ Implemented |
| [**RCN Token**](./features/RCN-SPECIFICATIONS-V3.md) | Utility token specifications v3 | ✅ Implemented |
| [**Notification System**](./features/NOTIFICATION_SYSTEM.md) | Real-time notifications | ✅ Implemented |
| [**Shop Onboarding**](./features/SHOP-ONBOARDING-FLOW.md) | Shop registration flow | ✅ Implemented |

### Feature Highlights

**Dual-Token System**:
- **RCN** (Utility): Rewards token, customers earn and redeem
- **RCG** (Governance): Shop tier token, enables voting and revenue sharing

**Customer Tiers**:
- Bronze (0 RCN): Base tier
- Silver (+2 RCN bonus)
- Gold (+5 RCN bonus)

**Shop Tiers**:
- Standard (10K+ RCG)
- Premium (50K+ RCG)
- Elite (200K+ RCG)

**Revenue Model**:
- Shops pay $500/month subscription
- 10% to RCG stakers
- 10% to DAO treasury

---

## 🔌 API

**Location**: [`./api/`](./api/)

API documentation, endpoint specifications, and audit reports.

| Document | Description |
|----------|-------------|
| [**Swagger Audit Report**](./api/SWAGGER_AUDIT_REPORT.md) | API documentation audit |

### API Endpoints

**Authentication**:
- `POST /api/auth/admin` - Admin login
- `POST /api/auth/shop` - Shop login
- `POST /api/auth/customer` - Customer login
- `POST /api/auth/refresh` - Refresh access token ⭐ NEW
- `POST /api/auth/logout` - Logout and revoke tokens

**Customer**:
- `GET /api/customer/:address` - Get customer profile
- `GET /api/customer/:address/balance` - Get RCN balance
- `POST /api/customer/register` - Register new customer

**Shop**:
- `GET /api/shops` - List all shops
- `POST /api/shops/register` - Register new shop
- `POST /api/shops/issue-reward` - Issue RCN reward
- `POST /api/shops/process-redemption` - Process RCN redemption

**Admin**:
- `GET /api/admin/stats` - Platform statistics
- `POST /api/admin/mint-rcn` - Mint RCN tokens
- `POST /api/admin/approve-shop` - Approve shop registration

**Live API Docs**: http://localhost:4000/api-docs (when backend running)

---

## 🛠️ Development

**Location**: [`./development/`](./development/)

Development roadmaps, progress tracking, and implementation plans.

| Document | Description |
|----------|-------------|
| [**Implementation Roadmap**](./development/IMPLEMENTATION_ROADMAP.md) | Feature roadmap and timeline |
| [**Progress Update**](./development/PROGRESS_UPDATE.md) | Latest development progress |

---

## 📁 Documentation Structure

```
docs/
├── README.md (this file)
│
├── authentication/          # Auth system docs
│   ├── ACCESS_REFRESH_TOKEN_DESIGN.md
│   ├── ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md
│   ├── FRONTEND_TOKEN_REFRESH_IMPLEMENTATION.md
│   ├── AUTH_SECURITY_AUDIT.md
│   └── ... (migration and fix docs)
│
├── database/               # Database docs
│   ├── DATABASE_SCHEMA.md
│   ├── DATABASE_MIGRATION_GUIDE.md
│   └── DATABASE_GUIDE.md
│
├── deployment/             # Deployment docs
│   ├── DEPLOYMENT.md
│   ├── MAINNET_DEPLOYMENT_PLAN.md
│   └── PRODUCTION_CHECKLIST.md
│
├── features/               # Feature specs
│   ├── RCG.md
│   ├── RCN-SPECIFICATIONS-V3.md
│   ├── NOTIFICATION_SYSTEM.md
│   └── SHOP-ONBOARDING-FLOW.md
│
├── api/                    # API docs
│   └── SWAGGER_AUDIT_REPORT.md
│
└── development/            # Dev roadmaps
    ├── IMPLEMENTATION_ROADMAP.md
    └── PROGRESS_UPDATE.md
```

---

## 🔍 Finding Documentation

### By Topic

**Authentication & Security**:
→ [`./authentication/`](./authentication/)

**Database & Data Models**:
→ [`./database/`](./database/)

**Deployment & DevOps**:
→ [`./deployment/`](./deployment/)

**Feature Specifications**:
→ [`./features/`](./features/)

**API & Endpoints**:
→ [`./api/`](./api/)

**Development & Planning**:
→ [`./development/`](./development/)

### By Status

**Recently Updated** (Last 24 hours):
- ✅ [Access/Refresh Token Implementation](./authentication/ACCESS_REFRESH_TOKEN_IMPLEMENTATION.md)
- ✅ [Frontend Token Refresh](./authentication/FRONTEND_TOKEN_REFRESH_IMPLEMENTATION.md)
- ✅ [Access/Refresh Token Design](./authentication/ACCESS_REFRESH_TOKEN_DESIGN.md)

**In Progress**:
- ⏳ Production deployment of access/refresh tokens
- ⏳ Rate limiting implementation
- ⏳ CSRF protection

**Planned**:
- 📋 Admin dashboard token statistics
- 📋 Multi-device session management UI
- 📋 Security alert system

---

## 📝 Documentation Standards

When creating or updating documentation:

1. **Use Clear Headers**: H1 for title, H2 for sections
2. **Include Status**: Use ✅ ⏳ 📋 ❌ for status indicators
3. **Date Documents**: Include "Last Updated" date
4. **Link Related Docs**: Cross-reference related documentation
5. **Keep README Updated**: Update this index when adding new docs
6. **Use Code Blocks**: Include code examples where appropriate
7. **Add Diagrams**: Use ASCII/Mermaid diagrams for flows

---

## 🤝 Contributing to Documentation

To add new documentation:

1. Create the markdown file in the appropriate category folder
2. Add an entry to this README.md
3. Link to related documentation
4. Include status indicators (✅ ⏳ 📋 ❌)
5. Commit with descriptive message: `docs: add [topic] documentation`

---

## 📞 Need Help?

- **Project Overview**: See [main README](../README.md)
- **Claude Instructions**: See [CLAUDE.md](../CLAUDE.md)
- **API Docs**: http://localhost:4000/api-docs (when backend running)
- **Issues**: Check GitHub issues or create new one

---

**Documentation Version**: 2.0
**Last Major Update**: 2025-11-10 (Access/Refresh Token Implementation)
**Maintained By**: RepairCoin Development Team
