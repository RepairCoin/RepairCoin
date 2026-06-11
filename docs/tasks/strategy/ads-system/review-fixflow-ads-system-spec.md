# Review: FixFlow Centralized Ads System — Developer Build Spec

**Created:** 2026-04-27
**Source:** Executive forward (`c:\dev\ads.txt`, 313 lines)
**Status:** Review / discussion record (pre-implementation)
**Related:** [`ai-sales-agent-integration-strategy.md`](./ai-sales-agent-integration-strategy.md)

---

## TL;DR

The spec is a **solid foundation** — clear phasing, sensible "manual first → Meta API later" philosophy, reasonable DB schema, three billing models surfaced, multi-industry expansion considered. It also overlaps significantly with our existing AI Sales Agent strategy in a complementary way.

There are **gaps that need resolution before coding starts**, mostly around attribution, integration with existing customer/booking tables, compliance, and a few schema details. None are blockers — they're the kind of decisions that should be made deliberately rather than picked up implicitly during coding.

My net recommendation: **proceed with the spec's general direction, but adjust the sequencing slightly to integrate with existing infrastructure (customers, conversations, service_orders) rather than building parallel structures, and resolve the open questions in §6 before Stage 0 starts.**

---

## 1. Spec summary at a glance

| Element | Spec proposes |
|---|---|
| Goal | Centralized system for ad campaigns, lead tracking, AI chat conversion, ROI measurement |
| Hierarchy | Industry → City → Shop → Service → Campaign → Ad Creative |
| New tables | `ad_campaigns`, `ad_creatives`, `ad_leads`, `ad_bookings`, `ad_performance_daily` |
| Phases | 1) Manual Ads Dashboard → 2) Lead Tracking → 3) AI Agent Connection → 4) Meta API → 5) Multi-Industry Scaling |
| Billing models | Option 1 ($299/mo software + shop pays ad spend), Option 2 (FixFlow markup margin), Option 3 (performance fee) |
| Permissions | Super Admin / Ads Manager / Shop Owner / Employee |
| Developer note | "Do not start with Meta API first. Internal system first → prove ROI → automate later." |

---

## 2. What's strong about the spec

1. **Manual-first philosophy is the right call.** Meta Ads API is genuinely complex (OAuth, app review, lead ad webhooks, ad creative compliance review) and is the wrong place to start. Manual entry → measure → automate is the discipline of every successful internal tooling team.
2. **Phased rollout is well-structured.** Each phase delivers real user value and de-risks the next. Phase 1 (manual dashboard) is shippable in 1-2 weeks and immediately useful — admins can prove they can sell the workflow before any code touches Meta.
3. **Lead pipeline is explicit.** `New → Contacted → Booked → Paid → Completed → Lost` is a standard sales funnel and matches what shops will recognize. Good UX-friendly vocabulary.
4. **Three billing models surfaced.** The exec team has thought about commercial structure, not just technical. Option 2 (FixFlow margin) is the most scalable; Option 3 (performance fee) is the most attractive for hesitant shops; Option 1 is a fallback for shops with their own ad accounts.
5. **Multi-industry from day one.** Listing repair, landscaping, gyms, nail salons, barbershops, lawyers, plumbing, electricians signals the platform is designed for breadth, not just RepairCoin's original repair niche. Important for product-market fit.
6. **AI agent is already in scope (Phase 3).** This dovetails with our existing `ai-sales-agent-integration-strategy.md` work — see §5 below.
7. **ROI calculation is given as a first-class concept**, not an afterthought. Spec lists Cost Per Lead, Cost Per Booking, Revenue From Ads, ROI as core metrics.

---

## 3. Gaps and ambiguities

### 3.1 Attribution model is unspecified

The biggest gap. The spec says "leads connect to campaigns" but doesn't explain *how* a lead is attributed to a campaign. Options range from cheap-and-rough to expensive-and-precise:

- **Manual entry only** (Phase 1) — admin tells the system which campaign a lead came from. Workable for MVP, fragile beyond.
- **UTM parameters** on landing URLs — tags the click; survives until the customer fills a form. Standard practice, ~80% accuracy.
- **First-party click ID** in the URL → lookup table → tied to lead. ~95% accuracy.
- **Meta's lead ad form** webhook — when Meta is connected (Phase 4), we get the lead with the campaign ID embedded.
- **Last-touch vs first-touch** — when a customer sees Ad A, then Ad B, then books, who gets credit? (Industry default: last-touch. Some shops want first-touch.)

