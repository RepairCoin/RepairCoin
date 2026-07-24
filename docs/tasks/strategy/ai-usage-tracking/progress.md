# AI Usage Tracking — Build Progress

Companion to `scope.md`. Branch `deo/ai-usage-tracking`. Checkpointed for crash recovery.

## Status

- **Scope** — DONE (committed: `082261f44`, `263973f89`).
- **Phase 1 — Integrity fix** — CODE COMPLETE, verified on staging. **Uncommitted.**
- **Phase 2 — Admin visibility** — CODE COMPLETE, verified on staging. **Uncommitted.**
- **Phase 3 — Cleanup** — CODE COMPLETE, verified on staging. **Uncommitted.**

### Phase 1 — what shipped

| Change | File |
|---|---|
| `ai_misc_usage` table + `ai_usage_events` view | `backend/migrations/240_create_ai_usage_events_view.sql` |
| `canSpend` derives from the view; `recordSpend` gains the `ledger` param | `SpendCapEnforcer.ts` |
| Shop's own spend panel + call count read the view | `SpendController.getOwnShopSpend` |
| Orphan surfaces now log to `ai_misc_usage` | `BrandKitController` (×2), `FaqSuggestionController`, `VoiceSpeakController` |
| Tests: derived-source, no-settings-row enforcement, ledger behaviour | `SpendCapEnforcer.test.ts` (+9 cases) |

Verification (all executed, not assumed):
- `npx tsc --noEmit` exit 0; `npm run build` exit 0 (unpiped).
- `npx jest tests/ai-agent/` → **909/909 pass**.
- Migration applied to staging; view total reconciles **exactly** against a hand-summed query over
  the 11 raw tables: `$9.775076` both ways, delta `$0.000000`.
- A shop with no `ai_shop_settings` row returns 1 row (`has_settings=false`), not 0 — canSpend
  can't crash on `rows[0]`.

**D1 ANSWERED — no cache table needed.** Measured on staging: `EXPLAIN ANALYZE` execution
**~8ms**, and the ads legs are constant-folded away entirely (`One-Time Filter: false`) because
`billable_to_shop` is a literal `false` on those legs — D3 costs nothing at runtime.

One perf fix was required to get there: `ad_campaigns.shop_id` is `TEXT` while the other nine
sources are `VARCHAR(255)`, so the UNION coerced the column and Postgres filtered `shop_id` ABOVE
the Append — every leg scanned every shop's month (444 rows scanned to return 99). Casting the two
ads legs to `VARCHAR(255)` restored qual pushdown: 6 legs now use `idx_*_shop_created`, and the scan
is per-shop rather than platform-wide. Without that cast this query degrades linearly with total
platform AI volume — on a per-call pre-flight check.

---

## Phase 2 — Admin visibility (2026-07-24)

| Change | File |
|---|---|
| `getAdminCostSummary` rewritten against the view; `?days=` window | `SpendController.ts` |
| Admin client for COGS + overage (+ overage client moved here) | `frontend/src/services/api/aiUsage.ts` |
| New "AI Usage & Cost" tab — 3 panels | `frontend/src/components/admin/tabs/AdminAIUsageTab.tsx` |
| Tab + sidebar wiring (`/admin?tab=ai-usage`, unflagged) | `AdminDashboardClient.tsx`, `AdminSidebar.tsx` |
| Overage panels REMOVED (D4) — now live on the AI Usage tab | `AdminMessagingCostsTab.tsx`, `messagingCosts.ts` |

**Response shape** — three lenses, never summed (they are different directions of money):
`{ periodDays, cogs: {totals, byFeature, byModel, byShop, trend}, reconciliation: {...} }`.
Overage revenue stays on its own existing endpoint; the tab calls both.

**Reconciliation is deliberately month-scoped** regardless of the selected COGS period — that's the
window the cap enforces on. Comparing a 90-day audit against a month-to-date counter would
manufacture a drift that isn't real.

