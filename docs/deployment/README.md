# Deployment Documentation

Deployment guides, production checklists, and mainnet launch plans.

---

## 📁 Documentation Files

| Document | Description |
|----------|-------------|
| **DEPLOYMENT.md** | General deployment procedures and guides |
| **MAINNET_DEPLOYMENT_PLAN.md** | Mainnet launch strategy and timeline |
| **PRODUCTION_CHECKLIST.md** | Pre-deployment verification checklist |

---

## 🌍 Environments

### Current Production
- **Backend**: Digital Ocean App Platform
  - URL: `repaircoin-staging-s7743.ondigitalocean.app`
  - Database: PostgreSQL on Digital Ocean
  - Network: Base Sepolia (testnet)

- **Frontend**: Vercel
  - URL: `www.repaircoin.ai`
  - Auto-deploy from `main` branch

### Planned Mainnet
- Network: Base mainnet
- Token addresses: TBD
- Launch timeline: See MAINNET_DEPLOYMENT_PLAN.md

---

## 🚀 Quick Deploy

```bash
# Backend (Digital Ocean)
git push origin main
# Auto-deploys on push

# Frontend (Vercel)
cd frontend
npm run build
git push origin main
# Auto-deploys on push

# Run migrations (production)
npm run db:migrate
```

---

**Last Updated**: November 10, 2025
