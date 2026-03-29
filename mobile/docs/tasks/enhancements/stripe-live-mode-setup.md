# Feature: Stripe Live Mode Setup

**Status:** Blocked
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-03-10
**Updated:** 2026-03-10

---

## Notes

- Blocker: Stripe account verification required

## Overview

Configure Stripe LIVE mode for production environment to accept real payments.

## Action Required from Account Owner

1. Log into Stripe Dashboard
2. Complete "Verify your business"
3. Set up bank account for payouts
4. Wait for approval (1-3 business days)

## Once Unblocked

1. Create LIVE price ($500/month)
2. Get LIVE API keys
3. Create production webhook
4. Update env vars in DigitalOcean

## Environment Variables to Update

| Variable | Current | New |
|----------|---------|-----|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | (not set) | `whsec_...` |
| `STRIPE_MONTHLY_PRICE_ID` | `price_test_...` | `price_live_...` |
| `STRIPE_MODE` | `test` | `live` |