Verification (executed):
- `npm run build` backend exit 0; frontend `npm run build` exit 0 (`✓ Compiled successfully`).
- `npx jest tests/ai-agent/` → **910/910 pass** (rewrote the 2 cost-summary tests for the new shape,
  added a days-clamp test; also fixed the test helper, which silently dropped `req.query`).
- Frontend typecheck: **211 errors before and after** — a large pre-existing baseline, zero added by
  these files.
- Live controller run against staging (`scripts/_verify_phase2_cost_summary.ts`) asserts every
  breakdown sums to the total (byFeature, byModel, trend, billable+ads) and that the window filter
  narrows correctly. **ALL CONSISTENCY CHECKS PASSED.**
- Headline confirmed on real data: over 30 days the old endpoint reported **$2.96**, the new one
  **$12.94** — **77% of spend was invisible**.

**Chart design:** both charts are single-series (daily-cost area, feature bar list), so magnitude is
carried by length and identity by the label — no categorical palette, and nothing for the CVD
adjacent-pair check to fail on. Status colours (drift ok/warn) always ship with an icon and a word,
never colour alone. Palette validated against the dark surface: contrast passes.

### Still open before Phase 2 can be called done

- **Not committed.**
- **Not viewed in a browser.** Build compiles and the data layer is verified against staging, but
  nobody has loaded `/admin?tab=ai-usage` — layout, label collisions, and chart geometry are
  unverified. This is the one gap worth closing before merge.

---

## Phase 3 — Cleanup (2026-07-24)

Scope asked for two root causes. One was **disproved**, one is **explained and fixed**, and the
investigation turned up a **regression Phase 1 had introduced**.

### P3-A — the orchestrate `recordSpend` mismatch: DISPROVED, close it

Scope root-cause #3 supposed that `recordSpend(cumulative.costUsd)` and the `cost_usd` logged to
`ai_orchestrate_messages` "don't always agree". They are the *same variable* —
`UnifiedAssistantController` writes `costUsd: cumulative.costUsd` to the audit and passes
`cumulative.costUsd` to `recordSpend`. One audit row per turn, cumulative across the tool loop.
Confirmed on staging: **zero** orchestrate rows carry tokens without cost.

There is a real divergence *near* it, though: the audit write happens **before** the
`if (!lastResponse) return` early-return, while `recordSpend` happens **after** it. A wholly-failed
turn is therefore audited but never charged — which is the intended product rule, and which leads
directly to P3-C.

### P3-B — the mid-month `current_month_started_at`: explained, and the field was lying

`maybeRolloverMonth` stamped **`NOW()`**, so the column recorded *when a request first noticed the
month had turned over*, not when the month began. Staging shows the consequence: clusters of **5, 7,
12 and 33 shops** sharing a single mid-month *minute* — a background sweep rolling many shops at
once, not per-shop corruption. A mid-month value was therefore routine noise, indistinguishable from
a real anomaly. That is why this looked like data corruption for weeks.

Fixed: the rollover now stamps `DATE_TRUNC('month', NOW())`. Any mid-month value is now a genuine
signal.

The money question — *what wiped peanut's spend* — is only partly attributable. peanut has **51
events / $0.4357** of billable spend predating its own July-14 stamp, so ~$0.44 of the $1.46 drift
is wiped-by-reset. The remainder is this session's testing, which stubbed `recordSpend` (the scope
already flagged peanut as the noisiest shop). The *mechanism* is proven; peanut's exact total is not
worth chasing further.

Also hardened: the rollover is now folded **into** the `recordSpend` UPDATE as a `CASE`, for zero
extra round-trips. Every current caller happens to call `canSpend` first, but nothing enforces that
pairing, and a `recordSpend`-only caller would accrue into a stale month and have the lot zeroed by
the next `canSpend`.

### P3-C — REGRESSION found and fixed: Phase 1 started charging shops for our failures

Deriving spend from the audit silently reversed a deliberate product rule. The orchestrator has
always passed `0` to `recordSpend` on a failed call ("no charge to the shop for failed requests"),
but errored rows sit in `ai_usage_events` carrying the tokens they burned — so the derived counter
began billing them to the shop's allowance.

