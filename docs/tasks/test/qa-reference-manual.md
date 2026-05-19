# RepairCoin — Comprehensive QA Reference Manual

**Audience:** QA team members who need the full picture.
**Companion doc:** `qa-onboarding-quick-guide.md` is the 5-minute version.
This is the deep reference — every system, the exact numbers, and the
known quirks to watch for.

All numbers below are verified against the codebase. Where the codebase is
inconsistent or a value couldn't be confirmed, it's **flagged**. Section 13
collects every known quirk into one QA watch-list — read it.

---

## Table of contents

1. System overview & architecture
2. The token economy (RCN & RCG)
3. Authentication & sessions
4. Roles & permissions
5. Customer — tiers, earning, referrals, redemption
6. Shop — subscription, RCG tiers, RCN purchasing, lifecycle
7. Service marketplace & booking
8. No-show policy
9. AI Sales Agent
10. Messaging
11. Admin capabilities
12. Environments & test setup
13. Known inconsistencies — QA watch-list
14. Glossary

---

## 1. System overview & architecture

RepairCoin is a **loyalty-rewards platform for repair shops**: shops reward
customers with **RCN tokens** for completed services; customers redeem
those tokens for discounts. It also runs a **service marketplace** (online
booking) and an **AI Sales Agent** (in-app chat).

- **Backend:** Node + Express + TypeScript, domain-driven design. Port `4000`.
- **Frontend:** Next.js 15 + React 19. Port `3001`.
- **Database:** PostgreSQL 15.
- **Payments:** Stripe.
- **Blockchain:** Thirdweb SDK on **Base Sepolia** (test network). Tokens:
  RCN `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`,
  RCG `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`.
- Backend is split into **domains** (CustomerDomain, ShopDomain,
  ServiceDomain, AdminDomain, TokenDomain, AIAgentDomain, messaging,
  WebhookDomain, NotificationDomain) that talk via an internal EventBus.

---

## 2. The token economy (RCN & RCG)

| | **RCN** | **RCG** |
|---|---|---|
| Purpose | Rewards / utility token | Governance token |
| Value | **1 RCN = $0.10 USD** (fixed everywhere) | Market/holding-based |
| Who earns it | Customers, from completed services | Shops hold it (not "earned") |
| Who buys it | Shops buy RCN from the platform to give out | — |
| Effect | Redeemed for discounts | A shop's RCG balance sets its **shop tier** |

**Key concept — RCN balances are database-first.** RCN that a customer
earns is credited to a **database balance** (`current_rcn_balance` /
`lifetime_earnings`), **not** minted on-chain automatically. The customer
must explicitly use **"Mint to Wallet"** to move RCN on-chain. Likewise,
RCN a shop *purchases* is a DB balance (`purchased_rcn_balance`); on-chain
minting happens only when a reward is actually issued. This is deliberate
(saves blockchain gas). QA implication: most RCN flows you test are DB
balance changes, not blockchain transactions.

A customer's spendable balance is computed as:
`lifetime_earnings + net_transfers − total_redemptions − pending_mint − minted_to_wallet`.

---

## 3. Authentication & sessions

### 3.1 Login is wallet-based

RepairCoin login is **wallet-based** (a crypto wallet via Thirdweb).
**There is no password-based login** for the actual auth flow. The flow:

1. The user connects a wallet → produces a wallet address (always
   normalized to **lowercase**).
2. The frontend posts that address to a role endpoint, which returns a JWT.

Auth endpoints (`/api/auth/...`): `token` (auto-detects role), `admin`,
`customer`, `shop`, `check-user`, `refresh`, `logout`, `demo`.

> **Note:** there is no server-side signature challenge — possession of a
> wallet address that resolves to a registered user is enough to mint a
> token. The security boundary is "address exists in DB."

**Social / email fallback:** a shop registered with one wallet can log in
via Google/social with a *different* wallet if the **email matches** a shop
record. The shop's original wallet is preserved (for RCG ownership); the
social wallet is tracked separately.

**Demo mode:** `POST /api/auth/demo` logs in a fixed demo account (for app-
store review) and skips DB validation.

### 3.2 JWT & sessions

- The JWT carries: `address`, `role` (`admin` | `shop` | `customer`),
  `shopId` (shops only), `type` (`access` | `refresh`), issued/expiry.
- The JWT does **not** contain admin sub-role or permissions — those are
  looked up from the DB on each request.
