# QA Guide — Ads System (shop opt-in + AI)

Covers two flows end-to-end:

1. **Shop "Request ads" opt-in** — teaser → shop picks a **flat tier** (Starter/Growth/Business) → admin
   approves → shop enrolled on that tier.
2. **Ads AI** — Stage 3 AI-drafted outreach + Stage 3.5 full auto-answer (multi-turn, brand-voiced).

> **Billing model (2026-06-15):** ads is now **flat-tier only** — Starter $199 / Growth $499 / Business $999.
> The shop pays its own ad spend **directly**; the fee is FixFlow's flat management fee. The old Plan A/B/C
> (dashboard fee / 20% markup / pay-per-result) are **retired** (dormant in code, gone from the UI).

Two automated scripts give instant pass/fail; the browser walkthroughs let you watch each flow on-screen.

Prereqs: `NEXT_PUBLIC_ADS_DASHBOARD_ENABLED=true` **and** `NEXT_PUBLIC_ADDON_HUB_ENABLED=true` (frontend — the
hub is the front door to ads now), `ANTHROPIC_API_KEY` set (for the AI), backend + frontend running, `.env`
pointed at the shared DO staging DB (default). Migration **155** must be applied (flat-tier columns). Test shop
below = **peanut**. Remember: `NEXT_PUBLIC_*` vars + new components compile at dev-server **startup** — restart
`npm run dev` (and clear `frontend/.next`) after changing a flag or pulling new UI.

---

## A. Automated tests (fastest confidence)

Both drive the REAL backend repositories/services — the same code the HTTP controllers call.

### A1 — Opt-in cycle (no AI cost)

```bash
cd backend
npx ts-node scripts/qa-ads-enrollment.ts peanut
```

Expected **9/9**: request→pending (Growth tier), admin sees pending, approve→approved, **flat plan set to the
requested tier** (asserts `flat/growth/49900`), re-request-after-approve no-op, decline-with-reason, re-request
reopens a declined request, **campaign brief round-trips** (budget/goal/services). Leaves peanut with a PENDING
request for the browser walkthrough (B).

### A2 — Ads AI (makes ~3 live Haiku calls, a few cents)

```bash
cd backend
npx ts-node scripts/qa-ads-ai.ts peanut --keep
```

Expected **10/10**: spend-cap gate, draft outreach, inbound auto-answered (agent ON), multi-turn reply,
admin manual reply, agent-OFF fallback (not answered), AI cost ledgered, lead auto-marked contacted, full
thread persisted, transport-off → "recorded". Prints the actual AI replies. `--keep` leaves the "ZZ AI QA
Campaign" so you can click it in the UI (C). Drop `--keep` to auto-clean.

> Brand grounding: the AI answers as the **real shop** (from its brand kit), so if you ask a café about phone
> repairs it will politely correct you rather than invent a service. Point test prompts at a shop whose
> industry matches for a realistic demo.

---

## B. Browser walkthrough — the opt-in cycle

### 0. Clean slate (so the shop sees the _form_, not a pending banner)

```bash
cd backend
npx ts-node scripts/cleanup-ads-demo.ts                    # remove the SEED-marked demo campaign only
npx ts-node scripts/qa-ads-enrollment.ts --clean peanut    # remove any QA request
```

> ⚠️ **Also remove ANY other campaigns the shop already has.** `cleanup-ads-demo.ts` only deletes the
> seed-marked campaign (`created_by='ads-seed-script'`) — manually-created ones (e.g. "Spring Promo") persist.
> The enrollment CTA (and its green "enrolled" banner) is **hidden whenever the shop has ≥1 active campaign**
> (`AdEnrollmentCTA` returns null), so leftover campaigns make step 3 look like "nothing happened." Clear them
> via the admin UI (delete each campaign) or directly:
> `UPDATE ad_campaigns SET deleted_at=now() WHERE shop_id='peanut' AND deleted_at IS NULL;`

### 1. Shop discovers + requests

- Log in as **peanut** → you land on **profile** → a yellow **"Want more customers?"** teaser is at the top
- Click **"Explore ads →"** → lands on the **Plans & Billing** hub (the standalone Ads sidebar link was
  removed — ads is reached through the hub now)
