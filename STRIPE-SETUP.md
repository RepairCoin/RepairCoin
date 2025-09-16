# Stripe Subscription Setup Guide

This guide will help you set up Stripe for monthly subscription payments in RepairCoin.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- Access to Stripe Dashboard
- Backend server running locally or in production

## Step 1: Get Your API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your test keys:
   - **Publishable key**: `pk_test_...` (for frontend - not used yet)
   - **Secret key**: `sk_test_...` (for backend)

## Step 2: Create a Monthly Subscription Product

1. Go to **Products** → **Add product**
2. Create your subscription product:
   ```
   Name: RepairCoin Shop Subscription
   Description: Monthly subscription for RepairCoin shop operations
   ```
3. Add pricing:
   ```
   Pricing model: Standard pricing
   Price: $99.00 (or your desired amount)
   Billing period: Monthly
   ```
4. Save the product
5. Copy the **Price ID** (starts with `price_`)


## Step 3: Set Up Webhook Endpoint

### For Local Development:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login to Stripe CLI:
   ```bash
   stripe login
   ```
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/shops/webhooks/stripe
   ```
4. Copy the webhook signing secret (starts with `whsec_`)
### For Production:

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://yourdomain.com/api/shops/webhooks/stripe
   ```
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `customer.subscription.trial_will_end`
5. Save the endpoint
6. Copy the **Signing secret** (starts with `whsec_`)

## Step 4: Configure Environment Variables

Add these to your `.env` file:

```env
# Stripe Payment Integration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret
STRIPE_MONTHLY_PRICE_ID=price_your_actual_price_id
STRIPE_MODE=test
```

## Step 5: Test the Integration

1. Restart your backend server
2. Check the logs for "StripeService initialized"
3. Test creating a subscription:
   ```bash
   curl -X POST http://localhost:3000/api/shops/{shopId}/subscription \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "name": "Test Shop"
     }'
   ```

## Stripe Test Cards

Use these test cards for development:

- **Success**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0027 6000 3184`
- **Insufficient funds**: `4000 0000 0000 9995`

All test cards use:
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any 5-digit ZIP code

## Payment Retry Logic

The system automatically retries failed payments:
- **1st retry**: 24 hours after failure
- **2nd retry**: 48 hours after first retry
- **3rd retry**: 96 hours after second retry

After 3 failed attempts, the subscription is canceled.

## Monitoring Payments

### Check Payment Status:
```bash
# View subscription status
curl http://localhost:3000/api/shops/{shopId}/subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Database Queries:
```sql
-- View all subscriptions
SELECT * FROM stripe_subscriptions;

-- View payment attempts
SELECT * FROM stripe_payment_attempts WHERE status = 'failed';

-- View webhook events
SELECT * FROM stripe_subscription_events ORDER BY created_at DESC;
```

## Production Checklist

- [ ] Switch to live API keys (remove `test_` prefix)
- [ ] Update webhook endpoint to production URL
- [ ] Set `STRIPE_MODE=live` in environment
- [ ] Test with real payment methods
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Set up email notifications for failures
- [ ] Configure proper error alerting

## Troubleshooting

### Webhook Signature Verification Failed
- Ensure you're using the correct webhook secret
- Check that the raw request body is being passed to verification

### Payment Intent Requires Action
- Customer needs to complete 3D Secure authentication
- Direct them to the payment confirmation page

### Subscription Not Updating Shop Status
- Check the database trigger `update_shop_operational_status_on_subscription`
- Verify shop has proper `operational_status` field

## Support

For Stripe-specific issues:
- Documentation: https://stripe.com/docs
- Support: https://support.stripe.com

For RepairCoin integration issues:
- Check logs: `docker logs repaircoin-backend`
- Database status: `SELECT * FROM stripe_subscriptions WHERE shop_id = 'YOUR_SHOP_ID';`