`canSpend`, `getOwnShopSpend` and the reconciliation query now filter `NOT is_error`. The admin COGS
panel deliberately does **not** — we still paid the vendor for those tokens; they simply don't come
out of the shop's allowance.

Currently worth **$0.0000** (failed calls log zero cost today), so nothing was mis-billed — but the
path is reachable, since a turn that fails *after* successful tool-loop iterations carries a
non-zero cumulative cost.

### P3-D — the drift panel had the sign backwards (bug in Phase 2's own UI)

The reconciliation panel labelled all drift "counters under-report". The two directions mean
opposite things:

- **audit > counter** — a missed increment. Benign: the cap reads the audit, so enforcement was
  right anyway; only the cache lagged.
- **counter > audit** — a call was charged but never logged. That spend is **invisible to the cap**,
  so the shop is under-charged. This is exactly the leak `ai_misc_usage` was added to close, and the
  signal that a new AI surface shipped without logging its cost.

The panel now reports direction, flags the dangerous one in red with an "unlogged spend" tag, and
surfaces it at the top even when the platform total nets out. Live staging has one such shop:
`nail-lash`, **$0.01** charged that never reached the audit.

### Verification

- `npx jest tests/ai-agent/` → **913/913 pass** (+3 Phase-3 cases: error exclusion, folded rollover,
  truncated stamp).
- Backend build exit 0; frontend build `✓ Compiled successfully`; frontend typecheck adds nothing to
  the 211-error baseline.
- `scripts/_phase3_verify_rollover.ts` exercises the real statements against the real schema inside a
  **rolled-back transaction** — 6 cases, all pass: stale-month resets (not adds), in-month adds,
  stamp is the first instant of the month, no-op inside the month, idempotent, and **a legacy
  mid-month stamp does not trigger a spurious wipe on deploy**.
- Phase 2's consistency script still passes unchanged after these edits.

**Timezone note (worth knowing before touching this again):** `current_month_started_at` is
`TIMESTAMP WITHOUT TIME ZONE` and the staging session runs at **+08**, so `DATE_TRUNC('month',
NOW())` stores `2026-07-01 00:00:00` local, which a JS `Date` round-trip renders as
`2026-06-30T16:00Z`. My first assertion failed on exactly this and the *code* was correct. Month
boundaries are computed consistently in the session timezone on both sides of every comparison
(rollover and view filter), so behaviour is sound — but assert with `TO_CHAR`, not a JS `Date`.

### Not done (deliberate)

- **No data repair.** peanut/nail-lash counters still carry historical drift. The counter is only a
  cache now, and it self-corrects at the next month rollover. Resyncing it would also erase the
  `nail-lash` leak signal before anyone has looked at it. Say the word if you'd rather I resync the
  benign (counter-low) direction and leave the leak visible.

### Still open before Phase 1 can be called done

- **Not committed** (per standing instruction — say the word).
- **Not exercised through the live HTTP path.** The query is verified against staging and the units
  pass, but no real AI call has been made end-to-end since the change. Worth one live shop-dashboard
  load + one AI call before merging.
- `ai_shop_settings.current_month_spend_usd` is now a **cache only** — still incremented by
  `recordSpend`, no longer read by any enforcement or shop-facing path. `getAdminCostSummary` still
  reports it as `shopCounters.counterTotalUsd`, which is now best read as a drift signal.

---

## Code-review findings that AMEND the scope (2026-07-24)

### F1 — D2 is free: `ai_dispatch_audit` already has cost. NO ALTER NEEDED.
Scope D2 says the table "has no `cost_usd`" and recommends adding it. Wrong — mig 130 defines
`router_cost_usd` + `router_input_tokens` + `router_output_tokens`. The view just aliases them.
D2 is resolved at zero cost.

### F2 — BLOCKER: three surfaces charge the counter but log to NO cost table.
These call `spendCap.recordSpend(...)` and write no audit row anywhere:

- `BrandKitController.ts:142` and `:199` — logo/vision brand-colour extraction
- `FaqSuggestionController.ts:224` — AI FAQ suggestions
- `VoiceSpeakController.ts:80` — OpenAI TTS