- **Access token:** ~15 minutes. **Refresh token:** ~7 days.
- Tokens are set as **httpOnly cookies** (`auth_token`, `refresh_token`)
  and also returned in the JSON body (for mobile).
- **Auto-refresh:** if the access token is expired but the refresh cookie
  is valid, a new access token is minted transparently mid-request. There's
  also a sliding-window refresh when <5 min remain (response carries
  `X-Token-Refreshed: true`).
- After a token is revoked, re-login is blocked for **60 minutes**.

**QA implications:** sessions refresh silently — you usually won't get
logged out at the 15-minute mark. To test true expiry you need both tokens
gone. Cookies are domain-scoped; cross-subdomain behavior depends on
`COOKIE_DOMAIN`.

---

## 4. Roles & permissions

### 4.1 The three roles

`customer`, `shop`, `admin` — every user is exactly one. Role is resolved
in this order: **admin** (wallet in `ADMIN_ADDRESSES` env or `admins`
table) → **shop** (wallet/email matches a shop) → **customer**.

**One wallet = one role.** Registration is blocked (HTTP 409) if the wallet
is already another role. *Caveat:* the conflict check runs only at
registration — adding a wallet to `ADMIN_ADDRESSES` after it already
registered as a customer/shop creates a latent conflict (there's an
`admin:check-conflicts` CLI to detect this).

### 4.2 Admin sub-roles

Stored in the DB (not the JWT). Three levels:

| Sub-role | Can do |
|---|---|
| **super_admin** | Everything, including managing other admins |
| **admin** | Everything **except** admin management (create/delete/update admins) |
| **moderator** | **Read-only** — only `view_*` permissions |

`ADMIN_ADDRESSES` (env var) is the **source of truth for super admins**.
On login the system auto-syncs: an env address becomes super_admin; a
super_admin *not* in the env list is demoted to plain `admin`.

### 4.3 Role-based routing

Frontend middleware decodes the JWT and enforces dashboards: `customer →
/customer`, `shop → /shop`, `admin → /admin`. A mismatched role is
redirected to its own home. **When testing, always confirm which role
you're logged in as** — missing buttons/pages are usually a role mismatch.

---

## 5. Customer — tiers, earning, referrals, redemption

### 5.1 Customer registration & lifecycle

- Registered via `registerCustomer` — rejects an already-registered wallet.
  Accepts an optional `referralCode`.
- A customer record can also be **auto-created** by a repair webhook, a
  marketplace order, or a referral — so a customer can exist without ever
  formally "registering."
- New customers default to: tier **BRONZE**, `lifetimeEarnings: 0`,
  `isActive: true`.
- Wallet addresses are always lowercased.
- Customers can be **suspended** (admin action) — suspended/inactive
  customers are blocked from redemption sessions.

### 5.2 Loyalty tiers — Bronze / Silver / Gold

A customer's tier is a pure function of their **lifetime RCN earned**
(cumulative — *not* current balance, *not* number of services):

| Tier | Lifetime RCN earned |
|---|---|
| **Bronze** | 0 – 199 |
| **Silver** | 200 – 999 |
| **Gold** | 1,000+ |

The tier is recalculated and saved **on every earning event**. There is no
nightly job — if a customer crosses 200 lifetime RCN, the tier updates the
moment that earning is recorded. Gifting RCN between customers updates
balance but **not** `lifetime_earnings`, so gifting can't inflate a tier.

### 5.3 Earning RCN

**Base reward for a completed service** (based on the service/repair price):

| Service price | Base RCN earned |
|---|---|
| Under $50 | **Nothing** — rejected, "$50 minimum" |
| $50 – $99 | **10 RCN** |
| $100 or more | **25 RCN** |

There is **no scaling above $100** — a $100 service and a $5,000 service
both yield 25 base RCN.

**Tier bonus** — extra flat RCN on top of the base, per qualifying service
(service ≥ $50):

| Tier | Bonus |
|---|---|
| Bronze | +0 |
| Silver | **+2 RCN** |
| Gold | **+5 RCN** |

So a Gold customer completing a $120 service earns `25 + 5 = 30 RCN`.

- **No daily or monthly earning limits** — confirmed.
- RCN is credited **only when an order reaches `completed`** (the shop
  marks the service done) — *not* at booking and *not* at payment.

> ⚠ **Watch-list (see §13):** the tier bonus is applied on the **marketplace
> order** path, but the **legacy repair-webhook** path credits base RCN
> only. Test the two earning paths separately.

### 5.4 Referrals

