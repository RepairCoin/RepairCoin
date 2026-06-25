# Shop Team Management & Permissions — Implementation Plan

**Status:** Proposed
**Scope:** Multi-user access for shops with role-based, granular permissions and an email-based invitation flow.
**Out of scope (this plan):** Multi-location scoping of team members (deferred to the multi-location feature).

---

## 1. Problem & Goal

Today a shop is **one wallet = one login = full access**. There is no way to give an employee (front-desk, technician, manager) their own login with a limited set of capabilities.

**Goal:** Let a shop owner invite team members by email, assign each a role with a granular permission set, and have the backend + frontend enforce those permissions — without changing anything for existing single-owner shops.

## 2. Reuse the existing precedent

The platform **already has** this exact pattern for platform admins:

- `admins` table: `role VARCHAR` + `permissions JSONB` (array of strings, `'*'` = all).
- `requirePermission(permission)` middleware in `backend/src/middleware/permissions.ts`.

We mirror this for shops rather than inventing a new model.

## 3. Data Model

### New table: `shop_team_members`

```sql
CREATE TABLE shop_team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         VARCHAR(100) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  wallet_address  VARCHAR(42),                 -- NULL until invite accepted
  email           VARCHAR(255) NOT NULL,
  name            VARCHAR(255),
  role            VARCHAR(50)  NOT NULL DEFAULT 'staff', -- owner | manager | staff | custom
  permissions     JSONB        NOT NULL DEFAULT '[]',    -- ['inventory:manage', ...] or ['*']
  status          VARCHAR(20)  NOT NULL DEFAULT 'invited',-- invited | active | suspended | removed
  invite_token    VARCHAR(255),                -- one-time accept token (hashed)
  invite_expires_at TIMESTAMP,
  invited_by      VARCHAR(42),                 -- owner/admin wallet
  invited_at      TIMESTAMP DEFAULT NOW(),
  accepted_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT uq_shop_member_wallet UNIQUE (shop_id, wallet_address),
  CONSTRAINT uq_shop_member_email  UNIQUE (shop_id, email),
  CONSTRAINT chk_member_role   CHECK (role IN ('owner','manager','staff','custom')),
  CONSTRAINT chk_member_status CHECK (status IN ('invited','active','suspended','removed'))
);

CREATE INDEX idx_shop_team_members_shop_id ON shop_team_members(shop_id);
CREATE INDEX idx_shop_team_members_wallet  ON shop_team_members(wallet_address)
  WHERE wallet_address IS NOT NULL;
```

Notes:
- `wallet_address` is **lowercased** everywhere, like all other wallet handling.
- The owner is represented as a row with `role='owner'`, `permissions=['*']`, `status='active'`.
- One person can be a member of multiple shops (separate rows); identity is still their wallet.

### Backfill existing shops

For every existing `shops` row, insert one owner member:
```sql
INSERT INTO shop_team_members (shop_id, wallet_address, email, name, role, permissions, status, accepted_at)
SELECT shop_id, LOWER(wallet_address), email,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name),
       'owner', '["*"]'::jsonb, 'active', NOW()
FROM shops
ON CONFLICT (shop_id, wallet_address) DO NOTHING;
```

## 4. Permission Taxonomy

Shop-scoped permission strings (string array on each member, `'*'` = all):

| Permission           | Gates |
|----------------------|-------|
| `inventory:view`     | View inventory items, stock, adjustments |
| `inventory:manage`   | Create/edit/delete items, adjust stock |
| `pos:view`           | View purchase orders |
| `pos:manage`         | Create/receive/cancel purchase orders |
| `services:manage`    | Create/edit/delete marketplace services |
| `bookings:view`      | View appointments/orders |
| `bookings:manage`    | Complete/cancel/modify bookings |
| `rewards:issue`      | Issue RCN rewards to customers |
| `rewards:redeem`     | Process redemptions |
| `customers:view`     | Customer lookup |
| `analytics:view`     | Shop analytics dashboards |
| `billing:manage`     | Subscription, RCN purchases, payment methods |
| `team:manage`        | Invite/edit/remove team members |

### Role templates (seed defaults; still overridable per member)

| Role     | Permissions |
|----------|-------------|
| `owner`  | `['*']` |
| `manager`| everything **except** `billing:manage`, `team:manage` |
| `staff`  | `inventory:view`, `bookings:view`, `bookings:manage`, `rewards:issue`, `rewards:redeem`, `customers:view` |
| `custom` | exactly what the owner checks off |

