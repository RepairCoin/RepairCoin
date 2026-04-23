# Fix Sequence — 2026-04-23 Auth / Wallet / Registration Bugs

**Status:** Planning
**Created:** 2026-04-23
**Updated:** 2026-04-23

Meta-doc. Not a task. Tracks the landing order for the 6 bugs filed on 2026-04-23 so parallel work doesn't collide and shared foundations land before dependent fixes. Updates to individual task docs should not re-derive this sequence — reference this file instead.

---

## TL;DR ordering

```
Phase 1 (ship today, parallel, all Critical):
  ├─ bug-customer-registration-wallet-not-populated-generic-error.md
  ├─ bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md   ← acquisition blockers
  └─ bug-customer-login-silently-fails-stuck-on-onboarding.md (primary fix only)

Phase 2 (after Phase 1 — shared foundation):
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

| # | File | Priority | Phase | Est. Effort |
|---|---|---|---|---|
| 1 | [bug-customer-registration-wallet-not-populated-generic-error.md](./bug-customer-registration-wallet-not-populated-generic-error.md) | Critical | **1** | 20-30 min |
| 2 | [bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md](./bug-shop-registration-wallet-not-populated-stuck-on-third-slide.md) | Critical | **1** | 20-30 min |
| 3a | [bug-customer-login-silently-fails-stuck-on-onboarding.md](./bug-customer-login-silently-fails-stuck-on-onboarding.md) (primary) | Critical | **1** | 15-30 min |
| 3b | bug-customer-login-silently-fails-stuck-on-onboarding.md (secondary) | Critical | **4** | 1-2 hrs |
| 4 | [bug-customer-home-no-wallet-connected-despite-logged-in.md](./bug-customer-home-no-wallet-connected-despite-logged-in.md) | Medium | **2** | 30 min |
| 5 | [bug-suspended-screen-check-status-missing-wallet-address.md](./bug-suspended-screen-check-status-missing-wallet-address.md) | Medium | **3** | 1-2 hrs |
| 6 | [bug-shop-registration-uncapped-fields-in-third-fourth-slides.md](./bug-shop-registration-uncapped-fields-in-third-fourth-slides.md) | Medium | Independent | 10 min |

Totals: Phase 1 ~60-90 min (3 files, can be parallel); Phase 2 ~30 min; Phase 3 ~1-2 hrs; Phase 4 ~1-2 hrs; Independent 10 min. Full slate ~3-6 hrs of focused work across all phases.

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