- Referrer earns **25 RCN**; the new referee earns **10 RCN**.
- Flow: referrer generates a referral code → referee registers with it (a
  *pending* referral is recorded, **no RCN yet**) → rewards pay out only
  when the **referee completes their first repair/service**.
- Self-referral is blocked. A referee who already has a referrer can't be
  referred again.
- Referral RCN is DB-balance-only (no on-chain mint).

### 5.5 Redeeming RCN — two separate mechanisms

These are **different systems** — don't conflate them.

**(A) In-shop counter redemption** — customer redeems RCN at a shop for
value at the point of service.
- **100%** of the customer's RCN balance is redeemable at their **home
  shop** (the shop where they earned the most RCN).
- Only **20% of their balance** is redeemable at any **other** shop.
- The shop opens a redemption session; the customer approves it; the shop
  consumes it. Sessions **expire after 5 minutes**. Max 5 sessions per
  customer-shop per 5 minutes.
- The shop must hold enough purchased RCN to cover the redemption.

**(B) Marketplace booking discount** — customer applies RCN as a discount
when booking a service online.
- The discount is capped at **20% of the service price**.
- The service must cost **at least $10** to use RCN.
- Excess requested RCN is silently capped to the limit.

> Both use "20%" but the **base differs**: counter = 20% of *balance*,
> marketplace = 20% of *service price*.

---

## 6. Shop — subscription, RCG tiers, RCN purchasing, lifecycle

### 6.1 Shop registration & approval

- A shop applies via `POST /api/shops/register` (CAPTCHA-protected).
- A new shop is created **`verified: false, active: false`** — it must
  await **admin approval**.
- An admin approves it (`approveShop`) → sets `verified: true, active: true`.
- There is **no explicit "rejected" status** — a rejected application is
  simply one left unverified/inactive.
