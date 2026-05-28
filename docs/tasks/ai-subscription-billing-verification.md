# AI billing model — verification + (if needed) reconciliation

**Status:** ✅ RESOLVED 2026-05-28 — Truth A confirmed on both Stripe and backend sides. See sections at bottom.
**Type:** Mixed — business/product question first, then code follow-up if the answer requires it.
**Severity:** Customer-experience misalignment. The UX currently says "Not enabled — contact us" to subscribed shops; if the business plan was always "AI bundled in the $500/month subscription with overage above $20", every subscriber has been seeing the wrong message since launch.

---

## What triggered this

User assumption (verbatim from a session conversation):
> *"I thought ai is comes with the subscription plan then they charge user if the monthly usage is above 20$."*

What the code actually does (verified by reading `SettingsController.ts`, `SpendCapEnforcer.ts`, and the shop-side AI Assistant settings UI):
1. `ai_shop_settings.ai_global_enabled` is **admin-only** — shops cannot self-activate. The shop-side UI shows a *"Not enabled — Contact us if you'd like them turned on or off"* badge instead of a toggle.
2. `monthly_budget_usd` defaults to **$20** and is also admin-only — shops cannot raise their own cap.
3. `SpendCapEnforcer.canSpend()` returns **HTTP 429 hard-reject** when `current_month_spend_usd >= monthly_budget_usd`. There is no usage-based billing trigger — the system just stops processing AI requests until the next month.
4. `SettingsController.ts:10-12` comment is explicit: *"a shop must not turn on its own AI capability or raise its own cost cap"*.
5. No code path I found takes usage above the cap and bills it to Stripe as overage — searched for terms like `meter`, `usage`, `overage`, `metered` in the Stripe + subscription handlers; nothing relevant.

The two pictures disagree completely.

## The two possible truths

### Truth A — the code is right, the business model is "admin-gated pilot"

AI is treated as an opt-in feature where platform staff approve activation per shop. The $20 cap is a hard ceiling chosen to bound platform Anthropic costs during the rollout. Shops aren't billed for AI separately — they're given a fixed allowance, and if they want more they… can't. Activation requires contacting support.

This matches the code today. It also matches a reasonable "pilot launch, then transition to a paid model later" strategy.

If this is right, the UX *"contact us"* message is correct, and there's nothing to fix beyond maybe making the activation flow clearer.

### Truth B — the business plan is right, the code is incomplete

AI is bundled into the $500/month subscription. Every Stripe-active shop should auto-have AI enabled. $20/month worth of Anthropic usage is included. Above that, the shop's Stripe invoice picks up the overage automatically — metered billing.

If this is right, the code is missing:
- **Auto-activation on subscription start** — when `shop_subscriptions.status` becomes `active`, `ai_shop_settings.ai_global_enabled` should flip to `true` for that shop. The shop UI should never show "contact us".
- **Soft cap → overage trigger** — instead of `canSpend()` rejecting at $20, it should keep processing but mark spend over $20 as billable.
- **Stripe metered product** — a usage-based price in Stripe that the backend reports `current_month_spend_usd - 20` against (or whatever the right delta is, after the included allowance).
- **Shop UI** — replace "Not enabled" with current usage + remaining included balance + overage rate. Shop knows what they'll be billed.

The bug isn't a small one. It's an entire billing capability that was scoped but not built. If Truth B has been the plan since day one, the platform has been delivering ~50% of the AI feature.

## Verification steps (do these before deciding)

In order — cheapest first.

### Step 1 — Stripe dashboard check (~5 min)

Open the RepairCoin product in Stripe Dashboard. Look at the price object(s) attached.

- If you see a `recurring` price of $500/month and NO `metered` price → there's no overage billing wired up at all. **That's strong evidence for Truth A.**
- If you see a `metered` price (per-unit usage) attached to the same subscription → metered billing exists at the Stripe side. **Suggests Truth B and the gap is just the backend reporting.**

