# Environment Variables for Subdomain Setup

## Overview

This document provides the environment variable configuration needed for the subdomain setup where:
- Frontend: `https://repaircoin.ai` or `https://www.repaircoin.ai`
- Backend: `https://api.repaircoin.ai`

---

## Backend Environment Variables

### Production (Digital Ocean / Your Backend Host)

```bash
# ============================================
# Environment
# ============================================
NODE_ENV=production

# ============================================
# Cookie Configuration (NEW - Required for Subdomain)
# ============================================
# IMPORTANT: The leading dot (.) allows cookie sharing across subdomains
COOKIE_DOMAIN=.repaircoin.ai

# Optional: Force secure cookies (default: true in production)
# COOKIE_SECURE=true

# ============================================
# CORS Configuration
# ============================================
# Frontend URL for CORS validation
FRONTEND_URL=https://repaircoin.ai

# Additional allowed origins (comma-separated)
# CORS_ORIGIN=https://repaircoin.ai,https://www.repaircoin.ai,https://api.repaircoin.ai

# ============================================
# Database Configuration
# ============================================
DB_HOST=your-database-host.com
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=repaircoin

# ============================================
# JWT Authentication
# ============================================
# CRITICAL: Must be 32+ characters, keep secret!
JWT_SECRET=your-production-secret-minimum-32-characters-long

# Token expiration times
ACCESS_TOKEN_EXPIRES_IN=15m     # Access token (short-lived)
REFRESH_TOKEN_EXPIRES_IN=7d     # Refresh token (long-lived)
JWT_EXPIRES_IN=24h              # Legacy token (backward compatibility)

# ============================================
# Blockchain Configuration (Base Sepolia)
# ============================================
# RCN Token (Utility)
RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
RCN_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
RCN_THIRDWEB_SECRET_KEY=your-thirdweb-secret-key

# RCG Token (Governance)
RCG_CONTRACT_ADDRESS=0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D
RCG_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
RCG_THIRDWEB_SECRET_KEY=your-thirdweb-secret-key

# Admin wallet private key (without 0x prefix)
PRIVATE_KEY=your-admin-wallet-private-key

# ============================================
# Admin Configuration
# ============================================
# Comma-separated list of super admin wallet addresses
ADMIN_ADDRESSES=0x1234...,0x5678...

# ============================================
# Stripe Configuration
# ============================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ============================================
# Optional: Server Configuration
# ============================================
PORT=4000
```

---

## Frontend Environment Variables

### Production (Vercel / Your Frontend Host)

```bash
# ============================================
# API Configuration (UPDATED for Subdomain)
# ============================================
# IMPORTANT: Point to your backend subdomain
NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api
NEXT_PUBLIC_BACKEND_URL=https://api.repaircoin.ai

# Frontend URL (for redirects)
NEXT_PUBLIC_APP_URL=https://repaircoin.ai

# ============================================
# Blockchain Configuration
# ============================================
# RCN Token (Utility)
NEXT_PUBLIC_RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
NEXT_PUBLIC_RCN_THIRDWEB_CLIENT_ID=your-thirdweb-client-id

# RCG Token (Governance)
NEXT_PUBLIC_RCG_CONTRACT_ADDRESS=0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D
NEXT_PUBLIC_RCG_THIRDWEB_CLIENT_ID=your-thirdweb-client-id

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_NETWORK=base-sepolia

# ============================================
# App Information
# ============================================
NEXT_PUBLIC_APP_NAME=RepairCoin
NEXT_PUBLIC_APP_DESCRIPTION=Loyalty tokens for repair shops

# ============================================
# Admin Configuration
# ============================================
# Public admin addresses (for UI display)
NEXT_PUBLIC_ADMIN_ADDRESSES=0x1234...,0x5678...

# ============================================
# Legacy Support (Optional)
# ============================================
NEXT_PUBLIC_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
```

---

## Local Development Environment Variables

### Backend (`.env`)

```bash
# ============================================
# Environment
# ============================================
NODE_ENV=development

# ============================================
# Cookie Configuration
# ============================================
# Leave empty for local development (cookies work without domain)
# COOKIE_DOMAIN=

# Optional: Test with secure cookies locally (requires HTTPS)
# COOKIE_SECURE=false

# ============================================
# CORS Configuration
# ============================================
FRONTEND_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002

# ============================================
# Database Configuration (Local PostgreSQL)
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_USER=repaircoin
DB_PASSWORD=repaircoin123
DB_NAME=repaircoin

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=dev-jwt-secret-32-chars-minimum-length-required
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
JWT_EXPIRES_IN=24h

# ============================================
# Blockchain Configuration (Base Sepolia Testnet)
# ============================================
RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
RCN_THIRDWEB_CLIENT_ID=your-dev-client-id
RCN_THIRDWEB_SECRET_KEY=your-dev-secret-key

RCG_CONTRACT_ADDRESS=0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D
RCG_THIRDWEB_CLIENT_ID=your-dev-client-id
RCG_THIRDWEB_SECRET_KEY=your-dev-secret-key

PRIVATE_KEY=your-dev-wallet-private-key

# ============================================
# Admin Configuration
# ============================================
ADMIN_ADDRESSES=0x1234...,0x5678...

# ============================================
# Stripe Configuration (Test Mode)
# ============================================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ============================================
# Server Configuration
# ============================================
PORT=4000
```

