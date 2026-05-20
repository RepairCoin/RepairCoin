# How do subscription and billing work?

Active operation of your shop on RepairCoin requires either an active
**$500/month subscription** or holding **10,000+ RCG** tokens. Either
path unlocks issuing RCN rewards, purchasing RCN, and creating
services.

## When to do this

When you first onboard, when your subscription is about to expire, or
when you're deciding whether to subscribe or buy RCG instead.

## Steps

To start or manage a subscription:

1. From the shop dashboard, open the **Settings** tab → **Subscription**
   section.
2. If you don't have an active subscription, click the subscribe
   button. You'll be sent to Stripe checkout to enter payment details
   for **$500/month**.
3. Once payment clears, your shop's operational status flips to active
   and you can:
   - Create services
   - Purchase RCN tokens at $0.10 each
   - Issue RCN rewards to customers
4. Future charges happen automatically every month. You can update
   the payment method or cancel from the same Subscription page.

If you'd rather operate without a recurring charge, the alternative is
to acquire and hold 10,000+ RCG tokens. The qualification refreshes
automatically when RCG holdings change.

## Common pitfalls

- **Subscription cancelled, shop suddenly can't issue rewards.**
  Cancellation takes effect at the end of the current paid period.
  Once that's past, operational features lock out. You'll still see
  the dashboard and historical data, just not new operations.
- **RCG dropped below 10,000 with no subscription.** Same effect —
  operational features lock until you either top RCG back up or
  subscribe.
- **Stripe webhook didn't reach our system.** Rare — but if your
  payment succeeded on Stripe and your shop status didn't update,
  contact RepairCoin support. The webhook usually retries
  automatically.
- **Wanted a different price.** $500/month is currently fixed.
  Tier-based subscription discounts haven't shipped yet.

## See also

- [purchase-rcn.md](purchase-rcn.md) — once you're active, top up RCN
  to issue rewards.
- [issue-a-reward.md](issue-a-reward.md) — the main thing
  subscription unlocks.
