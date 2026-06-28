# QA Guide — Square→FixFlow Migration Loop

Covers the two features that make up the migration loop:
1. **Imported-customer win-back campaign** (`imported_winback` audience in the AI Marketing panel)
2. **Welcome RCN on claim** (one-time reward granted when an imported customer claims)

The loop: the **campaign drives the claim → the claim grants the RCN**. Test them in that order.

Environment: staging (the `.env` DB points at DigitalOcean). Shop **peanut** is the reference
shop. Backend `PORT=3002`.

---

## 0. Prerequisites & setup

**Flags / env (backend `.env`):**
- `ENABLE_WELCOME_RCN=true` — required for the welcome-RCN grant + the AI to mention the real
  amount. (The win-back *audience* itself needs no flag.)
- `WELCOME_RCN_DEFAULT_AMOUNT=25` — optional; defaults to 25 if unset.
- Restart the backend after changing env.

**Seed imported customers** (if peanut has none):
- Admin → Customers → Import → upload a small Square-style CSV, choosing **Import into shop:
  peanut**. Use a mix: some rows **with email**, some **phone-only** (no email), so you can see
  the reachable-by-email ceiling. (Sample: `C:/dev/square-sample.csv`.)
- Confirm they appear in Admin → grouped-by-shop under peanut with an **"Imported"** badge, and
  in peanut's **My Customers**.

**DB spot-check (imported cohort exists):**
```sql
SELECT address, email, import_source, home_shop_id, welcome_rcn_granted_at
FROM customers WHERE LOWER(home_shop_id)='peanut' AND import_source IS NOT NULL;
```

---

## 1. Win-back campaign — audience resolution

Open the **shop AI Marketing panel** as peanut.

| # | Type this | Expect |
|---|-----------|--------|
| 1.1 | "win back my Square customers" | Audience card: "Imported customers to win back (not yet on FixFlow)"; count = imported-not-converted. |
| 1.2 | (same) | If some imports have no email: amber line **"X of Y reachable by email — the rest have no email on file"**. |
| 1.3 | "imported customers who haven't claimed" | Resolves to the **not_claimed** stage (placeholder wallets only). |
| 1.4 | "square customers who claimed but haven't booked" | Resolves to **claimed_not_booked**. |
| 1.5 | "win back lapsed customers" (no migration word) | Resolves to the **lapsed** audience, NOT imported — proves precedence is correct. |

**Pass:** migration phrasings hit `imported_winback` with the right funnel stage; true-lapsed
phrasing is untouched; reachable-by-email shows only when some recipients lack email.

## 2. Win-back campaign — drafted copy

1. After 1.1, let the AI draft the campaign (or say "draft it").
2. **Pass:** copy is **migration framing** — "we've upgraded our booking & rewards", "claim your
   account, history preserved" — NOT "we miss you / it's been a while" lapsed copy.
3. With `ENABLE_WELCOME_RCN=true` **and** peanut's welcome reward enabled (see §3), the draft
   should reference the **real amount** ("claim your account and get 25 RCN"), not a placeholder.
   With the reward off, it uses `(your welcome reward here)`.

## 3. Welcome RCN — shop settings UI

Shop dashboard → **Settings → Customer Rewards** (Gift icon).

| # | Action | Expect |
|---|--------|--------|
| 3.1 | Load the tab | Toggle off by default; amount field placeholder "Default: 25 RCN". |
| 3.2 | If `ENABLE_WELCOME_RCN` is **off** | Amber note: rewards not enabled on the platform yet; controls disabled. |
| 3.3 | Toggle on, leave amount blank, Save | Saves; "each claim grants **25 RCN** (≈ $2.50)". |
| 3.4 | Set amount = 40, Save | "each claim grants **40 RCN** (≈ $4.00)". |
| 3.5 | Clear amount, Save | Falls back to 25 (default). |
| 3.6 | Reload page | Settings persist. Save button disabled until a change is made. |

**DB check:**
```sql
SELECT welcome_rcn_enabled, welcome_rcn_amount FROM shops WHERE shop_id='peanut';
```