- On the **AI Ads Management** card (status "Not enabled") click **"Request ads"** → opens the Ads tab's
  **"Get more customers with ads"** form → pick a **tier (Starter $199 / Growth $499 / Business $999)** →
  optionally fill the **campaign brief** (which services, monthly budget, offer, radius, goal) → **Request ads**
- ✅ Card flips to **"pending review"**; the admin's "Ad program requests" panel shows the brief summary

### 2. Admin approves

- Log in as **admin** → **Ads** tab → **"Ad program requests"** panel shows **peanut** + the **tier** it chose
  (e.g. "wants Growth ($499)")
- Click **Approve** → toast "Approved — plan set." (sets the shop to the flat tier)

### 3. Shop is enrolled

- Back as **peanut** → ✅ green **"You're enrolled in the ad program 🎉"** (teaser is gone)
- ⚠️ **This green banner only shows while the shop has NO campaign yet** — it's the transient state between
  approval and the admin building the first campaign. If the shop already has a campaign (e.g. from a prior
  test, see step 0), the banner is suppressed and you instead see the **ads dashboard** (campaigns +
  performance) — which is itself the "you're enrolled" confirmation. To watch the banner appear, ensure step 0
  cleared all campaigns first.

### 4. (Optional) Admin builds the campaign → shop sees live ads

- Admin → **New Campaign** (Shop ID `peanut`), or `npx ts-node scripts/seed-ads-demo.ts peanut`
- ✅ As peanut, "Your Ads" now shows performance + the leads pipeline

**Decline variant:** in step 2 click **Decline** + reason → as peanut the card shows the reason + "Request again."

---

## C. Browser walkthrough — the AI (Chapter 5)

The AI enters once a lead exists. Use the kept "ZZ AI QA Campaign" (from A2) or any seeded campaign.

### Where it is (admin → Ads → click a campaign → Leads)

- **"Draft reply with AI"** on a new/contacted lead → AI writes the first outreach (Option C)
- **"Chat"** on a lead → conversation thread → **"AI answer"** generates the next reply from the full history
- **"AI auto-answer" toggle** (campaign header) → when ON, incoming lead replies are answered automatically

### Try it

1. Admin → Ads → click the campaign → **Leads** → click **"Chat"** on a lead with a message (e.g. seeded
   "Devon", or QA "Sam")
2. Read the thread → click **"AI answer"** → watch a live, brand-voiced reply appear (~a fraction of a cent)
3. Toggle **AI auto-answer** off/on in the header to see draft-only vs hands-off behavior
4. Each AI reply's cost shows up in the **True Margin** panel (the AI-cost line)

### Honest boundaries

- The AI **converses + nudges toward booking**; it does **not** itself create the booking (separate future work).
- **Transport is gated** (`ADS_LEAD_TRANSPORT_ENABLED` off) → replies are **"recorded"** for manual relay, not
  actually texted, until an SMS/WhatsApp/Messenger provider is wired.

---

## D. Cleanup (leave staging spotless)

```bash
cd backend
npx ts-node scripts/qa-ads-enrollment.ts --clean peanut   # remove the enrollment request
npx ts-node scripts/qa-ads-ai.ts --clean peanut           # remove the AI QA campaign
npx ts-node scripts/cleanup-ads-demo.ts                    # remove any demo campaign + cascaded data
```

---

## Notes

- Approving enrollment only sets the **flat billing tier**; the admin still builds the campaign (Q8/v1).
- The admin **BillingPanel** now offers the 3 flat tiers (Starter/Growth/Business); A/B/C are retired. The
  shop's flat fee accrues monthly as a `flat_tier_fee` charge (nightly `accrueMonthlyFees`); the shop pays its
  own ad spend directly, so there is no spend pass-through charge.
- Billing/Margin panels are **admin-only** and live **inside a campaign detail** (a shop with no campaign yet
  has no billing screen). The shop's own **Plans & Billing** hub (`?tab=plans`) shows its tier read-only.
- Enrollment/decision notifications are best-effort (need `ADMIN_ADDRESSES` + the shop's wallet address).
- All data lands in the shared staging DB — run section D when finished.
