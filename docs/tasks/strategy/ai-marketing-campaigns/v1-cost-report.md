# v1 Cost Report — AI Marketing Assistant

**Status:** Skeleton — fill in actuals during Phase 6 calibration session.
**Date of calibration:** _____________
**Run by:** _____________
**Environment:** Staging / Production (circle)  · backend commit ____________
**Test shop:** `peanut` (or other: __________)
**ANTHROPIC_API_KEY model:** `claude-sonnet-4-6`

---

## How to use this doc

Run each of the four flows below in the AI Marketing panel against the seeded test shop, then fill in the **Actual** columns from the audit query:

```sql
SELECT
  created_at,
  input_tokens,
  output_tokens,
  cached_input_tokens,
  ROUND(cost_usd::numeric, 5) AS cost_usd,
  latency_ms,
  jsonb_array_length(tool_calls) AS tool_count
FROM ai_marketing_messages
WHERE shop_id = 'peanut'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

The most-recent row per session is the row you want. `cached_input_tokens` should be 0 on the first turn of a session (cache miss) and > 0 on turn 2+ (cache hit on the stable rules + context blocks).

Targets at the bottom (§Decision matrix) decide ship vs tune.

---

## Flow §1 — Top spenders

**Prompt to type:** `Tell my top 50 customers about our new pastry tutorial`

**Expected behavior:**
- AI calls `lookup_audience_count` → resolves to 2 (top 20% of seeded 10)
- AI calls `propose_campaign_draft` → persists draft, emits draft card
- 2-3 iterations, final iteration writes prose summary

| Metric | Expected (rough) | Actual | Pass? |
|---|---|---|---|
| Input tokens | ~6,000 - 8,000 (system + 1 user msg + 2 tool round-trips) | | |
| Output tokens | ~600 - 900 (1 tool call arg block + final prose) | | |
| Cached input tokens | 0 (first turn, cache miss) | | |
| Cost USD | $0.03 - $0.06 | | |
| Latency (ms) | 4,000 - 8,000 | | |
| Tool iterations | 2 | | |

**Observed AI subject + body opening line:**
```
Subject: 
Body (first paragraph):
```

**Notes:**
- 

---

## Flow §2 — Lapsed / win-back

**Prompt to type:** `Bring back customers who haven't booked in 90 days`

**Expected behavior:**
- AI calls `lookup_audience_count` → resolves to 3 (Frank/Grace/Henry)
- AI calls `propose_campaign_draft` with win-back scaffold tone
- 2-3 iterations

| Metric | Expected (rough) | Actual | Pass? |
|---|---|---|---|
| Input tokens | ~6,000 - 8,000 | | |
| Output tokens | ~700 - 1,000 (body tends to be longer than Black Friday — warm tone needs words) | | |
| Cached input tokens | If §1 just ran in same session, expect cache hit (~4,000+ cached). If fresh session, 0. | | |
| Cost USD | $0.03 - $0.06 first session, $0.02 - $0.04 cached | | |
| Latency (ms) | 4,000 - 8,000 | | |
| Tool iterations | 2 | | |

**Observed AI subject + body opening line:**
```
Subject: 
Body (first paragraph):
```

**Tone check** (per scaffold spec — warm, sincere, NOT desperate, NOT guilt-trippy):
- [ ] Acknowledges the gap without guilt-tripping
- [ ] Doesn't use the word "miss" more than once
- [ ] Doesn't open with "we noticed you haven't…" (too creepy)
- [ ] Offer is a placeholder `(your offer here)` unless I stated one

**Notes:**
- 

---

## Flow §3 — Black Friday (recognized category + free-form discount)

**Prompt to type:** `Make a Black Friday campaign — 20% off all services this weekend`

**Expected behavior:**
- AI may skip `lookup_audience_count` (all_customers default for shop-wide promos) OR call it anyway — both valid
- AI calls `propose_campaign_draft` with Black Friday scaffold
- Body MUST echo "20% off" exactly
- 1-2 iterations

| Metric | Expected (rough) | Actual | Pass? |
|---|---|---|---|
| Input tokens | ~5,500 - 7,500 (one fewer round-trip if skipping audience lookup) | | |
| Output tokens | ~600 - 900 | | |
| Cached input tokens | Cache hit if §1 or §2 ran in same session | | |
| Cost USD | $0.025 - $0.05 | | |
| Latency (ms) | 3,000 - 7,000 | | |
| Tool iterations | 1-2 | | |

**Anti-hallucination check (critical):**
- [ ] Body contains "20%" or "20 percent" exactly
- [ ] Body does NOT contain "25%", "15%", "30%", or any other percentage
- [ ] Deadline is mentioned (urgency is scaffold-required)

