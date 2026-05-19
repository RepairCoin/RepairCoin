# RepairCoin — QA Quick-Start Guide

**Audience:** new QA team members
**Purpose:** a fast orientation to the app — what it is, who uses it, and
how the main flows fit together — so you can start testing with context.

This is a *map*, not a spec. Specific test cases live in the other
`docs/tasks/test/qa-*.md` guides.

---

## 1. What is RepairCoin?

RepairCoin is a **loyalty-rewards platform for repair shops**. Repair shops
reward their customers with **RCN tokens** for completed services;
customers redeem those tokens for discounts on future bookings. It also
includes a **service marketplace** (customers browse + book services
online) and an **AI Sales Agent** (chats with customers in-app).

**Tech, at a glance:** Next.js web frontend (port `3001`), Node/Express
backend API (port `4000`), PostgreSQL database, Stripe for payments,
Thirdweb + the Base blockchain (test network) for the tokens.

---

## 2. The three user roles

Everything in the app is one of three roles. Each has its own dashboard.

| Role | Who they are | Dashboard |
|------|--------------|-----------|
| **Customer** | End users who get repairs and earn/redeem RCN | `/customer` |
| **Shop** | Repair-shop owners who run services and reward customers | `/shop` |
| **Admin** | RepairCoin platform staff | `/admin` |

When testing, always be clear **which role** you're logged in as — the same
feature often behaves differently per role.

---

## 3. Authentication

- Login is **wallet-based** — the user connects a crypto wallet (via
  Thirdweb); there is no password login. A shop registered with one wallet
  can also sign in via Google/social if the **email** matches.
- After login the backend issues a **JWT** that carries the user's role.
  Every API call and every page is **role-gated** by that token.
- Wallet addresses are always stored/compared in **lowercase**.
- A wallet maps to exactly one role. Logging in routes you to that role's
  dashboard automatically.

**QA note:** keep separate test accounts for customer / shop / admin. If a
page or button is missing, first check you're on the right role.

---

## 4. The two tokens

| Token | Purpose |
|-------|---------|
| **RCN** | The **rewards** token. 1 RCN ≈ $0.10. Customers earn it from completed services and redeem it for discounts. Shops buy RCN from the platform to hand out. |
| **RCG** | The **governance** token (fixed supply). A shop's RCG holdings set its **shop tier** (below), which affects the price it pays for RCN. |

**RCN redemption rule:** a customer can redeem up to **100%** of their RCN
at the shop where they earned it ("home shop"), but only **~20%** at other
shops.

---

## 5. Customer side

- **Loyalty tiers:** Bronze / Silver / Gold — higher tiers earn small bonus
  RCN per service (roughly +0 / +2 / +5).
- **Earning:** RCN is credited when a booked service is marked *completed*.
- **Referrals:** referring a new customer rewards both sides.
- **Service marketplace:** browse shops' services, filter/search, favorite
  services, view reviews, and **book** (see §7).
- **Messaging:** customers can chat with shops in-app (this is also where
  the **AI Sales Agent** replies — see §9).
- **Redemption:** RCN is applied as a discount at checkout.

---

## 6. Shop side

- **Subscription:** a shop pays a **$500/month** subscription (via Stripe)
  to operate. Subscription state matters — an **expired / suspended /
  paused** shop loses access to parts of the dashboard.
- **Shop tier (RCG-based):** Standard / Premium / Elite, set by how much
  **RCG** the shop holds (roughly 10K / 50K / 200K). Higher tier = cheaper
  RCN purchases.
- **Day-to-day:** shops buy RCN, issue rewards, look up customers, create
  and manage **services**, handle **bookings & appointments**, respond to
  reviews, and configure the **AI Sales Agent**.
- **Dashboard:** the shop dashboard is tabbed (Overview, Services,
  Appointments, Messages, Customers, Settings, etc.). New AI controls live
  under **Settings → AI Assistant**.

> Don't confuse the two "tiers": **customer loyalty tiers** (Bronze/Silver/
> Gold) and **shop tiers** (Standard/Premium/Elite, from RCG) are separate
> systems.

---

## 7. Booking lifecycle

The core revenue flow. A customer books a service; it moves through states:

1. **Customer books** — picks a service, a date, and a time slot.
2. **Payment** — pays via Stripe checkout. RCN can be applied as a discount.
3. **Order created** — status **`paid`** (auto-approved on payment).
4. **Shop completes** the service → status **`completed`** → the customer
   earns RCN.
5. Other endings: **`cancelled`** (customer or shop), **`refunded`**,
   **`no-show`** (customer didn't show), **`expired`** (not completed
   within the window after the appointment).

**Appointments:** shops configure operating hours, slot duration, and
holiday overrides; customers pick from real available slots.

---

## 8. No-show policy (affects booking)

To discourage no-shows, customers have a **no-show tier** per shop:

| Tier | Effect |
|------|--------|
| normal / warning | No restrictions |
| **caution** | Must book further in advance (e.g. 24h) |
| **deposit_required** | Must book ~48h ahead **and** pay a refundable deposit |
| **suspended** | Cannot book at all for a period |

A customer's tier escalates as they accumulate missed appointments.
**Booking times are always in the shop's timezone** — a common source of
confusing bugs, so watch the timezone when testing advance-notice rules.

---

## 9. AI Sales Agent

An AI assistant that replies to customers inside shop chats. QA will test
this heavily, so know the pieces:

- **Replies in chat** — answers customer questions about a service,
  proposes booking slots ("tap-to-book" cards).
- **Follow-up nudge** — if a customer goes quiet mid-conversation, the AI
  sends one follow-up message later to re-engage.
- **FAQ** — shops author Q&A per service that the AI quotes from; there's a
  "Suggest questions with AI" helper.
- **Settings** — *shop side* tunes behavior (handoff threshold, follow-up
  delay) under Settings → AI Assistant; *admin side* gates whether AI and
  follow-ups are on per shop (Admin → AI Agent).
- It is **staged** — features are enabled per shop, off by default.

---

## 10. Admin side

Admins operate the platform: review/approve shop applications, view
platform statistics and analytics, manage customers and shops, oversee the
token treasury, handle subscriptions, support tickets, and disputes. The
admin dashboard (`/admin`) is tabbed, similar to the shop dashboard.

---

## 11. Environments

| Environment | Notes |
|-------------|-------|
| **Local** | Frontend on `localhost:3001`, backend on `localhost:4000`. The local backend talks to the **shared staging database** — local changes hit shared data, so coordinate. |
| **Staging** | `staging.repaircoin.ai` — the main place to test deployed builds. |

Blockchain interactions use a **test network** (no real money), and Stripe
runs in **test mode** (use Stripe test cards).

---

## 12. Quick glossary

- **RCN** — rewards token (~$0.10 each); earned + redeemed by customers.
- **RCG** — governance token; sets a shop's tier.
- **Customer tier** — Bronze / Silver / Gold (loyalty, earning bonus).
- **Shop tier** — Standard / Premium / Elite (from RCG, affects RCN price).
- **No-show tier** — per-customer booking restriction level.
- **Home shop** — the shop where a customer earned their RCN (100%
  redemption there).
- **Order** — a booked service; moves paid → completed (or cancelled /
  no-show / expired).
- **AI Sales Agent** — the in-chat AI assistant.

---

*Questions or something out of date? Flag it — this guide should stay
short and accurate.*
