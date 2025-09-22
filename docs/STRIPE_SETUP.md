# Stripe Setup Guide

This guide explains how to set up Stripe for the RepairCoin subscription system.

## Required Environment Variables

The following environment variables must be configured in your `.env` file:

1. **STRIPE_SECRET_KEY** - Your Stripe secret API key
   - Test mode: Starts with `sk_test_`
   - Live mode: Starts with `sk_live_`
   - Find it in: Stripe Dashboard > Developers > API keys

2. **STRIPE_WEBHOOK_SECRET** - Webhook endpoint signing secret
   - Format: `whsec_...`
   - Find it in: Stripe Dashboard > Developers > Webhooks > Your endpoint > Signing secret

3. **STRIPE_MONTHLY_PRICE_ID** - The price ID for the monthly subscription
   - Format: `price_...`
   - Find it in: Stripe Dashboard > Products > Your product > Pricing

## Setup Steps

### 1. Create a Stripe Account
- Go to https://stripe.com and sign up
- Complete your account setup

### 2. Create a Product and Price
1. Go to Stripe Dashboard > Products
2. Click "Add product"
3. Name: "RepairCoin Shop Subscription"
4. Description: "Monthly subscription for RepairCoin shops"
5. Set pricing:
   - Recurring
   - $500.00 per month
   - Currency: USD
6. Save the product
7. Copy the Price ID (starts with `price_`)

### 3. Set Up Webhook Endpoint
1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
   - For local testing: Use ngrok or similar service
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Add endpoint
6. Copy the Signing secret (starts with `whsec_`)

### 4. Configure Environment Variables
Add to your `.env` file:
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_MONTHLY_PRICE_ID=price_your_price_id_here
```

### 5. Test Your Configuration
Run the test script:
```bash
cd backend
npx ts-node src/scripts/test-stripe-config.ts
```

This will verify that:
- All required environment variables are set
- Stripe client can be initialized
- The price ID is valid

## Troubleshooting

### 500 Error on Subscribe
If you get a 500 error when trying to subscribe:
1. Check the backend logs for specific error messages
2. Run the test script to verify configuration
3. Check the health endpoint: `GET /api/shops/subscription/health`

### Common Issues
- **Missing environment variables**: Make sure all three required variables are set
- **Invalid API key**: Verify the key starts with `sk_test_` or `sk_live_`
- **Wrong price ID**: Make sure the price ID exists in your Stripe account
- **Network issues**: Ensure your server can reach Stripe's API

### Debug Endpoints
- Health check: `GET /api/shops/subscription/health`
- Debug subscription: `GET /api/shops/subscription/debug/{shopId}`

## Testing Payments

For testing, use Stripe's test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

Use any future expiry date and any 3-digit CVC.

## Going Live

Before going live:
1. Replace test keys with live keys
2. Update webhook endpoint to production URL
3. Test the full subscription flow
4. Set up monitoring and alerts