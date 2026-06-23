# Fraud & Abuse Detection — Feature Spec

**Status:** Draft / proposed
**Date:** June 23, 2026
**Owner:** Zeff
**Source:** Admin AI Roadmap, Priority 1 (`docs/ADMIN_AI_RECOMMENDATIONS.html`)

---

## 1. Goal

Protect the RepairCoin token economy by automatically detecting suspicious
reward issuance, redemption, and review patterns, and surfacing the riskiest
cases to an admin **review queue** with a severity score, a plain-English
explanation, and a recommended action (investigate / freeze / dismiss).

This is the highest-stakes gap for a tradeable-token rewards platform: without
it, a colluding shop + customer can mint and extract real value, and fake
reviews can erode marketplace trust.

**Non-goals (v1):** automatic punitive action (all actions stay admin-gated),
on-chain forensics, and customer-facing dispute flows.

---

## 2. Reuse — what already exists

This feature is mostly **wiring together existing infrastructure**:

| Existing piece | Reused for |
|---|---|
| Nightly anomaly detector (`AnomalyDetector.ts`, `ai_insights_anomalies`) | Same scheduled-job pattern + storage shape, scoped to fraud |
| `AnomalyPhraser.ts` (Claude turns metrics → natural language) | Generate the human-readable "why this is suspicious" text |
| `transactions` ledger (mint/redeem, shop_id, customer_address, status) | Primary data source for issuance/redemption signals |
| `EmergencyFreezeService.ts` | The "Freeze" admin action on a confirmed case |
| Insights audit + spend-cap infra | Cost control + audit for any AI calls |
| Admin dashboard tabs + notification system | Surface the review queue + alerts |

---

## 3. Detection signals (v1 rules)

Each rule is a read-only SQL/agg over a rolling window. Rules emit a **finding**
with a raw score; findings are normalized to a 0–100 severity.

### Issuance / redemption (token economy)
1. **Concentrated issuance** — a shop issues a large share of its RCN to a small
   number of wallets (e.g. >60% of 30-day issuance to ≤3 wallets).
2. **Rapid earn→redeem cycling** — a wallet redeems shortly after earning,
   repeatedly, at the same shop (classic wash pattern).
3. **Issuance spike** — a shop's daily issuance jumps far above its own trailing
   baseline (e.g. >5× 30-day median).
4. **Self-dealing proximity** — earn + redeem between a shop and wallets that
   share signals (same shop wallet, repeated 1:1 pairing).
5. **Redemption at non-earning shop anomaly** — unusual cross-shop redemption
   volume inconsistent with normal customer behavior.

### Reviews / reputation
6. **Review brigading** — a burst of reviews for one shop/service in a short
   window from low-history accounts.
7. **Rating manipulation** — review rating distribution sharply diverges from
   the shop's historical pattern.

> Start with rules **1, 2, 3, 6** (highest signal, simplest data) for v1; add the
> rest in v2 once the pipeline + review queue are proven.

---

## 4. Data model

New table `fraud_findings` (mirrors the `ai_insights_anomalies` shape):

```sql
CREATE TABLE fraud_findings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_key        TEXT NOT NULL,            -- e.g. 'concentrated_issuance'
  severity        INT  NOT NULL,            -- 0-100
  status          TEXT NOT NULL DEFAULT 'open',  -- open | investigating | confirmed | dismissed
  subject_type    TEXT NOT NULL,            -- 'shop' | 'customer' | 'pair'
  shop_id         TEXT,                     -- nullable FK-ish
  customer_address TEXT,                    -- nullable
  window_start    TIMESTAMPTZ,
  window_end      TIMESTAMPTZ,
  metrics         JSONB NOT NULL,           -- raw numbers behind the finding
  explanation     TEXT,                     -- AI-phrased "why" (AnomalyPhraser)
  recommended_action TEXT,                  -- 'investigate' | 'freeze' | 'dismiss'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by     TEXT,                     -- admin address
  reviewed_at     TIMESTAMPTZ,
  resolution_note TEXT
);
CREATE INDEX idx_fraud_findings_status   ON fraud_findings(status);
CREATE INDEX idx_fraud_findings_severity ON fraud_findings(severity DESC);
CREATE UNIQUE INDEX uq_fraud_finding_dedupe
  ON fraud_findings(rule_key, subject_type, COALESCE(shop_id,''), COALESCE(customer_address,''), window_start);
```

