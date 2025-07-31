# RepairCoin Backend - STAGING Environment

This is the **STAGING** deployment of RepairCoin backend. All features are using testnet configurations.

## Environment: STAGING

- **Blockchain Network**: Base Sepolia (Testnet)
- **Database**: PostgreSQL on DigitalOcean (Staging)
- **Token Contract**: Test contract with test RCN tokens
- **Real Money**: NO - Everything is test tokens
- **Purpose**: Testing all features before production

## Staging vs Production Differences

| Feature | Staging | Production |
|---------|---------|------------|
| Blockchain | Base Sepolia | Base Mainnet |
| RCN Tokens | Test tokens | Real tokens |
| Database | Staging DB | Production DB |
| API URL | repaircoin-backend-staging-*.ondigitalocean.app | repaircoin-api.com |
| Frontend | repaircoin-staging.vercel.app | repaircoin.com |
| SSL | DigitalOcean managed | DigitalOcean managed |
| Monitoring | Debug logging | Error logging only |
| Swagger UI | Enabled | Disabled |

## Important Notes

1. **Test Tokens Only**: All RCN tokens on staging are test tokens with no real value
2. **Test Wallets**: Use test wallets with Sepolia ETH from faucets
3. **Data**: Staging data can be reset anytime - don't store important data
4. **Features**: All features should be tested here first

## Deployment Commands

```bash
# Deploy to staging
git push origin main

# Check staging logs
doctl apps logs <app-id>

# Connect to staging database
psql $DATABASE_URL
```

## Testing Checklist

- [ ] Admin functions work
- [ ] Shop registration works
- [ ] Customer registration works
- [ ] Token minting works (test tokens)
- [ ] Treasury tracking works
- [ ] Analytics work
- [ ] Alerts work
- [ ] All API endpoints respond

## Moving to Production

When ready for production:
1. Create new production database
2. Update blockchain to Base Mainnet
3. Deploy new contract on mainnet
4. Update all environment variables
5. Disable Swagger UI
6. Set NODE_ENV=production
7. Use production domain names