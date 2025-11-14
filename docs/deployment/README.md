# Deployment Documentation

Deployment guides, production checklists, and mainnet launch plans.

---

## 📁 Documentation Files

| Document | Description |
|----------|-------------|
| **DEPLOYMENT.md** | General deployment procedures and guides |
| **SUBDOMAIN_ENV_VARS.md** | ⭐ Environment variables for subdomain setup (api.repaircoin.ai) |
| **MAINNET_DEPLOYMENT_PLAN.md** | Mainnet launch strategy and timeline |
| **PRODUCTION_CHECKLIST.md** | Pre-deployment verification checklist |

---

## 🌍 Environments

### Current Production (Subdomain Setup)
- **Frontend**: Vercel
  - URL: `https://repaircoin.ai` or `https://www.repaircoin.ai`
  - Auto-deploy from `main` branch

- **Backend**: Digital Ocean App Platform
  - URL: `https://api.repaircoin.ai` (subdomain)
  - Database: PostgreSQL on Digital Ocean
  - Network: Base Sepolia (testnet)
  - Cookie Configuration: `domain: '.repaircoin.ai'`, `sameSite: 'lax'`

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
