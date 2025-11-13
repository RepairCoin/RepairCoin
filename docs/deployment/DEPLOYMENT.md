# Digital Ocean Deployment Guide for RepairCoin

This guide covers deploying the RepairCoin platform to Digital Ocean using App Platform and Managed Database.

## Prerequisites

1. Digital Ocean account with billing enabled
2. Domain name (optional but recommended)
3. Stripe account for payment processing
4. Thirdweb account for blockchain integration
5. Git repository (GitHub/GitLab) with your code

## Architecture Overview

- **Frontend**: Next.js app on App Platform
- **Backend**: Node.js/Express API on App Platform  
- **Database**: Managed PostgreSQL
- **File Storage**: Spaces (if needed)

## Step 1: Database Setup

### Create Managed PostgreSQL Database

1. Go to Digital Ocean → Databases → Create Database Cluster
2. Choose PostgreSQL 15
3. Select your region (same as your apps)
4. Choose plan (Basic $15/month for start)
5. Name: `repaircoin-db`
6. Create Database Cluster

### Configure Database

1. Wait for cluster to provision (~5 minutes)
2. Go to Settings → Trusted Sources
3. Add your IP for initial setup
4. Connect using provided credentials:
```bash
psql -h your-db-host.db.ondigitalocean.com -p 25060 -U doadmin -d defaultdb --set=sslmode=require
```

5. Create database and user:
```sql
CREATE DATABASE repaircoin;
CREATE USER repaircoin_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE repaircoin TO repaircoin_user;
```

## Step 2: Environment Variables

Prepare your production environment variables:

```env
# Backend Production .env
NODE_ENV=production
PORT=8080

# Database (from DO Managed Database)
DATABASE_URL=postgresql://repaircoin_user:password@your-db-host.db.ondigitalocean.com:25060/repaircoin?sslmode=require

# Thirdweb
THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key
PRIVATE_KEY=your-wallet-private-key-without-0x
REPAIRCOIN_CONTRACT_ADDRESS=0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5
RCG_CONTRACT_ADDRESS=0x973D8b27E7CD72270F9C07d94381f522bC9D4304

# Authentication
JWT_SECRET=your-production-jwt-secret-min-32-chars
ADMIN_ADDRESSES=your-admin-wallet-addresses

# Stripe
STRIPE_SECRET_KEY=sk_live_your-stripe-secret
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRICE_ID=price_your-subscription-price-id

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

## Step 3: Backend Deployment

### Prepare Backend for Production

1. Update `backend/package.json`:
```json
{
  "scripts": {
    "start": "node dist/app.js",
    "build": "tsc",
    "postinstall": "npm run build"
  }
}
```

2. Create `backend/.do/app.yaml`:
```yaml
name: repaircoin-backend
region: nyc
services:
  - name: api
    github:
      repo: your-github-username/repaircoin
      branch: main
      deploy_on_push: true
    source_dir: backend
    environment_slug: node-js
    instance_size_slug: basic-xs
    instance_count: 1
    http_port: 8080
    routes:
      - path: /api
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${repaircoin-db.DATABASE_URL}
        type: SECRET
      - key: JWT_SECRET
        value: "your-jwt-secret"
        type: SECRET
      - key: THIRDWEB_CLIENT_ID
        value: "your-client-id"
        type: SECRET
      - key: THIRDWEB_SECRET_KEY
        value: "your-secret-key"
        type: SECRET
      - key: STRIPE_SECRET_KEY
        value: "your-stripe-key"
        type: SECRET
    run_command: node dist/app.js
    build_command: npm install && npm run build
```

### Deploy Backend

1. Install DO CLI: `brew install doctl`
2. Authenticate: `doctl auth init`
3. Create app: `doctl apps create --spec backend/.do/app.yaml`
4. Note the app ID and URL

## Step 4: Frontend Deployment

### Prepare Frontend for Production

1. Update `frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  }
}

