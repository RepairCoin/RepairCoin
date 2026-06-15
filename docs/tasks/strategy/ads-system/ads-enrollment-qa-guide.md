# QA Guide — Ads System (shop opt-in + AI)

Covers two flows end-to-end:
1. **Shop "Request ads" opt-in** — teaser → shop requests + picks a plan → admin approves → shop enrolled.
2. **Ads AI** — Stage 3 AI-drafted outreach + Stage 3.5 full auto-answer (multi-turn, brand-voiced).

Two automated scripts give instant pass/fail; the browser walkthroughs let you watch each flow on-screen.

Prereqs: `NEXT_PUBLIC_ADS_DASHBOARD_ENABLED=true` (frontend), `ANTHROPIC_API_KEY` set (for the AI), backend +
frontend running, `.env` pointed at the shared DO staging DB (default). Test shop below = **peanut**.
Remember: `NEXT_PUBLIC_*` vars + new components compile at dev-server **startup** — restart `npm run dev` (and
clear `frontend/.next`) after changing the flag or pulling new UI.

---

## A. Automated tests (fastest confidence)

Both drive the REAL backend repositories/services — the same code the HTTP controllers call.

### A1 — Opt-in cycle (no AI cost)
```bash
cd backend
npx ts-node scripts/qa-ads-enrollment.ts peanut
```
Expected **8/8**: request→pending, admin sees pending, approve→approved, billing plan set to the requested
plan, re-request-after-approve no-op, decline-with-reason, re-request reopens a declined request. Leaves peanut
with a PENDING request for the browser walkthrough (B).

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

### 0. Clean slate (so the shop sees the *form*, not a pending banner)
```bash
cd backend
npx ts-node scripts/cleanup-ads-demo.ts                    # remove any demo campaign
npx ts-node scripts/qa-ads-enrollment.ts --clean peanut    # remove any QA request
```

### 1. Shop discovers + requests
- Log in as **peanut** → you land on **profile** → a yellow **"Want more customers?"** teaser is at the top
- Click **"Explore ads →"** → the **"Get more customers with ads"** form → pick a plan (Managed / Dashboard /
  Pay-per-result) → optional note → **Request ads**
- ✅ Card flips to **"pending review"**

### 2. Admin approves
- Log in as **admin** → **Ads** tab → **"Ad program requests"** panel shows **peanut** + the plan it chose
- Click **Approve** → toast "Approved — plan set."

### 3. Shop is enrolled
- Back as **peanut** → ✅ green **"You're enrolled 🎉 — your campaign is being set up."** (teaser is gone)

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
- Approving enrollment only sets the **billing plan**; the admin still builds the campaign (Q8/v1).
- Billing/Margin panels are **admin-only** and live **inside a campaign detail** (a shop with no campaign yet
  has no billing screen).
- Enrollment/decision notifications are best-effort (need `ADMIN_ADDRESSES` + the shop's wallet address).
- All data lands in the shared staging DB — run section D when finished.
