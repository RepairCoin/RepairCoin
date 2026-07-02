# Duplicate & Drifted Migration Cleanup — Scope

**Date:** 2026-07-02
**Status:** Scoping (no code changes yet)
**Owner:** TBD
**Related:** `backend/scripts/run-migrations.ts`, `backend/scripts/check-migration-numbers.js`, `backend/scripts/audit-prod-migrations.sql`, prior `record-and-verify-migration-117/132.ts`, `realign-schema-migrations-118-120.ts`

---

## TL;DR

The migrations directory has **two files sharing number 117** and a **cascade of version drift around 117→118** left over from an old `114→118` renumber. The runner keys on `schema_migrations.version` (integer PK) and applies only the **first** file it sees for a given number — every other file with that number is silently treated as "already applied" and **its SQL never runs**.

**On staging, this has caused no data loss** — every object from every affected file already exists (verified live, table below), because the skipped files' schema was backfilled by later re-runs / the `ensureCriticalSchema` safety net / the one-off `record-and-verify-*` scripts.

So this is **not an incident** — it's **latent tech debt + an unverified-prod risk**:
1. **Unverified prod (the only real risk):** we can only confirm staging from here. Prod may or may not have the same backfills. **Must audit prod read-only.**
2. **Repo hygiene:** the runner's "first-file-wins" is order-fragile, and the collision gate must carry a growing `GRANDFATHERED_DUP_FILES` + `KNOWN_DRIFT` allowlist. Renumbering the duplicates to unique numbers lets us shrink those exceptions.

**Recommendation:** do **Track 1 (prod audit + backfill if needed)** now — it's the safety-critical part and low effort. Treat **Track 2 (renumber for hygiene)** as optional follow-up, only if we want to retire the allowlists.

---

## How the runner works (why files get skipped)

`backend/scripts/run-migrations.ts`:
- `schema_migrations (version INTEGER PRIMARY KEY, name, applied_at)`.
- Files sorted by numeric version; **pending = files whose version is not already in `schema_migrations`**.
- For a duplicate number, once the first file records that version, the others are seen as applied → skipped (`isApplied(version)` → `continue`). Their SQL never executes.
- A **collision gate** (`assertNoNumberCollisions`) hard-stops a deploy when a file's number is recorded in the DB under a *different* name — **except** files in `GRANDFATHERED_DUP_FILES` and versions in `KNOWN_DRIFT`, which are exempted. The 7 files below are all already grandfathered, which is why deploys still pass.

Implication: renumbering a previously-skipped file to a **new free number** makes the runner treat it as pending and **re-run it** on the next deploy — so those files **must be fully idempotent first** (see Gotchas).

---

## Findings (verified live against staging, 2026-07-02)

`schema_migrations` recorded names: `95=create_calendar_integration`, `117=add_human_reply_baseline_to_ai_shop_settings`, `118=create_inventory_v2_enhancements`, `132=fix_purchase_order_number_uniqueness`.

| # | File | Ran? (recorded) | Objects it creates | Present on **staging**? |
|---|------|-----------------|--------------------|--------------------------|
| 095 | `095_create_calendar_integration.sql` | ✅ recorded as v95 | `shop_calendar_connections` table | ✅ |
| 095 | `095_add_category_check_constraint.sql` | ⏭️ skipped | `chk_service_category` constraint + `shop_services.category NOT NULL` | ✅ (backfilled) |
| 117 | `117_add_human_reply_baseline_to_ai_shop_settings.sql` | ✅ recorded as v117 | `ai_shop_settings.human_reply_baseline_minutes` + range check | ✅ |
| 117 | `117_create_inventory_v2_enhancements.sql` | ✅ recorded as **v118** (drift) | `service_inventory_items`, `purchase_orders`, alert settings | ✅ |
| 118 | `118_create_po_suggestions_system.sql` | ⚠️ v118 slot taken by inventory (drift) | `purchase_order_suggestions` table | ✅ (backfilled) |
| 132 | `132_fix_purchase_order_number_uniqueness.sql` | ✅ recorded as v132 | `unique_shop_po_number` (drops old global `purchase_orders_po_number_key`) | ✅ (old constraint gone) |
| 132 | `132_add_suspension_columns.sql` | ⏭️ skipped | `customers/shops.suspended_at + suspension_reason` | ✅ (backfilled) |
| 132 | `132_create_ai_orchestrate_messages.sql` | ⏭️ skipped | `ai_orchestrate_messages` table | ✅ (backfilled) |

**Every object exists on staging.** The `117`-file recorded as `118` also displaced repo-`118` (`create_po_suggestions_system`) into "skipped", but its table exists too.

### Root cause
An old `114→118` renumber of the inventory-v2 migration was done inconsistently: the **file** kept number `117` while the **DB** recorded it as `118`. That collided the repo's own `117` (human-reply-baseline) and shoved repo-`118` (po_suggestions) off its slot. The `132` trio and `095` pair are independent same-number collisions from concurrent branches. Objects survived only because of ad-hoc backfills (`record-and-verify-*`, safety net).