**Observed AI subject + body opening line:**
```
Subject: 
Body (first paragraph):
```

**Notes:**
- 

---

## Flow §3-B — Black Friday WITHOUT stated discount (placeholder test)

**Prompt to type:** `Make a Black Friday campaign` (no offer percentage)

**Expected behavior:**
- AI uses `(your offer here)` placeholder in the body
- Doesn't fabricate a discount value

**Pass criteria (no metrics — qualitative check):**
- [ ] Body contains placeholder marker — `(your offer here)` or similar parenthetical
- [ ] Body does NOT contain any specific % off, $ off, or "limited-time pricing" numbers

**Body snippet showing the placeholder treatment:**
```

```

**Notes:**
- 

---

## Flow §4 — Free-draft (novel category, no scaffold match)

**Prompt to type:** `Send a campaign about our new puppy training class on Saturday mornings`

**Expected behavior:**
- No scaffold matches; AI free-drafts
- Should still produce a cohesive draft with intro → benefit → CTA
- Output tokens likely highest of the 4 flows (free-draft writes more from scratch than a scaffold-guided fill-in)

| Metric | Expected (rough) | Actual | Pass? |
|---|---|---|---|
| Input tokens | ~5,500 - 7,500 | | |
| Output tokens | ~900 - 1,400 (highest — full free-draft, no scaffold scaffold structure to lean on) | | |
| Cached input tokens | Cache hit if previous flows ran in same session | | |
| Cost USD | $0.04 - $0.07 | | |
| Latency (ms) | 4,000 - 9,000 | | |
| Tool iterations | 2 | | |

**Observed AI subject + body opening line:**
```
Subject: 
Body (first paragraph):
```

**Quality check:**
- [ ] Subject is specific to "puppy training class" (not a generic template echo)
- [ ] Body references services where relevant (context block working)
- [ ] AI didn't refuse just because no scaffold matched

**Notes:**
- 

---

## Aggregate metrics (computed from §1-§4)

| Metric | Target | Actual avg | Pass? |
|---|---|---|---|
| Avg cost per flow (USD) | < $0.10 (ideal $0.03 - $0.05) | | |
| Avg latency (ms) | < 8,000 | | |
| p95 latency (ms) — worst single flow | < 12,000 | | |
| Max tool iterations observed | ≤ 3 | | |
| Cache-hit ratio on turns 2+ (cached_input ÷ input) | > 0.5 | | |
| Total tokens across 4 flows (input + output) | ~30K - 50K | | |

---

## Decision matrix

After filling in the actuals, decide:

| Outcome | Action |
|---|---|
| All targets green | **Ship v1.** Lock these baselines into the impl-doc Phase 6 row. Move to v1.5 backlog (proactive cron, scheduling, SMS). |
| Cost > $0.10 / flow | **Tune prompt.** Likely culprit: rules block too long. Move rare-edge-case rules out (e.g., the SMS-not-supported rule can be implicit). Re-measure. |
| Cache-hit ratio < 0.5 | **Investigate prompt structure.** Cache misses come from blocks shorter than 1024 tokens OR blocks marked uncacheable. Verify both rules and context blocks have `cache: true`. |
| Latency > 8s / flow | **Reduce tool iterations.** Tighten prompt rule about "one tool call usually enough" OR make `lookup_audience_count` conditional on AI uncertainty about segment size. |
| Tool iterations consistently 4-5 | **Prompt rule isn't sticking.** Likely Claude is calling `lookup_audience_count` + `propose_campaign_draft` + `propose_campaign_send` + a meta tool, all in one turn. Either accept and re-baseline OR tighten rule 3 ("one propose_campaign_draft per request"). |
| Anti-hallucination fails (§3 fabricated %) | **Critical — block ship.** Tighten prompt rule 4 wording; add an explicit example. Re-test until consistent. |

---

## Sample raw audit row (for reference)

Pasted from one good `claude-sonnet-4-6` run on the Insights surface (similar shape):

```
created_at        | 2026-05-20 14:32:18+00
model             | claude-sonnet-4-6
input_tokens      | 4827
output_tokens     | 312
cached_input_tokens | 0
cost_usd          | 0.019161
tool_calls        | [{"tool":"revenue_summary","args":{"range":"7d"},"display":{...},"latencyMs":847}]
latency_ms        | 3214
```

Marketing-flow rows should look similar in shape, with the tool name swapped for `lookup_audience_count` / `propose_campaign_draft` / etc.

---

## Sign-off

When all four flows are green and the decision matrix is fully resolved:

- [ ] Calibration completed by: _____________ on _____________
- [ ] Baseline numbers committed to memory state pointer
- [ ] Decision: ship v1 / tune / block — _____________
- [ ] If shipping: announce internally; queue v1.5 backlog
