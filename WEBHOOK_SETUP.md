# Stripe Webhook Configuration Guide

## Development Setup

Your Stripe webhook listener is already running for local development:

```bash
stripe listen --forward-to localhost:4000/api/shops/webhooks/stripe
```

The webhook signing secret shown is:
```
whsec_eeed64543bab1caf9b86202e55aab17f61d067e86c09a18de39757823f2647c0
```

**Important**: This is a temporary secret for local testing. It changes each time you run `stripe listen`.

## Production Setup

### 1. Configure Production Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your production URL:
   ```
   https://your-domain.com/api/shops/webhooks/stripe
   ```

### 2. Select Events to Listen For

Look for these sections and select the following events:

**In "Checkout" section:**
- `checkout.session.completed` - Shop subscription payment completed

**In "Customer" section (under "Subscription" subsection):**
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription changes (status, plan, etc.)
- `customer.subscription.deleted` - Subscription cancelled

**Note**: These are under "Customer" → "Subscription", NOT "Subscription Schedule" which is a different feature.

### 3. Get Production Webhook Secret

After creating the endpoint:
1. Click on the webhook endpoint
2. Click "Reveal" under Signing secret
3. Copy the production secret (starts with `whsec_`)

### 4. Update Production Environment

Add to your production environment variables:
```env
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret_here
```

## Webhook Security

The backend validates all webhooks using:

```javascript
// backend/src/domains/webhook/controllers/WebhookController.ts
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

## Testing Webhooks

### Local Testing
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:4000/api/shops/webhooks/stripe

# Terminal 3: Trigger test events
stripe trigger checkout.session.completed
```

### Production Testing
Use Stripe's webhook testing in the dashboard:
1. Go to webhook endpoint details
2. Click "Send test webhook"
3. Select event type and send

## Troubleshooting

### Common Issues

1. **"No signatures found matching the expected signature"**
   - Wrong webhook secret in environment
   - Using test secret in production or vice versa

2. **400 Bad Request**
   - Raw body parsing issue
   - Ensure webhook endpoint uses `express.raw()`

3. **Webhook not received**
   - Check URL is correct
   - Verify no firewall blocking Stripe IPs
   - Check application logs

### Debug Webhooks

View webhook logs in Stripe Dashboard:
1. Go to Developers → Webhooks
2. Click on your endpoint
3. View "Webhook attempts"
4. Check response codes and timing

## Webhook Handler Location

The webhook handler is at:
```
backend/src/domains/webhook/routes/index.ts
```

Key processing happens in:
```
backend/src/domains/webhook/services/StripeWebhookService.ts
```

## Environment Variables

### Development
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (from stripe listen output)
```

### Production  
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard)
```

## Security Best Practices

1. **Always validate signatures** - Never process webhooks without signature validation
2. **Use HTTPS** - Webhooks must use HTTPS in production
3. **Idempotency** - Handle duplicate webhook deliveries
4. **Timeout handling** - Respond within 20 seconds
5. **Error handling** - Return 200 OK even if processing fails (retry logic)

## Monitoring

Set up alerts for:
- Failed webhook deliveries
- High latency responses
- Signature validation failures

Check webhook health regularly in Stripe Dashboard → Developers → Webhooks → Your endpoint → "Webhook attempts"