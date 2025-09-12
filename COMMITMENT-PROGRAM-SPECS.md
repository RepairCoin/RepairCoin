# RepairCoin Commitment Program Specifications

## Overview
The Commitment Program is an alternative path for shops to qualify as RepairCoin partners without purchasing 10,000 RCG tokens upfront. Instead, shops commit to a 6-month payment plan of $500/month.

## Program Details

### Requirements
- **Monthly Payment**: $500/month
- **Duration**: 6 months
- **Total Commitment**: $3,000
- **RCN Price**: Standard rate ($0.10 per RCN)
- **Billing Methods**: Credit Card, ACH Transfer, Wire Transfer

### Benefits
1. **No Upfront RCG Purchase** - Start without buying 10,000 RCG tokens ($5,000 value)
2. **Immediate Activation** - Operate as soon as enrollment is approved
3. **Full Partner Benefits** - Purchase and distribute RCN tokens to customers
4. **Predictable Costs** - Fixed monthly payments for budgeting

### Restrictions
- Cannot hold RCG tokens while in commitment program
- Must complete 6-month term or face penalties
- Cannot have multiple active enrollments
- No governance rights (RCG holders only)

## Payment Processing

### Monthly Billing Cycle
1. **Payment Due Date**: Same day each month as enrollment approval
2. **Auto-charge**: Automatic billing via selected payment method
3. **Grace Period**: 7 days before defaulting
4. **Payment Credits**: Each $500 payment is credited as RCN purchase allowance

### Failed Payment Process
- **Day 1**: First warning notification
- **Day 3**: Second warning notification  
- **Day 7**: Final warning before default
- **Day 8+**: Enrollment defaulted, shop loses operational status

### Default Consequences
- Shop operational status reverted to "not_qualified"
- Cannot purchase RCN tokens
- Cannot issue rewards or process redemptions
- Must pay remaining balance or start new enrollment

## Renewal and Completion

### After 6 Months - Completion Options
1. **Renew Commitment** - Start another 6-month term
2. **Purchase RCG** - Buy 10,000+ RCG tokens for tier benefits
3. **Month-to-Month** - Continue at $500/month without commitment
4. **Exit Program** - Lose partner status if no RCG purchased

### Renewal Rules
- ✅ **Can Renew**: After completing 6-month term
- ❌ **Cannot Renew**: While current enrollment is active
- ❌ **Cannot Renew**: If previous enrollment was defaulted (must settle first)

### Multiple Enrollments
- Only one active enrollment allowed per shop
- Completed enrollments remain in history
- Can have unlimited sequential enrollments
- Each renewal is a new 6-month commitment

## Technical Implementation

### Database Schema
```sql
commitment_enrollments
- id: Primary key
- shop_id: Reference to shops table
- status: pending|active|completed|cancelled|defaulted
- monthly_amount: 500.00
- term_months: 6
- total_commitment: 3000.00
- payments_made: Counter (0-6)
- total_paid: Running total
- next_payment_date: Next billing date
- billing_method: credit_card|ach|wire
- billing_reference: Encrypted payment token
```

### Status Flow
```
pending → active → completed
         ↓      ↓
     defaulted  cancelled
```

### API Endpoints
- `POST /admin/commitment/enrollments` - Create new enrollment
- `POST /admin/commitment/enrollments/:id/approve` - Approve pending enrollment
- `POST /admin/commitment/enrollments/:id/payment` - Record payment
- `GET /admin/commitment/enrollments` - List all enrollments
- `GET /admin/commitment/overdue` - Get overdue payments

### Automated Processes
1. **Daily Payment Processing** - Charge due payments automatically
2. **Overdue Check** - Flag overdue accounts and send warnings
3. **Auto-default** - Default enrollments 7+ days overdue
4. **Status Updates** - Update shop operational status based on payment status

## Business Rules

### Shop Operational Status
- **With Active Commitment**: `operational_status = 'commitment_qualified'`
- **Commitment Defaulted**: Check RCG balance, set to `'not_qualified'` if < 10,000
- **Commitment Completed**: Can continue operating if renewed or RCG purchased

### RCN Purchase Rights
- Active commitment = Can purchase RCN at $0.10/token
- Defaulted/Cancelled = Cannot purchase RCN
- Completed = Must renew or buy RCG to continue

### Integration with RCG
- Shops cannot hold both RCG tokens AND have active commitment
- Must choose one path: RCG ownership OR Commitment Program
- Can switch from Commitment to RCG after completing term

## Risk Mitigation

### Payment Security
- Store only encrypted payment tokens, never raw card numbers
- Use PCI-compliant payment processors (Stripe, PayPal)
- Implement fraud detection for unusual patterns

### Business Continuity
- Grace period prevents accidental defaults
- Multiple warning notifications
- Option to cure default by paying overdue amount
- Clear terms and conditions acceptance required

### Compliance
- Monthly payments are non-refundable
- Early termination penalties equal remaining commitment
- All terms clearly disclosed during enrollment
- Audit trail of all payments and status changes