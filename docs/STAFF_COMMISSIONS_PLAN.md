# Staff Commissions — Implementation Plan

**Status:** Slice 1 written, not yet applied to any database.
**Branch:** _not yet created_ (slice 1 file is uncommitted on `fix/manual-booking-location-selection` or `main` — check `git status`)
**Started:** 2026-07-10

Client requirement: *"a commission for team members if enabled by the shop owner."*

---

## Decisions (confirmed with the client)

| Decision | Choice | Consequence |
|---|---|---|
| Calculation | Percentage of the order amount | One numeric rate, no flat-fee path |
| Attribution | Explicit picker at completion, defaulting to the current user | Adds `service_orders.completed_by_member_id` |
| Payout | **Track and report only** — RepairCoin never moves money | No RCN, no Stripe Connect, no KYC. Shop pays via existing payroll |
| Rate scope | Shop default + per-member override | `shops.default_commission_percent`, `shop_team_members.commission_percent` (NULL = inherit) |
| Tier gate | Rides the existing `teamManagement` gate (Business) | You can't have staff to pay without it |

Assumed, not explicitly confirmed:

- **Owners and managers can earn commission**, not just the `staff` role. The picker lists all active members.
- **`commissions_enabled` defaults to `false`.** Nothing changes for any existing shop until an owner opts in.
- **No reversal in v1** (see "Why no reversal logic" below).

## RESOLVED — commission base is `final_amount_usd` (net)

**Decision (2026-07-13): commission is a percentage of `final_amount_usd`** — the post-RCN-discount amount the customer actually paid in fiat.

The gross-vs-net question was investigated: the plan's original lean toward gross rested on `shops.total_reimbursements` implying shops are reimbursed for redeemed RCN. That rationale is **invalid** — the `total_reimbursements` column exists (`shops`, default 0) but is *dormant*: it is only read and set-on-insert, and **nothing in the RCN redemption flow ever increments it** (`RcnRedemptionService` just reduces `final_amount_usd`; no reimbursement write anywhere). So there is no evidence shops recover the RCN discount, and the client chose to accrue commission on what the customer actually paid.

Consequence for the accrual: `base_amount = order.final_amount_usd` (which `mapOrderRow` already falls back to `total_amount` when null). Never use `total_amount` for the ledger base.

---

## Findings from the codebase (as of 2026-07-10)

These are why the plan is shaped the way it is. Re-verify if the code has moved.

**Commission is greenfield.** No commission/payout/earnings table, column, service, or route exists anywhere in backend or frontend. The word appears only in docs and `package-lock.json`.

**Orders had no staff attribution.** `service_orders` has `booked_by` (wallet of whoever *created* a manual booking, migration 066) and nothing recording who *did the work*. That is the missing link the whole feature hangs on.

**There are TWO completion call sites, not one:**
- `frontend/src/components/shop/tabs/ShopServiceOrdersTab.tsx:707` → uses `CompleteOrderModal`
- `frontend/src/components/shop/bookings/BookingsTabV2.tsx:468` → calls `updateOrderStatus(orderId, "completed")` **directly, no modal**, with optimistic UI

If only the modal gets the picker, half of all completions accrue to nobody. `BookingsTabV2` must adopt the modal. This is the largest chunk of frontend work in the plan.

**`CompleteOrderModal` is presentational only** (`frontend/src/components/shop/modals/CompleteOrderModal.tsx`). It collects nothing editable and does not call the API — the parent's `onConfirm` does.

**Staff cannot read the team roster.** `GET /api/shops/team` is guarded by `requireShopPermission('team:manage')`. Per `backend/src/domains/shop/permissions.ts:33-46`, only `owner` has it (via `'*'`); `manager` is explicitly filtered out at line 36 and `staff` never had it. But both manager and staff have `bookings:manage`, i.e. they can complete orders. **So the people the feature exists to pay would get a 403 populating the dropdown.** Hence a new `GET /api/shops/team/assignable` returning only `{id, name}` for active members, guarded by `authMiddleware + requireRole(['shop'])` and scoped to `req.user.shopId`.