## 4. Welcome RCN — the grant on claim (core)

Precondition: `ENABLE_WELCOME_RCN=true`, peanut welcome reward **on**, peanut
`purchased_rcn_balance` ≥ the amount. Pick an imported placeholder with a known email/phone.

1. As a **real customer account** (matching the placeholder's email or phone), run the claim
   flow (`POST /api/customers/claim` with the placeholder address) — the same flow as account
   signup claim.
2. **Response** includes `welcomeRcnGranted: 25` (or the configured amount).
3. **Customer balance** increased by the amount:
   ```sql
   SELECT current_rcn_balance, welcome_rcn_granted_at FROM customers WHERE LOWER(address)=LOWER('<realAddr>');
   ```
4. **Provenance row** exists:
   ```sql
   SELECT amount, source_type, source_shop_id FROM customer_rcn_sources
   WHERE LOWER(customer_address)=LOWER('<realAddr>') AND source_type='migration_welcome';
   ```
5. **Shop debited**: peanut `purchased_rcn_balance` dropped by the amount.
6. **Notification**: a `welcome_rcn` notification exists for the customer; appears in their bell.

## 5. Welcome RCN — guards & edge cases (must all hold)

| # | Scenario | Expect |
|---|----------|--------|
| 5.1 | Claim again / claim a second placeholder for the same customer | `welcomeRcnGranted: 0` — one grant per customer, EVER (`welcome_rcn_granted_at` guard). |
| 5.2 | Claim a **non-imported** placeholder (no `import_source`) | No grant; claim still succeeds. |
| 5.3 | Shop **opted out** (`welcome_rcn_enabled=false`) | No grant; **claim still succeeds**, no error. |
| 5.4 | Shop **insufficient balance** (`purchased_rcn_balance` < amount) | No grant; claim still succeeds. |
| 5.5 | `ENABLE_WELCOME_RCN=false` | No grant under any shop setting. |
| 5.6 | Force a grant failure (e.g. temporarily break the source insert) | Claim still COMMITS (orders/history transferred); only the grant is rolled back (SAVEPOINT). |
| 5.7 | Notification insert fails | Grant + claim still persist (notification is post-commit, best-effort). |

**Pass:** the claim is never blocked or rolled back by a missing/failed grant; the grant is
exactly-once and imported-only.

## 6. Regression checks

- Normal (non-migration) campaigns still resolve correctly: "top 50 spenders", "all customers",
  "lapsed 90 days" behave as before.
- A normal account-signup claim (placeholder created via manual booking, not imported) still
  merges orders/history correctly and grants nothing.
- Imported customers now appear in the **all-customers** and **lapsed** audiences too (the
  underlying `home_shop_id` audience fix), not just `imported_winback`.

## 7. Cleanup

- Delete any seeded test customers/orders for peanut.
- Reset peanut: `welcome_rcn_enabled=false`, `welcome_rcn_amount=NULL` (unless leaving on for
  demo), and restore `purchased_rcn_balance` if you topped it up for testing.
- The `welcome_rcn_granted_at` on test customers will block re-grants — delete the test
  customer rows rather than trying to re-test on the same account.

---

## Appendix — what each piece touches

- **Audience:** `CustomerRepository.findImportedCustomers` / `findByShopInteraction` /
  `findLapsedBookers`; `MarketingService.resolveTargetAudience` (`imported_winback` case).
- **AI resolution/copy:** `lookupAudienceCount.ts` (resolve + reachable-by-email),
  `promptBuilder.ts` (Rule 11 + welcome amount), `contextBuilder.ts` (amount lookup),
  `proposeCampaignDraft.ts`.
- **Grant:** `AccountClaimController.claimAccount` (SAVEPOINT grant + post-commit notify).
- **Settings:** `shop/routes/welcomeRcn.ts`, `WelcomeRcnSettings.tsx`,
  `services/api/welcomeRcn.ts`.
- **Schema/config:** migration `185`, `config/welcomeRcn.ts`, flag `ENABLE_WELCOME_RCN`.
