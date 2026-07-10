# Feature: Subscription Tier Selection (Match Web)

**Status:** Completed
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-07-10
**Updated:** 2026-07-10
**Completed:** 2026-07-10

---

## Problem

The web subscription form (`frontend/src/app/(authenticated)/shop/subscription-form/page.tsx`)
lets shops pick a plan tier (Starter AI $80 / Growth AI $299 / Business AI $599),
but the mobile subscription flow was still hardcoded to the retired single
$500/month plan. The mobile checkout endpoint also ignored tiers and always
billed the legacy Stripe price.

## Implementation

Mirrored the web tier-select approach:

1. `mobile/feature/shop/subscription/constants/subscriptionPlans.ts` (new)
   - Plan config mirroring `frontend/src/config/subscriptionPlans.ts`
     (tiers, labels, prices, feature lists, `DEFAULT_TIER = "growth"`,
     `isValidTier`, `getPlanByTier`)

2. `mobile/shared/components/ui/TabButtons.tsx` (extended, reused)
   - Added optional `sublabel` per tab and a `className` override
     (backward compatible) — the tier selector is now TabButtons with
     plan name + $price/mo segments instead of a one-off component

3. `mobile/feature/shop/subscription/components/PlanCard.tsx` (new)
   - Gradient hero card (LinearGradient, decorative ring like the customer
     tier cards) with plan label, MOST POPULAR / CURRENT PLAN badge, big
     price, and the feature list — replaces the old `PriceCard.tsx` and
     `FeatureList.tsx` (deleted)

4. `screens/SubscriptionScreen.tsx`
   - `selectedTier` state + `PlanSelector` shown when not subscribed
   - Subscribed shops see their actual plan (tier/label/amount from
     `/shops/subscription/status`)
   - Restyled: dropped the flat outer gray box, sections sit directly on
     the background in a ScrollView, "Secure payment via Stripe · Cancel
     anytime" footnote under the CTA

5. `hooks/useSubscription.ts`
   - `handleSubscribe(tier)` passes tier as a route param to the form
   - Status fetch now captures `tier`, `planLabel`, `monthlyAmount`
     (exposed as `currentPlan`)
   - Trial support: checks `/shops/subscription/trial-eligibility` on
     focus, `handleStartTrial(tier)` confirms via Alert then POSTs
     `/shops/subscription/start-trial` (no credit card needed)

5b. `mobile/shared/components/ui/CalloutCard.tsx` (new, shared)
   - Generic tinted callout (tone info/warning/success/danger, icon,
     title, description, optional action button with loading state)
   - Used for both the free-trial CTA (info tone, mirrors the web Free
     Trial CTA) and the pending-cancellation banner (warning tone) —
     available to any screen that needs an inline notice

6. `hooks/useSubscriptionForm.ts` + `screens/SubscriptionFormScreen.tsx`
   - Reads `tier` via `useLocalSearchParams`, validates, falls back to default
   - Selected-plan summary card (yellow-tinted, plan label + price) above the form
   - Sends `tier` in the `/shops/subscription/checkout-mobile` payload

7. Backend: `backend/src/domains/shop/routes/subscription.ts`
   - `POST /subscription/checkout-mobile` now accepts and validates `tier`,
     resolves the Stripe price via `resolveCheckoutPriceId(tier)` (was
     hardcoded to legacy `STRIPE_MONTHLY_PRICE_ID`), and stores tier in
     session metadata — same behavior as the web `/subscription/subscribe`

8. Cleanup: removed dead `SUBSCRIPTION_PRICE` ($500) and
   `SUBSCRIPTION_FEATURES` from `mobile/shared/constants/shopAccount.ts`

## Verification Checklist

- [x] Backend `npm run typecheck` passes
- [x] Mobile `npx tsc --noEmit` passes
- [ ] Manual: select each tier → checkout opens with correct Stripe price
- [ ] Manual: subscribed shop sees its actual plan name and amount
- [ ] Manual: trial-eligible shop sees the free trial card; starting a trial
      activates the selected tier and flips the screen to subscribed