**Status (executed 2026-05-28):** ✅ Confirmed Truth A. DC Shopuo's subscription (`sub_1TR8AIL8hwPnzzXkDvWnIqtn`) shows exactly ONE price attached: the flat $500/mo recurring (`price_1S7oRjL8hwPnzzXkaY10IE9k`, "RepairCoin Shop Subscription", $500 USD/month, quantity 1). NO metered price object attached anywhere. Stripe side has no scaffold for overage billing.

Combined with Step 2's zero-matches code grep, both Stripe and backend are aligned: there is no AI-bundled-with-overage model anywhere in the stack. The original assumption ("AI included in $500/mo with overage above $20") is NOT the business plan as implemented.

### Step 2 — Code grep for metered-usage reporting (~10 min)

Search the backend for any Stripe `usage_record` or `meter_event` calls:

```bash
cd backend
grep -rn "createUsageRecord\|meter_event\|usageRecord" src/
grep -rn "recurring.*metered\|metered.*recurring" src/
```

- No matches → no metered-usage path exists in the backend, regardless of Stripe config.
- Matches → there's at least scaffolding for the metered model. Read where it's called from.

**Status (executed 2026-05-27):** ✅ ZERO MATCHES across all search variants (`createUsageRecord`, `usageRecord`, `usage_record`, `UsageRecord`, `meter_event`, `meterEvent`, `stripe.subscriptionItems`, `stripe.usage`, `stripe.meter`, `recurring.*metered`, `metered.*recurring`). The backend has NO metered-usage code path. What IS wired to Stripe is the flat $500/month subscription model only — see `StripeService.ts`, `SubscriptionEnforcementService.ts`, `webhooks.ts`. The AI spend cap (`SpendCapEnforcer`, `ai_shop_settings.current_month_spend_usd`) is enforced 100% backend-DB-side via HTTP 429 hard-rejects; it never touches Stripe.

**Implication for the decision tree:** the code matches Truth A. To know whether the BUSINESS PLAN matches Truth A (or whether Truth B was the intent and never built), Step 1 (Stripe dashboard) is still needed.

### Scope expansion noted 2026-05-27

User flagged that the platform has **two access paths**, not one:

| Path | Example shop | Payment relationship |
|---|---|---|
| **RCG stake** | Peanut | Shop stakes RCG tokens to get access; no monthly fee. Tier (Standard / Premium / Elite) determined by stake size. |
| **Subscription** | DC Shopuo | $500/month flat Stripe subscription. |

Verified via grep: the `AIAgentDomain` codebase has **zero references** to `rcg_tier`, `rcg_balance`, OR `subscription_active`. AI activation is fully decoupled from access path. An admin enables AI the same way for an RCG-staked shop as for a subscription shop — both go through `ai_shop_settings.ai_global_enabled` (admin-gated, hard $20 cap).

This expands the original question. The verification doc was framed around subscription-shop billing, but the platform supports a second cohort entirely:

1. **For SUBSCRIPTION shops** — is AI bundled in the $500/mo? Is overage billed?
2. **For RCG-STAKED shops** — is AI bundled in the tier benefits? Or is there a separate AI-access mechanism for them?
3. **Implementation philosophy** — should both cohorts share unified AI access (status quo: yes, via the admin gate + spend cap), or should each cohort have its own AI policy?

Step 1 (Stripe dashboard check) only tells us about the SUBSCRIPTION-path billing intent. The RCG-path question stays open regardless of what Stripe shows.

**Updated next-action:** run Step 1 against DC Shopuo (it's the subscription-path shop; Peanut wouldn't have a Stripe customer record for AI). Then queue product alignment on the RCG-path question separately.

### Step 3 — Founder / product alignment (~30 min meeting)

If steps 1 and 2 contradict each other, OR if you suspect the business plan changed after the original implementation, get product alignment. Specific questions:

