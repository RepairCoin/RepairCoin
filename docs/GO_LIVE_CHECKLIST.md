# RepairCoin — Go-Live Checklist (Web/UI)

Pre-launch end-to-end test plan for the barbershop launch. Check each item on **desktop + mobile** (see Responsive section). Blockchain is **OFF** for launch (`ENABLE_BLOCKCHAIN_MINTING=false`), so no wallet/token UI should appear anywhere.

Legend: ☐ not tested · ✅ pass · ❌ fail (log issue)

---

## 0. Environment / config sanity
- ☐ `GET /api/config` returns `{ blockchainEnabled: false }` in the target env
- ☐ `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` set in prod (AI features live) — or accept fallback mode
- ☐ Stripe keys are **live** (not test) for production; webhook secret configured
- ☐ Frontend deployed from latest `main`; hard refresh clears old build

## 1. Blockchain/Wallet hidden (launch requirement) — verify NOTHING leaks
- ☐ Shop: no "Wallet & Payouts", no "Stake RCG", no RCG balance/tier, no mint, no crypto payment
- ☐ Customer: no "Gift Tokens", no "Wallet Balance" row (card reads "My Rewards"), no block-explorer link
- ☐ Customer Settings + Redemption QR say **"RepairCoin ID"** (not "Wallet Address")
- ☐ Admin: no Affiliate Groups nav; Revenue tab shows no Stakers/DAO split or staker projections
- ☐ Public: About/Privacy/Delete-account/SEO have no "blockchain"/"crypto" wording; rewards page shows no RCG staking
- ☐ Wallet **login still works** (Thirdweb connect) — this is intentionally kept

## 2. Onboarding
### Shop
- ☐ New shop can register (wallet connect / login)
- ☐ Shop onboarding flow completes; lands on dashboard
- ☐ Shop profile (name, address, hours, services) can be set

### Customer
- ☐ New customer can register (incl. via referral link `?ref=`)
- ☐ Customer onboarding completes; lands on dashboard

## 3. Subscription + Billing (14-day trial → paid)
- ☐ Trial banner shows "X days left in your free trial" across shop dashboard
- ☐ Banner becomes urgent (non-dismissible) in last 3 days
- ☐ "Start free trial" works with **no credit card**; sets a 14-day trial
- ☐ **Plan comparison** shows all tiers side-by-side (Starter $80 / Growth $299 / Business $599) with features + "Most Popular"
- ☐ Selecting a plan → **Subscribe** → redirects to Stripe checkout
- ☐ Completing Stripe checkout activates the subscription (webhook)
- ☐ Default payment method / card management works
- ☐ Subscription Guard blocks correctly for: pending, paused, expired, suspended, cancelled
- ☐ Cancel + resubscribe works
- ☐ Support tab shows correct **support level** per tier (Business = Dedicated Account Manager)

## 4. Core loop: booking → payment → shop → notifications
- ☐ Customer browses marketplace, finds a shop/service
- ☐ Customer books a service (date/time slot picker works)
- ☐ Customer pays (Stripe) — payment succeeds
- ☐ Shop sees the new booking/order
- ☐ Shop completes the service → customer earns RCN reward
- ☐ Customer sees updated reward balance ("My Rewards")
- ☐ Customer redeems RCN at the shop (redemption approval flow works)
- ☐ **Notifications fire** at each step (in-app + push): booking, payment, completion, reward, redemption

## 5. Referrals
- ☐ Customer gets a referral code/link
- ☐ Referred customer registers + completes first repair → referrer earns 25 RCN, referee 10 RCN
- ☐ Referral shows in customer's referral dashboard

## 6. Reviews / moderation
- ☐ Customer can review a completed booking
- ☐ Shop sees reviews; admin moderation queue works

## 7. Admin (spot-check the new tools)
- ☐ Audit Log loads and shows admin actions
- ☐ Revenue Analytics shows correct numbers (no stakers/DAO, no NaN%)
- ☐ Webhook Monitor loads (health green when no failures)
- ☐ Announcements broadcast reaches shops/customers
- ☐ Pending shops appear + can be approved

## 8. Agency Program
- ☐ `/agency` page loads (hero, features, $999 pricing, apply CTA → contact-us)
- ☐ Footer "Agency Program" link works

## 9. Responsive (test every above flow at these widths)
- ☐ Mobile (~375px, iPhone SE/12)
- ☐ Tablet (~768px)
- ☐ Desktop (≥1280px)
Specifics:
- ☐ Sidebars collapse / hamburger works on mobile (shop, customer, admin)
- ☐ Plan comparison stacks to 1 column on mobile
- ☐ Tables/modals scroll and fit (no horizontal overflow)
- ☐ Booking flow + Stripe checkout usable on mobile

## 10. Cross-cutting
- ☐ No console errors on load of each dashboard
- ☐ 401 → silent token refresh works (no forced logout mid-session)
- ☐ Error states show a message (not a blank/empty screen)
- ☐ Loading states (skeletons/spinners) appear, not blank flashes

---

## Sign-off
- ☐ Web/UI lead (Zeff)
- ☐ Mobile lead (Khalid/Travis)
- ☐ AI lead (Deo)
- ☐ Product/QA — final go-live approval

> Log any ❌ with: page/URL, steps to reproduce, expected vs. actual, screenshot.