- Shop state is the combination of `verified` + `active` + `suspendedAt` +
  `operational_status` (there's no single `status` column).

### 6.2 Subscription — $500/month

- A shop pays a **$500/month** subscription via **Stripe** to operate.
- **Exception:** a shop holding **≥ 10,000 RCG** is "RCG-qualified" and
  **does not need a subscription** — it bypasses subscription gating
  entirely.

**Subscription states** — there are **two tables** with slightly different
status names (a common source of confusion):

- `stripe_subscriptions` (mirrors Stripe): `active`, `past_due`,
  `canceled` (one "l"), `unpaid`, `incomplete`, `paused`.
- `shop_subscriptions` (app-internal): `pending`, `active`, `cancelled`
  (two "l"s), `paused`, `defaulted`.

**What's blocked when a subscription is not valid** — the
`requireActiveSubscription` middleware returns **403** when:
- the shop is suspended (`active=false` or `suspendedAt` set) → `SHOP_SUSPENDED`
- the subscription period has ended → `SUBSCRIPTION_EXPIRED`
- `operational_status` is `paused` / `not_qualified` / `pending` → `SUBSCRIPTION_INACTIVE`

Confirmed gated: **RCN purchasing**, **service marketplace creation**.
(Purchase *history* stays viewable without an active subscription.)

**Non-payment enforcement** — a daily cron (2 AM UTC):
- First warning at **3 days** overdue, then every **3 days**, max **3
  warnings**.
- Auto-cancel at **14 days** overdue (subscription cancelled in Stripe,
  `operational_status` recomputed).

> ⚠ A second code path uses a **7-day** grace period — see §13.

**Cancellation** can be immediate or at-period-end (the shop keeps access
until the period actually ends).

### 6.3 Shop tiers — Standard / Premium / Elite (RCG-based)

A shop's tier is set by how much **RCG** it holds:

| Tier | RCG held | RCN purchase price | vs. base |
|---|---|---|---|
| (none) | < 10,000 | $0.10 | — (must subscribe to operate) |
| **Standard** | 10,000 – 49,999 | **$0.10** / RCN | 0% off |
| **Premium** | 50,000 – 199,999 | **$0.08** / RCN | 20% off |
| **Elite** | 200,000+ | **$0.06** / RCN | 40% off |

The shop tier's main effect is the **price the shop pays to buy RCN** from
the platform. Higher RCG holdings → cheaper RCN.

Revenue from every RCN purchase splits **80% platform operations / 10% RCG
stakers / 10% DAO treasury**.

> Don't confuse this with **customer loyalty tiers** (Bronze/Silver/Gold) —
> entirely separate systems.

### 6.4 Shop RCN purchasing

- Endpoint: `POST /api/shops/purchase/initiate` (requires an active
  subscription *or* RCG qualification).
- Amount: **minimum 5 RCN, maximum 100,000 RCN, whole numbers only**.
- Cost = `amount × tier price per RCN`. Paid via Stripe Checkout.
- On payment, the shop's `purchased_rcn_balance` (spendable) and
  `total_rcn_purchased` (lifetime) increase. **DB balances — no on-chain
  mint at purchase time.**
- Pending purchases self-reconcile against Stripe; abandoned after 24h.

### 6.5 `operational_status` field

A column on the shop record. Values:

| Value | Meaning |
|---|---|
| `pending` | New shop, not yet qualified |
| `rcg_qualified` | Holds ≥ 10,000 RCG — operational without a subscription |
| `subscription_qualified` | Has an active Stripe subscription |
| `not_qualified` | No active subscription and < 10,000 RCG — operations blocked |
| `paused` | Admin manually paused the subscription (protected — sync jobs won't overwrite it) |

> ⚠ A stray value `commitment_qualified` can appear via an old DB trigger —
> see §13.

### 6.6 Shop suspension

- An **admin** can suspend a shop (with a reason). This sets `active=false`
  and `suspendedAt`.
- A suspended shop is **fully blocked** regardless of subscription/RCG
  status (403 `SHOP_SUSPENDED`).
- `unsuspendShop` reverses it.
- Suspension (`active`/`suspendedAt`) is separate from a subscription being
  `paused` — different mechanisms.

---

## 7. Service marketplace & booking

### 7.1 Services

A **service** (`shop_services`) belongs to a shop and has: name,
description, `price_usd`, `duration_minutes`, `category`, `image_url`, and
an `active` flag (controls whether it's bookable). Customers browse the
marketplace, filter/search, favorite services, and book.

### 7.2 Order lifecycle

An **order** (`service_orders`) is a booked service. Statuses:

| Status | Meaning |
|---|---|
| `pending` | Awaiting payment. Rare in the normal flow — orders aren't created until payment succeeds; mostly seen for manual bookings. |
| `paid` | Payment succeeded; order created. The active "booked" state. **Auto-approved on payment.** |
| `completed` | Shop marked the service rendered → **customer earns RCN here**. |
| `cancelled` | Cancelled by customer or shop. |
| `refunded` | In the enum but effectively unused — refunds are processed against `cancelled`/`expired` orders. |
| `no_show` | Customer didn't arrive. |
| `expired` | 24h past the appointment without completion (auto-refunds RCN + Stripe). |

**Flow:** customer picks a service + date + time → pays via Stripe → order
created `paid` (auto-approved) → shop marks `completed` → RCN credited.
Endings: customer/shop cancel, no-show (shop-marked or auto-detected),
or expiry.

- A shop can't mark an order `completed` if it's already `expired` or past
  the 24h window.
- Customer self-cancellation enforces a **24-hour-advance** rule.

### 7.3 Appointments & time slots

Per-shop config (`shop_time_slot_config`) — defaults:

| Setting | Default |
|---|---|
| Slot duration | 60 min |
| Buffer between slots | 15 min |
| Max concurrent bookings (per slot) | 1 |
| Booking advance window | 30 days |
| Minimum notice before a slot | 2 hours |
| Weekend booking | allowed |
| Timezone | `America/New_York` |

Shops also set per-day-of-week open hours, break times, and date overrides
(holidays). Available slots are generated from open→close, stepping by
`duration + buffer`, skipping breaks, slots inside the minimum-notice
window, and slots already at capacity.

> ⚠ **All booking times are in the SHOP's timezone**, not the customer's
> and not the server's. This is a frequent source of confusing bugs — when
> testing advance-notice rules, mind the shop timezone (see §13).

### 7.4 Payment

- Two Stripe paths: an in-app **PaymentIntent** path and a browser
  **Checkout** redirect path.
- No DB order exists until payment succeeds — all order data rides in the
  Stripe metadata until then.
- RCN redemption (the marketplace discount, §5.5-B) is applied as a
  discount; Stripe is charged the discounted total (plus any no-show
  deposit).

---

## 8. No-show policy

To discourage missed appointments, each customer has a **no-show tier**
(tracked per the shop's policy). It's driven by `no_show_count`:

| `no_show_count` | Tier |
|---|---|
| 0 | `normal` |
| 1 | `warning` |
| 2 | `caution` |
| 3 – 4 | `deposit_required` |
| 5+ | `suspended` |

**Per-tier restrictions** (default policy values):

| Tier | Min advance booking | Deposit | Max RCN redemption |
|---|---|---|---|
| normal / warning | shop default only (2h) | none | 20% (global only) |
| **caution** | **24 hours** | none | **80%** |
| **deposit_required** | **48 hours** | **$25.00** (refundable) | **80%** |
| **suspended** | cannot book at all | — | — |

- The effective advance requirement is `max(shop min-notice, tier minimum)`.
- The **deposit** ($25) is added on top of the order total at checkout and
  **auto-refunded when the order is completed**.
- **Suspension** lasts **30 days**; the customer cannot book during it.
- **Recovery is gradual:** completing services increments a counter; every
  **3 successful appointments** drops the customer **one tier**
  (`deposit_required → caution → warning → normal`). The final step to
  `normal` wipes the no-show count.
- Per-shop policy lives in `shop_no_show_policy`; defaults apply if a shop
  has no row. Key defaults: grace period 15 min, min cancellation notice
  4h, **auto-detection of no-shows is OFF by default**.

> ⚠ Auto no-show detection has a known table-name discrepancy — see §13.

---

## 9. AI Sales Agent

An AI assistant (Anthropic Claude) that replies to customers inside shop
chats. It is **staged** — disabled by default; enabled per shop.

**What it does:**
- **Replies in chat** — when a customer messages a shop and the
  conversation has a service attached, the AI auto-replies: answers
  questions about the service, quotes price/duration, and can propose
  bookable time slots as **"tap-to-book" cards**.
- **Order/booking confirmation** — posts a friendly confirmation message
  into the chat after a booking is paid or an order is completed.
- **Follow-up nudge** — if a customer goes quiet mid-conversation, the AI
  sends **one** follow-up message later (~20 min default) to re-engage.
  This is separately staged (`ai_followup_enabled`, off by default).
- **FAQ** — shops author Q&A per service; the AI quotes those answers
  directly. There's a "Suggest questions with AI" helper that drafts FAQ
  entries.

**Controls:**
- *Shop side* — **Settings → AI Assistant**: status display + tunes
  behavior (human-handoff threshold, follow-up delay).
- *Admin side* — **Admin → AI Agent** tab: gates whether AI and follow-ups
  are on per shop, and sets each shop's **monthly AI budget**.
- A shop can never enable its own AI capability — that's an admin gate.

**Guards (the AI stays silent when):** the service or shop has AI disabled;
the shop's monthly AI budget is exhausted; a human "took over" the
conversation (`ai_paused_until`); or an escalation/handoff is triggered.

**Spend cap:** each shop has a monthly AI budget ($20 default). At ~70% the
AI switches to a cheaper model; at 100% it stops replying.

**Tone:** each service is set to `friendly`, `professional`, or `urgent`.

There are dedicated QA guides for parts of this — see
`qa-ai-sales-followup-test-guide.md`.

---

## 10. Messaging

- Customer ↔ shop **chat**. One conversation per `(customer, shop)` pair.
- A conversation is created when the first message is sent, or via a
  shop-side get-or-create endpoint.
- Message text limit **2,000 characters**. Attachments: up to **5 files,
  10MB each** (JPEG/PNG/GIF/WebP/PDF).
- Real-time delivery is via **WebSocket** — the client authenticates with
  the `auth_token` cookie (within 5 seconds of connecting) and then
  receives lightweight `message:new` events and refetches.
- The AI auto-reply fires on customer messages (see §9).
- A separate **support-ticket** chat (shop ↔ admin) exists, distinct from
  customer ↔ shop conversations.

---

## 11. Admin capabilities

Admins operate the platform from the `/admin` dashboard. Tabs / capabilities:

- **Overview** — platform statistics.
- **Customers** — list, balances, suspend/unsuspend, unsuspend-request
  approval.
- **Shops** — list, create, approve, verify, suspend/unsuspend.
- **Treasury** — token treasury tracking.
- **Token operations** — manual/emergency RCN minting, selling RCN to
  shops, completing pending purchases, minting pending wallet-mints
  on-chain.
- **Analytics** — platform-wide analytics, marketplace health.
- **Subscriptions** — subscription management + reminders.
- **Promo codes**, **RCG management**, **Revenue distribution**.
- **AI Agent** — the per-shop AI gate (§9).
- **Support** — support tickets. **Disputes**. **Bug reports**.
- **Sessions** — session management.
- **Settings** — system settings.
- **Admins / Create Admin** — *super-admin only*.

---

## 12. Environments & test setup

| Environment | Notes |
|---|---|
| **Local** | Frontend `localhost:3001`, backend `localhost:4000`. The local backend connects to the **shared (DigitalOcean) database** — local actions touch shared data; coordinate with the team. |
| **Staging** | The main place to test deployed builds. (Confirm the exact staging URL with the team — it isn't hard-coded in the repo.) |

- **Blockchain:** Base Sepolia **test network** — no real money.
- **Stripe:** **test mode** — use Stripe test cards.
- **API docs:** Swagger UI at `http://localhost:4000/api-docs`.
- Stripe webhooks locally: `stripe listen --forward-to
  localhost:4000/api/shops/webhooks/stripe`.

---

## 13. Known inconsistencies — QA watch-list

These are real quirks found in the codebase. Knowing them prevents
filing "bugs" that are known, and helps you spot the real ones.

1. **Tier bonus is path-dependent.** The +2/+5 Silver/Gold earning bonus is
   applied when a **marketplace order** is completed, but the **legacy
   repair-webhook** earning path credits base RCN only. Same customer, two
   paths, different totals.
2. **Two "20% redemption" rules.** Counter redemption caps at 20% of the
   customer's *balance*; the marketplace discount caps at 20% of the
   *service price*. Different bases — don't expect the same number.
3. **Cross-shop redemption — stale comments.** Some code comments and a
   `TierManager` helper claim "100% redemption anywhere / no cross-shop
   limit." The **live behavior is the 20% cross-shop cap**. Trust the
   behavior, not those comments.
4. **Booking timezones.** All slot/advance-notice math uses the **shop's**
   timezone. A customer in a different timezone, or a misconfigured shop
   timezone, produces confusing "too soon / wrong day" results. The
   in-app PaymentIntent path handles this correctly; the Stripe-Checkout
   path has a known server-local-time slip for the advance-notice check.
5. **Subscription grace period — two values.** One enforcement path uses a
   **14-day** grace before auto-cancel; another uses **7 days**. If a shop
   is auto-cancelled at an unexpected day count, this is why.
6. **`commitment_qualified`.** An old DB trigger can write
   `operational_status = 'commitment_qualified'`, a value the app code
   doesn't recognize — a shop in that state could be wrongly blocked.
7. **Two subscription tables, different spellings** — `stripe_subscriptions`
   uses `canceled` (one "l"); `shop_subscriptions` uses `cancelled` (two).
8. **No `rejected` shop status** — a rejected application is just an
   unverified/inactive shop; there's no dedicated reject flow.
9. **`refunded` order status** exists in the enum but no flow sets it.
10. **No-show auto-detection** queries a table named `no_show_policies`
    while the real policy table is `shop_no_show_policy`; combined with a
    COALESCE default, auto-detection may run for shops that didn't enable
    it. Auto-detection defaults **off** per policy, so verify against the
    live DB.
11. **Recovery from `suspended`** relies on the 30-day clock — successful
    appointments during suspension are not counted toward tier recovery.

---

## 14. Glossary

- **RCN** — rewards token; 1 RCN = $0.10. Earned + redeemed by customers.
- **RCG** — governance token; a shop's holdings set its shop tier.
- **Customer loyalty tier** — Bronze / Silver / Gold, by lifetime RCN
  earned (0–199 / 200–999 / 1000+). Drives the earning bonus.
- **Shop tier** — Standard / Premium / Elite, by RCG held. Drives RCN
  purchase price.
- **No-show tier** — normal / warning / caution / deposit_required /
  suspended. Drives booking restrictions.
- **Home shop** — the shop where a customer earned the most RCN; 100%
  redemption there, 20% elsewhere.
- **Order** — a booked service; paid → completed (or cancelled / no_show /
  expired).
- **operational_status** — a shop's readiness to operate (pending /
  rcg_qualified / subscription_qualified / not_qualified / paused).
- **`ai_paused_until`** — a conversation field; when set in the future, the
  AI Sales Agent stays silent (human takeover).
- **Mint to wallet** — the explicit action that moves a customer's DB RCN
  balance on-chain.
- **RCG-qualified** — a shop holding ≥10,000 RCG; operates without a
  subscription.

---

*This manual reflects the codebase as of its writing. If something here
contradicts what you observe in testing, the app's actual behavior wins —
flag the discrepancy so this doc can be corrected.*
