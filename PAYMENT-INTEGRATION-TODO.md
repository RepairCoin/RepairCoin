# Payment Integration TODO for Commitment Program

## Current State
The commitment program infrastructure is fully built but payment processing is manual. Admin must record payments via API endpoint.

## Payment Provider Integration Needed

### 1. Choose Payment Provider
Options to consider:
- **Stripe** - Best for credit cards, supports ACH
- **Square** - Good for retail integration
- **PayPal** - Widely accepted, higher fees
- **Plaid** - Specialized for ACH/bank transfers
- **Authorize.net** - Traditional processor

### 2. Frontend Payment Collection

#### Add Payment Method Form
```typescript
// New component needed: /frontend/src/components/shop/PaymentMethodForm.tsx
interface PaymentMethodFormProps {
  enrollmentId: number;
  billingMethod: 'credit_card' | 'ach' | 'wire';
  onSuccess: (paymentToken: string) => void;
}

// For Stripe:
// - Use @stripe/react-stripe-js
// - Collect card details with CardElement
// - Create payment method and save token

// For ACH:
// - Use Plaid Link
// - Connect bank account
// - Save account token
```

#### Update Enrollment Flow
1. After enrollment approval, redirect to payment setup
2. Collect payment details based on selected method
3. Store encrypted token in billing_reference field
4. Set next_payment_date to today + 1 month

### 3. Backend Payment Processing

#### Update CommitmentPaymentService
```typescript
// Replace placeholder with real implementation
private async chargePaymentMethod(
  method: string,
  reference: string,
  amount: number
): Promise<boolean> {
  try {
    switch(method) {
      case 'credit_card':
        return await this.chargeStripeCard(reference, amount);
      case 'ach':
        return await this.chargePlaidACH(reference, amount);
      case 'wire':
        return await this.processWireTransfer(reference, amount);
      default:
        throw new Error('Unsupported payment method');
    }
  } catch (error) {
    logger.error('Payment failed:', error);
    return false;
  }
}

private async chargeStripeCard(paymentMethodId: string, amount: number) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,
  });
  
  return paymentIntent.status === 'succeeded';
}
```

### 4. Cron Job Setup

#### Add to backend startup
```typescript
// In app.ts or separate cron service
import cron from 'node-cron';
import { CommitmentPaymentService } from './services/CommitmentPaymentService';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const paymentService = CommitmentPaymentService.getInstance();
  await paymentService.processDuePayments();
  await paymentService.checkOverduePayments();
});
```

### 5. Environment Variables Needed

```env
# Payment Provider Keys
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Plaid for ACH
PLAID_CLIENT_ID=xxx
PLAID_SECRET=xxx
PLAID_ENV=sandbox

# Email/SMS for notifications
SENDGRID_API_KEY=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 6. Webhook Handlers

#### Stripe Webhooks
```typescript
// New endpoint: POST /api/webhooks/stripe
router.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Record successful payment
      break;
    case 'payment_intent.payment_failed':
      // Handle failed payment
      break;
  }
});
```

### 7. Security Considerations

1. **PCI Compliance**
   - Never store raw card numbers
   - Use payment provider's tokenization
   - Implement proper SSL/TLS

2. **Webhook Security**
   - Verify webhook signatures
   - Implement idempotency keys
   - Log all webhook events

3. **Payment Retry Logic**
   - Implement exponential backoff
   - Max 3 retry attempts
   - Clear failure notifications

### 8. Testing Strategy

1. **Sandbox Testing**
   - Use Stripe test cards
   - Plaid sandbox accounts
   - Test all failure scenarios

2. **Manual Override**
   - Keep manual payment recording as backup
   - Admin can mark payments as received
   - Useful for wire transfers

### 9. Monitoring & Alerts

1. **Payment Metrics**
   - Success rate tracking
   - Failed payment alerts
   - Revenue dashboards

2. **Error Handling**
   - Slack/email alerts for failures
   - Detailed error logging
   - Customer support tools

## Implementation Priority

1. **Phase 1**: Manual payments (CURRENT STATE)
   - Admin records payments manually
   - Basic functionality works

2. **Phase 2**: Payment collection
   - Add Stripe for card collection
   - Store payment methods securely

3. **Phase 3**: Auto-charging
   - Implement cron jobs
   - Process payments automatically

4. **Phase 4**: Full automation
   - Webhook handling
   - Retry logic
   - Customer notifications