# FixFlow AI Operator — Phased Roadmap

**Created:** 2026-06-08
**Source:** exec vision (exec.txt Parts 1–3) — "AI becomes the operating system for the business."
**Scope:** sequences Part 3 (the proactive AI operator) and folds in Part 1/2 (Business Memory + employee roles) where they become prerequisites.

> **Foundation note:** the unified FixFlow assistant already does *Information → Recommendation → Action* in one conversation across insights, marketing, and inventory (revenue/metrics, audience sizing, campaign drafting, low-stock + purchase-order proposals, all confirm-gated). This roadmap **extends a working base — it does not start from zero.**

**Effort key:** S ≈ days · M ≈ 1–2 wks · L ≈ 3–5 wks · XL ≈ multi-month *(rough, for sequencing — not commitments)*

> ⚠️ **Phases 1–4 require NO Twilio / no new SMS vendor.** SMS is decoupled into an optional add-on (see "Optional channels"). The whole proactive-operator experience (brief → recommend → act → diagnose) ships on the **email + in-app** channels we already have.

---

## Phase 0 — Foundation ✅ *(done)*
One-conversation assistant: revenue/insights, audience sizing, campaign drafting, inventory + purchase-order proposals — all confirm-gated. The platform the rest builds on.

## Phase 1 — "Morning Briefing" mode 🟢 — **start here** · **M**
*"How are we doing?"* → one synthesized briefing: revenue trend, top service, lapsed customers + combined value, low stock, underbooked slots → **one recommendation.**
- **Reuses** existing tools + a new "briefing" orchestration mode.
- **New bits:** sum lapsed-customer value; booking-utilization metric.
- **Why first:** biggest demo impact for the least work; makes the Part 3 "How are we doing?" scenario real almost immediately. No dependency on roles or SMS.

## Phase 2 — One-tap "Do it" + revenue estimate 🟢 · **M**
*"Do it."* → the recommendation becomes a **single confirm-tap** that creates + sends the campaign; proposals show an **estimated revenue opportunity**.
- Builds on existing draft/propose. **Keeps the owner-confirms safety gate** (not blind auto-send).
- **New bits:** revenue-projection heuristic; one-tap execute flow.

## Phase 3 — Scheduling (send-later) 🟢 · **M** — *no Twilio*
Schedule campaigns to send at a **future time** (email + in-app), instead of send-now only.
- **New bits:** scheduled-send infra + a "schedule" affordance in the draft/confirm flow.
- Delivers the "scheduled for Friday afternoon" part of the Part 3 vision **without any SMS vendor.**

## Phase 4 — Business diagnostics ("What am I doing wrong?") 🟡 · **M–L**
New analytics: response-time trend, review-conversion funnel, no-show/booking trends → the AI surfaces **"3 likely causes."**
- Covers the **business-level** diagnostics that do **not** need employee data.
- The technician-level diagnostics ("technicians 22% slower") wait on Phase 5.

---

## Phase 5 — Employee roles + Business Memory 🟠 *(Part 1/2)* · **XL**
The big one: employee **accounts + roles** (Owner/Manager/Staff/Technician), **persistent "Business Memory,"** **role-gated visibility**, memory tags (Public/Manager/Owner).
- **New bits:** employee auth/accounts, role-based access control (RBAC), a persistent memory store.
- **Prerequisite** for anything people-level. **Can run as a parallel track** to Phases 1–4.

## Phase 6 — People diagnostics + cross-session memory 🟠 · **L** *(needs Phase 5)*
Per-technician productivity ("22% slower"), team performance; the assistant **remembers across sessions** (the moat: "remembers your entire business").

## Phase 7 — Voice clock-in / recognition 🔵 *(Part 1/2 "future")* · **L–XL**
*"Good morning FixFlow"* → recognizes the employee → clocks in → reads today's tasks.

---

## Optional channels (not on the critical path)
- **SMS / WhatsApp** — adds a text channel to campaigns. Needs a provider (Twilio **or** an alternative) + opt-in/compliance. **Deferred** — Phases 1–4 don't need it, and it can slot in after Phase 3 whenever a provider is chosen.

---

## How to read it
Two tracks that intersect:

- **Track A — Proactive Operator (Part 3):** Phases **1 → 2 → 3 → 4**. Ships visible value fast; **no roles, no SMS vendor** required.
- **Track B — Memory & Roles (Part 1/2):** Phase **5**, which then unlocks **6 → 7**.

**Recommended sequence:**
1. **Phase 1 (Briefing)** — start now; biggest wow for least effort.
2. Phases **2 → 3 → 4** in order on Track A (all Twilio-free).
3. Kick off **Phase 5 in parallel** if the people-level features (technician diagnostics, voice clock-in) are a priority — it's the long pole that gates Phases 6–7.

**Bottom line:** the proactive-operator vision is **doable incrementally on the channels we already have.** Phase 5 (roles/memory) is the heavy, separate investment that powers the people layer.
