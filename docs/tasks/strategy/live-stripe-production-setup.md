# Live Stripe Production Setup Strategy

## Overview

Configure Stripe LIVE mode for production environment to accept real payments.

**Created**: February 11, 2026
**Status**: Blocked (Account Verification Required)
**Priority**: High
**Blocker**: Stripe account owner must complete business verification

---

## Current State

| Environment | Stripe Mode | Keys | Webhook | Status |
|-------------|-------------|------|---------|--------|
| **Staging** | TEST | `sk_test_...` | ✅ Working | Complete |
| **Production** | TEST (wrong!) | `sk_test_...` | ❌ Not configured | Needs LIVE |

---

## Prerequisites

### 1. Stripe Account Verification (BLOCKER)

**Who**: Account owner (Zeff or business owner)
**What**: Complete "Verify your business" in Stripe Dashboard
**Why**: LIVE mode is locked until verification is complete

**Steps for Account Owner:**
1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Look for banner: "Verify your business to enable payouts"
3. Click and complete verification:
   - Business information
   - Bank account for payouts
   - Identity verification
   - Tax information (if required)
4. Wait for approval (usually 1-3 business days)

**How to check status:**
- Go to Stripe Dashboard → Settings → Account details
- Look for "Live mode" status

---

## Implementation Steps

### Phase 1: Create LIVE Price (After Verification)

**Current TEST Price:** `price_xxx` (staging)
**Need:** New LIVE price for $500/month subscription

**Steps:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle to **LIVE mode** (top-right switch)
3. Go to **Products** → **Add product**
4. Configure:
   - **Name**: RepairCoin Shop Subscription
   - **Description**: Monthly subscription for shops
   - **Pricing**:
     - Price: $500.00
     - Billing: Monthly
     - Currency: USD
5. Click **Save product**
6. Copy the **Price ID** (starts with `price_`)

---

### Phase 2: Get LIVE API Keys

**Steps:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **LIVE mode**
2. Go to **Developers** → **API keys**
3. Copy:
   - **Publishable key**: `pk_live_...` (for frontend)
   - **Secret key**: `sk_live_...` (for backend)

**Security:**
- NEVER commit LIVE keys to git
- NEVER share LIVE keys in chat/email
- Use environment variables only

---

### Phase 3: Create Production Webhook