The unique index dedupes re-runs of the same rule over the same window/subject.

---

## 5. Architecture / flow

```
nightly job (FraudScanService)
  → run each rule (read-only agg over transactions / reviews)
  → score + dedupe → upsert into fraud_findings (status='open')
  → for new high-severity findings: AnomalyPhraser → explanation + recommended_action
  → emit admin notification for severity >= threshold

admin dashboard ("Trust & Safety" tab)
  → GET /api/admin/fraud/findings?status=open&minSeverity=...
  → review queue sorted by severity
  → actions: Investigate / Dismiss / Freeze (calls EmergencyFreezeService)
  → every action writes reviewed_by/reviewed_at/resolution_note (audit)
```

- **Scoped to scheduled batch**, not request-time — keeps it cheap and off the
  hot path. AI is only called to phrase *new* high-severity findings (spend-capped).
- **Tools-as-rules**: each rule is a small module (like the insights tools) so
  they're independently testable and easy to add.

---

## 6. API endpoints (admin-only)

```
GET    /api/admin/fraud/findings        — list (filter by status, minSeverity, subject)
GET    /api/admin/fraud/findings/:id    — detail (metrics + explanation)
POST   /api/admin/fraud/findings/:id/status   — { status, note }  (investigating/confirmed/dismissed)
POST   /api/admin/fraud/findings/:id/freeze   — confirm + trigger EmergencyFreezeService
GET    /api/admin/fraud/summary         — counts by status/severity for the dashboard badge
```

All behind the existing admin auth + role middleware. Subject IDs come from the
finding row, never from client input.

---

## 7. Frontend

- New **"Trust & Safety"** admin tab: severity-sorted review queue, finding
  detail drawer (metrics + AI explanation + recommended action), and the three
  actions. Reuse the existing admin table + drawer patterns.
- A badge/counter on the admin nav for `open` high-severity findings (reuses the
  notification pattern).

---

## 8. Phased rollout

| Phase | Scope |
|---|---|
| **0 — Spec + schema** | This doc; create `fraud_findings`; stub `FraudScanService` |
| **1 — Detection (rules 1,2,3,6)** | Implement the 4 core rules + scoring + dedupe + nightly job. No AI yet — explanations are templated. |
| **2 — Review queue UI** | Admin "Trust & Safety" tab + the 5 endpoints + investigate/dismiss. |
| **3 — Freeze integration** | Wire the Freeze action to `EmergencyFreezeService` with confirm-gate + audit. |
| **4 — AI phrasing + alerts** | `AnomalyPhraser` for explanations + recommended actions; admin notifications for high severity. |
| **5 — Expand rules (4,5,7)** | Add the remaining signals once the loop is proven. |

---

## 9. Effort estimate

~**Medium** (the roadmap's estimate). Phases 0–3 are the bulk and are mostly
SQL + standard CRUD + admin UI; Phase 4 adds the AI layer using existing
patterns. Recommend its own PR per phase, reviewed independently.

---

## 10. Open questions (decide before Phase 1)

1. **Severity thresholds** — what score auto-notifies an admin vs. sits silently
   in the queue? (Suggest: notify ≥ 70.)
2. **Windows** — 7d vs 30d default per rule? (Suggest: 7d for spikes/brigading,
   30d for concentration.)
3. **False-positive tolerance** — start conservative (fewer, higher-confidence
   findings) and loosen, or the reverse?
4. **Freeze scope** — does a confirmed shop fraud freeze the shop, the wallet,
   or both? (Ties into `EmergencyFreezeService` capabilities.)
5. **Retention** — how long to keep dismissed findings (audit vs. noise)?
```
