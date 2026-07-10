# Ops Runbook — Enable AI Features & Verify Deploy

**Audience:** Whoever manages the RepairCoin DigitalOcean App Platform deployment
**Last updated:** June 29, 2026
**Scope:** Turn on the 5 admin AI features in staging/prod, and verify the blockchain-UI hiding is live.

---

## Background

The backend AI features and the frontend "hide blockchain UI in database-only mode" logic are **already built, merged to `main`, and deployed**. What remains is **configuration only**:

1. The AI features have **no API keys in staging/prod**, so they run in template/fallback mode instead of real AI.
2. The frontend hiding logic just needs the latest build deployed.

Nothing in this runbook requires code changes.

---

## A. Enable the AI features (backend)

The 5 admin AI features depend on two API keys:

| Key | Powers |
|-----|--------|
| `ANTHROPIC_API_KEY` | Platform Copilot, Executive Briefing, Fraud reasoning, Shop AI Screening, Support Triage |
| `OPENAI_API_KEY` | Content Moderation scanning |

> ⚠️ These are **secrets** — do **not** commit them to the repo (`app.yaml`, `.env.staging`, etc.). They are intentionally kept out of source control. Set them as encrypted environment variables in DigitalOcean.

### Steps

1. Go to **DigitalOcean → Apps → (RepairCoin app)**.
2. Open **Settings → Components → `backend`**.
3. Under **Environment Variables**, add:
   ```
   ANTHROPIC_API_KEY = <your Claude key>        # Type: SECRET (encrypted)
   OPENAI_API_KEY    = <your OpenAI key>        # Type: SECRET (encrypted)
   ```
   - Set the **Type** to **SECRET / Encrypted** for each.
4. Click **Save** — this triggers a redeploy of the backend component.
5. Repeat for **both the staging app and the production app**.

### Verify

After the backend redeploys, open the **Admin dashboard** and confirm real AI output (not generic templates) in:
- Platform Copilot panel (ask it a question about the platform)
- Executive Briefing
- Trust & Safety / Fraud tab → "Run scan now"
- Shop review modal → AI Screening card
- Support tab → AI triage

If they still show templated/generic responses, the keys aren't being read — double-check the variable **names** match exactly and that the redeploy completed.

---

## B. Verify the blockchain-UI hiding (frontend)

The platform runs in **database-only mode** (`ENABLE_BLOCKCHAIN_MINTING=false`). The frontend reads the public `GET /api/config` endpoint and hides all blockchain-only UI. This is already coded and fail-closed (hidden by default).

### Verify

1. Make sure the **frontend** is deployed from the latest `main`.
2. Load the **customer dashboard** and **shop dashboard** and confirm these are **hidden**:
   - Customer: **Mint to Wallet** button
   - Admin: **Bulk Mint**, **Manual Transfer**, **RCG Transfer** page
   - Shop: **Stake RCG** nav/tab, **RCG OTC** page, crypto (Thirdweb) payment option, "Buy RCG" buttons
3. Confirm these **still work** (they are DB-backed, not blockchain):
   - Wallet login / connect
   - Stripe RCN purchase
   - RCG tier & balance display

### Quick backend sanity check

```bash
curl -s https://api.repaircoin.ai/api/config
# Expected: {"success":true,"data":{"blockchainEnabled":false}}
```

If `blockchainEnabled` is `false`, the UI should hide blockchain features. If a control is still showing, the frontend deploy is stale — redeploy the frontend and hard-refresh.

---

## C. Migration 189 (admin dedup) — automatic

`backend/migrations/189_dedup_admins_unique_wallet.sql` runs **automatically on the next backend deploy** (via the migration hook). It:
- Removes duplicate admin rows (keeps the oldest per wallet), and
- Adds a unique index so duplicate admins can't be created again.

No manual action needed — just confirm the backend has deployed since June 29. To verify:
```sql
-- should return 0 rows
SELECT LOWER(wallet_address), COUNT(*) FROM admins GROUP BY 1 HAVING COUNT(*) > 1;
-- should exist
\di uq_admins_wallet_lower
```

---

## Summary checklist

- [ ] Add `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` as SECRET env vars to **staging** backend → redeploy
- [ ] Add `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` as SECRET env vars to **production** backend → redeploy
- [ ] Verify AI features return real output in the admin dashboard
- [ ] Confirm frontend is on latest `main`; verify blockchain UI is hidden
- [ ] Confirm backend deployed since June 29 (Migration 189 applied — no duplicate admins)
