# Feature: Subscription Change Plan (Upgrade/Downgrade Without Cancelling)

**Status:** Completed
**Priority:** High
**Est. Effort:** 2-3 hrs
**Created:** 2026-07-10
**Updated:** 2026-07-10
**Completed:** 2026-07-10

---

## Problem

A subscribed shop had no way to switch tiers on mobile. The tier tabs were
hidden once subscribed and the only actions were Cancel / Reactivate, so the
only path to a different plan was cancel → wait for the period to end →
resubscribe. The backend already supports proper plan changes
(`POST /api/shops/subscription/change-plan`: upgrades apply immediately with a
prorated charge, downgrades are scheduled at the next renewal via a Stripe
subscription schedule), and the web dashboard already uses it — mobile did not.

## Implementation

Mirrored the web Change Plan flow:

1. `hooks/useSubscription.ts`
   - Status response now reads `subscriptionType` and `scheduledDowngrade`
     from `/shops/subscription/status`
   - `canChangePlan`: subscribed + not pending cancellation + Stripe-billed
     (`subscriptionType === "stripe_subscription"`) — DB-only free trials have
     no Stripe subscription, so they never see Change Plan
   - `handleChangePlan(tier)`: confirmation alert differentiating upgrade
     (immediate, prorated charge today) vs downgrade (at next renewal, no
     refund); re-selecting the current tier while a downgrade is pending
     cancels the scheduled downgrade
   - `changePlan` posts to `/shops/subscription/change-plan`, refreshes shop +
     subscription state, and toasts the backend outcome message

2. `screens/SubscriptionScreen.tsx`
   - Tier tabs stay visible when subscribed (if `canChangePlan`); selection
     starts on the current plan and other tiers can be previewed in the
     PlanCard (CURRENT PLAN badge only on the live tier)
   - "Upgrade Plan" / "Downgrade Plan" button appears when a different tier is
     selected, with the proration/renewal footnote from web
   - "Plan Change Scheduled" callout when a downgrade is pending, with a
     "Keep Current Plan" action that cancels it at no charge
   - Pending-cancellation copy now tells the shop to reactivate first (plan
     changes are blocked while a cancellation is scheduled, matching web)

3. `components/SubscriptionActionButton.tsx`
   - Supports an optional Change Plan primary button above Cancel

4. Backend hardening (`backend/src/services/SubscriptionService.ts`)
   - `changeSubscriptionTier` now rejects when `cancel_at_period_end` is set
     ("Reactivate it before changing plans") — previously an upgrade would
     charge the prorated difference for a plan the shop was about to lose;
     shop + admin change-plan routes return this as a 400

## Answer to "how should a shop change tiers?"

Do NOT cancel. Use Change Plan: upgrades bill the prorated difference and
apply immediately; downgrades apply at the next renewal with no charge today.
If a cancellation is already scheduled, Reactivate first, then Change Plan.

## How to test

- Subscribed shop (Stripe) → Subscription screen → tier tabs visible, current
  plan pre-selected with CURRENT PLAN badge
- Select a higher tier → "Upgrade Plan" → confirm → toast "plan has been
  upgraded", card charged prorated difference
- Select a lower tier → "Downgrade Plan" → confirm → toast "changes at next
  renewal", "Plan Change Scheduled" callout appears on reload
- Tap "Keep Current Plan" in the callout → scheduled downgrade cancelled
- Cancel subscription → Change Plan disappears (Reactivate only); calling the
  endpoint directly returns 400
- Trial shop → no Change Plan (trial has no Stripe subscription)