1. Is AI supposed to be part of the $500 subscription (included), or a separate admin-approved feature?
2. If included — what's the included allowance ($20? $50? unlimited?), and what's the overage rate?
3. Do existing subscribed shops have an expectation that AI is on for them? (i.e., are we breaking their assumption by gating it?)
4. If we're going to reconcile, do existing AI-disabled shops get retroactive activation or do they need to opt-in?

Without product alignment, code can't move. This is the gating step.

## Decision tree after verification

| Outcome | What to do |
|---|---|
| Code matches business model (Truth A) | File this doc as "verified — no work needed". Maybe improve the *"contact us"* copy to set the expectation more clearly (e.g., "AI Sales Assistant — available on request. Contact support to enable."). |
| Business model is Truth B AND Stripe is partially wired | Build the missing layers — auto-activate on subscription, soft-cap + meter, shop usage UI. Estimated: 2-4 days backend, ~1 day frontend, plus Stripe testing. |
| Business model is Truth B AND Stripe has nothing wired | Bigger lift. Stripe configuration + new metered product + backend reporting + frontend usage display. Estimated: 1 week. |
| Business model has changed (was A, becoming B) | Same as Truth B branches above, but also need a customer-comms plan for shops who've been told "AI is opt-in" so far. |

## Why this matters (cost of inaction)

- **If Truth B is right:** shops are paying $500/mo expecting AI; we're not delivering it without their separate request. That's a refund / churn risk.
- **If Truth A is right:** the shop-side *"contact us"* badge sets a passive friction. Most shops will see it and not bother contacting. They'll just churn or use a competitor. Even under Truth A there's a UX problem worth fixing.

Either way, the current state is worse than either coherent model. This is worth resolving.

## Out of scope for this doc

- Implementation of the metered model (only after Truth B is confirmed)
- Customer communications strategy
- Refund logic for shops who paid for AI they couldn't access
- Stripe product / pricing redesign (a separate billing-model task entirely)
- Multi-tier AI pricing (Basic vs Pro AI access)

## Suggested next action

**Do Step 1 (Stripe dashboard check) first — 5 minutes, definitive.** That alone narrows the decision tree by 50%. Step 2 (code grep) takes 10 more minutes and locks the answer. After that you'll know whether this is "improve the copy" or "build a billing layer", and you can plan accordingly.

---

## Resolution (2026-05-28)

**Both verification steps complete. Truth A confirmed.**

- ✅ Step 2 (code grep, 2026-05-27): zero metered-usage code paths in backend.
- ✅ Step 1 (Stripe dashboard, 2026-05-28): DC Shopuo's subscription has only the flat $500/mo recurring price attached. No metered product.

**Conclusion:** the original assumption was wrong. AI is NOT subscription-bundled with overage billing. The system is correctly implemented as an admin-gated pilot:

- $500/month subscription buys baseline platform access (shop dashboard, customer-facing surfaces, RCN economy)
- AI is a separate platform feature, gated by admin approval per shop
- Hard $20/month per-shop AI cap, enforced server-side as HTTP 429 hard-reject (no overage billing)
- Shops contact RepairCoin to request AI activation; admin flips `ai_global_enabled` in the AI Agent admin tab

**Action items closed:**
- No code work needed. The implementation matches the business model.
- The shop UI copy *"These are managed by RepairCoin. Contact us if you'd like them turned on or off for your shop"* is policy-accurate, not a UX bug.
- The yellow banner + gray badge fix shipped 2026-05-27 (`ai-ux-shop-gate-clarity.md`) is the right communication layer for shops to understand AI isn't part of their subscription.

**Still open (separate threads):**

1. **RCG-path AI access policy.** Peanut and other RCG-stake shops aren't subscribers. They're outside the scope of THIS verification. Open question: is AI part of RCG tier benefits, separate pilot, or paid add-on? Needs a product/founder conversation, not code.

2. **Future revisit if business model changes.** If RepairCoin later decides AI SHOULD be subscription-bundled with overage, the implementation gap (~1 week per scope estimate) would need to be planned. As of today's verification, no decision has been made to go that direction — the current model is the intentional one.
