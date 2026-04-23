# Fix Sequence — 2026-04-23 Auth / Wallet / Registration Bugs

**Status:** Phase 1 shipped (Defensive) + Phase 1b shipped (Recovery); Phase 1c pending (new bugs surfaced by QA after 1b)
**Created:** 2026-04-23
**Updated:** 2026-04-23 (post-QA revision 2 — see Phase 1c block)

Meta-doc. Not a task. Tracks the landing order for the 6 bugs filed on 2026-04-23 so parallel work doesn't collide and shared foundations land before dependent fixes. Updates to individual task docs should not re-derive this sequence — reference this file instead.

---

## TL;DR ordering

```
Phase 1 (shipped 2026-04-23 in commit 5db89b6b — DEFENSIVE ONLY):
  ├─ bug-customer-registration-wallet-not-populated-generic-error.md    ✅ defensive shipped
  ├─ bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md ✅ defensive shipped
  └─ bug-customer-login-silently-fails-stuck-on-onboarding.md (primary) ✅ shipped

Phase 1b (shipped 2026-04-23 in commit 7365deb2 — RECOVERY via useActiveAccount):
  ├─ bug-customer-registration-*.md  ✅ useActiveAccount fallback + self-heal shipped
  └─ bug-shop-registration-*.md       ✅ useActiveAccount fallback + self-heal shipped

Phase 1c (PENDING, Critical — 4 items; ship the FIRST one immediately):
  ├─ bug-shop-register-references-dropped-cross-shop-enabled-column.md  (backend, CONFIRMED ROOT CAUSE)
  │     ShopRepository.createShop INSERTs `cross_shop_enabled` which migration 006
  │     already DROPPED. Tier 1: remove the column + value + one placeholder from
  │     the INSERT statement. That's the actual shop-registration blocker — all
  │     other Phase 1c items are secondary improvements.
  ├─ bug-mutation-retry-on-5xx-duplicates-toasts.md                 (mobile, global)
  │     queryClient.ts — change mutations.retry to 0 so POSTs don't auto-retry.
  │     Covers BOTH customer and shop (and every other mutation), not just one flow.
  ├─ bug-customer-register-controller-masks-errors-as-500.md        (backend)
  │     CustomerController.registerCustomer — map known error shapes to proper
  │     HTTP codes (400/409) instead of blanket 500; log unexpected errors with
  │     context and return a generic client message.
  └─ bug-shop-register-route-masks-errors-as-500.md                 (backend, supplementary)
      Shop /register inline route handler — error-shape mapping pattern matching
      the customer fix. Does NOT fix the cross_shop_enabled bug; addresses the
      broader gap where future errors (validation, other DB issues) still get
      masked as generic 500.
  // Root cause confirmed via DO staging backend logs (c:\dev\do-shop-err.txt):
  // "column cross_shop_enabled of relation shops does not exist" — the column
  // was dropped by migration 006 in Oct 2025 but the code still references it.
  // The shop-register ROOT CAUSE fix is a 2-line diff in ShopRepository.createShop.
  // Customer register path was never affected (customers table doesn't have
  // this column); customer flow's sc1.png 500s were likely transient or related
  // to different underlying issues that Phase 1a/1b already addressed.

Phase 2 (after Phase 1c — shared foundation):
  └─ bug-customer-home-no-wallet-connected-despite-logged-in.md (Option C: A + B)
      └─ Option B's splash self-heal reduces reachability of Phase 3

Phase 3 (after Phase 2 — belt-and-suspenders):
  └─ bug-suspended-screen-check-status-missing-wallet-address.md

Phase 4 (anytime after Phase 1 — prevent future desync):
  └─ bug-customer-login-silently-fails-stuck-on-onboarding.md (secondary fix —
     Thirdweb disconnect on logout)

Independent (ship anytime, no coupling):
  └─ bug-shop-registration-uncapped-fields-in-third-fourth-slides.md
```

## Phase 1b — the Recovery gap (added 2026-04-23 post-Phase-1 QA)

Khalid's commit `5db89b6b` implemented every Phase 1 diff faithfully. Live QA on the APK immediately surfaced that the *user problem* isn't solved:

- **Customer register:** button correctly disabled, TypeError eliminated — but fresh user fills form, wallet field still empty, Create Account stuck greyed. Evidence: `c:\dev\sc1.png` (2026-04-23 test).
- **Shop register:** Continue correctly disabled on ThirdSlide, no lying toast — but fresh shop owner fills location+pin, Continue stuck greyed. Evidence: `c:\dev\sc4.png`.

Root: all three Phase 1 fixes were **defensive only** (prevent crash, make state accurate). None populated the wallet from the fallback source. The Zustand `account` can be null while Thirdweb's `useActiveAccount()` returns the live wallet — that mismatch is the actual bug for fresh users. Phase 1b adds the recovery pattern:

```
Zustand storeAccount.address ?? useActiveAccount().address ?? null
  + useEffect to heal Zustand when Thirdweb has a wallet and Zustand doesn't
```

Both registration hooks got the same diff; no screen-level edits needed because the hooks' returned `account` already flows to the screens. Shipped in commit `7365deb2`.

**Phase 1b post-QA (2026-04-23) confirmed the wallet auto-populates and submit fires** — see `sc1.png` round 2 showing `0x3d4841B6e2...` in the Connected Wallet field and the button transitioning to "Creating Account…". The remaining failure is **Phase 1c** below — backend + mobile issues independent of wallet sourcing.

## Phase 1c — the Server Error gap (added 2026-04-23 post-Phase-1b QA)

After Phase 1b unblocked the wallet population, live QA surfaced what looked like two separate failure modes (customer and shop both showing "Server error" + duplicate toasts). Deep diagnostics via DigitalOcean staging backend logs (`c:\dev\do-shop-err.txt`) revealed a **single confirmed root cause for the shop flow** plus three supplementary improvements:

### Shop registration root cause (CONFIRMED)

`ShopRepository.createShop` references column `cross_shop_enabled` in its INSERT statement, but that column was **dropped** by migration `006_remove_obsolete_columns.sql` (2025-10-03). When the migration is applied (as it has been on staging), Postgres throws `column "cross_shop_enabled" of relation "shops" does not exist` → the route handler's blanket-500 catch converts that into the generic error the user sees → mobile retry loop multiplies the toast.

**Fix:** 2-line edit in `ShopRepository.ts` — remove the column and its value from the INSERT (full doc in `bug-shop-register-references-dropped-cross-shop-enabled-column.md`). Ship this FIRST.

### Supplementary improvements

1. **Mobile — retry policy** — `queryClient.ts` retries mutations up to 3 total attempts on 5xx/timeout/network. Even after the shop root-cause fix lands, any future 500 (from any endpoint) will still multiply toasts and risk duplicate POSTs. Fix: set `retry: 0` for mutations.

2. **Backend — customer controller error mapping** — `CustomerController.registerCustomer` returns HTTP 500 for all errors except a specific "already registered" string match. **Confirmed hit 2026-04-23 via curl test: invalid referral code throws → 500 "Invalid referral code" (should be 400).** If the user enters any referral code that isn't in the DB, this is the failure they see. Critical for the customer flow.

3. **Backend — shop route error mapping** — same pattern in the inline `/shops/register` handler. Once the cross_shop_enabled fix lands and registrations start succeeding, this is still valuable for surfacing future DB/validation errors with proper status codes.

Ship order: (1) cross_shop_enabled fix immediately → unblocks shop registration. (2-4) Supplementary fixes as a follow-up batch for long-term UX/resilience.

**Lesson for future bug docs (reinforced):** each live QA cycle surfaces new bugs the prior phase masked. Plan docs should explicitly acknowledge that "after this ships, QA may surface a new layer" — don't over-promise that Phase 1+1b = done. We learned this at Phase 1b; Phase 1c is the result of the same pattern one layer deeper. Budget accordingly.

---

## Why this order

### Shared architectural root

Four of the six bugs (customer register, shop register, customer home, suspended-screen) stem from **one underlying design issue**:

> the app's auth state is split across three layers (Thirdweb wallet session, Zustand `account` store, SecureStore-persisted `userProfile`) without a single source of truth, and there's no cohesive recovery when one layer gets out of sync.