A naive "derive from the view" would read **$0** for this spend and *under-enforce in a new way* —
swapping one drift bug for another. Live evidence: shop `nail-lash` shows counter $0.01 / derived
$0.00 — exactly this signature.

**Fix (added to Phase 1):** a generic `ai_misc_usage` ledger (mig 240) that these three write to,
included in the view. One table, not three — these surfaces have no per-feature reporting need.

### F3 — the scope's table list is incomplete: `ad_lead_messages.ai_cost_cents` (mig 152).
Lead auto-reply AI cost, cents-denominated like `ad_ai_costs`. Ads COGS, must join
`ad_leads → ad_campaigns.shop_id` for attribution. Total sources = **10**, not 8.

### F4 — the mid-month reset writer is NOT the lazy provisioner.
All three `ai_shop_settings` upserts are safe: `SpendCapEnforcer.canSpend:117` is
`ON CONFLICT DO NOTHING`, and `SpendController.ts:204/250` both `DO UPDATE` without touching
`current_month_started_at`. So `project_ai_spend_cap_new_shop` is NOT the culprit. Remaining
hypothesis for Phase 3: peanut's settings row was deleted + re-created on Jul 14 (test cleanup),
not rewritten. **Phase 1's derived counter makes this moot either way.**

### F5 — timestamp types are mixed across sources.
`TIMESTAMP` (agent/orchestrate/insights/marketing/help/voice/dispatch) vs `TIMESTAMPTZ`
(image_generations, ad_ai_costs, ad_lead_messages). The view must cast consistently or month
bucketing silently skews at boundaries.

---

## Live measurement (staging, 2026-07 MTD, run 2026-07-24)

Reproduce: `cd backend && npx ts-node scripts/_aiusage_audit_tables.ts`

```
ai_agent_messages          $2.9621  (47 rows)   <- the ONLY table the admin summary reads
ai_orchestrate_messages    $4.3262  (99 rows)
ai_image_generations       $2.0160  (36 rows)
ai_insights_messages       $0.3703  (232 rows)
ai_voice_transcriptions    $0.0226  (30 rows)
ad_ai_costs                $0.0667  (59 rows)  [cents->usd]
ad_lead_messages           $0.0113  (33 rows)  [cents->usd]
ai_marketing_messages      $0.0000  (0 rows)
ai_help_messages           $0.0000  (0 rows)
ai_dispatch_audit          $0.0000  (0 rows)
  TRUE TOTAL               $9.7751
  admin shows              $2.9621  -> 70% of real spend invisible  (CONFIRMED)
```

Counter vs derived, per shop (derived excludes `use_case='ads'` images, per D3):

```
shop                derived   counter    drift    started
1111                 6.3837    6.2100    0.1737   2026-07-03
peanut               2.2390    0.7800    1.4590   2026-07-14  <-- MID-MONTH RESET
ancient-realm-tech   0.6282    0.5700    0.0582   2026-07-01
7777                 0.4461    0.3500    0.0961   2026-07-03
nail-lash            0.0000    0.0100   -0.0100   2026-07-01  <-- F2 orphan-surface signature
  TOTAL under-enforcement                1.7770
```

---

## Phase 1 build plan

1. **Migration 240** (next free — 239 is max across all local+remote branches; note migs are
   duplicated at 132, so verify by name not just number):
   - `ai_misc_usage` table (F2)
   - `ai_usage_events` view — UNION ALL of all 10 sources, normalized to
     `(shop_id, feature, vendor, model, input_tokens, output_tokens, cost_usd, billable_to_shop, created_at)`,
     cents→usd for the two ads tables, consistent `TIMESTAMPTZ` cast (F5).
   - `billable_to_shop` flag encodes D3: false for ads-attributed rows so the *counter* can filter
     while the *admin COGS panel* still sees everything.
2. Wire the three orphan surfaces to `ai_misc_usage` (F2).
3. `SpendCapEnforcer.canSpend` derives spend from the view instead of `current_month_spend_usd`.
4. Tests + re-run the audit script to confirm derived == true cost.