**Steps:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **LIVE mode**
2. Go to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Configure:
   - **Endpoint URL**: `https://api.repaircoin.ai/api/shops/webhooks/stripe`
   - **Description**: RepairCoin Production
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.payment_action_required`
5. Click **Add endpoint**
6. Copy **Signing secret** (starts with `whsec_`)

---

### Phase 4: Update Production Environment Variables

**Location:** DigitalOcean → `repaircoin-prod` → Settings → Environment Variables

| Variable | Current (Wrong) | New (Correct) |
|----------|-----------------|---------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | (not set) | `whsec_...` (from Phase 3) |
| `STRIPE_MONTHLY_PRICE_ID` | `price_test_...` | `price_live_...` (from Phase 1) |
| `STRIPE_MODE` | `test` | `live` |

**Optional (if using Stripe Connect):**
| Variable | Value |
|----------|-------|
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |

---

### Phase 5: Update Frontend Environment Variables (If Needed)

**Location:** Vercel → Settings → Environment Variables → Production

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |

---

### Phase 6: Redeploy

1. **Backend**: DigitalOcean will auto-redeploy after env var changes
2. **Frontend**: Trigger redeploy in Vercel if frontend env vars changed

---

### Phase 7: Verify LIVE Mode

**Test webhook delivery:**
1. Go to Stripe Dashboard → Webhooks → Your production endpoint
2. Click **Send test webhook**
3. Select `checkout.session.completed`
4. Verify it shows "200 OK" response

**Test subscription flow (with real card):**
1. Go to production site
2. Register a new shop
3. Start subscription checkout
4. Complete payment with real card
5. Verify:
   - Payment shows in Stripe Dashboard (LIVE mode)
   - Shop subscription activated in database
   - Webhook events received successfully

---

## Environment Comparison

| Setting | Staging (TEST) | Production (LIVE) |
|---------|----------------|-------------------|
| API Key | `sk_test_51...` | `sk_live_51...` |
| Publishable Key | `pk_test_51...` | `pk_live_51...` |
| Webhook Secret | `whsec_test_...` | `whsec_live_...` |
| Price ID | `price_test_...` | `price_live_...` |
| Mode | `test` | `live` |
| Real Payments | No | **Yes** |
| Real Payouts | No | **Yes** |

---

## Checklist

### Pre-Setup (Account Owner)
- [ ] Complete Stripe business verification
- [ ] Verify LIVE mode is enabled in Stripe Dashboard
- [ ] Confirm payout bank account is connected

### Phase 1: Create LIVE Price
- [ ] Switch to LIVE mode in Stripe Dashboard
- [ ] Create "RepairCoin Shop Subscription" product
- [ ] Set price to $500/month
- [ ] Copy Price ID: `price_________________`

### Phase 2: Get API Keys
- [ ] Copy LIVE Secret Key: `sk_live_________________`
- [ ] Copy LIVE Publishable Key: `pk_live_________________`

### Phase 3: Create Webhook
- [ ] Create webhook endpoint for `api.repaircoin.ai`
- [ ] Select subscription and invoice events
- [ ] Copy Signing Secret: `whsec_________________`

### Phase 4: Update Backend Env Vars
- [ ] Update `STRIPE_SECRET_KEY` to LIVE key
- [ ] Add `STRIPE_WEBHOOK_SECRET`
- [ ] Update `STRIPE_MONTHLY_PRICE_ID` to LIVE price
- [ ] Set `STRIPE_MODE=live`

### Phase 5: Update Frontend Env Vars (if needed)
- [ ] Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Phase 6: Redeploy
- [ ] Backend redeployed with new env vars
- [ ] Frontend redeployed (if changed)

### Phase 7: Verify
- [ ] Webhook test event returns 200 OK
- [ ] Test subscription with real card works
- [ ] Payment appears in Stripe Dashboard
- [ ] Shop subscription activated in database

---

## Rollback Plan

If issues occur after switching to LIVE:

**Quick Rollback:**
1. Go to DigitalOcean → `repaircoin-prod` → Environment Variables
2. Change `STRIPE_SECRET_KEY` back to `sk_test_...`
3. Change `STRIPE_MODE` back to `test`
4. Redeploy

**Note:** Any LIVE payments already processed cannot be automatically refunded. Handle manually in Stripe Dashboard.

---

## Security Notes

1. **Never commit LIVE keys to git**
2. **Never share LIVE keys in chat/email/Slack**
3. **Use environment variables only**
4. **Restrict access to Stripe Dashboard**
5. **Enable 2FA on Stripe account**
6. **Review webhook logs regularly**

---

## Webhook Events Reference

| Event | When It Fires | What To Do |
|-------|---------------|------------|
| `checkout.session.completed` | Customer completes checkout | Create/activate subscription |
| `customer.subscription.created` | New subscription created | Record in database |
| `customer.subscription.updated` | Subscription changed | Update status |
| `customer.subscription.deleted` | Subscription cancelled | Mark as cancelled |
| `invoice.paid` | Payment successful | Extend subscription |
| `invoice.payment_failed` | Payment failed | Notify shop owner |
| `invoice.payment_action_required` | 3D Secure required | Send authentication link |

---

## Testing Checklist (After Go-Live)

- [ ] New shop can complete $500 subscription payment
- [ ] Webhook events are received and processed
- [ ] Shop dashboard shows active subscription
- [ ] Subscription status updates correctly
- [ ] Failed payment triggers notification
- [ ] Cancellation works correctly
- [ ] Stripe Dashboard shows all transactions

---

## Support Contacts

| Issue | Contact |
|-------|---------|
| Stripe verification | Stripe Support |
| Webhook errors | Check backend logs |
| Payment issues | Stripe Dashboard → Payments |
| Subscription issues | Check database + Stripe Dashboard |

---

## References

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Webhook Docs: https://stripe.com/docs/webhooks
- Backend Webhook Handler: `backend/src/domains/shop/routes/webhooks.ts`
- Subscription Service: `backend/src/domains/shop/services/SubscriptionService.ts`
