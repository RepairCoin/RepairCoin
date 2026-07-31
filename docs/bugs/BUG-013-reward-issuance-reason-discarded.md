# BUG-013: Reward issuance reason is discarded — every issuance is logged as a repair reward

**Type:** Data Integrity / Audit Trail
**Severity:** Medium
**Priority:** P2
**Component:** Backend - RewardIssuanceService (shared by campaign rewards + workflow automations)
**Labels:** bug, backend, rewards, audit
**Status:** FIXED
**Date Found:** 2026-07-29
**Date Fixed:** 2026-07-29
**Found During:** Custom Workflows W2 verification (first `issue_reward` automation on staging)
**Fixed In:** `19eea5a2b` — `reason` + `source` threaded through `RewardIssuanceService.issueExact` to
`ShopRepository.issueRewardAtomic`. The caller's reason wins; repair wording is now only a fallback, so
the manual repair route is unchanged. `source` lands in `metadata` as machine-readable provenance.
Verified on staging with a real 1 RCN issuance: `"Automation: BUG-013 verification"` / `source=automation`.
**Open follow-up:** historical rows keep the wrong label — see Suggested Fix below; backfilling financial
records is a product decision, not part of this change.

---

## Description

`RewardIssuanceService.issueExact()` accepts a `reason` parameter, but it is only used to build the
**on-chain note**. With `ENABLE_BLOCKCHAIN_MINTING=false` (the current state, and the whole point of the
blockchain-removal work) that branch never runs, so the caller's reason is **silently discarded**.

The database transaction record instead gets a hardcoded, repair-flavoured description. Observed on
staging while verifying an automated reward of 1 RCN issued with `reason: 'W2 verification'`:

```
type: mint   amount: 1.00000000   shop_id: peanut
reason: "Repair reward - $0 repair"
```

Two problems follow:

1. **The label is wrong.** No repair happened. A customer or admin reading the transaction history sees
   a repair reward for a $0 repair, for what was actually a marketing campaign reward or an automated
   workflow reward.
2. **Provenance is lost.** Every issuance path — manual issue-reward, campaign rewards, and now
   workflow automations — collapses into the same indistinguishable record. There is no way to answer
   "why did this customer receive this RCN?" from the transaction log.

This is **pre-existing** and not introduced by Custom Workflows; W2 simply made it visible by adding a
third caller. It gets worse as more automated actions issue value.

---

## Root Cause

**File:** `backend/src/services/RewardIssuanceService.ts` (~line 92)

```typescript
const note = reason || `Campaign reward from shop ${shop.name}`;
```

`note` is consumed only inside the `ENABLE_BLOCKCHAIN_MINTING` branch. The atomic DB write
(`shopRepository.issueRewardAtomic`) records its own description and never receives `reason` or
`source`, even though callers already pass a meaningful `source` (`'marketing_campaign'`,
`'automation'`).

---

## Impact

- Customer-facing transaction history mislabels non-repair rewards as repairs.
- Admin/support cannot trace an issuance back to the campaign or automation that caused it.
- Affects **all** current callers: the manual `/shops/:shopId/issue-reward` route, campaign rewards, and
  Custom Workflows `issue_reward` automations.
- No financial impact — amounts and balances are correct; only the description is wrong.

---

## Suggested Fix

Thread `source` and `reason` through to the atomic write so the transaction record carries them, and
stop defaulting to repair wording for non-repair issuance. Because `RewardIssuanceService` is shared,
this should be done as its own change with campaign rewards re-verified — which is why it was **not**
folded into Custom Workflows W2.

Worth deciding at the same time whether existing rows should be backfilled or left as-is.

---

## Notes

Found by an end-to-end verification rather than by tests: the unit tests assert that `issueExact` is
called with the right arguments, which it is. The reason is lost *inside* the service, downstream of
anything the caller can observe.