Symptomatically:
- `account === null` in the Zustand store at the time a screen reads it → customer-register crash, shop-register stuck-on-ThirdSlide, customer-home "No wallet connected"
- `userProfile.walletAddress` missing on a specific auth path → suspended-screen check-status error

The fifth wallet-adjacent bug (`customer-login-silently-fails`) has a different primary root (silent-failure branches in `useAuth.ts` getToken path) but a secondary root (Thirdweb wallet not disconnected on logout) that directly produces new desync state feeding bugs 1, 2, 4, and 6.

The sixth bug (maxLength on shop ThirdSlide/FourthSlide) is entirely unrelated — input-validation scope gap from the 2026-04-16 pass.

### Phase 1 = user-acquisition blockers

Both registration bugs (customer + shop) block brand-new users from creating an account. Customer registration blocks the free side; shop registration blocks the $500/mo subscription side. Together they gate **all new mobile sign-ups**. These ship first, period.

Customer login silent-fail (primary fix) ships in the same phase because it blocks **returning** customers — parallel impact, different file, zero merge risk. Primary fix alone (toast + clear loading on the two silent branches in `useAuth.ts:103-105` and `121-123`) is ~15-30 min and doesn't touch wallet state, so it's safe to ship in the same PR wave.

Three files touched, three different hook paths, no shared imports. Ship in parallel PRs or one bundled PR — either works.

### Phase 2 = shared foundation

`bug-customer-home-no-wallet-connected-despite-logged-in.md` proposes Option C (A + B). The important piece is **Option B**: a splash-time self-heal in `useSplashNavigation` that reconstructs `account` from `userProfile.walletAddress` when `userProfile` is present but `account` is null.

After Option B lands:
- `bug-suspended-screen-check-status-missing-wallet-address.md` becomes much harder to reach (the self-heal also populates the fields suspended-screen needs)
- Any future screen that reads `account` works even against an install with partial persisted state

This is the shared foundation — it lands once, pays off across multiple screens. Doing it before Phase 3 avoids shipping per-screen workarounds that Option B would make redundant.

### Phase 3 = catch what Phase 2 misses

Suspended-screen's "Missing wallet address" error can fire for stale-install users whose persisted `userProfile` shape predates the current schema. Option B's self-heal reads `userProfile.walletAddress` — if that field was never populated (old install), the self-heal fails silently and the user hits the same screen-level guard. So the suspended-screen fix still ships, but with Option A (self-healing fallback to `account.address`) rather than Option B (root-cause investigation) — because after Phase 2, the root cause has been addressed upstream.

### Phase 4 = prevent new desync forming

`customer-login-silently-fails` secondary fix: force Thirdweb wallet disconnect on logout (or at the top of the next login). This removes the upstream *producer* of new desync state — prevents future users from ever entering the bad state Phases 1-3 patch over.

Can ship anytime after Phase 1. Not blocking, but valuable.

### Independent = ship whenever

`bug-shop-registration-uncapped-fields-in-third-fourth-slides.md` — 5 `maxLength` prop additions, 10 min, no code overlap with anything else. Natural bundle with any PR that touches ThirdSlide or FourthSlide.

---

## Bug inventory with cross-links