### Frontend (`.env`)

```bash
# ============================================
# API Configuration
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001

# ============================================
# Blockchain Configuration
# ============================================
NEXT_PUBLIC_RCN_CONTRACT_ADDRESS=0xBFE793d78B6B83859b528F191bd6F2b8555D951C
NEXT_PUBLIC_RCN_THIRDWEB_CLIENT_ID=your-dev-client-id

NEXT_PUBLIC_RCG_CONTRACT_ADDRESS=0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D
NEXT_PUBLIC_RCG_THIRDWEB_CLIENT_ID=your-dev-client-id

NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_NETWORK=base-sepolia

# ============================================
# App Information
# ============================================
NEXT_PUBLIC_APP_NAME=RepairCoin
NEXT_PUBLIC_APP_DESCRIPTION=Loyalty tokens for repair shops

# ============================================
# Admin Configuration
# ============================================
NEXT_PUBLIC_ADMIN_ADDRESSES=0x1234...,0x5678...
```

---

## Key Differences: Development vs Production

| Variable | Development | Production |
|----------|------------|------------|
| `COOKIE_DOMAIN` | Not set (or empty) | `.repaircoin.ai` |
| `COOKIE_SECURE` | `false` (optional) | `true` (default) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | `https://api.repaircoin.ai/api` |
| `FRONTEND_URL` | `http://localhost:3001` | `https://repaircoin.ai` |
| `NODE_ENV` | `development` | `production` |
| `DB_HOST` | `localhost` | Production database host |
| `JWT_SECRET` | Dev secret (less secure OK) | Strong production secret |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |

---

## Deployment Platform Specific Notes

### Digital Ocean App Platform

Set environment variables in:
1. Go to your app in Digital Ocean dashboard
2. Settings → App-Level Environment Variables
3. Add/update variables listed above
4. Redeploy app after changes

**Important:**
- Set `COOKIE_DOMAIN=.repaircoin.ai`
- Ensure `FRONTEND_URL=https://repaircoin.ai`
- Trust proxy is already configured in code

### Vercel

Set environment variables in:
1. Go to your project in Vercel dashboard
2. Settings → Environment Variables
3. Add variables for Production/Preview/Development
4. Redeploy after changes

**Important:**
- Set `NEXT_PUBLIC_API_URL=https://api.repaircoin.ai/api`
- Variables starting with `NEXT_PUBLIC_` are exposed to browser
- Never put secrets in `NEXT_PUBLIC_` variables

### Other Platforms

General guidelines:
1. Set all environment variables listed in production section
2. Ensure HTTPS is enabled (required for `secure: true` cookies)
3. Configure custom domain for backend (`api.repaircoin.ai`)
4. Test cookie functionality after deployment

---

## Validation

### Backend Validation

After setting environment variables, check startup logs:

```bash
# Should see:
✓ Cookie domain configured: .repaircoin.ai
✓ CORS configured for: https://repaircoin.ai
✓ JWT secret loaded
✓ Database connected
```

### Frontend Validation

Check browser console on page load:

```bash
# Should see:
API URL: https://api.repaircoin.ai/api
```

### Cookie Validation

After login, check DevTools → Application → Cookies:

```
Domain: .repaircoin.ai
Secure: ✓
HttpOnly: ✓
SameSite: Lax
```

---

## Security Best Practices

1. **Never commit `.env` files to git** ✅ (Already in `.gitignore`)
2. **Use different secrets for dev and production**
3. **Rotate JWT_SECRET periodically** (every 3-6 months)
4. **Keep STRIPE_SECRET_KEY secure** (never expose to frontend)
5. **Use environment variables, not hardcoded values**
6. **Regular security audits of environment configuration**

---

## Troubleshooting

### "Cookie not set" Error

**Check:**
- [ ] `COOKIE_DOMAIN=.repaircoin.ai` is set in backend
- [ ] Backend is deployed and running
- [ ] HTTPS is enabled on backend

### "CORS Error"

**Check:**
- [ ] `FRONTEND_URL` matches your actual frontend URL
- [ ] Frontend URL includes protocol (`https://`)
- [ ] No trailing slash in URLs

### "401 Unauthorized" on All Requests

**Check:**
- [ ] `JWT_SECRET` is set and matches between deployments
- [ ] Cookies are being sent (check Network tab)
- [ ] `NEXT_PUBLIC_API_URL` points to correct backend

---

**Last Updated:** 2025-11-14
**For:** Subdomain Cookie Setup