module.exports = nextConfig
```

2. Create `frontend/.do/app.yaml`:
```yaml
name: repaircoin-frontend
region: nyc
services:
  - name: web
    github:
      repo: your-github-username/repaircoin
      branch: main
      deploy_on_push: true
    source_dir: frontend
    environment_slug: node-js
    instance_size_slug: basic-xs
    instance_count: 1
    http_port: 3000
    routes:
      - path: /
    envs:
      - key: NEXT_PUBLIC_API_URL
        value: "https://repaircoin-backend-xxxxx.ondigitalocean.app"
      - key: NEXT_PUBLIC_THIRDWEB_CLIENT_ID
        value: "your-client-id"
    build_command: npm install && npm run build
    run_command: npm start
```

### Deploy Frontend

```bash
doctl apps create --spec frontend/.do/app.yaml
```

## Step 5: Database Migrations

1. Connect to your app's console:
```bash
doctl apps console <backend-app-id> --type=RUN
```

2. Run migrations:
```bash
cd backend
npm run migrate
```

## Step 6: Configure Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-backend-app.ondigitalocean.app/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret
5. Update backend environment variable `STRIPE_WEBHOOK_SECRET`

## Step 7: Custom Domain Setup (Optional)

### For Frontend

1. Go to your frontend app → Settings → Domains
2. Add your domain (e.g., `app.repaircoin.com`)
3. Update DNS records as instructed
4. Enable Force HTTPS

### For Backend

1. Go to your backend app → Settings → Domains
2. Add API subdomain (e.g., `api.repaircoin.com`)
3. Update DNS records
4. Update frontend `NEXT_PUBLIC_API_URL` to use custom domain

## Step 8: Monitoring & Maintenance

### Enable Monitoring

1. Go to each app → Insights
2. Enable monitoring and alerts
3. Set up alerts for:
   - High CPU usage
   - High memory usage
   - Response time > 1s
   - Error rate > 5%

### Database Backups

1. Go to Database → Settings → Backups
2. Ensure daily backups are enabled
3. Test restore procedure

### Logs

Access logs via:
```bash
doctl apps logs <app-id> --tail --follow
```

## Step 9: Security Checklist

- [ ] All environment variables marked as SECRET
- [ ] Database connection uses SSL
- [ ] HTTPS enforced on all domains
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled
- [ ] Database backups configured
- [ ] Monitoring alerts set up

## Production Environment Variables Summary

### Backend Required:
- `DATABASE_URL` (from DO Managed Database)
- `JWT_SECRET` (generate secure 32+ char string)
- `THIRDWEB_CLIENT_ID` & `THIRDWEB_SECRET_KEY`
- `PRIVATE_KEY` (admin wallet private key)
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`
- `ADMIN_ADDRESSES` (comma-separated admin wallets)

### Frontend Required:
- `NEXT_PUBLIC_API_URL` (backend URL)
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`

## Troubleshooting

### Database Connection Issues
- Ensure app is in trusted sources
- Check SSL mode is required
- Verify credentials and database name

### Build Failures
- Check Node.js version compatibility
- Ensure all dependencies are in package.json
- Check build logs: `doctl apps logs <app-id> --type=BUILD`

### Webhook Issues
- Verify webhook secret matches
- Check endpoint URL is accessible
- Monitor webhook logs in Stripe dashboard

## Scaling

When ready to scale:

1. **Backend**: Increase instance size or count
2. **Database**: Upgrade to larger cluster
3. **Frontend**: Enable CDN for static assets
4. **Add Redis**: For session management and caching

## Cost Estimate

- Database (Basic): $15/month
- Backend (1x basic): $5/month  
- Frontend (1x basic): $5/month
- **Total**: ~$25/month starting

## Support

For Digital Ocean specific issues:
- DO Community: https://www.digitalocean.com/community
- Support Ticket: From DO dashboard

For RepairCoin issues:
- Check logs first
- Review environment variables
- Ensure database migrations ran