| # | File | Priority | Phase | Defensive | Recovery | Est. Effort |
|---|---|---|---|---|---|---|
| 1 | [bug-customer-registration-wallet-not-populated-generic-error.md](./bug-customer-registration-wallet-not-populated-generic-error.md) | Critical | **1 + 1b** | ✅ 5db89b6b | ✅ 7365deb2 | 20-30 + 15-20 min |
| 2 | [bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md](./bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md) | Critical | **1 + 1b** | ✅ 5db89b6b | ✅ 7365deb2 | 20-30 + 15-20 min |
| 3a | [bug-customer-login-silently-fails-stuck-on-onboarding.md](./bug-customer-login-silently-fails-stuck-on-onboarding.md) (primary) | Critical | **1** | ✅ 5db89b6b | n/a | 15-30 min |
| 3b | bug-customer-login-silently-fails-stuck-on-onboarding.md (secondary) | Critical | **4** | ⏳ Pending | n/a | 1-2 hrs |
| 4 | [bug-customer-home-no-wallet-connected-despite-logged-in.md](./bug-customer-home-no-wallet-connected-despite-logged-in.md) | Medium | **2** | ✅ (A+B) 5db89b6b | built-in | 30 min |
| 5 | [bug-suspended-screen-check-status-missing-wallet-address.md](./bug-suspended-screen-check-status-missing-wallet-address.md) | Medium | **3** | ✅ 5db89b6b | n/a | 1-2 hrs |
| 6 | [bug-shop-registration-uncapped-fields-in-third-fourth-slides.md](./bug-shop-registration-uncapped-fields-in-third-fourth-slides.md) | Medium | Independent | ✅ 5db89b6b | n/a | 10 min |
| 7 | `docs/tasks/23-04-2026/bug-shop-register-references-dropped-cross-shop-enabled-column.md` | Critical | **1c (FIRST)** | ⏳ Pending | n/a | **10 min** (Tier 1) + 30 min (Tier 2 cleanup) |
| 8 | [bug-mutation-retry-on-5xx-duplicates-toasts.md](./bug-mutation-retry-on-5xx-duplicates-toasts.md) | Critical | **1c** | ⏳ Pending | n/a | 5 + 10 min verify |
| 9 | `docs/tasks/23-04-2026/bug-customer-register-controller-masks-errors-as-500.md` | **Critical** | **1c** | ⏳ Pending | n/a | 15-20 min |
| 10 | `docs/tasks/23-04-2026/bug-shop-register-route-masks-errors-as-500.md` | High | **1c** | ⏳ Pending | n/a | 15-20 min |

Totals: Phase 1 ~60-90 min (shipped); Phase 1b ~30-40 min (shipped); **Phase 1c Tier 1 (cross_shop_enabled) ~10 min — the blocker**; remaining Phase 1c supplementary ~35-55 min (pending); Phase 2 ~30 min; Phase 3 ~1-2 hrs; Phase 4 ~1-2 hrs. Ship bug #7 FIRST; bugs #8-10 are important polish but not acquisition-blocking once #7 lands.

---

## File-collision check (for parallel PRs within Phase 1)

| File | Touched by |
|---|---|
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | #1 only |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | #2 only |
| `mobile/feature/register/components/ThirdSlide.tsx` | #2 (wallet helper), #6 (maxLength) — rebase, not conflict |
| `mobile/feature/register/components/FourthSlide.tsx` | #6 only |
| `mobile/feature/register/screens/CustomerRegisterScreen.tsx` | #1 (secondary tweak) |
| `mobile/shared/hooks/auth/useAuth.ts` | #3a (silent-fail branches), #3b (disconnect on logout), #4 Option B (splash self-heal) |
| `mobile/shared/store/auth.store.ts` | #3b (remove dead disconnect branch) |
| `mobile/feature/home/components/customer-wallet/index.tsx` | #4 Option A |
| `mobile/feature/home/components/shop-wallet/index.tsx` | #4 Option A (preemptive) |
| `mobile/feature/register/hooks/ui/useShopSuspended.ts` | #5 |

Phase 1 hot spots:
- `useAuth.ts` is touched by #3a in Phase 1 and by #3b / #4 in later phases. #3a is a small additive change (2 toasts) in two isolated branches — low rebase risk for later phases.
- `ThirdSlide.tsx` is touched by #2 (Phase 1) and #6 (Independent). #2 touches the wallet FormInput helper text; #6 adds `maxLength` to non-wallet inputs. No collision — can bundle in the same PR if convenient.

Phase 2's Option B (splash self-heal in `useAuth.ts`) adds a block before the navigate function; #3a's Phase 1 edits are inside nested branches of `useConnectWallet.onSuccess`. No conflict.

---

## Notes

- Individual task docs describe their *own* fix in detail. This doc only concerns *ordering*. When a task doc's Notes section references sequence, it should link here rather than re-derive the order.
- Revisit this plan if anything changes: new bug lands in scope, an option is rejected, a phase item turns out larger than estimated. Update this file and bump **Updated** above.
- Commit policy (per CLAUDE.md + user memory): fixes above land only when explicitly authorized. This doc is planning only — no code changes here.