---

## Risk assessment

- **Staging:** ✅ no gap. Nothing broken.
- **Production:** ❓ **UNVERIFIED from here** (`.env` points at staging/DigitalOcean staging). The backfills that healed staging (safety net, one-off scripts, manual) may not all have run on prod. This is the one thing that could be a real bug (e.g. a missing `chk_service_category` constraint, or missing `suspended_at` columns, or a missing table → 500s on the related feature).
- **Deploy safety:** ✅ current deploys pass (files grandfathered). No urgency to unblock anything.

---

## Remediation

### Track 1 — Prod audit + backfill (safety-critical, do first)
1. Run a **read-only** existence audit on **prod** for every object in the Findings table (extend `backend/scripts/audit-prod-migrations.sql`). Output: which objects, if any, are missing on prod.
2. For any missing object: ship a **single new idempotent migration at the next free number** (currently **198**) that (re)creates exactly the missing objects with `IF NOT EXISTS` / guarded `ADD CONSTRAINT`. Do **not** reuse or renumber into 95/117/118/132.
3. Deploy → prestart `db:migrate` applies it → re-run the audit to confirm zero gaps.

Effort: ~1–2 h (mostly the audit query + one guarded migration if anything is missing).

### Track 2 — Renumber for hygiene (optional, do only if retiring the allowlists)
Goal: unique file numbers so `GRANDFATHERED_DUP_FILES` / `KNOWN_DRIFT` can shrink and "first-file-wins" fragility goes away.

For each currently-skipped/drifted file, in one PR:
1. **Harden idempotency FIRST** (see Gotchas) — because renumbering makes the runner re-run it.
2. Rename to a fresh free number (≥198), keeping content identical apart from idempotency guards.
3. On deploy the file re-runs harmlessly (objects already exist → `IF NOT EXISTS` no-ops) and records its new version.
4. Remove that file from `GRANDFATHERED_DUP_FILES` (and its `KNOWN_DRIFT` entry where applicable) in both `run-migrations.ts` and `check-migration-numbers.js`.
5. Keep the "winner" files at their recorded numbers (already in `schema_migrations`) — don't touch those.

Candidate renames (winner keeps its number; loser/drifted moves):
- `095_add_category_check_constraint.sql` → `198_add_category_check_constraint.sql`
- `117_create_inventory_v2_enhancements.sql` → align to its recorded **118**… but repo-118 is taken → give inventory a fresh number and leave `KNOWN_DRIFT[118]` documenting the historical record, **or** leave this pair alone (lowest risk). This one is the messiest; recommend leaving it grandfathered unless we do a full 114–120 realign (see `realign-schema-migrations-118-120.ts`).
- `132_add_suspension_columns.sql` → `199_...`; `132_create_ai_orchestrate_messages.sql` → `200_...`

Effort: ~2–4 h + a careful staging deploy dry-run. Prod re-run is safe **only** after idempotency hardening is verified.

### Gotchas (idempotency — blocks Track 2 if skipped)
- `095_add_category_check_constraint.sql`: `ALTER TABLE … ADD CONSTRAINT chk_service_category` has **no** guard → re-run **fails** ("constraint already exists"). Wrap in `DROP CONSTRAINT IF EXISTS` + re-add, or a `pg_constraint` existence guard.
- `117_create_inventory_v2_enhancements.sql`: `CREATE INDEX idx_service_inventory_items_*` (no `IF NOT EXISTS`) → re-run fails on duplicate index. Add `IF NOT EXISTS`.
- The `132` trio and `create_po_suggestions_system` already use `IF NOT EXISTS` / guarded blocks — safe to re-run as-is.

---

## Explicit non-goals / do NOT
- **Do NOT** delete or edit rows in `schema_migrations` on a shared DB to "force a re-run" — that's how records 69–87 got wiped before (see the disabled `cleanStaleRecords` note in the runner). Prefer additive, idempotent backfill migrations at fresh numbers.
- **Do NOT** renumber a **winner** file (one already recorded) — that would orphan its `schema_migrations` row and re-run it.
- **Do NOT** add new entries to `GRANDFATHERED_DUP_FILES` to silence a *new* collision — that list is only for these historical cases.

## Verification & rollback
- Verification = the read-only audit (Track 1 step 3) showing zero missing objects on prod, and a clean `db:migrate` (no collision-gate stop, no failures) on staging then prod.
- Rollback: all proposed changes are additive/idempotent; a bad backfill migration can be corrected by a follow-up idempotent migration (never by hand-editing `schema_migrations`).

## Recommended sequencing
1. **Now:** Track 1 (prod audit; backfill only if a gap is found). Safety-critical, low effort.
2. **Later / optional:** Track 2 renumber for the `095` and `132` groups (clean, low risk once hardened). Leave the `117↔118` inventory drift grandfathered unless a full `114–120` realign is separately justified.