Templates live in code (single source of truth), e.g. `backend/src/domains/shop/permissions.ts`:
```ts
export const SHOP_PERMISSIONS = [/* all strings above */] as const;
export const ROLE_TEMPLATES: Record<string, string[]> = { owner: ['*'], manager: [...], staff: [...] };
```

## 5. Authentication Changes

### 5.1 Login resolution (`backend/src/routes/auth.ts`)
Current: shop login resolves via `getShopByWallet(address)` **with an existing email fallback** (`getShopByEmail`) so social/embedded-wallet logins work. This wallet-then-email pattern is **duplicated across at least four entry points** in `auth.ts` (the `/login` token issue ~line 235, `/check-user` ~line 473 and ~865, and the shop-specific login ~line 1274).

> ⚠️ **Refinement (implementation risk):** Do **not** patch team-member lookup into one of these by hand — extract a single `resolveShopUser(address, email)` helper and route all four call sites through it. Otherwise a staff member will be able to log in through one endpoint but not another. This is the single biggest correctness risk in the whole feature.

New resolution order inside that shared helper:
1. `getShopByWallet(address)` → if found, this is the **owner** (permissions `['*']`).
2. Else `shop_team_members WHERE LOWER(wallet_address)=? AND status='active'` → resolve `shopId`, `role`, `permissions` from that row.
3. Else **email fallback** (mirrors the existing shop behavior): `shop_team_members WHERE LOWER(email)=? AND status='active'` — covers a staff member whose embedded wallet hasn't been written yet or who signs in via social before the wallet row is set. (Thirdweb returns a *deterministic* wallet per email, so step 2 normally hits after the first accept; step 3 is the safety net, identical in spirit to `getShopByEmail`.)
4. Else → not a shop user (fall through to customer/admin checks as today).

### 5.2 JWT payload (`backend/src/middleware/auth.ts`)
Extend `BaseJWTPayload`:
```ts
interface BaseJWTPayload {
  address: string;
  role: 'admin' | 'shop' | 'customer';
  shopId?: string;
  permissions?: string[];   // NEW — shop members only
  teamMemberId?: string;    // NEW — optional, for auditing
  // ...
}
```
`req.user` gains `permissions`. **Backward compatibility:** a `shop` token with no `permissions` is treated as owner = `['*']` (so old sessions and the migration window keep full access).

### 5.3 New middleware `requireShopPermission(permission)`
Add alongside the admin one (in `permissions.ts` or a new `shopPermissions.ts`):
```ts
export const requireShopPermission = (permission: string) =>
  (req, res, next) => {
    const u = req.user;
    if (u?.role === 'admin') return next();                 // admins bypass
    const perms = u?.permissions ?? ['*'];                  // legacy owner default
    if (perms.includes('*') || perms.includes(permission)) return next();
    return res.status(403).json({ error: 'Insufficient permissions', required: permission });
  };
```
`requireShopOwnership` is unchanged (members carry the same `shopId`, so it still passes).

## 6. Invitation Flow (email-based via Thirdweb embedded wallet)

> **Why email/embedded wallet (decided):** This is **not** a new auth path — it is the one shops already use. Shop login in `auth.ts` already resolves by wallet *and* falls back to email for social/embedded-wallet sign-in, tracking the connecting embedded wallet separately. Staff acceptance reuses that exact mechanism: invitee signs in with email → Thirdweb mints (deterministically) an embedded wallet → we persist that wallet on the member row. Requiring staff to bring an external wallet (MetaMask) would be *more* work and higher friction than the path the system already supports.


1. **Invite** — owner submits `{ email, name, role | custom permissions }` →
   create `shop_team_members` row, `status='invited'`, random `invite_token` (store hashed), 7-day expiry →
   send email via the existing **Resend** service (`ResendEmailService` / `CampaignEmailService`) with an accept link `…/team/accept?token=…`.
2. **Accept** — invitee opens the link, signs in with **email** (Thirdweb generates an embedded wallet — no crypto knowledge needed) →
   `POST /api/shops/team/accept` with `{ token, walletAddress }` →
   validate token + expiry, set `wallet_address=LOWER(...)`, `status='active'`, `accepted_at=NOW()`, clear token.