Client accepted the tradeoff: staff can enumerate coworkers' names. The full record (emails, roles, permissions, and soon commission rates) stays behind `team:manage`.

Precedent for a non-`teamManage` route on that router: `GET /me` at `backend/src/domains/shop/routes/team.ts:69`.

**Why no reversal logic.** `completed` is terminal:
- `PaymentService.cancelOrder:1058` → "Cannot cancel a completed order"
- `OrderController.cancelOrderByShop:823` → same guard
- `markNoShow:911` → requires `status === 'paid'`
- No background job, admin route, or AI agent ever sets `completed` — the only writer is `OrderRepository.updateOrderStatus`

So an accrual, once written, cannot be invalidated by any refund path that currently exists. The `'voided'` status value is reserved in the CHECK constraint for the day someone adds a force-refund.

**Per-shop boolean pattern to copy:** `backend/src/domains/shop/routes/welcomeRcn.ts` (dedicated `GET`/`PUT` mini-endpoint) + `frontend/src/components/shop/WelcomeRcnSettings.tsx` slotted into `SettingsTab.tsx:855`. The `shops` table uses flat `*_enabled` boolean columns, not a JSON settings blob.

---

## Slices

One branch, one commit per slice.

### Slice 1 — Schema ✅ written, ⚠️ never executed

`backend/migrations/211_add_staff_commissions.sql`

- `shops`: `commissions_enabled BOOLEAN NOT NULL DEFAULT false`, `default_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0`
- `shop_team_members`: `commission_percent NUMERIC(5,2)` (NULL = inherit)
- `service_orders`: `completed_by_member_id UUID REFERENCES shop_team_members(id) ON DELETE SET NULL` + partial index
- `staff_commissions` ledger table

Three properties deliberately baked in:

1. **`base_amount` and `rate_percent` are snapshotted** onto each row — changing a member's rate later never rewrites what they already earned.
2. **`UNIQUE (order_id)`** makes accrual idempotent. A retried or double-clicked completion physically cannot pay twice; the DB refuses.
3. **`member_id` has no `ON DELETE` action** — payout history must survive. Safe because `removeMember` is a soft delete (`status='removed'`).

CHECK constraints use `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` because `ADD CONSTRAINT` has no `IF NOT EXISTS`, and the runner wraps each file in a transaction — an unguarded re-run would abort the whole migration.

**Verification status:** number 211 confirmed free both in the repo (`npm run db:check-migrations`) and on the live DB (`schema_migrations` max real version = 209; 210 is in-repo but unapplied). **The SQL has never been executed** — Docker daemon down, `psql` not on PATH, and `.env` points at DigitalOcean. Do not assume it parses.

To verify: start Docker Desktop, `docker-compose up postgres -d`, then apply `000_base_schema.sql` → `173_create_shop_team_members.sql` → `211`, and re-run 211 to prove idempotency.

### Slice 2 — Accrual on completion ✅ implemented (typecheck clean; not yet run against a DB)

- `OrderController.updateOrderStatus` accepts optional `completedByMemberId` in the body; validates it is `active` and belongs to `req.user.shopId` (400 otherwise). Default when omitted: `req.user.teamMemberId` for staff/managers, else the owner's own member row resolved via `getActiveMemberByWallet(req.user.address)`.
- New `OrderRepository.completeOrder(orderId, { completedByMemberId })` replaces the `updateOrderStatus(id, 'completed')` call for the completed status. It runs the status flip + accrual inside `withTransaction`.
- Accrual: when `shops.commissions_enabled`, the member is `active` and belongs to the order's shop, and the resolved rate > 0, it inserts a `staff_commissions` row with `base_amount = final_amount_usd` (falls back to `total_amount` when null), snapshotted `rate_percent`, and `amount = round(base * rate) / 100`. `ON CONFLICT (order_id) DO NOTHING` keeps it idempotent.
- Rate resolution: `member.commission_percent ?? shop.default_commission_percent`.
- Base is **net** (`final_amount_usd`) per the resolved decision above.

