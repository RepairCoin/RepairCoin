# v1 Cost Report — Voice-first AI Dispatcher

**Status:** ⬜ SKELETON — awaiting a real replay run. Fill the **Actual**
columns from the audit queries below, then resolve the Decision matrix.
**Date of calibration:** _TBD_
**Run by:** _TBD_
**Environment:** Production DigitalOcean Postgres (`.env`-pointed) — there is
no separate staging DB.
**Test shop:** `peanut` (or whatever `VOICE_QA_SHOP_ID` was)

Mirrors the AI Marketing `v1-cost-report.md` structure. A voice command's cost
is the SUM of three audited legs, tied together by `session_id`:

```
total_per_command = STT (Whisper)          ← ai_voice_transcriptions.cost_usd
                  + router (Haiku 4-way)    ← ai_dispatch_audit.router_cost_usd
                  + downstream (Sonnet)     ← ai_insights_messages / ai_marketing_messages / help audit .cost_usd
```

The router leg is absent for inline-mic in-domain follow-ups (the client skips
the router — see Scenario 6). Those commands cost STT + downstream only.

---

## How to populate this doc

1. Seed + verify: `qa-fixtures/seed-test-shop.ts`.
2. Record the 10 clips (`qa-fixtures/pre-recorded-audio/README.md`).
3. Run `qa-fixtures/replay-fixtures.ts` against a running backend. It prints
   per-clip routing + STT/router cost and an accuracy summary.
4. For end-to-end cost (including the downstream Sonnet leg), run the 6
   manual scenarios in `qa-test-guide.md`, then join the three audit tables
   on `session_id`:

```sql
SELECT
  t.session_id,
  t.duration_ms,
  ROUND(t.cost_usd::numeric, 5)            AS stt_cost,
  t.latency_ms                             AS stt_latency_ms,
  d.router_decision,
  d.transcript_source,
  ROUND(d.router_cost_usd::numeric, 6)     AS router_cost,
  d.latency_ms                             AS router_latency_ms
FROM ai_voice_transcriptions t
LEFT JOIN ai_dispatch_audit d ON d.session_id = t.session_id
WHERE t.shop_id = 'peanut'
  AND t.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC;
```

Then pull the matching downstream row from the routed panel's audit table
(`ai_insights_messages` / `ai_marketing_messages` / the Help audit table) for
the same session/time window to get the third leg.

---

## §1 — Router accuracy (from replay-fixtures.ts)

Target: **> 95%** (≤ 0 misclassifications across the 10-clip set).

| # | Clip | Expected | Got | Pass? |
|---|---|---|---|---|
| 1 | insights-revenue-last-week | insights | | |
| 2 | insights-top-customers | insights | | |
| 3 | insights-low-stock-items | insights | | |
| 4 | marketing-black-friday-campaign | marketing | | |
| 5 | marketing-winback-email | marketing | | |
| 6 | marketing-slow-day-promo | marketing | | |
| 7 | help-export-bookings | help | | |
| 8 | help-add-a-service | help | | |
| 9 | oos-weather | out_of_scope | | |
| 10 | oos-book-appointment | out_of_scope | | |

**Accuracy:** ___ / 10 = ___%

**Misclassifications (if any) — transcript + wrong label + hypothesis:**
-

---

## §2 — Per-leg cost

Medians across the replay run (and the manual scenarios for the downstream leg).

| Leg | Source | Expected (design) | Actual (median) | Pass? |
|---|---|---|---|---|
| STT (Whisper, ~10s clip) | `ai_voice_transcriptions.cost_usd` | ~$0.001 | | |
| Router (Haiku, ~200 in / ~5 out) | `ai_dispatch_audit.router_cost_usd` | ~$0.0002 | | |
| Downstream (Sonnet panel) | panel audit `cost_usd` | ~$0.018 | | |
| **Total per command** | sum | **~$0.019** | | |

Target: **< $0.05 / command** (implementation.md §4 Phase 6 acceptance).

---

## §3 — Latency (end-to-end perceived)

Perceived latency = mic-stop → panel starts answering. The replay harness
measures the STT + router legs; the downstream leg comes from the panel audit
`latency_ms` during the manual run.

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| STT latency (p50) | — | | |
| Router latency (p50) | — | | |
| End-to-end p50 | < 6,000 ms | | |
| End-to-end p95 | < 6,000 ms | | |
| End-to-end max | — | | |

Target: **p95 < 6 s** perceived latency.

---

## §4 — Router prompt cache

The router system prompt is sent `cache-control: ephemeral` (voiceRouterPrompt.ts).
First call of a window is a miss; subsequent calls within the TTL should hit.

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| Router cached-input ratio (turn 2+) | > 0.5 | | |

Note: the router input is tiny (~200 tokens), so caching matters far less here
than on the Marketing/Insights surfaces. Record it, but a low ratio is not a
ship-blocker for the router leg.

---

## §5 — Aggregate / projection

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| Avg cost per command | < $0.05 | | |
| p95 end-to-end latency | < 6 s | | |
| Router accuracy | > 95% | | |
| Spend-cap surprises in audit log | 0 | | |

**7-day cost projection at observed usage:**
- Commands/day observed during QA: ___
- Implied $/shop/month at that rate: ___
- Platform-wide vs the **$200/month** launch cap (implementation.md §6): ___

---

## Decision matrix

| Outcome | Action |
|---|---|
| All targets green | **Ship voice v1.** Lock these baselines into the state-pointer memory. Flip flags per the §8 rollout plan (test shop → soak → all shops). |
| Router accuracy < 95% | **Tune the router prompt** (`voiceRouterPrompt.ts`). Inspect the misclassified transcripts; add a disambiguating example for the confused pair. Re-run replay. |
| Cost > $0.05 / command | Almost certainly the downstream Sonnet leg, not STT/router. Check the routed panel's own prompt size — voice doesn't add downstream cost beyond what typing the same question would. |
| p95 latency > 6 s | Likely the downstream panel agent loop (same finding as the Marketing cost report: ~5–6 s/iteration). Consider streaming the transcript display so perceived latency drops even if total doesn't. |
| Spend-cap hit mid-QA | Expected if the shared monthly budget is near its cap — confirm the 429 copy renders ("You've reached this month's AI budget…") rather than a crash. |

---

## Resolution

_To be written after the run — verdict (ship / tune), why, and the baseline
numbers that become the regression guard. Mirror the AI Marketing report's
Resolution section._

---

## Sign-off

- [ ] Router accuracy ≥ 95% (replay-fixtures.ts)
- [ ] Avg cost per command < $0.05
- [ ] p95 end-to-end latency < 6 s
- [ ] All 6 `qa-test-guide.md` scenarios pass
- [ ] Decision recorded above
- [ ] Baseline numbers committed to the voice-ai-dispatcher state-pointer memory
- [ ] Calibration completed by: __________ on __________