3. **Login thereafter** — resolves via the team-member lookup in §5.1.

## 7. Backend Endpoints (under ShopDomain, `/api/shops/team`)

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| GET    | `/api/shops/:shopId/team` | `team:manage` | List members |
| POST   | `/api/shops/:shopId/team/invite` | `team:manage` | Invite by email |
| PUT    | `/api/shops/:shopId/team/:memberId` | `team:manage` | Change role/permissions |
| POST   | `/api/shops/:shopId/team/:memberId/suspend` | `team:manage` | Suspend |
| DELETE | `/api/shops/:shopId/team/:memberId` | `team:manage` | Remove (status='removed') |
| POST   | `/api/shops/team/accept` | public (token) | Accept invite |
| GET    | `/api/shops/team/me` | authed | Current member's role + permissions |

Guards: `team:manage` actions also block removing/suspending the last `owner`.

New files:
- `backend/migrations/13X_create_shop_team_members.sql`
- `backend/src/repositories/ShopTeamRepository.ts`
- `backend/src/domains/shop/permissions.ts`
- `backend/src/domains/shop/controllers/teamController.ts`
- team routes wired into `backend/src/domains/shop/routes/index.ts`

## 8. Frontend

- `authStore.ts`: add `permissions: string[]` to the profile + a `hasPermission(perm)` selector. Owners default to `['*']`.
- Replace pure-role UI gating with permission checks (hide menu items/actions the member lacks).
- New **Team** page `frontend/src/app/shop/team/page.tsx` (gated by `team:manage`): member list, invite modal (email + role picker + custom permission checkboxes), edit/suspend/remove.
- Invite **accept** page `frontend/src/app/team/accept/page.tsx`: Thirdweb email sign-in → calls accept endpoint.
- `frontend/src/services/api/team.ts`: API client for the endpoints above.
- Use shadcn components for the table, modal, and permission checklist (per project guideline).

## 9. Phased Delivery

### Phase 1 — Foundation (no user-facing change)
- Migration `shop_team_members` + backfill owners for all existing shops.
- `ShopTeamRepository` (CRUD) + `permissions.ts` (taxonomy + role templates).
- Auto-seed an `owner` member inside `createShop()` (alongside existing default-config seeding).
- **Deliverable:** every shop has an owner member row; behavior unchanged. ✅ verifiable by query.

### Phase 2 — Auth & enforcement
- Extend login resolution (owner + team-member lookup).
- JWT carries `permissions`; `req.user.permissions` populated; legacy default `['*']`.
- `requireShopPermission` middleware; apply across inventory, PO, services, rewards, billing, team routes.
- **Deliverable:** a manually-seeded `active` staff wallet can log in and is correctly allowed/denied per permission. ✅ testable before any UI.

### Phase 3 — Invitations & Team UI
- Invite + accept endpoints; Resend email template; token handling.
- Team management page + invite/accept flows + `hasPermission` gating in the frontend.
- Guard against removing the last owner.
- **Deliverable:** owner self-serve invites staff by email; staff sign in via Thirdweb embedded wallet with scoped access. ✅ end-to-end.

## 10. Testing

- **Repository/unit:** role-template expansion, last-owner guard, token expiry, wallet lowercasing.
- **Middleware:** `requireShopPermission` allow/deny matrix incl. `'*'`, admin bypass, legacy-no-permissions owner.
- **Auth integration:** owner login vs team-member login resolves correct `shopId` + permissions; suspended/removed members are rejected.
- **E2E:** invite → email → accept → login → permission-gated action.

## 11. Risks / Decisions Settled

- **Staff identity:** email-based Thirdweb embedded wallet (no external wallet needed). ✅ decided — and confirmed as the *lowest-risk* option because it reuses the shop login's existing wallet-then-email resolution (see §6). External-wallet-only was rejected as higher friction.
- **Shop resolution is duplicated in `auth.ts` (~4 sites):** must be centralized into one `resolveShopUser()` helper before adding team-member lookup, or staff will authenticate inconsistently across endpoints. ✅ flagged as the top implementation risk (see §5.1).
- **Backward compatibility:** legacy `shop` tokens without `permissions` ⇒ treated as owner `['*']` so nothing breaks during rollout. ✅
- **Open later (with multi-location):** restricting a member to specific locations via `location_ids` — intentionally excluded here.