Still to verify: run migration 211 + exercise a completion end-to-end (blocked on the same DB access gap as slice 1).

### Slice 3 — Rate configuration ✅ implemented (backend typecheck clean; frontend files clean under tsc)

- New `backend/src/domains/shop/routes/commissions.ts` with `GET`/`PUT /settings` (toggle + default rate), copying `welcomeRcn.ts`. Mounted at `/api/shops/commissions` with `authMiddleware, requireRole(['shop']), requireShopPermission('shop:manage'), requireTier('teamManagement')`. (Mounted under `/commissions` so slice 5's reporting routes can share the same router prefix.)
- Per-member override rides `PUT /api/shops/team/:memberId`: `commissionPercent` added to `ShopTeamMember` interface, `mapRow`, the `updateMember` Pick union + set builder, `sanitizeMember`, and the route body (validates null-or-0..100).
- Frontend:
  - `frontend/src/services/api/commissions.ts` (get/update settings) + `commissionPercent` on `TeamMember`/`UpdateMemberInput` in `services/api/team.ts`.
  - `frontend/src/components/shop/CommissionSettings.tsx` (dark-themed toggle + default-rate panel).
  - **Placement deviates from the original plan:** the panel lives at the top of `TeamTab.tsx`, not `SettingsTab`. Rationale: `TeamTab` is already wrapped in `<TierGate feature="teamManagement">` (ShopDashboardClient.tsx:1705), matching the backend `requireTier` guard, and keeps default rate + per-member overrides co-located. A new SettingsTab tab would render for non-Business shops and need its own gating.
  - `TeamTab`: per-member rate field in the edit modal (edit mode + commissions enabled) and a "Commission" column showing the effective rate (override or `Default (X%)`), both shown only when commissions are enabled.

Not yet run against a DB — same gap as slices 1–2.

### Slice 4 — The picker ✅ implemented (backend typecheck clean; frontend files clean under tsc)

- New `GET /api/shops/team/assignable` (`team.ts`, guarded by `authMiddleware + requireRole(['shop'])` only). Returns `{ commissionsEnabled, currentMemberId, members: {id,name}[] }` for active members. It carries `commissionsEnabled` and `currentMemberId` **on purpose**: staff have `bookings:manage` but not `shop:manage`, so they'd 403 on the tier-gated `/commissions/settings` — the modal must learn the flag + default selection from this one staff-readable endpoint instead.
- `CompleteOrderModal` now fetches `/assignable` on mount and renders a "Performed by" select — **only when `commissionsEnabled`** — defaulting to `currentMemberId`. `onConfirm` changed to `(completedByMemberId?: string) => void`; the button calls a `handleConfirm` that passes the selection (or `undefined` when the picker is hidden). Fetch failure is non-blocking (order still completes, unattributed).
- `frontend/src/services/api/services.ts` `updateOrderStatus` gained an optional `completedByMemberId` arg.
- `ShopServiceOrdersTab.handleMarkComplete` accepts + forwards the member id.
- **`BookingsTabV2` adopted `CompleteOrderModal`**: `handleComplete` now just opens the modal; a new `performComplete(booking, memberId?)` holds the optimistic-update + API logic and passes the member id through. New `completeModalBooking` / `isCompleting` state.

Not yet run against a DB — same gap as slices 1–3.

### Slice 5 — Reporting ✅ implemented (backend typecheck clean; frontend files clean under tsc)

- `GET /api/shops/commissions?from&to&memberId&status` (added to `commissions.ts`) → `{ summary: per-member totals, rows: ledger rows }`. Date range is inclusive of the `to` day (`created_at < to::date + INTERVAL '1 day'`). Summary is computed in JS from the filtered rows.
- `POST /api/shops/commissions/mark-paid` → flips `accrued → paid` over `{from,to,memberId?}`, stamping `paid_at = NOW()`, `paid_by = req.user.address`, and optional `payout_note`. Returns `{ count, totalPaid }`.
- Frontend: `getCommissions` / `markCommissionsPaid` in `services/api/commissions.ts`; `frontend/src/components/shop/tabs/CommissionsTab.tsx` (filters, accrued/paid tiles, per-member summary + detail tables, "Mark accrued as paid").
- Wiring: `commissions: "shop:manage"` added to `config/shopTabPermissions.ts`; a "Commissions" item (Percent icon) after Team in `ShopSidebar.tsx`; content block in `ShopDashboardClient.tsx` behind `<SubscriptionGuard>` + `<TierGate feature="teamManagement">` (mirrors the Team tab).

**Member filter dropdown uses `/assignable`, not `getTeamMembers`** — a `manager` has `shop:manage` (so can open this tab) but not `team:manage`, so `getTeamMembers` would 403 for them.

### Slice 6 — Staff self-view (transparency) ✅ implemented

Added after the fact so a staff member can see their own commission (the reporting tab is `shop:manage`-only, so staff had no visibility).

- Backend: `GET /api/shops/team/my-commissions?from&to` on `team.ts` (auth + shop role only, like `/me` / `/assignable`). Strictly self-scoped to the caller's own member id (`teamMemberId`, or owner-by-wallet) → `{ commissionsEnabled, summary:{accrued,paid,total,count}, rows }`. Never widens access to other members or to mark-paid.
- Frontend: `getMyCommissions` in `services/api/commissions.ts`; `frontend/src/components/shop/tabs/MyCommissionsTab.tsx` (read-only: date filter, own accrued/paid tiles, own rows — no member dropdown, no mark-paid).
- Gating: `shopTabPermissions.commissions` changed `shop:manage` → **`bookings:manage`** so anyone who can complete orders sees the tab; `ShopDashboardClient` branches the content `hasPermission('shop:manage') ? <CommissionsTab/> : <MyCommissionsTab/>`.

---

## Overall status (2026-07-13)

All 5 slices are implemented on branch `feat/staff-commissions` (uncommitted). Backend `npm run typecheck` clean; every changed frontend file is error-free under `tsc` (repo has ~211 pre-existing unrelated tsc errors). **The feature has never run against a database** — migration 212 unapplied (verified absent on staging), no accrual ever written. Run `docs/STAFF_COMMISSIONS_QA.md` once a DB is reachable before shipping.

**Migration gate (2026-07-13):** `npm run db:migrate` (which `.env` points at the shared DigitalOcean *staging* DB) was blocked by a false-positive collision — staging recorded migrations 206–209 with the full `NNN_` filename prefix, which `extractName()` strips, so the names mismatched. Their schema is verified present (benign name-format drift), so 206–209 were added to `KNOWN_DRIFT` in `backend/scripts/run-migrations.ts`. 210, 211, 212 are all still pending on staging.

---

## QA plan

No new env vars, no Stripe or wallet dependencies — that's the payoff of track-and-report.

On a Business-tier shop:
1. Enable commissions, set default 10%, override one member to 15%.
2. Complete an order from `ShopServiceOrdersTab` **and** another from `BookingsTabV2`. Both must accrue.
3. Confirm two ledger rows at the correct respective rates.
4. Retry a completion → confirm `UNIQUE (order_id)` holds and nothing double-pays.
5. Mark a period paid → rows flip to `paid` with `paid_by` stamped.
6. Log in as a `staff` member and complete an order → the dropdown must populate (this is the 403 regression to watch).

Negative cases:
- Non-Business shop: no picker, no accrual, `requireTier` returns 403.
- Business shop with `commissions_enabled = false`: no picker, no accrual.
- Member with `commission_percent = 0`: no ledger row (rate > 0 check).