**Decision needed before Stage 0** so the schema can carry the right fields.

### 3.2 New tables build parallel structures instead of integrating with existing ones

The spec adds `ad_leads`, `ad_bookings`, etc. — but RepairCoin already has:

- `customers` (with profile, tier, RCN balance)
- `conversations` + `messages` (the messaging system the AI agent will use)
- `service_orders` (the booking record with full payment/cancellation/no-show tracking)

If `ad_leads` and `ad_bookings` exist as standalone tables, you end up with two parallel customer histories. Better to:

- **`ad_leads`** → links to `customers` once a lead "becomes" a customer (after first message or booking). Until then, lead has its own row with phone/email; the moment it converts, link via `customer_address`.
- **`ad_bookings`** → not a new table. Add `ad_lead_id` (nullable FK) to `service_orders`. Booking attribution is one column on the existing record.
- **`ad_leads.message_text`** → don't duplicate the messaging history here. Once a conversation starts, point to a `conversation_id`.

This is a refactor of the spec's data model, not a rejection. The spec's *intent* is right; the *implementation* should reuse infrastructure.

### 3.3 No `industries` or `cities` reference tables

The hierarchy says "Industry → City → Shop" but the spec doesn't propose any reference tables. Industries should be enumerated (with the 8+ listed in Phase 5), cities should be referenced. Without this:

- Free-text city names will fragment ("Mission, TX" vs "mission tx" vs "Mission Texas")
- Industry-level analytics (compare Repair vs Landscaping ROI) require denormalized values everywhere

Add: `industries (id, slug, name)` and either `cities (id, name, state, country)` or rely on existing `shops.location_*` columns.

### 3.4 Compliance and consent are absent

Lead capture means handling personal data (name, phone, email). Considerations not in the spec:

- **Consent on lead form** — Meta requires opt-in disclosures; spec should enforce a `consent_text_version` field per lead
- **Data retention policy** — how long do we keep leads that didn't convert? GDPR-style 30/90/180 days?
- **Right-to-be-forgotten** — endpoint for customer to request deletion
- **Communication consent** — separate consent for SMS, WhatsApp, email outreach
- **Ad creative compliance** — Meta and TikTok have content policies; the spec mentions "Manage ad templates" but no review workflow

These aren't "nice to have" — Meta will reject the integration without them, and missing them creates legal exposure.

### 3.5 Pricing model conflicts with existing subscription

The spec mentions "$299/month software" in Option 1, but `CLAUDE.md` documents an existing **$500/month Stripe subscription** for shops. Either:

- Ads is an add-on to the existing $500/mo (clearer, but $500+$299 = expensive)
- Ads is included in a new tier (replacing or upgrading the $500/mo)
- The spec's $299 number is illustrative and the real number is TBD

Needs alignment with the commercial team — affects Stripe SKU design and dashboard pricing.

### 3.6 ROI calculation will be retroactively wrong without refund handling

The spec defines ROI as `revenue / ad_spend`. But:

- Customer books → ROI counted
- Customer cancels next day → spec doesn't say if ROI is debited
- Refund issued → same
- No-show with kept deposit → partial revenue?
- Booking completed but tip later refunded → edge case

The `ad_performance_daily` row is a snapshot; if a booking cancels three days later, the original day's row stays inflated. **Decision: are stored ROI numbers immutable historical, or live-updated with retroactive corrections?** Both are valid; spec should pick one.

### 3.7 No mention of fraud / duplicate / bot lead handling

