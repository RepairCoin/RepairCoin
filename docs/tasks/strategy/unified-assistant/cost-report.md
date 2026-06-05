# v2 Cost Report — Unified Assistant (Phases 1–4)

**Status:** ✅ Populated 2026-06-01 from real `ai_orchestrate_messages` audit
rows (the orchestrator logs one row per turn).
**Environment:** DigitalOcean **staging** (`.env`-pointed) — not real production.
**Test shop:** `peanut`
**Sample:** **n = 20 turns**, 0 errors — accumulated across the headless
verifications (Phases 1/3/4) + the manual browser QA (how-did-we-do, win-back,
order-more, approve, etc.). Not a controlled study; a real-usage baseline.
**Model:** `claude-sonnet-4-6` on all 20 (Haiku fallback never triggered — the
shared budget stayed < 70%).

---

## Per-turn metrics (n=20)

| Metric | avg | p50 | p95 | max |
|---|---|---|---|---|
| Cost (USD) | **$0.0220** | $0.0198 | $0.0378 | — |
| Latency (ms) | 10,260 | 10,372 | 18,554 | 19,052 |
| Input tokens (new) | 1,022 | — | — | — |
| Output tokens | 346 | — | — | — |
| Cached input tokens | 13,561 | — | — | — |
| Tool calls / turn | 2.25 | — | — | 6 |

- **Total spend across all 20 turns: $0.44.**
- **Cache hit ratio ≈ 93%** (`cached / (input + cached)` = 13,561 / 14,583) — the
  static system prompt + the full tool-schema block (insights + marketing +
  orchestrator-own) cache strongly; only ~1K new input tokens/turn are billed
  at full rate. This is the big cost lever and it's working.

| Target | Actual | Pass? |
|---|---|---|
| Cost / turn < $0.05 | **$0.022 avg / $0.020 p50** | ✅ ~2.3× under |
| Errors | **0 / 20** | ✅ |
| Cache hit > 0.5 | **~0.93** | ✅ |
| Perceived latency (p50) | **~10.4 s** | ⚠ above a 6 s ideal — see below |

---

## Tool usage (cross-domain confirmed)

Across the 20 turns, tools fired from **all three registries** — proof the
unified orchestrator is genuinely cross-domain, not just one panel rebadged:

| Tool | calls | registry |
|---|---|---|
| `propose_purchase_order` | 9 | orchestrator-own (action) |
| `suggest_followups` | 8 | insights |
| `lookup_audience_count` | 8 | marketing |
| `revenue_summary` | 5 | insights |
| `bookings_breakdown` | 4 | insights |
| `low_stock_items` | 4 | insights |
| `top_services` | 3 | insights |
| `propose_campaign_draft` | 2 | marketing |
| `top_customers` | 1 | insights |
| `suggest_campaign_strategies` | 1 | marketing |

---

## Observations

- **Cost is a non-issue.** ~$0.022/turn, dominated by the downstream Sonnet
  tool-loop — the same per-call profile as the existing Insights/Marketing
  panels. The orchestrator adds no per-call premium beyond running more tools
  in one turn. Cache absorbs ~93% of input.
- **Latency (~10 s p50, ~18.6 s p95)** is the agent loop, not a defect — each
  Sonnet iteration is ~5–6 s and a cross-domain turn often chains 2–3 tools
  (avg 2.25, max 6). Same finding as the AI Marketing cost report. Mitigations
  (deferred, not blocking): stream the reply so it feels responsive; the
  redundant-re-pull / multi-propose tuning (below) would shave an iteration.
- **Known tuning warts (latency/cost only, not correctness):** (1) the
  no-redundant-pull rule is nondeterministic at full-registry scale — a turn
  occasionally re-pulls metrics it already has; (2) `propose_purchase_order`
  proposed one card per critical item (up to 4) rather than the single top
  item. Both are prompt-tunable and best calibrated against real shop data.
- **Model:** always Sonnet here (budget < 70%). Under budget pressure the
  controller drops to Haiku (`useCheaperModel`), which would cut cost further
  at some quality cost on the tool reasoning.

---

## Projection

- **Voice legs** (when used): STT ~$0.0003 + TTS ~$0.002–0.005/reply — trivial
  next to the $0.022 turn.
- **Heavy user** ~500 turns/mo × $0.022 ≈ **~$11/shop/mo** of orchestrator
  spend. This is *new* surface spend — it would add to (not replace) the
  ~$18/mo platform Anthropic baseline (see the anthropic-spend-baseline memory),
  though many of those turns would otherwise have been Insights/Marketing panel
  calls anyway.

---

## Verdict

**v2 (Phases 1–4) is economically sound to ship.** Cost per turn is ~2.3× under
the $0.05 target, error rate is 0, cache hit is ~93%, and the tool spread
confirms real cross-domain use. The only watch-item is **latency** (~10 s p50),
which is the pre-existing agent-loop profile shared with the other AI surfaces —
addressed by streaming + the prompt tuning noted above, neither a v2 blocker.

**Baseline locked** (regression guard): cost/turn ~$0.022, p50 latency ~10 s,
cache ~93%, 0 errors over 20 turns. Flag a future change that pushes cost/turn
above ~$0.04 or p50 latency above ~14 s.

**Caveat:** staging, `peanut`'s thin data, n=20 single-session — a baseline gate,
not a statistical study. Re-measure against real multi-shop usage post-launch.
