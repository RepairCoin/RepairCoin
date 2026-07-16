# Agency Program — Manual QA Checklist

Covers the self-serve Agency Program: activation, client management, act-as-client,
metered billing, entitlement gating, admin assigned view, and the marketing page.

## 0. Prerequisites

- [ ] Run `cd backend && npm run db:migrate` → confirm **221_add_agency_program** (`agencies`, `agency_clients`, `shops.agency_id`) and **222_add_agency_invites** (`agency_invites`) applied.
- [ ] Set `STRIPE_PRICE_AGENCY_BASE` (recurring $999/mo) and `STRIPE_PRICE_AGENCY_EXTRA_CLIENT` (recurring $50/mo, licensed/quantity) in `backend/.env`.
- [ ] Stripe webhook forwarding live: `stripe listen --forward-to localhost:4000/api/shops/webhooks/stripe`.
- [ ] Pick a test shop to be the agency owner (e.g. `shop-101`), logged in with its wallet.

## 1. Self-serve activation

- [ ] As the owner shop → **Plans & Billing** → Agency card shows status **Not enabled** + **"Get Started"** button (not "Coming soon").
- [ ] Click Get Started → redirected to Stripe Checkout for **$999/mo**.
- [ ] Complete payment → redirected to `/shop?tab=agency`.
- [ ] Webhook fires → `agencies` row created with `status='active'`, `owner_shop_id`, `stripe_customer_id`, `stripe_subscription_id` populated.
- [ ] Reload Plans & Billing → Agency card now **Active** with **Manage** → `/shop?tab=agency`.
- [ ] Sidebar now shows the **Agency** nav item.
- [ ] **Abandon a checkout** (cancel on Stripe) → confirm **no** `agencies` row created (no orphan).
- [ ] Try activating again while already active → 400 "This shop already has an active agency".

## 2. Client onboarding (invite flow)

- [ ] Agency tab (`/shop?tab=agency`) → **Invite Client** → optional label → **Create invite link** → a link `…/register/shop?agency_invite=<token>` is shown with a **Copy link** button.
- [ ] The invite appears under **Pending Invites** (copy + revoke available); an `agency_invites` row exists with `status='pending'`.
- [ ] Open the invite link (incognito / different wallet) → the signup page shows the **"You're joining {Agency}"** banner.
- [ ] Complete the **standard shop signup** with a *new* wallet → shop is created, and on success is auto-linked: `shops.agency_id` set, `agency_clients` row `active`, invite `status='accepted'` with `used_by_shop_id`.
- [ ] New client shop is **active/verified** and appears in the agency **Client Shops** roster.
- [ ] **Revoke** a pending invite → it disappears from Pending Invites; opening that link no longer shows the banner and does **not** link the shop.
- [ ] Invalid / already-used / revoked token at signup → registration still succeeds, just **without** agency linking (never blocks signup).
- [ ] **Unlink** a client (trash icon) → confirm dialog → removed from roster; `agency_clients.status='removed'` and `shops.agency_id` cleared.
- [ ] Cancelled agency: an invite for a `cancelled` agency → `invite-info` returns `valid:false` and accepting it does not link.

## 3. Act-as-client (enter/exit)

- [ ] Roster → **Enter** a client → lands on that shop's dashboard; yellow **"managing a client shop"** banner shows.
- [ ] Operate as the client (view tabs) → scoped to that shop.
- [ ] **Exit to agency** → returns to `/shop?tab=agency` as the owner session.
- [ ] Attempt to enter a shop that is **not** your client (craft the request) → 404 "Shop is not a client of your agency".

## 4. Per-client metered billing

_"Adding a client" below = a client accepting an invite (or unlinking to remove). Each link/unlink triggers `reconcileClientBilling`._

- [ ] With `client_limit=10`: link clients up to 10 → Stripe subscription still has **only the base $999 item** (no extra-client item).
- [ ] Link an **11th** client → extra-client item appears with **quantity 1**; dashboard header shows "billed for 1 extra".
- [ ] Link a 12th → quantity **2** (plan acceptance: $999 + 2×$50).
- [ ] Unlink a client back to 11 → quantity decrements to **1**.
- [ ] Unlink down to ≤10 → extra-client item **deleted** from the subscription.
- [ ] Verify prorations appear on the Stripe subscription for mid-cycle link/unlink.
- [ ] **Best-effort check:** temporarily unset `STRIPE_PRICE_AGENCY_EXTRA_CLIENT` → link a client → link still succeeds (not blocked); log warns "skipping agency client metering".

## 5. Client entitlement (Growth without own subscription)

- [ ] On link, the client's `shops.operational_status` is set to **`subscription_qualified`** (agency coverage denormalized like RCG/subscriptions). Confirm in DB right after an invite is accepted.
- [ ] Open the client's dashboard → it is **operational** (no "Subscription Required" block), because the frontend `isOperational` gate reads `operational_status`.
- [ ] An agency client with **no subscription of its own** can perform a subscription-gated action (not paywalled).
- [ ] `getShopTier(clientShopId)` resolves to **growth**.
- [ ] Owner shop's **own** operational status is unaffected by agency activation (it still needs/keeps its own plan).
- [ ] On **unlink**, the client's `operational_status` reverts to **`not_qualified`** (dashboard shows "Subscription Required" again) — an admin `paused` shop is left untouched.

## 6. Lifecycle & cancellation gating (key correctness area)

- [ ] In Stripe, set the agency subscription to **past_due** → `agencies.status='past_due'`; client **still** entitled (grace window); client `operational_status` stays `subscription_qualified`.
- [ ] **Cancel** the agency subscription → webhook sets `agencies.status='cancelled'` **and cascades** every active client's `operational_status` to `not_qualified` (`setActiveClientsOperationalStatus`).
- [ ] Cancelled agency's client → **loses** Growth entitlement: `getShopTier` no longer returns growth, `subscriptionGuard` no longer bypasses the paywall, `SubscriptionEnforcementService` no longer reports "covered by agency", and the dashboard shows "Subscription Required".
- [ ] Reactivate the subscription → `status='active'` → clients cascade back to `subscription_qualified` and are entitled again.

## 7. Admin assigned view

- [ ] Provision/assign an agency with `account_manager_address` = an admin wallet (via admin `POST /api/agency`).
- [ ] Log in as that admin → **My Shops** tab → **"Agencies You Manage"** section lists the agency with client count (`N / limit`) and status.
- [ ] Admin with no assigned agencies → section shows "No agencies are assigned to you yet."
- [ ] Agency dashboard → **Your Account Manager** card shows the assigned AM's name/email/phone.

## 8. Marketing page

- [ ] `/agency` → all three **"Get Started"** CTAs route to `/shop?tab=plans`.
- [ ] "How it works" step 1 reads **"Activate — Subscribe … from your shop's Plans & Billing."**
- [ ] Unauthenticated visitor clicking Get Started → bounced to login/signup, then billing.

## 9. Regression / non-agency shops

- [ ] A normal shop (no agency) → Plans & Billing loads; `GET /agency/me` 404s silently; no Agency sidebar item; own subscription flow unchanged.
- [ ] A normal shop's Stripe subscription events still update its `operational_status` correctly (agency sync is a no-op for non-agency subs).

## Notes / known limits

- Billing sync is **best-effort** — a Stripe failure during add/remove logs an error but doesn't block client management (soft limit by design). There is no automatic retry/reconcile job yet, so a failed sync stays drifted until the next add/remove.
- The admin `POST /api/agency` backdoor still exists (creates a `pending` agency with no Stripe subscription) — intended for manual/invoice provisioning.
