# RepairCoin Payment Flow Implementation

## Overview

The RepairCoin platform now includes a complete payment flow for shop commitment subscriptions. This allows shops to pay $500/month as an alternative to holding RCG tokens for operational qualification.

## Payment Flow

### 1. Subscription Enrollment
- Shop clicks "Subscribe Now" in dashboard
- Fills out billing form with contact details and payment method
- Backend creates pending enrollment in `commitment_enrollments` table
- Returns payment URL for credit card payments

### 2. Payment Processing
- For credit card payments, user is redirected to payment page: `/shop/subscription/payment/[enrollmentId]`
- Payment page loads enrollment details and shows secure payment form
- In production, this integrates with Stripe Payment Elements for secure card collection
- Currently uses test payment simulation

### 3. Payment Confirmation
- After payment, backend receives confirmation via `/subscription/payment/confirm`
- Records payment in database and activates subscription
- Updates shop operational status to `commitment_qualified`
- Shop gains access to full platform features

## API Endpoints

### Shop Subscription Routes

**GET** `/api/shops/subscription/status`
- Returns current subscription status for authenticated shop
- Shows enrollment details if active

**POST** `/api/shops/subscription/subscribe`
- Creates new commitment enrollment
- Requires billing contact information
- Returns payment URL for credit card subscriptions

**GET** `/api/shops/subscription/enrollment/:enrollmentId`
- Returns enrollment details for payment page
- Includes shop information for payment form

**POST** `/api/shops/subscription/payment/confirm`
- Confirms payment and activates subscription
- Records payment and updates shop status
- In production, integrates with Stripe webhooks

**POST** `/api/shops/subscription/cancel`
- Cancels active subscription
- Updates shop status back to unqualified

### Admin Management Routes

**GET** `/api/admin/commitments`
- Lists all commitment enrollments with filtering
- Supports status filters: pending, active, cancelled, etc.

**POST** `/api/admin/commitments/:enrollmentId/activate`
- Manually activate pending subscriptions
- Updates shop operational status

**POST** `/api/admin/commitments/:enrollmentId/record-payment`
- Manually record payments for non-credit card methods
- Supports ACH, wire transfers, manual payments

**GET** `/api/admin/commitments/overdue`
- Lists subscriptions with overdue payments
- Includes days overdue calculation

## Database Schema

### commitment_enrollments Table
```sql
CREATE TABLE commitment_enrollments (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  monthly_amount DECIMAL(10,2) DEFAULT 500.00,
  term_months INTEGER DEFAULT 6,
  total_commitment DECIMAL(10,2) DEFAULT 3000.00,
  billing_method VARCHAR(50),
  billing_reference VARCHAR(255),
  payments_made INTEGER DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  next_payment_date DATE,
  last_payment_date DATE,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  notes TEXT,
  created_by VARCHAR(50)
);
```

### commitment_payments Table
```sql
CREATE TABLE commitment_payments (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES commitment_enrollments(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Components

### SubscriptionManagement Component
- Main subscription interface in shop dashboard
- Shows current status, payment history, and management options
- Handles subscription creation with proper form validation
- Redirects to payment page for credit card subscriptions

### Payment Page Component
- Dedicated payment processing page at `/shop/subscription/payment/[enrollmentId]`
- Loads enrollment details and shop information
- Shows secure payment form (integrates with Stripe in production)
- Handles payment confirmation and success states

## Payment Methods Supported

### Credit Card
- Immediate online payment via Stripe
- Redirects to dedicated payment page
- Real-time activation upon successful payment

### ACH Transfer
- Bank transfer setup with manual confirmation
- Admin records payments when received
- 1-3 business day processing time

### Wire Transfer
- International and large payment option
- Manual payment recording by admin
- Detailed wire instructions provided via email

## Security Features

### Authentication
- JWT token authentication for all shop endpoints
- Role-based access control for admin functions
- Shop ownership verification for enrollment access

### Payment Security
- Stripe-compliant payment processing
- No card details stored on RepairCoin servers
- PCI DSS compliance through Stripe integration

### Data Protection
- Encrypted payment references and billing information
- Audit trail for all payment activities
- GDPR-compliant data handling

## Testing

### Test Payment Flow
1. Register as a shop (must be unverified initially)
2. Admin approves shop in admin dashboard
3. Shop navigates to subscription tab
4. Creates subscription with test billing information
5. Redirected to payment page with enrollment details
6. Processes test payment (simulated in development)
7. Subscription activates and shop gains operational status

### Test Cards (Stripe)
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Insufficient Funds**: 4000 0000 0000 9995

## Production Deployment

### Required Environment Variables
```bash
# Backend
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_MONTHLY_PRICE_ID=price_your_live_price_id

# Frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
```

### Stripe Configuration
1. Create Stripe account and get API keys
2. Set up monthly subscription product ($500/month)
3. Configure webhook endpoints for payment confirmations
4. Test with Stripe's test environment first

### Database Migration
Run the commitment subscription migration:
```bash
cd backend && npm run db:migrate
# Or manually run: backend/src/migrations/013_commitment_subscriptions.sql
```

## Future Enhancements

### Planned Features
- Automated monthly billing with Stripe subscriptions
- Payment retry logic for failed payments
- Email notifications for payment events
- Advanced reporting and analytics
- Multi-currency support

### Integration Opportunities
- Customer portal for payment management
- Mobile app payment integration
- Third-party accounting system webhooks
- Advanced fraud detection

## Support and Troubleshooting

### Common Issues
1. **Payment page not loading**: Check enrollment ID and authentication
2. **Payment confirmation failing**: Verify Stripe webhook configuration
3. **Shop status not updating**: Check database triggers and logging

### Monitoring
- All payment events are logged with structured logging
- Failed payments trigger admin notifications
- Real-time dashboard shows subscription health

### Customer Support
- Payment issues escalated to admin dashboard
- Detailed payment history available for troubleshooting
- Manual payment recording capabilities for edge cases