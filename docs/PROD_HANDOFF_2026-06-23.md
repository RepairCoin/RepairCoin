# Production Handoff — June 23, 2026

Two production tasks carried over from the staging work. Both need **production
access** (DB credentials / DigitalOcean dashboard) that isn't in the repo, so
they're handed off to whoever owns prod DB + infra.

Both were already completed and verified on **staging**.

---

## Task 1 — Backfill RCG shop tiers (data fix)

### What's wrong
Seed data set every shop's `rcg_tier` to uppercase `'STANDARD'` regardless of its
actual `rcg_balance`. Backend code expects **lowercase** tiers
(`none` / `standard` / `premium` / `elite`) and derives **RCN pricing + tier
benefits + analytics** from them — so the wrong label silently breaks pricing and
benefits for real shops.

On staging this affected ~all shops; the backfill corrected **59 shops**.

### How to fix (production)
Run the prepared script: **`backend/scripts/prod_tier_backfill.sql`**

1. **Step 1 (read-only diagnostic)** — run as-is; lists every shop whose stored
   tier differs from what its balance implies. Review the output.
2. **Step 2 (backfill)** — uncomment the `UPDATE` and run. Recomputes `rcg_tier`
   from `rcg_balance` for mismatched shops.
3. **Step 3 (verify)** — run the `GROUP BY` to confirm the final distribution.

```bash
psql "<PROD_DATABASE_URL>" -f backend/scripts/prod_tier_backfill.sql
# or paste into the DigitalOcean DB console
```

### Safety
- Touches **only `rcg_tier`** (the label). Does **not** change
  `operational_status`, so **no shop's access/qualification changes**.
- The diagnostic is read-only; the backfill is idempotent (re-running is a no-op).

### Note on a related symptom
A shop ("Subscription Expired" banner despite being qualified) was traced to
**stale browser cache**, not a server bug — the server data was already correct
after `operational_status` self-healed. A hard refresh clears it. No prod action
needed for that specifically; the tier backfill above is the real fix.

---

## Task 2 — Set `ENABLE_BLOCKCHAIN_MINTING=false` on production

### Why
The blockchain-removal work runs the platform in **database-only mode** via this
flag. Staging is set (`.do/app.yaml`). **Production was never configured** — the
prod app spec (`backend/.do/app.yaml`) didn't define the var at all, so prod's
behavior depends entirely on the DigitalOcean dashboard env var.

Until it's set to `false` in prod, the new UI hiding + treasury fixes won't apply
there and prod may still attempt on-chain calls.

### How to fix (production)
1. DigitalOcean → App Platform → **`repaircoin-backend`** → Settings →
   the **`api`** component → Environment Variables.
2. Add / set: `ENABLE_BLOCKCHAIN_MINTING` = `false`
3. Redeploy the component.

> The committed prod spec now also includes this var (added June 23), but the
> **dashboard value is authoritative** — set it there to be sure.

### Verify
After redeploy, `GET https://<prod-api>/api/config` should return
`{ "data": { "blockchainEnabled": false } }`.

---

## Contacts / status
- Prepared by: Zeff
- Staging: ✅ both done & verified (June 22)
- Production: ⏳ awaiting DB/infra owner