For paid lead campaigns (especially Meta's lead ads), 5-15% of leads are typically junk (test submissions, bots, accidental clicks). The spec doesn't address:

- Phone number validation (real number, can receive SMS?)
- Email format validation
- Duplicate lead deduplication (same phone within 24h?)
- IP-based rate limiting on lead form submissions
- Low-intent filter (e.g., "just curious" vs "want to book")

Without this, Cost Per Lead looks artificially good (more leads, lower CPL) but Cost Per Booking exposes the truth. Worth surfacing in the dashboard.

### 3.8 AI agent cost is missing from ROI math

Phase 3 connects the AI agent to campaigns. AI inference has cost (~$0.02 per conversation per our earlier strategy doc). For a 100-lead campaign with 30 conversations, that's $0.60 in AI cost. Trivial at small scale, meaningful at large.

The spec's ROI formula `revenue / ad_spend` doesn't include AI cost. Decision: do we expand to `revenue / (ad_spend + ai_cost + platform_fee)`? Or fold AI cost into the platform's $299/mo and ignore it?

### 3.9 Mobile spec is thin

Phase 1 says shop owners can view ads, see leads, and call/message — push notification on new lead. But mobile is where shop owners actually live. Missing:

- Lead response SLA tracking (industry data: 80% of leads close to whoever responds first within 5 min)
- One-tap "claim" / "assign" for multi-employee shops
- AI escalation pings ("AI couldn't answer this, please reply within 10 min")
- Lead detail view with previous conversation history

This is more important than it looks — paid lead value is destroyed by slow response.

### 3.10 No A/B testing or campaign comparison framework

To scale, FixFlow will need to test creatives/audiences/budgets. The spec has no:

- Variant tracking (creative A vs B at same budget)
- Statistical significance helper
- Cohort comparison (same audience, different creative)

Not Phase 1, but should be in the architecture's mind so it doesn't have to be retrofitted painfully.

---

## 4. Schema concerns (specific to the proposed tables)

### `ad_campaigns`
- **Missing:** `paused_at`, `archived_at` for soft-delete; `notes` for internal admin commentary; `ai_agent_enabled` boolean if the AI hookup is per-campaign rather than per-service
- **`target_radius_miles`** — assumes US units; international shops need configurable units (km vs mi)
- **No support for multi-city or multi-radius** targeting (campaign in 3 cities? polygon area?)
- **`status` values** should be enforced via CHECK constraint, not just app-level

### `ad_creatives`
- **No version tracking** — if a creative is edited, is it a new row or a mutation? Affects historical reporting.
- **Missing `creative_type`** — image vs video vs carousel; Meta supports many
- **No `language`** — multilingual ads need this
- **`landing_url`** — should also have a `landing_url_type` (booking page, shop profile, lead form)

### `ad_leads`
- **`lead_status`** as freeform string is fragile; use CHECK constraint with the 5-state pipeline
- **`messenger_id`, `whatsapp_id`** — fine but redundant with a future linked `customer_address` if the lead converts
- **Missing:** `assigned_to_employee_id` (who's handling), `first_response_at`, `first_response_within_sla` (computed)
- **Missing:** `consent_to_contact` boolean + `consent_version`
- **Missing:** `attribution_method` (manual / utm / pixel / meta_webhook) — knowing how confident the attribution is matters for analytics
- **Missing:** `ip_address` / `user_agent` — for fraud detection and duplicate prevention
- **Should reference `customer_address`** (nullable FK) for once-it-converts linking

### `ad_bookings`
- **Recommend not creating this table.** Add `ad_lead_id` (nullable FK) to existing `service_orders` instead. Lookup ROI by joining service_orders → ad_leads → ad_campaigns. Avoids parallel tables and keeps booking-related logic in one place (cancellations, refunds, no-shows already wired in `service_orders`).

### `ad_performance_daily`
- **`date` needs timezone awareness** — a "day" in Manila vs Texas spans different UTC ranges
- **Missing engagement metrics** — `conversation_started`, `messages_received`, `avg_first_response_minutes`
- **`roi` stored as a column** — recommend computed-at-read for accuracy. Stored values silently drift on refunds.
- **No cohort / lag attribution** — revenue from a lead might land 30 days after the click; spec only counts same-day. Add `revenue_30d`, `revenue_90d`.

---

## 5. Synergies with the AI Sales Agent strategy

This is the strongest existing alignment. The AI Sales Agent strategy doc already specifies:

- Per-service AI toggle (`ai_sales_enabled`, `ai_tone`, `ai_suggest_upsells`, `ai_booking_assistance`, `ai_custom_instructions`)
- `AIAgentDomain` with orchestrator, context builder, audit logging
- Tool use: `get_available_slots`, `create_booking`, `get_related_services`, `escalate_to_human`
- Phased rollout (text-first MVP → tool-use → multimodal)

The Ads spec's Phase 3 ("AI Agent Connection") **is** Phase 1 of the AI Sales Agent strategy. They should be unified into a single workstream:

| Ads spec Phase 3 wants | AI strategy already plans |
|---|---|
| Campaign → service → AI agent | `shop_services.ai_sales_enabled` + tone columns |
| AI answers customer | `AgentOrchestrator` + Claude API |
| AI pushes booking/payment | `create_booking` tool + Stripe deposit handling |
| Per-service prompt | `ai_custom_instructions` column + `PromptTemplates[tone]` |

**Recommendation:** when Stage 3 (AI agent connection) of the ads system arrives, **the work is already mostly specified** — the only ads-specific addition is making sure the conversation entrypoint is "lead from ad" rather than "customer-initiated message," and the lead status updates as the AI agent's tool calls fire (`escalate_to_human` → status `contacted-needs-human`, `create_booking` → status `booked`).

---

## 6. Open questions to resolve before coding

These are the decisions the spec leaves ambiguous. Each blocks downstream choices:

1. **Attribution rigor** — Manual entry only? UTM? Click ID? Meta webhook? (§3.1)
2. **Customer/lead unification** — When does an `ad_lead` become a `customers` row? At first message? At first booking? Never (always parallel)? (§3.2)
3. **Booking table strategy** — Standalone `ad_bookings` table, OR add `ad_lead_id` to existing `service_orders`? (Strong recommendation: the latter.) (§3.2)
4. **Pricing alignment** — How does the spec's $299/mo (Option 1) coexist with the existing $500/mo Stripe subscription? Are ads bundled, replaced, or added? (§3.5)
5. **Refund/ROI policy** — Are stored ROI numbers immutable historical or live-updated retroactively? (§3.6)
6. **AI cost in ROI** — Include `ai_inference_cost` in the ROI denominator, or fold into platform fee? (§3.8)
7. **Default billing model** — Of the three options (shop pays direct / FixFlow margin / performance fee), which is the primary go-to-market pitch?
8. **Compliance scope** — Ad creative review by FixFlow (slows shop onboarding) or hands-off (faster but legal risk)? (§3.4)
9. **Data retention** — How long do unconverted leads live in the DB? (§3.4)
10. **Multi-employee leads** — In a shop with several employees, who gets the lead? Round-robin? Shop owner only? Configurable? (§3.9)

---

## 7. Recommendations

### 7.1 Before any code

- Hold a 30-min decision meeting on the 10 questions in §6 (or get exec answers via async doc)
- Confirm `industries` reference list (the 8 from Phase 5: Repair, Landscaping, Gyms, Nail salons, Barbershops, Lawyers, Plumbing, Electricians) — anything missing?
- Confirm pricing alignment with the commercial team (§3.5)

### 7.2 Schema adjustments before Stage 0

- Add `industries` reference table
- Drop standalone `ad_bookings`; add `ad_lead_id` to `service_orders`
- Tighten `ad_leads` schema with the missing fields from §4
- Switch `roi` from stored to computed-at-read
- Add `paused_at`, `archived_at`, `notes` to `ad_campaigns`
- Add CHECK constraints on enum-like columns (`status`, `lead_status`, `platform`)

### 7.3 Sequencing refinement

The spec's 5 phases are good. I'd refine slightly:

| Stage | Spec Phase | Duration | Output |
|---|---|---|---|
| **0 — Foundation** | (pre-Phase 1) | 1 wk | Migrations, reference tables, roles, basic CRUD APIs |
| **1 — Manual Tracking** | Phase 1 | 1-2 wk | Admin enters campaign + daily metrics; basic shop dashboard |
| **2 — Lead Pipeline** | Phase 2 | 1-2 wk | `ad_leads` with status pipeline; admin + shop UI; mobile push |
| **3 — AI Agent Hookup** | Phase 3 | 2-3 wk | Reuse [`ai-sales-agent-integration-strategy.md`](./ai-sales-agent-integration-strategy.md) work; lead → conversation → AI |
| **4 — Meta API** | Phase 4 | 3-4 wk | OAuth, lead webhook, daily metrics import |
| **5 — Multi-industry** | Phase 5 | ongoing | Per-industry service taxonomies, AI personas, dashboards |

Stage 3 timing depends on whether the AI Sales Agent strategy's Phase 1 has shipped — if yes, Stage 3 is just plumbing; if no, the work merges and adds 2-3 weeks.

### 7.4 Beyond MVP — items to add to the architecture's "future-aware" thinking

Don't build these in Phase 1 but design schema/APIs so they can be added later without major refactor:

- **A/B testing variants** — `ad_creatives` should have an `experiment_id` field reserved
- **Cohort analysis** — performance tables should support 30/90/180-day revenue rollups
- **Conversions API** (Meta) — sending revenue back to Meta for ad optimization (Phase 4+ but worth designing for)
- **Multi-touch attribution** — first-touch / last-touch / linear models — schema should record the full sequence of touches per lead, not just the "winning" campaign

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Attribution accuracy is too rough → ROI numbers don't match shop's perception | High | High | Pick attribution model in §6 Q1 before Stage 0; expose attribution method per lead in dashboard for transparency |
| Parallel `ad_leads` / `ad_bookings` tables drift from `customers` / `service_orders` | High | Medium | Adopt §3.2 integration approach; one source of truth |
| Meta API integration takes longer than expected → delays Stage 4 | Medium | Medium | Build manual entry well enough that Stage 4 is optional acceleration, not unblocking |
| AI inference cost on ad-driven conversations exceeds estimates | Medium | Low-Medium | Per-shop AI budget cap (already in AI strategy); auto-throttle to Haiku when 70% spent |
| Compliance issues with lead consent → Meta rejects integration | Medium | High | Add consent fields in Stage 0; use Meta's standard lead form templates; legal review pre-launch |
| Pricing confusion (Option 1's $299 vs existing $500 sub) → shop churn | Medium | High | Resolve §6 Q4 before any pricing UI ships |
| Refund-driven ROI drift not handled → finance disagrees with reported ROI | High | Medium | Pick stored vs computed in §6 Q5; document; add audit trail for retroactive corrections |
| Slow lead response → paid leads waste budget | High | High | First-response SLA tracking + push notifications + AI auto-respond as safety net |

---

## 9. Suggested first-week tasks (if approved as-is, with recommended adjustments)

If the team aligns on §6 questions and accepts §7's adjustments:

1. **Day 1-2:** Database migrations
   - `industries` table (seeded with the 8 from Phase 5)
   - `ad_campaigns`, `ad_creatives` (with adjustments from §4)
   - `ad_leads` (with adjustments from §4)
   - `ad_lead_id` column added to `service_orders`
   - `ad_performance_daily` (without stored `roi`)
2. **Day 3-4:** Domain skeleton
   - New `AdsDomain` following existing DDD pattern (`backend/src/domains/AdsDomain/`)
   - Routes mounted at `/api/ads`
   - Basic CRUD: campaigns, creatives, leads
   - Permission middleware for the 4 roles
3. **Day 5:** Manual entry endpoints
   - Admin: create campaign, add daily metrics row
   - Shop: read campaigns assigned to them
   - Compute ROI on read
4. **Days 6-10:** Frontend Phase 1 dashboard
   - Admin: campaign list, daily metric entry form, all-shops performance view
   - Shop: their own campaign performance card

That gets Stage 1 ("Manual Ads Dashboard") shippable in 2 weeks.

---

## 10. Conclusion

The spec is fundamentally sound. The main work is **resolving the open questions in §6**, **integrating with existing tables rather than building parallel ones**, and **unifying Phase 3 with the AI Sales Agent strategy already drafted**.

If those three things land cleanly, this becomes a high-leverage product surface — paid acquisition + AI conversion + booking + revenue tracking, all in one tool — and one of the most differentiated parts of FixFlow's offering vs generic shop management software.

The exec's "manual first, automate later" instinct is correct. Stick to it; it's what separates this from the "we built a Meta API integration in 3 months and never got product-market fit" path.

---

## Appendix — Cross-references

- **AI Sales Agent strategy:** [`ai-sales-agent-integration-strategy.md`](./ai-sales-agent-integration-strategy.md) — Phase 3 of the ads spec maps directly to Phase 1 of the AI strategy
- **Existing booking infrastructure:** `service_orders`, `shop_no_show_policy`, deposit handling, cancellation flow — all reusable
- **Existing messaging:** `conversations`, `messages`, encrypted message support — AI agent and ad leads route through this
- **Existing customer model:** `customers`, tier system, RCN balance — leads convert into rows here
- **Existing subscription:** `$500/mo Stripe` per `CLAUDE.md` — pricing question in §6 Q4
- **Meta Ads API documentation:** [meta-ads-api](https://developers.facebook.com/docs/marketing-apis/) (for Stage 4; not needed pre-Stage 4)
